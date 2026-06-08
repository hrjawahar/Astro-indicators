// ─────────────────────────────────────────────────────────────────────────────
//  Jyotish Precision Analyzer  |  app.js  |  v3.2  (Phase 2 — v2 branch)
//  Phase 2 additions over v3.1:
//  1. 6-language planet name selector (EN / Tamil / Telugu / Hindi / Kannada / Malayalam)
//  2. House lord relationship engine — lord indicator + F/N/E tags per planet per cell
//  3. Chart legend updated — explains F/N/E relationship tags
//  4. Planet screen redesigned — D1 vs D9 side-by-side comparison cards
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "jyotish-v3-inputs";
const HISTORY_KEY = "jyotish-v3-history";

// ── Client-side timezone lookup ───────────────────────────────────────────────
const CLIENT_TZ = {
  IN:5.5,  NP:5.75, LK:5.5,  BD:6,    PK:5,    AF:4.5,  IR:3.5,  MM:6.5,
  TH:7,    VN:7,    KH:7,    LA:7,    MY:8,    SG:8,    PH:8,    ID:7,
  CN:8,    TW:8,    HK:8,    MO:8,    JP:9,    KR:9,    KP:9,    MN:8,
  BT:6,    MV:5,    UZ:5,    KZ:6,    TM:5,    TJ:5,    KG:6,    AZ:4,
  GE:4,    AM:4,    IL:2,    SA:3,    AE:4,    QA:3,    KW:3,    BH:3,
  OM:4,    YE:3,    IQ:3,    SY:2,    LB:2,    JO:2,    PS:2,    TR:3,
  GB:0,    IE:0,    PT:0,    IS:0,    FR:1,    DE:1,    ES:1,    IT:1,
  NL:1,    BE:1,    CH:1,    AT:1,    PL:1,    CZ:1,    SK:1,    HU:1,
  SI:1,    HR:1,    BA:1,    RS:1,    ME:1,    MK:1,    AL:1,    LU:1,
  DK:1,    NO:1,    SE:1,    FI:2,    EE:2,    LV:2,    LT:2,    BY:3,
  UA:2,    MD:2,    RO:2,    BG:2,    GR:2,    CY:2,    RU:3,
  MA:0,    DZ:1,    TN:1,    LY:2,    EG:2,    SD:3,    ET:3,    KE:3,
  TZ:3,    ZA:2,    NG:1,    GH:0,    SN:0,    CI:0,
  BR:-3,   AR:-3,   CL:-3,   UY:-3,   PY:-4,   BO:-4,   PE:-5,   CO:-5,
  EC:-5,   VE:-4,   MX:-6,   CR:-6,   PA:-5,   CU:-5,   JM:-5,   HT:-5,
  DO:-4,   TT:-4,   AU:10,   NZ:12,   FJ:12,   PG:10,
};

// ── Planet name translations — 6 languages ────────────────────────────────────
// Each language provides a 2-3 char abbreviation used inside the chart cells.
const PLANET_NAMES = {
  EN: { Sun:"Su", Moon:"Mo", Mars:"Ma", Mercury:"Me", Jupiter:"Ju", Venus:"Ve", Saturn:"Sa", Rahu:"Ra", Ketu:"Ke" },
  TA: { Sun:"சூ", Moon:"சந்", Mars:"செவ்", Mercury:"பு", Jupiter:"கு", Venus:"சுக்", Saturn:"சனி", Rahu:"ரா", Ketu:"கே" },
  TE: { Sun:"సూ", Moon:"చం", Mars:"కుజ", Mercury:"బుధ", Jupiter:"గురు", Venus:"శుక్", Saturn:"శని", Rahu:"రా", Ketu:"కే" },
  HI: { Sun:"सू", Moon:"चं", Mars:"मं", Mercury:"बु", Jupiter:"गु", Venus:"शु", Saturn:"श", Rahu:"रा", Ketu:"के" },
  KA: { Sun:"ಸೂ", Moon:"ಚಂ", Mars:"ಮಂ", Mercury:"ಬು", Jupiter:"ಗು", Venus:"ಶು", Saturn:"ಶ", Rahu:"ರಾ", Ketu:"ಕೇ" },
  ML: { Sun:"സൂ", Moon:"ചന്ദ്ര", Mars:"കുജ", Mercury:"ബുധ", Jupiter:"ഗുരു", Venus:"ശുക്", Saturn:"ശനി", Rahu:"രാ", Ketu:"കേ" },
};

// Current language — persisted in localStorage
let _currentLang = localStorage.getItem("jyotish-lang") || "EN";

// ── Planet glyphs (unicode) ───────────────────────────────────────────────────
const PLANET_GLYPHS = {
  Sun:"☉", Moon:"☽", Mars:"♂", Mercury:"☿", Jupiter:"♃",
  Venus:"♀", Saturn:"♄", Rahu:"☊", Ketu:"☋"
};

const PLANET_LIST = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];

// ── Sign lord table ───────────────────────────────────────────────────────────
const SIGN_LORD = {
  Aries:"Mars", Taurus:"Venus", Gemini:"Mercury", Cancer:"Moon",
  Leo:"Sun", Virgo:"Mercury", Libra:"Venus", Scorpio:"Mars",
  Sagittarius:"Jupiter", Capricorn:"Saturn", Aquarius:"Saturn", Pisces:"Jupiter"
};

// ── Natural planetary relationships (Naisargika Maitri) ──────────────────────
const NATURAL_FRIENDS = {
  Sun:     { friends:["Moon","Mars","Jupiter"],          enemies:["Venus","Saturn"] },
  Moon:    { friends:["Sun","Mercury"],                  enemies:[] },
  Mars:    { friends:["Sun","Moon","Jupiter"],            enemies:["Mercury"] },
  Mercury: { friends:["Sun","Venus"],                    enemies:["Moon"] },
  Jupiter: { friends:["Sun","Moon","Mars"],              enemies:["Mercury","Venus"] },
  Venus:   { friends:["Mercury","Saturn"],               enemies:["Sun","Moon"] },
  Saturn:  { friends:["Mercury","Venus"],                enemies:["Sun","Moon","Mars"] },
  Rahu:    { friends:["Mercury","Venus","Saturn"],       enemies:["Sun","Moon","Mars"] },
  Ketu:    { friends:["Sun","Moon","Mars"],              enemies:["Mercury","Venus","Saturn"] },
};

// ══════════════════════════════════════════════════════════════════════════════
//  PHASE 3 — CLAUDE API INDICATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const SIGNS_P3 = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

const PLANET_THEME_CHIP = {
  Sun:"Authority & Career", Moon:"Mind & Emotions", Mars:"Energy & Property",
  Mercury:"Communication & Intellect", Jupiter:"Wisdom & Wealth",
  Venus:"Relationships & Comforts", Saturn:"Discipline & Karma",
  Rahu:"Ambition & Change", Ketu:"Detachment & Spirit",
};

const HOUSE_DOMAIN_SHORT = {
  1:"health and identity", 2:"finances and family wealth",
  3:"skills and communication", 4:"home, property, and mother",
  5:"children, creativity, and investments", 6:"health challenges, debts, and competition",
  7:"partnerships, marriage, and career transitions",
  8:"sudden reversals, hidden crises, and transformation",
  9:"fortune, father, and higher wisdom", 10:"career and public standing",
  11:"income, gains, and social network", 12:"losses, isolation, and spiritual retreat",
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

// In-memory caches — keyed by "md:ad:lagna"
const _indicationCache = new Map();
const _mdSeasonCache   = new Map();

// Build full chart context string for the prompt
function buildChartContext(lagnaSign, houses, planets) {
  const d1HouseMap = buildPlanetHouseMap(houses);
  const combustSet = buildCombustSet(planets);
  const warLosers  = buildWarSet(planets);
  const lagnaIdx   = SIGNS_P3.indexOf(lagnaSign);

  const planetLines = PLANET_LIST.map(p => {
    const pl = planets[p]; if (!pl) return null;
    const h  = d1HouseMap[p] || "?";
    const dig = getDignity(p, pl.sign);
    const fs  = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[p] || "N";
    const fsLabel = fs==="Y"?"Yogakaraka":fs==="B"?"FuncBenefic":fs==="M"?"FuncMalefic":"Neutral";
    // Houses lorded
    const lorded = [];
    for (let i=1;i<=12;i++) { if (SIGN_LORD[SIGNS_P3[(lagnaIdx+i-1)%12]]===p) lorded.push(i); }
    // Aspects
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
    return `${p}: H${h} ${pl.sign} ${pl.degree?.toFixed(1)||"?"}° D9:${pl.d9sign||"?"} LordsH[${lorded.join(",")}](${lorded.map(n=>{const s=SIGNS_P3[(lagnaIdx+n-1)%12];return "H"+n+"="+s;}).join(",")}) AspectsH[${[...new Set(aspects)].filter(x=>x!==h).join(",")}] ${fsLabel} ${flags||"clean"}`;
  }).filter(Boolean);

  const houseLordLines = [];
  for (let h=1;h<=12;h++) {
    const sign = SIGNS_P3[(lagnaIdx+h-1)%12];
    const lord = SIGN_LORD[sign];
    const lordH = d1HouseMap[lord] || "?";
    houseLordLines.push(`H${h}(${sign})lord=${lord}@H${lordH}`);
  }

  return "LAGNA: " + lagnaSign + "\n\nPLANETS:\n" + planetLines.join("\n") + "\n\nHOUSE_LORDS: " + houseLordLines.join("  ");
}

// Build quick chips (synchronous, instant)
function buildQuickChips(adLord, lagnaSign, houses, planets) {
  const d1HouseMap = buildPlanetHouseMap(houses);
  const combustSet = buildCombustSet(planets);
  const adFS   = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[adLord]||"N";
  const adHouse= d1HouseMap[adLord];
  const adSign = planets[adLord]?.sign||"";
  const adDig  = getDignity(adLord, adSign);
  const adRetro= planets[adLord]?.retrograde||false;
  const isMal  = adFS==="M", isBen=["B","Y"].includes(adFS);
  const lagnaIdx = SIGNS_P3.indexOf(lagnaSign);
  const goodLorded = [];
  for (let h=1;h<=12;h++) {
    if (SIGN_LORD[SIGNS_P3[(lagnaIdx+h-1)%12]]===adLord && ![6,8,12].includes(h)) goodLorded.push(h);
  }
  const ct = isMal||adDig==="de"?"chip-caution":isBen?"chip-positive":"";
  const chips = [];
  if (PLANET_THEME_CHIP[adLord]) chips.push({label:PLANET_THEME_CHIP[adLord],cls:ct});
  if (adHouse) chips.push({label:"H"+adHouse+" — "+HOUSE_DOMAIN_SHORT[adHouse],cls:isMal?"chip-caution":""});
  if (goodLorded.length) chips.push({label:"Lords: "+goodLorded.slice(0,2).map(h=>HOUSE_DOMAIN_SHORT[h]).join(", "),cls:isBen?"chip-positive":""});
  if (adDig==="ex")  chips.push({label:"Exalted "+adSign,cls:"chip-positive"});
  if (adDig==="de")  chips.push({label:"Debilitated "+adSign,cls:"chip-caution"});
  if (adRetro)       chips.push({label:"Retrograde ℞",cls:"chip-caution"});
  if (combustSet.has(adLord)) chips.push({label:"Combust ☀",cls:"chip-caution"});
  return chips.map(c=>`<span class="adi-theme-chip ${c.cls}">${c.label}</span>`).join("");
}

// MD season prompt
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

// Markdown to HTML — section headers + paragraphs, no duplication
function markdownToHTML(md) {
  // Normalize line endings
  const text = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Split into lines and process
  const lines = text.split('\n');
  const out = [];
  let paraLines = [];

  const flushPara = () => {
    const t = paraLines.join(' ').trim();
    if (t) out.push(`<p>${t}</p>`);
    paraLines = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    // Detect **SECTION HEADER** — bold text alone on a line
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      flushPara();
      const title = line.replace(/\*\*/g, '');
      out.push(`<div class="ind-section-title">${title}</div>`);
    } else if (line === '') {
      flushPara();
    } else {
      // Inline bold → <strong>
      paraLines.push(line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'));
    }
  }
  flushPara();
  return out.join('');
}

// Translation language labels
// Translation language labels
const IND_LANG_LABELS = {
  EN:"English", TA:"தமிழ்", TE:"తెలుగు", HI:"हिंदी", KA:"ಕನ್ನಡ", ML:"മലയാളം"
};

// Per-panel state: tracks currently displayed text for correct download
const _panelState = new Map();

// Translate indication via API
async function translateIndication(text, targetLang, contentEl, panelId) {
  contentEl.innerHTML = `<div class="ind-loading"><span class="spinner"></span>Translating to ${IND_LANG_LABELS[targetLang]}…</div>`;
  try {
    const res = await fetch("/api/indicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        max_tokens: 2500,
        prompt: `Translate the following Vedic astrology reading into ${IND_LANG_LABELS[targetLang]}.

Rules:
- Translate section headers too
- Keep UNTRANSLATED: planet names (Saturn, Jupiter, Venus, Mars, Mercury, Sun, Moon, Rahu, Ketu), house numbers (H1–H12), technical terms (Mahadasha, Antardasha, Yogakaraka, Lagna, D9, Navamsha, Vimshottari), sign names (Aries, Taurus etc), dignity terms (Exalted, Debilitated)
- Translate ALL descriptive sentences completely — do not stop mid-sentence
- Complete the full translation without truncating

TEXT TO TRANSLATE:
${text}`,
      }),
    });
    if (!res.ok) throw new Error("HTTP "+res.status);
    let full = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      const lines = decoder.decode(value,{stream:true}).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw==="[DONE]") continue;
        try { const d=JSON.parse(raw).delta?.text||""; if(d){full+=d;contentEl.innerHTML=markdownToHTML(full);} } catch{}
      }
    }
    _panelState.set(panelId, { currentText: full, currentLang: targetLang });
  } catch(err) {
    contentEl.innerHTML = `<div class="ind-error">Translation failed: ${err.message}</div>`;
  }
}

// Download as Word
function downloadAsWord(text, filename) {
  const body = markdownToHTML(text)
    .replace(/<div class="ind-section-title">/g,'<h2>')
    .replace(/<\/div>/g,'</h2>');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.65;color:#111;max-width:680px;margin:40px auto}h2{font-size:12pt;color:#5a3e00;border-bottom:1px solid #ccc;padding-bottom:3px;margin-top:18px}p{margin:0 0 9px}</style></head><body>${body}</body></html>`;
  const blob=new Blob(["\uFEFF",html],{type:"application/msword"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename+".doc"; a.click(); URL.revokeObjectURL(url);
}

// Download as PDF via print dialog
function downloadAsPDF(text, filename) {
  const body = markdownToHTML(text);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.65;color:#111;max-width:680px;margin:32px auto;padding:0 20px}.ind-section-title{font-weight:700;color:#5a3e00;text-transform:uppercase;font-size:10.5pt;letter-spacing:.05em;border-bottom:1px solid #ddd;padding-bottom:3px;margin:18px 0 7px}p{margin:0 0 9px}@media print{body{margin:0;padding:20px}}</style></head><body><h1 style="font-size:13pt;color:#5a3e00;border-bottom:2px solid #c9a84c;padding-bottom:6px;margin-bottom:20px">${filename}</h1>${body}<script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win=window.open("","_blank");
  if (win){win.document.write(html);win.document.close();}
}

// Format picker popup
function showDownloadPicker(panelId) {
  document.querySelectorAll(".dl-format-picker").forEach(el=>el.remove());
  const toolbar=document.getElementById(`toolbar-${panelId}`);
  if (!toolbar) return;
  const state=_panelState.get(panelId);
  if (!state) return;
  const filename=`dasha-indication-${panelId}`;
  const picker=document.createElement("div");
  picker.className="dl-format-picker";
  picker.innerHTML=`<div class="dl-picker-title">Download as</div>
    <button class="dl-fmt-btn" data-fmt="word">📄 Word (.doc)</button>
    <button class="dl-fmt-btn" data-fmt="pdf">📑 PDF (print)</button>
    <button class="dl-fmt-btn" data-fmt="txt">📝 Text (.txt)</button>`;
  picker.querySelector("[data-fmt=word]").addEventListener("click",()=>{downloadAsWord(state.currentText,filename);picker.remove();});
  picker.querySelector("[data-fmt=pdf]").addEventListener("click",()=>{downloadAsPDF(state.currentText,filename);picker.remove();});
  picker.querySelector("[data-fmt=txt]").addEventListener("click",()=>{
    const blob=new Blob([state.currentText],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=filename+".txt";a.click();URL.revokeObjectURL(url);picker.remove();
  });
  toolbar.style.position="relative";
  toolbar.appendChild(picker);
  setTimeout(()=>document.addEventListener("click",function h(e){if(!picker.contains(e.target)){picker.remove();document.removeEventListener("click",h);}},),50);
}

// Build toolbar HTML
function buildIndicationToolbar(panelId) {
  const langBtns=Object.entries(IND_LANG_LABELS).map(([code,label])=>
    `<button class="ind-lang-btn${code==="EN"?" active":""}" data-lang="${code}" data-panel="${panelId}">${label}</button>`
  ).join("");
  return `<div class="ind-toolbar" id="toolbar-${panelId}">
    <div class="ind-lang-row">${langBtns}</div>
    <button class="ind-dl-btn" data-panel="${panelId}">⬇ Download</button>
  </div>`;
}

// Wire toolbar events
function wireToolbar(panelId, originalText) {
  const toolbar=document.getElementById(`toolbar-${panelId}`);
  if (!toolbar) return;
  _panelState.set(panelId,{currentText:originalText,currentLang:"EN"});
  toolbar.querySelectorAll(".ind-lang-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      toolbar.querySelectorAll(".ind-lang-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const lang=btn.dataset.lang;
      const contentEl=document.getElementById(`content-${panelId}`);
      if (!contentEl) return;
      if (lang==="EN") {
        contentEl.innerHTML=markdownToHTML(originalText);
        _panelState.set(panelId,{currentText:originalText,currentLang:"EN"});
      } else {
        translateIndication(originalText,lang,contentEl,panelId);
      }
    });
  });
  toolbar.querySelector(".ind-dl-btn")?.addEventListener("click",e=>{
    e.stopPropagation(); showDownloadPicker(panelId);
  });
}

