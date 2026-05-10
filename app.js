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
// ══════════════════════════════════════════════════════════════════════════════
//  PHASE 3 — PRECISION DOMAIN ENGINE
//  Design rules:
//  1. Only flag a domain when 2+ independent classical factors converge
//  2. The reason for every flag is always one specific sentence — not generic
//  3. MD season = rich multi-factor paragraph written once per Mahadasha
//  4. AD panel = character + chips + opens/watch + compact domain intensity strip
// ══════════════════════════════════════════════════════════════════════════════

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
  1:  { pos:"personal growth, health improvements, and new beginnings", neg:"health vulnerability and ego conflicts" },
  2:  { pos:"financial accumulation, family harmony, and savings growth", neg:"financial pressure and family friction" },
  3:  { pos:"skill development, communication gains, and sibling cooperation", neg:"sibling discord and communication failures" },
  4:  { pos:"home stability, property gains, and emotional peace", neg:"domestic instability and property disputes" },
  5:  { pos:"children's progress, creative gains, education, and investments", neg:"children-related worry and speculation losses" },
  6:  { pos:"defeating competition and overcoming obstacles", neg:"health challenges, legal friction, and debt pressure" },
  7:  { pos:"partnership harmony, marriage activation, business deals, and career transitions", neg:"relationship friction and partnership disputes" },
  8:  { pos:"research, transformation, and possible inheritance", neg:"sudden health crises, career disruptions, and hidden reversals" },
  9:  { pos:"fortune activation, father's wellbeing, and higher wisdom", neg:"loss of fortune and father's health decline" },
  10: { pos:"career advancement, professional recognition, and public success", neg:"career setbacks, forced job changes, and public scrutiny" },
  11: { pos:"income gains, wish fulfillment, and network expansion", neg:"financial shortfalls and unfulfilled desires" },
  12: { pos:"spiritual growth, foreign opportunities, and charitable gains", neg:"hidden expenses, job loss, and isolation" },
};

// Find which houses a planet lords
function getHousesLorded(planet, lagnaSign) {
  const lagnaIdx = SIGNS.indexOf(lagnaSign);
  const lorded = [];
  for (let h = 1; h <= 12; h++) {
    if (SIGN_LORD[SIGNS[(lagnaIdx + h - 1) % 12]] === planet) lorded.push(h);
  }
  return lorded;
}

// Parashari aspects
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

// Get all planets (by functional status) that sit in or aspect a target house
function getPlanetaryInfluenceOnHouse(targetHouse, lagnaSign, d1HouseMap, excludePlanet) {
  const malefics=[], benefics=[];
  for (const p of PLANET_LIST) {
    if (p===excludePlanet) continue;
    const pH=d1HouseMap[p]; if (!pH) continue;
    const inHouse = pH===targetHouse;
    const aspects = getAspectedHouses(p,pH).includes(targetHouse);
    if (!inHouse && !aspects) continue;
    const pFS = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[p]||"N";
    const how = inHouse?"sits in H"+targetHouse:"aspects H"+targetHouse;
    if (pFS==="M") malefics.push({planet:p,how});
    else if (["B","Y"].includes(pFS)) benefics.push({planet:p,how});
  }
  return {malefics, benefics};
}

