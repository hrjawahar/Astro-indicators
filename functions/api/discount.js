// ───────────────────────────────────────────────────────────
//  FILE: functions/api/discount.js
//  Cloudflare Pages Function — OWNER-ONLY discount-code admin.
//  Used by /owner-discounts.html. Every request must carry the header
//    X-Admin-Key: <DISCOUNT_ADMIN_KEY>
//
//  POST { action:"create", count, kind, value, days, maxUses, batch, note }
//        → { codes:[...plain codes...], ... }   (plain codes shown ONCE)
//  POST { action:"list",   batch? }             → { rows:[...] }
//  POST { action:"revoke", code? | hint? }      → { revoked:n }
//  POST { action:"check",  code }               → { found, reason, ... }
//
//  SETUP (Cloudflare → Settings → Environment variables, encrypt both):
//    DISCOUNT_ADMIN_KEY = a long random password only you know (16+ chars)
//    DISCOUNT_PEPPER    = another long random string (NEVER change it after codes exist)
//  Plus the D1 binding DB = astro_paid, and run functions/discount-schema.sql once.
// ───────────────────────────────────────────────────────────
import { hashCode, newCode, hint, normalise, safeEqual, applyDiscount, discountLabel, json } from "../utils/discount-lib.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Not configured (D1 binding DB missing)." }, 500);
  const adminKey = env.DISCOUNT_ADMIN_KEY;
  if (!adminKey || adminKey.length < 16) return json({ error: "Set DISCOUNT_ADMIN_KEY (16+ characters) in Cloudflare first." }, 500);
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
    const kind  = body.kind === "fixed" ? "fixed" : "percent";
    let value   = Number(body.value) || 0;
    if (kind === "percent") value = Math.min(Math.max(value, 1), 90);   // 1–90%
    else value = Math.min(Math.max(value, 1), 100000);                  // ₹1–₹1,00,000 off
    // maxUses: blank/0 → NULL (unlimited until expiry); otherwise 1–10000.
    let maxUses = body.maxUses == null || String(body.maxUses).trim() === "" ? null : parseInt(body.maxUses, 10);
    if (maxUses != null) maxUses = Math.min(Math.max(maxUses, 1), 10000);
    const batch = String(body.batch || "").trim().slice(0, 60);
    const note  = String(body.note || "").trim().slice(0, 200);
    const codes = [], stmts = [];
    for (let i = 0; i < count; i++) {
      const c = newCode();
      codes.push(c);
      stmts.push(env.DB.prepare(
        "INSERT INTO discount_codes (code_hash, code_hint, kind, value, batch, note, status, max_uses, uses_count, created_at, expires_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?)"
      ).bind(await hashCode(c, env.DISCOUNT_PEPPER), hint(c), kind, value, batch, note, maxUses, now, now + days * 86400000));
    }
    await env.DB.batch(stmts);
    return json({ codes, kind, value, label: discountLabel(kind, value), maxUses, expiresAt: now + days * 86400000 });
  }

  if (action === "list") {
    const batch = String(body.batch || "").trim();
    const q = "SELECT code_hint, kind, value, batch, note, status, max_uses, uses_count, created_at, expires_at, last_used_at FROM discount_codes " +
              (batch ? "WHERE batch = ? " : "") + "ORDER BY created_at DESC LIMIT 500";
    const res = batch ? await env.DB.prepare(q).bind(batch).all() : await env.DB.prepare(q).all();
    return json({ rows: res.results || [], now });
  }

  if (action === "check") {
    const code = String(body.code || "");
    const row = await env.DB.prepare("SELECT * FROM discount_codes WHERE code_hash = ?")
      .bind(await hashCode(code, env.DISCOUNT_PEPPER)).first();
    if (!row) {
      const sameHint = await env.DB.prepare("SELECT COUNT(*) AS n FROM discount_codes WHERE code_hint = ?")
        .bind(hint(code)).first();
      return json({ found: false, hintMatches: (sameHint && sameHint.n) || 0,
        reason: (sameHint && sameHint.n)
          ? "A code ending in these 4 characters exists, but the full code doesn't match — a typo, or DISCOUNT_PEPPER was changed after this code was created."
          : "No such code. Check for a typo." });
    }
    const exhausted = row.max_uses != null && row.uses_count >= row.max_uses;
    const expired = row.expires_at < now;
    const reason = row.status !== "active" ? "Revoked."
      : expired ? "Expired on " + new Date(row.expires_at).toISOString().slice(0, 10) + "."
      : exhausted ? "Fully used (" + row.uses_count + "/" + row.max_uses + ")."
      : "Valid — " + discountLabel(row.kind, row.value) + " on any report" + (row.max_uses != null ? (", " + (row.max_uses - row.uses_count) + " use(s) left") : "") + ".";
    return json({ found: true, status: row.status, kind: row.kind, value: row.value, label: discountLabel(row.kind, row.value),
      used: row.uses_count, max_uses: row.max_uses, expired, exhausted, batch: row.batch, expires_at: row.expires_at, reason });
  }

  if (action === "revoke") {
    let res;
    if (body.code) {
      res = await env.DB.prepare("UPDATE discount_codes SET status = 'revoked' WHERE code_hash = ?")
        .bind(await hashCode(body.code, env.DISCOUNT_PEPPER)).run();
    } else if (body.hint) {
      res = await env.DB.prepare("UPDATE discount_codes SET status = 'revoked' WHERE code_hint = ?")
        .bind(normalise(body.hint).slice(-4)).run();
    } else return json({ error: "Give the code or its last 4 characters." }, 400);
    return json({ revoked: (res.meta && res.meta.changes) || 0 });
  }

  return json({ error: "Unknown action." }, 400);
}