// Stream Claude API via Cloudflare proxy
async function callIndicationAPI(prompt, targetEl, cacheKey, cacheMap) {
  targetEl.innerHTML=`<div class="ind-loading"><span class="spinner"></span>Generating from chart data…</div>`;
  const panelId=cacheKey.replace(/[^a-zA-Z0-9]/g,"_");
  try {
    const res=await fetch("/api/indicate",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt,max_tokens:2000}),
    });
    if (!res.ok){const err=await res.json().catch(()=>({error:`HTTP ${res.status}`}));throw new Error(err.error||`HTTP ${res.status}`);}
    targetEl.innerHTML=`${buildIndicationToolbar(panelId)}<div class="ind-content" id="content-${panelId}"></div>`;
    const contentEl=document.getElementById(`content-${panelId}`);
    let full="";
    const reader=res.body.getReader(), decoder=new TextDecoder();
    while (true) {
      const {done,value}=await reader.read(); if(done) break;
      const lines=decoder.decode(value,{stream:true}).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw=line.slice(6).trim(); if(raw==="[DONE]") continue;
        try{const delta=JSON.parse(raw).delta?.text||"";if(delta){full+=delta;contentEl.innerHTML=markdownToHTML(full);}}catch{}
      }
    }
    cacheMap.set(cacheKey,full);
    wireToolbar(panelId,full);
  } catch(err) {
    targetEl.innerHTML=`<div class="ind-error">Could not generate: ${err.message}</div>`;
  }
}

// Returns "F" (friend), "E" (enemy), or "N" (neutral) between houseLord and visitor
function getRelationshipTag(houseLord, visitor) {
  if (!houseLord || !visitor || houseLord === visitor) return null;
  const rel = NATURAL_FRIENDS[houseLord];
  if (!rel) return "N";
  if (rel.friends.includes(visitor)) return "F";
  if (rel.enemies.includes(visitor)) return "E";
  return "N";
}

// Build a planet → house number map from the houses object
function buildPlanetHouseMap(houses) {
  const map = {};
  for (const [hNum, planets] of Object.entries(houses)) {
    for (const p of (planets || [])) {
      map[p] = parseInt(hNum);
    }
  }
  return map;
}

// ── City search state ─────────────────────────────────────────────────────────
let _selectedPlace  = null;
let _searchTimer    = null;
let _suppressSearch = false;

// South Indian chart layout
const SI_LAYOUT = [
  [0,2],[0,3],[1,3],[2,3],
  [3,3],[3,2],[3,1],[3,0],
  [2,0],[1,0],[0,0],[0,1]
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tabs      = document.querySelectorAll(".nav-tab");
const screens   = document.querySelectorAll(".screen");
const genBtn    = document.getElementById("generateBtn");
const genText   = document.getElementById("generateBtnText");
const statusMsg = document.getElementById("statusMsg");
const errorBox  = document.getElementById("errorBox");
const saveBtn   = document.getElementById("saveBtn");
const dlBtn     = document.getElementById("downloadBtn");
const resetBtn  = document.getElementById("resetBtn");

let currentData = null;

// ── TAB ROUTING ───────────────────────────────────────────────────────────────
function switchTab(tabId) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabId));
  screens.forEach(s => s.classList.toggle("active", s.id === tabId));
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const requires = tab.dataset.requires;
    if (requires === "chart" && !currentData?.chart) return;
    if (requires === "analysis" && !currentData?.analysis) return;
 
    // ── PAYMENT LOCK ──────────────────────────────────────────────────────
    // Dasa & Domain screens stay locked until that report is paid for.
    // window.AI_unlocked is set by ui-v4.js on successful payment.
    const LOCKED = { dashaTab: "dasha", domainTab: "domains" };
    const lockKey = LOCKED[tab.dataset.tab];
    if (lockKey && !(window.AI_unlocked && window.AI_unlocked[lockKey] === true)) {
      const msg = (window._currentLang === "TA")
        ? "இந்த அறிக்கையைப் பார்க்க, முதலில் கட்டணம் செலுத்தவும். மாதிரி அறிக்கையை (View Sample Report) இலவசமாகப் பார்க்கலாம்."
        : "This report unlocks after payment. You can preview it free using ‘View Sample Report’.";
      const sb = document.getElementById("statusMsg");
      if (sb) { sb.textContent = msg; sb.className = "status-msg"; }
      else { alert(msg); }
      return;   // block the tab switch
    }
    // ──────────────────────────────────────────────────────────────────────
 
    switchTab(tab.dataset.tab);
  });
});
// ── LANGUAGE SELECTOR ─────────────────────────────────────────────────────────
function initLangSelector() {
  const btns = document.querySelectorAll(".lang-btn");
  btns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === _currentLang);
    btn.addEventListener("click", () => {
      _currentLang = btn.dataset.lang;
      localStorage.setItem("jyotish-lang", _currentLang);
      btns.forEach(b => b.classList.toggle("active", b.dataset.lang === _currentLang));
      // Re-render charts with new language if data is loaded
      if (currentData?.chart) renderChartScreen(currentData.chart);
      // Re-render planet screen too
      if (currentData?.chart) renderPlanetScreen(currentData.chart);
    });
  });
}

// ── FORM HELPERS ──────────────────────────────────────────────────────────────
function getForm() {
  const placeDisplay = document.getElementById("inputPlaceDisplay");
  return {
    name:      document.getElementById("inputName").value.trim(),
    dob:       document.getElementById("inputDOB").value,
    tob:       document.getElementById("inputTOB").value,
    place:     _selectedPlace?.displayName || (placeDisplay ? placeDisplay.value.trim() : ""),
    lat:       _selectedPlace?.lat     || null,
    lng:       _selectedPlace?.lng     || null,
    country:   _selectedPlace?.country || "",
    utcOffset: _selectedPlace?.utcOffset ?? null,
  };
}

function setStatus(msg, type="") {
  statusMsg.textContent = msg;
  statusMsg.className   = "status-msg" + (type ? ` ${type}` : "");
}
function showError(msg) { errorBox.textContent = msg; errorBox.classList.remove("hidden"); }
function clearError()   { errorBox.classList.add("hidden"); }

// ── PLACE VALIDATION ──────────────────────────────────────────────────────────
function isValidPlaceRecord(s) {
  if (!s || typeof s !== "object") return false;
  const lat = parseFloat(s.lat);
  const lng = parseFloat(s.lng);
  if (!isFinite(lat) || !isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (typeof s.place !== "string" || s.place.length < 2) return false;
  const plLower = s.place.toLowerCase();
  const errorTokens = ["access denied","access den","error","403","401","unexpected","<!doctype","<html"];
  if (errorTokens.some(t => plLower.startsWith(t))) return false;
  return true;
}

// ── MAIN GENERATE FLOW ────────────────────────────────────────────────────────
genBtn.addEventListener("click", generate);

async function generate() {
  const form = getForm();
  clearError();

  if (!form.dob || !form.tob || !form.place) {
    showError("Please enter date of birth, time of birth, and select a place of birth from the dropdown.");
    return;
  }
  if (!isFinite(parseFloat(form.lat)) || !isFinite(parseFloat(form.lng))) {
    showError("Place of birth not fully resolved. Please clear the place field and select a city from the dropdown list again.");
    return;
  }

  genBtn.disabled = true;
  genText.innerHTML = `<span class="spinner"></span>Calculating chart...`;
  setStatus("Step 1 of 2 — Computing planetary positions via Swiss Ephemeris...", "loading");

  try {
    const chartRes = await fetch("/api/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, utcOffset: form.utcOffset ? parseFloat(form.utcOffset) : null })
    });

    if (!chartRes.ok) {
      const body = await chartRes.text().catch(()=>"");
      if (chartRes.status === 405) throw new Error("Chart Worker not found (405). Ensure functions/api/chart.js is deployed.");
      throw new Error(`Chart API error ${chartRes.status}: ${body.slice(0,120)}`);
    }
    const chartText = await chartRes.text();
    let chartData;
    try { chartData = JSON.parse(chartText); }
    catch {
      const preview = chartText.slice(0,80).replace(/\n/g," ");
      throw new Error(`Chart API returned invalid response. Raw: "${preview}"`);
    }
    if (chartData.error) throw new Error(chartData.error);

    setStatus("Step 2 of 2 — Running precision scoring engine...", "loading");
    genText.innerHTML = `<span class="spinner"></span>Analyzing domains...`;

    const analysisPayload = {
      d1: { lagnaSign: chartData.d1.lagnaSign, houses: chartData.d1.houses, degrees: chartData.d1.degrees, latitudes: chartData.d1.latitudes },
      d9: { lagnaSign: chartData.d9.lagnaSign, houses: chartData.d9.houses, degrees: chartData.d9.degrees, latitudes: chartData.d9.latitudes || {} },
      dashas:    chartData.dasha?.dashas    || null,
      birthDate: form.dob                  || null,
    };

    const analysisRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysisPayload)
    });

    if (!analysisRes.ok) {
      const body = await analysisRes.text().catch(()=>"");
      if (analysisRes.status === 405) throw new Error("Analysis Worker not found (405). Ensure functions/api/analyze.js is deployed.");
      throw new Error(`Analysis API error ${analysisRes.status}: ${body.slice(0,120)}`);
    }
    const analysisData = await analysisRes.json();
    if (analysisData.error) throw new Error(analysisData.error);

    currentData = { chart: chartData, analysis: analysisData, form };
    window.currentData = currentData;
    renderChartScreen(chartData);
    renderDashaScreen(chartData);
    renderDomainScreen(analysisData, chartData);
    renderSummaryScreen(analysisData, chartData);
    renderPlanetScreen(chartData);

    tabs.forEach(t => {
      if (t.dataset.requires === "chart" || t.dataset.requires === "analysis") t.disabled = false;
    });
    if (dlBtn) dlBtn.disabled = false;
    setStatus("Chart and analysis complete.", "done");
    switchTab("chartTab");

  } catch (err) {
    showError(err.message || "An unexpected error occurred.");
    setStatus("", "");
  } finally {
    genBtn.disabled = false;
    genText.textContent = "Generate Chart & Insights";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHART SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function renderChartScreen(data) {
  const { d1, d9, planets, ayanamsha } = data;

  const moonNak  = planets.Moon?.nakshatra || "";
  const moonPada = planets.Moon?.pada || "";
  document.getElementById("lagnaBar").innerHTML = `
    <div class="lagna-item"><div class="lagna-key">D1 Lagna</div><div class="lagna-val">${d1.lagnaSign} ${d1.lagnaDegree?.toFixed(1)}°</div></div>
    <div class="lagna-item"><div class="lagna-key">D9 Lagna</div><div class="lagna-val">${d9.lagnaSign}</div></div>
    <div class="lagna-item"><div class="lagna-key">Moon Nakshatra</div><div class="lagna-val">${moonNak} Pada ${moonPada}</div></div>
    <div class="lagna-item"><div class="lagna-key">Ayanamsha</div><div class="lagna-val">Lahiri ${ayanamsha?.toFixed(4)}°</div></div>
    <div class="lagna-item"><div class="lagna-key">Native</div><div class="lagna-val">${data.input?.name || "—"}</div></div>
  `;

  document.getElementById("d1LagnaLabel").textContent = `Lagna: ${d1.lagnaSign}`;
  document.getElementById("d9LagnaLabel").textContent = `Lagna: ${d9.lagnaSign}`;

  const combust   = buildCombustSet(planets);
  const warLosers = buildWarSet(planets);

  renderSIChart("d1ChartWrap", d1.lagnaSign, d1.houses, planets, combust, warLosers, false);
  renderSIChart("d9ChartWrap", d9.lagnaSign, d9.houses, planets, combust, warLosers, true);
}

function buildCombustSet(planets) {
  const orbs = { Moon:7, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };
  const combust = new Set();
  if (!planets.Sun) return combust;
  const sunLon = planets.Sun.longitude;
  for (const [p, orb] of Object.entries(orbs)) {
    if (!planets[p]) continue;
    let diff = Math.abs(planets[p].longitude - sunLon);
    if (diff > 180) diff = 360 - diff;
    if (diff <= orb) combust.add(p);
  }
  return combust;
}

function buildWarSet(planets) {
  const warPlanets = ["Mars","Mercury","Jupiter","Venus","Saturn"];
  const losers = new Set();
  for (let i = 0; i < warPlanets.length; i++) {
    for (let j = i+1; j < warPlanets.length; j++) {
      const p1 = warPlanets[i], p2 = warPlanets[j];
      if (!planets[p1] || !planets[p2]) continue;
      let diff = Math.abs(planets[p1].longitude - planets[p2].longitude);
      if (diff > 180) diff = 360 - diff;
      if (diff <= 1.0) {
        losers.add((planets[p1].latitude||0) < (planets[p2].latitude||0) ? p1 : p2);
      }
    }
  }
  return losers;
}

// Dignity helpers
const EXALTATION   = { Sun:"Aries",Moon:"Taurus",Mars:"Capricorn",Mercury:"Virgo",Jupiter:"Cancer",Venus:"Pisces",Saturn:"Libra",Rahu:"Gemini",Ketu:"Sagittarius" };
const DEBILITATION = { Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries",Rahu:"Sagittarius",Ketu:"Gemini" };
const OWN_SIGNS    = { Sun:["Leo"],Moon:["Cancer"],Mars:["Aries","Scorpio"],Mercury:["Gemini","Virgo"],Jupiter:["Sagittarius","Pisces"],Venus:["Taurus","Libra"],Saturn:["Capricorn","Aquarius"],Rahu:[],Ketu:[] };

function getDignity(planet, sign) {
  if (EXALTATION[planet] === sign)             return "ex";
  if (DEBILITATION[planet] === sign)           return "de";
  if ((OWN_SIGNS[planet]||[]).includes(sign))  return "own";
  return "";
}

// ── South Indian chart SVG — with house lord relationships & language support ──
function renderSIChart(containerId, lagnaSign, houses, planets, combustSet, warLosers, isD9) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const SIZE = 400;
  const CELL = SIZE / 4;
  const PAD  = 4;
  const names = PLANET_NAMES[_currentLang] || PLANET_NAMES.EN;

  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const lagnaIdx = SIGNS.indexOf(lagnaSign);

  const CELL_HOUSE = {
    "0,0":11,"0,1":12,"0,2":1,"0,3":2,
    "1,0":10,                  "1,3":3,
    "2,0":9,                   "2,3":4,
    "3,0":8,"3,1":7,"3,2":6,"3,3":5
  };

  // Build planet→house map for lord placement lookup
  const planetHouseMap = buildPlanetHouseMap(houses);

  const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",`0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("width","100%");

  // Light saffron background
  const bg = document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width",SIZE); bg.setAttribute("height",SIZE);
  bg.setAttribute("fill","#FFF8F0");
  svg.appendChild(bg);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row===1||row===2)&&(col===1||col===2)) continue;

      const key  = `${row},${col}`;
      const hNum = CELL_HOUSE[key];
      if (!hNum) continue;

      const signInHouse = SIGNS[(lagnaIdx + hNum - 1) % 12];
      const isLagna     = hNum === 1;
      const houseLord   = SIGN_LORD[signInHouse];

      const x = col * CELL;
      const y = row * CELL;

      // Cell background
      const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
      rect.setAttribute("x", x + 0.5);
      rect.setAttribute("y", y + 0.5);
      rect.setAttribute("width",  CELL - 1);
      rect.setAttribute("height", CELL - 1);
      rect.setAttribute("fill",   isLagna ? "rgba(180,120,30,0.08)" : "#FFFFFF");
      rect.setAttribute("stroke", isLagna ? "rgba(160,100,20,0.55)" : "rgba(100,75,40,0.18)");
      rect.setAttribute("stroke-width","0.5");
      svg.appendChild(rect);

      // Sign abbreviation
      const signAbbr = signInHouse.substring(0,3).toUpperCase();
      const signTxt  = document.createElementNS("http://www.w3.org/2000/svg","text");
      signTxt.setAttribute("x", x + PAD + 2);
      signTxt.setAttribute("y", y + 11);
      signTxt.setAttribute("font-size","8");
      signTxt.setAttribute("fill","rgba(100,65,10,0.85)");
      signTxt.setAttribute("font-family","Cinzel,serif");
      signTxt.textContent = signAbbr;
      svg.appendChild(signTxt);

      // House number
      const hTxt = document.createElementNS("http://www.w3.org/2000/svg","text");
      hTxt.setAttribute("x", x + CELL - PAD - 4);
      hTxt.setAttribute("y", y + 11);
      hTxt.setAttribute("font-size","8");
      hTxt.setAttribute("fill","rgba(0,0,0,0.55)");
      hTxt.setAttribute("text-anchor","end");
      hTxt.textContent = hNum;
      svg.appendChild(hTxt);

      // House lord indicator — bottom of cell: "Ld: Ma H7"
      // Shows which planet lords this house and where it sits
      const lordHouse   = planetHouseMap[houseLord];
      const lordAbbr    = names[houseLord] || houseLord?.substring(0,2) || "?";
      const lordDisplay = lordHouse ? `${lordAbbr}→H${lordHouse}` : lordAbbr;
      const lordTxt     = document.createElementNS("http://www.w3.org/2000/svg","text");
      lordTxt.setAttribute("x", x + PAD + 2);
      lordTxt.setAttribute("y", y + CELL - 5);
      lordTxt.setAttribute("font-size","7");
      lordTxt.setAttribute("fill","rgba(100,65,10,0.55)");
      lordTxt.setAttribute("font-family","Inter,sans-serif");
      lordTxt.textContent = lordDisplay;
      svg.appendChild(lordTxt);

      // Lagna ASC marker
      if (isLagna) {
        const lTxt = document.createElementNS("http://www.w3.org/2000/svg","text");
        lTxt.setAttribute("x", x + CELL - PAD - 4);
        lTxt.setAttribute("y", y + CELL - 5);
        lTxt.setAttribute("font-size","7");
        lTxt.setAttribute("fill","rgba(140,85,15,0.65)");
        lTxt.setAttribute("text-anchor","end");
        lTxt.textContent = "ASC";
        svg.appendChild(lTxt);
      }

      // Planets in this house
      const planetsHere = (houses[hNum] || []);
      let pY = y + 23;
      planetsHere.forEach(planet => {
        if (pY > y + CELL - 16) return; // leave room for lord tag

        const sign     = isD9 ? (planets[planet]?.d9sign || signInHouse) : signInHouse;
        const dignity  = getDignity(planet, sign);
        const isRetro  = planets[planet]?.retrograde;
        const isCombust= combustSet.has(planet);
        const isWar    = warLosers.has(planet);
        const deg      = planets[planet]?.degree || 0;

        // Planet name from selected language
        const pName = names[planet] || planet.substring(0,2);

        // Base color by dignity
        let color = "#2c3248";
        if      (dignity === "ex")  color = "#1a6e3c";
        else if (dignity === "de")  color = "#8f1a1a";
        else if (dignity === "own") color = "#1e4a8f";
        if (isCombust)              color = "#a05c00";

        // Build label: name + modifiers
        let label = pName;
        if (isRetro)   label += "ʀ";
        if (isCombust) label += "☀";
        if (isWar)     label += "⚔";
        if (dignity)   label += ` ${dignity==="ex"?"Ex":dignity==="de"?"De":"Ow"}`;
        label += ` ${Math.round(deg)}°`;

        const pTxt = document.createElementNS("http://www.w3.org/2000/svg","text");
        pTxt.setAttribute("x", x + PAD + 2);
        pTxt.setAttribute("y", pY);
        pTxt.setAttribute("font-size","9.5");
        pTxt.setAttribute("fill", color);
        pTxt.setAttribute("font-family","Inter,sans-serif");
        pTxt.setAttribute("font-weight","500");
        pTxt.textContent = label;
        svg.appendChild(pTxt);

        // House lord relationship tag — F / N / E
        const relTag = getRelationshipTag(houseLord, planet);
        if (relTag) {
          const relColor = relTag === "F" ? "#1a6e3c" : relTag === "E" ? "#8f1a1a" : "#888";
          const rTxt = document.createElementNS("http://www.w3.org/2000/svg","text");
          rTxt.setAttribute("x", x + CELL - PAD - 4);
          rTxt.setAttribute("y", pY);
          rTxt.setAttribute("font-size","8");
          rTxt.setAttribute("fill", relColor);
          rTxt.setAttribute("font-weight","700");
          rTxt.setAttribute("text-anchor","end");
          rTxt.setAttribute("font-family","Inter,sans-serif");
          rTxt.textContent = relTag;
          svg.appendChild(rTxt);
        }

        pY += 13;
      });
    }
  }

  // Center diamond diagonal lines
  [[CELL,CELL,3*CELL,3*CELL],[3*CELL,CELL,CELL,3*CELL]].forEach(([x1,y1,x2,y2]) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",x1); line.setAttribute("y1",y1);
    line.setAttribute("x2",x2); line.setAttribute("y2",y2);
    line.setAttribute("stroke","rgba(100,70,20,0.18)");
    line.setAttribute("stroke-width","0.5");
    svg.appendChild(line);
  });

  wrap.innerHTML = "";
  wrap.appendChild(svg);
}