// ── MD SEASON BUILDER — one rich paragraph per Mahadasha ─────────────────────
function buildMDSeason(mdLord, lagnaSign, houses, planets) {
  const d1HouseMap  = buildPlanetHouseMap(houses);
  const mdFS        = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[mdLord]||"N";
  const mdHouse     = d1HouseMap[mdLord];
  const mdSign      = planets[mdLord]?.sign||"";
  const mdDig       = getDignity(mdLord,mdSign);
  const mdD9Sign    = planets[mdLord]?.d9sign||"";
  const mdD9Dig     = mdD9Sign?getDignity(mdLord,mdD9Sign):"";
  const mdRetro     = planets[mdLord]?.retrograde||false;
  const mdLorded    = getHousesLorded(mdLord,lagnaSign);
  const mdAspects   = mdHouse?getAspectedHouses(mdLord,mdHouse):[];
  const infl        = mdHouse?getPlanetaryInfluenceOnHouse(mdHouse,lagnaSign,d1HouseMap,mdLord):{malefics:[],benefics:[]};

  const isMalefic   = mdFS==="M";
  const isBenefic   = ["B","Y"].includes(mdFS);
  const isYoga      = mdFS==="Y";

  // Season tone
  let tone="";
  if (isYoga && mdDig==="ex") tone="an extraordinary summer";
  else if (isYoga) tone="a powerful summer";
  else if (isBenefic && mdDig==="ex") tone="a strong, productive season";
  else if (isBenefic && mdDig==="own") tone="a settled, constructive season";
  else if (isBenefic) tone="a generally supportive season";
  else if (isMalefic && mdDig==="de") tone="a demanding winter — one of the most testing seasons";
  else if (isMalefic) tone="a winter — a testing season that disciplines more than it gifts";
  else tone="a mixed season — neither fully supportive nor purely testing";

  // House placement colour
  let placementNote="";
  if (mdHouse) {
    const domain = HOUSE_DOMAIN_SHORT[mdHouse];
    if (isMalefic && [6,8,12].includes(mdHouse)) {
      placementNote=` ${mdLord} sits in H${mdHouse} (${domain}), compounding the seasonal difficulty — the lord of this period is itself placed in adversity.`;
    } else if (isBenefic && [1,4,7,10].includes(mdHouse)) {
      placementNote=` ${mdLord} sits in H${mdHouse} (${domain}), a kendra house — giving structural strength to the season's positive themes.`;
    } else if (mdHouse) {
      placementNote=` ${mdLord}'s position in H${mdHouse} (${domain}) shapes where the season's energy concentrates.`;
    }
  }

  // Lorded houses theme
  const goodLorded = mdLorded.filter(h=>![6,8,12].includes(h));
  const badLorded  = mdLorded.filter(h=>[6,8,12].includes(h));
  let lordNote="";
  if (goodLorded.length && isBenefic) {
    lordNote=` As lord of ${goodLorded.map(h=>"H"+h+" ("+HOUSE_DOMAIN_SHORT[h]+")").join(" and ")}, the season strongly activates these life areas.`;
  } else if (badLorded.length && isMalefic) {
    lordNote=` ${mdLord} also lords ${badLorded.map(h=>"H"+h+" ("+HOUSE_DOMAIN_SHORT[h]+")").join(" and ")} — these domains carry the seasonal pressure most acutely.`;
  } else if (mdLorded.length) {
    lordNote=` The season's themes concentrate in ${mdLorded.map(h=>"H"+h+" ("+HOUSE_DOMAIN_SHORT[h]+")").join(" and ")}.`;
  }

  // Dignity note
  let digNote="";
  if (mdDig==="ex") digNote=` ${mdLord} is exalted in ${mdSign} — the season operates at peak intensity; its promises and its tests both arrive with unusual force.`;
  else if (mdDig==="de") digNote=` ${mdLord} is debilitated in ${mdSign} — the season's energy is suppressed at source, making its themes difficult to express constructively.`;
  else if (mdDig==="own") digNote=` ${mdLord} in own sign ${mdSign} — the season runs steadily, without extremes.`;

  // D9 note
  let d9Note="";
  if (mdD9Dig==="ex"||mdD9Dig==="own") d9Note=` D9 shows ${mdLord} ${mdD9Dig==="ex"?"exalted":"in own sign"} in Navamsha — the season deepens and delivers more fully in the second half of its span.`;
  else if (mdD9Dig==="de") d9Note=` D9 shows ${mdLord} debilitated in Navamsha — the season's early promise tends to weaken; the second half can feel harder than the first.`;

  // Aspects and protection
  let aspectNote="";
  if (infl.benefics.length) aspectNote+=` ${infl.benefics.map(b=>b.planet).join(" and ")} ${infl.benefics.length>1?"cast protective aspects":"casts a protective aspect"} on ${mdLord}'s position — a moderating grace within the season.`;
  if (infl.malefics.length) aspectNote+=` ${infl.malefics.map(m=>m.planet).join(" and ")} ${infl.malefics.length>1?"afflict":"afflicts"} ${mdLord}'s position — an additional layer of resistance within an already testing season.`;

  // Retrograde
  let retroNote="";
  if (mdRetro) retroNote=` ${mdLord} is retrograde — the season's themes surface in indirect, introspective, or revisited ways. Past matters connected to ${mdLord}'s domains tend to resurface for resolution.`;

  const para = `The ${mdLord} Mahadasha is ${tone}.${placementNote}${lordNote}${digNote}${d9Note}${aspectNote}${retroNote}`;
  return para;
}

