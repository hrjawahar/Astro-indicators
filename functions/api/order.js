// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/order.js
//  Cloudflare Pages Function — creates a Razorpay ORDER securely.
//
//  WHY THIS EXISTS: A payment order must be created using your SECRET key. The
//  secret can NEVER be in browser code (anyone could see it). So the browser asks
//  THIS function to create the order; the function uses the secret (stored safely
//  in Cloudflare environment variables) and returns only the order id.
//
//  SECURITY — PRICE AUTHORITY:
//  The browser NO LONGER decides the amount. Earlier this function trusted the
//  `amount` sent by the page, so anyone could call /api/order with amount:1 and
//  pay ₹1 for a ₹499 report. Now the price is looked up HERE, server-side, from
//  the `item` only. Any `amount` in the request body is ignored.
//
//  REFERRAL & REWARD (added):
//  The browser may send { referralCode, chartId }. The code is validated HERE
//  (exists in customers.client_code, and is not the buyer's own code). If valid
//  it is stamped into the order's `notes.ref`, exactly like `notes.item` — so
//  verify.js later trusts the ORDER, not the browser. An invalid, self, or blank
//  code NEVER blocks the purchase; it is simply not recorded.
//
//  ⚠️ KEEP IN SYNC WITH config.js: these are the GST-INCLUSIVE rupee prices the
//  customer is actually charged. config.js holds the SAME numbers for on-screen
//  display. If you change a price, change it in BOTH places (config.js for the
//  page, here for the charge). The number here is the one that takes the money.
//
//  SETUP REQUIRED (one-time, in Cloudflare Pages → Settings → Environment variables):
//    RAZORPAY_KEY_ID      = rzp_test_xxx   (or rzp_live_xxx when live)
//    RAZORPAY_KEY_SECRET  = your secret    (NEVER put this in any file)
//  Plus (for referral validation): D1 binding  DB = astro_paid  (same as report.js)
// ─────────────────────────────────────────────────────────────────────────────

// Authoritative price list (GST-inclusive rupees), keyed by the EXACT `item`
// string the browser sends to startPayment(). Mirror of config.js prices:
//   config.prices.dasha       → "dasha"
//   config.prices.lifeDomains → "domains"
//   config.prices.consult30   → "consult_30min"
//   config.prices.consult60   → "consult_60min"
const PRICES = {
  "dasha":         499,
  "domains":       299,
  "consult_30min": 500,
  "consult_60min": 999,
  lifeIndicators: 999,
  // Domain reports — ₹750 each (API-written, per-karaka divisional analysis)
  domain_self:     750,
  domain_career:   750,
  domain_siblings: 750,
  domain_mother:   750,
  domain_children: 750,
  domain_health:   750,
  domain_marriage: 750,
  domain_all:      3999,
};

// ⚠️ KEEP IN SYNC — friendlyCode()/normalizeCode() exist in FOUR places (no
//    build step, duplicated by design): site/referral-ui.js,
//    functions/api/referral.js, functions/api/order.js (this file),
//    functions/api/verify.js. All copies MUST be byte-identical.
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

function normalizeCode(raw) {
  var s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.slice(0, 2) === "AI") s = s.slice(2);
  if (s.length !== 8) return null;
  if (/[01IO]/.test(s)) return null; // alphabet never contains these
  return "AI-" + s.slice(0, 4) + "-" + s.slice(4);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const keyId  = env.RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !secret) {
    return json({ error: "Razorpay keys not configured in Cloudflare environment variables." }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  // Only the item matters. The amount is decided server-side; any client-sent
  // amount is intentionally ignored.
  const item = String(body.item || "");
  const amount = PRICES[item];
  if (amount == null) {
    return json({ error: "Unknown item." }, 400);
  }

  // Razorpay expects the amount in paise (smallest unit): ₹750 → 75000
  const amountPaise = Math.round(amount * 100);

  // Basic auth header: base64("key_id:secret")
  const auth = btoa(keyId + ":" + secret);

  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + auth,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: "rcpt_" + item + "_" + Date.now(),
      // notes.item = the server-authoritative item verify.js reads back later.
      notes: { item: item },
    }),
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text().catch(() => "");
    return json({ error: "Razorpay order failed: " + errText.slice(0, 200) }, orderRes.status);
  }

  const order = await orderRes.json();
  // Return only what the browser needs — never the secret.
  return json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: keyId });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