// ══════════════════════════════════════════════════════════════════════════════
//  DASHA SCREEN
// ══════════════════════════════════════════════════════════════════════════════

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

const PLANET_GLYPHS_FULL = { Sun:"☉",Moon:"☽",Mars:"♂",Mercury:"☿",Jupiter:"♃",Venus:"♀",Saturn:"♄",Rahu:"☊",Ketu:"☋" };

function renderDashaScreen(data) {
  const {dasha,d1} = data;
  if (!dasha||!dasha.dashas) return;
  const lagna  = d1.lagnaSign;
  const houses = d1.houses;
  const planets= data.planets;
  const today  = new Date().toISOString().split("T")[0];
  const chartCtx = buildChartContext(lagna, houses, planets);

  let currentMaha=null, currentAntar=null;
  for (const d of dasha.dashas) {
    if (d.startDate<=today&&today<d.endDate) {
      currentMaha=d;
      for (const a of d.antarDasas||[]) { if(a.startDate<=today&&today<a.endDate){currentAntar=a;break;} }
      break;
    }
  }

  // Current period card
  const cdEl = document.getElementById("currentDashaDisplay");
  if (cdEl&&currentMaha) {
    const mahaFS = FUNCTIONAL_STATUS_MAP[lagna]?.[currentMaha.lord]||"N";
    const mahaTag = mahaFS==="Y"?"Yogakaraka":mahaFS==="B"?"Benefic":mahaFS==="M"?"Malefic":"Neutral";
    let adHTML="";
    if (currentAntar) {
      const chips=buildQuickChips(currentAntar.lord,lagna,houses,planets);
      adHTML=`<div class="cd-ad-indication"><div class="cd-ad-label">Current sub-period — ${currentAntar.lord} Antardasha</div>${chips?`<div class="adi-themes">${chips}</div>`:""}<div class="ad-api-panel" id="currentAdPanel"></div></div>`;
    }
    cdEl.innerHTML=`<div class="current-dasha-display">
      <div class="cd-block"><div class="cd-label">Maha Dasa</div><div class="cd-lord">${PLANET_GLYPHS_FULL[currentMaha.lord]||""} ${currentMaha.lord}</div><div class="cd-dates">${currentMaha.startDate} → ${currentMaha.endDate}</div><div class="cd-note">${mahaTag} for your lagna</div></div>
      <div class="cd-block"><div class="cd-label">Antar Dasa</div><div class="cd-lord">${currentAntar?(PLANET_GLYPHS_FULL[currentAntar.lord]||"")+" "+currentAntar.lord:"—"}</div><div class="cd-dates">${currentAntar?currentAntar.startDate+" → "+currentAntar.endDate:"—"}</div></div>
      <div class="cd-block"><div class="cd-label">Moon Nakshatra</div><div class="cd-lord">${dasha.nakshatra}</div><div class="cd-dates">Starts: ${dasha.nakshataLord}</div></div>
    </div>${adHTML}`;
    if (currentAntar) {
      const panel=document.getElementById("currentAdPanel");
      if (panel) {
        const ck=`${currentMaha.lord}:${currentAntar.lord}:${lagna}`;
        if (_indicationCache.has(ck)) panel.innerHTML=`<div class="ind-content">${markdownToHTML(_indicationCache.get(ck))}</div>`;
        else callIndicationAPI(buildADPrompt(currentMaha.lord,currentAntar.lord,lagna,chartCtx),panel,ck,_indicationCache);
      }
    }
  }

  // Full timeline
  const timeline=document.getElementById("dashaTimeline");
  if (!timeline) return;
  timeline.innerHTML="";
  const nowMs=new Date().getTime();

  dasha.dashas.forEach(d => {
    const isCurrent=d.startDate<=today&&today<d.endDate;
    const dS=new Date(d.startDate).getTime(), dE=new Date(d.endDate).getTime();
    let prog=0;
    if (isCurrent) prog=Math.max(0,Math.min(100,((nowMs-dS)/(dE-dS))*100));
    else if (dE<nowMs) prog=100;
    const fs=FUNCTIONAL_STATUS_MAP[lagna]?.[d.lord]||"N";
    const fsLabel=fs==="Y"?"Yogakaraka ★":fs==="B"?"Benefic":fs==="M"?"Malefic":"Neutral";
    const mdCK=`season:${d.lord}:${lagna}`;

    const antarHTML=(d.antarDasas||[]).map(a=>{
      const isCA=a.startDate<=today&&today<a.endDate;
      const chips=buildQuickChips(a.lord,lagna,houses,planets);
      const adCK=`${d.lord}:${a.lord}:${lagna}`;
      return `<div class="antar-item${isCA?" current-antar":""}">
        <div class="antar-main">
          <div class="antar-lord">${PLANET_GLYPHS_FULL[a.lord]||""} ${a.lord}</div>
          <div class="antar-dates">${a.startDate} → ${a.endDate}</div>
          <div class="antar-yrs">${a.years} yrs</div>
          <button class="ad-toggle" data-md="${d.lord}" data-ad="${a.lord}" aria-expanded="false">Indication ▶</button>
        </div>
        <div class="ad-ind-panel" style="display:none">
          ${chips?`<div class="adi-themes" style="padding:10px 14px 0">${chips}</div>`:""}
          <div class="ad-api-panel" data-cache="${adCK}"></div>
        </div>
      </div>`;
    }).join("");

    const row=document.createElement("div");
    row.className="dasha-row"+(isCurrent?" current":"");
    row.innerHTML=`
      <div class="dasha-header">
        <div class="dasha-planet-glyph">${PLANET_GLYPHS_FULL[d.lord]||""}</div>
        <div><div class="dasha-lord">${d.lord}</div><div style="font-size:11px;color:var(--text-dim)">${fsLabel}</div></div>
        <div class="dasha-dates">${d.startDate}<br>${d.endDate}</div>
        <div class="dasha-years">${d.years} yrs</div>
        <div class="dasha-expand">${isCurrent?"▼":"▶"}</div>
      </div>
      <div class="dasha-bar-wrap"><div class="dasha-bar" style="width:${prog}%"></div></div>
      <div class="antar-list">
        <div class="md-season-block">
          <div class="md-season-label">Season Overview</div>
          <div class="ad-api-panel md-api-panel" data-md-cache="${mdCK}"></div>
        </div>
        ${antarHTML}
      </div>`;

    // MD row toggle — lazy-load season
    row.querySelector(".dasha-header").addEventListener("click",()=>{
      row.classList.toggle("open");
      if (row.classList.contains("open")) {
        const sp=row.querySelector(".md-api-panel");
        if (sp&&!sp.dataset.loaded) {
          sp.dataset.loaded="1";
          if (_mdSeasonCache.has(mdCK)) sp.innerHTML=`<div class="ind-content">${markdownToHTML(_mdSeasonCache.get(mdCK))}</div>`;
          else callIndicationAPI(buildMDPrompt(d.lord,lagna,chartCtx),sp,mdCK,_mdSeasonCache);
        }
      }
    });

    // Auto-load current MD season
    if (isCurrent) {
      row.classList.add("open");
      const sp=row.querySelector(".md-api-panel");
      if (sp) {
        sp.dataset.loaded="1";
        if (_mdSeasonCache.has(mdCK)) sp.innerHTML=`<div class="ind-content">${markdownToHTML(_mdSeasonCache.get(mdCK))}</div>`;
        else callIndicationAPI(buildMDPrompt(d.lord,lagna,chartCtx),sp,mdCK,_mdSeasonCache);
      }
    }

    // AD toggle — lazy-load indication
    row.querySelectorAll(".ad-toggle").forEach(btn=>{
      btn.addEventListener("click",e=>{
        e.stopPropagation();
        const item=btn.closest(".antar-item");
        const panel=item.querySelector(".ad-ind-panel");
        const open=panel.style.display!=="none";
        panel.style.display=open?"none":"block";
        btn.textContent=open?"Indication ▶":"Indication ▼";
        btn.setAttribute("aria-expanded",String(!open));
        if (!open) {
          const ap=item.querySelector(".ad-api-panel");
          if (ap&&!ap.dataset.loaded) {
            ap.dataset.loaded="1";
            const ck=ap.dataset.cache;
            if (_indicationCache.has(ck)) ap.innerHTML=`<div class="ind-content">${markdownToHTML(_indicationCache.get(ck))}</div>`;
            else callIndicationAPI(buildADPrompt(btn.dataset.md,btn.dataset.ad,lagna,chartCtx),ap,ck,_indicationCache);
          }
        }
      });
    });

    // Auto-open current AD
    if (isCurrent&&currentAntar) {
      const curItem=row.querySelector(".current-antar");
      if (curItem) {
        const panel=curItem.querySelector(".ad-ind-panel");
        const btn=curItem.querySelector(".ad-toggle");
        const ap=curItem.querySelector(".ad-api-panel");
        if (panel) panel.style.display="block";
        if (btn)  {btn.textContent="Indication ▼";btn.setAttribute("aria-expanded","true");}
        if (ap&&!ap.dataset.loaded) {
          ap.dataset.loaded="1";
          const ck=ap.dataset.cache;
          if (_indicationCache.has(ck)) ap.innerHTML=`<div class="ind-content">${markdownToHTML(_indicationCache.get(ck))}</div>`;
          else callIndicationAPI(buildADPrompt(btn?.dataset.md||d.lord,btn?.dataset.ad||currentAntar.lord,lagna,chartCtx),ap,ck,_indicationCache);
        }
      }
    }

    timeline.appendChild(row);
  });
}


// ══════════════════════════════════════════════════════════════════════════════
//  DOMAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function verdictClass(v) {
  if (!v) return "forming";
  const k = v.toLowerCase();
  if (k.includes("full flow"))        return "stable";
  if (k.includes("needs tending"))    return "vulnerable";
  if (k.includes("peak comes"))       return "early";
  if (k.includes("deferred"))         return "delayed";
  if (k.includes("foundation holds")) return "moderate";
  if (k.includes("ripening"))         return "ripening";
  if (k.includes("still forming"))    return "forming";
  if (k.includes("stable"))           return "stable";
  if (k.includes("vulnerable"))       return "vulnerable";
  if (k.includes("early"))            return "early";
  if (k.includes("delayed")||k.includes("improving")) return "delayed";
  if (k.includes("moderate"))         return "moderate";
  return "forming";
}

