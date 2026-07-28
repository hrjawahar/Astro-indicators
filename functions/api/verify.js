// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/verify.js
//  Cloudflare Pages Function — verifies a Razorpay payment is genuine, records
//  the paid chart in D1 (so it stays unlocked across sessions / devices), and
//  (for consultation bookings) emails the booking details to the app owner.
//
//  WHY: After payment, the browser could lie about success. Razorpay signs each
//  successful payment; only the SECRET can verify that signature. So we verify
//  here, server-side, before unlocking anything, recording payment, or emailing.
//
//  REFERRAL & REWARD (added):
//  On a verified report payment this function now also writes into `customers`:
//    client_code  — the buyer's own friendly Client ID (computed from chartId)
//    referred_by  — the referrer's code, read from the ORDER's notes.ref (which
//                   order.js validated & stamped at creation — the browser is
//                   never trusted for this). First referral wins: an existing
//                   referred_by is never overwritten.
//    mobile       — form value wins; if the form was blank we fetch the payment
//                   from Razorpay and use the contact typed at checkout.
//  Rewards therefore only ever attach to REAL verified payments.
//
//  SETUP (Cloudflare → Settings → Environment variables):
//    RAZORPAY_KEY_ID       = your key id (already set for order.js — now also
//                            used here to look the order up at verify time)
//    RAZORPAY_KEY_SECRET   = your secret (already set for order.js)
//    OWNER_EMAIL           = where consultation bookings are emailed to you
//    RESEND_API_KEY        = (optional) for email sending
//  SETUP (Cloudflare → Settings → Functions → D1 bindings):
//    DB = your D1 database (astro_paid)  — see functions/schema.sql and
//         functions/referral-migration.sql (run once)
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ KEEP IN SYNC — friendlyCode() exists in FOUR places (no build step,
//    duplicated by design): site/referral-ui.js, functions/api/referral.js,
//    functions/api/order.js, functions/api/verify.js (this file).
//    All copies MUST be byte-identical.
function friendlyCode(chartId) {
  var s = String(chartId || "");
  function fnv(seed) {
    var h = seed >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      // h = (h * 16777619) mod 2^32, without Math.imul for max compatibility
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  var A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Crockford-style: no 0/O/1/I
  var h1 = fnv(0x811c9dc5), h2 = fnv(0x9747b28c), out = "", i;
  for (i = 0; i < 4; i++) { out += A[h1 & 31]; h1 >>>= 5; }
  for (i = 0; i < 4; i++) { out += A[h2 & 31]; h2 >>>= 5; }
  return "AI-" + out.slice(0, 4) + "-" + out.slice(4);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret) return json({ error: "Razorpay secret not configured." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    booking, chartId, item, email, mobile,
  } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: "Missing payment fields." }, 400);
  }

  // ── Verify the signature: HMAC-SHA256(order_id + "|" + payment_id, secret) ──
  const expected = await hmacSha256Hex(secret, razorpay_order_id + "|" + razorpay_payment_id);
  if (expected !== razorpay_signature) {
    return json({ verified: false, error: "Payment signature mismatch." }, 400);
  }

  // Payment is genuine.
  // ── Determine WHAT was paid for (and WHO referred) from the ORDER ──────────
  // order.js stamps { item, ref } into the order's `notes` at creation time,
  // after server-side validation. We read them back from Razorpay here so a
  // client can neither claim a more expensive item nor forge a referral at
  // verify time. The client-sent `item` is used only as a fallback if the order
  // lookup is briefly unavailable (an attacker cannot force that lookup to
  // fail, since it is a server-to-server call). There is NO client fallback for
  // the referral — no notes, no referral.
  let paidItem = item;
  let refCode  = "";
  if (chartId) {
    const notes = await fetchOrderNotes(env, razorpay_order_id);
    if (notes && notes.item) paidItem = notes.item;
    if (notes && notes.ref)  refCode  = notes.ref;
  }

  // ── Record the paid report in D1 (so it persists across sessions) ──────────
  // Only for report purchases (chartId + item present). Consultations skip this.
  if (env.DB && chartId && paidItem) {
    try {
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO paid_reports (chart_id, item, payment_id, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(chart_id, item) DO UPDATE SET payment_id = excluded.payment_id, updated_at = excluded.updated_at"
      ).bind(String(chartId), String(paidItem), razorpay_payment_id, now, now).run();
    } catch (e) {
      // Don't fail the payment verification if the DB write hiccups — the user
      // still paid. They can re-download; status will self-heal on next write.
    }
  }

  // ── Upsert the customer row: email, name, client_code, referred_by, mobile ──
  // Runs for every verified report payment (even with no email), because the
  // buyer's client_code and mobile matter for the reward program.
  if (env.DB && chartId) {
    try {
      // Mobile: the birth-form value wins; if blank, use the contact number the
      // buyer typed inside Razorpay checkout (fetched from the payment entity).
      let mob = mobile ? String(mobile).trim() : "";
      if (!mob) {
        mob = (await fetchPaymentContact(env, razorpay_payment_id)) || "";
      }
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO customers (chart_id, email, name, client_code, referred_by, mobile, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(chart_id) DO UPDATE SET " +
        "  email       = COALESCE(NULLIF(excluded.email, ''), customers.email), " +
        "  name        = COALESCE(NULLIF(excluded.name,  ''), customers.name), " +
        "  client_code = COALESCE(customers.client_code, excluded.client_code), " +
        "  referred_by = COALESCE(customers.referred_by, NULLIF(excluded.referred_by, '')), " + // first referral wins
        "  mobile      = COALESCE(NULLIF(excluded.mobile, ''), customers.mobile), " +           // form wins, gaps filled
        "  updated_at  = excluded.updated_at"
      ).bind(
        String(chartId),
        email ? String(email) : "",
        body.name ? String(body.name) : "",
        friendlyCode(String(chartId)),
        refCode || "",
        mob,
        now, now
      ).run();
    } catch (e) {
      // Customer storage is best-effort; never block a verified payment over it.
    }
  }

  // If this was a consultation booking, notify the owner.
  if (booking && booking.type === "consultation") {
    await notifyOwner(env, booking, razorpay_payment_id).catch(() => {});
  }

  // clientCode returned so the success UI can show the activation message:
  // "✓ Your Client ID AI-XXXX-XXXX is now active for referrals — share it!"
  return json({
    verified: true,
    paymentId: razorpay_payment_id,
    clientCode: chartId ? friendlyCode(String(chartId)) : null,
  });
}

