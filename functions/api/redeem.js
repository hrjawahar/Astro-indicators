// ───────────────────────────────────────────────────────────
//  FILE: functions/api/redeem.js
//  Cloudflare Pages Function — redeem a one-time TEST CODE instead of paying.
//
//  POST { code, chartId, item, email? }
//    → { ok:true, paymentId:"TEST-XXXX" }   report unlocked (paid_reports row written)
//    → { ok:false, error }                   invalid / expired / used / not eligible
//    → 429 { ok:false, error }               too many failed attempts
//
//  RULES
//  • One code = ONE individual Domain report (₹750, user's choice; never LAMP, the bundle, ICC or a consultation)
//    for ONE birth chart. It binds to the chart on first use (atomic UPDATE, so
//    two people can't claim the same code at once).
//  • Same chart + same report again → ok (re-open / re-download, like a paid report).
//  • Different birth details → different chartId → refused → normal payment.
//  • Codes are looked up by SHA-256 hash; failures return a short reason
//    (invalid / revoked / used / expired); 5 failed attempts per IP per 15 minutes.
//  • payment_id is "TEST-<last4>" so test unlocks never count as revenue, and
//    verify.js (referral rewards, invoices) is never involved.
//
//  SETUP: D1 binding DB = astro_paid (same as report.js) and run
//         functions/testcodes-schema.sql once. Optional env TESTCODE_PEPPER.
// ───────────────────────────────────────────────────────────
import { ELIGIBLE_ITEMS, hashCode, hint, isRawChartId, json } from "../utils/testcode-lib.js";

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
// Specific (but safe) reasons for the tester. Codes are 50-bit random and failed
// attempts are rate-limited, so naming the reason doesn't help anyone guess codes.
const MSG = {
  invalid: "This code isn't valid — please check it was typed exactly as sent.",
  revoked: "This code is no longer active.",
  used:    "This code has already been used for another report or birth chart. Each code unlocks one report on one chart.",
  expired: "This code has expired.",
};

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "Not configured." }, 500);
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "Bad request." }, 400); }

  const code    = String(body.code || "");
  const chartId = String(body.chartId || "");
  const item    = String(body.item || "");
  const email   = String(body.email || "").slice(0, 200);
  const ip      = request.headers.get("CF-Connecting-IP") || "unknown";
  const now     = Date.now();

  if (!ELIGIBLE_ITEMS.has(item)) return json({ ok: false, reason: "not_eligible", error: "Test codes work only on individual Domain reports (₹750)." });
  if (!isRawChartId(chartId))    return json({ ok: false, error: "Please generate your chart first." }, 400);

  // Rate limit (failed attempts only).
  const fails = await env.DB.prepare("SELECT COUNT(*) AS n FROM test_code_attempts WHERE ip = ? AND at > ?")
    .bind(ip, now - WINDOW_MS).first();
  if (fails && fails.n >= MAX_FAILS) {
    return json({ ok: false, error: "Too many attempts. Please try again in 15 minutes." }, 429);
  }
  const fail = async (why = "invalid") => {
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO test_code_attempts (ip, at) VALUES (?, ?)").bind(ip, now),
        env.DB.prepare("DELETE FROM test_code_attempts WHERE at < ?").bind(now - 24 * 3600 * 1000),
      ]);
    } catch (_) {}
    return json({ ok: false, reason: why, error: MSG[why] || MSG.invalid });
  };

  if (code.replace(/[^0-9A-Za-z]/g, "").length < 8) return fail("invalid");
  const h = await hashCode(code, env.TESTCODE_PEPPER);
  const row = await env.DB.prepare("SELECT * FROM test_codes WHERE code_hash = ?").bind(h).first();
  if (!row) return fail("invalid");
  if (row.status !== "active") return fail("revoked");

  const paymentId = "TEST-" + hint(code);

  if (row.redeemed_chart_id) {
    // Already bound: only the same chart + same report may re-open it.
    if (row.redeemed_chart_id === chartId && row.redeemed_item === item) {
      await writePaid(env, chartId, item, paymentId, now);
      return json({ ok: true, paymentId, again: true });
    }
    return fail("used");
  }
  if (row.expires_at < now) return fail("expired");

  // Bind atomically: succeeds only if nobody redeemed it a moment ago.
  const upd = await env.DB.prepare(
    "UPDATE test_codes SET redeemed_chart_id = ?, redeemed_item = ?, redeemed_at = ?, redeemed_email = ?, redeemed_ip = ? " +
    "WHERE code_hash = ? AND redeemed_chart_id IS NULL AND status = 'active' AND expires_at >= ?"
  ).bind(chartId, item, now, email, ip, h, now).run();
  if (!upd.meta || upd.meta.changes !== 1) return fail("used");

  const wrote = await writePaid(env, chartId, item, paymentId, now);
  if (!wrote) {
    // Couldn't record the unlock — release the code so it isn't wasted.
    try {
      await env.DB.prepare("UPDATE test_codes SET redeemed_chart_id = NULL, redeemed_item = NULL, redeemed_at = NULL WHERE code_hash = ?").bind(h).run();
    } catch (_) {}
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
  return json({ ok: true, paymentId });
}

// Same paid_reports row a real payment writes (verify.js), with a TEST- id.
async function writePaid(env, chartId, item, paymentId, now) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await env.DB.prepare(
        "INSERT INTO paid_reports (chart_id, item, payment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(chart_id, item) DO UPDATE SET updated_at = excluded.updated_at"
      ).bind(chartId, item, paymentId, now, now).run();
      return true;
    } catch (e) {
      if (attempt < 3) await new Promise(r => setTimeout(r, 150 * attempt));
    }
  }
  return false;
}
