// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/reviews.js
//  Cloudflare Pages Function — customer reviews / testimonials.
//
//  POST actions:
//    { action:"submit", body, displayName?, place?, anonymous? }
//        → stores a review as PENDING (never auto-approved). Returns { ok:true }.
//    { action:"list" }
//        → returns up to 50 APPROVED reviews (newest first):
//          { reviews:[ { name, place, body, created_at }, ... ] }
//
//  Approval is done by the owner directly in the D1 console (see reviews_schema.sql).
//  Requires the same D1 binding `DB` used by report.js / verify.js.
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  let b;
  try { b = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const action = String(b.action || "");

  // ── LIST approved reviews (public) ──────────────────────────────────────────
  if (action === "list") {
    try {
      const res = await env.DB
        .prepare("SELECT display_name, place, is_anonymous, body, created_at FROM reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 50")
        .all();
      const reviews = (res.results || []).map((r) => ({
        name: r.is_anonymous ? "Anonymous" : (r.display_name || "Anonymous"),
        place: r.place || "",
        body: r.body || "",
        created_at: r.created_at,
      }));
      return json({ reviews });
    } catch (e) {
      return json({ reviews: [] });
    }
  }

  // ── SUBMIT a review (stored as pending) ─────────────────────────────────────
  if (action === "submit") {
    const body = String(b.body || "").trim();
    if (!body) return json({ error: "Review text is required." }, 400);
    if (body.length > 1200) return json({ error: "Review is too long." }, 400);

    const anonymous = b.anonymous ? 1 : 0;
    const displayName = String(b.displayName || "").trim().slice(0, 60);
    const place = String(b.place || "").trim().slice(0, 80);

    try {
      await env.DB
        .prepare("INSERT INTO reviews (display_name, place, is_anonymous, body, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
        .bind(anonymous ? "" : displayName, place, anonymous, body, Date.now())
        .run();
      return json({ ok: true });
    } catch (e) {
      return json({ error: "Could not submit review. Please try again." }, 500);
    }
  }

  return json({ error: "Unknown action." }, 400);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