// ── DOMAIN INTENSITY SCORER — returns { level, reason } or null ──────────────
// level: "high" | "medium" | "low" | null
// reason: one precise sentence explaining WHY

function scoreDomain_Career(adLord, adHouse, adDig, adD9Dig, adFS, lagnaSign, d1HouseMap, adLordedHouses) {
  let score=0, reasons=[];
  const isMalefic=adFS==="M", isBenefic=["B","Y"].includes(adFS);
  const lordsH10=adLordedHouses.includes(10), lordsH7=adLordedHouses.includes(7);
  const adInAdverse=adHouse&&[6,8,12].includes(adHouse);
  const h10Infl=getPlanetaryInfluenceOnHouse(10,lagnaSign,d1HouseMap,adLord);
  const h10Sign=SIGNS[(SIGNS.indexOf(lagnaSign)+9)%12];
  const h10Lord=SIGN_LORD[h10Sign];
  const h10House=d1HouseMap[h10Lord];
  const h10LordAdverse=h10House&&[6,8,12].includes(h10House);

  if (lordsH10&&isMalefic&&adInAdverse){score+=3;reasons.push(`${adLord} lords career (H10) and sits in H${adHouse} (${HOUSE_DOMAIN_SHORT[adHouse]}) as a malefic — career lord in adversity`);}
  else if (lordsH10&&isMalefic){score+=2;reasons.push(`${adLord} lords career (H10) as a functional malefic — career domain under pressure`);}
  else if (lordsH10&&adInAdverse){score+=1;reasons.push(`${adLord} lords career (H10) and sits adversely in H${adHouse}`);}
  else if (lordsH10&&isBenefic&&(adDig==="ex"||adDig==="own")){score-=2;reasons.push(`${adLord} lords and strengthens career (H10) — professional advancement strongly supported`);}
  else if (lordsH10&&isBenefic){score-=1;reasons.push(`${adLord} lords career (H10) as a benefic — constructive career period`);}

  if (lordsH7&&isBenefic){score-=1;reasons.push(`${adLord} lords H7 (career transitions) as a benefic — favourable career moves or partnerships`);}
  else if (lordsH7&&isMalefic){score+=1;reasons.push(`${adLord} lords H7 (career transitions) as a malefic — career changes may feel forced`);}

  if (h10Infl.malefics.length&&isMalefic){score+=1;reasons.push(`${h10Infl.malefics.map(m=>m.planet).join("/")} also afflicts H10 — compounding career stress`);}
  if (h10LordAdverse&&!lordsH10){score+=1;reasons.push(`H10 lord (${h10Lord}) sits in H${h10House} (${HOUSE_DOMAIN_SHORT[h10House]}) — structural career vulnerability`);}

  if (adDig==="ex"&&lordsH10){score-=1;}
  if (adD9Dig==="de"&&lordsH10&&isMalefic){score+=1;}
  if (h10Infl.benefics.length&&score>0){score-=1;reasons.push(`Protected: ${h10Infl.benefics.map(b=>b.planet).join("/")} aspects H10`);}

  const primary=reasons[0]||null;
  if (score>=3) return {level:"high",   reason:primary, protection:h10Infl.benefics.length?h10Infl.benefics.map(b=>b.planet).join(" & ")+" aspects H10":null};
  if (score>=2) return {level:"medium", reason:primary, protection:h10Infl.benefics.length?h10Infl.benefics.map(b=>b.planet).join(" & ")+" aspects H10":null};
  if (score>=1) return {level:"watch",  reason:primary, protection:null};
  if (score<=-1)return {level:"good",   reason:primary, protection:null};
  return null;
}

