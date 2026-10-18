// ───────────────────────────────────────────────────────────
//  FILE: functions/api/testcode.js
//  Cloudflare Pages Function — OWNER-ONLY test-code admin.
//  Used by /owner-testcodes.html. Every request must carry the header
//    X-Admin-Key: <TESTCODE_ADMIN_KEY>
//
//  POST { action:"create", count, batch, note, days }  → { codes:[...plain codes...] }  (shown ONCE)
//  POST { action:"list",   batch? }                    → { rows:[...] }   (no hashes, no plain codes)
//  POST { action:"revoke", code? | hint? }             → { revoked:n }
//
//  SETUP (Cloudflare → Settings → Environment variables, encrypt both):
//    TESTCODE_ADMIN_KEY = a long random password only you know
//    TESTCODE_PEPPER    = another long random string (never change it after codes exist)
// ───────────────────────────────────────────────────────────
import { hashCode, newCode, hint, normalise, safeEqual, json } from "../utils/testcode-lib.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Not configured." }, 500);
  const adminKey = env.TESTCODE_ADMIN_KEY;
  if (!adminKey || adminKey.length < 16) return json({ error: "Set TESTCODE_ADMIN_KEY (16+ characters) in Cloudflare first." }, 500);
  if (!safeEqual(request.headers.get("X-Admin-Key"), adminKey)) {
    await new Promise(r => setTimeout(r, 600));           // slow down guessing
    return json({ error: "Not authorised." }, 401);
  }

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Bad request." }, 400); }
  const action = String(body.action || "");
  const now = Date.now();

  if (action === "create") {
    const count = Math.min(Math.max(parseInt(body.count, 10) || 1, 1), 50);
    const days  = Math.min(Math.max(parseInt(body.days, 10) || 30, 1), 365);
    const batch = String(body.batch || "").trim().slice(0, 60);
    const note  = String(body.note || "").trim().slice(0, 200);
    const codes = [], stmts = [];
    for (let i = 0; i < count; i++) {
      const c = newCode();
      codes.push(c);
      stmts.push(env.DB.prepare(
        "INSERT INTO test_codes (code_hash, code_hint, batch, note, status, created_at, expires_at) VALUES (?, ?, ?, ?, 'active', ?, ?)"
      ).bind(await hashCode(c, env.TESTCODE_PEPPER), hint(c), batch, note, now, now + days * 86400000));
    }
    await env.DB.batch(stmts);
    return json({ codes, expiresAt: now + days * 86400000 });
  }

  if (action === "list") {
    const batch = String(body.batch || "").trim();
    const q = "SELECT code_hint, batch, note, status, created_at, expires_at, redeemed_item, redeemed_at, redeemed_email, " +
              "CASE WHEN redeemed_chart_id IS NULL THEN 0 ELSE 1 END AS used FROM test_codes " +
              (batch ? "WHERE batch = ? " : "") + "ORDER BY created_at DESC LIMIT 500";
    const res = batch ? await env.DB.prepare(q).bind(batch).all() : await env.DB.prepare(q).all();
    return json({ rows: res.results || [], now });
  }

  if (action === "revoke") {
    let res;
    if (body.code) {
      res = await env.DB.prepare("UPDATE test_codes SET status = 'revoked' WHERE code_hash = ?")
        .bind(await hashCode(body.code, env.TESTCODE_PEPPER)).run();
    } else if (body.hint) {
      res = await env.DB.prepare("UPDATE test_codes SET status = 'revoked' WHERE code_hint = ? AND redeemed_chart_id IS NULL")
        .bind(normalise(body.hint).slice(-4)).run();
    } else return json({ error: "Give the code or its last 4 characters." }, 400);
    return json({ revoked: (res.meta && res.meta.changes) || 0 });
  }

  return json({ error: "Unknown action." }, 400);
}
