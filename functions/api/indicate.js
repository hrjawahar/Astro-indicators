// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/indicate.js
//  Cloudflare Pages Function — proxies Anthropic API for chart indications.
//  Streams the response back to the browser.
//
//  SECURITY — FIXED, SERVER-BUILT PROMPTS:
//  This endpoint used to accept a raw `prompt` string from the browser and send
//  it straight to Anthropic. That made it an open, uncapped proxy: anyone who
//  found the URL could run arbitrary completions on your API key/bill.
//
//  It now accepts ONLY a fixed set of `kind`s and BUILDS the prompt here, from
//  validated structured data. The browser can no longer inject arbitrary
//  instructions — at most it can request an astrology indication for a valid
//  chart, or a translation of bounded text into a supported language.
//
//    kind:"md"        → Mahadasha season overview.
//                       { lagna, mdLord, chart:{ houses, planets } }
//    kind:"ad"        → Antardasha indication.
//                       { lagna, mdLord, adLord, chart:{ houses, planets } }
//    kind:"translate" → Translate report text into a supported language.
//                       { targetLang, format:"block"|"headingBody", text|heading+body }
//
//  SETUP REQUIRED (one-time):
//  In Cloudflare Pages → Settings → Environment variables → add:
//    ANTHROPIC_API_KEY = sk-ant-...your key...
// ─────────────────────────────────────────────────────────────────────────────

// ── Reference tables (mirrors of the frontend engine in app.js) ──────────────
const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const PLANET_LIST = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];

const SIGN_LORD = {
  Aries:"Mars", Taurus:"Venus", Gemini:"Mercury", Cancer:"Moon",
  Leo:"Sun", Virgo:"Mercury", Libra:"Venus", Scorpio:"Mars",
  Sagittarius:"Jupiter", Capricorn:"Saturn", Aquarius:"Saturn", Pisces:"Jupiter"
};

