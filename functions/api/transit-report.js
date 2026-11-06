// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/transit-report.js
//  Generates the paid Saturn TRANSIT (Gochara) report using the Anthropic API as
//  the WRITER, grounded strictly in the engine's transit facts packet (built in
//  chart.js: saturnTransit + Ashtakavarga strength) plus the current Dasha.
//
//  Input : { facts }   (assembled client-side from window.currentData)
//  Output: { sections: [ {heading, body}, ... ] }   (same shape as domain-report)
//
//  SETUP (Cloudflare → Settings → Environment variables):
//    ANTHROPIC_API_KEY = your Anthropic API key
//
//  The ENGINE owns all astrology — signs, houses-from-Moon, phase dates,
//  Ashtakavarga bindus, the current Mahadasha/Antardasha. The API only writes
//  prose from the facts. It must never invent a placement, a date, a bindu, or a
//  dasha, and never turn Saturn into doom. Transit is always subordinate to the
//  Dasha. Generated fresh each time (transit content is perishable; never cached).
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ANTHROPIC_API_KEY) return json({ error: "AI writer not configured (ANTHROPIC_API_KEY)." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const facts = body.facts;
  if (!facts || !facts.current) return json({ error: "Missing transit facts." }, 400);

  try {
    const sections = await writeTransitReport(env, facts);
    return json({ success: true, sections });
  } catch (e) {
    return json({ error: e.message || "AI writer failure." }, 500);
  }
}

async function writeTransitReport(env, facts) {
  const sys = buildSystemPrompt();
  const user = buildUserPrompt(facts);

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

  // Expected: { "sections": [ {heading, body}, ... ] }. Parse robustly, then
  // salvage, then a clean last resort — never dump raw JSON labels into the report.
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = clean.indexOf("{"), last = clean.lastIndexOf("}");
  const block = (first !== -1 && last > first) ? clean.slice(first, last + 1) : clean;

  let parsed = tryParse(clean) || tryParse(block) || tryParse(sanitizeJsonish(block));
  let sections = (parsed && Array.isArray(parsed.sections)) ? parsed.sections : null;

  if (!sections || !sections.length) {
    const salv = salvageSections(sanitizeJsonish(block));
    if (salv.length) sections = salv;
  }
  if (!sections || !sections.length) {
    const stripped = clean.replace(/[{}\[\]"]/g, " ")
                          .replace(/\b(sections|heading|body)\s*:/gi, " ")
                          .replace(/\s+,/g, " ").replace(/\s{2,}/g, " ").trim();
    if (stripped.length > 40) sections = [{ heading: "Your Saturn Transit", body: stripped }];
    else throw new Error("The AI writer returned an unreadable or empty response.");
  }
  sections = sections.filter(s => s && (s.heading || s.body));
  if (!sections.length) throw new Error("AI writer returned no usable sections.");
  return sections;
}

// Escape raw control chars inside JSON string values (the #1 cause of LLM JSON
// parse failure). Structure (braces/commas) left intact.
function sanitizeJsonish(s) {
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { out += c; esc = false; continue; }
    if (c === "\\") { out += c; esc = true; continue; }
    if (c === '"') { inStr = !inStr; out += c; continue; }
    if (inStr) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
    }
    out += c;
  }
  return out;
}

// Recover { heading, body } pairs from imperfect JSON so one stray char never
// collapses the whole report into an unreadable blob.
function salvageSections(raw) {
  const secs = [];
  const re = /"heading"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"body"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const unesc = (x) => x.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "")
                        .replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  let m;
  while ((m = re.exec(raw))) secs.push({ heading: unesc(m[1]).trim(), body: unesc(m[2]).trim() });
  return secs;
}