function scoreDomain_Health(adLord, adHouse, adDig, adD9Dig, adFS, lagnaSign, d1HouseMap, adLordedHouses, planets) {
  let score=0, reasons=[];
  const isMalefic=adFS==="M", isBenefic=["B","Y"].includes(adFS);
  const lordsH1=adLordedHouses.includes(1);
  const lordsH6=adLordedHouses.includes(6), lordsH8=adLordedHouses.includes(8);
  const adInAdverse=adHouse&&[6,8,12].includes(adHouse);
  const h1Infl=getPlanetaryInfluenceOnHouse(1,lagnaSign,d1HouseMap,adLord);
  const h1Lord=SIGN_LORD[lagnaSign];
  const h1House=d1HouseMap[h1Lord];
  const h1LordAdverse=h1House&&[6,8,12].includes(h1House);
  const moonSign=planets["Moon"]?.sign||"";
  const moonDig=getDignity("Moon",moonSign);
  const moonFS=FUNCTIONAL_STATUS_MAP[lagnaSign]?.["Moon"]||"N";

  if (lordsH1&&isMalefic){score+=2;reasons.push(`${adLord} lords your body and health (H1) as a functional malefic — vitality under direct stress`);}
  if (lordsH1&&adInAdverse){score+=1;reasons.push(`${adLord} lords H1 and sits in H${adHouse} — lagna lord placed adversely`);}
  if (isMalefic&&adHouse===6){score+=2;reasons.push(`${adLord} as malefic sits directly in H6 (illness house) — infections, inflammation, or energy depletion risk`);}
  if (isMalefic&&adHouse===8){score+=2;reasons.push(`${adLord} as malefic in H8 — sudden or unexpected health events classically indicated`);}
  if (lordsH6&&isMalefic){score+=1;reasons.push(`${adLord} lords H6 (disease house) as a malefic — illness themes activated`);}
  if (lordsH8&&isMalefic){score+=1;reasons.push(`${adLord} lords H8 (crisis house) as a malefic — sudden health vulnerability`);}
  if (h1Infl.malefics.length){score+=1;reasons.push(`${h1Infl.malefics.map(m=>m.planet).join("/")} afflicts H1 (lagna) — natal structural health stress`);}
  if (h1LordAdverse&&!lordsH1){score+=1;reasons.push(`Lagna lord (${h1Lord}) sits in H${h1House} — constitutional vulnerability`);}
  if ((moonDig==="de"||moonFS==="M")&&isMalefic){score+=1;reasons.push(`Moon afflicted — mental and emotional health also sensitised`);}
  if (adD9Dig==="de"&&isMalefic){score+=1;reasons.push(`D9 debilitated — health stress may persist or deepen rather than recover quickly`);}
  if (h1Infl.benefics.length){score-=1;}
  if (adD9Dig==="ex"||adD9Dig==="own"){score-=1;}

  const primary=reasons[0]||null;
  const bodyArea=PLANET_SIG[adLord]?.body||"";
  const protection=h1Infl.benefics.length?h1Infl.benefics.map(b=>b.planet).join(" & ")+" protects H1":null;

  if (score>=4) return {level:"high",   reason:primary, bodyArea, protection};
  if (score>=2) return {level:"medium", reason:primary, bodyArea, protection};
  if (score>=1) return {level:"watch",  reason:primary, bodyArea, protection};
  // Always return health entry for body area — even if no risk
  return {level:"body",   reason:null, bodyArea, protection};
}