const EXALTATION   = { Sun:"Aries",Moon:"Taurus",Mars:"Capricorn",Mercury:"Virgo",Jupiter:"Cancer",Venus:"Pisces",Saturn:"Libra",Rahu:"Gemini",Ketu:"Sagittarius" };
const DEBILITATION = { Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries",Rahu:"Sagittarius",Ketu:"Gemini" };
const OWN_SIGNS    = { Sun:["Leo"],Moon:["Cancer"],Mars:["Aries","Scorpio"],Mercury:["Gemini","Virgo"],Jupiter:["Sagittarius","Pisces"],Venus:["Taurus","Libra"],Saturn:["Capricorn","Aquarius"],Rahu:[],Ketu:[] };

const FUNCTIONAL_STATUS_MAP = {
  Aries:      {Sun:"N",Moon:"B",Mars:"Y",Mercury:"N",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
  Taurus:     {Sun:"M",Moon:"N",Mars:"M",Mercury:"N",Jupiter:"N",Venus:"B",Saturn:"Y",Rahu:"N",Ketu:"N"},
  Gemini:     {Sun:"M",Moon:"M",Mars:"M",Mercury:"Y",Jupiter:"B",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Cancer:     {Sun:"B",Moon:"N",Mars:"Y",Mercury:"M",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
  Leo:        {Sun:"N",Moon:"M",Mars:"Y",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"M",Rahu:"N",Ketu:"N"},
  Virgo:      {Sun:"M",Moon:"M",Mars:"M",Mercury:"N",Jupiter:"B",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Libra:      {Sun:"M",Moon:"M",Mars:"M",Mercury:"B",Jupiter:"N",Venus:"N",Saturn:"Y",Rahu:"N",Ketu:"N"},
  Scorpio:    {Sun:"M",Moon:"B",Mars:"Y",Mercury:"N",Jupiter:"M",Venus:"M",Saturn:"M",Rahu:"N",Ketu:"N"},
  Sagittarius:{Sun:"N",Moon:"M",Mars:"M",Mercury:"M",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
  Capricorn:  {Sun:"M",Moon:"M",Mars:"Y",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Aquarius:   {Sun:"M",Moon:"M",Mars:"N",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Pisces:     {Sun:"M",Moon:"N",Mars:"M",Mercury:"N",Jupiter:"B",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
};

const PLANET_BODY = {
  Sun:"heart, spine, eyes, and vital force",
  Moon:"chest, lungs, blood, and mental equilibrium",
  Mars:"blood, muscles, and bone marrow",
  Mercury:"nervous system, skin, and speech organs",
  Jupiter:"liver, fat tissue, and hips",
  Venus:"reproductive system, kidneys, and throat",
  Saturn:"bones, joints, teeth, and nerves",
  Rahu:"nervous system and skin (chronic or atypical conditions)",
  Ketu:"wounds, mysterious ailments, and hidden or misdiagnosed conditions",
};

// Translation: only these languages are accepted (matches the go-live + future set).
const TRANSLATE_LANGS = {
  EN:"English", TA:"தமிழ்", TE:"తెలుగు", HI:"हिंदी", KA:"ಕನ್ನಡ", ML:"മലയാളം",
};

// Tamil technical-term glossary (mirror of ui-v4.js TA_GLOSSARY) used by the
// per-section report translation so each term gets its bracketed Tamil form.
const TA_GLOSSARY = {
  "Sun": "சூரியன்", "Moon": "சந்திரன்", "Mars": "செவ்வாய்", "Mercury": "புதன்",
  "Jupiter": "குரு", "Venus": "சுக்கிரன்", "Saturn": "சனி", "Rahu": "ராகு", "Ketu": "கேது",
  "Aries": "மேஷம்", "Taurus": "ரிஷபம்", "Gemini": "மிதுனம்", "Cancer": "கடகம்",
  "Leo": "சிம்மம்", "Virgo": "கன்னி", "Libra": "துலாம்", "Scorpio": "விருச்சிகம்",
  "Sagittarius": "தனுசு", "Capricorn": "மகரம்", "Aquarius": "கும்பம்", "Pisces": "மீனம்",
  "Mahadasha": "மகா தசை", "Antardasha": "புக்தி", "Lagna": "லக்னம்", "Navamsha": "நவாம்சம்",
  "Yogakaraka": "யோககாரகன்", "Vimshottari": "விம்ஷோத்தரி", "Raja Yoga": "ராஜ யோகம்",
  "Viparita Raja Yoga": "விபரீத ராஜ யோகம்", "Parivartana": "பரிவர்த்தனை",
  "Bhadra": "பத்ர", "Kemadruma": "கேமத்ரும", "dusthana": "துஷ்தான", "Tapas": "தபஸ்",
  "ascendant": "லக்னம்", "exalted": "உச்சம்", "debilitated": "நீசம்",
  "lordship": "அதிபத்தியம்", "lord": "அதிபதி", "retrograde": "வக்ரம்",
  "combust": "அஸ்தமனம்", "aspect": "பார்வை", "conjunction": "சேர்க்கை",
  "own sign": "சொந்த ராசி", "house": "வீடு", "dasha": "தசை", "bhukti": "புக்தி",
};
function glossaryText(langCode) {
  if (langCode !== "TA") return "";
  return Object.keys(TA_GLOSSARY).map(function (k) { return "  " + k + " = " + TA_GLOSSARY[k]; }).join("\n");
}

// ── Engine helpers (pure; identical logic to app.js) ─────────────────────────
function getDignity(planet, sign) {
  if (EXALTATION[planet] === sign)             return "ex";
  if (DEBILITATION[planet] === sign)           return "de";
  if ((OWN_SIGNS[planet] || []).includes(sign)) return "own";
  return "";
}

function buildPlanetHouseMap(houses) {
  const map = {};
  for (const [hNum, planets] of Object.entries(houses || {})) {
    for (const p of (planets || [])) map[p] = parseInt(hNum);
  }
  return map;
}

function buildCombustSet(planets) {
  const orbs = { Moon:7, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };
  const combust = new Set();
  if (!planets || !planets.Sun || planets.Sun.longitude == null) return combust;
  const sunLon = planets.Sun.longitude;
  for (const [p, orb] of Object.entries(orbs)) {
    if (!planets[p] || planets[p].longitude == null) continue;
    let diff = Math.abs(planets[p].longitude - sunLon);
    if (diff > 180) diff = 360 - diff;
    if (diff <= orb) combust.add(p);
  }
  return combust;
}

function buildWarSet(planets) {
  const warPlanets = ["Mars","Mercury","Jupiter","Venus","Saturn"];
  const losers = new Set();
  if (!planets) return losers;
  for (let i = 0; i < warPlanets.length; i++) {
    for (let j = i+1; j < warPlanets.length; j++) {
      const p1 = warPlanets[i], p2 = warPlanets[j];
      if (!planets[p1] || !planets[p2] || planets[p1].longitude == null || planets[p2].longitude == null) continue;
      let diff = Math.abs(planets[p1].longitude - planets[p2].longitude);
      if (diff > 180) diff = 360 - diff;
      if (diff <= 1.0) losers.add((planets[p1].latitude||0) < (planets[p2].latitude||0) ? p1 : p2);
    }
  }
  return losers;
}

function buildChartContext(lagnaSign, houses, planets) {
  const d1HouseMap = buildPlanetHouseMap(houses);
  const combustSet = buildCombustSet(planets);
  const warLosers  = buildWarSet(planets);
  const lagnaIdx   = SIGNS.indexOf(lagnaSign);

  const planetLines = PLANET_LIST.map(p => {
    const pl = planets[p]; if (!pl) return null;
    const h  = d1HouseMap[p] || "?";
    const dig = getDignity(p, pl.sign);
    const fs  = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[p] || "N";
    const fsLabel = fs==="Y"?"Yogakaraka":fs==="B"?"FuncBenefic":fs==="M"?"FuncMalefic":"Neutral";
    const lorded = [];
    for (let i=1;i<=12;i++) { if (SIGN_LORD[SIGNS[(lagnaIdx+i-1)%12]]===p) lorded.push(i); }
    const aspects = [];
    const base = h-1;
    if (h!=="?") {
      aspects.push(((base+6)%12)+1);
      if (p==="Mars")    [3,7].forEach(n=>aspects.push(((base+n)%12)+1));
      if (p==="Jupiter") [4,8].forEach(n=>aspects.push(((base+n)%12)+1));
      if (p==="Saturn")  [2,9].forEach(n=>aspects.push(((base+n)%12)+1));
      if (p==="Rahu"||p==="Ketu") [4,8].forEach(n=>aspects.push(((base+n)%12)+1));
    }
    const flags = [
      dig==="ex"?"Exalted":dig==="de"?"Debilitated":dig==="own"?"OwnSign":"",
      pl.retrograde?"Retrograde":"",
      combustSet.has(p)?"Combust":"",
      warLosers.has(p)?"WarLoser":"",
    ].filter(Boolean).join("|");
    return `${p}: H${h} ${pl.sign} ${pl.degree?.toFixed(1)||"?"}° D9:${pl.d9sign||"?"} LordsH[${lorded.join(",")}](${lorded.map(n=>{const s=SIGNS[(lagnaIdx+n-1)%12];return "H"+n+"="+s;}).join(",")}) AspectsH[${[...new Set(aspects)].filter(x=>x!==h).join(",")}] ${fsLabel} ${flags||"clean"}`;
  }).filter(Boolean);

  const houseLordLines = [];
  for (let h=1;h<=12;h++) {
    const sign = SIGNS[(lagnaIdx+h-1)%12];
    const lord = SIGN_LORD[sign];
    const lordH = d1HouseMap[lord] || "?";
    houseLordLines.push(`H${h}(${sign})lord=${lord}@H${lordH}`);
  }

  return "LAGNA: " + lagnaSign + "\n\nPLANETS:\n" + planetLines.join("\n") + "\n\nHOUSE_LORDS: " + houseLordLines.join("  ");
}

function buildMDPrompt(mdLord, lagnaSign, chartCtx) {
  const fs = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[mdLord]||"N";
  const fsLabel = fs==="Y"?"yogakaraka (most constructive season possible for this lagna)":fs==="B"?"functional benefic (supportive season)":fs==="M"?"functional malefic (testing, disciplining season)":"neutral (mixed season)";
  return `You are an expert Parashari Jyotishi interpreting a birth chart for the person it belongs to. Write a Mahadasha season overview they will read about their own life.

CHART DATA (read carefully — each planet line shows: house, sign, degree, D9 sign, exact houses lorded with sign names, houses aspected, functional status, dignity/flags):
${chartCtx}

MAHADASHA LORD: ${mdLord} — ${fsLabel} for ${lagnaSign} lagna

Write one flowing paragraph of 5–7 sentences in second person ("Your ${mdLord} Mahadasha is..."). The person is reading this about their own life. Cover:
1. Season character (summer/winter/mixed) with the specific reason — name the placement that determines it
2. The dominant life themes this season activates — name likely real-world events, not just house numbers (e.g. "a career change is likely through a forced departure" not "H10 is activated")
3. ${mdLord}'s house placement, dignity, lordship of specific houses, and aspect pattern — what do these mean for this person's life concretely
4. Whether D9 confirms or weakens the D1 promise — and what that means for the second half of the season
5. Any major protection (benefic aspect on ${mdLord} or its house) or amplification (malefic conjunction/aspect) that modifies the season

Critical: Use the HOUSE_LORDS line to correctly identify which houses each planet lords. Do not guess — read it from the data. No bullet points. No preamble.`;
}

function buildADPrompt(mdLord, adLord, lagnaSign, chartCtx) {
  const mdFS = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[mdLord]||"N";
  const adFS = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[adLord]||"N";
  const fsDesc = fs => fs==="Y"?"yogakaraka":fs==="B"?"functional benefic":fs==="M"?"functional malefic":"neutral";
  return `You are an expert Parashari Jyotishi interpreting a birth chart for the person it belongs to. Write an Antardasha indication they will read about their own life.

CHART DATA (each planet line: house, sign, degree, D9 sign, exact houses lorded WITH sign names, houses aspected, functional status, dignity/flags):
${chartCtx}

Mahadasha: ${mdLord} (${fsDesc(mdFS)} for ${lagnaSign} lagna)
Antardasha: ${adLord} (${fsDesc(adFS)} for ${lagnaSign} lagna)

CRITICAL RULES:
- Read lordship ONLY from the LordsH[...] data in the chart — never infer or assume
- Name real-world events, not house activations ("forced job change" not "H10 activated")
- Write directly to the person ("your career", "you may face", "this period brings you")
- Only include a domain section if ${adLord} has a MEANINGFUL classical connection to it (2+ factors)
- If a domain has no meaningful activation, skip it entirely — do not write "No significant activation"

Write using ONLY the sections that are actually activated by this chart. Choose from:

**PERIOD CHARACTER** — always include. One sentence: the essential nature of this sub-period for this person — MD-AD relationship (friends/enemies/neutral), both functional statuses, and what ${adLord}'s house placement means for their life right now.

**CAREER & PROFESSION** — include only if ${adLord} lords H10, H7, aspects H10, or sits in H6/H8 creating disruption. Name the specific career event tendency.

**HEALTH & BODY** — always include. Name ${adLord}'s body areas (${PLANET_BODY[adLord]||"its ruled areas"}). If malefic in H6/H8 or lords H1/H6/H8 — state the specific health risk. State any protection.

**RELATIONSHIPS & MARRIAGE** — include only if ${adLord} lords H7, sits in H7, Venus is involved, or H2/H12 create a meaningful relationship pattern. Name the specific event tendency (marriage window, separation pressure, partnership conflict, etc.).

**FINANCES & WEALTH** — include only if ${adLord} lords H2, H11, H9 (gains) or H12 (losses). State the specific financial tendency.

**PROPERTY & HOME** — include only if ${adLord} lords H4, sits in H4, or Moon/Mars create a meaningful H4 pattern. State whether property purchase, relocation, or home disruption is indicated.

**SPIRITUALITY & INNER GROWTH** — include only if ${adLord} lords H12, H9, sits in H12, Ketu is involved, or the combination creates a withdrawal/retreat/pilgrimage pattern.

**FOREIGN TRAVEL & RELOCATION** — include only if H12, H9, H3 are activated by ${adLord}'s lordship, placement, or aspect in a meaningful way.

**LITIGATION & LEGAL MATTERS** — include only if H6 is directly activated through lordship or placement by ${adLord}, or Saturn/Rahu create a 6th house pattern.

**TIMING NOTE** — always include. One sentence: when conditions peak within this sub-period (beginning/middle/end) based on planetary strength and D9 condition.

Plain language. Write directly to the person. No preamble or postamble. No generic phrases.`;
}

// ── Translation prompts (fixed templates; the only variable is the text/lang) ─
// These reproduce, byte-for-byte, the instruction blocks the page used to send,
// so translated output (and the client-side parsers that read it) is unchanged.
function buildTranslateBlockPrompt(langName, text) {
  return "Translate the following Vedic astrology report into " + langName + ".\n\n" +
    "Rules:\n" +
    "- Translate all descriptive sentences and headings completely.\n" +
    "- Keep these UNTRANSLATED: planet names (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu), house labels (H1-H12, D1, D9), and technical terms (Mahadasha, Antardasha, Yogakaraka, Lagna, Navamsha, Vimshottari, Parivartana, Raja Yoga, Viparita, Bhadra, Kemadruma, dusthana, Tapas).\n" +
    "- Keep every line that starts with §§H or equals §§§ EXACTLY as-is, unchanged, in the same positions. These are structure markers.\n" +
    "- Keep any **double-asterisk** markers exactly around the same phrase.\n" +
    "- Do not add or remove sections. Do not add commentary.\n\n" +
    "REPORT:\n" + text;
}

// Per-section report translation (mirror of ui-v4.js translateSectionsIndividually).
// Output contract the page parses: heading on the first line, body after.
function buildTranslateSectionPrompt(langName, langCode, heading, body) {
  var gloss = glossaryText(langCode);
  return "Translate this section of a Vedic astrology report into " + langName + ".\n\n" +
    "STYLE: Write in FORMAL, professional, written " + langName + " — the dignified register used in a paid astrology report or a serious published article, NOT casual spoken/conversational language. " +
    "Use formal verb and sentence endings (in Tamil: என்று / ஆகும் / உள்ளது / கூறுகிறோம் — never spoken forms like னு / சொல்றோம் / இருக்கு / பண்றது / தெரியாதுன்னா / கவலைப்படாதீங்க). " +
    "Avoid slang and casual contractions, but also avoid archaic/over-literary words — aim for clear, respectful, modern formal prose. Translate completely — never stop mid-sentence, never leave English sentences untranslated. " +
    "TECHNICAL TERMS: Keep these in English, but the FIRST time each appears in this section, add its " + langName + " form in brackets right after it" +
    (gloss ? ", using exactly these forms:\n" + gloss + "\n" : ".\n") +
    "Example: \"Jupiter (குரு)\", \"Cancer (கடகம்)\", \"Antardasha (புக்தி)\", \"ascendant (லக்னம்)\", \"exalted (உச்சம்)\", \"lordship (அதிபத்தியம்)\". Keep house/chart labels (H1-H12, D1, D9) in English as-is.\n\n" +
    "DURATIONS & DATES: Translate duration words — 'years'→'வருடங்கள்', 'months'→'மாதங்கள்', 'year'→'வருடம்', 'month'→'மாதம்', and the word 'to' between dates → 'முதல் … வரை'. Keep the numbers and DD/MM/YYYY dates exactly as written.\n\n" +
    "FORMATTING:\n" +
    "- Translate the heading too (add the bracketed " + langName + " term there as well). Output the heading as PLAIN TEXT — do NOT add '#', '##', or '**' around it.\n" +
    "- Keep any **double-asterisk** markers exactly around the same phrase.\n" +
    "- Do not output literal '#' characters.\n" +
    "- Output the heading on the first line, then the body. No commentary, no notes.\n\n" +
    "HEADING: " + (heading || "") + "\n\nBODY:\n" + (body || "");
}

// ── Build the final prompt from a validated request ──────────────────────────
// Returns { prompt, maxTokens } or { error } (with an HTTP status).
function buildPrompt(body) {
  const kind = String(body.kind || "");

  if (kind === "md" || kind === "ad") {
    const lagna  = String(body.lagna || "");
    const mdLord = String(body.mdLord || "");
    if (!SIGNS.includes(lagna))        return { error: "Invalid lagna.", status: 400 };
    if (!PLANET_LIST.includes(mdLord)) return { error: "Invalid mdLord.", status: 400 };

    const chart = body.chart || {};
    if (!chart.houses || typeof chart.houses !== "object" ||
        !chart.planets || typeof chart.planets !== "object") {
      return { error: "Missing chart data." , status: 400 };
    }
    const ctx = buildChartContext(lagna, chart.houses, chart.planets);

    if (kind === "md") {
      return { prompt: buildMDPrompt(mdLord, lagna, ctx), maxTokens: clampTokens(body.max_tokens, 2000) };
    }
    const adLord = String(body.adLord || "");
    if (!PLANET_LIST.includes(adLord)) return { error: "Invalid adLord.", status: 400 };
    return { prompt: buildADPrompt(mdLord, adLord, lagna, ctx), maxTokens: clampTokens(body.max_tokens, 2000) };
  }

  if (kind === "translate") {
    const code = String(body.targetLang || "");
    const langName = TRANSLATE_LANGS[code];
    if (!langName) return { error: "Unsupported targetLang.", status: 400 };
    const format = String(body.format || "block");

    if (format === "section") {
      const heading = capText(body.heading, 1000);
      const bodyTxt = capText(body.body, 20000);
      if (!bodyTxt && !heading) return { error: "Nothing to translate.", status: 400 };
      return { prompt: buildTranslateSectionPrompt(langName, code, heading, bodyTxt), maxTokens: clampTokens(body.max_tokens, 4000) };
    }
    // default: block
    const text = capText(body.text, 40000);
    if (!text) return { error: "Nothing to translate.", status: 400 };
    return { prompt: buildTranslateBlockPrompt(langName, text), maxTokens: clampTokens(body.max_tokens, 8000) };
  }

  return { error: "Unknown kind.", status: 400 };
}

function capText(v, max) {
  if (typeof v !== "string") return "";
  return v.length > max ? v.slice(0, max) : v;
}
function clampTokens(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.round(n), 8000);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonErr("ANTHROPIC_API_KEY not configured in Cloudflare environment variables.", 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid request body.", 400);
  }

  const built = buildPrompt(body);
  if (built.error) return jsonErr(built.error, built.status || 400);

  // Call Anthropic with streaming
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      "x-api-key":            apiKey,
      "anthropic-version":    "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-5",
      max_tokens: built.maxTokens,
      stream:     true,
      messages:   [{ role: "user", content: built.prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    return jsonErr(`Anthropic API error ${anthropicRes.status}: ${errText.slice(0, 200)}`, anthropicRes.status);
  }

  // Stream the response body directly back to the browser
  return new Response(anthropicRes.body, {
    status: 200,
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { "Content-Type": "application/json" },
  });
}
