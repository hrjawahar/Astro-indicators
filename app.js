// ─────────────────────────────────────────────────────────────────────────────
//  Jyotish Precision Analyzer  |  app.js  |  v3.3  (Phase 3 — v2 branch)
//  Phase 3 additions over v3.2:
//  1. Per-AD insight engine — chart-specific indications for every Antardasha
//     using real Parashari rules: functional status, house placement, lordship,
//     D1/D9 synthesis, MD-AD relationship, 6/8/12 adverse positioning
//  2. Dasha screen redesigned — each AD now has an expandable indication panel
//  3. Current period block shows full structured reading
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
//  PHASE 3 — PER-AD INSIGHT ENGINE
//  All data tables and functions used by buildADReading()
// ══════════════════════════════════════════════════════════════════════════════

// Top-level SIGNS array (used by multiple functions)
const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

// Natural significations and body part rulerships per planet
// Planet natural significations and body rulerships
const PLANET_SIG = {
  Sun:     { themes:["authority","career recognition","government","father","soul purpose","leadership"],         body:"heart, spine, eyes, and vital force" },
  Moon:    { themes:["mind","emotions","mother","public dealings","travel","comfort","fluids"],                   body:"mind, chest, lungs, and blood" },
  Mars:    { themes:["energy","ambition","property","siblings","technical skill","courage","surgery"],            body:"blood, muscles, and bone marrow" },
  Mercury: { themes:["intellect","communication","trade","writing","education","analysis","skill"],               body:"nervous system, skin, and speech organs" },
  Jupiter: { themes:["wisdom","wealth","children","higher knowledge","dharma","expansion","grace"],               body:"liver, fat tissue, and hips" },
  Venus:   { themes:["relationships","beauty","luxury","arts","marriage","vehicles","comforts","creativity"],     body:"reproductive system, kidneys, and throat" },
  Saturn:  { themes:["discipline","longevity","hard work","service","detachment","karma","delays"],               body:"bones, joints, teeth, and nerves" },
  Rahu:    { themes:["ambition","foreign elements","technology","unconventional paths","obsession","illusion"],   body:"nervous system and skin (chronic conditions)" },
  Ketu:    { themes:["detachment","spirituality","research","past karma","sudden events","liberation"],           body:"wounds, mysterious ailments, and hidden conditions" },
};

// House significations
const HOUSE_SIG = {
  1:  { pos:"self-development, health improvements, personal reinvention, and new beginnings",        neg:"health sensitivity and ego conflicts" },
  2:  { pos:"financial accumulation, family harmony, speech opportunities, and savings growth",       neg:"family friction and financial pressure" },
  3:  { pos:"skill development, communication gains, short travel, and sibling cooperation",          neg:"sibling discord and impulsive decisions" },
  4:  { pos:"home stability, property matters, mother's wellbeing, and emotional peace",              neg:"domestic instability and property disputes" },
  5:  { pos:"creative intelligence, children, education, romance, and investment returns",            neg:"children-related worry and speculation losses" },
  6:  { pos:"defeating competition, service recognition, health recovery (if lord is benefic)",       neg:"health challenges, enemies, debts, and legal friction" },
  7:  { pos:"partnership activation, marriage harmony, business deals, and public dealings",          neg:"relationship friction and partnership disputes" },
  8:  { pos:"deep research, transformation, possible windfall or inheritance",                        neg:"health crisis, sudden reversals, and hidden obstacles" },
  9:  { pos:"fortune activation, father's wellbeing, higher wisdom, and long travel",                 neg:"loss of fortune, father's health, and dharmic confusion" },
  10: { pos:"career advancement, professional recognition, authority, and public success",             neg:"career setbacks and public scrutiny" },
  11: { pos:"income gains, wish fulfillment, social network expansion, and elder sibling support",    neg:"unfulfilled desires and social friction" },
  12: { pos:"spiritual growth, foreign opportunities, charitable acts, and inner retreats",            neg:"losses, hidden expenses, and isolation" },
};