function scoreDomain_Relationships(adLord, adHouse, adDig, adD9Dig, adFS, lagnaSign, d1HouseMap, adLordedHouses, planets) {
  let score=0, reasons=[];
  const isMalefic=adFS==="M", isBenefic=["B","Y"].includes(adFS);
  const lordsH7=adLordedHouses.includes(7);
  const adInAdverse=adHouse&&[6,8,12].includes(adHouse);
  const h7Infl=getPlanetaryInfluenceOnHouse(7,lagnaSign,d1HouseMap,adLord);
  const venusSign=planets["Venus"]?.sign||"";
  const venusDig=getDignity("Venus",venusSign);
  const venusFS=FUNCTIONAL_STATUS_MAP[lagnaSign]?.["Venus"]||"N";

  if (lordsH7&&isMalefic&&adInAdverse){score+=3;reasons.push(`${adLord} lords H7 (partnerships) as a malefic in H${adHouse} — relationship lord doubly stressed`);}
  else if (lordsH7&&isMalefic){score+=2;reasons.push(`${adLord} lords H7 (partnerships/marriage) as a functional malefic — relationship friction elevated`);}
  else if (lordsH7&&isBenefic&&!adInAdverse){score-=2;reasons.push(`${adLord} lords H7 as a benefic — partnerships, marriage, and career transitions constructively activated`);}
  if (adHouse===7&&isMalefic){score+=2;reasons.push(`${adLord} as malefic sits directly in H7 — partnership house under direct affliction`);}
  else if (adHouse===7&&isBenefic){score-=1;reasons.push(`${adLord} as benefic in H7 — favourable for partnerships and public dealings`);}
  if (h7Infl.malefics.length){score+=1;reasons.push(`${h7Infl.malefics.map(m=>m.planet).join("/")} afflicts H7 — natal relationship challenge amplified`);}
  if ((venusDig==="de"||venusFS==="M")&&isMalefic){score+=1;reasons.push(`Venus (relationship karaka) is ${venusDig==="de"?"debilitated":""} ${venusFS==="M"?"and malefic":""} — deep relationship sensitivity`);}
  if ((venusDig==="ex"||venusDig==="own")&&score>0){score-=1;}
  if (h7Infl.benefics.length&&score>0){score-=1;}

  const primary=reasons[0]||null;
  const protection=h7Infl.benefics.length?h7Infl.benefics.map(b=>b.planet).join(" & ")+" protects H7":null;
  if (score>=3) return {level:"high",   reason:primary, protection};
  if (score>=2) return {level:"medium", reason:primary, protection};
  if (score>=1) return {level:"watch",  reason:primary, protection};
  if (score<=-1)return {level:"good",   reason:primary, protection:null};
  return null;
}

function scoreDomain_Finances(adLord, adHouse, adDig, adD9Dig, adFS, lagnaSign, d1HouseMap, adLordedHouses) {
  let score=0, reasons=[];
  const isMalefic=adFS==="M", isBenefic=["B","Y"].includes(adFS);
  const lordsH2=adLordedHouses.includes(2), lordsH11=adLordedHouses.includes(11);
  const lordsH12=adLordedHouses.includes(12), lordsH9=adLordedHouses.includes(9);
  const adInAdverse=adHouse&&[6,8,12].includes(adHouse);
  const h2Infl=getPlanetaryInfluenceOnHouse(2,lagnaSign,d1HouseMap,adLord);
  const h11Infl=getPlanetaryInfluenceOnHouse(11,lagnaSign,d1HouseMap,adLord);

  if ((lordsH2||lordsH11)&&isBenefic&&(adDig==="ex"||adDig==="own")){score-=2;reasons.push(`${adLord} lords ${lordsH2?"H2 (wealth)":""}${lordsH2&&lordsH11?" and ":""}${lordsH11?"H11 (income)":""} with exalted/own strength — strong financial period`);}
  else if ((lordsH2||lordsH11)&&isBenefic){score-=1;reasons.push(`${adLord} lords ${lordsH2?"H2 (wealth)":""}${lordsH2&&lordsH11?" and ":""}${lordsH11?"H11 (income)":""} as a benefic — financial gains supported`);}
  else if ((lordsH2||lordsH11)&&isMalefic){score+=2;reasons.push(`${adLord} lords ${lordsH2?"H2 (finances)":""}${lordsH2&&lordsH11?" and ":""}${lordsH11?"H11 (income)":""} as a malefic — irregular income and financial pressure`);}

  if (lordsH12&&isMalefic){score+=2;reasons.push(`${adLord} lords H12 (losses and hidden expenses) as a malefic — financial drain and unplanned expenditure risk`);}
  if (adHouse===12&&isMalefic){score+=2;reasons.push(`${adLord} as malefic sits in H12 — money going out in ways difficult to track or control`);}
  if (h2Infl.malefics.length){score+=1;reasons.push(`${h2Infl.malefics.map(m=>m.planet).join("/")} afflicts H2 (wealth house) — natal financial vulnerability activated`);}
  if (h11Infl.malefics.length){score+=1;reasons.push(`${h11Infl.malefics.map(m=>m.planet).join("/")} afflicts H11 (income) — income irregularity risk`);}
  if (lordsH9&&isBenefic){score-=1;reasons.push(`${adLord} lords H9 (fortune) as a benefic — an undercurrent of luck supports outcomes`);}
  if (h2Infl.benefics.length&&score>0){score-=1;}

  const primary=reasons[0]||null;
  const protection=h2Infl.benefics.length?h2Infl.benefics.map(b=>b.planet).join(" & ")+" protects H2":null;
  if (score>=3) return {level:"high",   reason:primary, protection};
  if (score>=2) return {level:"medium", reason:primary, protection};
  if (score>=1) return {level:"watch",  reason:primary, protection};
  if (score<=-1)return {level:"good",   reason:primary, protection:null};
  return null;
}