function renderDomainScreen(analysis, chart) {
  const { domains, statements, chartOpening, classification, eventFlags } = analysis;
  if (!domains) return;

  if (chartOpening) {
    const block   = document.getElementById("chartOpeningBlock");
    const badge   = document.getElementById("coPatternBadge");
    const opening = document.getElementById("coOpeningText");
    const axis    = document.getElementById("coAxisText");
    const mod     = document.getElementById("coModifierText");
    const primary   = classification?.primaryPattern;
    const secondary = classification?.secondaryPattern;
    const dominant  = classification?.dominantPlanet;
    badge.innerHTML = [
      primary   ? `<span class="co-badge co-badge-${primary.name.toLowerCase()}">${primary.name}</span>` : "",
      secondary ? `<span class="co-badge co-badge-secondary">${secondary.name}</span>` : "",
      dominant  ? `<span class="co-badge co-badge-planet">${dominant} dominant</span>` : "",
    ].filter(Boolean).join("");
    opening.textContent = chartOpening.opening  || "";
    axis.textContent    = chartOpening.axisLine || "";
    mod.textContent     = chartOpening.modifier || "";
    block.classList.remove("hidden");
  }

  const vGrid = document.getElementById("verdictSummary");
  vGrid.innerHTML = domains.map(d => `
    <div class="verdict-mini vm-${verdictClass(d.verdict)}" title="${d.verdict}">
      <div class="vm-title">${d.title.replace(" & "," &amp; ")}</div>
      <div class="vm-verdict">${d.verdict}</div>
    </div>`).join("");

  const container = document.getElementById("domainCards");
  container.innerHTML = "";

  domains.forEach((d, i) => {
    const stmt = statements?.statements?.[i] || null;
    const vc   = verdictClass(d.verdict);
    const card = document.createElement("div");
    card.className = `domain-card reading-card ${vc}`;

    const confColor = { High:"var(--stable)", Medium:"var(--accent-gold)", Low:"var(--vuln)" };
    const cColor    = confColor[stmt?.confidence] || "var(--text-muted)";
    const confDots  = stmt?.confidence
      ? `<span class="conf-dots" style="color:${cColor}">${stmt.confidence==="High"?"●●●":stmt.confidence==="Medium"?"●●○":"●○○"}</span>` : "";

    const windowHTML   = stmt?.windowSummary
      ? `<div class="rc-section"><div class="rc-label">⏱ Activation Window</div><div class="rc-window">${stmt.windowSummary}</div></div>` : "";
    const cautionsHTML = stmt?.cautions?.length
      ? `<div class="rc-section"><div class="rc-label">⚠ Caution${stmt.cautions.length>1?"s":""}</div>${stmt.cautions.map(c=>`<div class="rc-caution">${c}</div>`).join("")}</div>` : "";

    const yogas    = [...new Set((d.reasons||[]).filter(r=>r.startsWith("[YOGA]")).map(r=>r.replace("[YOGA] ","").split(":")[0].trim()))];
    const yogaHTML = yogas.length ? `<div class="rc-yoga-badges">${yogas.map(y=>`<span class="yoga-badge">★ ${y}</span>`).join("")}</div>` : "";

    card.innerHTML = `
      <div class="rc-header">
        <div class="rc-title">${d.title}</div>
        <div class="rc-verdict-wrap"><span class="rc-verdict ${vc}">${d.verdict}</span>${confDots}</div>
      </div>
      ${yogaHTML}
      ${stmt ? `
        <div class="rc-section"><div class="rc-label">Pattern</div><div class="rc-pattern">${stmt.pattern||""}</div></div>
        <div class="rc-section rc-indication-block"><div class="rc-label">Indication</div><div class="rc-indication">${stmt.indication||""}</div></div>
        ${windowHTML}${cautionsHTML}
        <div class="rc-confidence-line">Confidence: <strong style="color:${cColor}">${stmt.confidence}</strong><span class="rc-conf-reason"> — ${stmt.confidenceReason||""}</span></div>
      ` : `
        <div class="rc-section"><div class="rc-indication">${d.factorOverview||""}</div></div>
        <div class="rc-section"><div class="rc-caution">${d.flagLogic||""}</div></div>
      `}`;
    container.appendChild(card);
  });

  if (eventFlags?.length) {
    const block = document.getElementById("eventFlagsBlock");
    const grid  = document.getElementById("eventFlagsGrid");
    block.classList.remove("hidden");
    grid.innerHTML = eventFlags.map(flag => {
      const confColor = { High:"var(--stable)", Medium:"var(--accent-gold)", Low:"var(--vuln)" };
      const cc = confColor[flag.confidence] || "var(--text-muted)";
      const domainLabel = flag.domain ? `<span class="ef-domain-tag">${flag.domain}</span>` : `<span class="ef-domain-tag ef-cross">Chart-level</span>`;
      const windowLine  = flag.windowLords?.length ? `<div class="ef-window">Activates during: ${flag.windowLords.join(", ")} dasha</div>` : "";
      return `<div class="ef-card">
        <div class="ef-card-header">${domainLabel}<span class="ef-conf" style="color:${cc}">${flag.confidence}</span></div>
        <div class="ef-card-title">${flag.title}</div>
        <div class="ef-card-indication">${flag.indication}</div>
        ${flag.caution?`<div class="ef-card-caution">⚠ ${flag.caution}</div>`:""}
        ${windowLine}
      </div>`;
    }).join("");
  }

  const { compoundPatterns } = analysis;
  if (compoundPatterns?.length) {
    const cpBlock = document.getElementById("compoundPatternsBlock");
    const cpGrid  = document.getElementById("compoundPatternsGrid");
    if (cpBlock && cpGrid) {
      cpBlock.classList.remove("hidden");
      cpGrid.innerHTML = compoundPatterns.map(p => {
        const confColor = { High:"var(--stable)", Medium:"var(--accent-gold)", Low:"var(--vuln)" };
        const cc       = confColor[p.confidence] || "var(--text-muted)";
        const icon     = p.risk_note?"⚡":p.sensitivity_note?"◈":p.stability_note?"✦":"◉";
        const tagClass = p.risk_note?"cp-tag-risk":p.sensitivity_note?"cp-tag-sensitive":p.stability_note?"cp-tag-stable":"cp-tag-neutral";
        const tagText  = p.risk_note?"Risk signal":p.sensitivity_note?"Sensitive":p.stability_note?"Positive":"Pattern";
        const windowLine = p.windowLords?.length ? `<div class="cp-window">Activation: ${p.windowLords.join(" → ")} dasha</div>` : "";
        const condBar = `<div class="cp-cond-bar" title="${p.conditionsMet} of ${p.totalConditions} indicators present">
          ${Array.from({length:p.totalConditions},(_,i)=>`<span class="cp-cond-dot ${i<p.conditionsMet?"cp-cond-on":"cp-cond-off"}"></span>`).join("")}
          <span class="cp-cond-label">${p.conditionsMet}/${p.totalConditions} indicators</span></div>`;
        return `<div class="cp-card ${p.risk_note?"cp-risk":p.stability_note?"cp-stable":""}">
          <div class="cp-card-header"><span class="cp-icon">${icon}</span><span class="cp-domain-tag ${tagClass}">${tagText} · ${p.domain||"Chart-level"}</span><span class="cp-conf" style="color:${cc}">${p.confidence}</span></div>
          <div class="cp-card-title">${p.title}</div>${condBar}
          <div class="cp-indication">${p.indication}</div>
          ${p.caution?`<div class="cp-caution">⚠ ${p.caution}</div>`:""}
          ${windowLine}</div>`;
      }).join("");
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUMMARY SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function renderSummaryScreen(analysis, chart) {
  const { summary, domains } = analysis;
  const { dasha, d1 } = chart;

  document.getElementById("summaryOverall").innerHTML = `
    <div class="card-title">Overall chart pattern</div>
    <div class="so-pattern">${summary?.overallPattern||""}</div>`;

  document.getElementById("summaryEarlyText").textContent = summary?.earlyLife  || "";
  document.getElementById("summaryLaterText").textContent = summary?.laterLife  || "";

  const allYogas = [];
  (domains||[]).forEach(d => {
    (d.reasons||[]).filter(r=>r.startsWith("[YOGA]")).forEach(r => {
      const text = r.replace("[YOGA] ","");
      const name = text.split(":")[0].trim();
      if (!allYogas.find(y=>y.name===name)) allYogas.push({ name, reason: text });
    });
  });
  const yogaList = document.getElementById("summaryYogasList");
  yogaList.innerHTML = allYogas.length
    ? allYogas.map(y=>`<div class="yoga-item"><div><div class="yoga-name">★ ${y.name}</div><div class="yoga-reason">${y.reason}</div></div></div>`).join("")
    : `<div class="card-body">No major yogas detected in this chart.</div>`;

  const today = new Date().toISOString().split("T")[0];
  let currentMaha = null, currentAntar = null;
  if (dasha?.dashas) {
    for (const d of dasha.dashas) {
      if (d.startDate <= today && today < d.endDate) {
        currentMaha = d;
        for (const a of d.antarDasas||[]) {
          if (a.startDate <= today && today < a.endDate) { currentAntar = a; break; }
        }
        break;
      }
    }
  }
  const dashaEl = document.getElementById("summaryDashaText");
  if (currentMaha && d1?.lagnaSign) {
    const fs = FUNCTIONAL_STATUS_MAP[d1.lagnaSign]?.[currentMaha.lord] || "N";
    const fsDesc = fs==="Y"?"a yogakaraka — a uniquely powerful season for your lagna."
                 : fs==="B"?"a functional benefic — this season generally supports growth."
                 : fs==="M"?"a functional malefic — this season may bring tests that require patience."
                 : "functionally neutral — results shaped by sub-periods and transits.";
    const antarDesc = currentAntar ? ` Within this, the ${currentAntar.lord} Antar Dasa (ending ${currentAntar.endDate}) colours the events unfolding right now.` : "";
    dashaEl.innerHTML = `<div class="card-body">You are currently in the <strong>${currentMaha.lord} Maha Dasa</strong>, running until ${currentMaha.endDate}. ${currentMaha.lord} is ${fsDesc}${antarDesc}</div>`;
  } else {
    dashaEl.innerHTML = `<div class="card-body">Generate a chart to see your current dasha reading.</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PLANET SCREEN — Phase 2 redesign: D1 vs D9 side-by-side comparison
// ══════════════════════════════════════════════════════════════════════════════

function renderPlanetScreen(data) {
  const { planets, d1, d9 } = data;
  if (!planets) return;

  const lagna       = d1.lagnaSign;
  const combust     = buildCombustSet(planets);
  const warLosers   = buildWarSet(planets);
  const d1HouseMap  = buildPlanetHouseMap(d1.houses);
  const d9HouseMap  = buildPlanetHouseMap(d9?.houses || {});
  const container   = document.getElementById("planetCards");
  container.innerHTML = "";

  PLANET_LIST.forEach(planet => {
    const p = planets[planet];
    if (!p) return;

    // D1 data
    const d1Sign     = p.sign;
    const d1House    = d1HouseMap[planet] || "?";
    const d1Dignity  = getDignity(planet, d1Sign);
    const d1Lord     = SIGN_LORD[d1Sign];
    const d1Rel      = getRelationshipTag(d1Lord, planet);

    // D9 data
    const d9Sign     = p.d9sign || "—";
    const d9House    = d9HouseMap[planet] || "?";
    const d9Dignity  = d9Sign !== "—" ? getDignity(planet, d9Sign) : "";
    const d9Lord     = SIGN_LORD[d9Sign] || "—";
    const d9Rel      = d9Lord !== "—" ? getRelationshipTag(d9Lord, planet) : null;

    // Vargottama check (same sign in D1 and D9)
    const isVargottama = d9Sign !== "—" && d1Sign === d9Sign;

    const isRetro = p.retrograde;
    const isC     = combust.has(planet);
    const isW     = warLosers.has(planet);
    const fs      = FUNCTIONAL_STATUS_MAP[lagna]?.[planet] || "N";

    const dignityLabel   = (dig) => dig==="ex"?"Exalted":dig==="de"?"Debilitated":dig==="own"?"Own sign":"—";
    const dignityClass   = (dig) => dig==="ex"?"exalted":dig==="de"?"debilitated":dig==="own"?"own":"";
    const relLabel       = (rel) => rel==="F"?"Friend":rel==="E"?"Enemy":rel==="N"?"Neutral":"—";
    const relClass       = (rel) => rel==="F"?"rel-friend":rel==="E"?"rel-enemy":"rel-neutral";
    const fsLabel        = fs==="Y"?"Yogakaraka ★":fs==="B"?"Benefic":fs==="M"?"Malefic":"Neutral";
    const fsClass        = fs==="Y"?"yogakaraka":fs==="M"?"pc-malefic":"";

    const card = document.createElement("div");
    card.className = "planet-card-v2";
    card.innerHTML = `
      <div class="pc2-header">
        <div class="pc2-glyph">${PLANET_GLYPHS_FULL[planet]||""}</div>
        <div class="pc2-name">${planet}</div>
        <div class="pc2-meta">
          <span class="pc2-tag ${fsClass}">${fsLabel}</span>
          ${isVargottama?`<span class="pc2-tag pc2-vg" title="Same sign in D1 and D9 — planet is strengthened">Vargottama</span>`:""}
          ${isRetro?`<span class="pc2-tag pc2-retro">Retrograde ℞</span>`:""}
          ${isC?`<span class="pc2-tag pc2-combust">Combust ☀</span>`:""}
          ${isW?`<span class="pc2-tag pc2-war">War ⚔</span>`:""}
        </div>
      </div>

      <div class="pc2-grid">
        <div class="pc2-col">
          <div class="pc2-col-label">D1 — Birth Chart</div>
          <div class="pc2-row"><span class="pc2-k">Sign</span><span class="pc2-v">${d1Sign}</span></div>
          <div class="pc2-row"><span class="pc2-k">House</span><span class="pc2-v">H${d1House}</span></div>
          <div class="pc2-row"><span class="pc2-k">Degree</span><span class="pc2-v">${p.degree?.toFixed(1)}°</span></div>
          <div class="pc2-row"><span class="pc2-k">Nakshatra</span><span class="pc2-v">${p.nakshatra} P${p.pada}</span></div>
          <div class="pc2-row"><span class="pc2-k">Dignity</span><span class="pc2-v ${dignityClass(d1Dignity)}">${dignityLabel(d1Dignity)}</span></div>
          <div class="pc2-row"><span class="pc2-k">Lord relation</span><span class="pc2-v ${relClass(d1Rel)}">${relLabel(d1Rel)}</span></div>
        </div>

        <div class="pc2-divider"></div>

        <div class="pc2-col">
          <div class="pc2-col-label">D9 — Navamsha</div>
          <div class="pc2-row"><span class="pc2-k">Sign</span><span class="pc2-v">${d9Sign}</span></div>
          <div class="pc2-row"><span class="pc2-k">House</span><span class="pc2-v">${d9House !== "?" ? "H"+d9House : "—"}</span></div>
          <div class="pc2-row"><span class="pc2-k">Dignity</span><span class="pc2-v ${dignityClass(d9Dignity)}">${dignityLabel(d9Dignity)}</span></div>
          <div class="pc2-row"><span class="pc2-k">Lord relation</span><span class="pc2-v ${relClass(d9Rel)}">${relLabel(d9Rel)}</span></div>
          <div class="pc2-row"><span class="pc2-k">Vargottama</span><span class="pc2-v ${isVargottama?"pc2-vg-val":""}">${isVargottama?"Yes — strengthened":"No"}</span></div>
        </div>
      </div>

      <div class="pc2-reading">
        ${buildPlanetReading(planet, d1Sign, d1House, d1Dignity, d9Sign, d9Dignity, isVargottama, fs)}
      </div>
    `;
    container.appendChild(card);
  });
}

// Generates a 1-2 line plain-English reading for each planet card
function buildPlanetReading(planet, d1Sign, d1House, d1Dignity, d9Sign, d9Dignity, isVargottama, fs) {
  const parts = [];

  // D1 strength summary
  if (d1Dignity === "ex")       parts.push(`${planet} is exalted in ${d1Sign} — at its peak strength in the birth chart.`);
  else if (d1Dignity === "de")  parts.push(`${planet} is debilitated in ${d1Sign} — its natural qualities are suppressed and require conscious effort to express.`);
  else if (d1Dignity === "own") parts.push(`${planet} is in its own sign ${d1Sign} — comfortable and expressive in house ${d1House}.`);
  else                           parts.push(`${planet} is in ${d1Sign} in house ${d1House}.`);

  // D9 modifier
  if (isVargottama)              parts.push("Being Vargottama (same sign in D1 and D9), this placement carries exceptional potency that deepens with age.");
  else if (d9Dignity === "ex")   parts.push("The D9 shows exaltation — this planet's promise strengthens in the second half of life.");
  else if (d9Dignity === "de")   parts.push("The D9 shows debilitation — early D1 promise may not sustain through maturity.");
  else if (d9Dignity === "own")  parts.push("The D9 shows own sign — the planet is stable and its themes mature consistently.");

  // Functional status note
  if (fs === "Y") parts.push("As a yogakaraka for this lagna, it holds special elevating power.");
  else if (fs === "M") parts.push("As a functional malefic for this lagna, its dasha periods require careful navigation.");

  return parts.slice(0,2).join(" ");
}

// ══════════════════════════════════════════════════════════════════════════════
//  LOCAL STORAGE — SAVE / HISTORY
// ══════════════════════════════════════════════════════════════════════════════

function saveInputs() {
  const f = getForm();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

function restoreInputs() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  let s;
  try { s = JSON.parse(raw); }
  catch { localStorage.removeItem(STORAGE_KEY); return; }

  const set = (id, v) => { const el=document.getElementById(id); if(el&&v) el.value=v; };
  set("inputName", s.name);
  set("inputDOB",  s.dob);
  set("inputTOB",  s.tob);

  if (isValidPlaceRecord(s)) {
    const plDisp   = document.getElementById("inputPlaceDisplay");
    const plSearch = document.getElementById("inputPlaceSearch");
    const clearBtn = document.getElementById("placeClearBtn");
    if (plDisp)   plDisp.value = s.place;
    const shortName = s.place.split(",").slice(0,3).join(",").trim();
    if (plSearch) { _suppressSearch=true; plSearch.value=shortName; _suppressSearch=false; }
    if (clearBtn) clearBtn.style.display = "inline-flex";
    _selectedPlace = { displayName:s.place, lat:parseFloat(s.lat), lng:parseFloat(s.lng), country:s.country||"", shortName, utcOffset:s.utcOffset!=null?parseFloat(s.utcOffset):(CLIENT_TZ[s.country]??null) };
    showPlaceConfirmed(shortName, _selectedPlace.utcOffset);
  }
}

function getHistory() {
  try { const r=localStorage.getItem(HISTORY_KEY); return r?JSON.parse(r):[]; } catch { return []; }
}

function saveToHistory() {
  if (!currentData) return;
  const f = currentData.form, c = currentData.chart;
  const entry = { id:Date.now().toString(), name:f.name||"Unnamed", savedAt:new Date().toISOString(), dob:f.dob, tob:f.tob, place:f.place, country:_selectedPlace?.country||"", utcOffset:f.utcOffset, lat:f.lat, lng:f.lng, d1Lagna:c.d1?.lagnaSign||"", d9Lagna:c.d9?.lagnaSign||"" };
  const hist = getHistory();
  hist.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0,25)));
  renderHistory();
}

function renderHistory() {
  const box  = document.getElementById("historyBox");
  const hist = getHistory();
  if (!hist.length) { box.className="history-empty"; box.textContent="No saved charts yet."; return; }
  box.className="";
  box.innerHTML = hist.map(h => `
    <div class="history-item">
      <div class="history-main">
        <div class="history-name">${h.name}</div>
        <div class="history-meta">${h.dob} · ${h.tob} · ${h.place}</div>
        <div class="history-meta">D1: ${h.d1Lagna} · D9: ${h.d9Lagna} · Saved ${new Date(h.savedAt).toLocaleDateString()}</div>
      </div>
      <div class="history-actions">
        <button class="btn-sm-ghost hist-load" data-id="${h.id}">Load</button>
        <button class="btn-sm-danger hist-del" data-id="${h.id}">×</button>
      </div>
    </div>`).join("");
  box.querySelectorAll(".hist-load").forEach(btn => btn.addEventListener("click", () => loadHistory(btn.dataset.id)));
  box.querySelectorAll(".hist-del").forEach(btn => btn.addEventListener("click", () => deleteHistory(btn.dataset.id)));
}

function loadHistory(id) {
  const h = getHistory().find(x=>x.id===id);
  if (!h) return;
  const set=(el,v)=>{ if(el&&v!=null) el.value=v; };
  set(document.getElementById("inputName"), h.name);
  set(document.getElementById("inputDOB"),  h.dob);
  set(document.getElementById("inputTOB"),  h.tob);
  if (isValidPlaceRecord(h)) {
    const plDisp=document.getElementById("inputPlaceDisplay"), plSearch=document.getElementById("inputPlaceSearch"), clearBtn=document.getElementById("placeClearBtn");
    if (plDisp) plDisp.value=h.place;
    const shortName=h.place.split(",").slice(0,3).join(",").trim();
    if (plSearch) { _suppressSearch=true; plSearch.value=shortName; _suppressSearch=false; }
    if (clearBtn) clearBtn.style.display="inline-flex";
    _selectedPlace={ displayName:h.place, lat:parseFloat(h.lat), lng:parseFloat(h.lng), country:h.country||"", shortName, utcOffset:h.utcOffset!=null?parseFloat(h.utcOffset):(CLIENT_TZ[h.country]??null) };
    showPlaceConfirmed(shortName, _selectedPlace.utcOffset);
  }
  saveInputs();
}

function deleteHistory(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(x=>x.id!==id)));
  renderHistory();
}

// ── Button events ─────────────────────────────────────────────────────────────
saveBtn.addEventListener("click", () => {
  saveInputs(); saveToHistory();
  const txt=saveBtn.textContent; saveBtn.textContent="Saved ✓";
  setTimeout(()=>saveBtn.textContent=txt,1400);
});

resetBtn.addEventListener("click", () => {
  if (confirm("Reset all inputs and clear current chart?")) { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }
});

dlBtn.addEventListener("click", () => {
  if (!currentData) return;
  const html = buildHTMLReport(currentData);
  const blob  = new Blob(["\uFEFF",html], { type:"application/msword" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href=url; a.download=`jyotish-${currentData.form?.name||"chart"}-${currentData.form?.dob||"report"}.doc`;
  a.click(); URL.revokeObjectURL(url);
});

function buildHTMLReport(data) {
  const { chart, analysis, form } = data;
  const { summary, domains } = analysis;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>Jyotish Report</title>
  <style>body{font-family:Arial,sans-serif;color:#222;line-height:1.6}h1,h2,h3{color:#1a2a4a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#f0f4fa}.yoga{color:#7a5b00;font-style:italic}.disclaimer{font-size:11px;color:#888;border-top:1px solid #ccc;margin-top:40px;padding-top:12px}</style>
  </head><body>
  <h1>Jyotish Precision Analyzer — Birth Chart Report</h1>
  <p><strong>Native:</strong> ${form.name||"—"} &nbsp;|&nbsp; <strong>DOB:</strong> ${form.dob} &nbsp;|&nbsp; <strong>TOB:</strong> ${form.tob} &nbsp;|&nbsp; <strong>Place:</strong> ${form.place}</p>
  <p><strong>D1 Lagna:</strong> ${chart.d1?.lagnaSign} &nbsp;|&nbsp; <strong>D9 Lagna:</strong> ${chart.d9?.lagnaSign} &nbsp;|&nbsp; <strong>Ayanamsha:</strong> Lahiri ${chart.ayanamsha}°</p>
  <h2>Summary</h2><p>${summary?.overallPattern}</p><p>${summary?.earlyLife}</p><p>${summary?.laterLife}</p>
  <h2>Domain Analysis</h2>
  <table><tr><th>Domain</th><th>D1</th><th>D9</th><th>Verdict</th></tr>
  ${(domains||[]).map(d=>`<tr><td>${d.title}</td><td>${d.d1Strength}</td><td>${d.d9Strength}</td><td>${d.verdict}</td></tr>`).join("")}</table>
  ${(domains||[]).map(d=>`<h3>${d.title}</h3><p><strong>Verdict:</strong> ${d.verdict}</p><p>${d.factorOverview}</p><ul>${(d.reasons||[]).map(r=>`<li${r.startsWith("[YOGA]")?' class="yoga"':''}>${r.replace(/^\[.+?\] /,"")}</li>`).join("")}</ul>`).join("")}
  <div class="disclaimer"><strong>Disclaimer:</strong> This report provides astrological analysis for educational and self-reflective purposes only. Not a substitute for medical, psychological, legal, or financial advice.<br>Generated by Jyotish Precision Analyzer · Swiss Ephemeris · Lahiri Ayanamsha · © 2025 All rights reserved.</div>
  </body></html>`;
}

// ── Auto-save ─────────────────────────────────────────────────────────────────
document.querySelectorAll("input,select").forEach(el => {
  el.addEventListener("change", saveInputs);
  el.addEventListener("input",  saveInputs);
});

// ── City search ───────────────────────────────────────────────────────────────
function initCitySearch() {
  const input=document.getElementById("inputPlaceSearch"), dropdown=document.getElementById("placeDropdown"), display=document.getElementById("inputPlaceDisplay"), clearBtn=document.getElementById("placeClearBtn"), utcEl=document.getElementById("detectedUTC");
  if (!input||!dropdown) return;

  input.addEventListener("input", () => {
    if (_suppressSearch) return;
    const q=input.value.trim(); clearTimeout(_searchTimer);
    if (q.length<2) { dropdown.innerHTML=""; dropdown.style.display="none"; return; }
    _searchTimer=setTimeout(()=>fetchCitySuggestions(q),320);
  });

  input.addEventListener("keydown", e => {
    const items=dropdown.querySelectorAll(".place-item"), active=dropdown.querySelector(".place-item.active");
    if (e.key==="ArrowDown") { e.preventDefault(); const next=active?active.nextElementSibling:items[0]; if(next){active?.classList.remove("active");next.classList.add("active");} }
    else if (e.key==="ArrowUp") { e.preventDefault(); const prev=active?active.previousElementSibling:items[items.length-1]; if(prev){active?.classList.remove("active");prev.classList.add("active");} }
    else if (e.key==="Enter"&&active) { e.preventDefault(); active.click(); }
    else if (e.key==="Escape") dropdown.style.display="none";
  });

  document.addEventListener("click", e => { if (!e.target.closest(".place-search-wrap")) dropdown.style.display="none"; });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      _selectedPlace=null;
      if(input) input.value=""; if(display) display.value=""; if(utcEl) utcEl.textContent="";
      clearBtn.style.display="none"; dropdown.innerHTML=""; dropdown.style.display="none"; input.focus();
    });
  }
}

async function fetchCitySuggestions(query) {
  const dropdown=document.getElementById("placeDropdown");
  if (!dropdown) return;
  dropdown.innerHTML=`<div class="place-item place-loading">Searching...</div>`;
  dropdown.style.display="block";
  try {
    const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&accept-language=en`;
    const res=await fetch(url,{headers:{"User-Agent":"JyotishPrecisionApp/3.2 (astrology chart calculator)"}});
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data=await res.json();
    if (!data||!data.length) { dropdown.innerHTML=`<div class="place-item place-no-result">No cities found. Try a different spelling.</div>`; return; }
    const places=data.map(r=>({ lat:parseFloat(r.lat), lng:parseFloat(r.lon), displayName:r.display_name, shortName:[r.address?.city||r.address?.town||r.address?.village||r.name,r.address?.state,r.address?.country].filter(Boolean).join(", "), country:(r.address?.country_code||"").toUpperCase() }));
    const validPlaces=places.filter(r=>isFinite(r.lat)&&isFinite(r.lng)&&!(r.lat===0&&r.lng===0));
    if (!validPlaces.length) { dropdown.innerHTML=`<div class="place-item place-no-result">No valid locations found.</div>`; return; }
    dropdown.innerHTML=validPlaces.map((r,i)=>`<div class="place-item" data-idx="${i}" data-lat="${r.lat}" data-lng="${r.lng}" data-name="${(r.displayName||"").replace(/"/g,"&quot;")}" data-short="${(r.shortName||"").replace(/"/g,"&quot;")}" data-country="${(r.country||"").toUpperCase()}"><span class="pi-name">${r.shortName||r.displayName}</span><span class="pi-country">${r.country||""}</span></div>`).join("");
    dropdown.style.display="block";
    dropdown.querySelectorAll(".place-item[data-lat]").forEach(item=>item.addEventListener("click",()=>selectPlace(item)));
  } catch(e) {
    dropdown.innerHTML=`<div class="place-item place-no-result">Could not reach location service. Try again in a moment.</div>`;
    console.warn("City search error:", e.message);
  }
}

async function selectPlace(item) {
  const dropdown=document.getElementById("placeDropdown"), input=document.getElementById("inputPlaceSearch"), display=document.getElementById("inputPlaceDisplay"), clearBtn=document.getElementById("placeClearBtn");
  const lat=parseFloat(item.dataset.lat), lng=parseFloat(item.dataset.lng), name=item.dataset.name, short=item.dataset.short, country=(item.dataset.country||"").toUpperCase();
  if (!isFinite(lat)||!isFinite(lng)) { console.warn("Invalid coords"); return; }
  const utcOffset=CLIENT_TZ[country]??null;
  _selectedPlace={ displayName:name, shortName:short, lat, lng, country, utcOffset };
  if(input) input.value=short; if(display) display.value=name; if(clearBtn) clearBtn.style.display="inline-flex";
  showPlaceConfirmed(short,utcOffset);
  dropdown.innerHTML=""; dropdown.style.display="none";
  saveInputs();
}

function showPlaceConfirmed(name, utcOffset) {
  const utcEl=document.getElementById("detectedUTC");
  if (!utcEl) return;
  const offsetStr=utcOffset!=null?`GMT${utcOffset>=0?"+":""}${utcOffset}`:"GMT offset unknown";
  utcEl.innerHTML=`<span class="utc-ok">✓ ${name}</span> <span class="utc-offset">${offsetStr}</span>`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  PHASE 4a — HEALTH REPORT ENGINE (Layers 1, 2, 3)
//  Dr. K.S. Charak medical astrology framework — Parashari rules
// ══════════════════════════════════════════════════════════════════════════════

// ── Layer 3: House → body zone mapping ───────────────────────────────────────
const HEALTH_HOUSE_ZONES = {
  1:  { zone:"Head & General Vitality",          organs:"skull, brain, eyes, face, and overall constitutional strength" },
  2:  { zone:"Right Eye, Face & Throat",         organs:"right eye, nose, teeth, tongue, throat, and speech organs" },
  3:  { zone:"Shoulders, Arms & Upper Chest",    organs:"shoulders, arms, right ear, upper chest, and windpipe" },
  4:  { zone:"Chest & Lungs",                    organs:"chest, lungs, breast tissue, and heart (outer)" },
  5:  { zone:"Upper Abdomen & Spine",            organs:"stomach, upper digestive tract, spine (upper), and heart (inner)" },
  6:  { zone:"Waist, Kidneys & Intestines",      organs:"kidneys, small intestine, large intestine, and lower back" },
  7:  { zone:"Pelvic Region & Reproductive",     organs:"reproductive organs, uterus/ovaries or prostate, and bladder" },
  8:  { zone:"Excretory Organs & Colon",         organs:"colon, rectum, anus, and external reproductive organs" },
  9:  { zone:"Hips & Thighs",                   organs:"hips, thighs, and sciatic nerve" },
  10: { zone:"Knees & Skeletal Joints",          organs:"knees, kneecap, and major skeletal joints" },
  11: { zone:"Lower Legs & Circulatory System",  organs:"calves, ankles, left ear, and circulatory system" },
  12: { zone:"Feet, Left Eye & Lymphatic",       organs:"feet, left eye, and lymphatic system" },
};

// Kalapurusha (natural zodiac) house → body part for triple-convergence check
const KALAPURUSHA_ZONE = {
  Aries:"head", Taurus:"face and throat", Gemini:"shoulders and arms",
  Cancer:"chest and lungs", Leo:"heart and spine", Virgo:"abdomen and intestines",
  Libra:"kidneys and lower back", Scorpio:"reproductive organs",
  Sagittarius:"hips and thighs", Capricorn:"knees and joints",
  Aquarius:"lower legs and circulatory", Pisces:"feet and lymphatic",
};

// Layer 3: Planet natural body rulerships
const HEALTH_PLANET_BODY = {
  Sun:     { areas:"heart, spine, right eye, and vital force",      diseases:["cardiac","eye conditions","fever","vitality disorders"] },
  Moon:    { areas:"mind, left eye, chest, lungs, and blood",       diseases:["mental health","respiratory","blood disorders","water retention"] },
  Mars:    { areas:"blood, muscles, and bone marrow",               diseases:["inflammatory","accidents","surgical","blood disorders"] },
  Mercury: { areas:"nervous system, skin, and speech organs",       diseases:["neurological","skin conditions","respiratory","speech disorders"] },
  Jupiter: { areas:"liver, fat tissue, and arterial system",        diseases:["liver","diabetes","obesity","endocrine disorders"] },
  Venus:   { areas:"reproductive system, kidneys, and throat",      diseases:["reproductive","kidney","hormonal","throat conditions"] },
  Saturn:  { areas:"bones, joints, teeth, and nerves",              diseases:["chronic conditions","bone disorders","joint pain","nerve damage"] },
  Rahu:    { areas:"nervous system and skin",                       diseases:["chronic mysterious ailments","neurological","skin (chronic)"] },
  Ketu:    { areas:"wounds and hidden conditions",                  diseases:["mysterious ailments","surgical conditions","hidden diseases"] },
};

// Layer 2: Maraka house lords (H2 + H7) — classical death/serious illness inflictors
// Layer 2: Trika lords (H6/H8/H12) — disease, crisis, hospitalisation
// These are computed dynamically from lagna using SIGN_LORD and SIGNS_P3

function getHealthClassification(lagnaSign, houses, planets) {
  const lagnaIdx  = SIGNS_P3.indexOf(lagnaSign);
  const signLord  = SIGN_LORD; // reuse existing lookup

  // House to sign mapping for this lagna
  function houseSign(h) { return SIGNS_P3[(lagnaIdx + h - 1) % 12]; }
  function houseLord(h) { return signLord[houseSign(h)]; }
  function planetHouse(p) {
    for (let h=1; h<=12; h++) { if ((houses[h]||[]).includes(p)) return h; }
    return null;
  }

  // Layer 2 — Maraka planets (H2 + H7 lords)
  const marakaH2    = houseLord(2);
  const marakaH7    = houseLord(7);
  const marakas     = [...new Set([marakaH2, marakaH7].filter(Boolean))];

  // Trika lords (H6/H8/H12)
  const trikaH6     = houseLord(6);
  const trikaH8     = houseLord(8);
  const trikaH12    = houseLord(12);
  const trikas      = [...new Set([trikaH6, trikaH8, trikaH12].filter(Boolean))];

  // Functional status for each planet
  const FUNC = FUNCTIONAL_STATUS_MAP[lagnaSign] || {};

  // Layer 1 — Constitutional vitality
  // Factor A: Lagna lord placement
  const lagnaLord     = houseLord(1);
  const lagnaLordH    = planetHouse(lagnaLord);
  const lagnaLordSign = lagnaLordH ? houseSign(lagnaLordH) : null;
  const lagnaLordDig  = lagnaLordSign ? getDignity(lagnaLord, lagnaLordSign) : "";
  const lagnaLordDust = lagnaLordH && [6,8,12].includes(lagnaLordH);

  // Factor B: Moon condition
  const moonH    = planetHouse("Moon");
  const moonSign = moonH ? houseSign(moonH) : null;
  const moonDig  = moonSign ? getDignity("Moon", moonSign) : "";
  const moonFS   = FUNC["Moon"] || "N";
  const moonDust = moonH && [6,8,12].includes(moonH);

  // Factor C: Benefics in kendras (H1/4/7/10) — protective
  const kendras = [1,4,7,10];
  let beneficKendraCount = 0, maleficKendraCount = 0;
  PLANET_LIST.forEach(p => {
    const h  = planetHouse(p);
    if (!h || !kendras.includes(h)) return;
    const fs = FUNC[p] || "N";
    if (["B","Y"].includes(fs)) beneficKendraCount++;
    else if (fs === "M") maleficKendraCount++;
  });

  // Factor D: Malefics in upachayas (H3/6/10/11) — acceptable for malefics
  const upachayas = [3,6,10,11];
  let maleficUpachayaCount = 0;
  PLANET_LIST.forEach(p => {
    const h  = planetHouse(p);
    if (!h || !upachayas.includes(h)) return;
    const fs = FUNC[p] || "N";
    if (fs === "M") maleficUpachayaCount++;
  });

  // Score constitution
  let constitutionScore = 0;
  // Lagna lord
  if (lagnaLordDig === "ex")        constitutionScore += 3;
  else if (lagnaLordDig === "own")  constitutionScore += 2;
  else if (lagnaLordDig === "de")   constitutionScore -= 2;
  if (lagnaLordDust)                constitutionScore -= 2;
  else                              constitutionScore += 1;
  // Moon
  if (moonDig === "ex")             constitutionScore += 3;
  else if (moonDig === "own")       constitutionScore += 1;
  else if (moonDig === "de")        constitutionScore -= 2;
  if (moonFS === "M")               constitutionScore -= 1;
  if (moonDust)                     constitutionScore -= 1;
  // Kendras
  constitutionScore += beneficKendraCount * 1;
  constitutionScore -= Math.max(0, maleficKendraCount - maleficUpachayaCount) * 1;

  let constitution, constitutionExplain;
  if (constitutionScore >= 4) {
    constitution = "Robust";
    constitutionExplain = `Your lagna lord ${lagnaLord} is ${lagnaLordDig==="ex"?"exalted":lagnaLordDig==="own"?"in own sign":"well-placed"} and the Moon${moonDig==="ex"?" is exalted":moonDig==="own"?" is in own sign":""} — your constitutional vitality is strong. The body has good reserves and recovery capacity.`;
  } else if (constitutionScore >= 0) {
    constitution = "Moderate";
    constitutionExplain = `Your constitution is functional but not exceptional. ${lagnaLordDust?`The lagna lord ${lagnaLord} sits in H${lagnaLordH} (a dusthana), reducing constitutional strength.`:`The lagna lord ${lagnaLord} is moderately placed.`} ${moonDust?`The Moon in H${moonH} adds sensitivity to the mind-body connection.`:""} The body manages well under normal conditions but may need support during adverse dasha periods.`;
  } else {
    constitution = "Vulnerable";
    constitutionExplain = `The lagna lord ${lagnaLord}${lagnaLordDust?` is placed in H${lagnaLordH} (a dusthana house)`:"is under stress"} and the Moon${moonDig==="de"?" is debilitated":"is under pressure"} — your constitution requires deliberate and consistent maintenance. ${maleficKendraCount>1?`${maleficKendraCount} malefics occupy kendras, creating additional pressure on the physical body.`:""} This is not a weak chart overall, but health requires priority attention.`;
  }

  // Layer 3 — Body zone vulnerability
  const vulnerableZones = [];
  PLANET_LIST.forEach(p => {
    const h  = planetHouse(p);
    if (!h) return;
    const fs   = FUNC[p] || "N";
    const dig  = getDignity(p, houseSign(h));
    const combSet = buildCombustSet(planets);
    const isMalefic = fs === "M";
    const isAfflicted = isMalefic || dig === "de" || combSet.has(p);

    // Check if malefic sits in a house or lords an afflicted house
    if (isMalefic && HEALTH_HOUSE_ZONES[h]) {
      vulnerableZones.push({
        house: h,
        zone: HEALTH_HOUSE_ZONES[h].zone,
        organs: HEALTH_HOUSE_ZONES[h].organs,
        planet: p,
        reason: `${p} (functional malefic) sits in H${h}`,
        planetBody: HEALTH_PLANET_BODY[p]?.areas || "",
        diseases: HEALTH_PLANET_BODY[p]?.diseases || [],
        severity: (dig === "de" || combSet.has(p)) ? "high" : "medium",
      });
    }

    // Check if lord of a house is afflicted — flag that house's zone
    for (let vh=1; vh<=12; vh++) {
      if (houseLord(vh) === p && isAfflicted && vh !== h) {
        const reasonParts = [];
        if (isMalefic)       reasonParts.push("functional malefic");
        if (dig === "de")    reasonParts.push("debilitated");
        if (combSet.has(p))  reasonParts.push("combust");
        vulnerableZones.push({
          house: vh,
          zone: HEALTH_HOUSE_ZONES[vh]?.zone || `H${vh}`,
          organs: HEALTH_HOUSE_ZONES[vh]?.organs || "",
          planet: p,
          reason: `${p} lords H${vh} but is ${reasonParts.join(" and ")} in H${h}`,
          planetBody: HEALTH_PLANET_BODY[p]?.areas || "",
          diseases: HEALTH_PLANET_BODY[p]?.diseases || [],
          severity: (isMalefic && dig === "de") ? "high" : "medium",
        });
      }
    }
  });

  // Deduplicate by house — keep highest severity per house
  const zoneMap = new Map();
  vulnerableZones.forEach(z => {
    const existing = zoneMap.get(z.house);
    if (!existing || z.severity === "high") zoneMap.set(z.house, z);
  });
  const finalZones = [...zoneMap.values()].sort((a,b) => {
    if (a.severity==="high" && b.severity!=="high") return -1;
    if (b.severity==="high" && a.severity!=="high") return 1;
    return a.house - b.house;
  });

  return {
    constitution,
    constitutionScore,
    constitutionExplain,
    lagnaLord, lagnaLordH, lagnaLordDig, lagnaLordDust,
    moonH, moonDig, moonFS, moonDust,
    beneficKendraCount, maleficKendraCount,
    marakas, marakaH2, marakaH7,
    trikas, trikaH6, trikaH8, trikaH12,
    vulnerableZones: finalZones,
    houseSign, houseLord, planetHouse,
    lagnaIdx,
  };
}

// ── Special disease indicators (Layers 4b preview) ───────────────────────────
// Used for the indicator strip at the bottom of the report
function computeHealthIndicators(lagnaSign, houses, planets, d9Houses) {
  const FUNC = FUNCTIONAL_STATUS_MAP[lagnaSign] || {};
  const lagnaIdx = SIGNS_P3.indexOf(lagnaSign);
  function hSign(h) { return SIGNS_P3[(lagnaIdx + h - 1) % 12]; }
  function hLord(h) { return SIGN_LORD[hSign(h)]; }
  function pH(p, ch) {
    const src = ch || houses;
    for (let i=1; i<=12; i++) { if ((src[i]||[]).includes(p)) return i; }
    return null;
  }
  const comb = buildCombustSet(planets);

  // Diabetes indicators: Jupiter afflicted + Venus H6/H8 + H6/H8 lord in H2 or H11
  const jupH   = pH("Jupiter");
  const jupDig = jupH ? getDignity("Jupiter", hSign(jupH)) : "";
  const venH   = pH("Venus");
  const jupAfflicted = jupDig==="de" || comb.has("Jupiter") || FUNC["Jupiter"]==="M";
  const venDust = venH && [6,8,12].includes(venH);
  const h6lH   = pH(hLord(6));
  const diabetesFactors = [
    jupAfflicted && "Jupiter (natural karaka for fat/sugar metabolism) is afflicted",
    venDust && `Venus sits in H${venH} — kidney-pancreas connection under stress`,
    h6lH && [2,11].includes(h6lH) && `H6 lord in H${h6lH} — disease-wealth axis activated`,
  ].filter(Boolean);

  // Heart indicators: Sun afflicted + H4 lord in dusthana + Leo sign afflicted
  const sunH   = pH("Sun");
  const sunDig = sunH ? getDignity("Sun", hSign(sunH)) : "";
  const sunAfflicted = sunDig==="de" || comb.has("Sun") || (sunH && [6,8,12].includes(sunH));
  const h4lH   = pH(hLord(4));
  const h4lDust = h4lH && [6,8,12].includes(h4lH);
  const leoPlanets = Object.values(houses).flat().filter(p => hSign(pH(p)||0)==="Leo");
  const heartFactors = [
    sunAfflicted && `Sun (natural karaka for heart) ${sunDig==="de"?"is debilitated":comb.has("Sun")?"is combust":`sits in H${sunH}`}`,
    h4lDust && `H4 (heart house) lord in H${h4lH} — cardiac house under stress`,
    leoPlanets.filter(p=>FUNC[p]==="M").length>0 && "Malefics in or aspecting the Leo-ruled zone",
  ].filter(Boolean);

  // Cancer indicators: 64th Navamsha sensitivity (H4 from Moon in D9) + H8/H12 triple activation
  const moonH     = pH("Moon");
  const moonD9H   = pH("Moon", d9Houses);
  // H4 from Moon in D9 = the 64th Navamsha indicator
  const d9MoonFrom4 = moonD9H ? ((moonD9H - 1 + 3) % 12) + 1 : null; // 4th from Moon's D9 house
  const d9Zone4Lord = d9MoonFrom4 ? hLord(d9MoonFrom4) : null;
  const h8lord  = hLord(8);
  const h12lord = hLord(12);
  const h8lH    = pH(h8lord);
  const h12lH   = pH(h12lord);
  const cancerFactors = [
    d9MoonFrom4 && `64th Navamsha (H${d9MoonFrom4} from Moon in D9) — classical cancer sensitivity marker`,
    h8lH && [6,8,12].includes(h8lH) && `H8 lord in dusthana H${h8lH} — chronic/hidden disease axis`,
    h12lH && [6,8].includes(h12lH) && `H12 lord in H${h12lH} — hospitalisation axis activated`,
    FUNC["Rahu"]==="M" && pH("Rahu") && [4,5].includes(pH("Rahu")) && "Rahu in H4/H5 — classical lymphatic/blood cancer indicator",
  ].filter(Boolean);

  // Surgery indicators: Mars H8 + H6 lord in H8 + Saturn-Mars combination
  const marsH   = pH("Mars");
  const marsDig = marsH ? getDignity("Mars", hSign(marsH)) : "";
  const satH    = pH("Saturn");
  const h6lH2   = pH(hLord(6));
  const surgeryFactors = [
    marsH && [6,8,12].includes(marsH) && `Mars in H${marsH} — surgical house activation`,
    h6lH2 && h6lH2===8 && "H6 lord in H8 — disease lord in surgery house",
    marsH && satH && Math.abs((marsH-satH+12)%12) <= 1 && "Mars-Saturn conjunction — surgical intervention indicator",
    marsDig==="de" && "Mars debilitated — injury and surgical risk elevated",
  ].filter(Boolean);

  // Neurological/cognitive sensitivity: Mercury-Moon affliction + Rahu H3/H4/H5
  const mercH   = pH("Mercury");
  const mercDig = mercH ? getDignity("Mercury", hSign(mercH)) : "";
  const rahuH   = pH("Rahu");
  const mercAfflicted = mercDig==="de" || comb.has("Mercury") || (mercH && [6,8,12].includes(mercH));
  const moonAfflicted = moonH && ([6,8,12].includes(moonH) || FUNC["Moon"]==="M");
  const neuroFactors = [
    mercAfflicted && `Mercury (nervous system karaka) ${mercDig==="de"?"debilitated":comb.has("Mercury")?"combust":"in dusthana"}`,
    moonAfflicted && `Moon ${moonH&&[6,8,12].includes(moonH)?`in H${moonH} (dusthana)`:"afflicted"} — mental-nervous sensitivity`,
    rahuH && [3,4,5].includes(rahuH) && `Rahu in H${rahuH} — neurological and cognitive sensitivity indicator`,
  ].filter(Boolean);

  // Over-indulgence: Venus/Moon/Rahu in pleasure houses + H2 afflicted
  const h2Planets = houses[2] || [];
  const rahuVenConj = rahuH && rahuH===venH;
  const rahuMoonConj = rahuH && rahuH===moonH;
  const indulgeFactors = [
    rahuH && [1,2,5,7].includes(rahuH) && `Rahu in H${rahuH} — amplifies sensory and pleasure-seeking impulses`,
    rahuVenConj && "Rahu-Venus conjunction — excess in relationship and sensory pleasures",
    rahuMoonConj && "Rahu-Moon conjunction — emotional excess and addictive emotional patterns",
    h2Planets.includes("Saturn") && "Saturn in H2 — over-indulgence as compensatory behaviour for early deprivation",
    jupDig==="de" && "Jupiter debilitated — weakened wisdom and restraint faculty",
  ].filter(Boolean);

  // Overall protection: benefics in kendras + Jupiter strong + lagna lord strong
  const protFactors = [];
  const jupBenefic = !jupAfflicted && jupH && [1,4,5,7,9,10].includes(jupH);
  if (jupBenefic) protFactors.push(`Jupiter in H${jupH} — natural protective grace on the chart`);
  if (!lagnaIdx && FUNC[hLord(1)]==="B") protFactors.push("Lagna lord is a functional benefic — constitutional support");
  const jupD9H = pH("Jupiter", d9Houses);
  const jupD9Dig = jupD9H ? getDignity("Jupiter", hSign(jupD9H)) : "";
  if (jupD9Dig==="ex"||jupD9Dig==="own") protFactors.push("Jupiter strong in D9 — protection deepens with age");
  if (beneficKendraCount(lagnaSign, houses) >= 2) protFactors.push(`${beneficKendraCount(lagnaSign, houses)} benefics in kendras — structural protection on the health axis`);

  function beneficKendraCount(lagna, h) {
    let c=0;
    const F = FUNCTIONAL_STATUS_MAP[lagna]||{};
    PLANET_LIST.forEach(p=>{ const ph2=pH(p); if(ph2&&[1,4,7,10].includes(ph2)&&["B","Y"].includes(F[p]))c++; });
    return c;
  }

  // Score each indicator: High / Moderate / Low / None
  function scoreLevel(factors) {
    if (factors.length >= 2) return { level:"High",     factors };
    if (factors.length === 1) return { level:"Moderate", factors };
    return { level:"Low — no significant indicators", factors:[] };
  }

  return {
    diabetes:     scoreLevel(diabetesFactors),
    heart:        scoreLevel(heartFactors),
    cancer:       scoreLevel(cancerFactors),
    surgery:      scoreLevel(surgeryFactors),
    neurological: scoreLevel(neuroFactors),
    overindulgence: scoreLevel(indulgeFactors),
    protection:   protFactors.length>=2 ? { level:"Strong",   factors:protFactors }
                : protFactors.length>=1 ? { level:"Moderate", factors:protFactors }
                : { level:"Limited — chart carries more stress than protection", factors:[] },
  };
}

// ── Health report HTML builder ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
//  PHASE 4b — SPECIAL AFFLICTION INDICATORS (Layers 4, 5, 6)
//  Layer 4: Mrityu Bhaga, 64th Navamsha, 22nd Drekkana, Gulika
//  Layer 5: D9 Navamsha cross-check + Vargottama multiplier
//  Layer 6: Retrograde modifier
// ══════════════════════════════════════════════════════════════════════════════

// ── Layer 4a: Mrityu Bhaga — exact critical degrees per planet per sign ───────
// Source: Charak Table. Planet at exact MB degree is permanently afflicted.
// Orb used: ±1° triggers flag.
const MRITYU_BHAGA = {
  Sun:     { Aries:20, Taurus:9,  Gemini:12, Cancer:6,  Leo:3,  Virgo:14, Libra:13, Scorpio:6,  Sagittarius:27, Capricorn:1,  Aquarius:7,  Pisces:9  },
  Moon:    { Aries:26, Taurus:12, Gemini:13, Cancer:25, Leo:24, Virgo:11, Libra:26, Scorpio:14, Sagittarius:13, Capricorn:15, Aquarius:8,  Pisces:23 },
  Mars:    { Aries:23, Taurus:26, Gemini:19, Cancer:21, Leo:29, Virgo:20, Libra:28, Scorpio:12, Sagittarius:7,  Capricorn:1,  Aquarius:9,  Pisces:16 },
  Mercury: { Aries:8,  Taurus:17, Gemini:17, Cancer:20, Leo:1,  Virgo:12, Libra:19, Scorpio:28, Sagittarius:27, Capricorn:4,  Aquarius:10, Pisces:28 },
  Jupiter: { Aries:11, Taurus:4,  Gemini:5,  Cancer:16, Leo:15, Virgo:4,  Libra:11, Scorpio:15, Sagittarius:14, Capricorn:9,  Aquarius:14, Pisces:20 },
  Venus:   { Aries:20, Taurus:15, Gemini:22, Cancer:17, Leo:14, Virgo:9,  Libra:24, Scorpio:18, Sagittarius:17, Capricorn:1,  Aquarius:16, Pisces:27 },
  Saturn:  { Aries:26, Taurus:4,  Gemini:23, Cancer:9,  Leo:11, Virgo:14, Libra:11, Scorpio:10, Sagittarius:23, Capricorn:8,  Aquarius:26, Pisces:28 },
  Rahu:    { Aries:14, Taurus:20, Gemini:4,  Cancer:27, Leo:12, Virgo:4,  Libra:14, Scorpio:20, Sagittarius:14, Capricorn:4,  Aquarius:14, Pisces:20 },
  Ketu:    { Aries:14, Taurus:20, Gemini:4,  Cancer:27, Leo:12, Virgo:4,  Libra:14, Scorpio:20, Sagittarius:14, Capricorn:4,  Aquarius:14, Pisces:20 },
};

function checkMrityuBhaga(planets) {
  const flags = [];
  PLANET_LIST.forEach(planet => {
    const p = planets[planet];
    if (!p || !p.sign || p.degree == null) return;
    const mbDeg = MRITYU_BHAGA[planet]?.[p.sign];
    if (mbDeg == null) return;
    const diff = Math.abs(p.degree - mbDeg);
    if (diff <= 1.0) {
      flags.push({
        planet,
        sign: p.sign,
        degree: p.degree,
        mbDegree: mbDeg,
        diff: Math.round(diff * 100) / 100,
        severity: diff <= 0.5 ? "exact" : "close",
        note: `${planet} at ${p.degree.toFixed(2)}° ${p.sign} — Mrityu Bhaga is ${mbDeg}° (within ${diff.toFixed(2)}°)`
      });
    }
  });
  return flags;
}

// ── Layer 4b: 64th Navamsha — 4th house from Moon in D9 ──────────────────────
// Classical: the lord and planets in/aspecting this house intensify disease risk
function get64thNavamsha(d9Houses, d9LagnaSign, moonD9House) {
  if (!moonD9House) return null;
  // 4th from Moon's D9 house = the 64th Navamsha house
  const navH4 = ((moonD9House - 1 + 3) % 12) + 1;
  const lagnaIdx = SIGNS_P3.indexOf(d9LagnaSign);
  const sign = SIGNS_P3[(lagnaIdx + navH4 - 1) % 12];
  const lord = SIGN_LORD[sign];
  const planetsInH = d9Houses[navH4] || [];
  return {
    house: navH4,
    sign,
    lord,
    planetsPresent: planetsInH,
    afflicted: planetsInH.length > 0 || true, // flag always — it's a special marker
    note: `64th Navamsha is H${navH4} (${sign}) in D9 — lorded by ${lord}. ${planetsInH.length>0?`Planets present: ${planetsInH.join(", ")}.`:""} This sensitises the domain governed by ${lord}.`
  };
}

// ── Layer 4c: 22nd Drekkana — lord of H8 in D3 ────────────────────────────────
// D3 (Drekkana) — each sign divides into 3 × 10° parts
// 22nd Drekkana = 8th house of D3 chart
// Computed from D1 planets using Drekkana formula
const DREKKANA_START = {
  Aries:0, Taurus:3, Gemini:6, Cancer:0, Leo:3, Virgo:6,
  Libra:0, Scorpio:3, Sagittarius:6, Capricorn:0, Aquarius:3, Pisces:6
};

function getDrekkanaSign(siderealLon) {
  // Each sign has 3 Drekkanas of 10° each
  const sign     = SIGNS_P3[Math.floor(siderealLon / 30)];
  const degInSign= siderealLon % 30;
  const drekkNum = Math.floor(degInSign / 10); // 0, 1, or 2
  const startIdx = DREKKANA_START[sign];
  return SIGNS_P3[(startIdx + drekkNum) % 12];
}

function buildD3Houses(planets) {
  // Build D3 (Drekkana) house placement for all planets
  // D3 lagna = Drekkana sign of the D1 ascendant longitude
  // We use Moon's D1 longitude as proxy for lagna when ASC degree not available
  const d3Planets = {};
  PLANET_LIST.forEach(p => {
    const pl = planets[p];
    if (!pl || pl.longitude == null) return;
    d3Planets[p] = { d3sign: getDrekkanaSign(pl.longitude) };
  });
  return d3Planets;
}

function get22ndDrekkana(planets, d1LagnaSign) {
  // 22nd Drekkana = 8th house of D3 chart
  // D3 lagna is the Drekkana sign of the D1 ascendant
  // Since we don't have lagna degree directly, use D1 lagna sign midpoint (15°)
  const lagnaIdx = SIGNS_P3.indexOf(d1LagnaSign);
  const lagnaLonProxy = lagnaIdx * 30 + 15; // midpoint of lagna sign
  const d3LagnaSign = getDrekkanaSign(lagnaLonProxy);
  const d3LagnaIdx  = SIGNS_P3.indexOf(d3LagnaSign);
  // H8 of D3 = 8th from D3 lagna
  const d3H8Sign = SIGNS_P3[(d3LagnaIdx + 7) % 12];
  const d3H8Lord = SIGN_LORD[d3H8Sign];

  // Find where D3H8 lord sits in D3 chart
  const d3Planets = buildD3Houses(planets);
  const d3H8LordD3Sign = d3Planets[d3H8Lord]?.d3sign;

  return {
    d3Lagna: d3LagnaSign,
    h8Sign:  d3H8Sign,
    h8Lord:  d3H8Lord,
    h8LordD3Sign: d3H8LordD3Sign,
    note: `22nd Drekkana: D3 lagna is ${d3LagnaSign} — H8 of D3 is ${d3H8Sign}, lorded by ${d3H8Lord}. When ${d3H8Lord} runs as Mahadasha or Antardasha lord, health is more vulnerable to serious events.`
  };
}

// ── Layer 4d: Gulika — classical malefic sub-lord ─────────────────────────────
// Gulika (son of Saturn) is computed from birth time and day of week
// Classical formula: each weekday divides into 8 parts of ~90 min each
// Gulika occupies the 7th part for each day
const GULIKA_PART = { 0:6, 1:5, 2:4, 3:3, 4:2, 5:1, 6:0 }; // Sun=0,Mon=1...Sat=6
const PLANET_LORDS_BY_DAY = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];

function computeGulika(dob, tob, utcOffset) {
  if (!dob || !tob) return null;
  try {
    const [y,mo,d] = dob.split("-").map(Number);
    const [h,mi]   = tob.split(":").map(Number);
    const localDate = new Date(y, mo-1, d);
    const dow = localDate.getDay(); // 0=Sun

    // Each day has 8 parts; sunrise ~6am assumed
    const sunriseMins  = 6 * 60;
    const dayLenMins   = 12 * 60;
    const partMins     = dayLenMins / 8;
    const gulikaPart   = GULIKA_PART[dow];
    const gulikaStart  = sunriseMins + gulikaPart * partMins;
    const gulikaEnd    = gulikaStart + partMins;
    const birthMins    = h * 60 + mi;

    // Gulika longitude = start of Gulika period mapped to zodiac
    // Each 1/8 of the day-arc corresponds to 22.5° of zodiac
    const gulikaLon = ((gulikaPart + PLANET_LORDS_BY_DAY.indexOf("Saturn")) % 12) * 30 + 15;
    const gulikaSign = SIGNS_P3[Math.floor(gulikaLon / 30)];

    const birthInGulika = birthMins >= gulikaStart && birthMins < gulikaEnd;

    return {
      sign: gulikaSign,
      birthInGulika,
      note: `Gulika (Mandi) is in ${gulikaSign}. ${birthInGulika?"Birth occurred during the Gulika period — classical indicator for chronic health challenges.":"Gulika adds malefic influence to "+gulikaSign+" — monitor the body zones governed by this sign."}`
    };
  } catch(e) { return null; }
}

// ── Layer 5: D9 cross-check + Vargottama multiplier ──────────────────────────
function getD9HealthFactors(planets, d1LagnaSign, d9LagnaSign) {
  const FUNC_D9 = FUNCTIONAL_STATUS_MAP[d9LagnaSign] || {};
  const factors = [];

  PLANET_LIST.forEach(planet => {
    const p = planets[planet];
    if (!p || !p.d9sign) return;
    const d1Sign = p.sign;
    const d9Sign = p.d9sign;
    const isVargottama = d1Sign === d9Sign;
    const d9Dig = getDignity(planet, d9Sign);
    const d1Dig = getDignity(planet, d1Sign);
    const fsD1  = FUNCTIONAL_STATUS_MAP[d1LagnaSign]?.[planet] || "N";

    // Vargottama malefic — ×1.5 weight = stronger affliction
    if (isVargottama && fsD1 === "M") {
      factors.push({
        planet, type:"amplified",
        note:`${planet} is Vargottama (${d1Sign} in both D1 and D9) AND a functional malefic — its afflictions carry 1.5× the normal weight. Health themes associated with ${planet} are more persistent.`
      });
    }
    // Vargottama benefic — strong protection
    else if (isVargottama && ["B","Y"].includes(fsD1)) {
      factors.push({
        planet, type:"protected",
        note:`${planet} is Vargottama in ${d1Sign} — its protective or supportive quality is strengthened in both D1 and D9. Health domains governed by ${planet} have lasting resilience.`
      });
    }
    // D9 debilitation contradicts D1 strength
    else if (d9Dig === "de" && (d1Dig === "ex" || d1Dig === "own") && fsD1 === "M") {
      factors.push({
        planet, type:"contradicted",
        note:`${planet} appears strong in D1 (${d1Dig === "ex"?"exalted":"own sign"}) but is debilitated in D9 (${d9Sign}) — its D1 strength does not sustain over time. Health conditions tied to ${planet} may worsen in the second half of life.`
      });
    }
    // D9 exaltation confirms D1 promise
    else if (d9Dig === "ex" && ["B","Y"].includes(fsD1)) {
      factors.push({
        planet, type:"confirmed",
        note:`${planet} is confirmed strong in D9 (exalted in ${d9Sign}) — its protective quality deepens with age.`
      });
    }
  });

  // D9 lagna health
  const d9LagnaLord = SIGN_LORD[d9LagnaSign];
  if (d9LagnaLord) {
    const d9LLH = (() => { for (let h=1;h<=12;h++) { for (const p of Object.values({})) {} } return null; })();
    factors.push({
      planet: d9LagnaLord, type:"d9lagna",
      note:`D9 lagna is ${d9LagnaSign} (lord: ${d9LagnaLord}) — the soul-level health constitution is expressed through this energy. A strong D9 lagna lord indicates health resilience that strengthens with maturity.`
    });
  }

  return factors.slice(0, 6);
}

// ── Layer 6: Retrograde modifier ─────────────────────────────────────────────
function getRetrogradeHealthModifiers(planets, lagnaSign) {
  const FUNC = FUNCTIONAL_STATUS_MAP[lagnaSign] || {};
  const modifiers = [];

  PLANET_LIST.forEach(planet => {
    const p = planets[planet];
    if (!p?.retrograde) return;
    const fs  = FUNC[planet] || "N";
    const dig = getDignity(planet, p.sign || "");
    const isMalefic = fs === "M";
    const isBenefic = ["B","Y"].includes(fs);

    if (isMalefic) {
      modifiers.push({
        planet,
        weight: "×1.5 — amplified affliction",
        note: `${planet} is retrograde AND a functional malefic — its health afflictions carry 1.5× normal weight. The themes of ${HEALTH_PLANET_BODY[planet]?.areas || "its ruled areas"} are persistently sensitised. Past or chronic conditions connected to ${planet}'s body zone are more likely to resurface.`,
        severity: "high"
      });
    } else if (isBenefic) {
      modifiers.push({
        planet,
        weight: "×0.5 — reduced protection",
        note: `${planet} is retrograde and is normally a functional benefic — but retrograde status reduces its protective capacity to approximately half. Health protection from ${planet} is less reliable than the natal promise suggests.`,
        severity: "medium"
      });
    } else {
      modifiers.push({
        planet,
        weight: "Neutral — indirect expression",
        note: `${planet} is retrograde (neutral for this lagna) — its themes may surface in atypical, delayed, or recurring ways. Past health matters connected to ${planet}'s rulership may resurface during its dasha periods.`,
        severity: "low"
      });
    }

    // Also retrograde malefic lorded houses — flag previous house too
    if (isMalefic && p.longitude) {
      // The house retrograde malefic was moving "back from" = previous sign
      modifiers[modifiers.length-1].previousHouseNote = `As a retrograde malefic, ${planet} influences the body zones of both its current house AND the preceding house.`;
    }
  });

  return modifiers;
}

