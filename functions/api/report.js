// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/report.js
//  Cloudflare Pages Function — paid-report persistence (works with D1).
//
//  Actions (POST { action, ... }):
//    "status"  { chartId, item }                  → { paid, hasEN, hasTA }
//    "fetch"   { chartId, item, lang }            → { paid, lang, sections } | { paid:false }
//    "store"   { chartId, item, lang, sections }  → { stored } (only if already paid)
//
//  SETUP REQUIRED (one-time):
//    Bind a D1 database to this Pages project with the variable name  DB
//    (Cloudflare → Settings → Functions → D1 database bindings → DB = astro_paid)
//    and apply functions/schema.sql.
//
//  NOTE: report rows are CREATED by verify.js at payment time. This endpoint only
//  reads paid status / reads stored reports / fills in the report text. It never
//  marks something paid on its own — that authority belongs to verify.js, which
//  has confirmed a real Razorpay signature.
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
      const row = await env.DB
        .prepare("SELECT report_en, report_ta FROM paid_reports WHERE chart_id = ? AND item = ?")
        .bind(chartId, item).first();
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
      // Only allow storing for a chart that is ALREADY paid (row exists).
      const row = await env.DB
        .prepare("SELECT chart_id FROM paid_reports WHERE chart_id = ? AND item = ?")
        .bind(chartId, item).first();
      if (!row) return json({ stored: false, error: "Not a paid report." }, 403);
      const col = lang === "TA" ? "report_ta" : "report_en";
      await env.DB
        .prepare("UPDATE paid_reports SET " + col + " = ?, updated_at = ? WHERE chart_id = ? AND item = ?")
        .bind(JSON.stringify(body.sections), Date.now(), chartId, item).run();
      return json({ stored: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: "DB error: " + (e && e.message ? e.message : String(e)) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json" },
  });
}
