// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/order.js
//  Cloudflare Pages Function — creates a Razorpay ORDER securely.
//
//  WHY THIS EXISTS: A payment order must be created using your SECRET key. The
//  secret can NEVER be in browser code (anyone could see it). So the browser asks
//  THIS function to create the order; the function uses the secret (stored safely
//  in Cloudflare environment variables) and returns only the order id.
//
//  SETUP REQUIRED (one-time, in Cloudflare Pages → Settings → Environment variables):
//    RAZORPAY_KEY_ID      = rzp_test_xxx   (or rzp_live_xxx when live)
//    RAZORPAY_KEY_SECRET  = your secret    (NEVER put this in any file)
// ─────────────────────────────────────────────────────────────────────────────

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

  const amount = Number(body.amount);   // rupees (GST-inclusive)
  const item   = String(body.item || "report");
  if (!amount || amount < 1) return json({ error: "Invalid amount." }, 400);

  // Razorpay expects the amount in paise (smallest unit): ₹399 → 39900
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
