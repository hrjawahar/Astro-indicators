// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/domain-report.js
//  Generates a per-domain Vedic report (Career, Marriage, etc.) using the
//  Anthropic API as the WRITER, grounded strictly in the engine's facts packet.
//
//  Input : { domainKey, facts }   (facts = analyze.js domainFacts[domainKey])
//  Output: { sections: [ {heading, body}, ... ] }  — same shape the flipbook/PDF use
//
//  SETUP (Cloudflare → Settings → Environment variables):
//    ANTHROPIC_API_KEY = your Anthropic API key
//
//  The engine owns ALL astrology (placements, convergences, conditional flags).
//  The API only writes prose from the facts + flags. It must never invent
//  placements or assert a flag the engine set false (e.g. remarriage).
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ANTHROPIC_API_KEY) return json({ error: "AI writer not configured (ANTHROPIC_API_KEY)." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const domainKey = String(body.domainKey || "");
  const facts = body.facts;
  if (!domainKey || !facts) return json({ error: "Missing domainKey or facts." }, 400);

  try {
    const sections = await writeDomainReport(env, domainKey, facts);
    return json({ success: true, sections });
  } catch (e) {
    return json({ error: e.message || "AI writer failure." }, 500);
  }
}

async function writeDomainReport(env, domainKey, facts) {
  const sys = buildSystemPrompt();
  const user = buildUserPrompt(domainKey, facts);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Anthropic API error " + res.status + ": " + t.slice(0, 300));
  }
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();

  // The model returns JSON: { "sections": [ {heading, body}, ... ] }
  let parsed;
  try {
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    // Fallback: wrap whole text as one section so nothing is lost
    parsed = { sections: [{ heading: facts.title || "Report", body: text }] };
  }
  const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
  if (!sections.length) throw new Error("AI writer returned no sections.");
  return sections;
}

function buildSystemPrompt() {
  return [
    "You are a careful, credible Vedic astrologer writing one section-structured report for AstroIndicators.",
    "VOICE: measured, precise, warm; second person ('you','your'); describe structural tendencies, not fixed fate; hedge honestly where the chart is genuinely ambiguous. Name-blind (never invent or use a person's name).",
    "",
    "ABSOLUTE GROUNDING RULE: You may ONLY use the astrological facts given in the FACTS packet. Never invent placements, signs, houses, dignities, dashas, or aspects. If a fact is not in the packet, do not assert it.",
    "",
    "CONDITIONAL FLAGS: The engine has already decided all conditional astrological findings. Honour the 'flags' object exactly:",
    " - If flags.remarriageIndicated is true, you MAY discuss a possible second union (tie it to the specific D1 7th-house affliction in the facts). If it is false or absent, you MUST NOT mention remarriage at all.",
    " - Same discipline for every other flag: only discuss a flagged theme when its flag is true.",
    "",
    "THE NARRATIVE SPINE (every report follows it): FIRST HALF of life read from D1 → SECOND HALF maturation shown in D9 → the divisional chart independently CONFIRMS the pattern. Emphasise convergences (where two charts agree) as the credibility core — the facts packet lists them.",
    "",
    "OUTPUT FORMAT: Return ONLY valid JSON, no prose around it, of the exact shape:",
    '{ "sections": [ { "heading": "string", "body": "string" }, ... ] }',
    "Use these section headings in order:",
    " 1. 'How to Read This Blueprint'",
    " 2. 'The First Half — Your D1 Foundation'  (include a compact text table of the relevant D1 placements: Planet — Sign — House — Dignity)",
    " 3. 'The Second Half — Maturation in D9'",
    " 4. 'The Confirmation — {vargaLabel}'  (include the divisional placements as a compact text table where a varga chart is provided)",
    " 5. 'Where the Charts Converge'  (state each convergence from the facts plainly; if a neechaBhanga fact is present, explain the debilitation-cancellation and that the planet strengthens with maturity)",
    " 6. 'Timing — When It Unfolds'  (REQUIRED whenever the facts contain dashaTiming: name the current Mahadasha period and the domain-relevant periods with their year ranges and why each matters. Render the periods as a compact text table: 'Planet Mahadasha — years — relevance'. If dashaTiming is absent, omit this section.)",
    " 7. 'Synthesis — Your {title}'",
    "Tables inside body: render as simple aligned text lines (e.g. 'Sun — Aries — 9th — Exalted'), one per line. Keep each section a few tight paragraphs. Total under ~1500 words.",
    "Do NOT include a medical/legal disclaimer in the body — the app adds it.",
  ].join("\n");
}

function buildUserPrompt(domainKey, facts) {
  // Hand the model the structured facts as JSON, plus a short style exemplar drawn
  // from the validated Career sample (keeps the voice/structure honest).
  const exemplar = [
    "STYLE EXEMPLAR (voice & reasoning to emulate — do NOT copy its chart facts):",
    "\"Saturn sitting directly on the Lagna, conjunct Rahu, fuses personal identity with Saturn's nature: patience, structure, delayed reward... Two independent charts agreeing that the 10th lord sits in the 8th house is a strong, convergent signal: career authority runs through depth and transformation work rather than a conventional visible ladder.\"",
    "Notice: it names the exact placement, says what it structurally means, and treats chart-to-chart agreement as the key evidence. Hedge where the facts are close ('this is a close call...').",
  ].join("\n");

  return [
    "Write the '" + (facts.title || domainKey) + "' report for this chart.",
    "Domain focus: " + (facts.focus || domainKey) + ".",
    "Divisional chart used: " + (facts.vargaLabel || "D1 + D9") + ".",
    "",
    exemplar,
    "",
    "FACTS PACKET (your only source of astrological truth):",
    "```json",
    JSON.stringify(facts, null, 1),
    "```",
    "",
    "Return ONLY the JSON object with the sections, following the system instructions exactly.",
  ].join("\n");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
