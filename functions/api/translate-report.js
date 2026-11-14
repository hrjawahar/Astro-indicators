// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/translate-report.js
//  Translates a finished English report into an Indian language using the
//  Anthropic API, IN CONTEXT. Replaces manual Google Translate, which mangles
//  astrology idiom — e.g. "your current period" → a word for menstruation in
//  Tamil, "Mercury" → the car brand. Claude reads whole sentences, so it renders
//  the astrological meaning correctly and uses the owner's preferred planet/sign
//  terms (passed as a glossary).
//
//  Input : { sections: [ {heading, body}, ... ], lang: "TA"|"TE"|"HI"|"KA"|"ML" }
//  Output: { success, sections: [ {heading, body}, ... ] }   (same order/length)
//
//  SETUP (Cloudflare → Settings → Environment variables):
//    ANTHROPIC_API_KEY = your Anthropic API key
//
//  Preserves the report's inline markers exactly ("### ", "- ", "» ", "★ ",
//  "**bold**") and leaves structural tokens (D1, D9, D10, Darakaraka, numbers,
//  years, degrees) untranslated. Streams a heartbeat so Cloudflare never 524s.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";

const LANG_NAME = { TA: "Tamil", TE: "Telugu", HI: "Hindi", KA: "Kannada", ML: "Malayalam" };