// Planet theme chips for AD indication
const PLANET_THEME_CHIP = {
  Sun:"Authority & Career", Moon:"Mind & Emotions", Mars:"Energy & Property",
  Mercury:"Communication", Jupiter:"Wisdom & Wealth", Venus:"Relationships & Comforts",
  Saturn:"Discipline & Karma", Rahu:"Ambition & Change", Ketu:"Detachment & Spirit",
};

// Full domain label per house — used in every sentence where a house number is mentioned
const HOUSE_DOMAIN = {
  1:"self-image, health, and identity",
  2:"finances, family wealth, and speech",
  3:"skills, effort, communication, and siblings",
  4:"home, property, mother, and emotional peace",
  5:"children, creativity, investments, and education",
  6:"health challenges, enemies, debts, and competition",
  7:"partnerships, marriage, business deals, and career transitions",
  8:"transformation, sudden reversals, hidden crises, and inheritance",
  9:"fortune, father, higher knowledge, and long travel",
  10:"career, authority, public standing, and professional recognition",
  11:"income gains, social network, and wishes fulfilled",
  12:"losses, foreign matters, spiritual retreat, and hidden expenses",
};

// Short domain label — used in chips and brief references
const HOUSE_DOMAIN_SHORT = {
  1:"health & identity", 2:"finances & family", 3:"skills & communication",
  4:"home & property", 5:"children & creativity", 6:"health & competition",
  7:"partnerships & career transitions", 8:"sudden reversals & hidden crises",
  9:"fortune & father", 10:"career & authority", 11:"income & gains",
  12:"losses & spiritual retreat",
};

// Find which houses a planet lords for a given lagna
function getHousesLorded(planet, lagnaSign) {
  const lagnaIdx = SIGNS.indexOf(lagnaSign);
  const lorded = [];
  for (let h = 1; h <= 12; h++) {
    const s = SIGNS[(lagnaIdx + h - 1) % 12];
    if (SIGN_LORD[s] === planet) lorded.push(h);
  }
  return lorded;
}

// Parashari aspects
function getAspectedHouses(planet, houseNum) {
  if (!houseNum) return [];
  const aspects = new Set();
  aspects.add(((houseNum - 1 + 6) % 12) + 1);
  if (planet === "Mars")    { [3,7].forEach(n => aspects.add(((houseNum - 1 + n) % 12) + 1)); }
  if (planet === "Jupiter") { [4,8].forEach(n => aspects.add(((houseNum - 1 + n) % 12) + 1)); }
  if (planet === "Saturn")  { [2,9].forEach(n => aspects.add(((houseNum - 1 + n) % 12) + 1)); }
  if (planet === "Rahu" || planet === "Ketu") { [4,8].forEach(n => aspects.add(((houseNum - 1 + n) % 12) + 1)); }
  aspects.delete(houseNum);
  return [...aspects];
}