// ── CORE AD READING BUILDER ───────────────────────────────────────────────────
function buildADReading(mdLord, adLord, lagnaSign, houses, planets) {
  const d1HouseMap    = buildPlanetHouseMap(houses);
  const combustSet    = buildCombustSet(planets);
  const adFS          = FUNCTIONAL_STATUS_MAP[lagnaSign]?.[adLord]||"N";
  const adHouse       = d1HouseMap[adLord];
  const mdHouse       = d1HouseMap[mdLord];
  const adSign        = planets[adLord]?.sign||"";
  const adDig         = getDignity(adLord,adSign);
  const adD9Sign      = planets[adLord]?.d9sign||"";
  const adD9Dig       = adD9Sign?getDignity(adLord,adD9Sign):"";
  const adRetro       = planets[adLord]?.retrograde||false;
  const adCombust     = combustSet.has(adLord);
  const mdAdRel       = getRelationshipTag(mdLord,adLord);
  const adLordedHouses= getHousesLorded(adLord,lagnaSign);
  const isMalefic     = adFS==="M";
  const isBenefic     = ["B","Y"].includes(adFS);
  const goodLorded    = adLordedHouses.filter(h=>![6,8,12].includes(h));
  const badLorded     = adLordedHouses.filter(h=>[6,8,12].includes(h));

  let adFromMd=null;
  if (adHouse&&mdHouse) adFromMd=((adHouse-mdHouse+12)%12)+1;
  const isAdverse=adFromMd&&[6,8,12].includes(adFromMd);

  // ── Character sentence — specific and precise ─────────────────────────────
  const adHouseDomain = adHouse?HOUSE_DOMAIN_SHORT[adHouse]:"";
  const relNote = mdAdRel==="F"?` ${mdLord} and ${adLord} are natural friends — energies align without internal friction.`
                : mdAdRel==="E"?` ${mdLord} and ${adLord} are natural enemies — events may feel contradictory or require extra effort.`:"";
  let character="";

  if (adFS==="Y"&&adDig==="ex") {
    character=`${adLord} is a yogakaraka and exalted${adHouseDomain?" in H"+adHouse+" ("+adHouseDomain+")":""} — the most constructive sub-period possible for this lagna. Both the season and the sub-period work in the same direction.${relNote}`;
  } else if (adFS==="Y") {
    character=`${adLord} is a yogakaraka for your lagna${adHouseDomain?" sitting in H"+adHouse+" ("+adHouseDomain+")":""} — a constructive sub-period that moves life forward${adDig==="own"?", and in own sign, steadily so":""}.${relNote}`;
  } else if (isBenefic&&adDig==="ex") {
    character=`${adLord} is exalted in ${adSign} and a functional benefic — its themes of ${PLANET_THEME_CHIP[adLord]?.toLowerCase()||"its domain"} deliver with unusual force${adHouseDomain?" through H"+adHouse+" ("+adHouseDomain+")":""}.${relNote}`;
  } else if (isBenefic) {
    character=`${adLord} is a functional benefic${adDig==="own"?" in own sign":""}${adHouseDomain?", activating H"+adHouse+" ("+adHouseDomain+") constructively":""}.${relNote}`;
  } else if (isMalefic&&adDig==="de") {
    character=`${adLord} is a functional malefic AND debilitated in ${adSign}${adHouseDomain?" — H"+adHouse+" ("+adHouseDomain+") is under compounded stress":""}: ${PLANET_THEME_CHIP[adLord]?.toLowerCase()||"its themes"} are suppressed and the period tests persistently.${relNote}`;
  } else if (isMalefic) {
    character=`${adLord} is a functional malefic${adHouseDomain?" sitting in H"+adHouse+" ("+adHouseDomain+")":""} — the period tests${adDig==="ex"?", though exalted status limits the damage":" and reveals where attention is needed"}.${relNote}`;
  } else {
    character=`${adLord} is neutral for your lagna${adHouseDomain?", activating H"+adHouse+" ("+adHouseDomain+")":""} — outcomes depend on transits and effort.${relNote}`;
  }
  if (isAdverse) character+=` ${adLord} also sits in the ${adFromMd}th from ${mdLord} — a 6/8/12 adversity adding friction.`;
  if (adRetro)   character+=` Retrograde: ${adLord}'s themes surface indirectly or through revisited past matters.`;
  if (adCombust) character+=` Combust: ${adLord}'s significations are dimmed by solar proximity.`;

  // ── Theme chips ───────────────────────────────────────────────────────────
  const chipType=isMalefic||adDig==="de"?"chip-caution":isBenefic?"chip-positive":"";
  const themes=[];
  if (PLANET_THEME_CHIP[adLord]) themes.push({label:PLANET_THEME_CHIP[adLord],cls:chipType});
  if (adHouse) themes.push({label:`H${adHouse} — ${HOUSE_DOMAIN_SHORT[adHouse]}`,cls:isMalefic?"chip-caution":""});
  if (goodLorded.length) themes.push({label:`Lords: ${goodLorded.slice(0,2).map(h=>HOUSE_DOMAIN_SHORT[h]).join(", ")}`,cls:isBenefic?"chip-positive":""});
  if (isAdverse) themes.push({label:`H${adFromMd} from ${mdLord} — tension`,cls:"chip-risk"});
  if (adDig==="ex")  themes.push({label:`Exalted in ${adSign}`,cls:"chip-positive"});
  if (adDig==="de")  themes.push({label:`Debilitated in ${adSign}`,cls:"chip-caution"});
  if (adRetro)       themes.push({label:"Retrograde",cls:"chip-caution"});

  // ── Opens up / Handle with care — short, specific ────────────────────────
  const opensUp=[], handleWith=[];

  if (isBenefic) {
    if (adHouse&&HOUSE_SIG[adHouse]) opensUp.push(`H${adHouse} (${HOUSE_DOMAIN_SHORT[adHouse]}): ${HOUSE_SIG[adHouse].pos.split(",")[0]}.`);
    goodLorded.slice(0,2).forEach(h=>{
      opensUp.push(`As lord of H${h} (${HOUSE_DOMAIN_SHORT[h]}): ${HOUSE_SIG[h]?.pos.split(",")[0]}.`);
    });
    if (adDig==="ex") opensUp.push(`Exalted in ${adSign} — ${PLANET_THEME_CHIP[adLord]?.toLowerCase()} expressed at its highest capacity.`);
    if (adD9Dig==="ex"||adD9Dig==="own") opensUp.push(`D9 confirms: ${adLord} is ${adD9Dig==="ex"?"exalted":"in own sign"} in Navamsha — this period's gains tend to last.`);
  } else {
    if (adHouse&&HOUSE_SIG[adHouse]&&isMalefic) handleWith.push(`H${adHouse} (${HOUSE_DOMAIN_SHORT[adHouse]}): ${HOUSE_SIG[adHouse].neg.split(" and ")[0]}.`);
    badLorded.slice(0,2).forEach(h=>{
      handleWith.push(`Lords H${h} (${HOUSE_DOMAIN_SHORT[h]}): ${HOUSE_SIG[h]?.neg.split(" and ")[0]}.`);
    });
    if (adDig==="de") handleWith.push(`Debilitated in ${adSign} — ${PLANET_THEME_CHIP[adLord]?.toLowerCase()||"its themes"} are suppressed; effort required to express them constructively.`);
    if (adD9Dig==="de") handleWith.push(`D9 debilitated — the D1 stress may not resolve quickly with time.`);
  }

  // ── Domain intensity scores ───────────────────────────────────────────────
  const career        = scoreDomain_Career(adLord,adHouse,adDig,adD9Dig,adFS,lagnaSign,d1HouseMap,adLordedHouses);
  const health        = scoreDomain_Health(adLord,adHouse,adDig,adD9Dig,adFS,lagnaSign,d1HouseMap,adLordedHouses,planets);
  const relationships = scoreDomain_Relationships(adLord,adHouse,adDig,adD9Dig,adFS,lagnaSign,d1HouseMap,adLordedHouses,planets);
  const finances      = scoreDomain_Finances(adLord,adHouse,adDig,adD9Dig,adFS,lagnaSign,d1HouseMap,adLordedHouses);

  const hasRisk=isMalefic||adDig==="de"||isAdverse||adCombust;
  return {character,themes,opensUp:opensUp.slice(0,3),handleWith:handleWith.slice(0,3),career,health,relationships,finances,hasRisk};
}