// Planet + sign glossaries anchor the owner's preferred native terms (e.g. Tamil
// Jupiter = குரு not வியாழன், Venus = சுக்கிரன் not வெள்ளி). Tamil is complete;
// add the other languages here to enable them in the UI.
const GLOSSARY = {
  TA: {
    planets: "Sun=சூரியன், Moon=சந்திரன், Mars=செவ்வாய், Mercury=புதன், Jupiter=குரு, Venus=சுக்கிரன், Saturn=சனி, Rahu=ராகு, Ketu=கேது",
    signs: "Aries=மேஷம், Taurus=ரிஷபம், Gemini=மிதுனம், Cancer=கடகம், Leo=சிம்மம், Virgo=கன்னி, Libra=துலாம், Scorpio=விருச்சிகம், Sagittarius=தனுசு, Capricorn=மகரம், Aquarius=கும்பம், Pisces=மீனம்",
    // Preferred renderings for words that otherwise come out vague or wrong in Tamil.
    terms: [
      "“house” / “bhava” (an astrological house) → ALWAYS வீடு. NEVER பாவம் or பாவத்தில் — பாவம் means SIN in Tamil and completely changes the meaning. e.g. “the energy in this house” → இந்த வீட்டில் உள்ள சக்தி.",
      "“chart” → வரைபடம். CRITICAL: D1, D9, D10 are DIVISIONAL charts of the SAME person's one horoscope — NOT separate people's horoscopes. So “birth chart (D1)” → பிறப்பு வரைபடம், “navamsa (D9)” → நவாம்ச வரைபடம், and “two/three charts agree” / “both charts” → இரண்டு/மூன்று வரைபடங்களும் (or name them: D1, D9). NEVER use the plural ஜாதகங்கள் for D1/D9/D10 — it reads as several DIFFERENT people's horoscopes, which is wrong. Never transliterate as சார்ட். Use ஜாதகம் only for the one whole horoscope spoken of in the singular.",
      "“turbulent” / “turbulence” / “stormy” / “upheaval” → ஏற்ற இறக்கமான, or கலக்கமான, or சவாலான as fits the sense. NEVER கொந்தளிப்பு / கொந்தளிப்பான (too harsh — it means churning/roiling water).",
      "“partnership” / “a partnership” (the marriage or romantic bond) → கூட்டாண்மை, or உறவு when it means the relationship. NEVER கூட்டுறவு (that reads as a cooperative society/bank).",
      "“signal” / “sign” / “indicator” (an astrological indication) → அறிகுறி. NOT சமிக்ஞை (that is a hand-gesture/signal).",
      "“communication” (between partners) → கருத்துப் பரிமாற்றம், or தொடர்பு கொள்ளுதல். NOT தொடர்புத்திறன் (that reads as telecom connectivity).",
      "“build” / “built” (a relationship, trust, a foundation) → கட்டியெழுப்பு / உருவாக்கு / வளர்த்தெடு as fits. NOT the bare கட்டு (that means tie/bundle).",
      "“friction” (between people) → உரசல், or கருத்து வேறுபாடு. NOT உராய்வு (that is physical friction).",
      "Prefer natural, warm, everyday Tamil that an ordinary reader speaks — not literal word-for-word renderings, hyphenated coinages (e.g. avoid உணர்வு-தூண்டல்), or technical vocabulary. If a literal rendering would read awkwardly, rephrase it so the MEANING comes through clearly.",
    ].join("\n   - "),
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function buildSystemPrompt(lang) {
  const name = LANG_NAME[lang] || "the target language";
  const g = GLOSSARY[lang];
  const gloss = g
    ? `\n\nUSE EXACTLY THESE TERMS (do not substitute synonyms):\n- Planets: ${g.planets}\n- Signs: ${g.signs}`
      + (g.terms ? `\n\nWORD CHOICE — prefer these natural renderings, avoid the wrong ones:\n   - ${g.terms}` : "")
    : "";
  return `You are a professional translator localising a Vedic astrology report from English into ${name} for an Indian reader with little astrology background. Translate faithfully and naturally — warm, clear, everyday ${name}, not stiff or literal.

ABSOLUTE RULES:
1. TRANSLATE MEANING, NOT WORDS. This is ASTROLOGY. Critical context so you never mistranslate:
   - "period" / "current period" / "sub-period" means a TIME PHASE or planetary DASHA — NEVER menstruation. Use the ${name} word for a phase/stretch of time or the dasha.
   - "house" = an astrological house (bhava); "transit" = a planet moving through; "sign" = a rasi; "chart" = a horoscope (jataka); "exalted"/"debilitated"/"own sign" = planetary dignity; "lord"/"ruler" = the ruling planet of a house.
   - Translate idioms by their sense, not literally.
2. PRESERVE STRUCTURE AND MARKERS EXACTLY. Keep every line's leading marker in place and untouched — "### " (subheading), "- " (bullet), "» " (why-line), "★ " (theme) — and keep "**...**" bold spans around the same (now translated) words. Keep blank lines and line breaks as they are. Only the human-readable text changes.
3. DO NOT TRANSLATE these tokens — leave them verbatim: D1, D2, D3, D9, D10, D12, D24, D60 and any "D<number>"; "Darakaraka", "Atmakaraka" and other karaka names; all numbers, years, ages, degrees, and ordinals' digits.
4. NEVER output a stray single letter or orphan character — e.g. a lone "ஈ", "E", "A", or a leftover list label — at the start of a line or sentence. If the English has a lone letter, bullet label, or symbol you do not understand, drop it rather than transliterating it. Every line must read as natural prose.
5. Translate planet names and sign names to their standard ${name} forms.${gloss}
6. Output ONLY a JSON object of this exact shape, nothing else (no commentary, no code fences):
   { "heading": "...", "body": "..." }
   Translate the heading and the body of the one section given. If either is empty, keep it empty.`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ANTHROPIC_API_KEY) return json({ error: "AI translator not configured (ANTHROPIC_API_KEY)." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const lang = String(body.lang || "").toUpperCase();
  const sections = Array.isArray(body.sections) ? body.sections : null;
  if (!LANG_NAME[lang]) return json({ error: "Unsupported language." }, 400);
  if (!sections || !sections.length) return json({ error: "No sections to translate." }, 400);

  // Only heading + body cross the wire; the client merges the translation back into
  // the original sections by index (preserving any structural flags like _divider).
  const slim = sections.map((s) => ({ heading: String(s.heading || ""), body: String(s.body || "") }));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const beat = () => { try { controller.enqueue(enc.encode(" ")); } catch (_) {} };
      beat();
      let alive = true;
      const pulse = (async () => {
        while (alive) { await new Promise((r) => setTimeout(r, 4000)); if (alive) beat(); }
      })();
      let payload;
      try {
        const translated = await translateSections(env, lang, slim, beat);
        payload = { success: true, sections: translated };
      } catch (e) {
        payload = { error: e.message || "Translation failed." };
      }
      alive = false;
      try { controller.enqueue(enc.encode("\n\u0000__RESULT__" + JSON.stringify(payload))); } catch (_) {}
      controller.close();
      try { await pulse; } catch (_) {}
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

// Translate section-by-section with bounded concurrency. One long single call was
// exceeding ~3 min and getting cut; many small parallel calls finish in well under a
// minute. A section that fails to translate falls back to its English text, so a single
// hiccup never fails the whole report.
async function translateSections(env, lang, slim, onProgress) {
  const sys = buildSystemPrompt(lang);
  const CONCURRENCY = 6;
  const out = new Array(slim.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= slim.length) return;
      out[i] = await translateOne(env, sys, slim[i]);
      if (onProgress) { try { onProgress(); } catch (_) {} }
    }
  }
  const n = Math.min(CONCURRENCY, slim.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function translateOne(env, sys, section) {
  // Nothing to translate (e.g. a divider with an empty body) — skip the call.
  if (!String(section.heading || "").trim() && !String(section.body || "").trim()) return { heading: section.heading, body: section.body };
  const user = "Translate this ONE section. Return only the JSON object { \"heading\": \"...\", \"body\": \"...\" }.\n\n" + JSON.stringify({ heading: section.heading, body: section.body });

  // Token budget scales with input size. Indian-language output runs several times more
  // tokens per character than the English source, so a fixed 4000-token cap used to
  // TRUNCATE our longest section (Timing) — the cut-off JSON failed to parse and the whole
  // section silently fell back to English (the "page 10 stays English" bug). We size the
  // budget to the input and give plenty of headroom, then RETRY once (larger) on any
  // failure before giving up to English.
  const inChars = String(section.heading || "").length + String(section.body || "").length;
  const baseBudget = Math.min(16000, Math.max(6000, inChars * 3 + 2000));

  async function attempt(maxTok) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTok, system: sys, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error("API " + res.status);
    const data = await res.json();
    const stop = data && data.stop_reason;
    let text = (data && data.content && data.content[0] && data.content[0].text || "").trim();
    if (!text) throw new Error("empty");
    // A hit on the token ceiling means the JSON is cut off — treat as failure so we retry
    // bigger rather than emit a broken/partial section.
    if (stop === "max_tokens") throw new Error("truncated");
    text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const first = text.indexOf("{"), last = text.lastIndexOf("}");
    const block = (first !== -1 && last > first) ? text.slice(first, last + 1) : text;
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) { try { parsed = JSON.parse(block); } catch (__) {} }
    if (!parsed) throw new Error("parse");
    return { heading: String(parsed.heading != null ? parsed.heading : section.heading), body: String(parsed.body != null ? parsed.body : section.body) };
  }

  try {
    return await attempt(baseBudget);
  } catch (_) {
    try { return await attempt(Math.min(16000, Math.ceil(baseBudget * 1.5))); }  // one retry, larger
    catch (__) { return { heading: section.heading, body: section.body }; }        // last resort: English for this section
  }
}
