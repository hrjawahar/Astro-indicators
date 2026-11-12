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
    : "";
  return `You are a professional translator localising a Vedic astrology report from English into ${name} for an Indian reader with little astrology background. Translate faithfully and naturally — warm, clear, everyday ${name}, not stiff or literal.

ABSOLUTE RULES:
1. TRANSLATE MEANING, NOT WORDS. This is ASTROLOGY. Critical context so you never mistranslate:
   - "period" / "current period" / "sub-period" means a TIME PHASE or planetary DASHA — NEVER menstruation. Use the ${name} word for a phase/stretch of time or the dasha.
   - "house" = an astrological house (bhava); "transit" = a planet moving through; "sign" = a rasi; "chart" = a horoscope (jataka); "exalted"/"debilitated"/"own sign" = planetary dignity; "lord"/"ruler" = the ruling planet of a house.
   - Translate idioms by their sense, not literally.
2. PRESERVE STRUCTURE AND MARKERS EXACTLY. Keep every line's leading marker in place and untouched — "### " (subheading), "- " (bullet), "» " (why-line), "★ " (theme) — and keep "**...**" bold spans around the same (now translated) words. Keep blank lines and line breaks as they are. Only the human-readable text changes.
3. DO NOT TRANSLATE these tokens — leave them verbatim: D1, D2, D3, D9, D10, D12, D24, D60 and any "D<number>"; "Darakaraka", "Atmakaraka" and other karaka names; all numbers, years, ages, degrees, and ordinals' digits.
4. Translate planet names and sign names to their standard ${name} forms.${gloss}
5. Output ONLY a JSON object of this exact shape, nothing else (no commentary, no code fences):
   { "sections": [ { "heading": "...", "body": "..." }, ... ] }
   Same number of sections, same order. Translate each heading and body. If a heading or body is empty, keep it empty.`;
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

async function translateSections(env, lang, slim, onProgress) {
  const sys = buildSystemPrompt(lang);
  const user = "Translate this report. Return only the JSON object.\n\n" + JSON.stringify({ sections: slim });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
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
        const p = line.slice(5).trim();
        if (p && p !== "[DONE]") {
          try {
            const ev = JSON.parse(p);
            if (ev.type === "content_block_delta" && ev.delta && ev.delta.text) text += ev.delta.text;
            else if (ev.type === "error") throw new Error("Anthropic stream error: " + (ev.error && ev.error.message || "unknown"));
          } catch (err) { if (/stream error/.test(err.message)) throw err; }
        }
      }
    }
    if (onProgress) { try { onProgress(); } catch (_) {} }
  }
  text = text.trim();
  if (!text) throw new Error("The translator returned an empty response.");

  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = clean.indexOf("{"), last = clean.lastIndexOf("}");
  const block = (first !== -1 && last > first) ? clean.slice(first, last + 1) : clean;
  let parsed = null;
  try { parsed = JSON.parse(clean); } catch (_) { try { parsed = JSON.parse(block); } catch (__) {} }
  const out = parsed && Array.isArray(parsed.sections) ? parsed.sections : null;
  if (!out || !out.length) throw new Error("The translation could not be parsed.");

  // Normalise to {heading, body}, and guard length: if the model dropped/added
  // sections, pad/truncate to the input length so the client merge stays aligned.
  const norm = out.map((s) => ({ heading: String(s && s.heading || ""), body: String(s && s.body || "") }));
  if (norm.length < slim.length) {
    for (let i = norm.length; i < slim.length; i++) norm.push({ heading: slim[i].heading, body: slim[i].body });
  }
  return norm.slice(0, slim.length);
}