// ── Phase 4b: Compute all special indicators ─────────────────────────────────
function computeSpecialIndicators(chartData) {
  const { planets, d1, d9 } = chartData;
  const dob = chartData.input?.dob || currentData?.form?.dob;
  const tob = chartData.input?.tob || currentData?.form?.tob;
  const utcOffset = chartData.input?.utcOffset || 0;

  // Find Moon's D9 house
  let moonD9House = null;
  for (let h=1; h<=12; h++) { if ((d9.houses[h]||[]).includes("Moon")) { moonD9House=h; break; } }

  return {
    mrityuBhaga:   checkMrityuBhaga(planets),
    navamsha64:    get64thNavamsha(d9.houses, d9.lagnaSign, moonD9House),
    drekkana22:    get22ndDrekkana(planets, d1.lagnaSign),
    gulika:        computeGulika(dob, tob, utcOffset),
    d9Factors:     getD9HealthFactors(planets, d1.lagnaSign, d9.lagnaSign),
    retroModifiers:getRetrogradeHealthModifiers(planets, d1.lagnaSign),
  };
}


// ══════════════════════════════════════════════════════════════════════════════
//  PHASE 4c — LAYER 7: DISEASE TIMING ENGINE
//  Scans full Vimshottari MD/AD sequence and flags:
//  - High-risk windows: 2+ adverse lords running simultaneously
//  - Recovery windows: benefic/yogakaraka running during adverse MD
//  Classical rules: Maraka + Trika combination = highest risk signal
// ══════════════════════════════════════════════════════════════════════════════