// ── Email the booking to the owner (uses Resend, a simple email API) ──────────
async function notifyOwner(env, booking, paymentId) {
  const ownerEmail = env.OWNER_EMAIL;
  const resendKey  = env.RESEND_API_KEY;
  if (!ownerEmail || !resendKey) return; // not configured yet — skip silently

  const subject = "New Consultation Booked — " + (booking.name || "client");
  const text =
    "A new consultation has been booked and paid for.\n\n" +
    "Name: "    + (booking.name  || "-") + "\n" +
    "Phone: "   + (booking.phone || "-") + "\n" +
    "Email: "   + (booking.email || "-") + "\n" +
    "DOB: "     + (booking.dob   || "-") + "\n" +
    "Duration: "+ (booking.duration || "-") + "\n" +
    "Amount: ₹" + (booking.amount || "-") + "\n" +
    "Preferred date: " + (booking.date || "-") + "\n" +
    "Question: " + (booking.query || "-") + "\n\n" +
    "Razorpay payment id: " + paymentId + "\n\n" +
    "Please call the client within 24 hours.";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + resendKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AstroIndicators <bookings@astroindicators.com>",
      to: [ownerEmail],
      subject: subject,
      text: text,
    }),
  });
}

// ── Read the notes the order was actually created with (from Razorpay) ────────
// order.js stores { notes: { item, ref } } when it creates the order. We fetch
// the order and return those notes, so verify trusts the order — not the
// browser. Returns { item, ref } (either may be empty), or null on failure.
async function fetchOrderNotes(env, orderId) {
  const keyId  = env.RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return null;
  try {
    const auth = btoa(keyId + ":" + secret);
    const res = await fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(orderId), {
      headers: { "Authorization": "Basic " + auth },
    });
    if (!res.ok) return null;
    const order = await res.json();
    const n = (order && order.notes) || {};
    return {
      item: n.item ? String(n.item) : "",
      ref:  n.ref  ? String(n.ref)  : "",
    };
  } catch (e) {
    return null;
  }
}

// ── Read the contact number typed inside Razorpay checkout ────────────────────
// The checkout handler response only carries ids, so the number the buyer typed
// at checkout lives on the payment entity. Fetched only when the birth form's
// mobile field was left blank. Returns the contact string, or null.
async function fetchPaymentContact(env, paymentId) {
  const keyId  = env.RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return null;
  try {
    const auth = btoa(keyId + ":" + secret);
    const res = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId), {
      headers: { "Authorization": "Basic " + auth },
    });
    if (!res.ok) return null;
    const pay = await res.json();
    return pay && pay.contact ? String(pay.contact) : null;
  } catch (e) {
    return null;
  }
}

// ── Crypto helper: HMAC-SHA256 → hex string ───────────────────────────────────
async function hmacSha256Hex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json" },
  });
}
