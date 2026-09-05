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
  let parsed = null;
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  // 1) direct, 2) strip markdown fences, 3) extract the first {...} block
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  parsed = tryParse(clean);
  if (!parsed) {
    const first = clean.indexOf("{"), last = clean.lastIndexOf("}");
    if (first !== -1 && last > first) parsed = tryParse(clean.slice(first, last + 1));
  }
  if (!parsed || !Array.isArray(parsed.sections) || !parsed.sections.length) {
    // Last resort: if there's readable text, present it as a single section rather
    // than returning nothing (prevents a blank flipbook).
    if (clean && clean.length > 40) {
      parsed = { sections: [{ heading: (facts.title || "Report"), body: clean.replace(/[{}\[\]"]/g," ").trim() }] };
    } else {
      throw new Error("The AI writer returned an unreadable or empty response.");
    }
  }
  const sections = (parsed.sections || []).filter(s => s && (s.heading || s.body));
  if (!sections.length) throw new Error("AI writer returned no usable sections.");
  return sections;
}

function buildSystemPrompt() {
  return [
    "You are a careful, credible Vedic astrologer writing one section-structured report for AstroIndicators.",
    "VOICE: measured, precise, warm; second person ('you','your'); describe structural tendencies, not fixed fate; hedge honestly where the chart is genuinely ambiguous. Name-blind (never invent or use a person's name).",
    "EMPHASIS: wrap the 2–4 most important phrases or verdicts in each section in **double asterisks** for bold emphasis (e.g. **your career authority runs through depth, not visibility**). Use it sparingly — only the lines a reader should remember. Also start each paragraph on its own line (use blank lines between paragraphs).",
    "AGE FRAMING: when describing the D9 'second half' maturation, give the reader a CONCRETE life-stage they can anchor to. State it plainly early in the D9 section — for example: 'This maturation typically becomes noticeable from your late thirties (around age 36–40) and consolidates through your forties and fifties.' Always phrase it as a general tendency, not an exact prediction, but DO give real ages/decades so the reader knows when to expect it.",
    "",
    "ABSOLUTE GROUNDING RULE: You may ONLY use the astrological facts given in the FACTS packet. Never invent placements, signs, houses, dignities, dashas, or aspects. If a fact is not in the packet, do not assert it.",
    "",
    "CONDITIONAL FLAGS: The engine has already decided all conditional astrological findings. Honour the 'flags' object exactly:",
    " - If flags.remarriageIndicated is true, you MAY discuss a possible second union (tie it to the specific D1 7th-house affliction in the facts). If it is false or absent, you MUST NOT mention remarriage at all.",
    " - If flags.progenyHighCare is true, treat the children area as one that asks for extra patience, care, and realistic expectations — raise it GENTLY and NOTICEABLY, never as a verdict. Say things like 'this is an area the chart asks you to hold with particular care and patience' — NEVER predict a specific problem, disability, or outcome for a child. If a D9 caution is in the convergences, surface it as the central caveat, framed as curriculum to hold, not misfortune.",
    " - If flags.domainSoulCentral is true, make clear this area is central to the person's life-purpose and will carry real weight (not peripheral).",
    " - If flags.healthWatch is true, keep all health language non-diagnostic and reflective; the app adds a medical disclaimer.",
    " - Same discipline for every other flag: only discuss a flagged theme when its flag is true.",
    "",
    "WATCH OUT FOR (the conditional caution): flags.watchOutFor is the engine's decision about whether this chart has a GENUINE, scored convergence that earns a prominent caution. If flags.watchOutFor is present (a non-empty string), you MUST surface it in section 5 under a bold '**Watch out for:**' label, conveying its content faithfully — framed as a hint to PREPARE, with timing, never as a verdict or diagnosis. If flags.watchOutFor is ABSENT, there is NO clear convergence — do NOT invent a caution, do NOT add a 'Watch out for' line; give the calm plain reading. flags.severityTier ('plain'|'moderate'|'strong') tells you how much weight the cautions deserve: 'plain' = keep it light and ordinary; 'moderate' = a measured note; 'strong' = give it real, noticeable emphasis (this is the rare, genuinely-loaded chart). NEVER escalate beyond the tier the engine set.",
    "",
    "CAUTION TONE (critical): when the facts contain any caution (a D9 dusthana caution, an afflicted lord, a high-care flag), your job is to make it CAUTIONARY AND NOTICEABLE WITHOUT GIVING A VERDICT. Name the area that needs care, explain it as a theme to hold with patience, and always leave room for growth and agency. Never state that something bad WILL happen. Prefer 'the chart asks you to…', 'this area rewards patience and realistic expectations', 'hold this gently' over any deterministic claim.",
    "",
    "BOLD HEADLINE SHIFT: if flags.shift is present, OPEN the 'Second Half — Maturation in D9' section with that shift as a STANDALONE BOLD sentence on its own line (wrap it in **double asterisks**), BEFORE any explanation. This is the reader's single most important takeaway and must hit them first. Example: '**Your visible corporate track is likely to give way to independent, advisory work as life matures.**' Then explain why using the D1/D9 facts.",
    "",
    "ANTARDASHA TIMING: the dashaTiming facts include 'currentAD' (the current Mahadasha + Antardasha sub-period) and 'keyWindows' (specific MD+AD sub-periods that most activate this area). In the Timing section, name the current MD AND its current AD, and call out the key MD/AD sub-windows with their year ranges — because real events land at the sub-period level, not just the Mahadasha. Render keyWindows as a compact list: 'Venus sub-period within Jupiter (2018–2020) — …'.",
    "",
    "HEALTH DEPTH (health domain only): if flags.healthAreas / flags.healthNotes are present, name the STRESSED AREAS clearly and give them STRONG, NOTICEABLE emphasis (this helps the reader take extra precautions and seek professional care early) — but NEVER name a specific disease, diagnosis, or predict a specific medical outcome, and never do so for a child. Present the areas IN THE ORDER GIVEN (the engine has already ranked them by importance). If flags.healthCognitivePrimary is true, the NERVOUS-SYSTEM / MIND / FOCUS / TEMPERAMENT theme is the headline of the whole report — lead with it, give it the most space, and bold the key line; mention injury/inflammation only ONCE and clearly as secondary (do not repeat blood/accident language across multiple sections). Frame as: 'This chart asks for particular attention to [area] — worth proactive support and professional guidance.' Pair each area with the closest MD/AD window from dashaTiming when it is most active. Keep it precaution-oriented and empowering; rely on the app's medical disclaimer.",
    "",
    "THE NARRATIVE SPINE (every report follows it): FIRST HALF of life read from D1 → SECOND HALF maturation shown in D9 → the divisional chart independently CONFIRMS the pattern. Emphasise convergences (where two charts agree) as the credibility core — the facts packet lists them.",
    "",
    "OUTPUT FORMAT: Return ONLY valid JSON, no prose around it, of the exact shape:",
    '{ "sections": [ { "heading": "string", "body": "string" }, ... ] }',
    "Use these section headings in order. Sections 1–4 are the TECHNICAL analysis (for readers with astrology knowledge — keep the chart mechanics, placements, and tables here). Sections 5–7 are PLAIN-LANGUAGE takeaways (for every reader — minimal jargon, focus on insight, action, and timing). Do NOT repeat the same finding across multiple sections — state each convergence ONCE.",
    " 1. 'How to Read This Blueprint'  (brief framing)",
    " 2. 'The First Half — Your D1 Foundation'  (full technical placement analysis + a compact D1 table: Planet — Sign — House — Dignity)",
    " 3. 'The Second Half — Maturation in D9'  (technical D9 analysis; weave in the approximate life-stage — late thirties onward, through the forties and fifties — so the reader knows WHEN this matures)",
    " 4. 'Where the Charts Agree'  (MERGE what used to be Confirmation and Convergence into ONE tight section. State each genuine convergence from the facts ONCE, as a short list. If a neechaBhanga fact is present, explain the debilitation-cancellation here. Do NOT re-derive placements already covered in sections 2–3 — just name the agreement and why it matters. This section replaces the old repetitive Confirmation+Convergence.)",
    " 5. 'What This Means For You'  (PLAIN LANGUAGE, minimal jargon. Structure it as: FIRST a short 'Your strengths' paragraph (every reading leads with what is working). THEN — ONLY IF flags.watchOutFor is present — a clearly-labelled '**Watch out for:**' line that conveys that exact hint, framed as preparation not prediction, never a diagnosis, always with agency. If flags.watchOutFor is absent, DO NOT include a 'Watch out for' line at all — just give the calm, plain reading. THEN a short 'What you can do' paragraph (practical, empowering).)",
    " 6. 'Timing — When It Unfolds'  (PLAIN LANGUAGE timeline. REQUIRED when dashaTiming is present: name the current Mahadasha AND its current Antardasha sub-period, then the key MD/AD windows with year ranges and why each matters, as a compact list. Real events land at the sub-period level. If dashaTiming is absent, omit this section.)",
    " 7. 'The Bottom Line'  (2–4 sentences: the single most important thing to remember, in plain language. This is the last thing they read — make it land.)",
    "Tables inside body: render as simple aligned text lines (e.g. 'Sun — Aries — 9th — Exalted'), one per line. Keep each section tight. Total under ~1500 words.",
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