const PLANET_GLYPHS_FULL = { Sun:"☉",Moon:"☽",Mars:"♂",Mercury:"☿",Jupiter:"♃",Venus:"♀",Saturn:"♄",Rahu:"☊",Ketu:"☋" };

// Domain level label + colour class
function domainLevelHTML(d, icon, label) {
  if (!d) return "";
  const cfg = {
    high:   {cls:"dl-high",   tag:"HIGH RISK"},
    medium: {cls:"dl-medium", tag:"CAUTION"},
    watch:  {cls:"dl-watch",  tag:"WATCH"},
    good:   {cls:"dl-good",   tag:"FAVOURABLE"},
    body:   {cls:"dl-body",   tag:"MONITOR"},
  };
  const c = cfg[d.level]||{cls:"dl-watch",tag:"WATCH"};
  const reasonHTML = d.reason ? `<span class="dl-reason">${d.reason}</span>` : "";
  const bodyHTML   = d.bodyArea ? `<span class="dl-body-area">Body: ${d.bodyArea}</span>` : "";
  const protHTML   = d.protection ? `<span class="dl-protect">🛡 ${d.protection}</span>` : "";
  return `
    <div class="domain-level-row">
      <span class="dl-icon">${icon}</span>
      <span class="dl-label">${label}</span>
      <span class="dl-tag ${c.cls}">${c.tag}</span>
      <div class="dl-detail">${reasonHTML}${bodyHTML}${protHTML}</div>
    </div>`;
}

