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
    "WRITE THESE SECTIONS, in this order, using only sections the facts support:",
    " 1. 'Where Saturn stands for you now' — the current sign, house-from-Moon and what it means in daily life, the dates, and the strength (in plain words). 2-4 short paragraphs.",
    " 2. 'What you may notice and feel' — the heart of the report's value. Describe the CONCRETE, observable changes a person in THIS exact transit (this house-from-Moon, at this strength, under this Dasha) tends to feel, notice and experience: shifts in mood and energy, which life areas get busy or heavy (the ones that house governs — e.g. 4th: home/mother/inner peace; 7th: partnership; 10th: work/responsibility; 2nd: money/family/speech), the kinds of situations that come up, and how the pace feels. Ground every point in the facts (house, strength, dasha); frame as tendencies people commonly experience ('you may find…', 'many notice…'), never as guarantees or predictions of specific events, and never alarming. Where the strength is low, say the themes land more firmly; where high, more smoothly. Tie it to the current flow by noting how the running Dasha shapes what is felt.",
    " 3. 'Saturn's road ahead' — the upcoming Saturn windows the facts list (Sade Sati arc and/or next Sade Sati, Kantaka, Ashtama), in the order given (soonest first), each with its dates and a sentence on what it brings. Do not reorder or invent windows.",
    " 4. 'Your Sade Sati, phase by phase' — ONLY if the facts include a sadeSati block. Cover the three phases (rising/peak/setting) with their signs, dates, per-phase strength, and what each phase asks for.",
    " 5. 'Jupiter this year' — ONLY if facts.transits.jupiter is present. Jupiter's current sign and house-from-Moon, what it supports, its strength and its dates, and where its 5/7/9 aspect also helps. Warm and specific.",
    " 6. 'Mars, Rahu and Ketu' — ONLY if those facts are present. A short, practical paragraph each: Mars's current push and its short window; and the Rahu-Ketu axis as a pull between its two houses-from-Moon. Include the dates given.",
    " 7. 'How to work with this period' — concrete, practical guidance that draws the threads together (Saturn's discipline balanced by Jupiter's support, Mars's timing, the nodal pull): what to lean into, what to go gently with, simple habits that help. Make this genuinely useful.",
    " 8. 'Reading this alongside your Dasha' — name the current Mahadasha + Antardasha and explain, in one short section, how these transits colour the timing of that period without overriding it.",
    "",
    "READABILITY — CRITICAL (this report is read by people with NO astrology knowledge):",
    " - In every section, LEAD with the PLAIN meaning in everyday language — what it means for the person's life and what to do — with NO astrology jargon in those sentences. A reader who knows nothing about astrology must understand them completely.",
    " - Put the astrological / chart BASIS (signs, houses-from-Moon, bindus/strength, aspects, Dasha names, Sanskrit terms) on SEPARATE short lines, each starting with the exact marker '» ', placed right AFTER the plain sentence it supports. Keep each '» ' note to one brief line — it is the 'why', for the curious.",
    " - NEVER mix signs, house numbers, bindus or Sanskrit terms into the plain paragraphs; those paragraphs must read naturally on their own. The '» ' lines carry all the technical detail.",
    " - Example of the two-line rhythm:\n   This is a steadying stretch for your home life — a time to tend your base and keep routines simple rather than make big moves.\n   » Saturn transits the 4th from your Moon (Kantaka Shani), at 3 of 8 Ashtakavarga strength.",
    "",
    "OUTPUT FORMAT: return STRICT JSON and nothing else: {\"sections\":[{\"heading\":\"...\",\"body\":\"...\"}]}. The body is plain prose; use \\n between paragraphs, put each '» ' technical note on its own line, and use '- ' for any bullet lines. Keep each section tight (roughly 120-240 words). Use the reader's second person ('you', 'your'). Do not include any text outside the JSON."
  ].join("\n");
}

function buildUserPrompt(facts) {
  return "Here is the FACTS packet for this person's Saturn transit. Write the report now, as STRICT JSON only.\n\nFACTS:\n" + JSON.stringify(facts, null, 2);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
