// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/facts.js
//  Cloudflare Pages Function — runs the 19-module rule engine server-side.
//  Input : { chart: <the /api/chart response>, gender: "male"|"female"|"unspecified" }
//  Output: { success, facts: EngineFact[] }   (owner-only modules NEVER included)
//
//  The engine bundle (engine-bundle.js) is generated from engine/ by build-engine.sh
//  — do not edit the bundle by hand; edit the TypeScript and rebuild.
// ─────────────────────────────────────────────────────────────────────────────
import { runEngineFromChartResponse } from "./engine-bundle.js";

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const chart = body.chart;
  if (!chart || !chart.d1 || !chart.d1.degrees || !chart.input) {
    return json({ error: "chart must be the /api/chart response object." }, 400);
  }
  const gender = ["male", "female"].includes(body.gender) ? body.gender : "unspecified";

  try {
    // includeOwnerOnly is NOT exposed over HTTP by design — owner analysis is offline.
    const { facts, errors } = runEngineFromChartResponse(chart, gender, {});
    if (errors.length) {
      // A schema failure here is an engine bug, not user error — fail loudly, never ship a bad card.
      return json({ error: "Engine validation failed.", modules: errors.map(e => e.module) }, 500);
    }
    return json({ success: true, facts });
  } catch (e) {
    return json({ error: e.message || "Engine failure." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
