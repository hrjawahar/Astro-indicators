// ─────────────────────────────────────────────────────────────────────────────
//  Jyotish Precision Analyzer  |  app.js  |  v3.3  (Phase 3 — v2 branch)
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
//  PHASE 3 — PRECISION DOMAIN ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

const PLANET_SIG = {
  Sun:     { body:"heart, spine, eyes, and vital force" },
  Moon:    { body:"chest, lungs, blood, and mental equilibrium" },
  Mars:    { body:"blood, muscles, and bone marrow" },
  Mercury: { body:"nervous system, skin, and speech organs" },
  Jupiter: { body:"liver, fat tissue, and hips" },
  Venus:   { body:"reproductive system, kidneys, and throat" },
  Saturn:  { body:"bones, joints, teeth, and nerves" },
  Rahu:    { body:"nervous system and skin (chronic or atypical conditions)" },
  Ketu:    { body:"wounds, mysterious ailments, and hidden or misdiagnosed conditions" },
};

const PLANET_THEME_CHIP = {
  Sun:"Authority & Career", Moon:"Mind & Emotions", Mars:"Energy & Property",
  Mercury:"Communication & Intellect", Jupiter:"Wisdom & Wealth",
  Venus:"Relationships & Comforts", Saturn:"Discipline & Karma",
  Rahu:"Ambition & Change", Ketu:"Detachment & Spirit",
};

const HOUSE_DOMAIN_SHORT = {
  1:"health and identity",  2:"finances and family wealth",
  3:"skills and communication",  4:"home, property, and mother",
  5:"children, creativity, and investments",  6:"health challenges, debts, and competition",
  7:"partnerships, marriage, and career transitions",
  8:"sudden reversals, hidden crises, and transformation",
  9:"fortune, father, and higher wisdom",  10:"career and public standing",
  11:"income, gains, and social network",  12:"losses, isolation, and spiritual retreat",
};

const HOUSE_SIG = {
  1:  { pos:"personal growth, health improvements, and new beginnings",             neg:"health vulnerability and ego conflicts" },
  2:  { pos:"financial accumulation, family harmony, and savings growth",            neg:"financial pressure and family friction" },
  3:  { pos:"skill development, communication gains, and sibling cooperation",       neg:"sibling discord and communication failures" },
  4:  { pos:"home stability, property gains, and emotional peace",                   neg:"domestic instability and property disputes" },
  5:  { pos:"children's progress, creative gains, education, and investments",       neg:"children-related worry and speculation losses" },
  6:  { pos:"defeating competition and overcoming obstacles",                        neg:"health challenges, legal friction, and debt pressure" },
  7:  { pos:"partnership harmony, marriage activation, business deals, and career transitions", neg:"relationship friction and partnership disputes" },
  8:  { pos:"research, transformation, and possible inheritance",                    neg:"sudden health crises, career disruptions, and hidden reversals" },
  9:  { pos:"fortune activation, father's wellbeing, and higher wisdom",             neg:"loss of fortune and father's health decline" },
  10: { pos:"career advancement, professional recognition, and public success",      neg:"career setbacks, forced job changes, and public scrutiny" },
  11: { pos:"income gains, wish fulfillment, and network expansion",                 neg:"financial shortfalls and unfulfilled desires" },
  12: { pos:"spiritual growth, foreign opportunities, and charitable gains",         neg:"hidden expenses, job loss, and isolation" },
};

function getHousesLorded(planet, lagnaSign) {
  const lagnaIdx = SIGNS.indexOf(lagnaSign);
  const lorded = [];
  for (let h = 1; h <= 12; h++) {
    if (SIGN_LORD[SIGNS[(lagnaIdx + h - 1) % 12]] === planet) lorded.push(h);
  }
  return lorded;
}

function getAspectedHouses(planet, houseNum) {
  if (!houseNum) return [];
  const a = new Set();
  a.add(((houseNum-1+6)%12)+1);
  if (planet==="Mars")    [3,7].forEach(n=>a.add(((houseNum-1+n)%12)+1));
  if (planet==="Jupiter") [4,8].forEach(n=>a.add(((houseNum-1+n)%12)+1));
  if (planet==="Saturn")  [2,9].forEach(n=>a.add(((houseNum-1+n)%12)+1));
  if (planet==="Rahu"||planet==="Ketu") [4,8].forEach(n=>a.add(((houseNum-1+n)%12)+1));
  a.delete(houseNum);
  return [...a];
}