function buildHealthTimeline(chartData) {
  const { dasha, d1, planets } = chartData;
  if (!dasha?.dashas) return null;

  const lagnaSign = d1.lagnaSign;
  const FUNC      = FUNCTIONAL_STATUS_MAP[lagnaSign] || {};
  const lagnaIdx  = SIGNS_P3.indexOf(lagnaSign);

  function hSign(h)    { return SIGNS_P3[(lagnaIdx + h - 1) % 12]; }
  function hLord(h)    { return SIGN_LORD[hSign(h)]; }
  function planetH(p)  {
    for (let h=1; h<=12; h++) { if ((d1.houses[h]||[]).includes(p)) return h; }
    return null;
  }
  function getDig(p)   {
    const h = planetH(p); if (!h) return "";
    return getDignity(p, hSign(h));
  }

  // Classify each planet's health role for this lagna
  const marakas  = new Set([hLord(2), hLord(7)].filter(Boolean));
  const trikas   = new Set([hLord(6), hLord(8), hLord(12)].filter(Boolean));
  const yogakarakas = new Set(Object.entries(FUNC).filter(([,v])=>v==="Y").map(([p])=>p));
  const benefics    = new Set(Object.entries(FUNC).filter(([,v])=>v==="B").map(([p])=>p));
  const malefics    = new Set(Object.entries(FUNC).filter(([,v])=>v==="M").map(([p])=>p));

  // Score a single planet's health adversity (0 = neutral, 1 = low, 2 = medium, 3 = high)
  function adversityScore(planet) {
    let score = 0;
    if (marakas.has(planet))  score += 2;
    if (trikas.has(planet))   score += 2;
    if (malefics.has(planet)) score += 1;
    if (yogakarakas.has(planet)) score -= 2;
    if (benefics.has(planet))    score -= 1;
    // Debilitated planet in adverse role amplifies
    if (getDig(planet) === "de" && (marakas.has(planet) || trikas.has(planet))) score += 1;
    // Retrograde malefic amplifies
    if (planets[planet]?.retrograde && malefics.has(planet)) score += 1;
    return Math.max(0, score);
  }

  // Protection score for a planet
  function protectionScore(planet) {
    let score = 0;
    if (yogakarakas.has(planet)) score += 3;
    if (benefics.has(planet))    score += 2;
    if (getDig(planet) === "ex") score += 1;
    if (getDig(planet) === "own") score += 1;
    return score;
  }

  const today = new Date().toISOString().split("T")[0];
  const birthDate = chartData.input?.dob || currentData?.form?.dob || "";
  const birthYear = birthDate ? parseInt(birthDate.split("-")[0]) : 1970;

  const windows = [];

  dasha.dashas.forEach(md => {
    const mdScore    = adversityScore(md.lord);
    const mdProtect  = protectionScore(md.lord);
    const mdFromYear = parseInt(md.startDate.split("-")[0]);
    const mdToYear   = parseInt(md.endDate.split("-")[0]);
    const mdAge      = mdFromYear - birthYear;

    // Only include lifecourse windows (age 10–85)
    if (mdAge > 85 || mdToYear - birthYear < 10) return;

    (md.antarDasas || []).forEach(ad => {
      const adScore   = adversityScore(ad.lord);
      const adProtect = protectionScore(ad.lord);
      const combined  = mdScore + adScore;
      const protect   = mdProtect + adProtect;
      const adFromYear= parseInt(ad.startDate.split("-")[0]);
      const adAge     = adFromYear - birthYear;

      if (adAge > 85 || adAge < 10) return;

      const isCurrent = ad.startDate <= today && today <= ad.endDate;

      // ── HIGH RISK: 2+ adverse factors converge ──────────────────────────
      if (combined >= 4) {
        const reasons = [];
        if (marakas.has(md.lord))  reasons.push(`${md.lord} MD is a Maraka (H${md.lord===hLord(2)?"2":"7"} lord)`);
        if (trikas.has(md.lord))   reasons.push(`${md.lord} MD is a Trika lord`);
        if (malefics.has(md.lord)) reasons.push(`${md.lord} MD is a functional malefic`);
        if (marakas.has(ad.lord))  reasons.push(`${ad.lord} AD is a Maraka`);
        if (trikas.has(ad.lord))   reasons.push(`${ad.lord} AD is a Trika lord`);
        if (malefics.has(ad.lord)) reasons.push(`${ad.lord} AD is a functional malefic`);
        if (getDig(md.lord)==="de") reasons.push(`${md.lord} is debilitated — adversity amplified`);
        if (getDig(ad.lord)==="de") reasons.push(`${ad.lord} is debilitated — adversity amplified`);
        if (planets[ad.lord]?.retrograde && malefics.has(ad.lord)) reasons.push(`${ad.lord} is retrograde — chronic/persistent health pressure`);

        // Classify the health domain at risk
        let domain = "General health sensitivity";
        const allPlanets = [md.lord, ad.lord];
        if (allPlanets.some(p=>HEALTH_PLANET_BODY[p]?.diseases.includes("cardiac")||p==="Sun")) domain = "Cardiovascular & vitality";
        else if (allPlanets.some(p=>p==="Moon"||HEALTH_PLANET_BODY[p]?.diseases.includes("mental health"))) domain = "Mental health & nervous system";
        else if (allPlanets.some(p=>p==="Jupiter"||HEALTH_PLANET_BODY[p]?.diseases.includes("diabetes"))) domain = "Metabolic & liver";
        else if (allPlanets.some(p=>p==="Saturn"||HEALTH_PLANET_BODY[p]?.diseases.includes("chronic conditions"))) domain = "Chronic & skeletal";
        else if (allPlanets.some(p=>p==="Mars"||HEALTH_PLANET_BODY[p]?.diseases.includes("surgical"))) domain = "Surgical & inflammatory";
        else if (allPlanets.some(p=>p==="Venus"||HEALTH_PLANET_BODY[p]?.diseases.includes("reproductive"))) domain = "Reproductive & hormonal";

        windows.push({
          type:       "risk",
          severity:   combined >= 6 ? "critical" : combined >= 5 ? "high" : "medium",
          md:         md.lord,
          ad:         ad.lord,
          startDate:  ad.startDate,
          endDate:    ad.endDate,
          ageFrom:    adAge,
          ageTo:      adAge + parseFloat(ad.years),
          domain,
          reasons:    reasons.slice(0, 3),
          isCurrent,
          score:      combined,
        });
      }
      // ── RECOVERY / PROTECTION: benefic in adverse MD ──────────────────
      else if (mdScore >= 2 && adProtect >= 3) {
        const reasons = [];
        if (yogakarakas.has(ad.lord)) reasons.push(`${ad.lord} AD is yogakaraka — peak protective force within a testing season`);
        if (benefics.has(ad.lord))    reasons.push(`${ad.lord} AD is a functional benefic — provides relief within the main season`);
        if (getDig(ad.lord)==="ex")   reasons.push(`${ad.lord} is exalted — its protective capacity is at maximum`);

        windows.push({
          type:      "recovery",
          md:        md.lord,
          ad:        ad.lord,
          startDate: ad.startDate,
          endDate:   ad.endDate,
          ageFrom:   adAge,
          ageTo:     adAge + parseFloat(ad.years),
          reasons,
          isCurrent,
          score:     protect,
        });
      }
    });
  });

  // Sort by start date; put current window first
  windows.sort((a,b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return a.startDate.localeCompare(b.startDate);
  });

  // Separate risk and recovery
  const riskWindows     = windows.filter(w=>w.type==="risk");
  const recoveryWindows = windows.filter(w=>w.type==="recovery");

  // Build a 5-year near-term view
  const now      = new Date().toISOString().split("T")[0];
  const fiveYrs  = new Date(new Date().setFullYear(new Date().getFullYear()+5)).toISOString().split("T")[0];
  const nearTerm = windows.filter(w => w.endDate >= now && w.startDate <= fiveYrs);

  return { riskWindows, recoveryWindows, nearTerm, marakas:[...marakas], trikas:[...trikas] };
}