// ── CORE PER-AD READING BUILDER — domain-specific language ───────────────────
function buildADReading(mdLord, adLord, lagnaSign, houses, planets) {
  const d1HouseMap = buildPlanetHouseMap(houses);
  const combustSet = buildCombustSet(planets);

  const adFS     = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[adLord] || "N";
  const mdFS     = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[mdLord] || "N";
  const adHouse  = d1HouseMap[adLord];
  const mdHouse  = d1HouseMap[mdLord];
  const adSign   = planets[adLord]?.sign || "";
  const adDig    = getDignity(adLord, adSign);
  const adD9Sign = planets[adLord]?.d9sign || "";
  const adD9Dig  = adD9Sign ? getDignity(adLord, adD9Sign) : "";
  const adRetro  = planets[adLord]?.retrograde || false;
  const adCombust= combustSet.has(adLord);
  const mdAdRel  = getRelationshipTag(mdLord, adLord);
  const adLordedHouses = getHousesLorded(adLord, lagnaSign);

  let adFromMd = null;
  if (adHouse && mdHouse) adFromMd = ((adHouse - mdHouse + 12) % 12) + 1;
  const isAdverse = adFromMd && [6,8,12].includes(adFromMd);
  const isBenefic = ["B","Y"].includes(adFS);
  const isMalefic = adFS === "M";

  const goodLorded = adLordedHouses.filter(h => ![6,8,12].includes(h));
  const badLorded  = adLordedHouses.filter(h =>  [6,8,12].includes(h));

  const beneficAspectors = PLANET_LIST.filter(p => {
    if (p === adLord || !adHouse) return false;
    const pH = d1HouseMap[p]; if (!pH) return false;
    return getAspectedHouses(p, pH).includes(adHouse) && ["B","Y"].includes(FUNCTIONAL_STATUS_MAP[lagnaSign]?.[p] || "N");
  });
  const maleficAspectors = PLANET_LIST.filter(p => {
    if (p === adLord || !adHouse) return false;
    const pH = d1HouseMap[p]; if (!pH) return false;
    return getAspectedHouses(p, pH).includes(adHouse) && (FUNCTIONAL_STATUS_MAP[lagnaSign]?.[p] || "N") === "M";
  });

  // Helper — domain phrase for a list of houses
  function domainPhrase(hList) {
    return hList.map(h => HOUSE_DOMAIN_SHORT[h]).join(", ");
  }

  // ── 1. Period character ─────────────────────────────────────────────────
  const adHouseDomain = adHouse ? HOUSE_DOMAIN_SHORT[adHouse] : "";
  let character = "";
  if (adFS === "Y") {
    character = `${adLord} is a yogakaraka for your lagna — this sub-period carries genuine elevating power${adHouseDomain ? `, particularly around ${adHouseDomain}` : ""}. ${mdAdRel==="F"?"It flows smoothly with the main season.":"Some friction with the main season remains, but the period's positive potential is real."}`;
  } else if (isBenefic && adDig === "ex") {
    character = `${adLord} is exalted and benefic — a genuinely strong sub-period where its themes (${PLANET_THEME_CHIP[adLord]?.toLowerCase()}) deliver with unusual clarity${adHouseDomain ? `, especially in ${adHouseDomain}` : ""}.`;
  } else if (isBenefic) {
    character = `${adLord} is supportive for your lagna${mdAdRel==="F"?", in harmony with the "+mdLord+" main season":mdAdRel==="E"?", though in friction with the "+mdLord+" main season":""}. A constructive period for ${PLANET_THEME_CHIP[adLord]?.toLowerCase() || "its significations"}${adHouseDomain ? " and "+adHouseDomain : ""}.`;
  } else if (isMalefic && adDig === "de") {
    character = `${adLord} is both a functional malefic and debilitated — a demanding combination. ${adHouseDomain ? adHouseDomain.charAt(0).toUpperCase()+adHouseDomain.slice(1)+" are under stress." : ""} Consolidation over expansion is the posture here.`;
  } else if (isMalefic) {
    character = `${adLord} is a functional malefic for your lagna${mdAdRel==="E"?", and a natural enemy of "+mdLord+" — compounding the friction":""}. ${adHouseDomain ? "Its placement in H"+adHouse+" activates "+adHouseDomain+" under pressure. " : ""}This sub-period tests rather than gifts — awareness and restraint navigate it best.`;
  } else {
    character = `${adLord} is neutral for your lagna. ${adHouseDomain ? "Its H"+adHouse+" placement activates "+adHouseDomain+". " : ""}Results depend on current transits. ${mdAdRel==="F"?mdLord+" and "+adLord+" are natural friends, easing the flow.":mdAdRel==="E"?mdLord+" and "+adLord+" are natural enemies — an undercurrent of friction colours events.":""}`;
  }

  // ── 2. Theme chips ──────────────────────────────────────────────────────
  const chipType = isMalefic||adDig==="de" ? "chip-caution" : isBenefic ? "chip-positive" : "";
  const themes = [];
  if (PLANET_THEME_CHIP[adLord]) themes.push({ label: PLANET_THEME_CHIP[adLord], cls: chipType });
  if (adHouse) themes.push({ label: `H${adHouse} — ${HOUSE_DOMAIN_SHORT[adHouse]}`, cls: isMalefic?"chip-caution":"" });
  if (goodLorded.length) themes.push({ label: `Lords: ${domainPhrase(goodLorded.slice(0,2))}`, cls: isBenefic?"chip-positive":"" });
  if (isAdverse) themes.push({ label: `H${adFromMd} from ${mdLord} — tension`, cls: "chip-risk" });

  // ── 3. What Opens Up ────────────────────────────────────────────────────
  const opensUp = [];
  if (adHouse && isBenefic && HOUSE_SIG[adHouse]) {
    opensUp.push(`H${adHouse} (${HOUSE_DOMAIN_SHORT[adHouse]}): ${HOUSE_SIG[adHouse].pos.split(",").slice(0,2).join(", ")}.`);
  }
  if (goodLorded.length) {
    goodLorded.slice(0,2).forEach(h => {
      opensUp.push(`As lord of H${h} (${HOUSE_DOMAIN_SHORT[h]}): ${HOUSE_SIG[h]?.pos.split(",")[0]}.`);
    });
  }
  if (adDig==="ex")  opensUp.push(`Exalted in ${adSign} — ${adLord}'s significations around ${PLANET_THEME_CHIP[adLord]?.toLowerCase()} express at peak capacity.`);
  if (adDig==="own") opensUp.push(`Own sign ${adSign} — ${adLord} is comfortable; ${PLANET_THEME_CHIP[adLord]?.toLowerCase()} themes flow without impediment.`);
  if (adD9Dig==="ex"||adD9Dig==="own") opensUp.push(`D9 confirms strength — Navamsha shows ${adLord} ${adD9Dig==="ex"?"exalted":"in own sign"}: the promise deepens in maturity.`);
  if (beneficAspectors.length) opensUp.push(`${beneficAspectors.join(" & ")} casts a protective aspect — a supportive shield on this period.`);

  // ── 4. Handle With Care ─────────────────────────────────────────────────
  const handleWith = [];
  if (PLANET_SIG[adLord]) handleWith.push(`Body areas: ${PLANET_SIG[adLord].body} — monitor these during this sub-period.`);
  if (adHouse && HOUSE_SIG[adHouse]) {
    // Always show the placement domain — positive or negative framing based on planet status
    if (isMalefic || adDig==="de") {
      handleWith.push(`H${adHouse} (${HOUSE_DOMAIN_SHORT[adHouse]}) — ${HOUSE_SIG[adHouse].neg}: ${adLord} here under malefic status brings this domain under stress.`);
    } else if (!isBenefic) {
      handleWith.push(`H${adHouse} (${HOUSE_DOMAIN_SHORT[adHouse]}) — mixed outcomes; ${HOUSE_SIG[adHouse].neg} may also surface.`);
    }
  }
  if (maleficAspectors.length) handleWith.push(`${maleficAspectors.join(" & ")} aspects ${adLord} — additional pressure on ${adHouseDomain || "its domain"}.`);
  if (badLorded.length) {
    badLorded.forEach(h => handleWith.push(`As lord of H${h} (${HOUSE_DOMAIN_SHORT[h]}): ${HOUSE_SIG[h]?.neg}.`));
  }
  if (adRetro) handleWith.push(`Retrograde — ${PLANET_THEME_CHIP[adLord]?.toLowerCase() || "its themes"} surface indirectly, through delays or revisiting unresolved past matters.`);
  if (adD9Dig==="de") handleWith.push(`D9 debilitated — the D1 promise around ${PLANET_THEME_CHIP[adLord]?.toLowerCase()} may not sustain through maturity.`);

  // ── 5. Caution — domain-specific ─────────────────────────────────────────
  let caution = null;
  const lordedDomainText = adLordedHouses.length
    ? `As lord of ${adLordedHouses.map(h=>"H"+h+" ("+HOUSE_DOMAIN_SHORT[h]+")").join(" and ")}, those life areas carry the same tension.`
    : "";

  if (adFS==="M" && adDig==="de") {
    caution = `${adLord} is a functional malefic AND debilitated — ${adHouseDomain ? adHouseDomain+" themes are compromised. " : ""}${lordedDomainText} Avoid major decisions in these domains; focus on consolidation.`;
  } else if (isAdverse) {
    caution = `${adLord} occupies the ${adFromMd}th house from ${mdLord} — a 6/8/12 adversity. Even strong individual placements struggle when this friction exists. ${adHouseDomain ? "Be especially cautious around "+adHouseDomain+"." : ""}`;
  } else if (adCombust) {
    caution = `${adLord} is combust — its ${PLANET_THEME_CHIP[adLord]?.toLowerCase()} themes are dimmed by solar proximity. Avoid depending on ${adHouseDomain || "this domain"} for critical outcomes during this window.`;
  } else if (isMalefic) {
    const riskDomains = [adHouse, ...adLordedHouses].filter(Boolean).map(h => HOUSE_DOMAIN_SHORT[h]).filter(Boolean);
    caution = `${adLord} is a functional malefic — ${riskDomains.length ? riskDomains.slice(0,3).join(", ")+" themes" : "its domains"} require careful navigation. Avoid forcing outcomes in these areas; allow rather than push.`;
  }

  return { character, themes, opensUp: opensUp.slice(0,3), handleWith: handleWith.slice(0,3), caution, hasRisk: isMalefic||adDig==="de"||isAdverse||adCombust };
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
let _selectedPlace = null;
let _searchTimer   = null;

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
  // SIGNS is now a top-level constant
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


// ── Renders an AD indication panel from buildADReading() result ───────────────
function renderADIndicationHTML(adR) {
  const chipsHTML = adR.themes.map(t =>
    `<span class="adi-theme-chip ${t.cls}">${t.label}</span>`
  ).join("");

  const opensHTML = adR.opensUp.map(o =>
    `<div class="adi-line line-opens">${o}</div>`
  ).join("");

  const watchHTML = adR.handleWith.map(w =>
    `<div class="adi-line line-watch">${w}</div>`
  ).join("");

  return `
    <div class="adi-character">${adR.character}</div>
    ${chipsHTML ? `<div class="adi-themes">${chipsHTML}</div>` : ""}
    <div class="adi-body">
      ${opensHTML ? `<div class="adi-col">
        <div class="adi-col-label label-opens">What opens up</div>
        ${opensHTML}
      </div>` : ""}
      ${watchHTML ? `<div class="adi-col">
        <div class="adi-col-label label-watch">Handle with care</div>
        ${watchHTML}
      </div>` : ""}
    </div>
    ${adR.caution ? `<div class="adi-caution">⚠ ${adR.caution}</div>` : ""}
  `;
}

function renderDashaScreen(data) {
  const { dasha, d1 } = data;
  if (!dasha || !dasha.dashas) return;
  const lagna  = d1.lagnaSign;
  const houses = d1.houses;
  const planets = data.planets;
  const today  = new Date().toISOString().split("T")[0];

  let currentMaha = null, currentAntar = null;
  for (const d of dasha.dashas) {
    if (d.startDate <= today && today < d.endDate) {
      currentMaha = d;
      for (const a of d.antarDasas || []) {
        if (a.startDate <= today && today < a.endDate) { currentAntar = a; break; }
      }
      break;
    }
  }

  // ── Current period card — full structured reading ─────────────────────────
  const cdEl = document.getElementById("currentDashaDisplay");
  if (cdEl && currentMaha) {
    const mahaFS   = FUNCTIONAL_STATUS_MAP[lagna]?.[currentMaha.lord] || "N";
    const mahaNote = mahaFS==="Y"?"This planet is a yogakaraka for your lagna — a powerful season in your life."
                   : mahaFS==="B"?"This planet is a functional benefic — this season generally favours growth."
                   : mahaFS==="M"?"This planet is a functional malefic — this season brings tests requiring patience."
                   : "This planet is neutral for your lagna — mixed results, shaped by the sub-periods.";

    let adIndHTML = "";
    if (currentAntar) {
      const adR = buildADReading(currentMaha.lord, currentAntar.lord, lagna, houses, planets);
      adIndHTML = `
        <div class="cd-ad-indication">
          <div class="cd-ad-label">Current sub-period reading — ${currentAntar.lord} Antardasha</div>
          ${renderADIndicationHTML(adR)}
        </div>`;
    }

    cdEl.innerHTML = `
      <div class="current-dasha-display">
        <div class="cd-block">
          <div class="cd-label">Maha Dasa (Major Period / Season)</div>
          <div class="cd-lord">${PLANET_GLYPHS_FULL[currentMaha.lord]||""} ${currentMaha.lord}</div>
          <div class="cd-dates">${currentMaha.startDate} → ${currentMaha.endDate}</div>
          <div class="cd-note">${mahaNote}</div>
        </div>
        <div class="cd-block">
          <div class="cd-label">Antar Dasa (Sub-Period / Month within the Season)</div>
          <div class="cd-lord">${currentAntar?(PLANET_GLYPHS_FULL[currentAntar.lord]||"")+" "+currentAntar.lord:"—"}</div>
          <div class="cd-dates">${currentAntar?currentAntar.startDate+" → "+currentAntar.endDate:"—"}</div>
          <div class="cd-note">${currentAntar?"The Antar Dasa planet colours the specific events unfolding now.":""}</div>
        </div>
        <div class="cd-block">
          <div class="cd-label">Moon Nakshatra</div>
          <div class="cd-lord">${dasha.nakshatra}</div>
          <div class="cd-dates">Dasa starts with: ${dasha.nakshataLord}</div>
          <div class="cd-note">The Moon's nakshatra at birth determines the starting point of your Vimshottari Dasha sequence.</div>
        </div>
      </div>
      ${adIndHTML}`;
  }

  // ── Full timeline ─────────────────────────────────────────────────────────
  const timeline = document.getElementById("dashaTimeline");
  if (!timeline) return;
  timeline.innerHTML = "";
  const nowMs = new Date().getTime();

  dasha.dashas.forEach(d => {
    const isCurrent = d.startDate <= today && today < d.endDate;
    const dStart = new Date(d.startDate).getTime();
    const dEnd   = new Date(d.endDate).getTime();
    const dLen   = dEnd - dStart;
    let progress = 0;
    if (isCurrent)    progress = Math.max(0,Math.min(100,((nowMs-dStart)/dLen)*100));
    else if (dEnd < nowMs) progress = 100;

    const fs      = FUNCTIONAL_STATUS_MAP[lagna]?.[d.lord] || "N";
    const fsLabel = fs==="Y"?"Yogakaraka ★":fs==="B"?"Benefic":fs==="M"?"Malefic":"Neutral";

    const row = document.createElement("div");
    row.className = "dasha-row" + (isCurrent?" current":"");

    // Build antar-dasa items with expandable AD indications
    const antarHTML = (d.antarDasas||[]).map(a => {
      const isCurAntar = a.startDate <= today && today < a.endDate;
      const adR  = buildADReading(d.lord, a.lord, lagna, houses, planets);
      const risk = adR.hasRisk;

      return `
        <div class="antar-item${isCurAntar?" current-antar":""}${risk?" antar-risk":""}">
          <div class="antar-main">
            <div class="antar-lord">${PLANET_GLYPHS_FULL[a.lord]||""} ${a.lord}</div>
            <div class="antar-dates">${a.startDate} → ${a.endDate}</div>
            <div class="antar-yrs">${a.years} yrs</div>
            <button class="ad-toggle" aria-expanded="false">Indication ▶</button>
          </div>
          <div class="ad-ind-panel" style="display:none">
            ${renderADIndicationHTML(adR)}
          </div>
        </div>`;
    }).join("");

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
      <div class="antar-list">${antarHTML}</div>`;

    // Toggle main MD row open/close
    row.querySelector(".dasha-header").addEventListener("click", () => row.classList.toggle("open"));
    if (isCurrent) row.classList.add("open");

    // Wire up individual AD indication toggles
    row.querySelectorAll(".ad-toggle").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const panel = btn.closest(".antar-item").querySelector(".ad-ind-panel");
        const isOpen = panel.style.display !== "none";
        panel.style.display = isOpen ? "none" : "block";
        btn.textContent = isOpen ? "Indication ▶" : "Indication ▼";
        btn.setAttribute("aria-expanded", String(!isOpen));
      });
    });

    // Auto-open current AD indication
    if (isCurrent && currentAntar) {
      const currentAntarItem = row.querySelector(".current-antar");
      if (currentAntarItem) {
        const panel = currentAntarItem.querySelector(".ad-ind-panel");
        const btn   = currentAntarItem.querySelector(".ad-toggle");
        if (panel) panel.style.display = "block";
        if (btn)   { btn.textContent = "Indication ▼"; btn.setAttribute("aria-expanded","true"); }
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
