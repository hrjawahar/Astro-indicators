// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/indicate.js   (v2 — HARDENED)
//  Cloudflare Pages Function — the ONLY pipe to the Anthropic API.
//
//  SECURITY MODEL (do not weaken):
//  • The browser can NEVER send a prompt. It sends { kind, ...structured data }.
//  • All prompts are assembled HERE, server-side, from validated fields only.
//  • Engine facts are the sole source of astrological claims — the AI narrates,
//    it never computes, never adds placements, never predicts beyond the facts.
//  • Guardrail registers (health / visa / legal / child) are enforced in the
//    system prompt per-fact, mirroring the schema's Honest-Alert law.
//  • owner_only facts are rejected at this boundary: they must never be narrated
//    to a customer surface even if a client somehow obtains one.
//
//  ENV: ANTHROPIC_API_KEY  (Cloudflare Pages → Settings → Environment variables)
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";

// ── the narrator's law (Honest-Alert), server-side and non-negotiable ─────────
const SYSTEM_BASE = `You are the narrator for AstroIndicators, a Vedic astrology report.
You receive VERIFIED structured facts computed by a rule engine. Your only job is to
express those facts in warm, clear, plain English for the customer.

ABSOLUTE RULES:
1. Use ONLY the facts given. Never add planets, houses, yogas, dates, or claims not present in the facts.
2. STATE the finding, CONVEY its weight using the intensity given, then POINT to the light (the proactive step). Full-strength honesty, careful register, always actionable.
3. NEVER: diagnose or name an illness; guarantee an outcome; use fear, doom, or alarm; prescribe remedies (gemstones, mantras, poojas, fasting, donations).
4. Confidence is given — you may express it naturally ("a strong signature", "a moderate indication") but never inflate it.
5. Timing windows: present month-and-year ranges as favourable/sensitive periods to act within — never as dates when events "will happen".
6. 3–5 sentences per section unless asked otherwise. Second person ("you", "your chart"). No astrology jargon beyond planet and house names already in the facts.`;

const GUARDRAIL_REGISTER = {
  health: `HEALTH REGISTER: caution-not-diagnosis. Frame as "a period to prioritise proactive health attention", check-ups, rest, prevention. Never name a disease, body part, or mortality. Supportive, never alarming.`,
  visa:   `VISA REGISTER: favourable-window only. The window is when their EFFORT is best placed; approval is never promised or implied. "The wind is at your back" — the outcome rests on their action.`,
  legal:  `LEGAL REGISTER: favourable-positioning only. Never "you will win" or any promised verdict. Outcomes rest on their conduct, preparation, and the facts of the matter.`,
  child:  `CHILD REGISTER: supportive framing only. Never a verdict on whether children happen, never blame, never pressure. Emphasise care, planning, hope, and proactive support.`,
};

// ── minimal server-side fact validation (mirror of the Zod contract) ──────────
const GUARDRAILS = ["none","health","visa","legal","child"];
function validFact(f) {
  return f && typeof f === "object"
    && typeof f.module_id === "string" && /^MOD-[A-Z-]+$/.test(f.module_id)
    && typeof f.question === "string" && f.question.length < 300
    && typeof f.band === "string" && /^[A-Z_]+$/.test(f.band)
    && ["LOW","MODERATE","HIGH","SEVERE"].includes(f.intensity)
    && Number.isInteger(f.confidence) && f.confidence >= 0 && f.confidence <= 100
    && Array.isArray(f.converging_factors) && f.converging_factors.length >= 1
    && f.converging_factors.every(x => x && typeof x.detail === "string" && x.detail.length < 400)
    && Array.isArray(f.timing_windows)
    && typeof f.coded_outcome === "string" && /^[A-Z_]+$/.test(f.coded_outcome)
    && typeof f.proactive_step === "string" && f.proactive_step.length < 1200
    && GUARDRAILS.includes(f.guardrail)
    && f.owner_only !== true;                     // owner-only NEVER narrated here
}

function factBlock(f) {
  const wins = f.timing_windows.map(w =>
    `${w.label}: ${w.start_iso.slice(0,7)} to ${w.end_iso.slice(0,7)}`).join("; ") || "none";
  return [
    `MODULE: ${f.module_id}`,
    `QUESTION: ${f.question}`,
    `VERDICT BAND: ${f.band}  INTENSITY: ${f.intensity}  CONFIDENCE: ${f.confidence}%`,
    `CONVERGING FACTORS: ${f.converging_factors.map(x => x.detail).join(" | ")}`,
    `TIMING WINDOWS: ${wins}`,
    `PROACTIVE STEP (must be the closing thought, in your words): ${f.proactive_step}`,
    `GUARDRAIL: ${f.guardrail}`,
  ].join("\n");
}

function buildPrompt(kind, payload) {
  const facts = payload.facts;
  const name = typeof payload.name === "string" ? payload.name.slice(0, 60).replace(/[^\p{L}\p{N} .'-]/gu, "") : "";
  const registers = [...new Set(facts.map(f => f.guardrail).filter(g => g !== "none"))]
    .map(g => GUARDRAIL_REGISTER[g]).join("\n");
  const system = SYSTEM_BASE + (registers ? "\n\n" + registers : "");

  if (kind === "icc_answer") {
    const user = `Customer${name ? " " + name : ""} asked ${facts.length} question(s) in the Instant Clarity Command.
For EACH fact below, write the answer as JSON: {"answers":[{"module_id":"...","narrative":"3-4 sentences"}]} .
Respond ONLY with that JSON object, no markdown fences, no preamble.

${facts.map(factBlock).join("\n\n---\n\n")}`;
    return { system, user };
  }
  // report_section (flipbook) — one consolidated call, all sections at once, cached downstream
  const user = `Write the Life Indicators Report sections${name ? " for " + name : ""}.
For EACH fact below, write one flipbook section as JSON:
{"sections":[{"module_id":"...","heading":"short warm heading, no jargon","narrative":"4-5 sentences"}]}
Respond ONLY with that JSON object, no markdown fences, no preamble.

${facts.map(factBlock).join("\n\n---\n\n")}`;
  return { system, user };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured." }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  // v2 contract: kind + structured payload. Raw prompts are REJECTED.
  if (typeof body.prompt === "string") {
    return json({ error: "Raw prompts are not accepted. Use { kind, facts }." }, 400);
  }
  const kind = body.kind;
  if (!["report_section", "icc_answer"].includes(kind)) {
    return json({ error: "kind must be report_section or icc_answer." }, 400);
  }
  const facts = Array.isArray(body.facts) ? body.facts : [];
  const max = kind === "icc_answer" ? 3 : 20;
  if (facts.length < 1 || facts.length > max) {
    return json({ error: `facts must contain 1–${max} items for ${kind}.` }, 400);
  }
  if (!facts.every(validFact)) {
    return json({ error: "One or more facts failed validation." }, 400);
  }

  const { system, user } = buildPrompt(kind, { facts, name: body.name });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: kind === "icc_answer" ? 1200 : 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return json({ error: `Anthropic API error ${res.status}: ${t.slice(0, 200)}` }, res.status);
  }
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  let parsed;
  try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return json({ error: "Narrator returned non-JSON output.", raw: text.slice(0, 300) }, 502); }
  return json({ success: true, kind, result: parsed });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