function getPlanetaryInfluenceOnHouse(targetHouse, lagnaSign, d1HouseMap, excludePlanet) {
  const malefics=[], benefics=[];
  for (const p of PLANET_LIST) {
    if (p===excludePlanet) continue;
    const pH=d1HouseMap[p]; if (!pH) continue;
    const inHouse=pH===targetHouse, aspects=getAspectedHouses(p,pH).includes(targetHouse);
    if (!inHouse&&!aspects) continue;
    const pFS=FUNCTIONAL_STATUS_MAP[lagnaSign]?.[p]||"N";
    const how=inHouse?"sits in H"+targetHouse:"aspects H"+targetHouse;
    if (pFS==="M") malefics.push({planet:p,how});
    else if (["B","Y"].includes(pFS)) benefics.push({planet:p,how});
  }
  return {malefics,benefics};
}

// ── In-memory cache — keyed by "MD:AD:lagna" ─────────────────────────────────
const _indicationCache = new Map();
const _mdSeasonCache   = new Map();

// ── Build structured chart context for the prompt ────────────────────────────
function buildChartContext(lagnaSign, houses, planets) {
  const d1HouseMap = buildPlanetHouseMap(houses);
  const SIGNS_LIST  = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const combustSet  = buildCombustSet(planets);
  const warLosers   = buildWarSet(planets);

  // Planet details
  const planetLines = PLANET_LIST.map(p => {
    const pl  = planets[p]; if (!pl) return null;
    const h   = d1HouseMap[p] || "?";
    const dig = getDignity(p, pl.sign);
    const fs  = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[p] || "N";
    const fsLabel = fs==="Y"?"Yogakaraka":fs==="B"?"Functional Benefic":fs==="M"?"Functional Malefic":"Neutral";
    const lords   = getHousesLorded(p, lagnaSign).join(",");
    const aspects = getAspectedHouses(p, h).join(",");
    const flags   = [
      dig==="ex"?"Exalted":dig==="de"?"Debilitated":dig==="own"?"OwnSign":"",
      pl.retrograde?"Retrograde":"",
      combustSet.has(p)?"Combust":"",
      warLosers.has(p)?"WarLoser":"",
    ].filter(Boolean).join("|");
    return `${p}: H${h} ${pl.sign} ${pl.degree?.toFixed(1)}° D9:${pl.d9sign||"?"} Lords:H[${lords}] Aspects:H[${aspects}] ${fsLabel} ${flags||"—"}`;
  }).filter(Boolean);

  // House lords placement
  const houseLordLines = [];
  for (let h=1; h<=12; h++) {
    const sign = SIGNS_LIST[(SIGNS_LIST.indexOf(lagnaSign)+h-1)%12];
    const lord = SIGN_LORD[sign];
    const lordH = d1HouseMap[lord] || "?";
    houseLordLines.push(`H${h}(${sign}) lord=${lord} in H${lordH}`);
  }

  return `LAGNA: ${lagnaSign}\n\nPLANETS:\n${planetLines.join("\n")}\n\nHOUSE LORDS:\n${houseLordLines.join("  ")}`;
}

// ── Prompt builders ───────────────────────────────────────────────────────────
function buildMDPrompt(mdLord, lagnaSign, chartContext) {
  const fs = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[mdLord]||"N";
  const fsLabel = fs==="Y"?"yogakaraka (most constructive possible)":fs==="B"?"functional benefic (supportive)":fs==="M"?"functional malefic (testing, disciplining)":"neutral (mixed)";
  return `You are an expert Parashari Jyotishi with deep knowledge of classical Vedic astrology. Analyze this chart and write a Mahadasha season overview.

CHART DATA:
${chartContext}

MAHADASHA LORD: ${mdLord} — ${fsLabel} for ${lagnaSign} lagna

Write a season overview paragraph (4-6 sentences) for the ${mdLord} Mahadasha. Use the actual chart placements to reason. Cover:
1. The overall character of this season (summer/winter/mixed) and WHY based on specific placements
2. Which life domains will be most activated and how (career, health, relationships, finances, spirituality) — name specific events or tendencies, not generic phrases
3. How ${mdLord}'s house placement, dignity, lordship, and aspects shape the season
4. D9 (Navamsha) confirmation or contradiction of the D1 promise
5. Any dominant aspect pattern that modifies the season (benefic protection or malefic amplification)

Be specific: say "career disruption through forced job change" not "career challenges". Say "financial gains through partnerships or trade" not "financial improvement". Ground every statement in a specific placement from the chart data above.

Write in second person ("Your Saturn Mahadasha is..."). No bullet points. One flowing paragraph. No preamble.`;
}

