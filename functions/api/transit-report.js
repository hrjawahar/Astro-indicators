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

  // Stream a heartbeat while the (long) report generates, then send the final
  // JSON after a "\n\u0000__RESULT__" marker. Returning the streaming Response
  // immediately means Cloudflare sees response headers at once and never 524s.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(" ")); // first byte right away
      const beat = () => { try { controller.enqueue(enc.encode(" ")); } catch (_) {} };
      let payload;
      try {
        const sections = await writeTransitReport(env, facts, beat);
        payload = { success: true, sections };
      } catch (e) {
        payload = { error: e.message || "AI writer failure." };
      }
      try { controller.enqueue(enc.encode("\n\u0000__RESULT__" + JSON.stringify(payload))); } catch (_) {}
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

async function writeTransitReport(env, facts, onProgress) {
  const sys = buildSystemPrompt();
  const user = buildUserPrompt(facts);

  // STREAM the completion. A full transit report takes ~2 minutes, which blows
  // past Cloudflare's hard 100s edge limit (524) on a single blocking request.
  // Streaming makes the Anthropic call return bytes continuously; onProgress()
  // lets the caller forward a heartbeat to the client so the connection stays open.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 12000,
      stream: true,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Anthropic API error " + res.status + ": " + t.slice(0, 300));
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let sseBuf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = sseBuf.indexOf("\n")) >= 0) {
      const line = sseBuf.slice(0, nl); sseBuf = sseBuf.slice(nl + 1);
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            const ev = JSON.parse(payload);
            if (ev.type === "content_block_delta" && ev.delta && ev.delta.text) text += ev.delta.text;
            else if (ev.type === "error") throw new Error("Anthropic stream error: " + (ev.error && ev.error.message || "unknown"));
          } catch (err) { if (/stream error/.test(err.message)) throw err; }
        }
      }
    }
    if (onProgress) { try { onProgress(); } catch (_) {} }
  }
  text = text.trim();
  if (!text) throw new Error("The AI writer returned an empty response.");

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
    "THE OTHER TRANSITING PLANETS. facts.transits.jupiter, .rahu and .ketu each carry: sign, houseFromMoon, houseFromLagna, since/until (the ~one-passage window), nextSign, strength (Jupiter only; the nodes have none) and aspects (the houses-from-Moon they also influence). facts.transits.mars is DIFFERENT — it is { sequence: [...] }, an array of the current sign PLUS the next four Mars sign-transits (each with sign, houseFromMoon, start/end, isCurrent, strength, aspects), because Mars moves only ~45 days per sign.",
    " - JUPITER is the great benefic, and classically its ASPECT is MORE powerful than the sign it sits in. So LEAD with where Jupiter's 5th / 7th / 9th aspects fall — facts.transits.jupiter.aspects lists those houses-from-Moon — because those three houses receive Jupiter's grace, protection and expansion for the whole ~12-month passage, and THAT is the headline. THEN cover the house it occupies. Through the 2nd/5th/7th/9th/11th from the Moon it brings relief, growth, support and good counsel; elsewhere it still broadens that house's matters.",
    " - MARS brings drive, heat and urgency to its house-from-Moon, in short ~45-day windows, and can retrograde (a sign then repeats in the sequence — say so plainly). If Mars sits on or aspects the Moon (1st from Moon), mention the extra energy/irritability (Angaraka) and the value of patience. Practical, never alarming.",
    " - RAHU amplifies and unsettles — a hunger or fixation in its house-from-Moon; KETU (always the opposite house) brings detachment, review and a letting-go or spiritual quality. Frame the axis as a pull between those two houses, not as misfortune.",
    "",
    "HOW THE REPORT IS ORGANISED — it is a sequence of TIME-WINDOW blocks. Put the exact date range (from the facts) in each section HEADING. Give EVERY period block the SAME depth and the SAME shape, whether or not it is the current window, so a phase reads just as fully when it becomes current later. Describe each window ONCE — never cover the same span twice.",
    "",
    "THE SHAPE OF EACH PERIOD BLOCK (the current Saturn window, every Sade Sati phase, Kantaka, Ashtama, and each planet all use this exact shape, in this order):",
    " 1) MEANING — 1-2 plain paragraphs, everyday language, NO astrology jargon: what this window is about for the person's life.",
    " 2) WHAT YOU MAY FEEL — 1 plain paragraph: the concrete, observable experience of THIS window — which areas of life get busy or heavy (house-from-Moon: 2nd money/family/speech; 3rd courage/effort/siblings; 4th home/mother/peace; 7th partnership; 8th change/shared resources/health; 10th work/status, and so on), shifts in mood and pace, the situations that come up. Common tendencies ('you may find...'), never prediction or alarm. Say what the strength actually changes day to day.",
    " 3) TOP 3 WATCH-OUTS — exactly three '- ' bullet lines: the most important things to watch or prepare for in this window.",
    " 4) WHY — 1-2 '» ' lines carrying the chart basis: Saturn's sign and house-from-Moon, the Ashtakavarga strength (bindus out of 8), the running Dasha, AND the houses that Saturn's 3rd/7th/10th aspects also touch. EVERY Saturn period carries its own 'aspects' list (sign + houseFromMoon) — name those aspected houses, because the reading weighs house occupancy AND aspect together, never the bindus alone. The app groups these lines under 'Why this reading'.",
    " 5) THEME — one line starting with the marker '★ ': 1-3 short guiding words to HOLD through this window, the non-negotiable attitude that carries the person through (e.g. '★ Transformation · Financial prudence' for an 8th-house passage, '★ Consistency in effort', '★ Rest and simplicity', '★ Patience · Honest work'). Choose words that fit THIS window's house and theme.",
    "",
    "HEALTH NOTE (include ONLY where the chart genuinely flags it, and ONLY for the malefic transits — Saturn, Mars, Rahu, Ketu — NEVER Jupiter). Classical astrology links each transiting sign to a body area. Add ONE gentle '- ' watch-out line naming that area ONLY when the transit is also demanding or vulnerable — that is, its Ashtakavarga strength is 'demanding' (bindu <= 3), OR its house-from-Moon or house-from-Lagna is the 6th, 8th or 12th. Frame it strictly as ordinary preventive self-care ('a good window to look after your knees and joints — keep up rest and warm-ups'), NEVER as a diagnosis, a prediction of illness, or anything alarming, and keep it to one line. If none of those conditions hold, write NO health line for that period. Body areas by sign: Aries = head; Taurus = face, throat, neck; Gemini = shoulders, arms, lungs; Cancer = chest, stomach, digestion; Leo = heart, upper back, spine; Virgo = gut and digestion; Libra = lower back, kidneys; Scorpio = pelvic and eliminatory system; Sagittarius = hips, thighs, liver; Capricorn = knees, joints, bones; Aquarius = calves, ankles, circulation; Pisces = feet.",
    "DEPTH & SUBSTANCE — the plain parts must have real substance, not generic reassurance. The reader must get something they could NOT get from a horoscope column: name the CONCRETE situations this placement brings up (never vague fillers like 'front and centre', 'carries the day', or 'stirs/activates this area' — say what actually tends to happen: an opportunity, a demand, a change, recognition, a decision); translate the STRENGTH into a lived difference; tie it to the current Dasha by name; give real, usable guidance. If a sentence would be true for anyone, cut it or make it specific.",
    "",
    "WRITE THESE SECTIONS IN THIS EXACT ORDER (skip any whose facts are absent). The three Saturn sensitive periods MUST appear in the order given by facts.saturnOrder — earliest first — so the report reads the way the native actually lives it, year by year, NOT grouped by planet type:",
    " A. heading 'Where Saturn stands for you now' — the CURRENT Saturn window as a full period-block (meaning, what you may feel, top 3, why, theme), from facts.current. Open by stating plainly: Saturn is in <current.sign>, the <current.houseFromMoon>th house from your Moon, from <current.since> to <current.until> (around age <current.ageStart>–<current.ageEnd>). This is the present; everything below is the road ahead, in the order it will arrive.",
    " B. THEN, for EACH entry in facts.saturnOrder, in that exact order, write its block(s). HORIZON RULE: each period carries a 'horizon' — 'near' (within ~12 years) or 'far' (decades away). Give 'near' periods the FULL depth below. For a 'far' period, write a SHORT block only (one tight paragraph of meaning + what to expect, 1 '» ' line, 1 '★ ' theme — no 'what you may feel', no top-3), and open it by noting it is still years away and will be detailed in full as it approaches (the report regenerates each time). This keeps the report focused on what is close at hand.",
    "    • 'kantaka'  → heading 'Kantaka Shani — Saturn in your 4th (<kantaka.start> – <kantaka.end>, around age <kantaka.ageStart>–<kantaka.ageEnd>)'. Full block if near; short block if far.",
    "    • 'ashtama'  → heading 'Ashtama Shani — Saturn in your 8th (<ashtama.start> – <ashtama.end>, around age <ashtama.ageStart>–<ashtama.ageEnd>)'. Full block if near; short block if far.",
    "    • 'sadeSati' → ALWAYS write the OVERVIEW section first, headed 'Your Sade Sati — the 7½-year passage (<sadeSati.start> – <sadeSati.end>, around age <sadeSati.ageStart>–<sadeSati.ageEnd>)': a BLUEPRINT of the whole journey — what this once-in-~30-years passage is, then the three phases named with their windows and ages in sequence, and what the arc builds overall (1-2 paragraphs, end with 1-2 '» ' lines; NO theme on the overview). THEN: if sadeSati.horizon is 'near', write one full period-block PER PHASE, numbered and EQUAL in depth: 'Sade Sati · Phase 1 — Rising (<phases[0].start> – <phases[0].end>, age <phases[0].ageStart>–<phases[0].ageEnd>)', then 'Sade Sati · Phase 2 — Peak (<phases[1] window/age>)', then 'Sade Sati · Phase 3 — Setting (<phases[2] window/age>)'. If sadeSati.horizon is 'far', STOP after the overview — do NOT write the three phase blocks (they will be written in full when the passage draws near); the overview alone, which lists the phase windows, is enough for a passage decades away.",
    "    (If the native is CURRENTLY in Sade Sati, section A is itself the current phase — still give the Sade Sati overview here as the blueprint, then all three phases, marking which one is current.)",
    " C. THEN the other transiting planets (keep these tighter than the Saturn blocks — Saturn is the heart of the report; the 'since' is often in the PAST, so connect it to what has already unfolded):",
    "    • 'Jupiter (<jupiter.since> – <jupiter.until>)' — a full period-block, but LEAD with its ASPECTS: name the 5th/7th/9th houses-from-Moon it blesses (facts.transits.jupiter.aspects) and what grace/growth they receive across this ~12-month passage — that is the main event. THEN, more briefly, the house it sits in. Why-line + theme as usual.",
    "    • 'Rahu (<rahu.since> – <rahu.until>)' then 'Ketu (<ketu.since> – <ketu.until>)' — one full period-block each (~18-month windows). Always opposite signs; frame as the pull between those two houses. Why-line + theme each.",
    "    • 'Mars — the months ahead' — Mars is fast, so DON'T write a deep block. Give one short intro sentence, then a compact '- ' bulleted TIMELINE, one bullet per entry in facts.transits.mars.sequence: '<sign>, <houseFromMoon>th from your Moon (<start> – <end>) — <one short clause on the flavour>'. Mark the current one ('now'). CRUCIAL: Mars normally spends only ~45 days in a sign, so if any entry has retro:true (or a window longer than ~7 weeks) it means Mars is RETROGRADE and lingering there — say so in that bullet ('Mars turns retrograde here, so it stays longer'), and if a sign repeats explain that the retrograde carries Mars back over it. A longer Mars window must never look like a mistake. Close with a single '» ' why-line and one '★ ' theme for the Mars stretch as a whole.",
    " D. heading 'How to work with this period' — FIRST a '- ' bulleted TOP 5 of the most important things to watch or do across ALL these windows; THEN 1-2 plain how-to paragraphs; END with one '★ ' theme for the whole road ahead.",
    " E. heading 'Reading this alongside your Dasha' — name the current Mahadasha + Antardasha and how these transits colour its timing; transit always works UNDER the running Dasha and fine-tunes it, never overrides it. One short section.",
    " F. heading 'Your final reminder' — a PURELY HUMAN closing: use NO planets, houses, signs, dates, bindus or any astrology term here at all. Distil everything above into plain life wisdom — the attitudes to carry, honest encouragement, and the few non-negotiable things to watch — spoken simply, one person to another. It must have real substance and be specific to the SPIRIT of this reading (not generic platitudes about life), warm, precise and memorable: the last word the reader keeps. End with one '★ ' overall theme (1-3 words).",
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