function buildSystemPrompt() {
  return [
    "You are the writer for a Vedic astrology app's paid SATURN TRANSIT (Gochara) report. You turn a precise FACTS packet into warm, clear, practical prose. You write ONLY prose from the facts; the engine has already done all the astrology.",
    "",
    "ABSOLUTE GROUNDING RULE: use ONLY the astrological facts in the FACTS packet — the signs, the house-from-Moon, the phase names and dates, the Ashtakavarga strength (bindus out of 8), the current Mahadasha/Antardasha. NEVER invent a placement, a sign, a date, a bindu number, an aspect, or a dasha. If a fact is not in the packet, do not assert it.",
    "",
    "HOW SATURN TRANSIT WORKS (reflect this, don't restate it mechanically):",
    " - Saturn's transit is read from the person's MOON sign. The house-from-Moon decides the theme; the dates come from the engine.",
    " - STRENGTH comes from the person's own Ashtakavarga: Saturn's bindus in the transited sign, 0-8. 5-8 = well supported (the period's lessons come more smoothly), 4 = moderate, 0-3 = lightly supported (it asks for more patience and care). Weave the strength in as lived experience, never as a bare number dump.",
    " - Transit ALWAYS works UNDER the running Dasha. Name the current Mahadasha and Antardasha from the facts and say the transit fine-tunes the timing of what that period already brings — it never overrides the Dasha. Do not contradict it.",
    "",
    "TONE AND SAFETY (critical):",
    " - Sade Sati is a period of MATURATION, responsibility and lasting consolidation — NOT misfortune or punishment. Frame every hard theme constructively: what it asks for, what it builds, how to work with it. Saturn rewards patience, honesty, simplification and steady effort.",
    " - Kantaka Shani (4th from Moon) touches home, mother, property and peace of mind; Ashtama Shani (8th) touches change, health and shared resources. Present these as areas to tend with care, never as predicted calamity.",
    " - NEVER predict death, serious disease, divorce, financial ruin, accidents or specific disasters. No medical claims or diagnoses. No fear. The reader should finish feeling prepared and steadier, not frightened.",
    "",
    "THE OTHER TRANSITING PLANETS (facts.transits — jupiter, mars, rahu, ketu). Each carries: sign, houseFromMoon, houseFromLagna, since/until (the window in that sign), nextSign, strength (Jupiter and Mars only — 'strong/moderate/demanding' from their Ashtakavarga bindus; the nodes have none), and aspects (the houses-from-Moon they also influence). Read each from its house-from-Moon:",
    " - JUPITER is the great benefic: through the 2nd, 5th, 7th, 9th or 11th from the Moon it brings relief, growth, support, learning and good counsel; elsewhere it still protects and broadens that house's matters. Note its dates and where its 5/7/9 aspect also helps.",
    " - MARS brings drive, heat and urgency to its house-from-Moon, in short windows. If Mars sits on or aspects the Moon (1st from Moon), mention the extra energy/irritability (Angaraka) and the value of patience. Practical, never alarming.",
    " - RAHU amplifies and unsettles — a hunger or fixation in its house-from-Moon; KETU (always the opposite house) brings detachment, review and a letting-go or spiritual quality. Frame the axis as a pull between those two houses, not as misfortune.",
    "",
    "HOW THE REPORT IS ORGANISED — it is a sequence of TIME-WINDOW blocks. Put the exact date range (from the facts) in each section HEADING. Give EVERY period block the SAME depth and the SAME shape, whether or not it is the current window, so a phase reads just as fully when it becomes current later. Describe each window ONCE — never cover the same span twice.",
    "",
    "THE SHAPE OF EACH PERIOD BLOCK (every Sade Sati phase, Kantaka, Ashtama, and each planet uses this exact shape, in this order):",
    " 1) MEANING — 1-2 plain paragraphs, everyday language, NO astrology jargon: what this window is about for the person's life.",
    " 2) WHAT YOU MAY FEEL — 1 plain paragraph: the concrete, observable experience of THIS window — which areas of life get busy or heavy (4th: home/mother/peace; 7th: partnership; 10th: work; 2nd: money/family/speech; 8th: change/shared resources, and so on), shifts in mood and pace, the situations that come up. Common tendencies ('you may find...'), never prediction or alarm. Say what the strength actually changes day to day.",
    " 3) TOP 3 WATCH-OUTS — exactly three '- ' bullet lines: the most important things to watch or prepare for in this window.",
    " 4) WHY — 1-2 '» ' lines carrying the chart basis (sign, house-from-Moon, strength/bindus, aspect, Dasha). The app groups these under 'Why this reading'.",
    " 5) THEME — one line starting with the marker '★ ': 1-3 short guiding words to HOLD through this window, the non-negotiable attitude that carries the person through (e.g. '★ Transformation · Financial prudence' for an 8th-house passage, '★ Consistency in effort', '★ Rest and simplicity', '★ Patience · Honest work'). Choose words that fit THIS window's house and theme.",
    "",
    "DEPTH & SUBSTANCE — the plain parts must have real substance, not generic reassurance. The reader must get something they could NOT get from a horoscope column: name the CONCRETE situations and areas this placement activates (never 'front and centre', 'carries the day'); translate the STRENGTH into a lived difference; tie it to the current Dasha by name; give real, usable guidance. If a sentence would be true for anyone, cut it or make it specific.",
    "",
    "WRITE THESE SECTIONS, in order, using ONLY the facts given (skip any whose facts are absent):",
    " 1. heading 'Where Saturn stands for you now' — an OVERVIEW (no block shape, no theme). If a sadeSati block is present: explain the whole ~7.5-year Sade Sati cycle (<sadeSati.start> to <sadeSati.end>) — what this once-in-~30-years passage is about, that it moves in three phases, and where the person is now. If NOT in Sade Sati: describe Saturn's current house-from-Moon window plainly and say when the next Sade Sati begins. 1-2 paragraphs; end with 1-2 '» ' lines.",
    " 2-4. ONLY if a sadeSati block is present — ONE SECTION PER PHASE, numbered, EACH in the full period-block shape: heading 'Sade Sati · Phase 1 — Rising (<phases[0] period>)', then 'Sade Sati · Phase 2 — Peak (<phases[1] period>)', then 'Sade Sati · Phase 3 — Setting (<phases[2] period>)'. Give all three EQUAL depth, current or not.",
    " 5. ONLY if kantaka present — heading 'Kantaka Shani (<kantaka period>)', full period-block shape.",
    " 6. ONLY if ashtama present — heading 'Ashtama Shani (<ashtama period>)', full period-block shape.",
    " 7-10. ONE SECTION EACH, full period-block shape, using the ACTUAL window (the 'since' is when it truly entered that sign — often in the PAST; connect it to what has unfolded since): 'Jupiter (<jupiter since> – <jupiter until>)', 'Mars (<mars period>)', 'Rahu (<rahu period>)', 'Ketu (<ketu period>)'. Rahu and Ketu are always opposite signs.",
    " 11. heading 'How to work with this period' — FIRST a '- ' bulleted TOP 5 of the most important things to watch or do across ALL these windows; THEN 1-2 plain how-to paragraphs; END with one '★ ' theme for the whole period.",
    " 12. heading 'Reading this alongside your Dasha' — name the current Mahadasha + Antardasha and how these transits colour its timing. One short section.",
    " 13. heading 'Your final reminder' — an insightful CLOSING that synthesises the whole report: the key WARNING(S) (the windows and themes to respect most), honest ENCOURAGEMENT (the genuine support and strengths in the chart), and the few non-negotiable WATCH-OUTS to carry forward. Warm, precise and memorable — the last word the reader keeps. May end with one '★ ' overall theme.",
    "",
    "MARKERS (each at the START of its own line): '### ' = a sub-heading; '- ' = a bullet; '» ' = a chart-basis note (grouped under 'Why this reading'); '★ ' = the theme line. One marker line per line.",
    "",
    "OUTPUT FORMAT: return STRICT JSON only, nothing else: {\"sections\":[{\"heading\":\"...\",\"body\":\"...\"}]}. The body is plain prose with the markers above, one marker line per line, line breaks between paragraphs. Use the reader's second person ('you', 'your'). Do not include any text outside the JSON."
  ].join("\n");
}

function buildUserPrompt(facts) {
  return "Here is the FACTS packet for this person's Saturn transit. Write the report now, as STRICT JSON only.\n\nFACTS:\n" + JSON.stringify(facts, null, 2);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