function buildADPrompt(mdLord, adLord, lagnaSign, chartContext) {
  const mdFS = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[mdLord]||"N";
  const adFS = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[adLord]||"N";
  const mdLabel = mdFS==="Y"?"yogakaraka":mdFS==="B"?"functional benefic":mdFS==="M"?"functional malefic":"neutral";
  const adLabel = adFS==="Y"?"yogakaraka":adFS==="B"?"functional benefic":adFS==="M"?"functional malefic":"neutral";

  return `You are an expert Parashari Jyotishi. Analyze this birth chart and write a precise Antardasha indication.

CHART DATA:
${chartContext}

CONTEXT:
- Mahadasha (main season): ${mdLord} — ${mdLabel} for ${lagnaSign} lagna
- Antardasha (sub-period): ${adLord} — ${adLabel} for ${lagnaSign} lagna

Write a structured Antardasha reading with these exact sections. Each section must be grounded in specific chart placements — no generic statements:

**PERIOD CHARACTER**
One sentence: the essential nature of this sub-period within the main season. Include the MD-AD relationship (friends/enemies/neutral), functional status of both, and the specific domain activated by ${adLord}'s house placement.

**CAREER & PROFESSION**
Only include if ${adLord} has significant connection to H10, H7, H6, H1, or career karakas. State the specific event tendency (promotion, job change, loss, new opportunity, public recognition, conflict with authority). If no significant career factor, write "No significant career activation in this sub-period."

**HEALTH & BODY**
Always include. Name the specific body areas (from ${adLord}'s natural rulership). If ${adLord} is malefic and in H6/H8/H1 or lords those houses, state the specific health risk. If benefic aspects protect H1, name the protection. Never leave this vague.

**RELATIONSHIPS & PARTNERSHIPS**
Only include if ${adLord} connects to H7, H2, H12, or Venus is significantly involved. State whether marriage/partnership is activated constructively or under stress, and what kind of relationship event is likely (marriage opportunity, separation pressure, business partnership, public disputes). If no factor, write "No significant relationship activation."

**FINANCES & WEALTH**
Only include if ${adLord} connects to H2, H11, H9, H12, or Jupiter/Venus conditions are significant. State the specific financial tendency (income growth, unexpected expenses, financial drain, windfall). If no factor, write "No significant financial activation."

**TIMING NOTE**
One sentence: when within this sub-period are conditions most intense (beginning, middle, end) based on the planetary strength and D9 condition.

Ground every statement in the actual placement data. Use plain language. No preamble or postamble.`;
}

// ── API caller with streaming into a target element ──────────────────────────
async function callIndicationAPI(prompt, targetEl, cacheKey, cacheMap) {
  // Show loading state
  targetEl.innerHTML = `<div class="ind-loading"><span class="spinner"></span> Generating indication from chart data…</div>`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);

    targetEl.innerHTML = `<div class="ind-content"></div>`;
    const contentEl = targetEl.querySelector(".ind-content");
    let fullText = "";

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.delta?.text || "";
          if (delta) {
            fullText += delta;
            contentEl.innerHTML = markdownToHTML(fullText);
          }
        } catch {}
      }
    }

    // Cache the final result
    cacheMap.set(cacheKey, fullText);

  } catch (err) {
    targetEl.innerHTML = `<div class="ind-error">Could not generate indication: ${err.message}</div>`;
  }
}

// ── Minimal markdown → HTML converter for the indication output ──────────────
function markdownToHTML(md) {
  return md
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3} (.+)$/gm, '<div class="ind-section-title">$1</div>')
    .replace(/^\*\*([^*]+)\*\*$/gm, '<div class="ind-section-title">$1</div>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>').replace(/$/, '</p>')
    .replace(/<p><div/g,'<div').replace(/<\/div><\/p>/g,'</div>')
    .replace(/<p><\/p>/g,'')
    .replace(/<p><br>/g,'<p>');
}