function renderADIndicationHTML(adR) {
  const chipsHTML = adR.themes.map(t =>
    `<span class="adi-theme-chip ${t.cls}">${t.label}</span>`
  ).join("");

  const opensHTML = (adR.opensUp||[]).map(o =>
    `<div class="adi-line line-opens">${o}</div>`
  ).join("");

  const watchHTML = (adR.handleWith||[]).map(w =>
    `<div class="adi-line line-watch">${w}</div>`
  ).join("");

  const domainStrip = [
    domainLevelHTML(adR.career,        "💼", "Career"),
    domainLevelHTML(adR.health,        "❤️",  "Health"),
    domainLevelHTML(adR.relationships, "🤝", "Relationships"),
    domainLevelHTML(adR.finances,      "💰", "Finances"),
  ].filter(Boolean).join("");

  return `
    <div class="adi-character">${adR.character}</div>
    ${chipsHTML ? `<div class="adi-themes">${chipsHTML}</div>` : ""}
    ${opensHTML||watchHTML ? `
      <div class="adi-body">
        ${opensHTML ? `<div class="adi-col"><div class="adi-col-label label-opens">What opens up</div>${opensHTML}</div>` : ""}
        ${watchHTML ? `<div class="adi-col"><div class="adi-col-label label-watch">Handle with care</div>${watchHTML}</div>` : ""}
      </div>` : ""}
    ${domainStrip ? `<div class="adi-domain-strip">${domainStrip}</div>` : ""}
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
      <div class="antar-list">
        <div class="md-season-block">
          <div class="md-season-label">Season Overview</div>
          <div class="md-season-text">${buildMDSeason(d.lord, lagna, houses, planets)}</div>
        </div>
        ${antarHTML}
      </div>`;

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
