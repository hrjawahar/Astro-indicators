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
//  SETUP (Cloudflare → Settings → Environment variables):
//    RAZORPAY_KEY_SECRET   = your secret (already set for order.js)
//    OWNER_EMAIL           = where consultation bookings are emailed to you
//    RESEND_API_KEY        = (optional) for email sending
//  SETUP (Cloudflare → Settings → Functions → D1 bindings):
//    DB = your D1 database (astro_paid)  — see functions/schema.sql
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret) return json({ error: "Razorpay secret not configured." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    booking, chartId, item,
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
  // ── Record the paid report in D1 (so it persists across sessions) ──────────
  // Only for report purchases (chartId + item present). Consultations skip this.
  if (env.DB && chartId && item) {
    try {
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO paid_reports (chart_id, item, payment_id, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(chart_id, item) DO UPDATE SET payment_id = excluded.payment_id, updated_at = excluded.updated_at"
      ).bind(String(chartId), String(item), razorpay_payment_id, now, now).run();
    } catch (e) {
      // Don't fail the payment verification if the DB write hiccups — the user
      // still paid. They can re-download; status will self-heal on next write.
    }
  }

  // If this was a consultation booking, notify the owner.
  if (booking && booking.type === "consultation") {
    await notifyOwner(env, booking, razorpay_payment_id).catch(() => {});
  }

  return json({ verified: true, paymentId: razorpay_payment_id });
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