// ── Synchronous chips — instant preview before API returns ────────────────────
function buildQuickChips(adLord, lagnaSign, houses, planets) {
  const d1HouseMap  = buildPlanetHouseMap(houses);
  const combustSet  = buildCombustSet(planets);
  const adFS        = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[adLord]||"N";
  const adHouse     = d1HouseMap[adLord];
  const adSign      = planets[adLord]?.sign||"";
  const adDig       = getDignity(adLord,adSign);
  const adRetro     = planets[adLord]?.retrograde||false;
  const adCombust   = combustSet.has(adLord);
  const adLorded    = getHousesLorded(adLord,lagnaSign);
  const isMalefic   = adFS==="M", isBenefic=["B","Y"].includes(adFS);
  const goodLorded  = adLorded.filter(h=>![6,8,12].includes(h));

  const chipType = isMalefic||adDig==="de"?"chip-caution":isBenefic?"chip-positive":"";
  const chips = [];
  if (PLANET_THEME_CHIP[adLord]) chips.push({label:PLANET_THEME_CHIP[adLord],cls:chipType});
  if (adHouse) chips.push({label:`H${adHouse} — ${HOUSE_DOMAIN_SHORT[adHouse]}`,cls:isMalefic?"chip-caution":""});
  if (goodLorded.length) chips.push({label:`Lords: ${goodLorded.slice(0,2).map(h=>HOUSE_DOMAIN_SHORT[h]).join(", ")}`,cls:isBenefic?"chip-positive":""});
  const adFromMd_check = adFS; // placeholder — we don't have mdHouse here
  if (adDig==="ex")  chips.push({label:`Exalted ${adSign}`,cls:"chip-positive"});
  if (adDig==="de")  chips.push({label:`Debilitated ${adSign}`,cls:"chip-caution"});
  if (adRetro)       chips.push({label:"Retrograde ℞",cls:"chip-caution"});
  if (adCombust)     chips.push({label:"Combust ☀",cls:"chip-caution"});

  return chips.map(c=>`<span class="adi-theme-chip ${c.cls}">${c.label}</span>`).join("");
}


