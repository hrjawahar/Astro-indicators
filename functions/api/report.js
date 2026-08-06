// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/report.js
//  Cloudflare Pages Function — paid-report persistence (works with D1).
//
//  Actions (POST { action, ... }):
//    "status"  { chartId, item }                          → { paid, hasEN, hasTA }
//    "fetch"   { chartId, item, lang }                    → { paid, lang, sections } | { paid:false }
//    "store"   { chartId, item, lang, sections, paymentId? } → { stored }
//
//  SETUP REQUIRED (one-time):
//    Bind a D1 database to this Pages project with the variable name  DB
//    (Cloudflare → Settings → Functions → D1 database bindings → DB = astro_paid).
//    RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET must also be set (already are, for
//    order.js/verify.js) — store uses them to self-heal a missing paid row.
//
//  PAYMENT AUTHORITY (important):
//  Paid rows are normally CREATED by verify.js at payment time, after it confirms
//  a real Razorpay signature. This endpoint historically only UPDATED that row.
//  However, if verify.js's write ever fails (e.g. a transient D1 error), the row
//  would be missing and the customer — though they genuinely paid — could never
//  store or re-read their report. To make purchases self-healing, "store" will
//  now CREATE the row when it is missing, but ONLY after re-verifying the payment
//  DIRECTLY with Razorpay (server-to-server): the payment must exist, be captured,
//  and its order notes must match this chartId's purchase of this item. The
//  browser cannot forge this — report.js checks Razorpay itself. Without a valid,
//  matching, captured payment, store still refuses (403), exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured (bind D1 as 'DB')." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const action  = String(body.action || "");
  const chartId = String(body.chartId || "");
  const item    = String(body.item || "");
  if (!chartId || !item) return json({ error: "Missing chartId or item." }, 400);

  try {
    if (action === "status") {
      let row = await env.DB
        .prepare("SELECT report_en, report_ta FROM paid_reports WHERE chart_id = ? AND item = ?")
        .bind(chartId, item).first();

      // Self-heal (mirrors the "store" action): if no row exists but the client
      // can supply a paymentId, re-verify it directly with Razorpay and CREATE
      // the row if it genuinely paid for THIS item. This recovers purchases where
      // verify.js's write failed, so a paid user is never wrongly sent back to
      // the payment gateway. (On a later session the client may not have the
      // paymentId; that case is covered by verify.js's retry writing the row.)
      if (!row) {
        const paymentId = body.paymentId ? String(body.paymentId) : "";
        if (paymentId && await paymentCoversItem(env, paymentId, item)) {
          const now = Date.now();
          await env.DB.prepare(
            "INSERT INTO paid_reports (chart_id, item, payment_id, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT(chart_id, item) DO UPDATE SET payment_id = excluded.payment_id, updated_at = excluded.updated_at"
          ).bind(chartId, item, paymentId, now, now).run();
          row = await env.DB
            .prepare("SELECT report_en, report_ta FROM paid_reports WHERE chart_id = ? AND item = ?")
            .bind(chartId, item).first();
        }
      }

      if (!row) return json({ paid: false, hasEN: false, hasTA: false });
      return json({ paid: true, hasEN: !!row.report_en, hasTA: !!row.report_ta });
    }

    if (action === "fetch") {
      const lang = (body.lang === "TA") ? "TA" : "EN";
      const col  = lang === "TA" ? "report_ta" : "report_en";
      const row = await env.DB
        .prepare("SELECT " + col + " AS doc FROM paid_reports WHERE chart_id = ? AND item = ?")
        .bind(chartId, item).first();
      if (!row) return json({ paid: false });
      if (!row.doc) return json({ paid: true, lang: lang, sections: null }); // paid but not stored yet
      return json({ paid: true, lang: lang, sections: JSON.parse(row.doc) });
    }

    if (action === "store") {
      const lang = (body.lang === "TA") ? "TA" : "EN";
      if (!Array.isArray(body.sections)) return json({ error: "Missing sections." }, 400);
      const col = lang === "TA" ? "report_ta" : "report_en";

      // Is the paid row already present (normal path — verify.js created it)?
      let row = await env.DB
        .prepare("SELECT chart_id FROM paid_reports WHERE chart_id = ? AND item = ?")
        .bind(chartId, item).first();

      // Self-heal: row missing but a payment_id was supplied → re-verify the
      // payment directly with Razorpay and CREATE the row if it genuinely paid
      // for THIS item. This recovers purchases where verify.js's write failed.
      if (!row) {
        const paymentId = body.paymentId ? String(body.paymentId) : "";
        if (!paymentId) {
          return json({ stored: false, error: "Not a paid report." }, 403);
        }
        const ok = await paymentCoversItem(env, paymentId, item);
        if (!ok) {
          return json({ stored: false, error: "Payment could not be verified for this item." }, 403);
        }
        const now = Date.now();
        await env.DB.prepare(
          "INSERT INTO paid_reports (chart_id, item, payment_id, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(chart_id, item) DO UPDATE SET payment_id = excluded.payment_id, updated_at = excluded.updated_at"
        ).bind(chartId, item, paymentId, now, now).run();
        // fall through to write the report text below
      }

      await env.DB
        .prepare("UPDATE paid_reports SET " + col + " = ?, updated_at = ? WHERE chart_id = ? AND item = ?")
        .bind(JSON.stringify(body.sections), Date.now(), chartId, item).run();
      return json({ stored: true, healed: !row });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: "DB error: " + (e && e.message ? e.message : String(e)) }, 500);
  }
}

// ── Verify, server-to-server, that a Razorpay payment genuinely paid for `item`.
// Confirms: the payment exists, is captured (money actually taken), and the order
// it belongs to was created for this same item (order notes stamped by order.js).
// Returns true only if all hold. The browser cannot forge any of this.
async function paymentCoversItem(env, paymentId, item) {
  const keyId  = env.RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return false;
  try {
    const auth = btoa(keyId + ":" + secret);
    const headers = { "Authorization": "Basic " + auth };

    // 1. Fetch the payment; it must be captured (money actually taken).
    const pRes = await fetch(
      "https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId),
      { headers }
    );
    if (!pRes.ok) return false;
    const pay = await pRes.json();
    if (!pay || pay.status !== "captured") return false;
    const orderId = pay.order_id;
    if (!orderId) return false;

    // 2. Fetch the order and confirm its notes.item matches what we're storing.
    const oRes = await fetch(
      "https://api.razorpay.com/v1/orders/" + encodeURIComponent(orderId),
      { headers }
    );
    if (!oRes.ok) return false;
    const order = await oRes.json();
    const orderItem = order && order.notes && order.notes.item ? String(order.notes.item) : "";
    return orderItem === String(item);
  } catch (e) {
    return false;
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json" },
  });
}