// HTML for timeline section
function buildTimelineHTML(timeline, name) {
  if (!timeline) return "";

  const pageHeader = `<div style="font-size:9pt;color:#888;text-align:right;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:16px">${name} &nbsp;|&nbsp; Health &amp; Vitality Report &nbsp;|&nbsp; Jyotish Precision Analyzer</div>`;

  const sevColor = s => s==="critical"?"#7a0000":s==="high"?"#8f1a1a":"#7a5500";
  const sevLabel = s => s==="critical"?"CRITICAL":s==="high"?"HIGH":"MODERATE";

  const riskRows = timeline.riskWindows.slice(0, 12).map(w => `
    <tr style="${w.isCurrent?"background:#fff8f0":""}">
      <td style="padding:7px 10px;border:1px solid #ddd;font-weight:${w.isCurrent?"700":"400"};color:${sevColor(w.severity)}">${sevLabel(w.severity)}${w.isCurrent?" ◀ NOW":""}</td>
      <td style="padding:7px 10px;border:1px solid #ddd">${w.md} MD / ${w.ad} AD</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:10pt">${w.startDate} &rarr; ${w.endDate}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:10pt">Age ${Math.round(w.ageFrom)}&ndash;${Math.round(w.ageTo)}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:10pt">${w.domain}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:9.5pt;color:#555">${w.reasons[0]||""}</td>
    </tr>`).join("");

  const recoveryRows = timeline.recoveryWindows.slice(0, 6).map(w => `
    <tr>
      <td style="padding:7px 10px;border:1px solid #ddd;color:#1a6e3c;font-weight:600">RECOVERY</td>
      <td style="padding:7px 10px;border:1px solid #ddd">${w.md} MD / ${w.ad} AD</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:10pt">${w.startDate} &rarr; ${w.endDate}</td>
      <td style="padding:7px 10px;border:1px solid #ddd;font-size:10pt">Age ${Math.round(w.ageFrom)}&ndash;${Math.round(w.ageTo)}</td>
      <td colspan="2" style="padding:7px 10px;border:1px solid #ddd;font-size:9.5pt;color:#2a6e3c">${w.reasons[0]||""}</td>
    </tr>`).join("");

  const nearTermRows = timeline.nearTerm.length
    ? timeline.nearTerm.map(w => `
      <tr style="${w.isCurrent?"background:#fff8f0":""}">
        <td style="padding:7px 10px;border:1px solid #ddd;font-weight:700;color:${w.type==="risk"?sevColor(w.severity):"#1a6e3c"}">${w.type==="risk"?sevLabel(w.severity):"RECOVERY"}${w.isCurrent?" &#9664; NOW":""}</td>
        <td style="padding:7px 10px;border:1px solid #ddd">${w.md} / ${w.ad}</td>
        <td style="padding:7px 10px;border:1px solid #ddd;font-size:10pt">${w.startDate} &rarr; ${w.endDate}</td>
        <td style="padding:7px 10px;border:1px solid #ddd;font-size:9.5pt;color:#555" colspan="3">${w.type==="risk"?(w.domain+": "+w.reasons[0]):w.reasons[0]||""}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="padding:10px;border:1px solid #ddd;color:#2a6e3c">No high-risk or recovery windows in the next 5 years based on the current dasha configuration.</td></tr>`;

  return `
<div style="page-break-before:always"></div>
${pageHeader}
<h2 style="font-size:12.5pt;color:#5a1a00;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:0">Layer 7 &mdash; Health Sensitivity Timeline</h2>
<p style="font-size:10pt;color:#555;margin-bottom:14px">
  Periods flagged when 2+ adverse classical factors converge simultaneously. Risk intensity reflects the number and type of adverse lords running.
  <strong>Maraka lords:</strong> ${timeline.marakas.join(", ")||"none"} &nbsp;&middot;&nbsp;
  <strong>Trika lords:</strong> ${timeline.trikas.join(", ")||"none"}.
  Recovery windows are sub-periods where a yogakaraka or strong benefic runs within an adverse main season.
</p>

<h3 style="font-size:11pt;color:#3a3a3a;margin:14px 0 6px">5-Year Near-Term View</h3>
<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:10.5pt">
  <tr style="background:#f0e8d8"><th style="padding:7px 10px;border:1px solid #ddd;text-align:left">Level</th><th style="padding:7px 10px;border:1px solid #ddd;text-align:left">Period</th><th style="padding:7px 10px;border:1px solid #ddd;text-align:left">Dates</th><th colspan="3" style="padding:7px 10px;border:1px solid #ddd;text-align:left">Health Area</th></tr>
  ${nearTermRows}
</table>

<h3 style="font-size:11pt;color:#3a3a3a;margin:18px 0 6px">Lifetime Risk Windows</h3>
<p style="font-size:9.5pt;color:#666;margin-bottom:8px">Showing up to 12 highest-risk periods across the lifespan. Risk windows indicate sensitivity and probability — not certainty. Conscious health management, timely check-ups, and avoiding known risk factors during these periods significantly alters outcomes.</p>
${riskRows ? `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:10.5pt">
  <tr style="background:#f0e8d8"><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Level</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Period</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Dates</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Age</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Domain</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Primary Factor</th></tr>
  ${riskRows}
</table>` : `<p style="background:#f0f8f0;padding:12px;border-left:3px solid #2a6e3c">No high-risk windows detected in this chart's dasha sequence.</p>`}

<h3 style="font-size:11pt;color:#1a6e3c;margin:18px 0 6px">Recovery &amp; Protection Windows</h3>
<p style="font-size:9.5pt;color:#666;margin-bottom:8px">Sub-periods within adverse main seasons where a yogakaraka or strong benefic provides relief. These are the windows for elective procedures, health improvements, and recovery from prior adverse periods.</p>
${recoveryRows ? `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:10.5pt">
  <tr style="background:#f0f0e8"><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Type</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Period</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Dates</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Age</th><th colspan="2" style="padding:6px 10px;border:1px solid #ddd;text-align:left">Protection Factor</th></tr>
  ${recoveryRows}
</table>` : `<p style="font-size:10pt;color:#555">No strong recovery windows identified in this chart's dasha configuration.</p>`}

<p style="font-size:9.5pt;color:#777;margin-top:16px;border-top:1px solid #eee;padding-top:10px">
  <strong>How to use this timeline:</strong> During HIGH or CRITICAL windows — schedule annual health check-ups, avoid elective surgeries unless necessary, maintain consistent routines (sleep, diet, exercise), and proactively address any known vulnerabilities for the flagged domain. During RECOVERY windows — this is the most favourable time for elective procedures, rehabilitation, or health improvements. <strong>This timeline does not predict illness — it indicates periods of elevated sensitivity where conscious attention changes the outcome.</strong>
</p>`;
}


function buildHealthReportHTML(chartData, analysisData) {
  const { planets, d1, d9 } = chartData;
  const name  = chartData.input?.name  || currentData?.form?.name  || "—";
  const dob   = chartData.input?.dob   || currentData?.form?.dob   || "—";
  const tob   = chartData.input?.tob   || currentData?.form?.tob   || "—";
  const place = chartData.input?.place || currentData?.form?.place || "—";

  const health     = getHealthClassification(d1.lagnaSign, d1.houses, planets);
  const indicators = computeHealthIndicators(d1.lagnaSign, d1.houses, planets, d9.houses);
  const special    = computeSpecialIndicators(chartData);
  const timeline   = buildHealthTimeline(chartData);

  const pageHeader = `<div style="font-size:9pt;color:#888;text-align:right;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:16px">${name} &nbsp;|&nbsp; Health &amp; Vitality Report &nbsp;|&nbsp; Jyotish Precision Analyzer</div>`;

  const sev = s => s==="high"
    ? `<span style="color:#a02020;font-weight:700">&#9650; High</span>`
    : `<span style="color:#a06000">&#9670; Moderate</span>`;

  const indRow = (label, data) => {
    const c = data.level==="High"?"#8f1a1a":data.level==="Moderate"?"#7a5500":data.level==="Strong"?"#1a6e3c":"#2a6e3c";
    return `<tr><td style="font-weight:600;padding:6px 10px;border:1px solid #ddd">${label}</td><td style="color:${c};font-weight:700;padding:6px 10px;border:1px solid #ddd">${data.level}</td></tr>`;
  };

  const zoneRows = health.vulnerableZones.map(z =>
    `<tr><td style="padding:6px 10px;border:1px solid #ddd">${sev(z.severity)} H${z.house} &mdash; ${z.zone}</td><td style="padding:6px 10px;border:1px solid #ddd;font-size:10.5pt">${z.organs}</td><td style="padding:6px 10px;border:1px solid #ddd;font-size:10.5pt;color:#555">${z.reason}</td></tr>`
  ).join("");

  const marakaText = health.marakas.map(p=>`<strong>${p}</strong> (${p===health.marakaH2?"H2 lord":"H7 lord"})`).join(", ");
  const trikaText  = [`<strong>${health.trikaH6}</strong> (H6)`,`<strong>${health.trikaH8}</strong> (H8)`,`<strong>${health.trikaH12}</strong> (H12)`].join(", ");

  const mbRows = special.mrityuBhaga.length
    ? special.mrityuBhaga.map(m=>
        `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${m.planet}</td><td style="padding:6px 10px;border:1px solid #ddd">${m.sign} ${m.degree.toFixed(2)}&deg;</td><td style="padding:6px 10px;border:1px solid #ddd">MB at ${m.mbDegree}&deg; (&plusmn;${m.diff}&deg;)</td><td style="padding:6px 10px;border:1px solid #ddd;color:${m.severity==="exact"?"#8f1a1a":"#7a5500"};font-weight:700">${m.severity==="exact"?"Exact":"Close"}</td></tr>`
      ).join("")
    : `<tr><td colspan="4" style="padding:8px 10px;border:1px solid #ddd;color:#2a6e3c">No planets within 1&deg; of Mrityu Bhaga — this chart does not carry this affliction.</td></tr>`;

  const retroRows = special.retroModifiers.length
    ? special.retroModifiers.map(r=>
        `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${r.planet}</td><td style="padding:6px 10px;border:1px solid #ddd;color:${r.severity==="high"?"#8f1a1a":r.severity==="medium"?"#7a5500":"#444"}">${r.weight}</td><td style="padding:6px 10px;border:1px solid #ddd;font-size:10.5pt">${r.note}</td></tr>`
      ).join("")
    : `<tr><td colspan="3" style="padding:8px 10px;border:1px solid #ddd;color:#2a6e3c">No retrograde planets — retrograde modifiers do not apply.</td></tr>`;

  const d9Rows = special.d9Factors.filter(f=>f.type!=="d9lagna").map(f=>
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${f.planet}</td><td style="padding:6px 10px;border:1px solid #ddd;color:${f.type==="amplified"?"#8f1a1a":f.type==="contradicted"?"#7a5500":f.type==="protected"?"#2a6e3c":"#444"};font-weight:600">${f.type==="amplified"?"Amplified":f.type==="contradicted"?"D9 contradicts":f.type==="protected"?"Vargottama":f.type==="confirmed"?"D9 confirmed":f.type}</td><td style="padding:6px 10px;border:1px solid #ddd;font-size:10.5pt">${f.note}</td></tr>`
  ).join("") || `<tr><td colspan="3" style="padding:8px 10px;border:1px solid #ddd;color:#2a6e3c">No significant D9 amplification detected.</td></tr>`;

  const css = `body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.65;color:#111;max-width:720px;margin:32px auto;padding:0 24px}h1{font-size:15pt;color:#5a1a00;border-bottom:2px solid #c9a84c;padding-bottom:8px;margin-bottom:6px}h2{font-size:12.5pt;color:#5a1a00;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:26px}h3{font-size:11pt;color:#3a3a3a;margin:14px 0 6px}.meta{font-size:10pt;color:#555;margin-bottom:14px}.disc{font-size:9.5pt;color:#555;background:#fdf8f0;border:1px solid #e0c870;border-radius:4px;padding:12px 16px;margin-bottom:18px}.cb{background:#f9f5ee;border-left:4px solid #c9a84c;padding:12px 16px;margin:12px 0}.robust{color:#1a6e3c;font-weight:700;font-size:13pt}.moderate{color:#7a5500;font-weight:700;font-size:13pt}.vulnerable{color:#8f1a1a;font-weight:700;font-size:13pt}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10.5pt}th{background:#f0e8d8;color:#5a3a00;padding:7px 10px;border:1px solid #ddd;text-align:left;font-size:10pt;text-transform:uppercase;letter-spacing:.03em}td{vertical-align:top}.footer{font-size:8.5pt;color:#aaa;border-top:1px solid #ddd;margin-top:28px;padding-top:8px;text-align:center}.pb{page-break-before:always}.nb{background:#fdf8f0;border-left:3px solid #c9a84c;padding:9px 13px;font-size:10.5pt;color:#444}`;

  const fsList = l => Object.entries(FUNCTIONAL_STATUS_MAP[d1.lagnaSign]||{}).filter(([,s])=>s===l).map(([p])=>`<strong>${p}</strong>`).join(", ")||"None";

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Health Report - ${name}</title><style>${css}</style></head><body>
${pageHeader}
<h1>Health &amp; Vitality Indicators</h1>
<div class="meta"><strong>Native:</strong> ${name} &nbsp;|&nbsp; <strong>DOB:</strong> ${dob} &nbsp;|&nbsp; <strong>TOB:</strong> ${tob} &nbsp;|&nbsp; <strong>Place:</strong> ${place}<br><strong>Lagna:</strong> ${d1.lagnaSign} &nbsp;|&nbsp; <strong>D9 Lagna:</strong> ${d9.lagnaSign} &nbsp;|&nbsp; <strong>Ayanamsha:</strong> Lahiri</div>
<div class="disc"><strong>DISCLAIMER:</strong> This report provides astrological health indications for self-awareness and educational purposes only. It is <strong>NOT</strong> a substitute for professional medical consultation, diagnosis, or treatment. All indications are based on classical Vedic astrological interpretation and <em>may or may not manifest</em>. Consult a qualified medical professional for any health concern.</div>

<h2>Layer 1 &mdash; Constitutional Vitality</h2>
<div class="cb"><span class="${health.constitution.toLowerCase()}">${health.constitution}</span><p style="margin:8px 0 0">${health.constitutionExplain}</p></div>
<table><tr><th colspan="2">Constitutional Factors</th></tr>
<tr><td>Lagna Lord</td><td><strong>${health.lagnaLord}</strong> in H${health.lagnaLordH}${health.lagnaLordDig==="ex"?" &mdash; Exalted":health.lagnaLordDig==="de"?" &mdash; Debilitated":health.lagnaLordDig==="own"?" &mdash; Own Sign":""} ${health.lagnaLordDust?"&nbsp;&#9888; Dusthana":""}</td></tr>
<tr><td>Moon</td><td>${health.moonDig==="ex"?"Exalted":health.moonDig==="de"?"Debilitated":health.moonDig==="own"?"Own sign":"Neutral"} in H${health.moonH}${health.moonDust?" &nbsp;&#9888; Dusthana":""}</td></tr>
<tr><td>Benefics in Kendras</td><td>${health.beneficKendraCount} ${health.beneficKendraCount>=2?"&mdash; structural protection":health.beneficKendraCount===1?"&mdash; partial":"&mdash; limited"}</td></tr>
<tr><td>Malefics in Kendras</td><td>${health.maleficKendraCount} ${health.maleficKendraCount>=2?"&#9888; Multiple stress points":health.maleficKendraCount===1?"&mdash; one kendra under pressure":"&mdash; clear"}</td></tr></table>

<h2>Layer 2 &mdash; Functional Planet Classification</h2>
<p style="font-size:10pt;color:#555;margin-bottom:8px">Classification specific to <strong>${d1.lagnaSign} lagna</strong>.</p>
<table><tr><th>Category</th><th>Planets</th><th>Health Significance</th></tr>
<tr><td><strong>Maraka</strong> (H2+H7)</td><td>${marakaText}</td><td>Monitor health during these planets' dasha periods.</td></tr>
<tr><td><strong>Trika Lords</strong></td><td>${trikaText}</td><td>H6=disease &middot; H8=crisis/surgery &middot; H12=hospitalisation</td></tr>
<tr><td><strong>Functional Malefics</strong></td><td>${fsList("M")}</td><td>Adverse for this lagna &mdash; dasha periods require health vigilance.</td></tr>
<tr><td><strong>Yogakaraka</strong></td><td>${fsList("Y")}</td><td>Highest elevating force &mdash; provides constitutional support.</td></tr></table>

<h2>Layer 3 &mdash; Body Zone Vulnerability Map</h2>
${health.vulnerableZones.length ? `<table><tr><th>Zone &amp; Severity</th><th>Specific Areas</th><th>Classical Basis</th></tr>${zoneRows}</table>` : `<p style="background:#f0f8f0;padding:12px;border-left:3px solid #2a6e3c">No high-severity body zone vulnerabilities detected for this lagna configuration.</p>`}

<div class="pb"></div>${pageHeader}
<h2>Layer 4 &mdash; Special Affliction Indicators</h2>
<h3>Mrityu Bhaga &mdash; Critical Planetary Degrees</h3>
<p style="font-size:10pt;color:#555;margin-bottom:8px">A planet within 1&deg; of its Mrityu Bhaga degree is permanently afflicted. Dasha periods of that planet require heightened health vigilance.</p>
<table><tr><th>Planet</th><th>Position</th><th>MB Degree</th><th>Status</th></tr>${mbRows}</table>

<h3>64th Navamsha</h3>
<p class="nb">${special.navamsha64?.note || "Not computed."}</p>

<h3>22nd Drekkana</h3>
<p class="nb">${special.drekkana22?.note || "Not computed."}</p>

<h3>Gulika (Mandi)</h3>
<p class="nb">${special.gulika?.note || "Gulika calculation requires precise birth time."}</p>

<h2>Layer 5 &mdash; D9 Navamsha Cross-Check</h2>
<table><tr><th>Planet</th><th>D9 Status</th><th>Health Implication</th></tr>${d9Rows}</table>

<h2>Layer 6 &mdash; Retrograde Planet Modifiers</h2>
<table><tr><th>Planet</th><th>Weight</th><th>Health Implication</th></tr>${retroRows}</table>

${buildTimelineHTML(timeline, name)}

<div class="pb"></div>${pageHeader}
<h2>Specific Health Indicators</h2>
<p style="font-size:10pt;color:#555;margin-bottom:10px">Indication level only. Level reflects independent classical factors present. <strong>Consult a physician for any health concern.</strong></p>
<table><tr><th>Indicator</th><th>Signal Level</th></tr>
${indRow("Diabetes",indicators.diabetes)}
${indRow("Heart Ailments",indicators.heart)}
${indRow("Cancer",indicators.cancer)}
${indRow("Surgical Intervention",indicators.surgery)}
${indRow("Neurological &amp; Cognitive Sensitivity",indicators.neurological)}
${indRow("Over-indulgence",indicators.overindulgence)}
${indRow("Overall Protection Support",indicators.protection)}</table>

<p style="font-size:10pt;color:#555;margin-top:18px;border-top:1px solid #eee;padding-top:10px">Astrological health analysis is an interpretive art and does not constitute medical advice. All indications reflect classical planetary configurations associated with health themes historically &mdash; they indicate sensitivity and probability, not certainty. <strong>Always consult a qualified medical professional.</strong></p>
<div class="footer">${name} &nbsp;|&nbsp; Health &amp; Vitality Report &nbsp;|&nbsp; Jyotish Precision Analyzer &nbsp;|&nbsp; Lahiri Ayanamsha &nbsp;|&nbsp; Not a substitute for medical advice &nbsp;|&nbsp; &copy; 2025</div>
</body></html>`;
}


// ── Health report trigger ─────────────────────────────────────────────────────
function downloadHealthReport(format) {
  if (!currentData) return;
  const html     = buildHealthReportHTML(currentData.chart, currentData.analysis);
  const name     = currentData.form?.name || "health";
  const filename = `health-report-${name}`;

  if (format === "word") {
    const blob = new Blob(["\uFEFF", html], { type:"application/msword" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=filename+".doc"; a.click(); URL.revokeObjectURL(url);
  } else if (format === "pdf") {
    const win = window.open("","_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }
}

function showHealthFormatPicker() {
  const btn = document.getElementById("healthReportBtn");
  if (!btn) return;
  document.querySelectorAll(".dl-format-picker").forEach(el=>el.remove());
  const picker = document.createElement("div");
  picker.className = "dl-format-picker";
  picker.style.cssText = "position:absolute;right:0;bottom:calc(100% + 6px);z-index:400";
  picker.innerHTML = `<div class="dl-picker-title">Download Health Report</div>
    <button class="dl-fmt-btn" id="hlthWord">📄 Word (.doc)</button>
    <button class="dl-fmt-btn" id="hlthPDF">📑 PDF (print)</button>`;
  picker.querySelector("#hlthWord").addEventListener("click",()=>{downloadHealthReport("word");picker.remove();});
  picker.querySelector("#hlthPDF").addEventListener("click",()=>{downloadHealthReport("pdf");picker.remove();});
  btn.parentElement.style.position="relative";
  btn.parentElement.appendChild(picker);
  setTimeout(()=>document.addEventListener("click",function h(e){
    if(!picker.contains(e.target)){picker.remove();document.removeEventListener("click",h);}
  }),50);
}


// ── Boot ──────────────────────────────────────────────────────────────────────
restoreInputs();
renderHistory();
initCitySearch();
initLangSelector();