function renderDashaScreen(data) {
  const { dasha, d1 } = data;
  if (!dasha || !dasha.dashas) return;
  const lagna   = d1.lagnaSign;
  const houses  = d1.houses;
  const planets = data.planets;
  const today   = new Date().toISOString().split("T")[0];
  const chartCtx = buildChartContext(lagna, houses, planets);

  let currentMaha = null, currentAntar = null;
  for (const d of dasha.dashas) {
    if (d.startDate <= today && today < d.endDate) {
      currentMaha = d;
      for (const a of d.antarDasas||[]) {
        if (a.startDate <= today && today < a.endDate) { currentAntar=a; break; }
      }
      break;
    }
  }

  // ── Current period card ─────────────────────────────────────────────────
  const cdEl = document.getElementById("currentDashaDisplay");
  if (cdEl && currentMaha) {
    const mahaFS  = FUNCTIONAL_STATUS_MAP[lagna]?.[currentMaha.lord]||"N";
    const mahaTag = mahaFS==="Y"?"Yogakaraka":mahaFS==="B"?"Benefic":mahaFS==="M"?"Malefic":"Neutral";

    let adPanelHTML = "";
    if (currentAntar) {
      const chips = buildQuickChips(currentAntar.lord, lagna, houses, planets);
      adPanelHTML = `
        <div class="cd-ad-indication">
          <div class="cd-ad-label">Current sub-period — ${currentAntar.lord} Antardasha</div>
          ${chips ? `<div class="adi-themes">${chips}</div>` : ""}
          <div class="ad-api-panel" id="currentAdPanel"></div>
        </div>`;
    }

    cdEl.innerHTML = `
      <div class="current-dasha-display">
        <div class="cd-block">
          <div class="cd-label">Maha Dasa</div>
          <div class="cd-lord">${PLANET_GLYPHS_FULL[currentMaha.lord]||""} ${currentMaha.lord}</div>
          <div class="cd-dates">${currentMaha.startDate} → ${currentMaha.endDate}</div>
          <div class="cd-note">${mahaTag} for your lagna</div>
        </div>
        <div class="cd-block">
          <div class="cd-label">Antar Dasa</div>
          <div class="cd-lord">${currentAntar?(PLANET_GLYPHS_FULL[currentAntar.lord]||"")+" "+currentAntar.lord:"—"}</div>
          <div class="cd-dates">${currentAntar?currentAntar.startDate+" → "+currentAntar.endDate:"—"}</div>
        </div>
        <div class="cd-block">
          <div class="cd-label">Moon Nakshatra</div>
          <div class="cd-lord">${dasha.nakshatra}</div>
          <div class="cd-dates">Starts: ${dasha.nakshataLord}</div>
        </div>
      </div>
      ${adPanelHTML}`;

    // Auto-load current AD indication
    if (currentAntar) {
      const panelEl = document.getElementById("currentAdPanel");
      if (panelEl) {
        const cacheKey = `${currentMaha.lord}:${currentAntar.lord}:${lagna}`;
        if (_indicationCache.has(cacheKey)) {
          panelEl.innerHTML = `<div class="ind-content">${markdownToHTML(_indicationCache.get(cacheKey))}</div>`;
        } else {
          const prompt = buildADPrompt(currentMaha.lord, currentAntar.lord, lagna, chartCtx);
          callIndicationAPI(prompt, panelEl, cacheKey, _indicationCache);
        }
      }
    }
  }

  // ── Full timeline ────────────────────────────────────────────────────────
  const timeline = document.getElementById("dashaTimeline");
  if (!timeline) return;
  timeline.innerHTML = "";
  const nowMs = new Date().getTime();

  dasha.dashas.forEach(d => {
    const isCurrent = d.startDate <= today && today < d.endDate;
    const dStart=new Date(d.startDate).getTime(), dEnd=new Date(d.endDate).getTime();
    let progress=0;
    if (isCurrent) progress=Math.max(0,Math.min(100,((nowMs-dStart)/(dEnd-dStart))*100));
    else if (dEnd<nowMs) progress=100;

    const fs=FUNCTIONAL_STATUS_MAP[lagna]?.[d.lord]||"N";
    const fsLabel=fs==="Y"?"Yogakaraka ★":fs==="B"?"Benefic":fs==="M"?"Malefic":"Neutral";
    const mdCacheKey = `season:${d.lord}:${lagna}`;

    const antarHTML=(d.antarDasas||[]).map(a => {
      const isCurAntar=a.startDate<=today&&today<a.endDate;
      const chips=buildQuickChips(a.lord,lagna,houses,planets);
      const adCacheKey=`${d.lord}:${a.lord}:${lagna}`;
      return `
        <div class="antar-item${isCurAntar?" current-antar":""}">
          <div class="antar-main">
            <div class="antar-lord">${PLANET_GLYPHS_FULL[a.lord]||""} ${a.lord}</div>
            <div class="antar-dates">${a.startDate} → ${a.endDate}</div>
            <div class="antar-yrs">${a.years} yrs</div>
            <button class="ad-toggle" data-md="${d.lord}" data-ad="${a.lord}" aria-expanded="false">Indication ▶</button>
          </div>
          <div class="ad-ind-panel" style="display:none">
            ${chips?`<div class="adi-themes" style="padding:10px 14px 0">${chips}</div>`:""}
            <div class="ad-api-panel" data-cache="${adCacheKey}"></div>
          </div>
        </div>`;
    }).join("");

    const row = document.createElement("div");
    row.className = "dasha-row"+(isCurrent?" current":"");
    row.innerHTML = `
      <div class="dasha-header">
        <div class="dasha-planet-glyph">${PLANET_GLYPHS_FULL[d.lord]||""}</div>
        <div>
          <div class="dasha-lord">${d.lord}</div>
          <div style="font-size:11px;color:var(--text-dim)">${fsLabel}</div>
        </div>
        <div class="dasha-dates">${d.startDate}<br>${d.endDate}</div>
        <div class="dasha-years">${d.years} yrs</div>
        <div class="dasha-expand">${isCurrent?"▼":"▶"}</div>
      </div>
      <div class="dasha-bar-wrap"><div class="dasha-bar" style="width:${progress}%"></div></div>
      <div class="antar-list">
        <div class="md-season-block">
          <div class="md-season-label">Season Overview</div>
          <div class="ad-api-panel md-api-panel" data-md-cache="${mdCacheKey}"></div>
        </div>
        ${antarHTML}
      </div>`;

    // Toggle MD row open — lazy load season overview on first open
    row.querySelector(".dasha-header").addEventListener("click", () => {
      row.classList.toggle("open");
      if (row.classList.contains("open")) {
        const seasonPanel = row.querySelector(".md-api-panel");
        if (seasonPanel && !seasonPanel.dataset.loaded) {
          seasonPanel.dataset.loaded = "true";
          if (_mdSeasonCache.has(mdCacheKey)) {
            seasonPanel.innerHTML = `<div class="ind-content">${markdownToHTML(_mdSeasonCache.get(mdCacheKey))}</div>`;
          } else {
            const prompt = buildMDPrompt(d.lord, lagna, chartCtx);
            callIndicationAPI(prompt, seasonPanel, mdCacheKey, _mdSeasonCache);
          }
        }
      }
    });

    if (isCurrent) {
      row.classList.add("open");
      const seasonPanel = row.querySelector(".md-api-panel");
      if (seasonPanel) {
        seasonPanel.dataset.loaded = "true";
        if (_mdSeasonCache.has(mdCacheKey)) {
          seasonPanel.innerHTML = `<div class="ind-content">${markdownToHTML(_mdSeasonCache.get(mdCacheKey))}</div>`;
        } else {
          const prompt = buildMDPrompt(d.lord, lagna, chartCtx);
          callIndicationAPI(prompt, seasonPanel, mdCacheKey, _mdSeasonCache);
        }
      }
    }

    // AD toggle — lazy load indication on first open
    row.querySelectorAll(".ad-toggle").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const item  = btn.closest(".antar-item");
        const panel = item.querySelector(".ad-ind-panel");
        const isOpen = panel.style.display !== "none";
        panel.style.display = isOpen ? "none" : "block";
        btn.textContent  = isOpen ? "Indication ▶" : "Indication ▼";
        btn.setAttribute("aria-expanded", String(!isOpen));

        if (!isOpen) {
          const apiPanel = item.querySelector(".ad-api-panel");
          if (apiPanel && !apiPanel.dataset.loaded) {
            apiPanel.dataset.loaded = "true";
            const cacheKey = apiPanel.dataset.cache;
            if (_indicationCache.has(cacheKey)) {
              apiPanel.innerHTML = `<div class="ind-content">${markdownToHTML(_indicationCache.get(cacheKey))}</div>`;
            } else {
              const mdL = btn.dataset.md, adL = btn.dataset.ad;
              const prompt = buildADPrompt(mdL, adL, lagna, chartCtx);
              callIndicationAPI(prompt, apiPanel, cacheKey, _indicationCache);
            }
          }
        }
      });
    });

    // Auto-open current AD
    if (isCurrent && currentAntar) {
      const curItem = row.querySelector(".current-antar");
      if (curItem) {
        const panel   = curItem.querySelector(".ad-ind-panel");
        const btn     = curItem.querySelector(".ad-toggle");
        const apiPanel= curItem.querySelector(".ad-api-panel");
        if (panel) panel.style.display = "block";
        if (btn)  { btn.textContent="Indication ▼"; btn.setAttribute("aria-expanded","true"); }
        if (apiPanel && !apiPanel.dataset.loaded) {
          apiPanel.dataset.loaded = "true";
          const cacheKey = apiPanel.dataset.cache;
          if (_indicationCache.has(cacheKey)) {
            apiPanel.innerHTML = `<div class="ind-content">${markdownToHTML(_indicationCache.get(cacheKey))}</div>`;
          } else {
            const mdL = btn?.dataset.md || d.lord;
            const adL = btn?.dataset.ad || currentAntar.lord;
            const prompt = buildADPrompt(mdL, adL, lagna, chartCtx);
            callIndicationAPI(prompt, apiPanel, cacheKey, _indicationCache);
          }
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
let _suppressSearch = false;

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

// ── Boot ──────────────────────────────────────────────────────────────────────
restoreInputs();
renderHistory();
initCitySearch();
initLangSelector();
