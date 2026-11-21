import { PLANET_REMEDIES, GENERAL_TEMPLES, DOMAIN_TEMPLES } from "./remedies-data.js";
import { computeMarriageTimingWindows, computeMarriageADWindows, computeDelayGate, computeMarriageLifecycle, computeSeparationTiming } from "./marriage-timing.js";

// ── TIMING SWITCHES ────────────────────────────────────────────────────────────────
// PD precision (Pratyantardasha + Upapada + Double Transit + Chara): validated against 6
// real marriage dates and found UNRELIABLE for sub-year pinpointing (it mis-ranked; the
// slow-planet transits are noise). Left OFF; flip true only to resume that R&D.
const ENABLE_PD_TIMING = false;
// AD-level tightening: ranks the significator Mahadasha/Antardasha windows (1–3 yr) by
// 7th-house connection + age and returns a shortlist with an honest confidence tag. This is
// the reliable layer (the marriage always falls in a significator MD/AD). Set false to fall
// back to the plain AD-level likelyFruitionWindows.
const ENABLE_AD_TIGHTEN = true;
// Delay Gate + Romance/Marriage conversion filter (Phase 1): a Restriction Index (Saturn/Ketu
// pressure on the 1–7 axis) sets an astronomy-anchored age gate (~Saturn return when locked);
// windows before the gate are relationship/proposal windows, the first primary-significator
// window after it is the legal-marriage window. Classical rule only — constants NOT fitted to
// any case. Set false to fall back to flat AD windows (flags.marriageADWindows).
const ENABLE_AGE_GATE = true;
// Separation / dissolution timing (Phase 2): ONLY when the structural separation severity graded
// upstream is notable+ (a real separative core), finds the first 6th/8th/12th-lord sub-period
// at/after the marriage window as the dissolution trigger. Strong probability, minority of charts.
// Set false to remove all separation-timing output.
const ENABLE_SEPARATION = true;
//  Jyotish Precision Analyzer  |  analyze.js  |  v3.0
//  All four scoring tiers applied against computed chart data from chart.js
//
//  Tier 1 : Functional benefic/malefic by lagna + dignity modifier
//  Tier 2 : Normalised per-domain thresholds + domain-weighted summary
//  Tier 3 : Combustion + planetary war + Parashari special aspects
//  Tier 4 : Yoga detection override + score-delta reason ranking
// ─────────────────────────────────────────────────────────────────────────────

const SIGNS = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];

const signLord = {
  Aries:"Mars", Taurus:"Venus", Gemini:"Mercury", Cancer:"Moon",
  Leo:"Sun", Virgo:"Mercury", Libra:"Venus", Scorpio:"Mars",
  Sagittarius:"Jupiter", Capricorn:"Saturn", Aquarius:"Saturn", Pisces:"Jupiter"
};

const HOUSE_SIGN_BY_LAGNA = {};
SIGNS.forEach((lagna, idx) => {
  HOUSE_SIGN_BY_LAGNA[lagna] = {};
  for (let h = 1; h <= 12; h++) {
    HOUSE_SIGN_BY_LAGNA[lagna][h] = SIGNS[(idx + h - 1) % 12];
  }
});

// ── TIER 1-A  Functional status (B=+2, M=−2, N=0, Y=+3) ─────────────────────
const FUNCTIONAL_STATUS = {
  //           Sun   Moon  Mars  Merc  Jup   Venus Saturn Rahu  Ketu
  Aries:      ["N",  "B",  "Y",  "N",  "N",  "N",  "M",   "N",  "N"],
  Taurus:     ["M",  "N",  "M",  "N",  "N",  "B",  "Y",   "N",  "N"],
  Gemini:     ["M",  "M",  "M",  "Y",  "B",  "M",  "N",   "N",  "N"],
  Cancer:     ["B",  "N",  "Y",  "M",  "N",  "N",  "M",   "N",  "N"],
  Leo:        ["N",  "M",  "Y",  "B",  "N",  "M",  "M",   "N",  "N"],
  Virgo:      ["M",  "M",  "M",  "N",  "B",  "M",  "N",   "N",  "N"],
  Libra:      ["M",  "M",  "M",  "B",  "N",  "N",  "Y",   "N",  "N"],
  Scorpio:    ["M",  "B",  "Y",  "N",  "M",  "M",  "M",   "N",  "N"],
  Sagittarius:["N",  "M",  "M",  "M",  "N",  "N",  "M",   "N",  "N"],
  Capricorn:  ["M",  "M",  "Y",  "B",  "N",  "M",  "N",   "N",  "N"],
  Aquarius:   ["M",  "M",  "N",  "B",  "N",  "M",  "N",   "N",  "N"],
  Pisces:     ["M",  "N",  "M",  "N",  "B",  "N",  "M",   "N",  "N"],
};
const FS_PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const FS_SCORE   = { B: 2, M: -2, N: 0, Y: 3 };

function functionalStatus(planet, lagna) {
  const row = FUNCTIONAL_STATUS[lagna];
  if (!row) return "N";
  const idx = FS_PLANETS.indexOf(planet);
  return idx >= 0 ? row[idx] : "N";
}
function functionalScore(planet, lagna) { return FS_SCORE[functionalStatus(planet, lagna)] ?? 0; }

// ── TIER 1-B  Dignity ────────────────────────────────────────────────────────
const EXALTATION = {
  Sun:"Aries", Moon:"Taurus", Mars:"Capricorn", Mercury:"Virgo",
  Jupiter:"Cancer", Venus:"Pisces", Saturn:"Libra",
  Rahu:"Gemini", Ketu:"Sagittarius"
};
const DEBILITATION = {
  Sun:"Libra", Moon:"Scorpio", Mars:"Cancer", Mercury:"Pisces",
  Jupiter:"Capricorn", Venus:"Virgo", Saturn:"Aries",
  Rahu:"Sagittarius", Ketu:"Gemini"
};
const OWN_SIGNS = {
  Sun:["Leo"], Moon:["Cancer"], Mars:["Aries","Scorpio"],
  Mercury:["Gemini","Virgo"], Jupiter:["Sagittarius","Pisces"],
  Venus:["Taurus","Libra"], Saturn:["Capricorn","Aquarius"],
  Rahu:[], Ketu:[]
};
// Naisargika (natural permanent) planetary friendship — used to report a planet's sign
// relationship (friend/enemy/neutral) so the engine matches the birth-chart sheet instead of
// flatly calling a friend-sign placement "neutral". (The nodes have no standard rulership.)
const NAT_FRIEND = {
  Sun:["Moon","Mars","Jupiter"], Moon:["Sun","Mercury"], Mars:["Sun","Moon","Jupiter"],
  Mercury:["Sun","Venus"], Jupiter:["Sun","Moon","Mars"], Venus:["Mercury","Saturn"], Saturn:["Mercury","Venus"]
};
const NAT_ENEMY = {
  Sun:["Venus","Saturn"], Moon:[], Mars:["Mercury"], Mercury:["Moon"],
  Jupiter:["Mercury","Venus"], Venus:["Sun","Moon"], Saturn:["Sun","Moon","Mars"]
};
function natRelation(planet, sign){
  const lord = V_LORD[sign];
  if(!lord || !NAT_FRIEND[planet]) return null;   // nodes / unknown
  if(lord === planet) return "own";
  if(NAT_FRIEND[planet].includes(lord)) return "friend";
  if((NAT_ENEMY[planet]||[]).includes(lord)) return "enemy";
  return "neutral";
}

function dignityModifier(planet, sign) {
  if (!planet || !sign) return 0;
  if (EXALTATION[planet] === sign) return 1;
  if (DEBILITATION[planet] === sign) return -1;
  if ((OWN_SIGNS[planet] || []).includes(sign)) return 1;
  return 0;
}

function dignityLabel(planet, sign) {
  if (EXALTATION[planet] === sign) return "Exalted";
  if (DEBILITATION[planet] === sign) return "Debilitated";
  if ((OWN_SIGNS[planet] || []).includes(sign)) return "Own sign";
  return "";
}

// ── TIER 2-A  Per-domain max scores ──────────────────────────────────────────
// DOMAIN_MAX recalibrated for weighted aspect scoring (Jupiter trinal = ±2.5,
// Mars special = ±2.0, Saturn upachaya = ±1.5). Old maxes were set for flat ±1
// which caused Strong threshold to be breached by a single Jupiter aspect alone.
// New maxes restore meaningful discrimination between Developing/Strong/Weak.
const DOMAIN_MAX = {
  "Identity & Personality":    9,
  "Wealth & Family":          12,
  "Marriage & Relationship":  14,
  "Career & Ambition":        16,
  "Emotional Fidelity":       12,
  "Health & Vitality":        16,
};
function getStrength(score, domainTitle) {
  const max = DOMAIN_MAX[domainTitle] || 8;
  if (score >= 0.40 * max) return "Strong";
  if (score <= -0.15 * max) return "Weak";
  return "Developing";
}

// ── TIER 2-B  Domain salience weights ────────────────────────────────────────
const DOMAIN_WEIGHT = {
  "Career & Ambition":        1.5,
  "Wealth & Family":          1.5,
  "Marriage & Relationship":  1.3,
  "Health & Vitality":        1.2,
  "Identity & Personality":   1.0,
  "Emotional Fidelity":       0.8,
};
const MAJOR_DOMAINS = ["Career & Ambition","Wealth & Family","Marriage & Relationship"];

// ── Domain configs ────────────────────────────────────────────────────────────
const DOMAIN_CONFIG = [
  {
    title: "Identity & Personality",
    houses: [1],
    karakas: ["Sun","Moon"],
    overview: "Your 1st house (Lagna) is your cosmic fingerprint — it shows the face you show the world, your physical constitution, and the core pattern of how you engage with life. The Sun defines your soul authority and confidence; the Moon shapes your emotional nature and instinctive responses. Together they form the foundation from which all other life areas are read.",
    flagLogic: "When the Lagna and its lord are under pressure, or the Sun and Moon are weakened, the native may struggle with self-confidence, direction, or a fragmented sense of identity. Developing means the pattern exists but fluctuates — circumstances can either build or erode the core self depending on timing.",
    beginner: "Think of this as your 'who am I' chart area. It reflects your personality, first impressions, physical body, and life force."
  },
  {
    title: "Wealth & Family",
    houses: [2, 11],
    karakas: ["Jupiter","Venus","Mercury"],
    overview: "The 2nd house covers family of origin, accumulated wealth, speech, and food. The 11th house covers gains, income, elder siblings, and social networks. Jupiter brings wisdom and expansion to wealth; Venus adds harmony and material refinement; Mercury manages transactions and communication of resources. The D9 chart confirms whether these material promises mature and sustain over the later half of life.",
    flagLogic: "Vulnerabilities arise when 2nd and 11th lords are placed in dusthana houses (6, 8, 12) or are afflicted by malefics without counterbalancing support. A Developing verdict means earning potential exists but retention, family harmony, or gains remain inconsistent.",
    beginner: "This area covers your finances, earning ability, family relationships, and whether the money you make stays with you."
  },
  {
    title: "Marriage & Relationship",
    houses: [7, 8, 12],
    karakas: ["Venus","Jupiter","Moon"],
    overview: "The 7th house is the primary house of partnership, marriage, and the nature of the spouse. The 8th extends into the depth, longevity, and transformation of the bond — including shared resources. The 12th speaks to bedroom intimacy, emotional withdrawal, and the dissolution dimension of any union. Venus is the primary karaka of love and harmony; Jupiter of wisdom in partnership; Moon of emotional resonance and compatibility.",
    flagLogic: "Vulnerable verdicts arise when 7th lord, Venus, and the 7th house in D9 are all simultaneously under pressure. Developing reflects attraction and intent without stable continuity. D9 confirmation is essential — a strong D1 with a weak D9 means early promise that fades.",
    beginner: "This covers your marriage, romantic relationships, the quality of your bond with your partner, and whether partnerships tend to be harmonious or challenging."
  },
  {
    title: "Career & Ambition",
    houses: [10, 11, 6],
    karakas: ["Sun","Saturn","Mercury","Jupiter"],
    overview: "The 10th house is the apex of the chart — karma, career, reputation, and your visible contribution to the world. The 6th house governs service, competition, daily effort, and the discipline required to sustain a career. The 11th brings gains and recognition. Saturn brings structure and longevity to career; Mercury communication and analytical skill; Sun authority and recognition; Jupiter expansion and wisdom in professional fields.",
    flagLogic: "Pressure on the 10th lord, Sun, or Saturn with weak D9 support produces delays, obstacles, or a career that never quite reaches its visible potential. Developing means the talent is real but the path is longer or harder than average.",
    beginner: "This is about your career, professional reputation, ambition, and whether your hard work translates into visible success and recognition."
  },
  {
    title: "Emotional Fidelity",
    houses: [12, 8],
    karakas: ["Saturn","Ketu","Moon"],
    overview: "The 12th house governs withdrawal, hidden life, subconscious patterns, and what happens away from the public eye — including secret relationships, foreign connections, and bed pleasures. The 8th house rules hidden matters, sudden changes, deep psychological drives, and the transformative forces that operate beneath the surface of life. Saturn governs restraint and karmic discipline; Ketu brings detachment and past-life patterns; Moon reveals emotional vulnerability and susceptibility to unseen impulses.",
    flagLogic: "When the 12th and 8th houses have afflicted lords combined with a pressured Moon, the chart shows difficulty in maintaining emotional boundaries, susceptibility to secret liaisons, or hidden emotional needs that drive behaviour outside the primary relationship. Developing here suggests the impulse exists but has not yet manifested or is being consciously contained.",
    beginner: "This area reflects your inner emotional world, hidden desires, capacity for discretion, and the patterns around secret or private aspects of your personal life — including fidelity and impulse control in intimate matters."
  },
  {
    title: "Health & Vitality",
    houses: [6, 8, 12],
    karakas: ["Sun","Moon","Saturn","Mars"],
    overview: "The dusthana triad of 6th (disease, immune system), 8th (chronic and hidden illness, surgery), and 12th (hospitalisation, confinement, long-term drain) together map the health axis. The Sun represents vitality and the heart; Moon the mind and fluids; Saturn chronic conditions and aging; Mars inflammation, injuries, and fevers. D9 confirmation reveals whether health pressures resolve or deepen with age.",
    flagLogic: "Multiple dusthana planets plus a weakened Sun and Moon indicates a chart carrying genuine health burden. Developing means sensitivity and periodic strain but not a uniformly compromised constitution.",
    beginner: "This reveals your physical vitality, vulnerability to illness, recovery capacity, and long-term health patterns — whether your constitution is robust or needs careful maintenance."
  }
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeHouses(houses) {
  const out = {};
  for (let i = 1; i <= 12; i++) {
    out[i] = Array.isArray(houses?.[i]) ? houses[i]
           : Array.isArray(houses?.[String(i)]) ? houses[String(i)]
           : [];
  }
  return out;
}

function getPlanetHouse(houses, planet) {
  for (let i = 1; i <= 12; i++) {
    if ((houses[i] || []).includes(planet)) return i;
  }
  return null;
}

function houseSign(lagnaSign, houseNum) {
  return HOUSE_SIGN_BY_LAGNA[lagnaSign]?.[houseNum] || null;
}

function getSupportBucket(houseNum) {
  if ([1,4,5,7,9,10,11].includes(houseNum)) return "supportive";
  if ([6,8,12].includes(houseNum)) return "stress";
  return "neutral";
}

// ── TIER 3-A  Combustion ─────────────────────────────────────────────────────
const COMBUSTION_ORB = { Moon:7, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };

function buildCombustFlags(planetDegrees) {
  const combust = new Set();
  if (!planetDegrees || planetDegrees.Sun == null) return combust;
  const sunDeg = planetDegrees.Sun;
  for (const [planet, orb] of Object.entries(COMBUSTION_ORB)) {
    if (planetDegrees[planet] == null) continue;
    let diff = Math.abs(planetDegrees[planet] - sunDeg);
    if (diff > 180) diff = 360 - diff;
    if (diff <= orb) combust.add(planet);
  }
  return combust;
}

// ── TIER 3-B  Planetary war ───────────────────────────────────────────────────
const WAR_PLANETS = ["Mars","Mercury","Jupiter","Venus","Saturn"];

function buildWarLosers(planetDegrees, planetLatitudes) {
  const losers = new Set();
  if (!planetDegrees || !planetLatitudes) return losers;
  for (let i = 0; i < WAR_PLANETS.length; i++) {
    for (let j = i + 1; j < WAR_PLANETS.length; j++) {
      const p1 = WAR_PLANETS[i], p2 = WAR_PLANETS[j];
      if (planetDegrees[p1] == null || planetDegrees[p2] == null) continue;
      let diff = Math.abs(planetDegrees[p1] - planetDegrees[p2]);
      if (diff > 180) diff = 360 - diff;
      if (diff <= 1.0) losers.add((planetLatitudes[p1] ?? 0) < (planetLatitudes[p2] ?? 0) ? p1 : p2);
    }
  }
  return losers;
}

// ── TIER 3-C  Aspects — Weighted Parashari Graha Drishti ─────────────────────
//
// Classical weights (Parashari tradition):
//
//  Jupiter 5th / 9th (trinal aspects) — STRONGEST: grace flows through dharmic houses.
//    Benefic/Yogakaraka Jupiter: +2.5  |  Malefic Jupiter: −1.5
//    Even a neutral Jupiter on 5th/9th brings some uplift to the domain.
//
//  Jupiter 7th (full drishti) — STRONG:
//    Benefic/Yogakaraka: +1.5  |  Malefic: −1.0
//
//  Mars 4th / 8th (special aspects) — FORCEFUL:
//    4th (kendra): active energy, can build or disrupt.
//    8th (dusthana): most destructive special aspect when malefic.
//    Benefic/Yogakaraka Mars: +1.5  |  Malefic Mars: −2.0
//
//  Saturn 3rd / 10th (upachaya aspects) — CHRONIC:
//    Grows slowly; results compound over time.
//    Benefic/Yogakaraka Saturn: +1.0  |  Malefic Saturn: −1.5
//
//  All planets 7th — STANDARD full drishti:
//    Benefic/Yogakaraka: +1.0  |  Malefic: −1.0
//
// The offsets below are from the PLANET'S house number, matching the
// South Indian Parashari reckoning (wrap-around within 1–12):
//   +6 = 7th from planet  (all planets)
//   +3 = 4th from planet, +7 = 8th from planet  (Mars only)
//   +4 = 5th from planet, +8 = 9th from planet  (Jupiter only)
//   +2 = 3rd from planet, +9 = 10th from planet (Saturn only)

function getAspects(planet, planetHouseNum) {
  const h    = planetHouseNum;
  const wrap = n => ((n - 1 + 12) % 12) + 1;
  // Returns array of { house, weight_benefic, weight_malefic, label }
  const aspects = [{ house: wrap(h + 6), wb: 1.0, wm: -1.0, label: '7th (full)' }];
  if (planet === 'Mars') {
    aspects.push({ house: wrap(h + 3), wb: 1.5, wm: -2.0, label: '4th (special)' });
    aspects.push({ house: wrap(h + 7), wb: 1.5, wm: -2.0, label: '8th (special)' });
  }
  if (planet === 'Jupiter') {
    aspects.push({ house: wrap(h + 4), wb: 2.5, wm: -1.5, label: '5th trinal (strongest)' });
    aspects.push({ house: wrap(h + 8), wb: 2.5, wm: -1.5, label: '9th trinal (strongest)' });
  }
  if (planet === 'Saturn') {
    aspects.push({ house: wrap(h + 2), wb: 1.0, wm: -1.5, label: '3rd upachaya' });
    aspects.push({ house: wrap(h + 9), wb: 1.0, wm: -1.5, label: '10th upachaya' });
  }
  return aspects;
}

// Keep backward-compatible helper (used only for retro-detection, not scoring)
function getAspectedHouses(planet, planetHouseNum) {
  return getAspects(planet, planetHouseNum).map(a => a.house);
}

// ── TIER 4-A  Yoga detection ─────────────────────────────────────────────────
const KENDRA_HOUSES  = [1,4,7,10];
const TRIKONA_HOUSES = [1,5,9];

function detectYogas(chart) {
  const houses = normalizeHouses(chart.houses);
  const lagna  = chart.lagnaSign;
  const yogas  = [];
  const ph = p => getPlanetHouse(houses, p);
  const ps = p => { const h = ph(p); return h ? houseSign(lagna, h) : null; };

  // Pancha Mahapurusha
  const pmp = [
    { name:"Hamsa Yoga",   planet:"Jupiter", affects:["Marriage & Relationship","Career & Ambition"] },
    { name:"Malavya Yoga", planet:"Venus",   affects:["Marriage & Relationship","Wealth & Family"] },
    { name:"Ruchaka Yoga", planet:"Mars",    affects:["Career & Ambition","Health & Vitality"] },
    { name:"Sasa Yoga",    planet:"Saturn",  affects:["Career & Ambition","Emotional Fidelity"] },
    { name:"Bhadra Yoga",  planet:"Mercury", affects:["Career & Ambition","Wealth & Family"] },
  ];
  for (const { name, planet, affects } of pmp) {
    const h = ph(planet); const sign = ps(planet);
    if (!h || !sign) continue;
    if (KENDRA_HOUSES.includes(h) && dignityModifier(planet, sign) >= 1) {
      yogas.push({ name, type:"BOOST", domains: affects,
        reason:`${name}: ${planet} is exalted or in own sign in a kendra — elevates ${affects.join(" and ")}.` });
    }
  }

  // Raja Yoga
  const kendraLords  = [...new Set(KENDRA_HOUSES.map(h => { const s=houseSign(lagna,h); return s?signLord[s]:null; }).filter(Boolean))];
  const trikonaLords = [...new Set(TRIKONA_HOUSES.map(h => { const s=houseSign(lagna,h); return s?signLord[s]:null; }).filter(Boolean))];
  outer: for (const kl of kendraLords) {
    for (const tl of trikonaLords) {
      if (kl === tl) continue;
      const klH = ph(kl), tlH = ph(tl);
      if (!klH || !tlH) continue;
      if (klH === tlH) {
        yogas.push({ name:"Raja Yoga", type:"BOOST", domains:["Career & Ambition","Wealth & Family","Identity & Personality"],
          reason:`Raja Yoga: ${kl} (kendra lord) and ${tl} (trikona lord) conjunct — powerful career and wealth elevation.` });
        break outer;
      }
    }
  }

  // Dhana Yoga
  const dhanaHouses = [2,5,9,11];
  const dhanaLords = [...new Set(dhanaHouses.map(h => { const s=houseSign(lagna,h); return s?signLord[s]:null; }).filter(Boolean))];
  const dhanaCount = dhanaLords.filter(dl => { const h=ph(dl); return h && dhanaHouses.includes(h); }).length;
  if (dhanaCount >= 2) {
    yogas.push({ name:"Dhana Yoga", type:"BOOST", domains:["Wealth & Family","Career & Ambition"],
      reason:`Dhana Yoga: ${dhanaCount} wealth-house lords mutually placed — strong financial signification.` });
  }

  // Viparita Raja Yoga
  const dusthanas = [6,8,12];
  const dusthanaLords = dusthanas.map(h => { const s=houseSign(lagna,h); return s?signLord[s]:null; }).filter(Boolean);
  const viparitaCount = dusthanaLords.filter(dl => { const h=ph(dl); return h && dusthanas.includes(h); }).length;
  if (viparitaCount >= 2) {
    // FIX 6: Viparita RY now BOOSTS the dusthana domains it activates.
    // Classical: when dusthana lords occupy other dusthanas, the negative energy
    // cancels and inverts — producing unexpected gains, resilience and hidden strength
    // particularly for Health, Emotional, and transformative domains (8th/12th).
    // Previous REMOVE_FLAG had no scoring impact; BOOST lifts the domain verdict.
    yogas.push({ name:"Viparita Raja Yoga", type:"BOOST",
      domains:["Health & Vitality","Emotional Fidelity","Marriage & Relationship"],
      reason:`Viparita Raja Yoga: ${viparitaCount} dusthana lords placed in dusthanas — adversity inverts to hidden strength in these domains.` });
  }

  // Kemadruma (negative)
  const moonH = ph("Moon");
  if (moonH) {
    const wrap = n => ((n - 1 + 12) % 12) + 1;
    const h2 = wrap(moonH + 1), h12 = wrap(moonH - 1);
    const allP = ["Sun","Mars","Mercury","Jupiter","Venus","Saturn"];
    if (!allP.some(p => { const h=ph(p); return h===h2||h===h12; })) {
      yogas.push({ name:"Kemadruma Yoga", type:"SUPPRESS", domains:["Identity & Personality","Wealth & Family"],
        reason:`Kemadruma Yoga: Moon has no planets in adjacent houses — emotional instability signal.` });
    }
  }

  // Neecha Bhanga
  for (const planet of FS_PLANETS) {
    const sign = ps(planet);
    if (!sign || DEBILITATION[planet] !== sign) continue;
    const dispositor = signLord[sign];
    const dispH = ph(dispositor);
    if (dispH && KENDRA_HOUSES.includes(dispH)) {
      yogas.push({ name:"Neecha Bhanga", type:"REMOVE_FLAG", domains: DOMAIN_CONFIG.map(d=>d.title), planet,
        targetFlag:`neecha-${planet.toLowerCase()}`,
        reason:`Neecha Bhanga: ${planet} is debilitated but its dispositor ${dispositor} is in a kendra — debilitation cancelled.` });
    }
  }

  // Parivartana Yoga (Mutual Reception) — FIX 7
  // Two planets each placed in the other's own sign = strong mutual exchange.
  // Classical effect: both planets behave as if in own sign → dignity boost.
  // Score impact: each planet in the exchange gains +1 to domain score (via BOOST)
  // when either planet is a karaka or lord relevant to a domain.
  const parivartanaPairs = [];
  for (let i=0; i<FS_PLANETS.length; i++) {
    for (let j=i+1; j<FS_PLANETS.length; j++) {
      const p1 = FS_PLANETS[i], p2 = FS_PLANETS[j];
      if (!p1 || !p2) continue;
      const h1 = ph(p1), h2 = ph(p2);
      if (!h1 || !h2) continue;
      const s1 = houseSign(lagna, h1), s2 = houseSign(lagna, h2);
      if (!s1 || !s2) continue;
      const own1 = OWN_SIGNS[p1] || [], own2 = OWN_SIGNS[p2] || [];
      // p1 in p2's sign AND p2 in p1's sign
      if (own2.includes(s1) && own1.includes(s2)) {
        parivartanaPairs.push({ p1, p2, h1, h2, s1, s2 });
        // Determine which domains benefit from this exchange
        const activeDomains = DOMAIN_CONFIG
          .filter(d => d.houses.includes(h1) || d.houses.includes(h2) ||
                       d.karakas.includes(p1) || d.karakas.includes(p2))
          .map(d => d.title);
        if (activeDomains.length > 0) {
          yogas.push({
            name: "Parivartana Yoga",
            type: "BOOST",
            domains: activeDomains,
            reason: `Parivartana Yoga: ${p1} in ${s1} and ${p2} in ${s2} — mutual reception; both planets act as if in own sign, strengthening the domains they rule and occupy.`
          });
        }
      }
    }
  }

  return yogas;
}

// ── Core domain scoring ────────────────────────────────────────────────────────
function scoreChartDomain(chart, config, combustSet, warLosers) {
  const houses = normalizeHouses(chart.houses);
  const lagna  = chart.lagnaSign;
  let score    = 0;
  const flags   = [];
  const reasons = [];

  config.houses.forEach(houseNum => {
    const sign        = houseSign(lagna, houseNum);
    const housePlanets = houses[houseNum] || [];

    housePlanets.forEach(planet => {
      const fs   = functionalStatus(planet, lagna);
      const base = FS_SCORE[fs] ?? 0;
      const dig  = sign ? dignityModifier(planet, sign) : 0;
      const comb = combustSet.has(planet) ? -1 : 0;
      const war  = warLosers.has(planet)  ? -1 : 0;
      const total = base + dig + comb + war;
      score += total;

      const lbl = fs==="Y"?"yogakaraka":fs==="B"?"benefic":fs==="M"?"malefic":"neutral";
      const extras = [dig>0?"exalted/own":"",dig<0?"debilitated":"",combustSet.has(planet)?"combust":"",warLosers.has(planet)?"war-defeated":""].filter(Boolean);
      const extStr = extras.length ? ` (${extras.join(", ")})` : "";
      reasons.push({ text:`House ${houseNum}: ${planet} is ${lbl}${extStr} — contributes ${total>=0?"+":""}${total} to this domain.`, delta:total, type:dig?"DIGNITY":"HOUSE_PLANET", planet, house:houseNum });

      if (fs==="Y") flags.push(`yogakaraka-${planet.toLowerCase()}`);
      if (combustSet.has(planet)) flags.push(`combust-${planet.toLowerCase()}`);
      if (warLosers.has(planet)) flags.push(`graha-yuddha-${planet.toLowerCase()}`);
      if (fs==="M"||comb||war) flags.push(`house-${houseNum}-pressure`);
    });

    // Lord
    const lord     = sign ? signLord[sign] : null;
    const lordHouse = lord ? getPlanetHouse(houses, lord) : null;
    if (!lord) {
      score -= 1;
      flags.push(`house-${houseNum}-sign-missing`);
      reasons.push({ text:`House ${houseNum} sign could not be resolved.`, delta:-1, type:"LORD", house:houseNum });
    } else if (lordHouse === null) {
      score -= 1;
      flags.push(`house-${houseNum}-lord-missing`);
      reasons.push({ text:`House ${houseNum} lord ${lord} not found in chart.`, delta:-1, type:"LORD", planet:lord, house:houseNum });
    } else {
      const bucket   = getSupportBucket(lordHouse);
      const lordSign = houseSign(lagna, lordHouse);
      const lordDig  = lordSign ? dignityModifier(lord, lordSign) : 0;
      const lordFS   = functionalStatus(lord, lagna);
      // FIX 4: Graduated dusthana lord scoring.
      // Old: all lords in H6/8/12 scored flat -2 regardless of functional status.
      // Classical: a yogakaraka/benefic lord in dusthana is stressed but not destroyed —
      // it partially retains its positive quality (Viparita Yoga tendency).
      // A malefic lord in its own dusthana is even more destructive than flat -2.
      let lordBase;
      if (bucket === "supportive") {
        lordBase = lordFS === "Y" ? 3 : lordFS === "B" ? 2 : 0;
      } else if (bucket === "stress") {
        if (lordFS === "Y")      lordBase = -1;   // YK in dusthana: stressed but dignity buffers
        else if (lordFS === "B") lordBase = -1;   // Benefic in dusthana: partially offset
        else if (lordFS === "M") lordBase = -3;   // Malefic in dusthana: compounded
        else                     lordBase = -2;   // Neutral in dusthana: standard
      } else {
        lordBase = 0;
      }
      const lordTotal = lordBase + lordDig;
      score += lordTotal;
      if (bucket === "supportive") {
        reasons.push({ text:`House ${houseNum} lord ${lord} in house ${lordHouse} — structural support${lordDig>0?" (dignified, bonus)":lordDig<0?" (debilitated, reduced)":""}.`, delta:lordTotal, type:"LORD", planet:lord, house:houseNum });
      } else if (bucket === "stress") {
        const stressNote = lordFS === "Y" || lordFS === "B" ? " (functional status partially offsets stress)" : lordFS === "M" ? " (malefic lord in dusthana — compounded pressure)" : "";
        flags.push(`house-${houseNum}-lord-under-stress`);
        reasons.push({ text:`House ${houseNum} lord ${lord} in house ${lordHouse} (dusthana placement)${stressNote}.`, delta:lordTotal, type:"LORD", planet:lord, house:houseNum });
      } else {
        reasons.push({ text:`House ${houseNum} lord ${lord} in house ${lordHouse} — neutral placement.`, delta:lordTotal, type:"LORD", planet:lord, house:houseNum });
      }
    }
  });

  // Karakas — FIX 5: primary karaka (first in array) scores 1.5x secondary karakas.
  // Classical: Venus is primary karaka for Marriage, Jupiter for Wealth/Children etc.
  // Treating all karakas equally understates the primary's influence on domain verdict.
  config.karakas.forEach((planet, karakaIdx) => {
    const planetHouse = getPlanetHouse(houses, planet);
    if (planetHouse === null) return;
    const sign   = houseSign(lagna, planetHouse);
    const dig    = sign ? dignityModifier(planet, sign) : 0;
    const bucket = getSupportBucket(planetHouse);
    const comb   = combustSet.has(planet) ? -1 : 0;
    const war    = warLosers.has(planet)  ? -1 : 0;
    const bucketBase = bucket==="supportive"?1:bucket==="stress"?-1:0;
    const baseTotal  = bucketBase + Math.trunc(dig * 0.5) + comb + war;
    // Primary karaka (index 0) gets 1.5x multiplier; secondary karakas get 1x
    const karakaWeight = karakaIdx === 0 ? 1.5 : 1.0;
    const total = Math.round(baseTotal * karakaWeight * 10) / 10;
    score += total;
    const primaryLabel = karakaIdx === 0 ? "primary karaka" : "secondary karaka";
    if (bucket==="stress") {
      flags.push(`${planet.toLowerCase()}-under-pressure`);
      reasons.push({ text:`${planet} (${primaryLabel}) in house ${planetHouse} adds strain${combustSet.has(planet)?" — also combust":""}.`, delta:total, type:"KARAKA", planet, house:planetHouse });
    } else if (bucket==="supportive") {
      reasons.push({ text:`${planet} (${primaryLabel}) supports this domain from house ${planetHouse}${dig>0?" — dignified":""}.`, delta:total, type:"KARAKA", planet, house:planetHouse });
    }
  });

  // Aspects (Tier 3-C) — weighted Parashari graha drishti
  const allPlanets = [...FS_PLANETS];
  allPlanets.forEach(planet => {
    const planetH = getPlanetHouse(houses, planet);
    if (!planetH) return;
    const aspectList = getAspects(planet, planetH);
    const fs = functionalStatus(planet, lagna);

    // FIX 1: Dignified-neutral rule — a neutral planet that is exalted or in own
    // sign acts as functionally benefic for ASPECT purposes (not for lordship).
    // Classical Parashari: dignity overrides neutrality when casting aspects.
    const planetSign = houseSign(lagna, planetH); // sign the aspecting planet occupies
    const planetDig  = planetSign ? dignityModifier(planet, planetSign) : 0;
    const effectiveFs = (fs === 'N' && planetDig >= 1) ? 'B' : fs;

    aspectList.forEach(({ house: aspectedHouse, wb, wm, label }) => {
      // Skip if the planet is already IN that house (conjunction, not aspect)
      if ((houses[aspectedHouse] || []).includes(planet)) return;
      // Skip if the aspected house is not one of this domain houses
      if (!config.houses.includes(aspectedHouse)) return;

      if (effectiveFs === 'Y') {
        score += wb;
        reasons.push({
          text: `${planet} (yogakaraka) casts its ${label} aspect on house ${aspectedHouse} — strong uplift.`,
          delta: wb, type: 'ASPECT', planet, house: aspectedHouse
        });
      } else if (effectiveFs === 'B') {
        const dignity_note = (fs === 'N' && planetDig >= 1) ? ' (dignity elevates neutral to benefic)' : '';
        score += wb;
        reasons.push({
          text: `${planet} (benefic${dignity_note}) casts its ${label} aspect on house ${aspectedHouse}.`,
          delta: wb, type: 'ASPECT', planet, house: aspectedHouse
        });
      } else if (effectiveFs === 'M') {
        score += wm;
        flags.push(`malefic-aspect-house-${aspectedHouse}`);
        reasons.push({
          text: `${planet} (malefic) casts its ${label} aspect on house ${aspectedHouse} — puts pressure on this domain.`,
          delta: wm, type: 'ASPECT', planet, house: aspectedHouse
        });
      }
      // Neutral undignified planets cast no scored aspect — standard Parashari practice
    });
  });

  const strength = getStrength(score, config.title);
  const sortedReasons = reasons
    .filter(r => Math.abs(r.delta) > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map(r => r.text);

  return { score, strength, flags, reasons: sortedReasons };
}

// ── Verdict combination ──────────────────────────────────────────────────────
function combineVerdict(d1, d9) {
  if (d1==="Strong"     && d9==="Strong")     return "In Full Flow";
  if (d1==="Weak"       && d9==="Weak")       return "Needs Tending";
  if (d1==="Strong"     && d9==="Weak")       return "Peak Comes Early";
  if (d1==="Weak"       && d9==="Strong")     return "Deferred, Not Denied";
  if (d1==="Developing" && d9==="Developing") return "Still Forming";
  if (d1==="Strong")                           return "Foundation Holds";
  if (d9==="Strong")                           return "Ripening";
  return "Still Forming";
}

// ── Build domain result with yoga overrides ───────────────────────────────────
function buildDomainResult(d1, d9, config, combustD1, warD1, combustD9, warD9, yogasD1, yogasD9) {
  const d1Result = scoreChartDomain(d1, config, combustD1, warD1);
  const d9Result = scoreChartDomain(d9, config, combustD9, warD9);
  let d1Strength = d1Result.strength;
  let d9Strength = d9Result.strength;
  let verdict    = combineVerdict(d1Strength, d9Strength);
  const allFlags   = [...new Set([...d1Result.flags, ...d9Result.flags])];
  const allReasons = [
    ...d1Result.reasons.slice(0,4).map(r=>`[D1] ${r}`),
    ...d9Result.reasons.slice(0,4).map(r=>`[D9] ${r}`)
  ];

  const relevantYogas = [...yogasD1, ...yogasD9].filter(y => y.domains.includes(config.title));
  for (const yoga of relevantYogas) {
    if (yoga.type==="BOOST") {
      // Boost the strength to Strong, then re-derive verdict so display is always consistent
      if (d1Strength!=="Strong") d1Strength = "Strong";
      verdict = combineVerdict(d1Strength, d9Strength);
      allReasons.unshift(`[YOGA] ${yoga.reason}`);
      allFlags.push(`yoga-${yoga.name.toLowerCase().replace(/\s+/g,"-")}`);
    }
    if (yoga.type==="SUPPRESS") {
      if (d1Result.score<0 || d9Result.score<0) {
        // Reflect underlying weakness in the displayed strengths so Strong/Strong/Vulnerable
        // contradiction cannot appear — the suppressed strength drops to Weak
        if (d1Result.score<0) d1Strength = "Weak";
        if (d9Result.score<0) d9Strength = "Weak";
        verdict = combineVerdict(d1Strength, d9Strength);
        allReasons.unshift(`[YOGA] ${yoga.reason}`);
        allFlags.push(`yoga-negative-${yoga.name.toLowerCase().replace(/\s+/g,"-")}`);
      }
    }
    if (yoga.type==="REMOVE_FLAG") allReasons.push(`[YOGA] ${yoga.reason}`);
  }

  // Final guard: verdict must always be consistent with the displayed d1/d9 strengths.
  // Re-derive once more so no yoga sequencing edge-case can leave an impossible combination.
  verdict = combineVerdict(d1Strength, d9Strength);

  return {
    title: config.title,
    d1Strength, d9Strength, verdict,
    factorOverview: config.overview,
    flagLogic: config.flagLogic,
    beginnerNote: config.beginner,
    flags: allFlags.map(f => f.replace(/-/g," ")),
    reasons: allReasons,
    _d1Result: d1Result,
    _d9Result: d9Result,
  };
}

// ── TIER 2-B  Weighted summary ───────────────────────────────────────────────
function buildSummary(domains) {
  const weightedStable     = domains.filter(d=>d.verdict==="In Full Flow").reduce((s,d)=>s+(DOMAIN_WEIGHT[d.title]||1),0);
  const weightedVulnerable = domains.filter(d=>d.verdict==="Needs Tending").reduce((s,d)=>s+(DOMAIN_WEIGHT[d.title]||1),0);
  const improvingCount     = domains.filter(d=>d.verdict==="Deferred, Not Denied"||d.verdict==="Peak Comes Early").length;

  let overallPattern = "Balanced chart with selective strengths and areas requiring attention.";
  if (weightedStable >= 4.0)      overallPattern = "This chart shows broad structural support across the most important life domains.";
  else if (weightedVulnerable>=3.5) overallPattern = "This chart carries repeated stress signatures across major domains — these areas need careful and conscious handling.";
  else if (improvingCount >= 2)     overallPattern = "This chart shows early unevenness but carries a noticeable pattern of later-life strengthening.";

  const earlyStrongDomains = domains.filter(d=>d.d1Strength==="Strong").map(d=>d.title);
  const lateStrongDomains  = domains.filter(d=>d.d9Strength==="Strong").map(d=>d.title);
  const earlyMajor = earlyStrongDomains.some(t=>MAJOR_DOMAINS.includes(t));
  const lateMajor  = lateStrongDomains.some(t=>MAJOR_DOMAINS.includes(t));

  const earlyLife = (earlyStrongDomains.length>2 && earlyMajor)
    ? "Outer-life promise is clearly visible in the earlier years, especially in key life domains."
    : "The early years may require conscious effort and course correction before momentum builds.";
  const laterLife = (lateStrongDomains.length>2 && lateMajor)
    ? "Later-life results look considerably stronger and more settled — the second half of life brings reward."
    : "Later-life results require deliberate strengthening; natural momentum alone may not deliver stability.";

  return { overallPattern, earlyLife, laterLife };
}

// ── Request handler ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// CHARSTATEMENT ENGINE  — Step 1: Pattern · Indication · Activation · Caution
// ═══════════════════════════════════════════════════════════════════════════════
//
// Replaces flat domain scores with structured chart statements that encode:
//   Pattern     — the actual planetary configuration in the chart
//   Indication  — what that configuration suggests
//   Window      — dasha periods when this domain activates (with ages)
//   Caution     — what complicates, delays, or qualifies the indication
//   Confidence  — how many independent indicators agree (High / Medium / Low)
//
// The scoring engine (Tiers 1-4) remains intact as the evidence layer.
// These functions read its output and translate it into structured statements.

// ── Sign lord lookup ──────────────────────────────────────────────────────────
const SIGN_LORDS = {
  Aries:'Mars', Taurus:'Venus', Gemini:'Mercury', Cancer:'Moon', Leo:'Sun',
  Virgo:'Mercury', Libra:'Venus', Scorpio:'Mars', Sagittarius:'Jupiter',
  Capricorn:'Saturn', Aquarius:'Saturn', Pisces:'Jupiter'
};

// ── Domain activating planets = house lords + karakas ────────────────────────
// Called for D1 lagna. Returns the union of:
//   (a) Lords of each house in the domain
//   (b) Primary and secondary karakas for the domain
function getDomainActivators(config, lagnaSign) {
  const houseToSign = HOUSE_SIGN_BY_LAGNA[lagnaSign] || {};
  const houseLords  = config.houses
    .map(h => SIGN_LORDS[houseToSign[h]])
    .filter(Boolean);
  return [...new Set([...config.karakas, ...houseLords])];
}

// ── Dasha activation windows ─────────────────────────────────────────────────
// Returns ordered array of activation windows within the native's lifespan.
// Each window: { planet, level, within, from_age, to_age, priority }
//   priority: 'primary'   — planet runs its own Mahadasha
//             'strong'    — activator runs AD within another activator's MD
//             'secondary' — activator runs AD within a non-activator's MD
function getDashaActivationWindows(config, dashas, birthDate, lagnaSign, currentAge) {
  if (!dashas || !dashas.length) return [];

  const activators = getDomainActivators(config, lagnaSign);
  const birth = new Date(birthDate);
  // currentAge = the native's age (in years) at report-generation time. Used to
  // classify each window as already-passed, currently-running, or upcoming — so a
  // new customer generating today is shown what's AHEAD (and, as useful context,
  // what they have already moved through) rather than a flat whole-life list that
  // may open on periods already behind them.
  const nowAge = (typeof currentAge === 'number' && isFinite(currentAge)) ? currentAge : null;

  function toAge(dateStr) {
    return parseFloat(((new Date(dateStr) - birth) / (365.25*24*3600*1000)).toFixed(1));
  }

  function phaseOf(fromAge, toAge_) {
    if (nowAge === null) return 'unknown';
    if (toAge_ < nowAge) return 'past';
    if (fromAge > nowAge) return 'upcoming';
    return 'current';
  }

  const windows = [];

  dashas.forEach(md => {
    const mdFrom = toAge(md.startDate);
    const mdTo   = toAge(md.endDate);
    const mdIsActivator = activators.includes(md.lord);

    // Mahadasha itself is an activator → primary window
    if (mdIsActivator && mdTo > 12 && mdFrom < 85) {
      const fa = Math.max(mdFrom, 0), ta = Math.min(mdTo, 90);
      windows.push({
        planet:   md.lord,
        level:    'Mahadasha',
        within:   null,
        from_age: fa,
        to_age:   ta,
        priority: 'primary',
        phase:    phaseOf(fa, ta)
      });
    }

    // Scan antardasas within this MD
    md.antarDasas.forEach(ad => {
      if (!activators.includes(ad.lord)) return;
      const adFrom = toAge(ad.startDate);
      const adTo   = toAge(ad.endDate);
      if (adTo < 12 || adFrom > 85) return; // outside relevant lifespan

      const fa = parseFloat(Math.max(adFrom, 0).toFixed(1));
      const ta = parseFloat(Math.min(adTo, 90).toFixed(1));
      windows.push({
        planet:   ad.lord,
        level:    'Antardasha',
        within:   md.lord,
        from_age: fa,
        to_age:   ta,
        priority: mdIsActivator ? 'strong' : 'secondary',
        phase:    phaseOf(fa, ta)
      });
    });
  });

  // Sort by age, deduplicate near-identical windows
  return windows
    .sort((a, b) => a.from_age - b.from_age)
    .filter((w, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i-1];
      return !(prev.planet === w.planet && Math.abs(prev.from_age - w.from_age) < 1);
    });
}

// ── Confidence assessor ───────────────────────────────────────────────────────
// Counts independent supporting indicators vs conflicting ones.
// Returns { level: 'High'|'Medium'|'Low', reason: string }
function assessConfidence(d1Result, d9Result, yogas, config) {
  const supporting = [];
  const conflicting = [];

  // D1 indicators
  if (d1Result.strength === 'Strong')     supporting.push('D1 strong');
  else if (d1Result.strength === 'Weak')  conflicting.push('D1 weak');

  // D9 indicators
  if (d9Result.strength === 'Strong')     supporting.push('D9 confirms');
  else if (d9Result.strength === 'Weak')  conflicting.push('D9 weak');

  // Relevant yogas
  const boostYogas    = yogas.filter(y => y.type==='BOOST'    && y.domains.includes(config.title));
  const suppressYogas = yogas.filter(y => y.type==='SUPPRESS' && y.domains.includes(config.title));
  boostYogas.forEach(y    => supporting.push(y.name));
  suppressYogas.forEach(y => conflicting.push(y.name));

  // D1/D9 agreement is a strong signal
  if (d1Result.strength === d9Result.strength) supporting.push('D1/D9 agree');

  const s = supporting.length, c = conflicting.length;
  let level, reason;

  if (s >= 3 && c === 0)      { level='High';   reason=`${supporting.slice(0,3).join(', ')} — indicators align cleanly.`; }
  else if (s >= 2 && c <= 1)  { level='High';   reason=`${supporting.slice(0,2).join(' and ')} confirmed; minor counterweight noted.`; }
  else if (s >= 2 && c >= 2)  { level='Medium'; reason=`Supporting and conflicting indicators roughly balanced — outcome depends on dasha timing.`; }
  else if (s >= 1 && c === 0) { level='Medium'; reason=`${supporting[0]} — only one strong indicator; needs dasha confirmation.`; }
  else if (c >= 2 && s <= 1)  { level='Low';    reason=`Multiple conflicting indicators (${conflicting.slice(0,2).join(', ')}) outweigh support.`; }
  else                         { level='Low';    reason=`Mixed indicators without clear dominance — timing-sensitive.`; }

  return { level, reason };
}

// ── Caution builder ──────────────────────────────────────────────────────────
// Reads combustion, war, malefic aspects, dusthana lord placements from reasons
// and converts them to plain-language caution strings.
function buildCautions(d1Result, d9Result, combustSet, warSet, config) {
  const cautions = [];

  // Combust karakas
  config.karakas.forEach(p => {
    if (combustSet.has(p)) {
      const role = p === config.karakas[0] ? 'primary significator' : 'significator';
      cautions.push(`${p} is combust (close to Sun) — its capacity to fully deliver in this domain is reduced; clarity in this area may feel inconsistent, particularly during ${p} dasha periods.`);
    }
  });

  // Malefic planets in domain houses
  const maleficInDomain = d1Result.reasons
    .filter(r => r.includes('[D1]') && r.includes('malefic') && !r.includes('aspect'))
    .slice(0, 2);
  maleficInDomain.forEach(r => {
    const planet = r.match(/(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Rahu|Ketu)/)?.[1];
    if (planet) cautions.push(`${planet}'s placement applies pressure to this domain — results may come with difficulty, delay, or require extra sustained effort.`);
  });

  // Malefic aspects on domain houses
  const maleficAspects = d1Result.reasons
    .filter(r => r.includes('malefic') && r.includes('aspect'))
    .slice(0, 2);
  maleficAspects.forEach(r => {
    const planet = r.match(/(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Rahu|Ketu)/)?.[1];
    const house  = r.match(/house (\d+)/)?.[1];
    if (planet && house) cautions.push(`${planet}'s aspect on house ${house} adds a chronic pressure to this domain — not necessarily blocking, but rarely effortless.`);
  });

  // Dusthana lord placements
  const dusthanaLords = d1Result.reasons
    .filter(r => r.includes('dusthana placement') && r.includes('[D1]'))
    .slice(0, 1);
  dusthanaLords.forEach(r => {
    const lord = r.match(/lord (\w+)/)?.[1];
    if (lord) cautions.push(`The house lord ${lord} is placed in a challenging house — the domain full promise requires navigating structural obstacles first.`);
  });

  // D9 weakness when D1 is strong
  if (d1Result.strength === 'Strong' && d9Result.strength === 'Weak') {
    cautions.push(`D9 (soul confirmation) is weak — early-life expression may be stronger than what sustains over time; the inner conviction around this domain may waver even when outer circumstances look favourable.`);
  }

  return cautions.slice(0, 3); // cap at 3 cautions per domain
}

// ── Pattern describer ─────────────────────────────────────────────────────────
// Reads the top reasons and yogas to describe the actual configuration in plain language.
function describePattern(d1Result, d9Result, yogas, config, d1, d9) {
  const parts = [];

  // Leading yoga if present
  const relevantYogas = yogas.filter(y => y.domains.includes(config.title));
  if (relevantYogas.length) {
    const top = relevantYogas[0];
    parts.push(top.name + ': ' + top.reason.replace(/^[^:]+: /, '').split('—')[0].trim());
  }

  // Primary karaka placement
  const pk = config.karakas[0];
  const pkHouse = Object.entries(d1.houses).find(([,v])=>v.includes(pk))?.[0];
  if (pkHouse) {
    const sign = HOUSE_SIGN_BY_LAGNA[d1.lagnaSign]?.[parseInt(pkHouse)];
    const dig  = sign ? dignityModifier(pk, sign) : 0;
    const digLabel = dig >= 2 ? ' (exalted)' : dig === 1 ? ' (own sign)' : dig < 0 ? ' (debilitated)' : '';
    const fsLabel = functionalStatus(pk, d1.lagnaSign);
    const fsDesc = fsLabel==='Y'?'yogakaraka':fsLabel==='B'?'benefic':fsLabel==='M'?'malefic':'neutral';
    parts.push(`${pk}${digLabel} in D1-H${pkHouse} as ${fsDesc}`);
  }

  // D9 primary karaka
  const pkD9House = Object.entries(d9.houses).find(([,v])=>v.includes(pk))?.[0];
  if (pkD9House) {
    const sign = HOUSE_SIGN_BY_LAGNA[d9.lagnaSign]?.[parseInt(pkD9House)];
    const dig  = sign ? dignityModifier(pk, sign) : 0;
    const digLabel = dig >= 2 ? ' exalted' : dig === 1 ? ' own sign' : dig < 0 ? ' debilitated' : '';
    parts.push(`D9: ${pk}${digLabel} in H${pkD9House}`);
  }

  return parts.filter(Boolean).join(' · ');
}

// ── Indication builder ────────────────────────────────────────────────────────
// Translates the verdict + supporting evidence into a directional statement.
// Uses temporal language tied to D1 vs D9 relationship.
const INDICATION_MAP = {
  'In Full Flow': {
    base: 'Strong and sustained expression across the lifespan',
    d1d9: 'Both the outer experience (D1) and the soul-level confirmation (D9) align — this domain operates with natural momentum and rarely needs to be forced.'
  },
  'Foundation Holds': {
    base: 'Solid outer-life platform with room to deepen',
    d1d9: 'The D1 structure is reliable — the external circumstances, capacity, and effort are present. D9 suggests the soul-level resonance is still forming; the domain functions well but may feel less settled internally than it appears externally.'
  },
  'Ripening': {
    base: 'Inner confirmation building; the domain arrives more fully later',
    d1d9: 'D9 is stronger than D1 — the soul-level promise is clear, but the outer-life expression is still developing. This domain tends to improve materially and emotionally as the native moves through the second half of life.'
  },
  'Deferred, Not Denied': {
    base: 'Karmic delay — the domain is promised but the path is longer',
    d1d9: 'D9 strongly confirms this domain; D1 shows the outer path is harder. Classical Parashari reading: what is indicated in the D9 will manifest — the question is timing, not whether. Dasha activation windows are the key variable.'
  },
  'Peak Comes Early': {
    base: 'Front-loaded strength — the domain is most active in early to mid-life',
    d1d9: 'D1 is strong but D9 is weak — the outer-life expression is real and visible, particularly in the first half of life. D9 weakness suggests the soul-level sustenance is harder to maintain; what begins with promise may need conscious renewal after the peak period passes.'
  },
  'Still Forming': {
    base: 'The domain is in process — neither fully established nor blocked',
    d1d9: 'Neither D1 nor D9 is strongly established. The potential exists but has not crystallised into consistent outer or inner expression. Dasha periods of the domain activating planets are the windows when the pattern sharpens.'
  },
  'Needs Tending': {
    base: 'Both charts show challenge — this domain requires conscious attention',
    d1d9: 'D1 and D9 both indicate pressure in this domain. This does not mean the domain is closed — it means it does not operate automatically and will require deliberate cultivation, timing awareness, and realistic expectations.'
  }
};

function buildIndication(verdict, config, d1Result, d9Result, yogas) {
  const map = INDICATION_MAP[verdict] || INDICATION_MAP['Still Forming'];
  const yogaBoosts = yogas.filter(y => y.type==='BOOST' && y.domains.includes(config.title));
  const yogaSuppresses = yogas.filter(y => y.type==='SUPPRESS' && y.domains.includes(config.title));

  let text = map.d1d9;

  if (yogaBoosts.length) {
    text += ` ${yogaBoosts[0].name} reinforces this domain.`;
  }
  if (yogaSuppresses.length) {
    text += ` Note: ${yogaSuppresses[0].name} introduces a counterweight that must be navigated.`;
  }

  return text;
}

// ── Format activation windows as readable text ────────────────────────────────
function formatActivationWindows(windows, config) {
  if (!windows || !windows.length) return null;

  // If phase info is present (current age known), lead with what's AHEAD and add
  // already-passed windows only as brief context. This directly serves the two
  // questions the report answers: "why has this been happening" (past) and
  // "what's ahead" (upcoming). If phase is unknown, fall back to the original
  // whole-life presentation.
  const hasPhase = windows.some(w => w.phase && w.phase !== 'unknown');

  function label(w, withWithin) {
    const lvl = w.level === 'Mahadasha' ? 'Mahadasha'
              : (withWithin && w.within ? `AD within ${w.within} MD` : 'AD');
    return `${w.planet} ${lvl} (age ${Math.round(w.from_age)}–${Math.round(w.to_age)})`;
  }

  if (hasPhase) {
    const upcoming = windows.filter(w => w.phase === 'upcoming' || w.phase === 'current');
    const past     = windows.filter(w => w.phase === 'past');
    const parts = [];

    if (upcoming.length) {
      // Prioritise primary/strong among upcoming, keep chronological
      const up = upcoming
        .sort((a, b) => a.from_age - b.from_age)
        .slice(0, 4)
        .map(w => label(w, true));
      parts.push('Ahead: ' + up.join(', '));
    } else {
      parts.push('Ahead: the principal activating periods for this area now sit later in the chart or have already unfolded; growth here comes through steady effort rather than a single dramatic window.');
    }

    if (past.length) {
      const pa = past
        .sort((a, b) => b.to_age - a.to_age) // most recent past first
        .slice(0, 2)
        .map(w => label(w, false));
      parts.push('Already moved through: ' + pa.join(', '));
    }

    return parts.join('. ');
  }

  // ── Fallback: original whole-life grouping (phase unknown) ──────────────────
  const primary   = windows.filter(w => w.priority === 'primary');
  const strong    = windows.filter(w => w.priority === 'strong');
  const secondary = windows.filter(w => w.priority === 'secondary').slice(0, 4);

  const parts = [];

  if (primary.length) {
    const p = primary.slice(0, 2).map(w => `${w.planet} Mahadasha (age ${Math.round(w.from_age)}–${Math.round(w.to_age)})`);
    parts.push('Primary windows: ' + p.join(', '));
  }

  if (strong.length) {
    const s = strong.slice(0, 3).map(w => `${w.planet} AD within ${w.within} MD (age ${Math.round(w.from_age)}–${Math.round(w.to_age)})`);
    parts.push('Strong sub-periods: ' + s.join(', '));
  }

  if (secondary.length && parts.length < 2) {
    const s = secondary.slice(0, 2).map(w => `${w.planet} AD (age ${Math.round(w.from_age)}–${Math.round(w.to_age)})`);
    parts.push('Secondary windows: ' + s.join(', '));
  }

  return parts.join('. ');
}

// ── Master statement builder ──────────────────────────────────────────────────
// Takes all computed data for one domain and returns a ChartStatement object.
function buildChartStatement(config, d1, d9, domainResult, dashas, birthDate, allYogas) {
  const d1Result = domainResult._d1Result || {};
  const d9Result = domainResult._d9Result || {};

  const currentAge        = (function () {
    const b = new Date(birthDate);
    if (isNaN(b.getTime())) return null;
    return parseFloat(((Date.now() - b) / (365.25*24*3600*1000)).toFixed(1));
  })();
  const activationWindows = getDashaActivationWindows(config, dashas, birthDate, d1.lagnaSign, currentAge);
  const confidence        = assessConfidence(d1Result, d9Result, allYogas, config);
  const cautions          = buildCautions(d1Result, d9Result, new Set(), new Set(), config);
  const pattern           = describePattern(d1Result, d9Result, allYogas, config, d1, d9);
  const indication        = buildIndication(domainResult.verdict, config, d1Result, d9Result, allYogas);
  const windowText        = formatActivationWindows(activationWindows, config);

  return {
    domain:           config.title,
    pattern,
    indication,
    activationWindows,
    windowSummary:    windowText,
    cautions,
    confidence:       confidence.level,
    confidenceReason: confidence.reason,
    verdict:          domainResult.verdict,
    d1Strength:       domainResult.d1Strength,
    d9Strength:       domainResult.d9Strength,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3: SPECIFIC LIFE EVENT FLAG LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════
//
// ~60 specific planetary configurations mapped to their classical Parashari
// indications. Each entry specifies:
//   id          — unique identifier
//   check(d1,d9,ctx) — returns true/false (or the matched value for dynamic text)
//   domain      — which life area this primarily affects
//   title       — short headline (≤6 words)
//   indication  — what the configuration suggests in plain language
//   caution     — what complicates or qualifies it
//   window_lords — dasha planets when this flag becomes most live
//   confidence  — baseline confidence before chart context (High/Medium/Low)
//
// ctx contains: { lagna, houseToSign, combustSet, lagnaLord, planetHouse,
//                 functionalStatus, dignityModifier, yogasD1, yogasD9,
//                 classification }

// ── Helper for flag detection ─────────────────────────────────────────────────
function makeFlagContext(d1, d9, combustSet, yogasD1, yogasD9, classification) {
  const lagna       = d1.lagnaSign;
  const houseToSign = HOUSE_SIGN_BY_LAGNA[lagna] || {};
  const d9HTS       = HOUSE_SIGN_BY_LAGNA[d9.lagnaSign] || {};
  const houses      = d1.houses;
  const d9Houses    = d9.houses;

  function ph(planet, chartHouses) {
    for (let h=1; h<=12; h++) {
      if ((chartHouses[h]||[]).includes(planet)) return h;
    }
    return null;
  }
  function sign(h)   { return houseToSign[h] || null; }
  function d9sign(h) { return d9HTS[h] || null; }
  function fs(p)     { return functionalStatus(p, lagna); }
  function dig(p, h) { const s = sign(h); return s ? dignityModifier(p, s) : 0; }
  function d9dig(p, h) { const s = d9sign(h); return s ? dignityModifier(p, s) : 0; }
  function inHouses(p, hs, chartH) { const h=ph(p,chartH||houses); return h && hs.includes(h); }
  function countIn(hs) { return hs.reduce((n,h)=>n+(houses[h]||[]).filter(p=>!["Rahu","Ketu"].includes(p)).length,0); }
  function planets(h, chartH) { return (chartH||houses)[h] || []; }
  const lagnaLord = SIGN_LORDS[lagna];

  return { lagna, houseToSign, d9HTS, houses, d9Houses, ph, sign, d9sign, fs, dig, d9dig,
           inHouses, countIn, planets, lagnaLord, combustSet, yogasD1, yogasD9,
           classification, d1, d9 };
}

// ── The flag library ──────────────────────────────────────────────────────────
const EVENT_FLAGS = [

  // ════ IDENTITY & SELF ═══════════════════════════════════════════════════════

  {
    id: 'lagna-lord-h1',
    check: (c) => c.ph(c.lagnaLord, c.houses) === 1,
    domain: 'Identity & Personality',
    title: 'Lagna lord in own house',
    indication: 'The native projects a strong and self-consistent identity. The first impression matches the inner self. Physical constitution tends to be resilient and the personality is well-defined from early in life.',
    caution: 'If the lagna lord is also malefic for this lagna, the strong projection can come with a domineering or rigid quality.',
    window_lords: (c) => [c.lagnaLord],
    confidence: 'High'
  },
  {
    id: 'lagna-lord-h12',
    check: (c) => c.ph(c.lagnaLord, c.houses) === 12,
    domain: 'Identity & Personality',
    title: 'Lagna lord in 12th — private nature',
    indication: 'The native is oriented toward inner life, solitude, or foreign/spiritual environments. The public self is understated; the private self is far richer. There is often a gift for introspection and hidden or behind-the-scenes work.',
    caution: 'Can produce identity confusion or a persistent sense of not quite belonging in the ordinary social world. Physical vitality may need conscious protection.',
    window_lords: (c) => [c.lagnaLord, 'Ketu'],
    confidence: 'Medium'
  },
  {
    id: 'lagna-lord-h6',
    check: (c) => c.ph(c.lagnaLord, c.houses) === 6,
    domain: 'Identity & Personality',
    title: 'Lagna lord in 6th — identity through service',
    indication: 'The native finds themselves through work, service, health challenges, or conflict. The identity is shaped by overcoming obstacles. Professions involving healing, law, competition, or social service are common.',
    caution: 'Health vulnerabilities can periodically undermine confidence. The native may attract or create conflict in close relationships without intending to.',
    window_lords: (c) => [c.lagnaLord, 'Mars', 'Saturn'],
    confidence: 'Medium'
  },
  {
    id: 'lagna-lord-h8',
    check: (c) => c.ph(c.lagnaLord, c.houses) === 8,
    domain: 'Identity & Personality',
    title: 'Lagna lord in 8th — transformative identity',
    indication: 'The native undergoes profound personal reinvention at least once. The identity is not fixed — it is repeatedly dismantled and rebuilt. Research, psychology, occult sciences, and anything hidden attract deeply.',
    caution: 'Chronic health vulnerabilities, unexpected life disruptions, and difficulty maintaining consistent outward persona are common. The chart must be assessed for Viparita Yoga before concluding this is purely challenging.',
    window_lords: (c) => [c.lagnaLord, 'Saturn', 'Rahu'],
    confidence: 'Medium'
  },
  {
    id: 'rahu-lagna',
    check: (c) => c.planets(1).includes('Rahu'),
    domain: 'Identity & Personality',
    title: 'Rahu on the ascendant',
    indication: 'The native projects an unusual, unconventional, or magnetically ambiguous persona. There is a quality of being difficult to fully read. First impressions are strong but may not match the reality underneath. Rahu amplifies whatever sign it occupies — the personality tends toward excess in the quality of the lagna sign.',
    caution: 'Identity can feel unstable from the inside even when projecting confidence externally. There may be a persistent sense of restlessness or the feeling that the outer self is a performance. The real person takes time to emerge.',
    window_lords: (c) => ['Rahu'],
    confidence: 'High'
  },
  {
    id: 'ketu-lagna',
    check: (c) => c.planets(1).includes('Ketu'),
    domain: 'Identity & Personality',
    title: 'Ketu on the ascendant — detached presence',
    indication: 'The native carries a quality of spiritual detachment in the outward persona. They are often perceived as wise beyond their years, or as somewhat otherworldly. Past-life themes surface readily — the native may feel they have already lived parts of this life before.',
    caution: 'Ketu in the lagna can produce genuine disinterest in self-promotion, which may disadvantage the native in competitive or visibility-dependent fields. Physical sensitivity is often elevated.',
    window_lords: (c) => ['Ketu', 'Mars'],
    confidence: 'Medium'
  },
  {
    id: 'saturn-lagna',
    check: (c) => c.planets(1).includes('Saturn'),
    domain: 'Identity & Personality',
    title: 'Saturn on the ascendant — late bloomer',
    indication: 'The native tends to project a serious, reserved, or mature quality from early in life. Recognition and confidence build slowly but durably. Life genuinely improves after age 35, and continues improving through age 56 and beyond. Discipline and persistence are core identity traits.',
    caution: 'Early life can feel constrained, unlucky, or delayed relative to peers. Health and energy may require consistent management. The native must guard against excessive self-criticism.',
    window_lords: (c) => ['Saturn'],
    confidence: 'High'
  },

  // ════ WEALTH & FAMILY ═══════════════════════════════════════════════════════

  {
    id: 'jupiter-h2',
    check: (c) => c.planets(2).includes('Jupiter'),
    domain: 'Wealth & Family',
    title: 'Jupiter in 2nd — family fortune',
    indication: 'Jupiter in the house of family and accumulated wealth is a classical dhana yoga indicator. The family of origin tends to be supportive, and the native has an innate capacity to attract and expand wealth. Speech is often eloquent and trusted.',
    caution: 'If Jupiter is afflicted or combust, the promise is diluted. The wealth may come later in life than expected, or through indirect means.',
    window_lords: (c) => ['Jupiter'],
    confidence: 'High'
  },
  {
    id: 'h2-lord-h11',
    check: (c) => {
      const h2lord = SIGN_LORDS[c.sign(2)];
      return h2lord && c.ph(h2lord, c.houses) === 11;
    },
    domain: 'Wealth & Family',
    title: 'H2 lord in 11th — sustained earnings',
    indication: 'The lord of accumulated wealth placed in the house of gains creates a direct channel between earning and retention. Income tends to be consistent and the native is skilled at converting efforts into tangible gains.',
    caution: 'If the H2 lord is afflicted in H11, the gains may come through sustained hard work rather than passive accumulation. Social networks are important to financial outcomes.',
    window_lords: (c) => [SIGN_LORDS[c.sign(2)], SIGN_LORDS[c.sign(11)]],
    confidence: 'High'
  },
  {
    id: 'moon-h2',
    check: (c) => c.planets(2).includes('Moon'),
    domain: 'Wealth & Family',
    title: 'Moon in 2nd — fluctuating wealth',
    indication: 'The Moon in the house of wealth indicates financial flows that mirror emotional cycles. The native may experience both highs and lows in material resources. The family emotional environment was formative and continues to influence financial decision-making.',
    caution: 'Wealth retention is inconsistent — the native tends to earn well but may spend or lose through emotional decisions. Savings discipline needs to be consciously cultivated.',
    window_lords: (c) => ['Moon'],
    confidence: 'Medium'
  },
  {
    id: 'saturn-h2',
    check: (c) => c.planets(2).includes('Saturn'),
    domain: 'Wealth & Family',
    title: 'Saturn in 2nd — delayed but durable wealth',
    indication: 'Saturn delays and disciplines the house of family and wealth. Financial security builds slowly but becomes genuinely stable. Family relationships tend to be structured, duty-bound, or involve responsibility beyond the norm.',
    caution: 'Early financial life may feel constrained. Speech can be blunt or cautious in ways that create social friction. Family communication may be formal or emotionally restrained.',
    window_lords: (c) => ['Saturn'],
    confidence: 'High'
  },

  // ════ MARRIAGE & RELATIONSHIP ════════════════════════════════════════════════

  {
    id: 'h7-stellium',
    check: (c) => (c.planets(7) || []).filter(p=>p!=='Rahu'&&p!=='Ketu').length >= 2,
    domain: 'Marriage & Relationship',
    title: 'Multiple planets in 7th — complex partnership',
    indication: 'The 7th house carries multiple planetary voices. Partnership is a central and defining theme of this life — relationships are rarely simple and often deeply formative. The nature of the spouse or partner reflects the blend of planets present.',
    caution: 'The complexity of the 7th house can make finding an equally balanced partner challenging. Multiple planets in H7 can also indicate more than one significant relationship, or a partner with a multi-faceted and sometimes contradictory personality.',
    window_lords: (c) => (c.planets(7)||[]),
    confidence: 'High'
  },
  {
    id: 'venus-h7',
    check: (c) => {
      const h = c.ph('Venus', c.houses);
      return h === 7 && c.fs('Venus') !== 'M';
    },
    domain: 'Marriage & Relationship',
    title: 'Venus in 7th — natural partner magnetism',
    indication: 'Venus in its own domain (the 7th house) is one of the most favourable placements for partnership. The native has a natural capacity for harmony in relationships, and the partner tends to be refined, aesthetically sensitive, or socially skilled.',
    caution: 'If Venus is combust here, the promise is reduced — the native may attract partners but struggle to sustain the harmony. For Virgo and Scorpio lagnas, Venus here is a more complex placement.',
    window_lords: (c) => ['Venus'],
    confidence: 'High'
  },
  {
    id: 'saturn-h7',
    check: (c) => c.planets(7).includes('Saturn'),
    domain: 'Marriage & Relationship',
    title: 'Saturn in 7th — partnership carries weight',
    indication: 'Saturn in the house of partnership does not deny marriage but shapes it — relationships tend to arrive later than the social norm, involve age difference, carry significant responsibility, or feel more like a karmic contract than a romantic union. What is built lasts.',
    caution: 'Early romantic life may feel lonely or restricted. The native may attract partners with serious qualities or burdens (illness, career intensity, emotional unavailability). The relationship improves markedly after the first Saturn return (age 29).',
    window_lords: (c) => ['Saturn', SIGN_LORDS[c.sign(7)]],
    confidence: 'High'
  },
  {
    id: 'mars-h7',
    check: (c) => c.planets(7).includes('Mars'),
    domain: 'Marriage & Relationship',
    title: 'Mars in 7th — high-intensity partnership',
    indication: 'Mars in the 7th brings intensity, passion, and directness to partnership. The native is attracted to strong, independent, or dynamic partners. Physical chemistry is significant in partner selection.',
    caution: 'Mars in H7 is the classic Mangal dosha position — conflict, power struggles, and separation risk are elevated if the partner does not have equivalent Mars energy or a compensating placement. Must be read alongside the H7 lord and Venus strength.',
    window_lords: (c) => ['Mars', 'Venus'],
    confidence: 'Medium'
  },
  {
    id: 'rahu-h7',
    check: (c) => c.planets(7).includes('Rahu'),
    domain: 'Marriage & Relationship',
    title: 'Rahu in 7th — unconventional partnership',
    indication: 'Rahu in the house of marriage draws the native toward partners who are unusual, foreign, from a different background, or outside conventional social expectations. The relationship often begins in an unconventional way.',
    caution: 'Rahu amplifies and distorts — the native may idealise the partner in a way that cannot survive close contact. There is a risk of deception or misrepresentation, consciously or otherwise, early in the relationship. Clarity before commitment is essential.',
    window_lords: (c) => ['Rahu', SIGN_LORDS[c.sign(7)]],
    confidence: 'Medium'
  },
  {
    id: 'venus-d9-h1',
    check: (c) => (c.d9Houses[1]||[]).includes('Venus'),
    domain: 'Marriage & Relationship',
    title: 'Venus in D9 lagna — soul-level partnership',
    indication: 'Venus in the D9 ascendant is one of the strongest signatures for deep and lasting partnership. At the soul level, the native is genuinely oriented toward committed union. The partner tends to have refined Venusian qualities and the relationship has a quality of feeling destined.',
    caution: 'If Venus is also combust in D1, the soul-level orientation is real but the practical path to partnership may still be complicated.',
    window_lords: (c) => ['Venus'],
    confidence: 'High'
  },
  {
    id: 'h7-lord-h12',
    check: (c) => {
      const h7lord = SIGN_LORDS[c.sign(7)];
      return h7lord && c.ph(h7lord, c.houses) === 12;
    },
    domain: 'Marriage & Relationship',
    title: 'H7 lord in 12th — private or foreign partnership',
    indication: 'The lord of the partnership house in the house of foreign lands and private life suggests the partner may come from a different cultural background, or the relationship has a private, secretive, or foreign dimension. There is often a quality of karmic completion in the union.',
    caution: 'H7 lord in H12 can also indicate that the partnership involves loss, sacrifice, or emotional distance. The relationship may not conform to social expectations and requires acceptance of an unconventional dynamic.',
    window_lords: (c) => [SIGN_LORDS[c.sign(7)], SIGN_LORDS[c.sign(12)]],
    confidence: 'Medium'
  },

  // ════ CAREER & AMBITION ══════════════════════════════════════════════════════

  {
    id: 'sun-h10',
    check: (c) => c.planets(10).includes('Sun'),
    domain: 'Career & Ambition',
    title: 'Sun in 10th — natural authority',
    indication: 'Sun in the midheaven is one of the most powerful career placements — the native is drawn toward leadership, public life, government, administration, or any field where authority and recognition are central. The reputation becomes a genuine asset over time.',
    caution: 'If Sun is debilitated or heavily afflicted, authority may be contested or come with conflict. The native may also struggle with overbearing superiors before eventually becoming the authority figure themselves.',
    window_lords: (c) => ['Sun', SIGN_LORDS[c.sign(10)]],
    confidence: 'High'
  },
  {
    id: 'saturn-h10',
    check: (c) => c.planets(10).includes('Saturn'),
    domain: 'Career & Ambition',
    title: 'Saturn in 10th — slow and lasting career',
    indication: 'Saturn in the house of career builds slowly, durably, and with tremendous structural integrity. The native tends to have a longer career arc than peers — starting later, peaking later, but maintaining relevance long after others have faded. Fields involving structure, governance, discipline, engineering, or institutional authority suit this placement.',
    caution: 'The first half of the career (before age 35) may feel frustrating — advancement is slower than deserved and recognition is delayed. The native must not mistake slowness for failure.',
    window_lords: (c) => ['Saturn'],
    confidence: 'High'
  },
  {
    id: 'h10-lord-h1',
    check: (c) => {
      const h10lord = SIGN_LORDS[c.sign(10)];
      return h10lord && c.ph(h10lord, c.houses) === 1;
    },
    domain: 'Career & Ambition',
    title: 'H10 lord in lagna — career = identity',
    indication: 'When the lord of career occupies the ascendant, professional life becomes deeply intertwined with personal identity. The native defines themselves through their work and is often known primarily by their professional role. Career success has outsized impact on self-esteem and sense of purpose.',
    caution: 'Career setbacks hit the identity directly and can produce periods of profound disorientation. The native benefits from cultivating a sense of self that does not depend entirely on professional status.',
    window_lords: (c) => [SIGN_LORDS[c.sign(10)]],
    confidence: 'High'
  },
  {
    id: 'yk-h10',
    check: (c) => {
      const ykPlanets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']
        .filter(p => functionalStatus(p, c.lagna)==='Y');
      return ykPlanets.some(yk => c.planets(10).includes(yk));
    },
    domain: 'Career & Ambition',
    title: 'Yogakaraka in 10th — peak career signature',
    indication: 'The yogakaraka planet in the house of career is among the strongest possible signatures for professional recognition and achievement. The native is likely to reach the apex of their field or be seen as an authority in their domain. The quality of the career reflects the yogakaraka planet.',
    caution: 'The timing of peak recognition aligns with the yogakaraka Mahadasha — outside of that period, the potential exists but may not be fully expressed.',
    window_lords: (c) => ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'].filter(p=>functionalStatus(p,c.lagna)==='Y'),
    confidence: 'High'
  },
  {
    id: 'mercury-h10',
    check: (c) => c.planets(10).includes('Mercury'),
    domain: 'Career & Ambition',
    title: 'Mercury in 10th — communication-based career',
    indication: 'Mercury in the career house draws the native toward professions involving communication, intellect, writing, teaching, analysis, or commerce. The reputation is built on versatility and mental agility. Multiple career streams or simultaneous projects are common.',
    caution: 'If Mercury is combust, the reputation may be more fragile or subject to misrepresentation than the native realises. Consistency of message matters more for this placement than for others.',
    window_lords: (c) => ['Mercury'],
    confidence: 'Medium'
  },

  // ════ HEALTH & VITALITY ══════════════════════════════════════════════════════

  {
    id: 'sun-h6',
    check: (c) => c.planets(6).includes('Sun'),
    domain: 'Health & Vitality',
    title: 'Sun in 6th — vitality through competition',
    indication: 'Sun in the house of health and service indicates the native has genuine vitality but expresses it most powerfully in competitive or service-oriented contexts. The immune system is generally robust. Recovery from illness tends to be stronger than average.',
    caution: 'Sun in H6 can produce ongoing conflicts with authority figures or employers. The body thrives on activity and wilts under enforced inaction.',
    window_lords: (c) => ['Sun', SIGN_LORDS[c.sign(6)]],
    confidence: 'Medium'
  },
  {
    id: 'moon-h6',
    check: (c) => c.planets(6).includes('Moon'),
    domain: 'Health & Vitality',
    title: 'Moon in 6th — emotional body sensitivity',
    indication: 'Moon in the house of health connects emotional state directly to physical wellbeing. The body is sensitive to stress, emotional conflict, and environmental conditions. When the emotional life is supported, health is good; when it is under strain, the body signals quickly.',
    caution: 'This placement requires careful management of emotional health as a prerequisite for physical health. Digestive sensitivity, hormonal fluctuations, and stress-related conditions are areas to monitor.',
    window_lords: (c) => ['Moon'],
    confidence: 'High'
  },
  {
    id: 'saturn-h6-exalted',
    check: (c) => {
      const h = c.ph('Saturn', c.houses);
      return h === 6 && c.d9dig('Saturn', c.ph('Saturn', c.d9Houses)) >= 1;
    },
    domain: 'Health & Vitality',
    title: 'Saturn in 6th (D9 confirmed) — robust endurance',
    indication: 'Saturn exalted or strong in the house of health is a longevity indicator. The native tends toward chronic rather than acute health challenges, but the constitution has remarkable endurance. They often outlive expectations and remain functional well into later years.',
    caution: 'Bone health, joints, and the nervous system require consistent maintenance. Do not ignore chronic low-grade conditions — they respond to Saturn discipline (regular routines, structured care) better than acute interventions.',
    window_lords: (c) => ['Saturn'],
    confidence: 'Medium'
  },
  {
    id: 'multiple-dusthana',
    check: (c) => {
      const count = [6,8,12].reduce((n,h)=>{
        const ps = (c.houses[h]||[]).filter(p=>!['Rahu','Ketu'].includes(p));
        return n + ps.length;
      }, 0);
      return count >= 3;
    },
    domain: 'Health & Vitality',
    title: 'Multiple planets in dusthana houses',
    indication: 'Three or more classical planets in the 6th, 8th, and 12th houses concentrate the Tapas signature in the health axis. The physical body carries the chart karmas more directly than average. Health is often the arena where the deepest transformations occur.',
    caution: 'This does not predict chronic illness, but it does indicate that health will require conscious and ongoing attention. The Tapas chart pattern means health improves with sustained discipline rather than responding to short-term interventions.',
    window_lords: (c) => ['Saturn', 'Mars', SIGN_LORDS[c.sign(6)], SIGN_LORDS[c.sign(8)]],
    confidence: 'High'
  },

  // ════ EMOTIONAL FIDELITY ════════════════════════════════════════════════════

  {
    id: 'moon-h12',
    check: (c) => c.planets(12).includes('Moon'),
    domain: 'Emotional Fidelity',
    title: 'Moon in 12th — hidden emotional life',
    indication: 'The Moon in the 12th house places the emotional self in the domain of hidden life, spiritual retreat, and private experience. The native has a rich inner world that is rarely fully shared. There is often a pull toward solitude, spiritual practice, or work in private or institutional settings.',
    caution: 'The 12th Moon can create emotional compartmentalisation — the native may experience feelings intensely in private but project equanimity publicly. This gap, if unmanaged, can create distance in relationships.',
    window_lords: (c) => ['Moon', SIGN_LORDS[c.sign(12)]],
    confidence: 'Medium'
  },
  {
    id: 'ketu-h5',
    check: (c) => c.planets(5).includes('Ketu'),
    domain: 'Emotional Fidelity',
    title: 'Ketu in 5th — children or creativity carries karma',
    indication: 'Ketu in the 5th house brings a past-life dimension to creativity, children, and romance. The native may have an unusual relationship with parenthood — either a deep karmic bond with one child, ambivalence about having children, or unexpected circumstances around the first child.',
    caution: 'The first pregnancy or creative endeavour may involve delays, losses, or unconventional circumstances. This is not a denial of children — it is a signal that the path is non-standard and carries karmic weight.',
    window_lords: (c) => ['Ketu', 'Mars', SIGN_LORDS[c.sign(5)]],
    confidence: 'Medium'
  },
  {
    id: 'rahu-h5',
    check: (c) => c.planets(5).includes('Rahu'),
    domain: 'Emotional Fidelity',
    title: 'Rahu in 5th — intense creative drive',
    indication: 'Rahu in the 5th amplifies the desire for self-expression, romance, and speculative ventures. The native tends toward intense romantic attachments, creative obsessions, or risk-taking in financial speculation. The creative output can be genuinely unusual and original.',
    caution: 'Rahu in H5 can produce an overwhelming quality in romantic attraction — the native may fall hard and fast, often for someone outside their usual social world. Children may come through unconventional means or carry an unusual destiny.',
    window_lords: (c) => ['Rahu', SIGN_LORDS[c.sign(5)]],
    confidence: 'Medium'
  },
  {
    id: 'mars-h8',
    check: (c) => c.planets(8).includes('Mars'),
    domain: 'Emotional Fidelity',
    title: 'Mars in 8th — intensity in hidden matters',
    indication: 'Mars in the 8th house carries raw, forceful energy into the domain of hidden life, shared resources, and psychological depth. The native has a powerful drive to understand what lies beneath the surface and does not shy from difficult truths.',
    caution: 'Mars in H8 is one of the classic Mangal dosha positions. It can introduce themes of sudden events, surgical interventions, or conflict over shared resources into the partnership. The native must channel this energy consciously or it surfaces as crisis.',
    window_lords: (c) => ['Mars', SIGN_LORDS[c.sign(8)]],
    confidence: 'Medium'
  },
  {
    id: 'kemadruma-moon',
    check: (c) => {
      const moonH = c.ph('Moon', c.houses);
      if (!moonH) return false;
      const prev = moonH===1?12:moonH-1, next = moonH===12?1:moonH+1;
      const adjPlanets = [...(c.houses[prev]||[]),...(c.houses[next]||[])];
      return adjPlanets.filter(p=>!['Rahu','Ketu'].includes(p)).length === 0;
    },
    domain: 'Emotional Fidelity',
    title: 'Kemadruma Moon — periodic emotional isolation',
    indication: 'The Moon with no planet in the adjacent houses (Kemadruma Yoga) produces a quality of emotional aloneness that recurs throughout life. The native is capable of deep feeling but may struggle to find adequate resonance in their social environment.',
    caution: 'This is most acute during Moon Mahadasha and Antardasha periods. The native benefits from solitude that is chosen rather than imposed — spiritual practice, creative work, or service channels the isolation productively.',
    window_lords: (c) => ['Moon'],
    confidence: 'Medium'
  },

  // ════ CROSS-DOMAIN STRUCTURAL FLAGS ═════════════════════════════════════════

  {
    id: 'lagna-lord-h9',
    check: (c) => c.ph(c.lagnaLord, c.houses) === 9,
    domain: 'Identity & Personality',
    title: 'Lagna lord in 9th — dharmic life path',
    indication: 'The lagna lord in the 9th (the strongest trikona) is a Bhagya yoga — the native is structurally supported by fortune, higher education, and philosophical alignment. The life path tends to align with the native purpose rather than running against it.',
    caution: 'The 9th house pull can make the native more interested in the ideal than the practical. Relationship with the father or a guru figure is often pivotal — positive or challenging.',
    window_lords: (c) => [c.lagnaLord, SIGN_LORDS[c.sign(9)]],
    confidence: 'High'
  },
  {
    id: 'parivartana-detected',
    check: (c, yogas) => {
      return (yogas||[]).some(y=>y.name==='Parivartana Yoga');
    },
    domain: null,  // cross-domain
    title: 'Mutual reception — exchange of strength',
    indication: 'Two planets occupy each other signs, creating a Parivartana Yoga (mutual reception). Both planets act as if in their own sign, significantly strengthening the houses they rule and the domains they support. This is one of the most quietly powerful configurations in the chart.',
    caution: 'The strength of the exchange depends on the functional status of both planets for this lagna. If one planet is malefic, the exchange amplifies both the strength and the challenging quality.',
    window_lords: (c) => [],  // determined dynamically by yoga reason
    confidence: 'High'
  },
  {
    id: 'yk-combusted',
    check: (c) => {
      const ykPlanets = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']
        .filter(p => functionalStatus(p, c.lagna)==='Y');
      return ykPlanets.some(yk => c.combustSet.has(yk));
    },
    domain: null,  // cross-domain
    title: 'Yogakaraka combust — muted strength',
    indication: 'The yogakaraka — the planet with the highest structural authority in this chart — is combust (very close to the Sun). The potential it carries is genuine but the expression is inhibited. Like a lamp held too close to a fire, the light is overwhelmed rather than amplified.',
    caution: 'Domains that depend on the yogakaraka may show promise that is repeatedly just below full expression. The yogakaraka Mahadasha is critical — this is when the muted strength has its best chance to break through despite combustion.',
    window_lords: (c) => ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'].filter(p=>functionalStatus(p,c.lagna)==='Y'),
    confidence: 'High'
  },
  {
    id: 'sun-exalted',
    check: (c) => {
      const h = c.ph('Sun', c.houses);
      return h && c.sign(h) === 'Aries';
    },
    domain: 'Career & Ambition',
    title: 'Sun exalted in Aries — natural authority',
    indication: 'Exalted Sun is one of the most powerful authority signatures in the chart. The native carries a quality of innate confidence, command presence, and the ability to inspire loyalty. Leadership roles are natural rather than forced.',
    caution: 'Exalted Sun can also produce pride and an unwillingness to accept input — the native may need to consciously cultivate humility and openness to collaboration, particularly with peers.',
    window_lords: (c) => ['Sun'],
    confidence: 'High'
  },
  {
    id: 'moon-exalted',
    check: (c) => {
      const h = c.ph('Moon', c.houses);
      return h && c.sign(h) === 'Taurus';
    },
    domain: 'Emotional Fidelity',
    title: 'Moon exalted in Taurus — emotional stability',
    indication: 'Exalted Moon in Taurus is the strongest emotional placement in Jyotish. The native has deep reserves of emotional steadiness, aesthetic sensitivity, and capacity for loyalty. The mind is calm under pressure and the emotional intelligence is high.',
    caution: 'If the exalted Moon is in H6, H8, or H12, or is afflicted by Rahu or Saturn, the exaltation is partially compromised — the underlying strength is real but does not always express cleanly.',
    window_lords: (c) => ['Moon'],
    confidence: 'High'
  },
  {
    id: 'saturn-exalted',
    check: (c) => {
      const h = c.ph('Saturn', c.houses);
      return h && c.sign(h) === 'Libra';
    },
    domain: 'Career & Ambition',
    title: 'Saturn exalted in Libra — structural power',
    indication: 'Saturn exalted in Libra brings exceptional capacity for fair, disciplined, and enduring achievement. The native builds systems that last and earns respect through demonstrated reliability over time. Legal, administrative, judicial, or structural professions are well-supported.',
    caution: 'The rewards of this placement come late — often after age 36 (second Saturn return cycle). Patience is not optional; it is built into the structure of this placement.',
    window_lords: (c) => ['Saturn'],
    confidence: 'High'
  },
  {
    id: 'jupiter-h1-own',
    check: (c) => {
      const h = c.ph('Jupiter', c.houses);
      if (h !== 1) return false;
      const s = c.sign(1);
      return s === 'Sagittarius' || s === 'Pisces';
    },
    domain: 'Identity & Personality',
    title: 'Jupiter in own sign on ascendant',
    indication: 'Jupiter in own sign on the ascendant is Hamsa Mahapurusha Yoga — one of the five great planetary yogas. The native projects wisdom, generosity, and a quality of natural dignity. There is often genuine philosophical or spiritual depth beneath the surface. The body tends toward fullness and the presence is expansive.',
    caution: 'Jupiter in H1 can produce excess — over-optimism, over-extension, or underestimating practical constraints. The native may be trusted with more than they can deliver if they do not consciously manage commitments.',
    window_lords: (c) => ['Jupiter'],
    confidence: 'High'
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// STEP 5: COMPOUND PATTERN LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

const COMPOUND_PATTERNS = [

  // ════ MARRIAGE ═══════════════════════════════════════════════════════════════
  {
    id: 'marriage-stable', domain: 'Marriage & Relationship',
    title: 'Stable long-term partnership', minimumConditions: 3,
    conditions: (c) => [
      { label: 'Venus clean (not combust, not in dusthana)', pass: !c.dust.includes(c.venH) && !c.comb.has('Venus') },
      { label: 'H7 lord in supportive house',               pass: !!c.h7lH && !c.dust.includes(c.h7lH) },
      { label: 'D9 H7 lord in supportive house',            pass: !!c.d9h7lH && !c.dust.includes(c.d9h7lH) },
      { label: 'No malefics in H7',                         pass: c.malH7.length === 0 },
    ],
    indication: 'The chart indicators for sustained partnership are strong. Both the outer-life experience (D1) and the soul-level confirmation (D9) support committed union. Partnership tends to be stabilising rather than destabilising to the life overall.',
    caution: 'Dasha periods of malefic planets aspecting H7 can temporarily stress even a well-supported partnership. The native choices remain the primary variable.',
    window_lords: (c) => [c.h7lord, c.d9h7lord, 'Venus'].filter((v,i,a) => v && a.indexOf(v)===i),
    stability_note: true
  },

  {
    id: 'separation-risk', domain: 'Marriage & Relationship',
    title: 'Elevated separation probability', minimumConditions: 2,
    conditions: (c) => [
      { label: 'H7 lord in dusthana',      pass: !!c.h7lH && c.dust.includes(c.h7lH) },
      { label: '2+ malefics in H7',        pass: c.malH7.length >= 2 },
      { label: 'D9 H7 lord in dusthana',  pass: !!c.d9h7lH && c.dust.includes(c.d9h7lH) },
      { label: 'Venus combust',            pass: c.comb.has('Venus') },
      { label: 'Venus in dusthana',        pass: !!c.venH && c.dust.includes(c.venH) },
    ],
    indication: 'Multiple classical indicators for partnership disruption are present. This does not predict divorce as a certainty — it indicates the native is more likely than average to experience significant strain, prolonged separation, or formal dissolution of a primary partnership. The D9 chart is the final arbiter: if D9 H7 is clean, resilience exists even when D1 shows stress.',
    caution: 'Separation events cluster around dasha periods of the H7 lord, Venus, or malefics aspecting H7. Outside these windows the marriage may function adequately. Conscious communication and structured conflict resolution before these windows open is strongly advised.',
    window_lords: (c) => ['Venus', c.h7lord, 'Saturn', 'Rahu'].filter((v,i,a) => v && a.indexOf(v)===i),
    risk_note: true
  },

  {
    id: 'hidden-entanglement', domain: 'Emotional Fidelity',
    title: 'Hidden connection tendency', minimumConditions: 2,
    conditions: (c) => [
      { label: 'Venus, Moon or Rahu in H12',        pass: c.h(12).some(p => ['Venus','Moon','Rahu'].includes(p)) },
      { label: 'Moon in dusthana',                  pass: !!c.moonH && c.dust.includes(c.moonH) },
      { label: 'Venus or Moon in H8',               pass: c.h(8).some(p => ['Venus','Moon'].includes(p)) },
      { label: 'Rahu in H7 or H12',                pass: c.h(7).includes('Rahu') || c.h(12).includes('Rahu') },
      { label: 'H12 lord in H1, H5 or H7',         pass: !!c.ph(c.lord(12)) && [1,5,7].includes(c.ph(c.lord(12))) },
    ],
    indication: 'The chart carries indicators for emotional life that operates partly outside the primary relationship — intense non-primary attachments, private emotional connections, or a hidden inner world the partner may never fully access. The 12th and 8th house activation is the classical marker for this pattern.',
    caution: 'Most active during Rahu Mahadasha, Venus Mahadasha, and Moon Antardasha periods — particularly when coinciding with H12 transits. The native benefits from cultivating honesty in primary relationships before these windows open.',
    window_lords: (c) => ['Rahu', 'Venus', 'Moon', c.lord(12)].filter((v,i,a) => v && a.indexOf(v)===i),
    sensitivity_note: true
  },

  {
    id: 'obsessive-attachment', domain: 'Emotional Fidelity',
    title: 'Entanglement and obsessive bonding', minimumConditions: 2,
    conditions: (c) => [
      { label: 'Rahu and Venus conjunct',                       pass: !!c.rahuH && c.rahuH === c.venH },
      { label: 'Rahu and Moon conjunct',                        pass: !!c.rahuH && c.rahuH === c.moonH },
      { label: 'Venus in H8',                                   pass: c.venH === 8 },
      { label: 'Mars in H7 with another malefic',               pass: c.h(7).includes('Mars') && c.malH7.length >= 2 },
      { label: 'H5 lord in dusthana',                          pass: !!c.ph(c.lord(5)) && c.dust.includes(c.ph(c.lord(5))) },
    ],
    indication: 'The native tends toward deep consuming emotional bonds that are difficult to release. When healthy this produces extraordinary loyalty and depth; when not, it creates obsessive patterns or inability to move on after a relationship ends. Rahu amplifies whatever it touches and distorts the emotional lens.',
    caution: 'Most pronounced during Rahu Mahadasha and Venus-Rahu or Moon-Rahu antardasha periods. The intensity the native feels may exceed what the situation warrants — external perspective during these periods is protective.',
    window_lords: (c) => ['Rahu', 'Venus', 'Moon', 'Mars'].filter((v,i,a) => v && a.indexOf(v)===i),
    sensitivity_note: true
  },

  // ════ CAREER ═══════════════════════════════════════════════════════════════
  {
    id: 'career-sustained-peak', domain: 'Career & Ambition',
    title: 'Sustained career authority', minimumConditions: 3,
    conditions: (c) => [
      { label: 'Planets in H10 or H10 lord strong',  pass: c.h(10).length > 0 || (!!c.h10lH && (c.kend.includes(c.h10lH)||c.trik.includes(c.h10lH))) },
      { label: 'H10 lord in kendra or trikona',      pass: !!c.h10lH && (c.kend.includes(c.h10lH)||c.trik.includes(c.h10lH)) },
      { label: 'Sun not in dusthana',                pass: !!c.sunH && !c.dust.includes(c.sunH) },
      { label: 'Yogakaraka in kendra',               pass: ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'].some(p => functionalStatus(p,c.lagna)==='Y' && !!c.ph(p) && c.kend.includes(c.ph(p))) },
    ],
    indication: 'The career axis carries genuine structural authority. The conditions for sustained professional recognition and leadership-level contribution are present. This is not a chart that peaks and fades — the career has durability because its root structure is sound.',
    caution: 'Peak recognition aligns with the Mahadasha of the H10 lord and the yogakaraka. The arc is long and genuine — early frustration at slow progress is structural, not a failure.',
    window_lords: (c) => [c.h10lord, 'Sun', 'Saturn', ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'].find(p=>functionalStatus(p,c.lagna)==='Y')].filter((v,i,a) => v && a.indexOf(v)===i)
  },

  {
    id: 'career-multiple-streams', domain: 'Career & Ambition',
    title: 'Multiple simultaneous career streams', minimumConditions: 2,
    conditions: (c) => [
      { label: 'Mercury strong in H10 or H7',         pass: !!c.ph('Mercury') && [7,10].includes(c.ph('Mercury')) && !c.comb.has('Mercury') },
      { label: 'H10 and H3 lords both strong',        pass: !!c.h10lH && !c.dust.includes(c.h10lH) && !!c.ph(c.lord(3)) && !c.dust.includes(c.ph(c.lord(3))) },
      { label: 'Rahu in H10',                         pass: c.h(10).includes('Rahu') },
      { label: 'H2-H10 lord linkage',                 pass: c.ph(c.lord(2))===10 || c.h10lH===2 },
    ],
    indication: 'The native operates across multiple professional streams rather than a single linear career. Parallel income sources, a primary career with a significant side practice, or a professional identity that defies simple categorisation are all common expressions.',
    caution: 'Breadth can dilute depth. The native benefits from identifying the primary stream that carries the most weight and ensuring it receives focused attention alongside the parallel tracks.',
    window_lords: (c) => ['Mercury', c.h10lord, c.lord(3)].filter((v,i,a) => v && a.indexOf(v)===i)
  },

  // ════ HEALTH ═══════════════════════════════════════════════════════════════
  {
    id: 'health-life-threatening', domain: 'Health & Vitality',
    title: 'Elevated serious illness probability', minimumConditions: 2,
    conditions: (c) => [
      { label: '3+ classical planets in dusthanas', pass: [6,8,12].reduce((n,x)=>n+c.h(x).filter(p=>!['Rahu','Ketu'].includes(p)).length,0) >= 3 },
      { label: 'Malefics in H1 (lagna under stress)', pass: c.h(1).some(p=>['Saturn','Mars'].includes(p)) && c.h(1).length >= 2 },
      { label: 'H6 and H8 lords conjunct',          pass: !!c.ph(c.lord(6)) && !!c.ph(c.lord(8)) && c.ph(c.lord(6))===c.ph(c.lord(8)) },
      { label: 'Saturn in H8',                      pass: c.satH === 8 },
      { label: 'Mars and Saturn both in H8',        pass: c.marsH === 8 && c.satH === 8 },
    ],
    indication: 'The chart carries elevated markers for a serious or life-impacting health event at some point in the life. This is a probability signal, not a prediction — many charts with these indicators navigate dasha periods without acute crisis through early awareness and deliberate management. The 8th house is the primary marker for sudden transformative health events; the 6th for chronic conditions.',
    caution: 'Critical activation windows are Saturn Mahadasha, Saturn-Mars antardasha combinations, and periods when the H8 lord runs. During these windows: proactive health screening, avoiding known risk factors, and maintaining structured routines. The chart does not determine the outcome — behaviour within the dasha window does.',
    window_lords: (c) => ['Saturn', 'Mars', c.lord(8), c.lord(6)].filter((v,i,a) => v && a.indexOf(v)===i),
    risk_note: true
  },

  {
    id: 'health-robust', domain: 'Health & Vitality',
    title: 'Robust constitution and recovery', minimumConditions: 3,
    conditions: (c) => [
      { label: 'Sun strong (not combust, not in dusthana)',  pass: !!c.sunH && !c.dust.includes(c.sunH) },
      { label: 'Lagna lord in supportive house',            pass: !!c.ph(c.lagnaLord) && !c.dust.includes(c.ph(c.lagnaLord)) },
      { label: 'No malefics in H1',                        pass: !c.h(1).some(p=>['Saturn','Mars'].includes(p)) },
      { label: 'Moon strong (exalted, own or in trikona)', pass: !!c.moonH && (c.trik.includes(c.moonH) || (A.HOUSE_SIGN_BY_LAGNA[c.lagna]?.[c.moonH] && A.dignityModifier('Moon', A.HOUSE_SIGN_BY_LAGNA[c.lagna][c.moonH]) >= 1)) },
    ],
    indication: 'The physical constitution carries genuine resilience. Recovery from illness tends to be stronger and faster than average. The pattern of this constitution is that it stores energy effectively and draws on reserves when needed.',
    caution: 'A robust constitution can mask early warning signals — the native may dismiss symptoms that deserve attention precisely because they generally feel strong. Regular preventive check-ups matter more for this constitution than for those who feel challenges more acutely.',
    window_lords: (c) => [c.lagnaLord, 'Sun', 'Moon'].filter((v,i,a) => v && a.indexOf(v)===i)
  },

  // ════ OVER-INDULGENCE ══════════════════════════════════════════════════════
  {
    id: 'over-indulgence', domain: 'Health & Vitality',
    title: 'Over-indulgence and excess tendency', minimumConditions: 2,
    conditions: (c) => [
      { label: 'Rahu in pleasure houses (H1, H2, H5, H7)',        pass: !!c.rahuH && [1,2,5,7].includes(c.rahuH) },
      { label: 'Moon and Rahu conjunct',                          pass: !!c.rahuH && c.rahuH === c.moonH },
      { label: 'H2 afflicted by Rahu/Saturn without Jupiter',     pass: c.h(2).some(p=>['Rahu','Saturn'].includes(p)) && !c.h(2).includes('Jupiter') },
      { label: 'Jupiter debilitated',                             pass: !!c.jupH && A.dignityModifier('Jupiter', A.HOUSE_SIGN_BY_LAGNA[c.lagna]?.[c.jupH]) < 0 },
      { label: 'Venus afflicted by Rahu or Saturn in same house', pass: !!c.venH && c.h(c.venH).some(p=>['Rahu','Saturn'].includes(p)) },
    ],
    indication: 'The chart carries indicators for a tendency toward excess in sensory or pleasurable experiences — most commonly overindulgence in food, alcohol, or substances when emotional or psychological stress rises. Rahu influence on the 2nd house (consumption) or the Moon (emotional needs) is the classical marker. This is a constitutional tendency, not a moral judgment.',
    caution: 'The pattern is most acute during Rahu Mahadasha, Rahu Antardasha, and periods of significant emotional stress or life transition. The native benefits from identifying their specific indulgence pattern in advance and building structural alternatives for stress management before these windows open.',
    window_lords: (c) => ['Rahu', 'Venus', 'Moon', c.lord(2)].filter((v,i,a) => v && a.indexOf(v)===i),
    sensitivity_note: true
  },

  // ════ WEALTH ═══════════════════════════════════════════════════════════════
  {
    id: 'wealth-sustained', domain: 'Wealth & Family',
    title: 'Sustained wealth accumulation', minimumConditions: 3,
    conditions: (c) => [
      { label: 'H2 lord in kendra or trikona',  pass: !!c.ph(c.lord(2)) && (c.kend.includes(c.ph(c.lord(2)))||c.trik.includes(c.ph(c.lord(2)))) },
      { label: 'H11 lord in kendra or trikona', pass: !!c.ph(c.lord(11)) && (c.kend.includes(c.ph(c.lord(11)))||c.trik.includes(c.ph(c.lord(11)))) },
      { label: 'Jupiter strong',                pass: !!c.jupH && !c.comb.has('Jupiter') && A.dignityModifier('Jupiter', A.HOUSE_SIGN_BY_LAGNA[c.lagna]?.[c.jupH] || '') >= 0 },
      { label: 'H2 not afflicted without compensation', pass: !c.h(2).some(p=>['Saturn','Mars','Rahu'].includes(p)) || c.h(2).includes('Jupiter') },
    ],
    indication: 'The wealth axis is structurally supported. Both the accumulation house (H2) and the gains house (H11) carry their lords in positions enabling financial growth. Wealth builds through consistent effort rather than windfall.',
    caution: 'H2 and H11 lord dashas are the primary wealth-building windows. Use these windows for significant financial decisions and be conservative during malefic dasha periods.',
    window_lords: (c) => [c.lord(2), c.lord(11), 'Jupiter'].filter((v,i,a) => v && a.indexOf(v)===i)
  },

  {
    id: 'wealth-boom-bust', domain: 'Wealth & Family',
    title: 'Fluctuating wealth pattern', minimumConditions: 2,
    conditions: (c) => [
      { label: 'H2 lord in dusthana',           pass: !!c.ph(c.lord(2)) && c.dust.includes(c.ph(c.lord(2))) },
      { label: 'Moon afflicted (emotional spends)', pass: !!c.moonH && (c.h(c.moonH).some(p=>['Saturn','Rahu','Mars'].includes(p)) || c.dust.includes(c.moonH)) },
      { label: 'Rahu in H2 or H11',             pass: c.h(2).includes('Rahu') || c.h(11).includes('Rahu') },
      { label: 'H11 lord in dusthana',          pass: !!c.ph(c.lord(11)) && c.dust.includes(c.ph(c.lord(11))) },
    ],
    indication: 'The wealth pattern in this chart is cyclical — periods of strong earning and accumulation alternate with periods of loss, expenditure, or financial strain. The native may earn well but find that wealth does not stay consistently. Strategic behaviour at the peaks (saving aggressively when income is high) is essential.',
    caution: 'Financial decisions made during emotional or stressful periods tend to be the most damaging. Build automatic savings structures that operate independently of emotional state.',
    window_lords: (c) => [c.lord(2), c.lord(11), 'Moon', 'Rahu'].filter((v,i,a) => v && a.indexOf(v)===i)
  },
];

// ── Compound pattern detector ─────────────────────────────────────────────────
function detectCompoundPatterns(d1, d9, combustSet, yogasD1, yogasD9, classification) {
  const baseCtx = makeFlagContext(d1, d9, combustSet, yogasD1, yogasD9, classification);
  const l   = d1.lagnaSign;
  const hts = HOUSE_SIGN_BY_LAGNA[l] || {};
  const ph   = (planet, chartH) => {
    const ch = chartH || d1.houses;
    for (let i=1; i<=12; i++) { if ((ch[i]||[]).includes(planet)) return i; }
    return null;
  };
  const h   = (n, ch) => ((ch || d1.houses)[n] || []);
  const lord = (n) => SIGN_LORDS[HOUSE_SIGN_BY_LAGNA[l]?.[n]] || null;

  // Build context fresh (not from makeFlagContext which uses different field names)
  const dust=[6,8,12], kend=[1,4,7,10], trik=[1,5,9];
  const d9h7lord = SIGN_LORDS[HOUSE_SIGN_BY_LAGNA[d9.lagnaSign]?.[7]] || null;
  const ctx = {
    lagna:     l,    lagnaLord: SIGN_LORDS[l],
    ph, h, lord,     comb: combustSet,
    venH:  ph('Venus'),  moonH: ph('Moon'),  sunH:  ph('Sun'),
    satH:  ph('Saturn'), marsH: ph('Mars'),  jupH:  ph('Jupiter'),
    rahuH: ph('Rahu'),
    h7lord: lord(7),    h7lH:  ph(lord(7)),
    h10lord: lord(10),  h10lH: ph(lord(10)),
    d9Lagna:   d9.lagnaSign,
    d9Houses:  d9.houses,
    d9h7lord,
    d9h7lH:    d9h7lord ? ph(d9h7lord, d9.houses) : null,
    malH7:     h(7).filter(p => ['Saturn','Mars','Rahu','Ketu'].includes(p)),
    dust, kend, trik,
  };

  const results = [];

  COMPOUND_PATTERNS.forEach(pat => {
    let conditions;
    try { conditions = pat.conditions(ctx); } catch(e) { return; }

    const passed = conditions.filter(cond => {
      try { return typeof cond.pass === 'function' ? cond.pass() : !!cond.pass; }
      catch(e) { return false; }
    });

    if (passed.length < pat.minimumConditions) return;

    const ratio      = passed.length / conditions.length;
    const confidence = ratio >= 0.75 ? 'High' : ratio >= 0.5 ? 'Medium' : 'Low';

    let windowLords = [];
    try { windowLords = typeof pat.window_lords === 'function'
      ? pat.window_lords(ctx).filter(Boolean) : []; }
    catch(e) { windowLords = []; }

    results.push({
      id:               pat.id,
      domain:           pat.domain,
      title:            pat.title,
      indication:       pat.indication,
      caution:          pat.caution,
      conditionsMet:    passed.length,
      totalConditions:  conditions.length,
      confidence,
      windowLords:      [...new Set(windowLords)],
      risk_note:        pat.risk_note        || false,
      sensitivity_note: pat.sensitivity_note || false,
      stability_note:   pat.stability_note   || false,
    });
  });

  const confOrder = ['High','Medium','Low'];
  return results.sort((a,b) => {
    if (a.risk_note && !b.risk_note) return -1;
    if (!a.risk_note && b.risk_note) return 1;
    return confOrder.indexOf(a.confidence) - confOrder.indexOf(b.confidence);
  });
}


// ── Flag detector ─────────────────────────────────────────────────────────────
// Runs all flag checks against the chart and returns matched flags.
function detectEventFlags(d1, d9, combustSet, yogasD1, yogasD9, classification) {
  const ctx = makeFlagContext(d1, d9, combustSet, yogasD1, yogasD9, classification);
  const allYogas = [...yogasD1, ...yogasD9];
  const results  = [];

  EVENT_FLAGS.forEach(flag => {
    let matched = false;
    try {
      matched = flag.id === 'parivartana-detected'
        ? flag.check(ctx, allYogas)
        : flag.check(ctx);
    } catch(e) { matched = false; }

    if (matched) {
      const windowLords = typeof flag.window_lords === 'function'
        ? flag.window_lords(ctx).filter(Boolean)
        : flag.window_lords || [];

      results.push({
        id:         flag.id,
        domain:     flag.domain,
        title:      flag.title,
        indication: flag.indication,
        caution:    flag.caution,
        windowLords: [...new Set(windowLords)],
        confidence: flag.confidence,
      });
    }
  });

  // Sort: cross-domain flags first (domain=null), then by domain, then by confidence
  const order = ['High','Medium','Low'];
  return results.sort((a,b) => {
    if (!a.domain && b.domain) return -1;
    if (a.domain && !b.domain) return 1;
    return order.indexOf(a.confidence) - order.indexOf(b.confidence);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── STEP 2: CHART PATTERN CLASSIFIER ─────────────────────────────────────────
// Identifies the dominant signature(s) of the chart and the dominant planet.
// Returns a structured object used to build the chart-level opening frame.
//
// Five pattern types (can co-exist):
//   Bhagya  — natural grace, fortune, Jupiter prominence, trikona axis strong
//   Raja    — structural authority, yogakaraka in kendra or YK-conjunction
//   Dhana   — wealth axis dominant, H2/H11 lords in good positions
//   Tapas   — endurance pattern, dusthana accumulation, results come through effort
//   Karmic  — nodal dominance, fated quality, Rahu/Ketu on key axes
//
// Dominant planet: highest multi-factor score across placement, status, dignity.
// Dominant axis: house pair carrying the most planetary weight.

const PATTERN_DESCRIPTIONS = {
  Bhagya: {
    label: 'Bhagya',
    opening: (planet, axis) =>
      `This chart carries a Bhagya signature — Jupiter prominent and the trikona axis strongly supported. ` +
      `The chart as a whole has a quality of natural protection and earned grace: effort here tends to compound rather than dissipate. ` +
      `${planet} is the dominant planetary voice, shaping how the chart expresses itself across all domains.`,
    modifier: 'Indications in this chart are generally more reliable than average — the chart structure supports manifestation.'
  },
  Raja: {
    label: 'Raja',
    opening: (planet, axis) =>
      `This chart carries a Raja signature — the yogakaraka is placed in a kendra, giving it structural authority. ` +
      `There is an inherent capacity here for visible achievement, social standing, and recognised contribution. ` +
      `${planet} drives the dominant life theme and the reading below should be anchored in that context.`,
    modifier: 'Authority and recognition are themes that run through this chart — Career and Identity domains especially benefit from this signature.'
  },
  Dhana: {
    label: 'Dhana',
    opening: (planet, axis) =>
      `This chart carries a Dhana signature — the wealth-axis lords (H2 and H11) are well positioned, indicating that material accumulation and social gains are structurally supported. ` +
      `The Wealth domain should be read with this favourable backdrop in mind. ` +
      `${planet} is the dominant planetary energy and shapes the mode in which wealth arrives.`,
    modifier: 'Material acquisition and family financial stability are stronger threads in this chart than a domain-by-domain reading alone might suggest.'
  },
  Tapas: {
    label: 'Tapas',
    opening: (planet, axis) =>
      `This chart carries a Tapas signature — multiple planets occupy dusthana houses (6th, 8th, 12th), indicating that this life is built on sustained effort rather than ease. ` +
      `This is not an obstructed chart; it is a chart that requires conscious engagement and patience. ` +
      `Results come, but rarely early and rarely without earning. ${planet} is the dominant planetary energy and often the source of both the burden and the eventual reward.`,
    modifier: 'Domains that appear challenging in isolation should be read with the awareness that this chart matures and rewards effort over time — particularly after the first Saturn cycle (age 29) and again after age 56.'
  },
  Karmic: {
    label: 'Karmic',
    opening: (planet, axis) =>
      `This chart carries a Karmic signature — Rahu or Ketu occupies a kendra or trikona, placing the nodal axis on a structurally significant axis. ` +
      `Certain events in this life carry a fated or non-negotiable quality; the circumstances arrive as if pre-arranged. ` +
      `${planet} is the dominant planetary voice, but the nodal axis introduces themes that repeat and intensify until consciously integrated.`,
    modifier: 'Cautions in this chart should be taken more seriously than average — the Karmic signature means certain challenges recur if not addressed at their root.'
  }
};

const AXIS_THEMES = {
  '1-7': 'identity and relationship — the self and the other are the central life polarity',
  '4-10': 'home and career — the private foundation and the public contribution are the twin life themes',
  '2-8': 'resources and transformation — accumulation and loss, inheritance and letting go form the core tension',
  '5-11': 'creativity and community — individual expression and collective belonging are the dominant motifs',
  '3-9': 'communication and dharma — learning, teaching, and the search for meaning run through the life',
};

function classifyChartPattern(d1, d9, yogasD1, yogasD9) {
  const lagna       = d1.lagnaSign;
  const houses      = d1.houses;
  const degrees     = d1.degrees || {};
  const houseToSign = HOUSE_SIGN_BY_LAGNA[lagna] || {};
  const PLANETS     = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Rahu','Ketu'];
  const kendras     = [1,4,7,10];
  const trikonas    = [1,5,9];
  const dusthanas   = [6,8,12];
  const upachayas   = [3,6,10,11];

  // ── 1. Score each planet ────────────────────────────────────────────────
  const planetScores = {};
  PLANETS.forEach(p => {
    let score = 0;
    const h = getPlanetHouse(houses, p);
    if (!h) return;
    const sign = houseToSign[h];
    const fs   = functionalStatus(p, lagna);
    const dig  = sign ? dignityModifier(p, sign) : 0;

    if (fs==='Y')  score += 4;  // yogakaraka — most significant
    else if (fs==='B') score += 2;
    else if (fs==='M') score -= 1;
    if (kendras.includes(h))  score += 2;
    if (trikonas.includes(h) && h !== 1) score += 2;  // H1 already counted in kendra
    if (h === 1) score += 1;   // lagna placement bonus
    if (dig >= 2) score += 2;  // exalted
    if (dig === 1) score += 1; // own sign
    if (dig < 0)  score -= 1;  // debilitated

    planetScores[p] = { score, house: h, sign, fs, dig };
  });

  // Dominant planet = highest scoring (breaking ties by house quality)
  const sorted = Object.entries(planetScores)
    .filter(([,d]) => d.house !== null)
    .sort((a,b) => b[1].score - a[1].score);
  const dominantPlanet     = sorted[0]?.[0] || 'Sun';
  const dominantPlanetData = sorted[0]?.[1] || {};

  // ── 2. Dominant axis ────────────────────────────────────────────────────
  const axisWeight = {'1-7':0,'4-10':0,'2-8':0,'5-11':0,'3-9':0};
  Object.entries(houses).forEach(([h, planets]) => {
    if (!planets.length) return;
    const hNum = parseInt(h);
    const w    = planets.length * (kendras.includes(hNum) || trikonas.includes(hNum) ? 2 : 1);
    if ([1,7].includes(hNum))  axisWeight['1-7']  += w;
    if ([4,10].includes(hNum)) axisWeight['4-10'] += w;
    if ([2,8].includes(hNum))  axisWeight['2-8']  += w;
    if ([5,11].includes(hNum)) axisWeight['5-11'] += w;
    if ([3,9].includes(hNum))  axisWeight['3-9']  += w;
  });
  const dominantAxis = Object.entries(axisWeight)
    .sort((a,b) => b[1]-a[1])[0]?.[0] || '1-7';
  const axisTheme = AXIS_THEMES[dominantAxis] || '';

  // ── 3. Detect patterns ──────────────────────────────────────────────────
  const detectedPatterns = [];

  // BHAGYA — Jupiter strong + H9 lord well-placed + trikona support
  const jupH   = getPlanetHouse(houses, 'Jupiter');
  const jupDig = jupH ? (dignityModifier('Jupiter', houseToSign[jupH]) || 0) : 0;
  const jupScore = planetScores['Jupiter']?.score || 0;
  const h9lord  = SIGN_LORDS[houseToSign[9]];
  const h9lordH = h9lord ? getPlanetHouse(houses, h9lord) : null;
  const h9strong = h9lordH && !dusthanas.includes(h9lordH);
  const trikonaPlanetCount = Object.entries(houses)
    .filter(([h,v]) => trikonas.includes(parseInt(h)) && v.length > 0).length;
  if (jupScore >= 4 && (h9strong || trikonaPlanetCount >= 2)) {
    detectedPatterns.push({ name:'Bhagya', strength: (jupScore >= 4 && jupDig >= 1) ? 'strong' : 'moderate',
      note: `Jupiter score ${jupScore}, ${h9lord} (H9 lord) in H${h9lordH}` });
  }

  // RAJA — YK in kendra, or kendra/trikona lord conjunction detected in yogas
  const ykPlanets = PLANETS.filter(p => functionalStatus(p, lagna)==='Y');
  ykPlanets.forEach(yk => {
    const ykH = getPlanetHouse(houses, yk);
    if (!ykH) return;
    if (kendras.includes(ykH)) {
      detectedPatterns.push({ name:'Raja', strength:'strong', note:`${yk} (YK) in kendra H${ykH}` });
    } else if (trikonas.includes(ykH)) {
      detectedPatterns.push({ name:'Raja', strength:'moderate', note:`${yk} (YK) in trikona H${ykH}` });
    }
  });
  // Also detect Raja from yogas
  const rajaYogas = [...yogasD1,...yogasD9].filter(y=>y.name==='Raja Yoga'||y.name.includes('Mahapurusha'));
  if (rajaYogas.length >= 2 && !detectedPatterns.find(p=>p.name==='Raja')) {
    detectedPatterns.push({ name:'Raja', strength:'moderate', note:`${rajaYogas.length} Raja/Mahapurusha yogas detected` });
  }

  // DHANA — H2 and H11 lords in non-dusthana houses
  const h2lord  = SIGN_LORDS[houseToSign[2]];
  const h11lord = SIGN_LORDS[houseToSign[11]];
  const h2H     = h2lord  ? getPlanetHouse(houses, h2lord)  : null;
  const h11H    = h11lord ? getPlanetHouse(houses, h11lord) : null;
  if (h2H && h11H && !dusthanas.includes(h2H) && !dusthanas.includes(h11H)) {
    const dhanaYoga = [...yogasD1,...yogasD9].find(y=>y.name==='Dhana Yoga');
    detectedPatterns.push({ name:'Dhana', strength: dhanaYoga ? 'strong' : 'moderate',
      note:`H2 lord ${h2lord} in H${h2H}, H11 lord ${h11lord} in H${h11H}` });
  }

  // TAPAS — multiple classical planets in dusthanas
  const dusthanaPlanets = Object.entries(houses)
    .filter(([h,v]) => dusthanas.includes(parseInt(h)) && v.length)
    .flatMap(([,v]) => v)
    .filter(p => !['Rahu','Ketu'].includes(p));
  if (dusthanaPlanets.length >= 3) {
    detectedPatterns.push({ name:'Tapas', strength:'strong',
      note:`${dusthanaPlanets.length} planets in dusthanas: ${dusthanaPlanets.join(', ')}` });
  } else if (dusthanaPlanets.length === 2) {
    detectedPatterns.push({ name:'Tapas', strength:'moderate',
      note:`${dusthanaPlanets.join(' and ')} in dusthanas` });
  }

  // KARMIC — Rahu/Ketu in kendra or trikona
  const rahuH = getPlanetHouse(houses, 'Rahu');
  const ketuH = getPlanetHouse(houses, 'Ketu');
  if ((rahuH && (kendras.includes(rahuH) || trikonas.includes(rahuH))) ||
      (ketuH && (kendras.includes(ketuH) || trikonas.includes(ketuH)))) {
    const node = rahuH && (kendras.includes(rahuH)||trikonas.includes(rahuH)) ? 'Rahu' : 'Ketu';
    const nodeH = node==='Rahu' ? rahuH : ketuH;
    detectedPatterns.push({ name:'Karmic', strength:'moderate',
      note:`${node} in H${nodeH} (${kendras.includes(nodeH)?'kendra':'trikona'})` });
  }

  // ── 4. Primary and secondary patterns ──────────────────────────────────
  // Order by strength then by the natural hierarchy of patterns
  const patternOrder = ['Bhagya','Raja','Dhana','Tapas','Karmic'];
  const strongFirst = [...detectedPatterns]
    .sort((a,b) => {
      const s = a.strength==='strong'?0:1;
      const t = b.strength==='strong'?0:1;
      if (s !== t) return s-t;
      return patternOrder.indexOf(a.name) - patternOrder.indexOf(b.name);
    });

  const primaryPattern   = strongFirst[0] || null;
  const secondaryPattern = strongFirst[1] || null;

  return {
    dominantPlanet,
    dominantPlanetScore: dominantPlanetData.score,
    dominantPlanetHouse: dominantPlanetData.house,
    dominantAxis,
    axisTheme,
    primaryPattern,
    secondaryPattern,
    allPatterns: detectedPatterns,
    planetScores   // keep for downstream use
  };
}

// ── Opening frame generator ───────────────────────────────────────────────────
// Produces the 2-3 sentence chart opening that frames all domain readings.
function generateChartOpening(classification, d1, d9) {
  const { dominantPlanet, dominantAxis, axisTheme, primaryPattern, secondaryPattern } = classification;

  let opening = '';
  let modifier = '';
  let axisLine = '';

  if (primaryPattern) {
    const desc = PATTERN_DESCRIPTIONS[primaryPattern.name];
    opening  = desc.opening(dominantPlanet, dominantAxis);
    modifier = desc.modifier;
  } else {
    // No strong pattern — balanced chart
    opening = `This chart does not carry a single dominant signature — it is a balanced chart with multiple planetary voices contributing roughly equally. ` +
      `${dominantPlanet} is the most prominent planetary energy, though it operates within a context of checks and counterbalances rather than clear dominance.`;
    modifier = 'Balanced charts are highly responsive to dasha timing — the activation period becomes the primary determining factor for when and how each domain expresses.';
  }

  // Secondary pattern modifier
  if (secondaryPattern) {
    const sec = PATTERN_DESCRIPTIONS[secondaryPattern.name];
    modifier += ` A secondary ${secondaryPattern.name} thread runs through the chart: ${(sec.modifier.split(' — ')[1] || secondaryPattern.note).replace(/\.$/, '')}`;
  }

  // Axis theme
  axisLine = `The dominant planetary axis in this chart is ${dominantAxis}: ${axisTheme}.`;

  return {
    opening,
    axisLine,
    modifier,
    full: `${opening} ${axisLine} ${modifier}`.trim()
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Expose for use in onRequestPost
// ═══════════════════════════════════════════════════════════════════════════════
//  CHARA KARAKAS (Jaimini) — Atmakaraka … Darakaraka, auto-derived from d1.degrees
//
//  RULE (locked):
//   • ALWAYS exactly 7 portfolios (frozen names/meanings), ranked high→low by
//     degree-within-sign (longitude % 30):
//       Atmakaraka, Amatyakaraka, Bhratrukaraka, Matrukaraka,
//       Putrakaraka, Gnathikaraka, Darakaraka.
//   • 7 classical planets: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn.
//   • NO TIE → rank the 7, assign to the 7 portfolios. Rahu ABSENT.
//   • TIE (two classical planets share the same INTEGER degree) → add Rahu with
//     REVERSED degree (30 − Rahu deg-in-sign) to the pool; rank all 8; the TOP 7
//     take the portfolios; the LOWEST-ranked (8th) body is EXCLUDED entirely.
//     Tied planets self-order by their minutes (automatic — ranking uses the full
//     fractional degree-in-sign).
// ═══════════════════════════════════════════════════════════════════════════════

const CHARA_KARAKA_PORTFOLIOS = [
  { role: "Atmakaraka",    short: "AK",  domain: "Soul / Self" },
  { role: "Amatyakaraka",  short: "AmK", domain: "Career / Intellect" },
  { role: "Bhratrukaraka", short: "BK",  domain: "Siblings / Guru" },
  { role: "Matrukaraka",   short: "MK",  domain: "Mother and Father / Home" },
  { role: "Putrakaraka",   short: "PK",  domain: "Children / Education" },
  { role: "Gnathikaraka",  short: "GK",  domain: "Obstacles / Debts" },
  { role: "Darakaraka",    short: "DK",  domain: "Spouse / Partnerships" }
];

const KARAKA_PORTFOLIO_DEFS = {
  "Atmakaraka":    "The planet at the highest degree in the chart — classically the significator of the soul. It points to the theme the inner life keeps returning to: the lesson, longing, or work that feels most central to who one is becoming. Of all the karakas, this carries the strongest voice.",
  "Amatyakaraka":  "The planet that advises the soul — traditionally the minister to the Atmakaraka's king. It colours how one thinks, counsels oneself, and makes one's way in the world of work. Where the AK sets the direction, the AmK shapes the means.",
  "Bhratrukaraka": "The significator of siblings and, in the classical view, teachers and guides. It reflects the theme of courage, effort, and the people who walk alongside or show the way.",
  "Matrukaraka":   "The significator of the parents and the home one comes from. It carries the theme of nurture, roots, emotional shelter, and the inner sense of security carried from one's origins.",
  "Putrakaraka":   "The significator of children, creativity, and learning. It reflects what one brings into being — offspring, ideas, works — and how knowledge and creation move through the life.",
  "Gnathikaraka":  "The significator of the difficulties that shape a person — obstacles, health, discipline, and what the tradition calls debts. This is the theme of what must be worked through, and the strength that working through it builds.",
  "Darakaraka":    "The planet at the lowest degree in the chart — the significator of the spouse and of partnership itself. It points to the qualities one is drawn to in a life-partner, and the theme close union brings into the life."
};

const KARAKA_AK_MEANING = {
  Sun:     "The soul's theme centres on selfhood, authority, and the long work of becoming someone who stands in their own light without needing it reflected back. Ego and essence must be told apart.",
  Moon:    "The soul's theme is feeling, care, and the tides of the inner life. The work is to be nourished without being ruled by mood, and to give care without losing oneself in it.",
  Mars:    "The soul's theme is courage, will, and right action. The work is to act with force without being ruled by anger — to become someone whose strength protects rather than harms.",
  Mercury: "The soul's theme is mind, communication, and discernment. The work is to use intelligence in service of something true, rather than merely clever.",
  Jupiter: "The soul's theme is wisdom, meaning, and faith. The work is to grow toward what is larger than oneself — to become a source of guidance without becoming certain of too much.",
  Venus:   "The soul's theme is love, beauty, and relationship itself. The work is to love fully without losing discernment — to let the heart lead without letting it deceive.",
  Saturn:  "The soul's theme is endurance, responsibility, and time. The work is long and often solitary — to build something real through patience, and to find that restriction can become a strange kind of freedom."
};

const KARAKA_DK_MEANING = {
  Sun:     "One is drawn toward partners with presence, dignity, or authority — someone whose selfhood is clear. Partnership becomes a teacher about one's own.",
  Moon:    "One is drawn toward partners who feel like home — nurturing, emotionally present. Partnership is where the need for belonging is met and tested.",
  Mars:    "One is drawn toward partners with drive, directness, or strength. Partnership carries an element of heat — passion, and the work of handling conflict well.",
  Mercury: "One is drawn toward partners who are quick, communicative, youthful in spirit. Partnership lives in conversation and the meeting of minds.",
  Jupiter: "One is drawn toward partners who are wise, principled, or expansive — someone who widens one's world. Partnership carries a note of the teacher.",
  Venus:   "One is drawn toward partners of warmth, beauty, and grace. This is the classical natural significator of partnership; union sits close to the centre of the path.",
  Saturn:  "One is drawn toward partners who are steady, serious, or older in spirit. Partnership is built slowly and asks for commitment, duty, and staying power.",
  Rahu:    "One is drawn toward partners who are unconventional, foreign, or outside the familiar world. Partnership arrives in unexpected ways and pulls one beyond the life one knew."
};

function karakaDegInSign(longitude) {
  return (((longitude % 30) + 30) % 30);
}

function computeCharaKarakas(degrees) {
  if (!degrees) return null;
  const CLASSICAL = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];

  const list = [];
  for (const p of CLASSICAL) {
    if (degrees[p] == null) return null; // incomplete data → skip chapter safely
    list.push({ planet: p, dis: karakaDegInSign(degrees[p]), reversed: false });
  }

  // TIE TEST: any two classical planets share the same integer degree?
  let tie = false;
  for (let a = 0; a < list.length && !tie; a++) {
    for (let b = a + 1; b < list.length; b++) {
      if (Math.floor(list[a].dis) === Math.floor(list[b].dis)) { tie = true; break; }
    }
  }

  // TIE → add Rahu with reversed degree (30 − deg-in-sign)
  if (tie && degrees.Rahu != null) {
    list.push({ planet: "Rahu", dis: 30 - karakaDegInSign(degrees.Rahu), reversed: true });
  }

  // Rank high → low (fractional dis auto-orders tied planets by minutes)
  list.sort((x, y) => y.dis - x.dis);

  // Exactly 7 portfolios. Top 7 fill them; any 8th body is EXCLUDED.
  const assigned = list.slice(0, 7);
  const excluded = list.length > 7 ? list[7] : null;

  const karakas = assigned.map((b, idx) => ({
    role:      CHARA_KARAKA_PORTFOLIOS[idx].role,
    short:     CHARA_KARAKA_PORTFOLIOS[idx].short,
    domain:    CHARA_KARAKA_PORTFOLIOS[idx].domain,
    planet:    b.planet,
    degInSign: parseFloat(b.dis.toFixed(1)),
    reversed:  b.reversed,
    portfolioDef: KARAKA_PORTFOLIO_DEFS[CHARA_KARAKA_PORTFOLIOS[idx].role]
  }));

  const ak = karakas[0];
  const dk = karakas[karakas.length - 1];

  return {
    tie,
    rahuUsed: tie && degrees.Rahu != null,
    excluded: excluded ? { planet: excluded.planet, degInSign: parseFloat(excluded.dis.toFixed(1)), reversed: excluded.reversed } : null,
    karakas,
    atmakaraka:  ak,
    darakaraka:  dk,
    akMeaning:   KARAKA_AK_MEANING[ak.planet] || "",
    dkMeaning:   KARAKA_DK_MEANING[dk.planet] || ""
  };
}

function buildAllStatements(d1, d9, domains, dashas, birthDate, yogasD1, yogasD9) {
  const allYogas     = [...yogasD1, ...yogasD9];
  const classification = classifyChartPattern(d1, d9, yogasD1, yogasD9);
  const opening        = generateChartOpening(classification, d1, d9);
  const combustSet     = buildCombustFlags(d1.degrees || {});
  const eventFlags      = detectEventFlags(d1, d9, combustSet, yogasD1, yogasD9, classification);
  const compoundPatterns = detectCompoundPatterns(d1, d9, combustSet, yogasD1, yogasD9, classification);

  const statements = domains.map((domainResult, i) => {
    const config = DOMAIN_CONFIG[i];
    return buildChartStatement(config, d1, d9, domainResult, dashas, birthDate, allYogas);
  });

  return { classification, opening, statements, eventFlags, compoundPatterns };
}

// ═══════════════════════════════════════════════════════════════════════════════
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age":       "86400",
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DOMAIN REPORTS — divisional charts + per-domain facts packet (for API writer)
//  Validated: D10 reproduces the Career sample 10/10 at exact longitudes.
// ═══════════════════════════════════════════════════════════════════════════════
const V_SIGNS=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const V_EX={Sun:"Aries",Moon:"Taurus",Mars:"Capricorn",Mercury:"Virgo",Jupiter:"Cancer",Venus:"Pisces",Saturn:"Libra",Rahu:"Gemini",Ketu:"Sagittarius"};
const V_DE={Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries",Rahu:"Sagittarius",Ketu:"Gemini"};
const V_OWN={Sun:["Leo"],Moon:["Cancer"],Mars:["Aries","Scorpio"],Mercury:["Gemini","Virgo"],Jupiter:["Sagittarius","Pisces"],Venus:["Taurus","Libra"],Saturn:["Capricorn","Aquarius"],Rahu:[],Ketu:[]};
const V_LORD={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"};
function vSi(l){return Math.floor((((l%360)+360)%360)/30);}
function vDis(l){return (((l%30)+30)%30);}
function vDig(p,sign){ if(V_EX[p]===sign)return"Exalted"; if(V_DE[p]===sign)return"Debilitated"; if((V_OWN[p]||[]).includes(sign))return"Own sign"; return"Neutral"; }
const VARGA_FN={
  D3:l=>{const s=vSi(l),p=Math.floor(vDis(l)/10);return (s+[0,4,8][p])%12;},
  D4:l=>{const s=vSi(l),p=Math.floor(vDis(l)/7.5);return (s+[0,3,6,9][p])%12;},
  D7:l=>{const s=vSi(l),p=Math.floor(vDis(l)/(30/7));const st=((s+1)%2===1)?s:(s+6)%12;return (st+p)%12;},
  D9:l=>{const s=vSi(l),p=Math.floor(vDis(l)/(30/9)),m=s%3;const st=m===0?s:m===1?(s+8)%12:(s+4)%12;return (st+p)%12;},
  D10:l=>{const s=vSi(l),p=Math.floor(vDis(l)/3);const st=((s+1)%2===1)?s:(s+8)%12;return (st+p)%12;}
};
function buildVargaChart(key, d1Lons, ascLon){
  const fn=VARGA_FN[key]; if(!fn||!d1Lons) return null;
  // Ascendant longitude for the varga lagna: prefer explicit ascLon, else d1Lons.Lagna.
  const lagLon = (ascLon!=null) ? ascLon : d1Lons.Lagna;
  if(lagLon==null) return null;
  const signs={}; for(const[p,lon] of Object.entries(d1Lons)){ if(lon==null||p==="Lagna")continue; signs[p]=fn(lon); }
  const lagIdx=fn(lagLon); const houses={}; for(let h=1;h<=12;h++)houses[h]=[];
  const placements={};
  for(const[p,siv] of Object.entries(signs)){ const house=((siv-lagIdx+12)%12)+1; houses[house].push(p); placements[p]={sign:V_SIGNS[siv],house,dignity:vDig(p,V_SIGNS[siv])}; }
  return { lagnaSign:V_SIGNS[lagIdx], houses, placements };
}
// ── SHARED: classical affliction-severity scorer (used by ALL domains) ───────
// Severity comes from COMPOUNDING, not single placements. A single malefic is
// ordinary life; multiple severe factors CONVERGING is what the tradition treats
// as serious. Returns { score, tier, factors } where tier is 'plain'|'moderate'|
// 'strong'. Only 'strong' earns a prominent "Watch out for" in the report.
// This prevents overfitting: common single placements stay plain; genuine
// concentrations (like a 6th loaded with malefics + a retro-debilitated planet)
// escalate. Each factor is a classically heavier affliction.
function scoreDomainSeverity(d1P, houseNum, hLord, karakaPlanet, d9LordCaution, occupants, domainKey){
  if(!d1P) return { score:0, tier:'plain', factors:[] };
  const MAL=["Saturn","Mars","Rahu","Ketu","Sun"];
  const factors=[]; let score=0;
  // (1) domain house loaded with MULTIPLE malefics (cluster affliction)
  const houseMalefics = (occupants||[]).filter(o=>MAL.includes(o.planet));
  if(houseMalefics.length>=3){ score+=3; factors.push(`the ${houseNum}th house carries a heavy cluster of malefics (${houseMalefics.map(o=>o.planet).join(", ")})`); }
  else if(houseMalefics.length===2){ score+=2; factors.push(`two malefics sit together in the ${houseNum}th house`); }
  else if(houseMalefics.length===1){ score+=1; }
  // (2) domain lord doubly/triply afflicted (retrograde AND debilitated compounds)
  const lp = hLord? d1P[hLord] : null;
  if(lp){
    let lpAff=0; const lpWhy=[];
    if(lp.dignity==="Debilitated"){ lpAff++; lpWhy.push("debilitated"); }
    if(lp.retro){ lpAff++; lpWhy.push("retrograde"); }
    if([6,8,12].includes(lp.house)){ lpAff++; lpWhy.push("in a house of testing"); }
    if(lpAff>=2){ score+=2; factors.push(`the ${houseNum}th-lord ${hLord} is compounded (${lpWhy.join(" and ")})`); }
    else if(lpAff===1){ score+=1; }
  }
  // (3) the domain karaka doubly afflicted
  const kp = karakaPlanet? d1P[karakaPlanet] : null;
  if(kp){
    let kAff=0; const kWhy=[];
    if(kp.dignity==="Debilitated"){ kAff++; kWhy.push("debilitated"); }
    if(kp.retro){ kAff++; kWhy.push("retrograde"); }
    if([6,8,12].includes(kp.house)){ kAff++; }
    if(kAff>=2){ score+=2; factors.push(`the domain significator ${karakaPlanet} is compounded (${kWhy.join(" and ")})`); }
    else if(kAff===1){ score+=1; }
  }
  // (4) the D9 maturation caution (independent chart agreeing) — a real convergence
  if(d9LordCaution){ score+=2; factors.push("the D9 maturation chart independently flags this area"); }
  // (5) nodes both debilitated — a real disruptor, but a GENERAL one; give it
  //     modest weight so it colours a domain without alone making it 'strong'.
  if(d1P.Rahu && d1P.Ketu && d1P.Rahu.dignity==="Debilitated" && d1P.Ketu.dignity==="Debilitated"){ score+=1; factors.push("the Rahu-Ketu axis is debilitated on both ends"); }
  // (6) a malefic sitting ON the Ascendant — this is a CONSTITUTION/SELF/HEALTH
  //     signal, so it only counts for those domains (it does not make someone's
  //     marriage or career "severe"). Scoping prevents whole-chart affliction from
  //     leaking into unrelated domains.
  if(domainKey==="self" || domainKey==="health"){
    const asc1p = occupantsOfHouse(d1P,1).filter(p=>["Saturn","Mars","Rahu","Ketu"].includes(p));
    if(asc1p.length){ score+=1; if(asc1p.length>=2) score+=1; factors.push(`${asc1p.join(", ")} on the Ascendant places extra strain on the constitution`); }
  }
  // Tier thresholds: strong requires genuine convergence of severe factors.
  let tier='plain';
  if(score>=5) tier='strong';
  else if(score>=3) tier='moderate';
  return { score, tier, factors };
}

function d1PlacementsFromDegrees(degrees, lagnaSign, retroMap){
  if(!degrees||lagnaSign==null) return null;
  const lagIdx=V_SIGNS.indexOf(lagnaSign); if(lagIdx<0) return null;
  const out={};
  for(const[p,lon] of Object.entries(degrees)){ if(lon==null)continue; const si=vSi(lon); const house=((si-lagIdx+12)%12)+1; out[p]={sign:V_SIGNS[si],house,degInSign:+vDis(lon).toFixed(1),dignity:vDig(p,V_SIGNS[si]),signRelation:natRelation(p,V_SIGNS[si]),retro:!!(retroMap&&retroMap[p])}; }
  return out;
}
function houseLord(lagnaSign, houseNum){
  const lagIdx=V_SIGNS.indexOf(lagnaSign); if(lagIdx<0) return null;
  return V_LORD[V_SIGNS[(lagIdx+houseNum-1)%12]];
}
function occupantsOfHouse(d1P, houseNum){
  if(!d1P) return [];
  return Object.entries(d1P).filter(([p,v])=>p!=="Lagna" && v.house===houseNum).map(([p])=>p);
}
const DOMAIN_REPORT_CONFIG = {
  self:     { title:"Character Blueprint", focus:"self, character, and life-direction", house:1,  karaka:"Atmakaraka",    varga:null,  vargaLabel:"D1 + D9" },
  career:   { title:"Career Blueprint",    focus:"career path, timing, and direction", house:10, karaka:"Amatyakaraka",  varga:"D10", vargaLabel:"D10 (Dashamsha)" },
  siblings: { title:"Courage Blueprint",   focus:"siblings, courage, and initiative",  house:3,  karaka:"Bhratrukaraka", varga:"D3",  vargaLabel:"D3 (Drekkana)" },
  mother:   { title:"Home Blueprint",      focus:"mother, home, and inner security",   house:4,  karaka:"Matrukaraka",   varga:"D4",  vargaLabel:"D4 (Chaturthamsha)" },
  children: { title:"Progeny Blueprint",   focus:"children, creativity, and progeny",  house:5,  karaka:"Putrakaraka",   varga:"D7",  vargaLabel:"D7 (Saptamsha)" },
  health:   { title:"Wellbeing Blueprint", focus:"health, vitality, and resilience",   house:6,  karaka:"Gnathikaraka",  varga:null,  vargaLabel:"D1 (6th & 8th) + D9" },
  marriage: { title:"Marriage Blueprint",  focus:"marriage, partnership, and timing",  house:7,  karaka:"Darakaraka",    varga:"D9",  vargaLabel:"D9 (Navamsha)" }
};
function ordinalD(n){var s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
// Graha drishti — does a planet in `fromHouse` cast an aspect on `targetHouse`?
// All planets aspect the 7th; Mars also 4th & 8th, Jupiter 5th & 9th, Saturn 3rd & 10th,
// Rahu/Ketu 5th & 9th (common usage). `diff` is the inclusive house count (1 = same house).
function aspectsHouse(planet, fromHouse, targetHouse){
  if(!fromHouse || !targetHouse) return false;
  const diff = ((targetHouse - fromHouse + 12) % 12) + 1;   // 1..12
  if(diff===7) return true;
  if(planet==="Mars"    && (diff===4 || diff===8))  return true;
  if(planet==="Jupiter" && (diff===5 || diff===9))  return true;
  if(planet==="Saturn"  && (diff===3 || diff===10)) return true;
  if((planet==="Rahu"||planet==="Ketu") && (diff===5 || diff===9)) return true;
  return false;
}
// Dusthana flavour — standard Parashari house significations (6/8/12). Each names
// the difficulty AND its constructive dimension (our wellbeing framing). Applied to
// domain-relevant planets (lord, karaka, domain-house occupants) sitting in a
// dusthana. Descriptive only — does NOT affect severity scoring.
const DUSTHANA_FLAVOUR = {
  6:  { theme:"obstacles, competition, daily struggle, and service", constructive:"this is a placement that builds resilience and problem-solving strength — progress here comes through effort and outlasting resistance, and can be genuinely productive", short:"struggle-but-productive" },
  8:  { theme:"transformation, sudden change, hidden or research-oriented work, and depth", constructive:"this is not weakness but depth — mastery here comes through deep change, reinvention, and working behind the scenes rather than in the public eye", short:"transformation/deep change" },
  12: { theme:"loss, withdrawal, foreign or behind-the-scenes settings, and letting go", constructive:"this turns inward or outward-to-the-distant — strength here is found in solitude, spirituality, foreign or institutional settings, and releasing rather than grasping", short:"withdrawal/letting-go" }
};
function dusthanaReading(planet, placement, roleLabel){
  if(!placement || ![6,8,12].includes(placement.house)) return null;
  const f = DUSTHANA_FLAVOUR[placement.house];
  // role names the PLANET as well as its functional label, so no downstream renderer can
  // ever surface a bare "Nth-lord" without the ruling planet (general hardening of C-1).
  return { planet, role:(roleLabel?planet+" ("+roleLabel+")":planet), house:placement.house,
    reading:`${planet}${roleLabel?" ("+roleLabel+")":""} sits in the ${ordinalD(placement.house)} house — bringing ${f.theme}. ${f.constructive}.`,
    short:f.short };
}
// ── CAREER COMPASS (career domain only) ──────────────────────────────────────
// A NET-NEW, ADDITIVE decision framework. It does NOT change any existing rule
// (severity, flags, timing, shift). It only READS already-computed placements
// and returns the chart's STRUCTURAL LEANING on two INDEPENDENT axes that never
// compensate for each other:
//   • Sector Fit — which kind of field the 10th lord points toward
//   • Role  Fit — the mode of work (build / operate / advise) + visibility
// plus a Core-Nature line (element + modality + planet essence of the 10th lord
// read across D1, D9 and D10) and a "test it against your own field" guideline.
// The ENGINE decides the leanings and consistency; the LLM only phrases them.
// Framed as leaning, never certainty. Nodes never rule signs, so the 10th lord
// is always one of the seven classical planets — no node edge case here.
const SIGN_ELEMENT = { Aries:"Fire",Leo:"Fire",Sagittarius:"Fire", Taurus:"Earth",Virgo:"Earth",Capricorn:"Earth", Gemini:"Air",Libra:"Air",Aquarius:"Air", Cancer:"Water",Scorpio:"Water",Pisces:"Water" };
const SIGN_MODALITY = { Aries:"Movable",Cancer:"Movable",Libra:"Movable",Capricorn:"Movable", Taurus:"Fixed",Leo:"Fixed",Scorpio:"Fixed",Aquarius:"Fixed", Gemini:"Dual",Virgo:"Dual",Sagittarius:"Dual",Pisces:"Dual" };
const ELEMENT_EDGE = {
  Fire:  "the pioneering, front-line, enterprise edge of a field — where action and initiative lead",
  Earth: "the structure, systems, and durable-results edge of a field — where building and execution lead",
  Air:   "the ideas, communication, and network edge of a field — where intellect and connection lead",
  Water: "the people, intuition, care, research, or behind-the-scenes edge of a field — where depth leads over surface"
};
// Concrete example roles per element — so when an element leaning (or an outlier chart's
// element) is named, the reader gets real examples, not just an abstract "edge".
const ELEMENT_EXAMPLES = {
  Fire:  "leadership, running your own venture, pioneering or competitive roles — e.g. entrepreneurship, sales or business leadership, sport and fitness, defence, or energy and engineering",
  Earth: "building, operations and durable results — e.g. finance, real estate, manufacturing, operations, agriculture, or systems and process work",
  Air:   "ideas, communication and networks — e.g. media and writing, teaching, consulting, marketing, or technology and connection-driven work",
  Water: "people, care, intuition and depth — e.g. research, counselling or the caring professions, the arts, hospitality, or behind-the-scenes craft"
};
const PLANET_ESSENCE = {
  Sun:"authority, leadership, and the drive to direct and be seen",
  Moon:"the public, care, and responsiveness to people and mood",
  Mars:"drive, engineering, courage, and decisive action",
  Mercury:"intellect, communication, commerce, and analysis",
  Jupiter:"wisdom, counsel, teaching, and expansion",
  Venus:"aesthetics, relationship, value, and harmony",
  Saturn:"structure, endurance, service, and the long cycle"
};
const PLANET_SECTORS = {
  Sun:["Government & public administration","Leadership & senior authority roles","Medicine & healthcare","Politics, civic & institutional bodies"],
  Moon:["Public-facing & consumer services","Hospitality, food, travel & liquids","Care, nursing & wellbeing","Retail & mass-market goods"],
  Mars:["Engineering & technical trades","Defence, police & security","Surgery, sports & physical disciplines","Real estate, land & construction"],
  Mercury:["Commerce, trade & business","Communication, writing & media","Analytics, accounting & data","IT, software & systems logic"],
  Jupiter:["Teaching, training & education","Law, advisory & consulting","Finance, banking & wealth","Counselling, publishing & philosophy"],
  Venus:["Arts, design & aesthetics","Entertainment, media & creative work","Luxury, beauty, fashion & lifestyle","Hospitality & relationship-based roles"],
  Saturn:["Structure, systems & operations","Infrastructure, manufacturing & mining","Long-cycle & institutional service","Labour, agriculture & work with the underserved"]
};
const MODALITY_ROLE = {
  Movable:{ role:"Builder / initiator", desc:"wired to start, launch, and change direction — to originate rather than maintain" },
  Fixed:  { role:"Operator / steady executor", desc:"wired to hold, deepen, and sustain — to build durability into what already exists rather than constantly pivot" },
  Dual:   { role:"Advisor / connector", desc:"wired to translate, advise, and move between worlds — to guide and adapt rather than own one fixed track" }
};
function ccHouseClass(h){
  if(h===1||h===10) return "visible";
  if(h===7||h===11) return "relational";
  if(h===6||h===8||h===12) return "behind";
  return "supportive";
}
const CC_HOUSECLASS_NOTE = {
  visible:"front-stage and visible — leadership- or authority-facing work",
  relational:"partnership-, client-, or network-facing work",
  behind:"behind-the-scenes, specialist, or independent work — depth over visibility",
  supportive:"steady, foundational, supporting-role work"
};
// Dominant value across [D1,D9,D10]. Ties resolve to D1 (index 0, the foundation)
// but the tie is reported so the phrasing stays honest.
function ccDominant(arr){
  const vals=arr.filter(Boolean); if(!vals.length) return null;
  const counts={}; for(const v of vals) counts[v]=(counts[v]||0)+1;
  let best=vals[0], bestN=counts[vals[0]];
  for(const v of vals){ if(counts[v]>bestN){ best=v; bestN=counts[v]; } }
  const tie = Object.values(counts).filter(n=>n===bestN).length>1;
  return { value:best, count:bestN, total:vals.length, tie };
}
// 3/3 agree = clear; 2/3 = leaning (one outlier); all differ = cross-current.
function ccConsistency(dom){
  if(!dom) return { label:"unclear", note:"the signal could not be read across the charts" };
  if(dom.count===dom.total && dom.total>=2) return { label:"clear", note:"D1, D9 and D10 all agree — a strong, repeated signal" };
  if(dom.count===2) return { label:"leaning", note:"two of the three charts (D1/D9/D10) agree, with one pulling a different way — a real leaning, not a certainty" };
  return { label:"cross-current", note:"D1, D9 and D10 each point a different way — genuinely mixed; this is where your own testing matters most" };
}
function buildCareerCompass(hLord, lordPlacement, vargaChart, d9Houses, d9LagnaSign){
  if(!hLord || !lordPlacement || !PLANET_SECTORS[hLord]) return null;
  // 10th-lord position in each of the three charts
  const d1 = { sign:lordPlacement.sign, house:lordPlacement.house, dignity:lordPlacement.dignity };
  // D9: locate hLord among d9 houses; sign = (d9 lagna + house-1)
  let d9=null;
  if(d9Houses && d9LagnaSign){
    let d9h=null; for(let h=1;h<=12;h++){ if((d9Houses[h]||[]).includes(hLord)){ d9h=h; break; } }
    if(d9h){ const si=(V_SIGNS.indexOf(d9LagnaSign)+d9h-1)%12; d9={ sign:V_SIGNS[si], house:d9h, dignity:vDig(hLord,V_SIGNS[si]) }; }
  }
  // D10: from the already-built varga chart
  let d10=null;
  if(vargaChart && vargaChart.placements && vargaChart.placements[hLord]){
    const pp=vargaChart.placements[hLord]; d10={ sign:pp.sign, house:pp.house, dignity:pp.dignity };
  }
  const pack = (p)=> p ? { ...p, element:SIGN_ELEMENT[p.sign], modality:SIGN_MODALITY[p.sign], houseClass:ccHouseClass(p.house) } : null;
  const P = { d1:pack(d1), d9:pack(d9), d10:pack(d10) };
  const three = [P.d1,P.d9,P.d10];
  const elDom  = ccDominant(three.map(x=>x&&x.element));
  const modDom = ccDominant(three.map(x=>x&&x.modality));
  const hcDom  = ccDominant(three.map(x=>x&&x.houseClass));

  // ── Core Nature ──
  const coreNature = {
    element: elDom ? elDom.value : null,
    modality: modDom ? modDom.value : null,
    essence: PLANET_ESSENCE[hLord],
    verdict: (elDom && modDom)
      ? `Your career instrument is ${hLord} — ${PLANET_ESSENCE[hLord]} — expressed most through ${elDom.value.toLowerCase()} (${ELEMENT_EDGE[elDom.value]}) in a ${modDom.value.toLowerCase()} rhythm (${MODALITY_ROLE[modDom.value].desc}).`
      : `Your career instrument is ${hLord} — ${PLANET_ESSENCE[hLord]}.`
  };

  // ── Sector Fit (independent axis 1) — planet karakatva, edged by dominant element ──
  const sectorCons = ccConsistency(elDom);
  const sectorSignals = [
    `Your 10th lord is ${hLord}, whose natural fields are: ${PLANET_SECTORS[hLord].join("; ")}.`,
    elDom ? `Across D1, D9 and D10 ${hLord} (your 10th lord) sits most in ${elDom.value.toLowerCase()} signs (${elDom.count} of ${elDom.total}) — tilting these fields toward ${ELEMENT_EDGE[elDom.value]}.` : null,
    (P.d1&&P.d1.dignity)? `In D1 it is ${P.d1.dignity.toLowerCase()==="neutral"?"neutrally placed":P.d1.dignity.toLowerCase()} — ${(P.d1.dignity==="Exalted"||P.d1.dignity==="Own sign")?"the field expresses cleanly and with confidence":P.d1.dignity==="Debilitated"?"the field is real but harder-won; it rewards persistence over ease":"the field is workable and steady"}.` : null
  ].filter(Boolean);
  // Outlier element: when the charts only LEAN (2/3) on element, name the differing chart's
  // element AND give concrete example roles for it — so "D10 leans fire" never lands without
  // an example of what fire-sign fields actually look like.
  let sectorOutlier = null;
  if(elDom && elDom.count===2){
    const labelOf = (k)=> k==="d1"?"your birth chart (D1)":k==="d9"?"your D9 (navamsha)":"your D10 (career chart)";
    for(const k of ["d1","d9","d10"]){ const pk=P[k]; if(pk && pk.element && pk.element!==elDom.value){
      sectorOutlier = { chart:labelOf(k), element:pk.element,
        note:`${labelOf(k)} leans ${pk.element.toLowerCase()} instead — pointing toward ${ELEMENT_EXAMPLES[pk.element]}. A real secondary flavour to weigh against your own experience, not a contradiction.` };
      break; } }
  }
  const sectorFit = { leaning: PLANET_SECTORS[hLord].slice(), edge: elDom?elDom.value:null,
    edgeExamples: elDom?ELEMENT_EXAMPLES[elDom.value]:null, outlier: sectorOutlier,
    consistency: sectorCons.label, consistencyNote: sectorCons.note, signals: sectorSignals };

  // ── Role Fit (independent axis 2) — modality gives build/operate/advise; house-class gives visibility ──
  const roleCons = ccConsistency(modDom);
  const roleBase = modDom ? MODALITY_ROLE[modDom.value] : null;
  const roleSignals = [
    modDom ? `${hLord} (your 10th lord) sits in ${modDom.value.toLowerCase()} signs in ${modDom.count} of ${modDom.total} charts — ${roleBase?roleBase.desc:""}.` : null,
    hcDom ? `Its house placement across the charts is most often ${hcDom.value==="visible"?"angular/visible":hcDom.value==="behind"?"in the 6/8/12 (depth) houses":hcDom.value==="relational"?"partnership/network houses":"supportive houses"} — pointing to ${CC_HOUSECLASS_NOTE[hcDom.value]}.` : null,
    `These two axes are read SEPARATELY: your field (Sector) and your mode of working (Role) can each lean a different way, and the chart does not blend them.`
  ].filter(Boolean);
  // IC vs People-Management lean, grounded in where the 10th lord most often sits:
  // visible (1/10) → leadership; relational (7/11) → people-facing leadership;
  // behind (6/8/12) → specialist/IC; supportive → steady IC.
  const ICM = {
    visible:    { lean:"Managerial / leadership", note:"your chart leans toward managing and leading other people — directing teams and carrying visible authority over people and outcomes, rather than being the one who does the hands-on work" },
    relational: { lean:"Managerial / people-facing leadership (teams, clients, partnerships)", note:"your chart leans toward leading through relationships — managing people, clients, and networks rather than working solo" },
    behind:     { lean:"Subject-matter expert / specialist", note:"your chart leans toward being the deep specialist who does the expert work yourself — mastery of the craft matters more to you than managing other people" },
    supportive: { lean:"Subject-matter expert (steady, hands-on)", note:"your chart leans toward dependable, hands-on specialist work rather than front-line people management" }
  };
  const roleFit = {
    leaning: roleBase ? roleBase.role : null,
    visibility: hcDom ? CC_HOUSECLASS_NOTE[hcDom.value] : null,
    icVsManagement: hcDom ? ICM[hcDom.value] : null,
    consistency: roleCons.label, consistencyNote: roleCons.note, signals: roleSignals
  };

  // ── How to test it yourself (the reader runs the pass/fail against their own life) ──
  const howToTest = [
    "This page shows the chart's leaning — a starting point to check against your real working life, not a verdict.",
    "FIELD (what kind of work): look at the fields listed above, then think about the work that has actually energised you and produced your best results. Is it one of these fields, close to one, or clearly somewhere else? Trust your real track record over what merely sounds appealing.",
    "MODE — Expert, Manager, or Advisor? (how you work best) — this is the big career-direction question, so be clear with yourself: do your best results come when you are (1) the deep expert who does the work yourself — a SUBJECT-MATTER EXPERT / specialist; (2) the one leading and managing other people — a MANAGERIAL / LEADERSHIP role; or (3) guiding and advising others from the side — a mentor / advisor? The chart's lean is stated above; check it honestly against where you have actually delivered and felt most effective.",
    "Read FIELD and MODE separately — a strong field with a different working mode (or the reverse) is common and useful; don't blend them into one answer.",
    "Where the chart's lean and your own experience agree, trust it and lean in. Where they differ, that gap is the signal — either a strength you haven't stepped into yet, or a mismatch worth a closer look before your next move.",
    "Then use the Timing section of this report to decide WHEN to act."
  ];

  return { tenthLord:hLord, positions:P, coreNature, sectorFit, roleFit, howToTest,
    framing:"structural leaning, tested by the reader against their own field and experience — not a prediction" };
}

// ── Career disruption windows (career domain) ───────────────────────────────────
// Classical, chart-general (NOT fitted to any one chart): a career is disruption-PRONE
// when its ruler sits in a dusthana (6/8/12), is weak, or a malefic/node sits in the 10th.
// For such a chart, the periods most likely to bring real disruption are graded:
//   SIGNIFICANT = a node sub-period (Rahu/Ketu) — sudden, destabilising, obstacle-ridden
//                 (this is why e.g. a Ketu antardasha can damage a career while a Saturn
//                 one merely restructures it and is recoverable).
//   MODERATE    = the 6th/8th/12th-lord or the (dusthana-placed) 10th-lord sub-period —
//                 change, pressure, restructuring; usually navigable.
// We surface the most relevant PAST ones (recognition / pattern) and the UPCOMING ones
// within the 20-yr horizon (course-correction). A STABLE career chart returns prone:false
// and the report raises no disruption alarm — so this never over-flags steady careers.
function buildCareerDisruptions(dashas, birthDate, d1LagnaSign, hLord, lordPlacement, d1P, amatyakaraka, compound, houseStates){
  try{
    if(!Array.isArray(dashas) || !dashas.length) return null;
    // Compound-state MITIGATORS for the probability layer: a disruptor that is itself a
    // cancelled debilitation, or a structurally protected 10th, LOWERS the likelihood that a
    // window actually disrupts (vs. merely tests).
    const nbFullSet = new Set((compound&&compound.neechaBhanga||[]).filter(nb=>nb.level==="full").map(nb=>nb.planet));
    const h10 = houseStates && houseStates[10];
    const tenthProtected = !!(h10 && (h10.grade==="strong" || h10.grade==="supported" || h10.angles.some(a=>a.why&&a.why.indexOf("aspects its own house")>=0)));
    const byY = birthDate ? new Date(birthDate).getFullYear() : null;
    const nowY = new Date().getFullYear(); const capY = nowY + 20;
    const tenthHouse = lordPlacement && lordPlacement.house;
    const tenthInLoss = lordPlacement && [8,12].includes(lordPlacement.house);   // loss/upheaval houses
    const tenthInSixth = lordPlacement && lordPlacement.house===6;                // struggle/disputes
    const tenthWeak = lordPlacement && (lordPlacement.dignity==="Debilitated" || lordPlacement.dignity==="Combust");
    const tenthOcc = occupantsOfHouse(d1P,10);
    // Only the NODES (Rahu/Ketu — chhaya grahas) are a credible "disruption in the career
    // house" signature. Sun, Saturn and Mars in the 10th get DIG BALA (directional
    // strength) — classically a disciplined, authoritative, driven career, NOT disruption —
    // so they must NOT raise a disruption alarm, or steady careers get wrongly flagged.
    const nodeOn10 = tenthOcc.some(p=>["Rahu","Ketu"].includes(p));
    const prone = !!(tenthInLoss || tenthInSixth || tenthWeak || nodeOn10);

    // SECONDARY / EARLY-SIGNAL windows (bhavat bhavam) — the 7th house is the 10th-FROM-10th:
    // livelihood, the marketplace and public dealing. A node there gives an EARLIER, softer
    // career signal (restlessness or a quiet detachment about one's work-standing) than the
    // primary break of the 10th itself. This is the GENERAL rule that REPLACES the retired,
    // over-fit findPrecursor — derived for every chart from the derivative house, not hand-
    // coded to one timeline, and no longer dependent on a primary window already existing.
    const earlySignals=(()=>{
      try{
        const derivOcc = occupantsOfHouse(d1P,7).filter(p=>["Rahu","Ketu"].includes(p));
        if(!derivOcc.length) return [];
        const SIGNAL={ Ketu:"a quiet detachment or disillusionment about your work-standing — a sense that a chapter is closing", Rahu:"a restlessness and a pull toward an unconventional or risky move in your work-life" };
        const list=[];
        for(const md of dashas){ if(!Array.isArray(md.antarDasas)) continue;
          for(const ad of md.antarDasas){ if(!derivOcc.includes(ad.lord)) continue;
            const sy=ad.startDate?new Date(ad.startDate).getFullYear():null, ey=ad.endDate?new Date(ad.endDate).getFullYear():null;
            if(sy==null) continue; if(byY!=null && (sy-byY)<18) continue; if(sy>capY) continue;
            const years=(ey&&ey!==sy)?(sy+"–"+ey):String(sy);
            const when=(ey&&ey<nowY)?"past":(sy>nowY?"upcoming":"current");
            list.push({ years, sy, planet:ad.lord, md:md.lord, when,
              note:("the "+ad.lord+" sub-period touches your 7th house — the 10th-from-the-10th, your house of livelihood and the marketplace — bringing "+(SIGNAL[ad.lord]||"a secondary stir in your work-life")+". It is an EARLIER, softer signal than a primary break — the chart's cue to read the ground and prepare.") });
          }
        }
        list.sort((a,b)=>a.sy-b.sy);
        return [...list.filter(w=>w.when==="past").slice(-1), ...list.filter(w=>w.when!=="past").slice(0,2)];
      }catch(_){ return []; }
    })();

    if(!prone) return { prone:false, earlySignals };
    const reason = (tenthInLoss) ? ("your career ruler "+hLord+" (10th lord) sits in the "+ordinalD(lordPlacement.house)+" house — a house of upheaval and loss, so its own periods can dismantle and reshape your working life rather than simply test it")
      : tenthInSixth ? ("your career ruler "+hLord+" (10th lord) sits in the 6th — the house of struggle and dispute — so its periods bring friction and contest more than clean progress")
      : nodeOn10 ? "a shadow planet (Rahu or Ketu) sits in your house of career, so your path can move through sudden, unconventional changes and resets"
      : ("your career ruler "+hLord+" (10th lord) is under pressure, so your path asks for extra resilience through its rougher patches");

    // CAREER-AXIS DISRUPTORS (connection-based — a planet counts only when it is genuinely
    // tied to career, so a node in an unrelated house is NOT a false alarm):
    //   - the 10th lord itself, graded by WHERE it sits (8/12 loss = significant & can be
    //     lasting; 6th or weak = moderate);
    //   - a NODE (Rahu/Ketu) sitting IN the 10th (significant) — NOT a dig-bala malefic;
    //   - a NODE CONJUNCT the 10th lord or the Amatyakaraka career karaka (moderate).
    const disruptors = {};
    if(hLord){ disruptors[hLord] = tenthInLoss ? "significant" : (tenthInSixth || tenthWeak) ? "moderate" : null; if(!disruptors[hLord]) delete disruptors[hLord]; }
    for(const p of tenthOcc){ if(["Rahu","Ketu"].includes(p)) disruptors[p]=disruptors[p]||"significant"; }
    const amaHouse = amatyakaraka && d1P[amatyakaraka] && d1P[amatyakaraka].house;
    for(const m of ["Rahu","Ketu"]){ const h=d1P[m]&&d1P[m].house; if(h && m!==hLord && ((tenthHouse&&h===tenthHouse)||(amaHouse&&h===amaHouse))) disruptors[m]=disruptors[m]||"moderate"; }

    // RECOVERY CAPACITY — can a career setback be rebuilt to its old earning level? Read from
    // the EARNING axis: the 2nd (income) and 11th (gains) lords. When those are themselves
    // weak or in loss-houses, recovery is slow and often only through reinvention, not return
    // (this is why a disruption can permanently dent earning).
    const l2=houseLord(d1LagnaSign,2), l11=houseLord(d1LagnaSign,11);
    const weakE=(p)=> p && d1P[p] && (d1P[p].dignity==="Debilitated"||d1P[p].dignity==="Combust"||[6,8,12].includes(d1P[p].house));
    const earnLords=[...new Set([l2,l11].filter(Boolean))];
    const weakEarn=earnLords.filter(weakE).length;
    const recoveryCapacity = (!earnLords.length) ? "unknown" : (weakEarn===earnLords.length) ? "low" : (weakEarn>0) ? "moderate" : "resilient";
    const recoveryNote = recoveryCapacity==="low"
      ? "your income and gains significators are themselves under pressure, so a serious career setback tends to recover slowly and through reinvention rather than a return to the old level — which makes protecting yourself BEFORE a significant window matter more for you than for most (a deeper financial buffer, diversified income, and no fragile single-point dependence)"
      : recoveryCapacity==="moderate" ? "your earning axis is mixed — recovery from a setback is workable but asks for deliberate effort and a reasonable buffer"
      : recoveryCapacity==="resilient" ? "your earning axis is sound — setbacks, when they come, tend to be recoverable with steady effort" : "";

    // STRESS-VALENCE of a running period for the career axis — does this planet's period
    // DEEPEN a career disruption or CUSHION it? Classical modulator: a malefic / struggle /
    // loss influence amplifies; a strong or benefic career activation softens. This REPLACES
    // the earlier "does the main period ACTIVATE the 10th" test, which (a) wrongly treated a
    // benefic career-activating period as an amplifier, and (b) DROPPED a genuine disruptor
    // sub-period — e.g. the 10th-lord-in-8th antardasha — whenever the main period was not
    // career-linked. A disruptor sub-period is now ALWAYS surfaced, and graded by valence.
    const l6g=houseLord(d1LagnaSign,6), l8g=houseLord(d1LagnaSign,8), l12g=houseLord(d1LagnaSign,12);
    const beneficP=new Set(["Jupiter","Venus","Mercury","Moon"]);
    const careerStress=(p)=>{
      if(!p) return "neutral";
      const pp=d1P[p];
      if(disruptors[p]) return "amplify";                                     // the planet is itself a career disruptor
      if([l6g,l8g,l12g].includes(p)) return "amplify";                        // a 6/8/12 (struggle/loss) lord
      if(pp && pp.dignity==="Debilitated") return "amplify";
      if(pp && pp.house && p!==hLord && ["Saturn","Mars","Rahu","Ketu"].includes(p) && aspectsHouse(p,pp.house,10)) return "amplify"; // a malefic (not the 10th lord itself) afflicting the 10th
      if(p===hLord && pp && ![6,8,12].includes(pp.house) && (pp.dignity==="Exalted"||pp.dignity==="Own sign")) return "cushion"; // a strong 10th lord
      if(beneficP.has(p) && pp && pp.house===10) return "cushion";            // a benefic in the 10th
      return "neutral";
    };
    const stressWhy={
      amplify:"the main period is itself career-stressing (a struggle/loss lord, a malefic on the career axis, or a disruptor), so the sub-period's disruption runs deeper and can last",
      cushion:"the main period is career-supportive (a strong or benefic career activation), so the disruption softens into a navigable reset",
      neutral:"the main period is neutral to career, so the sub-period is felt as a real but self-contained disruption",
    };
    const sevOf=(lord)=>disruptors[lord]||null;
    const out=[];
    for(const md of dashas){ if(!Array.isArray(md.antarDasas)) continue;
      const mdV=careerStress(md.lord);
      for(const ad of md.antarDasas){ const base=sevOf(ad.lord); if(!base) continue;
        // The 10th LORD in a loss house (8/12), running its OWN antardasha, is the primary
        // delivery of career results coloured by loss — inherently PRONOUNCED, regardless of
        // the main period (the ruler delivering its own placement). A TENANT disruptor (a node
        // in the 10th) needs the main period to ALSO stress career (double-activation) to read
        // as pronounced; otherwise it is a real but moderate reset. Nothing is dropped for an
        // "unrelated" main period — that was the bug that hid the real case.
        const ownLordInLoss = (ad.lord===hLord && tenthInLoss);
        const ownMahadasha = (md.lord===ad.lord);   // the lord's OWN Mahadasha = full delivery
        let severity;
        if(ownLordInLoss)              severity = (mdV==="amplify" || ownMahadasha) ? "significant" : (mdV==="cushion") ? "mild" : "moderate";
        else if(base==="significant")  severity = (mdV==="amplify") ? "significant" : "moderate";
        else                           severity = (mdV==="amplify") ? "moderate"    : "mild";
        if(severity==="mild") continue;
        const sy=ad.startDate?new Date(ad.startDate).getFullYear():null, ey=ad.endDate?new Date(ad.endDate).getFullYear():null;
        if(sy==null) continue;
        if(byY!=null && (sy-byY)<18) continue;         // adult only
        if(sy>capY) continue;                           // within the 20-year horizon
        const years=(ey&&ey!==sy)?(sy+"–"+ey):String(sy);
        const when = (ey&&ey<nowY)?"past":(sy>nowY?"upcoming":"current");
        // PROBABILITY / likelihood — convergence of independent angles, with compound-state
        // mitigation. Plain graded band (elevated / moderate / lower), never a false percentage.
        let lk = (severity==="significant") ? 2 : 1; const lkFactors=[], lkMit=[];
        if(mdV==="amplify"){ lk+=1; lkFactors.push("the main period also stresses career (double-activation)"); }
        else if(mdV==="cushion"){ lk-=1; lkMit.push("the main period is career-supportive"); }
        if(ownLordInLoss){ lk+=1; lkFactors.push("the career ruler "+hLord+" is delivering its own loss-house placement"); }
        if(ownMahadasha){ lk+=0.5; lkFactors.push("it falls in the planet's own main period (full delivery)"); }
        if(recoveryCapacity==="low"){ lk+=0.5; lkFactors.push("the earning axis recovers slowly, so a setback bites harder"); }
        if(nbFullSet.has(ad.lord)){ lk-=1.5; lkMit.push("this planet's debilitation is cancelled (resilient), which softens its disruptive edge"); }
        if(tenthProtected){ lk-=1; lkMit.push("the career house is structurally protected (its own ruler holds it)"); }
        const likelihood = lk>=3 ? "elevated" : lk>=1.5 ? "moderate" : "lower";
        const likelihoodWhy = (lkFactors.length?("raised by: "+lkFactors.join("; ")):"")+((lkFactors.length&&lkMit.length)?" — ":"")+(lkMit.length?("eased by: "+lkMit.join("; ")):"");
        // CONSTRUCTIVE face (balance): when the period-lord is the career significator
        // (Amatyakaraka) well placed in the 1st/10th/11th, its own period — alongside its
        // testing edge — is a prime window to deliberately BUILD or LAUNCH one's own work.
        const amaWell = amatyakaraka && d1P[amatyakaraka] && [1,10,11].includes(d1P[amatyakaraka].house);
        const constructive = (amaWell && (ad.lord===amatyakaraka || md.lord===amatyakaraka))
          ? ("this is "+amatyakaraka+"'s own period, and "+amatyakaraka+" is your career significator (Amatyakaraka) well placed in the "+ordinalD(d1P[amatyakaraka].house)+" — so alongside its testing edge, this is one of the strongest windows to deliberately build or launch something of your own, provided you accept a heavy workload and build slowly")
          : null;
        out.push({ years, sy, ey, planet:ad.lord, md:md.lord, severity, mdStress:mdV, likelihood, likelihoodWhy, when, constructive, gradeWhy:stressWhy[mdV]||"" });
      }
    }
    out.sort((a,b)=>a.sy-b.sy);
    const past = out.filter(w=>w.when==="past").slice(-2);   // most recent two, each graded
    const up = out.filter(w=>w.when==="upcoming"||w.when==="current");
    const upcoming = [...up.filter(w=>w.severity==="significant"), ...up.filter(w=>w.severity==="moderate")]
      .sort((a,b)=>a.sy-b.sy).slice(0,3);

    // (Early-signal / precursor: the over-fit findPrecursor — built to reproduce one real
    // native's 2018-before-2019 signal, and fragile because it only ran once a significant
    // window already existed — has been retired. Its genuine Vedic basis (a node/malefic
    // period in a DERIVATIVE career house such as the 7th = 10th-from-10th) returns as a
    // general bhavat-bhavam layer, derived for every chart, not hand-coded to one timeline.)
    // The disruptor planet(s) and how they attach to the career axis — so the report can
    // transparently show WHY these specific windows, and WHICH sub-periods they are.
    const disruptorList = Object.keys(disruptors).map(p=>({
      planet:p, severity:disruptors[p], house:(d1P[p]&&d1P[p].house)||null,
      role: (p===hLord) ? ("your 10th lord "+p+" (career ruler)")
          : (tenthOcc.includes(p)) ? "sitting in your 10th house of career"
          : "tied to your career axis"
    }));
    const hasSignificant = past.concat(upcoming).some(w=>w.severity==="significant");
    return { prone:true, reason, recoveryCapacity, recoveryNote, past, upcoming, disruptors:disruptorList, hasSignificant, earlySignals };
  }catch(_){ return null; }
}

// ── Business lean (career domain) ───────────────────────────────────────────────
// ══ LAYER 1: COMPOUND-STATE PASS ═══════════════════════════════════════════════════
// Chart-wide derived states computed once, BEFORE any domain scoring, so later verdicts
// read SYNTHESISED states rather than raw sign/house facts. General Vedic laws only — no
// chart-specific tuning. Each state carries provenance (the rule + the placements that
// triggered it) for a why-line, and nothing here fires on every chart. Pure function of the
// D1 placements (+ D9 signs for the navamsha cancellation test). Not yet consumed by any
// domain — wiring happens in Layers 2–3; defined and population-validated first.
const CS_KENDRA = [1,4,7,10];
// Nakshatra (27 lunar mansions) and their Vimshottari lords, repeating every 9.
const NAK_LORDS = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const NAK_NAMES = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"];
// Career-sector leanings per nakshatra (classical significations; used to sharpen Sector-Fit).
const NAK_SECTOR = {
  "Ashwini":"healthcare, medicine, transport, emergency/quick-turnaround work",
  "Bharani":"logistics, ethics/law, discipline-heavy fields, life-and-death services",
  "Krittika":"engineering, metals/fire work, sharp critique/editing, defence, culinary",
  "Rohini":"agriculture and food, luxury and the arts, real estate, finance and banking",
  "Mrigashira":"research and search, communication, travel, sales and exploration",
  "Ardra":"analytics and data, pharma/chemistry, research, fields that thrive on change",
  "Punarvasu":"teaching, hospitality, logistics, anything about renewal and second chances",
  "Pushya":"counseling and care, public service, food and nourishment, steady institutions",
  "Ashlesha":"strategy and psychology, chemicals/pharma, intelligence and advisory work",
  "Magha":"leadership and administration, heritage/tradition, authority and institutions",
  "Purva Phalguni":"arts and entertainment, luxury, hospitality, creative self-expression",
  "Uttara Phalguni":"contracts and administration, philanthropy, structured helping professions",
  "Hasta":"skilled hands and craft, trade, medicine, media and detailed work",
  "Chitra":"design and architecture, engineering, aesthetics and visual work",
  "Swati":"independent trade and business, diplomacy, aviation, flexible self-employment",
  "Vishakha":"goal-driven enterprise, research, law, determined leadership",
  "Anuradha":"organising networks and teams, foreign dealing, disciplined collaboration",
  "Jyeshtha":"management and protection, administration, intelligence and oversight",
  "Mula":"research and investigation, roots/pharma/herbs, philosophy, getting to the bottom of things",
  "Purva Ashadha":"influence and debate, water/shipping, persuasion and public opinion",
  "Uttara Ashadha":"leadership, government, building enduring institutions",
  "Shravana":"listening, counseling and teaching, media and communication, structured advisory service",
  "Dhanishta":"music and rhythm, real estate, wealth management, group and team work",
  "Shatabhisha":"healing and technology, research, pharma, work with hidden or secret systems",
  "Purva Bhadrapada":"transformation, finance and the occult, statistics and deep analysis",
  "Uttara Bhadrapada":"depth and charity, foreign connections, research and counseling",
  "Revati":"nurturing and travel, logistics, spiritual and artistic work"
};
function nakOf(longitude){
  const span=360/27; let idx=Math.floor((((longitude%360)+360)%360)/span);
  if(idx<0) idx=0; if(idx>26) idx=26;
  return { index:idx, name:NAK_NAMES[idx], lord:NAK_LORDS[idx%9] };
}
function d9SignMap(d9Houses, d9LagnaSign){
  const out={}; if(!d9Houses||!d9LagnaSign) return out;
  const li=V_SIGNS.indexOf(d9LagnaSign); if(li<0) return out;
  for(const[h,arr] of Object.entries(d9Houses)){ const hn=+h; if(!hn) continue; const sign=V_SIGNS[(li+hn-1)%12];
    (arr||[]).forEach(p=>{ if(p) out[p]=sign; }); }
  return out;
}
function buildCompoundStates(d1P, d1LagnaSign, d9Houses, d9LagnaSign){
  try{
    if(!d1P || !d1LagnaSign) return null;
    const SEVEN=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
    const ALL=SEVEN.concat(["Rahu","Ketu"]);
    const hof=(p)=> d1P[p] && d1P[p].house;
    const sof=(p)=> d1P[p] && d1P[p].sign;
    const moonH=hof("Moon");
    const kendraFrom=(refH,h)=>{ if(!refH||!h) return false; const diff=((h-refH+12)%12)+1; return diff===1||diff===4||diff===7||diff===10; };
    const d9sign=d9SignMap(d9Houses, d9LagnaSign);

    // ── 1a(i). Neecha Bhanga — debilitation cancellation (classical, multi-condition) ──
    // Only the seven planets (nodal debilitation is contested — left out on purpose).
    const neechaBhanga=[];
    for(const p of SEVEN){
      const s=sof(p); if(!s || DEBILITATION[p]!==s) continue;
      const conds=[];
      const disp=V_LORD[s]; const dispH=hof(disp);
      if(dispH && (CS_KENDRA.includes(dispH) || kendraFrom(moonH,dispH)))
        conds.push("its dispositor "+disp+" sits in an angle (kendra) from the Ascendant or the Moon");
      const exaltLord=Object.keys(EXALTATION).find(pl=>EXALTATION[pl]===s);
      const exH=exaltLord && hof(exaltLord);
      if(exH && (CS_KENDRA.includes(exH) || kendraFrom(moonH,exH)))
        conds.push("the planet exalted in that sign ("+exaltLord+") sits in an angle");
      if(exH && exH===hof(p))   // exalted-planet CONJUNCT the debilitated planet (classical cancellation)
        conds.push("the planet exalted in that sign ("+exaltLord+") is conjunct it");
      const d9s=d9sign[p];
      if(d9s && (EXALTATION[p]===d9s || (OWN_SIGNS[p]||[]).includes(d9s)))
        conds.push("in the navamsha it occupies its "+(EXALTATION[p]===d9s?"exaltation":"own")+" sign");
      // GRADED, not binary: a single condition only SOFTENS the debility; two or more is a
      // genuine cancellation (the resilient-rise reading). Keeps debilitation meaningful —
      // population-validation showed a binary flag cancelled ~83% of debilitations, too much.
      const level = conds.length>=2 ? "full" : conds.length===1 ? "partial" : "none";
      neechaBhanga.push(
        level==="full"
        ? { planet:p, sign:s, house:hof(p), cancelled:true, level, conditions:conds,
            reading:p+" is debilitated in the birth chart but the debilitation is strongly cancelled — read as resilient strength that rises after an early setback, not as weakness.",
            why:p+" debilitated in "+s+" (house "+hof(p)+"); Neecha Bhanga (full) via: "+conds.join("; ")+"." }
        : level==="partial"
        ? { planet:p, sign:s, house:hof(p), cancelled:false, level, conditions:conds,
            reading:p+" is debilitated, with one classical offsetting factor — the weakness is eased, not fully reversed; expect struggle that gives way to competence over time.",
            why:p+" debilitated in "+s+" (house "+hof(p)+"); partial Neecha Bhanga via: "+conds.join("; ")+"." }
        : { planet:p, sign:s, house:hof(p), cancelled:false, level, conditions:[],
            reading:p+" is debilitated and the classical cancellation conditions are not met — a genuinely demanding placement.",
            why:p+" debilitated in "+s+" (house "+hof(p)+"); no Neecha Bhanga condition met." });
    }

    // ── 1a(ii). Retrograde (Chesta Bala) strength ──
    // Nodes are always retrograde (excluded); Sun/Moon never retrograde.
    const retroStrength=[];
    for(const p of ["Mars","Mercury","Jupiter","Venus","Saturn"]){
      if(!d1P[p] || !d1P[p].retro) continue;
      const ph=hof(p);
      const ownHouses=[]; for(let h=1;h<=12;h++){ if(houseLord(d1LagnaSign,h)===p) ownHouses.push(h); }
      const reinforced=ownHouses.filter(h=> h===ph || aspectsHouse(p,ph,h));
      retroStrength.push({ planet:p, house:ph, reinforcedHouses:reinforced,
        reading: reinforced.length
          ? p+" is retrograde, which adds motional strength; it reinforces and protects the house(s) it rules ("+reinforced.map(ordinalD).join(", ")+") rather than leaving them weak."
          : p+" is retrograde, which adds motional (Chesta) strength to it.",
        periodNote: p+", being retrograde, tends to internalise its themes and move non-linearly — in its own major period (Mahadasha) recognition and results come in a delayed or unconventional way, and old chapters often resurface to be reworked rather than progress running in a straight line"+( ph===1 ? ", and placed on the Ascendant it turns that pressure inward onto the self" : "" )+".",
        why:p+" retrograde (Chesta Bala)"+(reinforced.length?("; reinforces own house(s) "+reinforced.join(", ")+" by aspect/occupancy"):"") });
    }

    // ── 1b. Full-aspect house support profile (every house read from multiple angles) ──
    const houseProfiles={};
    for(let h=1;h<=12;h++){
      const occ=occupantsOfHouse(d1P,h);
      const lord=houseLord(d1LagnaSign,h); const lordH=hof(lord);
      const received=[];
      for(const p of ALL){ const pp=hof(p); if(!pp||pp===h) continue; if(aspectsHouse(p,pp,h)) received.push(p); }
      const ownLordHolds = (lordH===h) || (!!lordH && aspectsHouse(lord,lordH,h));
      houseProfiles[h]={ occupants:occ, lord, lordHouse:lordH, aspectsReceived:received, ownLordHolds };
    }

    // ── 1c. Named yogas (strict formation; grows deliberately) ──
    const yogas=[];
    if(hof("Sun") && hof("Sun")===hof("Mercury")){
      const sameSign=sof("Sun")===sof("Mercury");
      const gap=sameSign ? Math.abs((d1P.Sun.degInSign||0)-(d1P.Mercury.degInSign||0)) : null;
      const combust=sameSign && gap!=null && gap<=14 && gap>=0.5;   // Mercury combust within ~14°, excl. cazimi
      yogas.push({ name:"Budhaditya Yoga", present:true, house:hof("Sun"), strength:combust?"moderate":"strong", combust,
        reading:"Sun and Mercury together form Budhaditya Yoga — sharp intelligence, articulate expression and recognition through knowledge"+(combust?", though Mercury is close to the Sun (combust), so the gift works best once consciously developed":"")+".",
        why:"Sun + Mercury conjunct in house "+hof("Sun")+(combust?" (Mercury combust, within ~14°)":"")+"." });
    }
    if(moonH && hof("Jupiter")){ const diff=((hof("Jupiter")-moonH+12)%12)+1;
      if([1,4,7,10].includes(diff)){ const jd=d1P.Jupiter.dignity;
        yogas.push({ name:"Gaja Kesari Yoga", present:true, from:"Moon",
          strength:(jd==="Debilitated")?"mild":(jd==="Exalted"||jd==="Own sign")?"strong":"moderate",
          reading:"Jupiter stands in an angle from the Moon, forming Gaja Kesari Yoga — sound judgement, respect, and a steadying wisdom that supports standing in life.",
          why:"Jupiter in an angle (kendra) from the Moon (Jupiter house "+hof("Jupiter")+", Moon "+moonH+")." });
      }
    }

    // ── 1d. Nakshatra-dispositor refinement ──
    // Classical precedence: a planet gives the results of its NAKSHATRA-LORD first, its house
    // occupancy second, its lordship third. So each planet's effective nature is refined by
    // the strength/placement of the lord of the star it occupies. (Esoteric per-nakshatra
    // personality attributes are a deliberately-separate, sourced later sub-pass.)
    const nbFullSet=new Set(neechaBhanga.filter(nb=>nb.level==="full").map(nb=>nb.planet));
    const lonOf=(p)=>{ const v=d1P[p]; if(!v) return null; const si=V_SIGNS.indexOf(v.sign); if(si<0) return null; return si*30+(v.degInSign||0); };
    const digOf=(p)=> d1P[p] && d1P[p].dignity;
    const strengthOf=(p)=>{ const d=digOf(p), h=hof(p);
      if(d==="Exalted"||d==="Own sign") return 1;
      if(d==="Debilitated" && !nbFullSet.has(p)) return -1;
      if(h && [6,8,12].includes(h)) return -1;
      if(h && [1,4,5,7,9,10].includes(h)) return 1;
      return 0; };
    const nakshatra=[];
    for(const p of SEVEN){
      const lon=lonOf(p); if(lon==null) continue;
      const nk=nakOf(lon); const lord=nk.lord;
      const ls = (lord===p) ? strengthOf(p) : strengthOf(lord);   // a planet in its own star: self-disposited
      const pOwn = strengthOf(p);
      let effect, note;
      if(ls>0 && pOwn<=0){ effect="lifted"; note="delivers better than its sign alone suggests — its star-lord is strong and well placed"; }
      else if(ls<0 && pOwn>=0){ effect="undercut"; note="delivers less cleanly than its sign suggests — its star-lord is weak or in a difficult house"; }
      else if(ls>0 && pOwn>0){ effect="reinforced"; note="is strong both by its sign and by its star-lord — dependable and well supported"; }
      else if(ls<0 && pOwn<0){ effect="doubly-tested"; note="is challenged by both its sign and its star-lord — an area that asks for real effort"; }
      else { effect="consistent"; note="reads much as its sign suggests; its star-lord neither strongly lifts nor undercuts it"; }
      nakshatra.push({ planet:p, nakshatra:nk.name, lord, lordHouse:hof(lord), effect,
        reading:p+" sits in "+nk.name+", ruled by "+lord+" — so "+p+" "+note+".",
        why:p+" in "+nk.name+" (star-lord "+lord+(hof(lord)?(", house "+hof(lord)):"")+"); "+effect+"." });
    }

    // ── 1c(ii). Raja Yogas — a kendra-lord with a trikona-lord (conjunction / mutual aspect /
    // exchange). The pinnacle is Dharma-Karmadhipati (9th-lord + 10th-lord). When it forms in a
    // dusthana (6/8/12) it still delivers — through transformation, research and sudden
    // breakthroughs — which is the balance the engine was missing (an 8th-house lord cluster is
    // a Raja Yoga, not only "disruption").
    const rajaYogas=[];
    const lordHousesOf={}; for(let h=1;h<=12;h++){ const l=houseLord(d1LagnaSign,h); if(l){ (lordHousesOf[l]=lordHousesOf[l]||[]).push(h); } }
    const kendraLords=[...new Set([1,4,7,10].map(h=>houseLord(d1LagnaSign,h)))];
    const trikonaLords=[...new Set([1,5,9].map(h=>houseLord(d1LagnaSign,h)))];
    const rajaDig=(p)=>["Exalted","Own sign"].includes(digOf(p))||nbFullSet.has(p);
    const seenRY=new Set();
    for(const kl of kendraLords){ for(const tl of trikonaLords){
      if(!kl||!tl||kl===tl) continue; const key=[kl,tl].sort().join("-"); if(seenRY.has(key)) continue;
      const kh=hof(kl), th=hof(tl); if(!kh||!th) continue;
      // Only the UNAMBIGUOUS, strong forms count — conjunction and sign exchange (parivartana).
      // Mutual aspect alone is too common (any opposition) and would dilute the signal; a
      // mutual aspect is counted only when at least one lord is dignified (a genuine sambandha).
      let relation=null;
      if(kh===th) relation="conjunction";
      else if((lordHousesOf[tl]||[]).includes(kh)&&(lordHousesOf[kl]||[]).includes(th)) relation="sign exchange";
      else if(aspectsHouse(kl,kh,th)&&aspectsHouse(tl,th,kh)&&(["Exalted","Own sign"].includes(digOf(kl))||["Exalted","Own sign"].includes(digOf(tl))||nbFullSet.has(kl)||nbFullSet.has(tl))) relation="mutual aspect";
      if(!relation) continue; seenRY.add(key);
      const klH=lordHousesOf[kl]||[], tlH=lordHousesOf[tl]||[];
      const isDK=(klH.includes(9)||tlH.includes(9))&&(klH.includes(10)||tlH.includes(10));
      const inDus=[6,8,12].includes(kh)||[6,8,12].includes(th);
      const strength=(rajaDig(kl)&&rajaDig(tl))?"strong":(rajaDig(kl)||rajaDig(tl))?"moderate":inDus?"through-struggle":"moderate";
      // TRADE-OFF: a yoga planet sitting in a dusthana ALSO drags the non-dusthana houses it
      // rules — e.g. a 9th-lord in the 8th that also rules the 4th stresses home/stability.
      const tradeoffs=[];
      for(const pl of [kl,tl]){ const ph2=hof(pl); if(ph2 && [6,8,12].includes(ph2)){ const ruled=(lordHousesOf[pl]||[]).filter(h=>![6,8,12].includes(h)&&h!==ph2);
        if(ruled.length) tradeoffs.push(pl+" also rules your "+ruled.map(ordinalD).join(" & ")+", which its placement in the "+ordinalD(ph2)+" puts under some pressure — the yoga lifts status, but those areas are worked harder for it"); } }
      rajaYogas.push({ planets:[kl,tl], relation, house:(kh===th?kh:null), dharmaKarmadhipati:isDK, inDusthana:inDus, strength, tradeoff:(tradeoffs.join("; ")||null),
        reading:(isDK?"A Dharma-Karmadhipati Raja Yoga":"A Raja Yoga")+" forms between "+kl+" and "+tl+" ("+relation+(kh===th?(" in your "+ordinalD(kh)+" house"):"")+") — "+(isDK?"the rulers of fortune (9th) and career (10th) joined is a classic mark of rising status, authority and breakthrough":"an angular ruler joined to a trinal ruler lifts status and success")+(inDus?", and placed in a house of depth it tends to deliver through upheaval, research or sudden breakthroughs rather than a smooth climb — a strength, not merely a disruption":"")+".",
        why:(isDK?"Dharma-Karmadhipati":"Raja")+" Yoga: "+kl+" ("+klH.map(ordinalD).join("/")+" lord) + "+tl+" ("+tlH.map(ordinalD).join("/")+" lord), "+relation+(kh===th?(" in the "+ordinalD(kh)):"")+(inDus?" (in a house of transformation)":"")+"." });
    }}

    // ── 1e. Badhaka (house of obstruction) — by Lagna modality ──
    let badhaka=null;
    try{
      const lagIdx2=V_SIGNS.indexOf(d1LagnaSign);
      const modality=lagIdx2%3;                       // 0 movable, 1 fixed, 2 dual
      const bHouse = modality===0?11 : modality===1?9 : 7;
      const bLord = houseLord(d1LagnaSign, bHouse);
      if(bLord) badhaka={ house:bHouse, planet:bLord, modality:(modality===0?"movable":modality===1?"fixed":"dual"),
        reading:"For your "+(modality===0?"movable":modality===1?"fixed":"dual")+" Ascendant, the "+ordinalD(bHouse)+" is the Badhakasthana — the house of obstruction — so its ruler "+bLord+" carries a built-in tendency to delay or block, a friction worth naming even where "+bLord+" is otherwise strong or a benefic.",
        why:"the "+ordinalD(bHouse)+" is the Badhaka for a "+d1LagnaSign+" ("+(modality===0?"movable":modality===1?"fixed":"dual")+") Ascendant; its lord "+bLord+" is the Badhakesh." };
    }catch(_){}

    // ── 1f. Combustion — a planet too near the Sun (its significations burn / internalise) ──
    const COMBUST_ORB={Moon:12,Mars:17,Mercury:14,Jupiter:11,Venus:10,Saturn:15};
    const combustion=[];
    try{
      const sunLon=lonOf("Sun");
      if(sunLon!=null){ for(const p of ["Moon","Mars","Mercury","Jupiter","Venus","Saturn"]){
        const pl=lonOf(p); if(pl==null) continue;
        let d=Math.abs(pl-sunLon); if(d>180) d=360-d;
        let orb=COMBUST_ORB[p]; if((p==="Mercury"||p==="Venus")&&d1P[p]&&d1P[p].retro) orb=(p==="Mercury"?12:8);
        if(d<=orb && d>0.5) combustion.push({ planet:p, orb:+d.toFixed(1),
          reading:p+" is close to the Sun (combust) — its significations tend to be absorbed into ego and identity, and work best expressed with quiet confidence rather than for show.",
          why:p+" within "+d.toFixed(1)+"° of the Sun (combust; orb "+orb+"°)." }); }
      }
    }catch(_){}

    return { neechaBhanga, retroStrength, houseProfiles, yogas, nakshatra, rajaYogas, badhaka, combustion };
  }catch(_){ return null; }
}

// ══ LAYER 2: MULTI-ANGLE HOUSE READING ══════════════════════════════════════════════
// A HouseState reads a house from EVERY angle a practitioner uses — occupants, the lord's
// placement and strength, aspects received (and the lord aspecting its own house), the
// natural significator (karaka), and the Bhavat-Bhavam house-from-house — each feeding the
// Layer-1 compound states in (a debilitated-but-cancelled occupant is not a weakness; a
// retrograde lord reinforcing its own house is protection). The graded verdict is the
// SYNTHESIS of the angles, never one alone; every angle carries its own why-line. General
// law; not yet consumed by any domain (wired in Layer 3).
const HS_BENEFIC = new Set(["Jupiter","Venus","Mercury","Moon"]);
const HS_MALEFIC = new Set(["Sun","Mars","Saturn","Rahu","Ketu"]);
const HS_KT      = new Set([1,4,5,7,9,10]);   // kendra + trikona (strong houses)
const HS_DUS     = new Set([6,8,12]);          // dusthana (difficult houses)
const BHAVA_KARAKA = {1:["Sun"],2:["Jupiter"],3:["Mars"],4:["Moon"],5:["Jupiter"],6:["Mars","Saturn"],7:["Venus"],8:["Saturn"],9:["Jupiter"],10:["Sun","Mercury","Jupiter","Saturn"],11:["Jupiter"],12:["Saturn"]};
function buildHouseState(h, d1P, d1LagnaSign, compound){
  try{
    if(!h || !d1P || !d1LagnaSign) return null;
    const lagIdx=V_SIGNS.indexOf(d1LagnaSign); if(lagIdx<0) return null;
    const sign=V_SIGNS[(lagIdx+h-1)%12];
    const lord=houseLord(d1LagnaSign,h);
    const hof=(p)=> d1P[p] && d1P[p].house;
    const digOf=(p)=> d1P[p] && d1P[p].dignity;
    const lordH=hof(lord);
    const occ=occupantsOfHouse(d1P,h);
    const prof=(compound&&compound.houseProfiles&&compound.houseProfiles[h])||null;
    const nbMap={}; (compound&&compound.neechaBhanga||[]).forEach(nb=>{ nbMap[nb.planet]=nb; });
    const retroReinf=new Set(); (compound&&compound.retroStrength||[]).forEach(r=>{ if((r.reinforcedHouses||[]).includes(h)) retroReinf.add(r.planet); });
    const angles=[]; let score=0;
    const add=(angle,dir,wt,why)=>{ angles.push({angle,direction:dir>0?"support":dir<0?"stress":"neutral",weight:wt,why}); score+=dir*wt; };

    // 1. Occupants (natural benefic/malefic × dignity, with compound-state overrides)
    for(const p of occ){
      const d=digOf(p), nb=nbMap[p];
      if(HS_BENEFIC.has(p)){
        if(d==="Exalted"||d==="Own sign") add("occupant",+1,1.5,p+" (benefic) strong in the house");
        else if(d==="Debilitated") (nb&&nb.level==="full") ? add("occupant",+1,0.5,p+" debilitated here but cancelled — resilient") : add("occupant",-1,0.5,p+" (benefic) debilitated here");
        else add("occupant",+1,1,p+" (benefic) occupies the house");
      } else {
        if(d==="Exalted"||d==="Own sign") add("occupant",+1,0.5,p+" (malefic) dignified here — capable but intense");
        else if(d==="Debilitated") (nb&&nb.level==="full") ? add("occupant",0,0.5,p+" debilitated-but-cancelled here") : add("occupant",-1,1,p+" (malefic) debilitated here");
        else add("occupant",-1,1,p+" (malefic) occupies the house");
      }
      if(retroReinf.has(p)) add("occupant",+1,0.5,p+" retrograde, reinforcing this (own) house");
    }

    // 2. House-lord placement & strength
    if(lord && lordH){
      const ld=digOf(lord), lnb=nbMap[lord];
      if(HS_DUS.has(lordH)) (lnb&&lnb.level==="full") ? add("lord",0,1,"house lord "+lord+" in a 6/8/12 but debilitation cancelled") : add("lord",-1,1,"house lord "+lord+" in a 6/8/12 (weakened)");
      else if(HS_KT.has(lordH)) add("lord",+1,1.5,"house lord "+lord+" in an angle/trine (well placed)");
      else add("lord",+1,0.5,"house lord "+lord+" in a neutral house");
      if(ld==="Exalted"||ld==="Own sign") add("lord",+1,0.5,"house lord "+lord+" dignified");
      else if(ld==="Debilitated" && !(lnb&&lnb.level==="full")) add("lord",-1,0.5,"house lord "+lord+" debilitated");
    }

    // 3. Aspects received + own-lord protection
    if(prof){
      let ben=0, mal=0;
      for(const p of (prof.aspectsReceived||[])){ HS_BENEFIC.has(p) ? ben++ : mal++; }
      if(ben) add("aspect",+1,Math.min(1,ben*0.5),ben+" benefic aspect(s) received");
      if(mal) add("aspect",-1,Math.min(1,mal*0.5),mal+" malefic aspect(s) received");
      if(prof.ownLordHolds && lordH!==h) add("aspect",+1,1,"house lord "+lord+" aspects its own house (protection)");
    }

    // 4. Natural significator (karaka) — primary only, to avoid over-counting
    const kk=(BHAVA_KARAKA[h]||[])[0];
    if(kk && hof(kk)){ const kh=hof(kk), kd=digOf(kk), knb=nbMap[kk];
      if(HS_DUS.has(kh) && !(knb&&knb.level==="full")) add("karaka",-1,0.5,"significator "+kk+" in a 6/8/12");
      else if(kd==="Debilitated" && !(knb&&knb.level==="full")) add("karaka",-1,0.5,"significator "+kk+" debilitated");
      else if(kd==="Exalted"||kd==="Own sign"||HS_KT.has(kh)) add("karaka",+1,0.5,"significator "+kk+" well placed");
    }

    // 5. Bhavat Bhavam — the house-from-house (Nth from Nth = (2h-2) mod 12 + 1)
    const dh=((2*h-2)%12)+1;
    const docc=occupantsOfHouse(d1P,dh);
    const dmal=docc.filter(p=>HS_MALEFIC.has(p) && digOf(p)!=="Exalted" && digOf(p)!=="Own sign");
    const dben=docc.filter(p=>HS_BENEFIC.has(p));
    if(dmal.length) add("derivative",-1,0.5,"malefic in the "+ordinalD(dh)+" (house-from-house): "+dmal.join(", "));
    else if(dben.length) add("derivative",+1,0.5,"benefic in the "+ordinalD(dh)+" (house-from-house)");

    // Net grade (thresholds tuned on a random population for a sane spread)
    let grade;
    if(score>=2.5) grade="strong"; else if(score>=1) grade="supported"; else if(score>-1) grade="mixed"; else if(score>-2.5) grade="stressed"; else grade="weak";
    const sup=angles.filter(a=>a.direction==="support").length, str=angles.filter(a=>a.direction==="stress").length;
    const tot=sup+str;
    const confidence = tot<2 ? "low" : (Math.max(sup,str)/tot)>=0.75 ? "high" : (Math.max(sup,str)/tot)>=0.6 ? "moderate" : "low";

    return { house:h, sign, lord, lordHouse:lordH, occupants:occ, derivativeHouse:dh,
      score:+score.toFixed(2), grade, confidence, angles, why:angles.map(a=>a.why) };
  }catch(_){ return null; }
}
function buildHouseStates(d1P, d1LagnaSign, compound){
  const out={}; for(let h=1;h<=12;h++){ out[h]=buildHouseState(h,d1P,d1LagnaSign,compound); } return out;
}

// ── Manglik / Mangal (Kuja) dosha — a TRANSPARENT checkpoint, not a verdict ─────────
// Mangal dosha is genuinely contested among experienced astrologers, in BOTH how it is
// calculated and how much weight it deserves. Rather than issue a scary one-line verdict
// (what casual calculators do), this shows the calculation openly so the reader can weigh
// it. Accuracy choices, each defensible and sourced from classical practice:
//  • Three reference points — Ascendant (most common), Moon, and Venus (the marriage
//    significator). Strength is graded by cross-reference AGREEMENT, which is the robust,
//    false-positive-resistant method professionals use — a single placement is "mild",
//    not a diagnosis.
//  • Dosha houses are the classical six: 1, 2, 4, 7, 8, 12 — but the 1st and 2nd are
//    exactly the houses schools DISAGREE on, so a hit there is flagged "contested", never
//    treated as firm. The firm houses are 4, 7, 8, 12.
//  • The standard parihara (cancellation/bhanga) conditions are then applied and listed —
//    these are what casual calculators skip, and skipping them is the main source of false
//    Manglik alarms. Firm cancellers reduce the net reading; contested ones are shown but
//    not counted.
// Additive only: this never alters any prediction — it renders a checkpoint the reader can
// examine. Mutual cancellation needs the partner's chart and is explicitly out of scope.
function buildManglikCheckpoint(d1P, d1LagnaSign){
  try{
    const mars=d1P&&d1P.Mars, moon=d1P&&d1P.Moon, venus=d1P&&d1P.Venus;
    if(!mars || !mars.sign || !d1LagnaSign) return null;
    const siOf=(s)=> V_SIGNS.indexOf(s);
    const houseFrom=(refSign)=>{ const a=siOf(refSign), b=siOf(mars.sign); if(a<0||b<0) return null; return ((b-a+12)%12)+1; };
    const DOSHA_HOUSE = {
      1:"the Ascendant — self, temperament and the body",
      2:"the family, speech and kutumba (counted in some schools, not all)",
      4:"the home and domestic peace",
      7:"the marriage house itself",
      8:"māngalya — the longevity of the marriage, and sudden events",
      12:"the bed, private life, expenses and withdrawal"
    };
    const CONTESTED_HOUSE = new Set([1,2]); // the two houses schools disagree on
    const refs=[
      {name:"Ascendant", sign:d1LagnaSign, fixedHouse:mars.house},
      {name:"Moon",      sign:moon&&moon.sign},
      {name:"Venus",     sign:venus&&venus.sign}
    ];
    const byReference = refs.map(r=>{
      if(!r.sign) return {ref:r.name, available:false};
      const h = (r.fixedHouse!=null) ? r.fixedHouse : houseFrom(r.sign);
      const dosha = !!DOSHA_HOUSE[h];
      return {ref:r.name, available:true, marsHouse:h, dosha,
              contested: dosha && CONTESTED_HOUSE.has(h),
              houseMeaning: dosha ? DOSHA_HOUSE[h] : null};
    });
    const avail = byReference.filter(b=>b.available);
    const hits  = avail.filter(b=>b.dosha);
    const firmHits = hits.filter(b=>!b.contested);          // on the undisputed houses 4/7/8/12
    let rawStrength;
    if(hits.length===0) rawStrength="none";
    else if(firmHits.length===0) rawStrength="contested-only"; // only 1st/2nd hits — many schools would not call this Manglik at all
    else if(firmHits.length>=2) rawStrength="pronounced";
    else rawStrength="mild";                                  // a single firm reference
    const severeSeat = [7,8].includes(mars.house);           // Mars in 7th/8th FROM LAGNA = severest classical case

    // ── parihara (cancellation / bhanga) ──
    // FULL  = classically nullifies (Mars is intrinsically benefic/dignified, or this lagna
    //         does not apply the dosha) → the dosha is treated as not applicable.
    // PARTIAL = softens by a step but does not nullify.
    // CONTESTED = shown for transparency, not counted (schools disagree whether it cancels).
    const cancellations=[];
    const full=(rule,why)=>cancellations.push({rule,applies:"full",why});
    const partial=(rule,why)=>cancellations.push({rule,applies:"partial",why});
    const soft=(rule,why)=>cancellations.push({rule,applies:"contested",why});
    if(["Aries","Scorpio"].includes(mars.sign)) full("Mars in its own sign ("+mars.sign+")","an own-sign Mars is classically held to cancel the dosha — it expresses as drive and protectiveness, not friction");
    if(mars.sign==="Capricorn") full("Mars exalted in Capricorn","exalted Mars is disciplined, not disruptive — a classical cancellation");
    if(["Cancer","Leo"].includes(d1LagnaSign)) full("Mars is Yogakaraka for a "+d1LagnaSign+" Ascendant","for this lagna Mars rules as a benefic, so the dosha is traditionally not applied at all");
    const jup=d1P.Jupiter;
    if(jup && jup.house===mars.house) full("Jupiter conjunct Mars","Jupiter joined to Mars is a classical nullifier of the dosha");
    else if(jup && jup.house && aspectsHouse("Jupiter", jup.house, mars.house)) partial("Jupiter aspects Mars","Jupiter's aspect tempers the Mars affliction");
    else if(jup && jup.house && aspectsHouse("Jupiter", jup.house, 7)) partial("Jupiter aspects the 7th house","benefic protection falls on the marriage house");
    if(["Sagittarius","Pisces","Taurus"].includes(mars.sign)) partial("Mars in a benefic sign ("+mars.sign+")","softens the dosha, though it is not held to fully cancel");
    if(mars.sign==="Cancer") soft("Mars debilitated in Cancer","some schools treat debilitated Mars as cancelling the dosha, others as weak rather than absent");
    if(["Leo","Aquarius"].includes(mars.sign)) soft("Mars in "+mars.sign,"several commentaries hold Mars here produces no dosha");
    if(venus && venus.house===mars.house) soft("Venus conjunct Mars","read by some as mitigating, by others as intensifying desire — weigh with care");
    const fullCancellers = cancellations.filter(c=>c.applies==="full");
    const partialCancellers = cancellations.filter(c=>c.applies==="partial");
    const contestedCancellers = cancellations.filter(c=>c.applies==="contested");

    // ── net reading (deliberately non-alarmist; full cancellation short-circuits) ──
    const LADDER=["minimal","mild","moderate","pronounced"];
    let idx = rawStrength==="pronounced"?3 : rawStrength==="mild"?1 : rawStrength==="contested-only"?0 : -1;
    if(idx>=0 && severeSeat) idx=Math.min(3, idx+1);
    let netStrength;
    if(rawStrength==="none") netStrength="not Manglik";
    else if(fullCancellers.length) netStrength="effectively cancelled";   // a classical full parihara is present
    else if(rawStrength==="contested-only") netStrength="unlikely (contested houses only)";
    else { idx = Math.max(0, idx - partialCancellers.length); netStrength=LADDER[Math.max(0,Math.min(3,idx))]; }

    return {
      present: hits.length>0,
      method:"Mars is examined from three reference points — the Ascendant (the usual check), the Moon, and Venus (the marriage significator). The classical dosha houses are the 1st, 2nd, 4th, 7th, 8th and 12th, of which the 1st and 2nd are disputed between schools and are marked as such here. Strength is read from how many reference points AGREE, not from a single placement, and the standard parihara (cancellation) conditions are then applied — a full parihara (own-sign or exalted Mars, a Yogakaraka lagna, or Jupiter joined to Mars) is treated as nullifying, matching classical practice.",
      byReference, referencesChecked:avail.length, referencesAfflicted:hits.length, firmReferencesAfflicted:firmHits.length,
      marsSign:mars.sign, marsHouseFromLagna:mars.house, marsDignity:mars.dignity||"neutral", severeSeat,
      rawStrength, netStrength, cancelled:fullCancellers.length>0,
      cancellations, fullCancellers, partialCancellers, contestedCancellers,
      mutualNote:"Mutual cancellation — both partners Manglik to a comparable degree — needs the partner's chart and cannot be judged from this chart alone.",
      caution:"Mangal (Manglik) dosha is genuinely contested among experienced astrologers, both in how it is calculated and how much weight it carries. This is shown as an open checkpoint, not a verdict: it reports what the chart holds and which cancellations apply, so it can be weighed rather than feared."
    };
  }catch(_){ return null; }
}

// ── Bālādi Avasthā (planetary life-stage by degree within its sign) ──────────────
// A planet's capacity to deliver its results is graded by WHERE in its sign it sits.
// Odd (vishama) signs run Bāla→Kumāra→Yuva→Vriddha→Mrita in 6° steps; even (sama) signs
// run the reverse. Yuva (youth) is full strength; Bāla (infant) and Vriddha (old) are
// weak; Mrita (dead) is near-powerless. This is why a 1° Venus — even a Yogakaraka —
// cannot be read as "strong" merely for sitting in its house (the V6 Native-4 error).
const AVASTHA_STRENGTH = { Bala:0.25, Kumara:0.5, Yuva:1.0, Vriddha:0.25, Mrita:0.0 };
function planetAvastha(sign, degInSign){
  if(sign==null || degInSign==null) return null;
  const si = V_SIGNS.indexOf(sign); if(si<0) return null;
  const odd = (si % 2 === 0);                         // Aries(0), Gemini(2), Leo(4)… = odd/vishama
  const seg = Math.max(0, Math.min(4, Math.floor(degInSign / 6)));
  const state = (odd ? ["Bala","Kumara","Yuva","Vriddha","Mrita"]
                     : ["Mrita","Vriddha","Yuva","Kumara","Bala"])[seg];
  return { state, strength:AVASTHA_STRENGTH[state],
    weak:(state==="Bala"||state==="Mrita"),           // the genuinely result-sapping states
    waning:(state==="Vriddha"),
    note: state==="Bala" ? "in its infant (Bāla) state — too immature to give more than a fraction of its results"
        : state==="Mrita" ? "in its dead (Mrita) state — almost unable to deliver its results"
        : state==="Vriddha" ? "in its old (Vriddha) state — its strength is waning"
        : state==="Kumara" ? "in its adolescent (Kumāra) state — growing but not yet at full strength"
        : "in its youth (Yuva) state — at full strength" };
}

// ── Marriage affliction — a classically-grounded MULTI-FACTOR assessment ──────────
// Replaces the old single test (which fired only on a malefic physically IN the D1 7th).
// It weighs, from BOTH the birth chart and the navamsha (D9, the marriage varga):
//   • malefic OCCUPATION of the 7th, and malefic ASPECTS onto it (Saturn 3/10, Mars 4/8,
//     nodes 5/9, any 7th) — the aspect dimension was the core V6 "false clear" gap;
//   • the 7th lord's condition (debilitation / dusthana / weak avasthā / malefic aspect);
//   • Venus, the Kalatrakaraka, in D1 AND D9 — debilitated Venus in the navamsha is a
//     PRIMARY classical marital-strain signal and was being ignored entirely;
//   • the Darakaraka (Jaimini spouse karaka) in a dusthana or debilitated;
//   • the Badhakesh sitting in the 7th; and the D9 7th-house occupants + 7th-lord caution.
// It returns a graded severity so the "checks come back clear" reassurance can fire ONLY
// when the chart is genuinely clear — never again as a blanket false all-clear.
function scoreMarriageAffliction(ctx){
  try{
    const { d1P, d9Houses, d9LagnaSign, hLord, lordPlacement, occupants,
            darakaraka, badhaka, d9LordCaution } = ctx;
    // Only the HEAVY malefics afflict a house classically; the Sun is a mild, near-universal
    // influence and is NOT counted (its 7th-aspect from the 1st is far too common to mean
    // anything). BENEFICS (Jupiter above all, then Venus / unafflicted Mercury) PROTECT the
    // 7th — Jupiter's aspect on the 7th is a classical blessing — and must offset malefic
    // pressure, or the test flags almost every chart.
    const MAL = ["Saturn","Mars","Rahu","Ketu"];
    const HEAVY = ["Ketu","Rahu","Saturn"];
    const BEN = ["Jupiter","Venus"];
    const factors=[], clearChecks=[]; let score=0;
    const add=(w,txt)=>{ score+=w; if(txt) factors.push(txt); };
    const aspectors=(house,list)=>{ const out=[]; for(const p of list){ const pl=d1P[p]; if(pl&&pl.house&&pl.house!==house&&aspectsHouse(p,pl.house,house)) out.push(p); } return out; };
    const occOf=(house,list)=>Object.keys(d1P).filter(p=>list.includes(p)&&d1P[p]&&d1P[p].house===house);

    // F1 — the 7th house NET pressure: heavy-malefic occupation + aspect, OFFSET by benefic
    // occupation/aspect (Jupiter/Venus). Capped so it cannot alone dominate the verdict.
    const occ7mal = occOf(7, MAL);
    const asp7mal = aspectors(7, MAL).filter(p=>!occ7mal.includes(p));
    const prot7   = occOf(7, BEN).concat(aspectors(7, BEN));
    const malHits7 = occ7mal.length + asp7mal.length;
    let house7 = (occ7mal.length?occ7mal.some(p=>HEAVY.includes(p))?2:1:0) + (asp7mal.length?1:0);
    if(prot7.length) house7 = Math.max(0, house7 - (prot7.includes("Jupiter")?2:1));   // Jupiter protects most
    house7 = Math.min(house7, 3);
    if(house7>0){ const parts=[]; if(occ7mal.length) parts.push(occ7mal.join(", ")+" in it"); if(asp7mal.length) parts.push(asp7mal.join(", ")+" aspecting it"); add(house7, "your 7th house is under malefic pressure ("+parts.join("; ")+")"+(prot7.length?", only partly eased by "+prot7.join(", ")+"'s benefic aspect":"")); }
    else if(malHits7 && prot7.length) clearChecks.push("malefic pressure on your 7th house is offset by "+prot7.join(", ")+"'s benefic aspect");
    else clearChecks.push("your 7th house is free of malefic pressure");

    // F2 — the 7th lord's own condition
    if(lordPlacement){ const lp=lordPlacement, lw=[]; let w=0;
      if(lp.dignity==="Debilitated"){ lw.push("debilitated"); w+=2; }
      if([6,8,12].includes(lp.house)){ lw.push("in the "+ordinalD(lp.house)+" house"); w+=1; }
      const av=planetAvastha(lp.sign, lp.degInSign); if(av&&av.weak){ lw.push(av.note); w+=1; }
      if(aspectors(lp.house, MAL).length && !aspectors(lp.house, BEN).length){ lw.push("under malefic aspect"); w+=1; }
      if(w>0) add(Math.min(w,3), "your 7th lord "+hLord+" is "+lw.join(", "));
      else clearChecks.push("your 7th lord "+hLord+" is soundly placed");
    }

    // F3 — Venus (Kalatrakaraka) in the birth chart
    const ven=d1P["Venus"];
    if(ven){ const vw=[]; let w=0;
      if(ven.dignity==="Debilitated"){ vw.push("debilitated"); w+=1; }
      if([6,8,12].includes(ven.house)){ vw.push("in the "+ordinalD(ven.house)+" house"); w+=1; }
      const av=planetAvastha(ven.sign, ven.degInSign); if(av&&av.weak){ vw.push(av.note); w+=1; }
      if(w>0) add(Math.min(w,2), "Venus, the natural significator of marriage, is "+vw.join(", "));
      else clearChecks.push("Venus, the marriage significator, is well placed");
    }

    // F4 — Darakaraka (Jaimini spouse karaka) debilitated or in a dusthana
    if(darakaraka && d1P[darakaraka] && darakaraka!=="Venus"){ const dp=d1P[darakaraka];
      if(dp.dignity==="Debilitated"||[6,8,12].includes(dp.house))
        add(1, "your Darakaraka "+darakaraka+" (the chart's own spouse significator) sits "+(dp.dignity==="Debilitated"?"debilitated":"in the "+ordinalD(dp.house)+" house"));
    }

    // F5 — Badhakesh (ruler of obstruction) sitting in the 7th
    if(badhaka && badhaka.planet && d1P[badhaka.planet] && d1P[badhaka.planet].house===7)
      add(1, "the Badhakesh (ruler of obstruction) "+badhaka.planet+" sits in your 7th house — a classical cause of recurring obstacles or delay in marriage");

    // ── Navamsha (D9) — the marriage varga, weighted strongly ──
    const d9lag = V_SIGNS.indexOf(d9LagnaSign);
    const d9HouseOf=(p)=>{ for(let h=1;h<=12;h++){ if(((d9Houses||{})[h]||[]).includes(p)) return h; } return null; };

    // F6 — the D9 7th house: heavy-malefic occupants, offset by a benefic there
    const d9_7 = (d9Houses||{})[7]||[];
    const d9_7mal = d9_7.filter(p=>HEAVY.includes(p)||p==="Mars");
    const d9_7ben = d9_7.filter(p=>BEN.includes(p));
    if(d9_7mal.length){ let w=Math.min(d9_7mal.length,2); if(d9_7ben.length) w=Math.max(1,w-1);
      add(w, "in the navamsha (the marriage chart) your 7th house holds "+d9_7mal.join(", ")+(d9_7ben.length?" with "+d9_7ben.join(", ")+" also there":"")); }
    else clearChecks.push("the navamsha 7th house is free of malefics");

    // F7 — Venus in the D9 (debilitated navamsha Venus = a primary strain signal)
    const venD9H=d9HouseOf("Venus"); const venD9S=(venD9H!=null&&d9lag>=0)?V_SIGNS[(d9lag+venD9H-1)%12]:null;
    if(venD9S){ const deb=(dignityLabel("Venus",venD9S)==="Debilitated"), dus=[6,8,12].includes(venD9H);
      if(deb) add(2, "Venus is debilitated in the navamsha — a primary classical sign of strain or dissatisfaction in married life");
      else if(dus) add(1, "Venus sits in the "+ordinalD(venD9H)+" house of the navamsha");
      else clearChecks.push("Venus holds up in the navamsha");
    }

    // F8 — D9 (navamsha) caution computed upstream (the marriage varga's own 7th-lord test).
    // Worded without a bare "lord" reference; the named mechanics live in d9LordCaution itself.
    if(d9LordCaution) add(1, "the navamsha (marriage chart) independently adds a note of caution as life matures");

    // Severity banding — recalibrated WITH benefic mitigation so a genuinely clean chart reads
    // clear/mild and only a real convergence of factors reaches 'strong'. 'afflicted' (the gate
    // on the all-clear) means moderate+, i.e. a real, named convergence — not a lone mild note.
    let severity;
    if(score<=1)      severity="clear";
    else if(score<=3) severity="mild";
    else if(score<=5) severity="moderate";
    else              severity="strong";
    return { score, severity, afflicted:(severity==="moderate"||severity==="strong"), factors, clearChecks };
  }catch(_){ return { score:0, severity:"clear", afflicted:false, factors:[], clearChecks:[] }; }
}

// ── OWNER-ONLY sensitive marriage indications (for the astrologer's confidential consultation) ──
// These are the blunt classical reads a professional needs but a client report must NOT volunteer:
// susceptibility to a bond OUTSIDE the primary one (fidelity), and the risk of separation/divorce.
// Graded by CONVERGENCE so a lone marker never "pinpoints" anything — only a genuine cluster reads
// 'notable'/'strong'. Returned under flags.ownerSensitive and STRIPPED from the client packet.
// ADULT-ONLY: nulled for a minor (there is no such read for a child).
function buildMarriageOwnerSensitive(d1P, d1LagnaSign, d9Houses, d9LagnaSign, hLord, marAff){
  try{
    const H=(p)=>d1P[p]&&d1P[p].house;
    const conj=(a,b)=>H(a)&&H(b)&&H(a)===H(b);
    const asp=(a,b)=>{ const h=H(a),t=H(b); return h&&t&&h!==t&&aspectsHouse(a,h,t); };
    const link=(a,b)=>conj(a,b)||asp(a,b)||asp(b,a);     // conjunction or either-way aspect
    const sixthLord=houseLord(d1LagnaSign,6), twelfthLord=houseLord(d1LagnaSign,12);
    const lagIdx=V_SIGNS.indexOf(d1LagnaSign);
    const dual=(lagIdx%3===2);

    // ── Fidelity / outside-bond susceptibility ──
    // A real affair indication needs a SECRECY/EXCESS CORE (the 12th house of the bed and the
    // hidden, or the Venus–Rahu over-reach signature), not merely common passion-links. Passion
    // markers alone cap at 'possible'; 'notable'/'strong' require a core AND convergence.
    const aF=[]; let aScore=0; const addA=(w,t)=>{aScore+=w;aF.push(t);};
    const venusRahu = link("Venus","Rahu");
    const seventhIn12 = H(hLord)===12;
    const venusIn12mal = H("Venus")===12 && (venusRahu || link("Venus","Mars") || link("Venus","Saturn"));
    const rahuIn7venus = H("Rahu")===7 && venusRahu;
    const coreAffair = venusRahu || seventhIn12 || venusIn12mal || rahuIn7venus;
    if(venusRahu) addA(2,"Venus (desire) linked with Rahu (excess, the unconventional) — the classic over-reach-of-desire signature");
    if(seventhIn12) addA(2,"the 7th lord "+hLord+" sits in the 12th (the bed and private/secret pleasures)");
    if(venusIn12mal) addA(2,"Venus in the 12th under a malefic link (private/secret indulgence)");
    if(rahuIn7venus) addA(1,"Rahu in the 7th tied to Venus");
    if(link("Venus","Mars")) addA(1,"Venus linked with Mars — strong physical passion seeking outlet");
    if(link("Moon","Rahu")) addA(1,"Moon with Rahu — emotional restlessness drawn to the novel");
    if(twelfthLord && H(twelfthLord)===7) addA(1,"the 12th lord "+twelfthLord+" sits in the 7th — private-pleasure themes tied into partnership");
    const aLevel = (coreAffair && aScore>=5)?"strong" : (coreAffair && aScore>=3)?"notable" : aScore>=1?"possible":"none";

    // ── Separation / divorce risk ──
    const sF=[]; let sScore=0; const addS=(w,t)=>{sScore+=w;sF.push(t);};
    if(H("Ketu")===7) addS(2,"Ketu in the 7th — a detaching, severing signature in the house of union");
    if((H("Mars")===7||asp("Mars",hLord==="Mars"?"Venus":hLord)) && (H("Saturn")===7||asp("Saturn","Venus"))) addS(1,"Mars and Saturn both pressuring the partnership axis (rupture-and-coldness)");
    if(sixthLord && H(sixthLord)===7) addS(2,"the 6th lord (separation/dispute) "+sixthLord+" sits in the 7th");
    if(H(hLord)===6) addS(2,"the 7th lord "+hLord+" sits in the 6th (the house of divorce and discord)");
    if(d1P[hLord]&&d1P[hLord].dignity==="Debilitated"&&[6,8,12].includes(H(hLord))) addS(1,"the 7th lord "+hLord+" is debilitated in a dusthana");
    if(marAff && marAff.factors && marAff.factors.some(f=>/navamsha.*7th house holds/.test(f))) addS(1,"the navamsha 7th (the marriage varga) is itself afflicted");
    if(H("Rahu")===1&&H("Ketu")===7 || H("Rahu")===7&&H("Ketu")===1) addS(1,"the Rahu–Ketu axis falls across the 1st/7th (self vs partner karmic axis)");
    const sLevel = sScore>=5?"strong":sScore>=3?"notable":sScore>=1?"possible":"none";

    return { affairRisk:{ level:aLevel, score:aScore, factors:aF },
             separationRisk:{ level:sLevel, score:sScore, factors:sF } };
  }catch(_){ return null; }
}

// ── OWNER-ONLY sensitive indications for the NON-marriage domains ────────────────
// Same purpose as the marriage one: the blunt, graded reads a professional needs for a
// consultation but a client report must not volunteer. Each risk is graded none/possible/
// notable/strong by CONVERGENCE (a lone marker never pinpoints). Owner-only; stripped from the
// client packet. RESPONSIBLE BOUNDARIES: never a death/longevity timing, never self-harm —
// those are neither sound from a chart nor safe to assert; health risks are framed as
// vulnerabilities and tendencies "to watch", always probabilities, never diagnoses or verdicts.
function buildOwnerSensitive(domainKey, d1P, d1LagnaSign, d9Houses, hLord, karakaPlanet, occupants){
  try{
    const MAL=["Saturn","Mars","Rahu","Ketu"];
    const H=(p)=>d1P[p]&&d1P[p].house;
    const dig=(p)=>d1P[p]&&d1P[p].dignity;
    const inDus=(p)=>[6,8,12].includes(H(p));
    const debil=(p)=>dig(p)==="Debilitated";
    // Structural weakness ONLY (debilitated or in a dusthana) — NOT "under some malefic aspect",
    // which is near-universal and was the over-firing cause. Malefic ASPECT counts only as a
    // CLUSTER (two or more heavy malefics on the house), a genuine convergence.
    const weak=(p)=> !!(debil(p)||inDus(p));
    const malIn=(h)=>Object.keys(d1P).filter(p=>MAL.includes(p)&&H(p)===h);
    const aspCluster=(h)=>MAL.filter(p=>{ const ph=H(p); return ph&&ph!==h&&aspectsHouse(p,ph,h); });
    const conj=(a,b)=>H(a)&&H(b)&&H(a)===H(b);                 // same house (the strong, rarer link)
    const conjMal=(p)=>H(p)&&MAL.some(m=>m!==p&&H(m)===H(p));  // significator joined by a heavy malefic
    const lord=(h)=>houseLord(d1LagnaSign,h);
    // CONVERGENCE bands: a single core significator weak reads only 'possible'; 'notable' needs a
    // genuine convergence (two cores, or a core plus supporting pressure); 'strong' a full stack.
    const grade=(s)=> s>=6?"strong":s>=4?"notable":s>=1?"possible":"none";
    const risk=(F)=>{ const f=F.filter(Boolean); const s=f.reduce((a,x)=>a+x[0],0); return { level:grade(s), score:s, factors:f.map(x=>x[1]) }; };
    const L=lord, out={};
    const coreWeak=(p,label)=> (p&&weak(p)) && [2, label+" "+p+" is "+(debil(p)?"debilitated":"in a dusthana (6/8/12)")];
    const occ=(h,label)=> (malIn(h).length>0) && [1,"the malefic(s) "+malIn(h).join(", ")+" sit in "+label];
    const cluster=(h,label)=> (aspCluster(h).length>=2) && [1, aspCluster(h).join(" and ")+" both aspect "+label];

    if(domainKey==="career"){
      const l10=L(10);
      out.setbackRisk = risk([
        coreWeak(l10,"the 10th lord"),
        occ(10,"the 10th (career) house"),
        cluster(10,"the 10th house"),
        (L(8)&&l10&&conj(l10,L(8)))&&[1,"the 10th lord "+l10+" sits with the 8th lord (sudden reversals)"],
      ]);
      out.reputationRisk = risk([
        (H("Rahu")===10||H("Ketu")===10)&&[2,"a node ("+(H("Rahu")===10?"Rahu":"Ketu")+") sits in the 10th — reputation can swing or be clouded"],
        (l10&&conj(l10,"Rahu"))&&[2,"the 10th lord "+l10+" is conjoined Rahu (image/perception volatility)"],
        (L(6)&&H(L(6))===10)&&[1,"the 6th lord (disputes/litigation) "+L(6)+" sits in the 10th"],
      ]);
    } else if(domainKey==="health"){
      const lagL=L(1);
      out.chronicVulnerability = risk([
        coreWeak(lagL,"the Ascendant lord (vitality)"),
        coreWeak("Moon","the Moon (constitution)"),
        (conjMal("Moon"))&&[1,"the Moon (constitution) is joined by a malefic"],
        occ(1,"the Ascendant"),
        cluster(1,"the Ascendant"),
      ]);
      out.mentalStrain = risk([   // "to watch", never a diagnosis
        coreWeak("Moon","the Moon (mind/emotion)"),
        (conj("Moon","Rahu")||conj("Moon","Ketu"))&&[2,"the Moon is conjoined a node (restlessness, disturbed sleep or anxiety to watch)"],
        (conj("Moon","Saturn"))&&[1,"the Moon sits with Saturn (a tendency to low mood to watch)"],
        (conjMal("Moon")&&!conj("Moon","Rahu")&&!conj("Moon","Ketu")&&!conj("Moon","Saturn"))&&[1,"the Moon is joined by a malefic (Mars — agitation to watch)"],
        (weak("Mercury"))&&[1,"Mercury (nervous system) is weak"],
      ]);
      out.addictionTendency = risk([  // susceptibility to escapism/substance — "to watch"
        (conj("Rahu","Moon")||conj("Rahu","Venus"))&&[2,"Rahu sits with the Moon or Venus (a pull toward excess or escape to watch)"],
        (H("Venus")===12&&conj("Venus","Rahu"))&&[2,"Venus with Rahu in the 12th (indulgence/escape)"],
        occ(12,"the 12th (indulgence and loss)"),
      ]);
    } else if(domainKey==="self"){
      const lagL=L(1);
      out.selfUndoingPattern = risk([
        coreWeak(lagL,"the Ascendant lord"),
        coreWeak("Moon","the Moon (self-image/emotion)"),
        (conjMal("Moon"))&&[1,"the Moon (self-image) is joined by a malefic"],
        (H("Ketu")===1)&&[1,"Ketu on the Ascendant (a sense of self that can feel unanchored)"],
        occ(1,"the Ascendant"),
      ]);
    } else if(domainKey==="children"){
      const l5=L(5);
      out.progenyDifficulty = risk([   // fertility is sensitive — probability, consult a doctor
        coreWeak(l5,"the 5th lord"),
        coreWeak("Jupiter","Jupiter (the significator of progeny)"),
        (conjMal("Jupiter"))&&[1,"Jupiter (progeny significator) is joined by a malefic"],
        occ(5,"the 5th house of children"),
        cluster(5,"the 5th house"),
      ]);
    } else if(domainKey==="mother"){
      const l4=L(4);
      out.motherConcern = risk([   // strain / health-vigilance, NEVER a loss prediction
        coreWeak(l4,"the 4th lord"),
        coreWeak("Moon","the Moon (the significator of the mother)"),
        (conjMal("Moon"))&&[1,"the Moon (mother significator) is joined by a malefic"],
        occ(4,"the 4th (home/mother)"),
        cluster(4,"the 4th house"),
      ]);
    } else if(domainKey==="siblings"){
      const l3=L(3);
      out.siblingStrain = risk([
        coreWeak(l3,"the 3rd lord"),
        coreWeak("Mars","Mars (the significator of siblings/courage)"),
        (conjMal("Mars"))&&[1,"Mars (sibling significator) is joined by another malefic"],
        occ(3,"the 3rd house of siblings"),
        cluster(3,"the 3rd house"),
      ]);
    } else return null;

    // keep only signals that actually have something to say
    const any = Object.values(out).some(r=>r && r.level!=="none");
    return any ? out : out;   // return even all-'none' so the writer can give a clean all-clear
  }catch(_){ return null; }
}

// Does the chart lean toward business/enterprise, and if so solo (proprietorship) or
// partnership? Grounded in the enterprise houses — 3rd (self-effort/initiative), 7th
// (business dealings & partnership), 11th (gains), plus Mercury (commerce karaka) and
// Sun/Mars (independent drive). The 7th's condition decides partnership vs solo. The
// report ALWAYS carries a line — a positive lean with specifics, or a plain "not strongly
// business-leaning" — so the reader is never left wondering.
function buildBusinessLean(d1P, d1LagnaSign, amatyakaraka, compound){
  try{
    const L=(h)=>houseLord(d1LagnaSign,h);
    const occ=(h)=>occupantsOfHouse(d1P,h);
    const benefic=new Set(["Jupiter","Venus","Mercury","Moon"]);
    const nbFull=(p)=> !!((compound&&compound.neechaBhanga||[]).some(nb=>nb.planet===p && nb.level==="full"));
    const strong=(p)=> d1P[p] && (d1P[p].dignity==="Exalted"||d1P[p].dignity==="Own sign"||(d1P[p].dignity==="Debilitated"&&nbFull(p)));
    const weakOrDus=(p)=> d1P[p] && ((d1P[p].dignity==="Debilitated"&&!nbFull(p))||[6,8,12].includes(d1P[p].house));
    const wellPlaced=(p)=> d1P[p] && [1,2,4,5,7,9,10,11].includes(d1P[p].house) && !weakOrDus(p);
    const inHouse=(p,hs)=> d1P[p] && hs.includes(d1P[p].house);

    // COMMERCE support — the enterprise houses (3 self-effort, 7 trade/vyapara, 11 gains)
    // plus Mercury (commerce karaka).
    let commerce=0; const commerceWhy=[];
    if(strong("Mercury")||(inHouse("Mercury",[1,2,7,10,11])&&!weakOrDus("Mercury"))){ commerce+=2; commerceWhy.push("Mercury (commerce) well placed"); }
    else if(weakOrDus("Mercury")){ commerce-=1; commerceWhy.push("Mercury (commerce) under pressure"); }
    { const l7=L(7); if(l7&&wellPlaced(l7)){ commerce+=1; commerceWhy.push("7th lord "+l7+" (trade) well placed in the "+ordinalD(d1P[l7].house)); } }
    for(const h of [3,11]){ const l=L(h); if(l&&wellPlaced(l)){ commerce+=1; commerceWhy.push(ordinalD(h)+"-lord "+l+" well placed in the "+ordinalD(d1P[l].house)); } }
    for(const h of [3,7,11]){ if(occ(h).some(p=>benefic.has(p))){ commerce+=1; commerceWhy.push("benefic in "+ordinalD(h)); } }

    // TRADE / COMMODITY signature — the classical merchant markers a narrow "10th-lord only"
    // read misses: a strong 8th (bulk / wholesale / stored value), a node in the 7th
    // (marketplace volume, the 10th-from-10th), and the career karaka (Amatyakaraka) driving
    // a wealth/trade house. Counted separately so it can lift the grade on its OWN — a strong
    // merchant chart must not be suppressed for lacking generic "autonomy" markers.
    let tradeScore=0; const tradeWhy=[];
    { const l8=L(8);
      const eighthStrong = (l8 && strong(l8) && inHouse(l8,[8])) || occ(8).some(p=>strong(p));
      if(eighthStrong){ tradeScore++; commerce+=2; tradeWhy.push("a strong 8th-house placement — the classical signature of bulk / commodity / wholesale / stored-value trade"); } }
    if(inHouse("Rahu",[7])){ tradeScore++; commerce+=1; tradeWhy.push("a shadow planet in the house of trade (the marketplace — the 10th-from-10th) — high-volume or large-scale dealing"); }
    if(amatyakaraka && strong(amatyakaraka) && inHouse(amatyakaraka,[2,7,8,10,11])){ tradeScore++; commerce+=1; tradeWhy.push("the career indicator (Amatyakaraka) is strong in a wealth/trade house — a genuine commercial driver"); }
    commerceWhy.push(...tradeWhy);

    // AUTONOMY / independent drive — strong Sun/Mars, a self-directed career ruler, a
    // GENUINELY ACTIVATED 3rd of self-effort, and a shadow planet on the Ascendant (a
    // self-made, institution-independent streak). FIX: the 3rd credits autonomy only when the
    // 3rd is actually engaged — NOT merely because its lord is strong for an unrelated reason
    // elsewhere (the "strong 3rd lord" miscredit that over-stated an empty, unengaged 3rd).
    let autonomy=0; const autonomyWhy=[];
    if(strong("Sun")){ autonomy+=1; autonomyWhy.push("strong Sun — authority and self-reliance"); }
    if(strong("Mars")){ autonomy+=1; autonomyWhy.push("strong Mars — initiative and drive"); }
    { const l10=L(10); if(l10&&strong(l10)){ autonomy+=1; autonomyWhy.push("self-directed career ruler ("+l10+", the 10th lord, strong)"); }
      else if(l10&&inHouse(l10,[1,10])){ autonomy+=1; autonomyWhy.push("career ruler "+l10+" (10th lord) in an angle of self"); } }
    { const l3=L(3);
      const thirdActivated = occ(3).some(p=>strong(p)) || (l3 && strong(l3) && inHouse(l3,[1,3,10,11]));
      if(thirdActivated){ autonomy+=1; autonomyWhy.push("the 3rd house of self-effort is genuinely activated (enterprise drive)"); } }
    if(occ(1).some(p=>["Rahu","Ketu"].includes(p))){ autonomy+=1; autonomyWhy.push("a shadow planet on the Ascendant — a self-made, institution-independent streak"); }
    if((strong("Sun")||strong("Mars")) && (inHouse("Sun",[1,4,7,10])||inHouse("Mars",[1,4,7,10]))){ autonomy+=1; autonomyWhy.push("independent drive in an angle"); }

    // GRADE — an enterprise lean needs commerce support AND independence; BUT a strong,
    // multi-marker TRADE signature establishes a genuine merchant lean on its own, with
    // autonomy only deciding how solo-vs-structured it runs.
    // Thresholds tuned on a random population so a STRONG own-business lean stays a
    // meaningful minority (not a third of everyone). The genuine, multi-marker TRADE
    // signature (strongTrade) earns "strong" on its own with only light autonomy — that is
    // the rare merchant chart the old narrow read suppressed.
    let grade, statement; const strongTrade = tradeScore>=2;
    if((commerce>=5 && autonomy>=2) || (strongTrade && autonomy>=1)){
      grade="strong";
      statement = strongTrade
        ? "The chart genuinely supports running your own enterprise — a strong commercial and trade signature (the kind seen in commodity, wholesale and stored-value dealing) together with real independent drive."
        : "The chart genuinely leans toward running your own enterprise — both commerce support and real independent drive are present.";
    }
    else if((commerce>=4 && autonomy>=2) || (commerce>=3 && autonomy>=1 && tradeScore>=1) || strongTrade){
      grade="moderate";
      statement = strongTrade
        ? "A business of your own is genuinely supported — there is a real commercial and trade signature in the chart; weigh how independently you run it, since the self-direction markers are present without being dominant."
        : "A business of your own is workable and supported — but weigh it alongside employment rather than treating it as the obvious default; the independent-drive signals are present without being dominant.";
    }
    else if(commerce>=4 || (commerce>=3 && autonomy>=1)){ grade="mild"; statement="You are well-suited to commercial, business-facing work — but the chart supports this more within a structured role or organisation than as a solo independent venture, since the independent-drive markers are mild. Business is an option to weigh, not a clear calling."; }
    else { grade="none"; statement="The chart does not strongly lean toward independent business; a professional role or steady employment is the more natural fit, with any business kept measured and well-advised."; }
    const leans = (grade==="strong"||grade==="moderate");

    // partnership vs proprietorship, from the 7th
    const sOcc=occ(7); const s7lord=L(7);
    const sevAfflicted = sOcc.some(p=>["Ketu","Rahu","Saturn","Mars"].includes(p)) || weakOrDus(s7lord);
    const sevBenefic   = sOcc.some(p=>benefic.has(p)) || (s7lord&&wellPlaced(s7lord));
    let mode, modeNote;
    if(sevAfflicted && !sevBenefic){ mode="proprietorship"; modeNote="the partnership house carries caution — a shadow planet or heavy weight sits there — so a solo or proprietor route tends to suit you better than an equal partnership; vet any partner carefully and keep roles, money and exit terms clear from the start."; }
    else if(sevBenefic && !sevAfflicted){ mode="partnership"; modeNote="the partnership house is supported, so a well-chosen business partnership can genuinely work in your favour."; }
    else { mode="either"; modeNote="partnership and solo routes are both workable — let the specific people and terms decide, not a chart preference."; }

    return { grade, leans, statement, score:commerce+autonomy, commerce, autonomy, tradeScore, tradeWhy, commerceWhy, autonomyWhy, mode, modeNote,
      reconcileNote:"Hold this together with your Role Fit: a business lean does not override the relational, delivery-through-people signature — for many charts it means leading or owning a people-centred enterprise, not working in isolation.",
      fields: leans ? "commerce or running your own enterprise, ideally within the fields your Sector Fit points to above" : null,
      timingNote: "weigh any business move in the periods the Timing section marks as supportive — a steady, well-supported stretch, not a restless or testing one (and not a Rahu phase, where enterprise can look more promising than it proves).",
      caution: (weakOrDus("Mercury")||sevAfflicted) ? "keep finances conservative, avoid over-leverage and hasty expansion, and put every agreement in writing." : "ordinary commercial prudence is enough.",
      why: commerceWhy.concat(autonomyWhy) };
  }catch(_){ return null; }
}

// ── Foreign-land career (earning abroad vs. settling with permanency) ────────────────
// General law, read from several angles: the 12th (distant lands / residence abroad) and
// 9th (long journeys, fortune far away), the 7th (away from birthplace), Rahu as the foreign
// karaka, the 4th as the PULL FROM HOME (a loosened 4th favours settling away), and the
// career/earning houses' CONNECTION to the foreign houses (earning abroad vs. mere travel).
// Permanency is the 4th–12th relationship. Graded, conservative — a tendency, never a promise
// of a visa or a country.
function buildForeignCareer(d1P, d1LagnaSign, compound){
  try{
    const L=(h)=>houseLord(d1LagnaSign,h);
    const occ=(h)=>occupantsOfHouse(d1P,h);
    const nbFull=(p)=> !!((compound&&compound.neechaBhanga||[]).some(nb=>nb.planet===p&&nb.level==="full"));
    const strong=(p)=> d1P[p]&&(d1P[p].dignity==="Exalted"||d1P[p].dignity==="Own sign"||(d1P[p].dignity==="Debilitated"&&nbFull(p)));
    const weakOrDus=(p)=> d1P[p]&&((d1P[p].dignity==="Debilitated"&&!nbFull(p))||[6,8,12].includes(d1P[p].house));
    const wellPlaced=(p)=> d1P[p]&&[1,2,4,5,7,9,10,11].includes(d1P[p].house)&&!weakOrDus(p);
    const inHouse=(p,hs)=> d1P[p]&&hs.includes(d1P[p].house);
    const hOf=(p)=> d1P[p]&&d1P[p].house;
    const l12=L(12), l9=L(9), l4=L(4), l10=L(10), l2=L(2);
    // CORE markers — each is a SPECIFIC foreign signal, not a common placement. Foreign
    // settlement is a minority signature, so the bar is genuine 12th/9th emphasis, not a
    // career-lord merely brushing the 9th (which is also domestic fortune/dharma).
    let core=0; const why=[]; let earning=false, settling=false;
    // 1. Rahu (foreign karaka) in the 12th — the sharpest single foreign signal
    if(inHouse("Rahu",[12])){ core++; why.push("the foreign significator sits in the house of distant lands (12th) — a strong pull abroad"); }
    // 2. travel-house link — 12th lord in the 9th, or 9th lord in the 12th. This is a one-way
    // dispositor LINK (the ruler of one sits in the other), NOT a mutual sign exchange
    // (parivartana) — so it must never be called an "exchange".
    if((l12&&inHouse(l12,[9])) || (l9&&inHouse(l9,[12]))){ core++;
      const dir = (l12&&inHouse(l12,[9])) ? ("the ruler of distant lands ("+l12+") sits in your 9th of long journeys") : ("the ruler of long journeys ("+l9+") sits in your 12th of distant lands");
      why.push(dir+" — the foreign-and-journeys axis is connected, so foreign ground recurs in the life"); }
    // 3. career abroad — the 10th lord in the 12th or 9th
    if(l10&&inHouse(l10,[12,9])){ core++; earning=true; why.push("the career ruler "+l10+" (10th lord) sits in your "+ordinalD(hOf(l10))+" — a foreign house — so work and standing can genuinely come from abroad or foreign-facing dealing"); }
    // 4. roots uprooted to foreign — the 4th lord carried into the 12th
    if(l4&&inHouse(l4,[12])){ core++; settling=true; why.push("the ruler of home and roots, "+l4+" (4th lord), is carried into your "+ordinalD(hOf(l4))+" — the house of distant lands — so the base of life can shift away from the birthplace"); }
    // 5. a genuine foreign cluster — two or more planets tenanting the 12th
    if(occ(12).length>=2){ core++; why.push("a cluster of planets in the house of distant lands — foreign settings are a recurring theme"); }

    // earning-abroad refinement: the wealth ruler (2nd) on a foreign house also counts
    if(l2&&inHouse(l2,[12,9])){ earning=true; if(!why.some(w=>w.includes("career ruler"))) why.push("the wealth ruler connects to a foreign house — income can flow from abroad or foreign-facing work"); }
    // permanency refinement: 12th lord strong and angular supports a lasting base
    if(l12&&strong(l12)&&[1,4,7,10].includes(hOf(l12))){ settling=true; }

    let grade, statement;
    if(core>=3){ grade="strong"; statement="The chart genuinely supports a career or livelihood connected to foreign lands"+(settling?", with real potential to settle there for the long term":"")+"."; }
    else if(core===2){ grade="moderate"; statement="There is real support for foreign-connected work or spells abroad — worth pursuing, though "+(settling?"how permanently you settle is less certain":"it tends toward periods abroad rather than a permanent base")+"."; }
    else if(core===1){ grade="mild"; statement="A foreign connection is possible — through travel, foreign-facing dealings or spells away — but it is a secondary thread, not a central one."; }
    else { grade="none"; statement="The chart does not particularly point abroad; the path is better rooted in your own region, with any foreign dealings kept opportunistic."; }

    // REMOTE-ONLY template: an exalted/own-sign planet in the 12th supports cross-border /
    // remote / export work from a home base even when the 10th lord has NO 9th/12th link (so
    // no relocation). Fills the V5 blind spot where the section was hard-suppressed.
    const strongIn12 = occ(12).find(p=>strong(p));
    const remoteOnly = (grade==="none"||grade==="mild") && !!strongIn12;
    const remoteNote = remoteOnly ? (strongIn12+" sits strong in your 12th house — so while permanent relocation abroad is not indicated, cross-border consulting, remote or overseas clients, and export-linked work from your home base are genuinely supported") : null;
    return { grade, score:core, earning, settling, statement, remoteOnly, remoteNote, why };
  }catch(_){ return null; }
}

// ── Money & Income pattern (career sub-reading) ──────────────────────────────────────
// Closes the wealth/cash-flow blind spot: reads the 2nd (accumulated wealth) and 11th
// (gains/income) houses and their lords through the house-states, names HOW income flows best
// (steady service/retainers, structured trade margins, network gains) and whether speculation
// is supported — grounded in the chart (a debilitated wealth-ruler warns against speculation),
// and compound-aware (a cancelled debilitation reads as resilient discipline, not plain fail).
function buildMoneyFlow(d1P, d1LagnaSign, compound, houseStates){
  try{
    const L=(h)=>houseLord(d1LagnaSign,h);
    const occ=(h)=>occupantsOfHouse(d1P,h);
    const nbFull=(p)=>!!((compound&&compound.neechaBhanga||[]).some(nb=>nb.planet===p&&nb.level==="full"));
    const digOf=(p)=>d1P[p]&&d1P[p].dignity;
    const hOf=(p)=>d1P[p]&&d1P[p].house;
    const signOf=(p)=>d1P[p]&&d1P[p].sign;
    const strong=(p)=>d1P[p]&&(digOf(p)==="Exalted"||digOf(p)==="Own sign"||(digOf(p)==="Debilitated"&&nbFull(p)));
    const debilNoNB=(p)=>!!(d1P[p]&&digOf(p)==="Debilitated"&&!nbFull(p));
    const hs=(h)=>houseStates&&houseStates[h];
    const l2=L(2), l11=L(11), l5=L(5), l8=L(8);
    const why=[];
    const accumulation = hs(2)?hs(2).grade:null;
    const gains = hs(11)?hs(11).grade:null;
    if(l2&&hOf(l2)) why.push("your house of savings (2nd) is ruled by "+l2+", placed in the "+ordinalD(hOf(l2))+" ("+signOf(l2)+")");
    if(l11&&hOf(l11)) why.push("your house of income and gains (11th) is ruled by "+l11+", placed in the "+ordinalD(hOf(l11))+" ("+signOf(l11)+")");

    // income MODE(s)
    const modes=[];
    if([l2,l11].some(l=>l&&hOf(l)===6) || (hOf("Saturn")&&[2,11].includes(hOf("Saturn"))) || [l2,l11].includes("Saturn")) modes.push("steady service or structured, salaried/retainer income");
    if(occ(8).some(p=>strong(p)) || (l8&&strong(l8)&&hOf(l8)===8)) modes.push("structured trade margins (bulk, commodity or stored-value dealing)");
    if(gains==="strong"||gains==="supported") modes.push("gains that build steadily through networks and repeat clients");
    if(!modes.length) modes.push("steady, earned income rather than windfalls");

    // speculation read
    let speculation, specWhy;
    if(l2&&digOf(l2)==="Debilitated"&&nbFull(l2)){ speculation="disciplined"; specWhy="your savings-ruler "+l2+" is debilitated but cancelled — early money pressure gives way to resilient wealth built by discipline, not speculation"; }
    else if(debilNoNB(l2)||debilNoNB(l5)||debilNoNB("Jupiter")){ speculation="avoid"; specWhy=(debilNoNB(l2)?("your savings-ruler "+l2+" is debilitated"):debilNoNB(l5)?("your speculation-ruler "+l5+" is debilitated"):"the wealth significator Jupiter is debilitated")+" — speculative bets tend to misfire"; }
    else if(hs(5)&&hs(5).grade==="strong"){ speculation="cautious-ok"; specWhy="your house of speculation (5th) is well supported — measured, informed risks can pay, but keep them a minority of your capital"; }
    else speculation="measured";
    if(specWhy) why.push(specWhy);

    // dhana (wealth-forming) link between savings and income rulers
    let dhana=false;
    if(l2&&l11&&(hOf(l2)===hOf(l11) || (hOf(l2)===11&&hOf(l11)===2))){ dhana=true; why.push("the rulers of savings and income connect — a wealth-forming link"); }

    const specLine = speculation==="avoid" ? "Speculative, high-risk bets tend to misfire for this chart — keep capital in steady, disciplined channels."
      : speculation==="disciplined" ? "Wealth here is built by discipline and patience, not speculation — early money pressure resolves into resilient, accumulated value."
      : speculation==="cautious-ok" ? "Measured, well-informed risks can work, but should stay a small share of your capital."
      : "Steady accumulation suits this chart better than chasing windfalls.";
    const statement = "Your income flows best through "+modes.join(", and ")+". "+specLine;
    return { accumulation, gains, modes, speculation, dhana, statement, why };
  }catch(_){ return null; }
}

// ── Future Compass (all domains) ───────────────────────────────────────────────
// The engine produces many AD sub-windows (dashaTiming.keyWindows). The owner rule:
// the BACKEND keeps that full detail, but the REPORT consolidates to the 2-3 strongest
// upcoming bands — each weighted, named by nature (supportive / testing / mixed), with
// the PRECURSOR condition (what effort or circumstance it asks for) stated, plus a
// single "relief from ongoing stress" window that applies to every domain. No new
// ephemeris: this is pure consolidation over the dasha windows already computed.
const FC_BENEFIC = new Set(["Jupiter","Venus","Mercury","Moon"]);
const FC_MALEFIC = new Set(["Saturn","Mars","Rahu","Ketu","Sun"]);
function fcStartYr(y){ const m=String(y||"").match(/(\d{4})/); return m?parseInt(m[1],10):null; }
function fcEndYr(y){ const m=String(y||"").match(/(\d{4})\s*$/); return m?parseInt(m[1],10):null; }
function buildFutureCompass(dashaTiming, domainKey, cfg, karakaPlanet, hLord, d1P, occupants){
  if(!dashaTiming) return null;
  const nowYr = new Date().getFullYear();
  const occPlanets = new Set((occupants||[]).map(o=>o.planet));
  // Candidate pool: prefer the FULL forward-AD sequence (current MD onward) so the compass
  // never collapses for older natives whose domain-karaka periods are exhausted. Fall back
  // to the domain-filtered keyWindows only if the forward pool is unavailable.
  const pool = (Array.isArray(dashaTiming.forwardADs) && dashaTiming.forwardADs.length)
    ? dashaTiming.forwardADs
    : (Array.isArray(dashaTiming.keyWindows) ? dashaTiming.keyWindows : []);
  if(!pool.length) return null;
  const forwardWindows = pool.filter(w=>{ const ey=fcEndYr(w.years); return ey==null || ey>=nowYr; });
  if(!forwardWindows.length) return null;
  // Score every window.
  const scored = forwardWindows.map(w=>{
    const lord=w.ad; const pp=d1P[lord]||{};
    let score=0; const roles=[];
    if(lord===karakaPlanet){ score+=3; roles.push("significator"); }
    if(lord===hLord){ score+=3; roles.push(lord+" ("+ordinalD(cfg.house)+"-lord)"); }
    if(occPlanets.has(lord)){ score+=2; roles.push("domain-house planet"); }
    if(!roles.length) score+=1;
    if(pp.dignity==="Exalted"||pp.dignity==="Own sign") score+=2;
    else if(pp.dignity==="Debilitated") score-=1;
    else if(pp.dignity==="Combust") score-=1;
    if(FC_BENEFIC.has(lord)) score+=1;
    const sy=fcStartYr(w.years), ey=fcEndYr(w.years)||sy;
    if(sy!=null){ const d=sy-nowYr; if(d<=5) score+=2; else if(d<=10) score+=1; }
    const beneficIsh = FC_BENEFIC.has(lord) && pp.dignity!=="Debilitated" && pp.dignity!=="Combust";
    const testingIsh = FC_MALEFIC.has(lord) || pp.dignity==="Debilitated" || [6,8,12].includes(pp.house);
    const nature = (beneficIsh && !testingIsh) ? "supportive" : (testingIsh && !beneficIsh) ? "testing" : "mixed";
    return { w, lord, score, roles, sy, ey, nature, upcoming:!!w.upcoming };
  });
  // Consolidate: sort by score (then soonest), greedily pick up to 3 non-overlapping bands.
  const ranked=[...scored].sort((a,b)=> (b.score-a.score) || ((a.sy||9999)-(b.sy||9999)));
  const picks=[]; const overlaps=(a,b)=> a.sy!=null&&b.sy!=null && !(a.ey<b.sy || b.ey<a.sy);
  for(const s of ranked){ if(picks.length>=3) break; if(picks.some(p=>overlaps(p,s))) continue; picks.push(s); }
  picks.sort((a,b)=>(a.sy||9999)-(b.sy||9999));  // chronological for reading
  const isMarriage = domainKey==="marriage", isCareer = domainKey==="career";
  const themeFor=(nature)=>{
    if(isMarriage) return nature==="supportive" ? "a genuine opening for partnership — a meeting, a commitment, or a decisive step forward"
                        : nature==="testing" ? "a period that tests or reshapes the partnership, maturing the bond through patience"
                        : "an active, mixed window for partnership — real movement, with conscious effort required";
    if(isCareer)   return nature==="supportive" ? "a doorway in your working life — a rise, a move, or a chance to step up"
                        : nature==="testing" ? "a demanding stretch in work — obstacles, transitions or disruption that reshape the path"
                        : "a mixed but active career window — progress alongside real challenges";
    return nature==="supportive" ? ("a supportive, opening window for "+cfg.focus)
         : nature==="testing" ? ("a testing, consolidating window for "+cfg.focus)
         : ("an active, mixed window for "+cfg.focus);
  };
  const precursorFor=(nature)=>{
    if(nature==="supportive") return "It opens most fully when you are ready to meet it — prepared, available, and willing to act when the moment comes.";
    if(nature==="testing")    return "It rewards patience and steady effort — not forcing the timeline, keeping commitments honest, and meeting friction with maturity rather than reaction.";
    return "It mixes opening and testing — prepare the ground with real effort, then let timing do its part.";
  };
  const bands = picks.map(p=>{
    // co-occurring drivers: other scored windows that overlap this band
    const drivers = [...new Set(scored.filter(s=>overlaps(s,p)).map(s=>s.lord))];
    return { years:p.w.years, nature:p.nature, roles:p.roles, drivers, theme:themeFor(p.nature), precursor:precursorFor(p.nature) };
  });
  // Relief window — nearest UPCOMING supportive band (applies to every domain).
  const reliefCand = scored.filter(s=>s.nature==="supportive" && s.sy!=null && s.sy>=nowYr).sort((a,b)=>a.sy-b.sy)[0];
  const relief = reliefCand ? { years:reliefCand.w.years, driver:reliefCand.lord,
    note:"A lifting of pressure and a more supportive stretch — the point where ongoing strain in this area tends to ease." } : null;
  if(!bands.length && !relief) return null;
  return { bands, relief, horizonNote:("Read to "+(nowYr+20)+" (a 20-year horizon).") };
}

// ── Generic per-domain depth ("domain compass") ─────────────────────────────────
// Career has its own bespoke compass (businessLean / foreign / money / disruptions …).
// EVERY OTHER domain was running on the older isolated-placement + timing layer while the
// chart-wide compound states (Raja Yogas, Neecha Bhanga, nakshatra, badhaka, combustion,
// retrograde) and the multi-angle house-states were computed but never surfaced to it.
// This builder gives each of those domains the SAME depth, generically: it reads the
// domain's own house from multiple angles and pulls out only the compound factors that
// genuinely TOUCH the domain (its lord, its karaka, its occupants, or its own house), so
// nothing fires unless it is chart-true for THIS area. It is a general Vedic law applied
// by domain parameters — no chart is special-cased.
function buildPlanetDepth(planet, roleDesc, d1P){
  if(!planet || !d1P || !d1P[planet]) return null;
  const pl = d1P[planet];
  const dig = pl.dignity || "neutral";
  const rel = pl.signRelation || null;
  const digPhrase = (dig && dig!=="neutral") ? " ("+dig.toLowerCase()+")"
                  : (rel && rel!=="neutral" && rel!=="own") ? " (in a "+rel+"'s sign)" : "";
  // role NAMES the planet (so no renderer can surface a bare "ruler of …"); reading uses the
  // plain descriptor since it already opens with the planet.
  return { planet, role:planet+" — "+roleDesc, house:pl.house, sign:pl.sign, dignity:dig, signRelation:rel,
    reading: planet+" — "+roleDesc+" — sits in your "+ordinalD(pl.house)+" house in "+pl.sign+digPhrase+"." };
}
function buildDomainCompass(domainKey, cfg, hLord, karakaPlanet, d1P, d1LagnaSign, compound, houseStates){
  try{
    if(!compound) return null;
    const H = cfg.house;
    const rel = new Set([hLord, karakaPlanet].filter(Boolean));
    for(const [p,v] of Object.entries(d1P)){ if(v.house===H && p!=="Lagna") rel.add(p); }

    // 1. Multi-angle reading of the domain's OWN house, plus its Bhavat Bhavam derivative
    //    (the house-from-house — e.g. the 7th-from-7th = 1st for partnership's own strength).
    const houseState = (houseStates && houseStates[H]) || null;
    const derivHouse = ((2*H-2)%12)+1;
    const derivState = (derivHouse!==H && houseStates && houseStates[derivHouse]) ? houseStates[derivHouse] : null;

    // 2. The domain lord's and karaka's own compound condition (named, with dignity).
    const lordState   = buildPlanetDepth(hLord, "the ruler of your "+ordinalD(H)+" house of "+cfg.focus, d1P);
    const karakaState = karakaPlanet ? buildPlanetDepth(karakaPlanet, "the natural significator of "+cfg.focus, d1P) : null;

    // 3. Raja Yogas that TOUCH this domain (a yoga planet is the lord/karaka/occupant, or the
    //    yoga forms in this house) — so marriage surfaces a 7th-lord Raja Yoga, etc.
    const rajaYogas = (compound.rajaYogas||[]).filter(ry => (ry.planets||[]).some(p=>rel.has(p)) || ry.house===H);
    // 4. Named yogas (Gaja Kesari, Budhaditya) whose significator or seat touches the domain.
    const yogas = (compound.yogas||[]).filter(y => rel.has(y.from) || rel.has("Sun")&&y.name==="Budhaditya Yoga"&&(H===1||H===10) || y.house===H);
    // 5. Neecha Bhanga on a domain-relevant planet (graded; only if real).
    const neechaBhanga = (compound.neechaBhanga||[]).filter(nb => rel.has(nb.planet) && nb.level && nb.level!=="none");
    // 6. Nakshatra (star-lord) layer for the domain lord / karaka.
    const nakshatra = (compound.nakshatra||[]).filter(n => rel.has(n.planet));
    // 7. Combustion / retrograde of domain-relevant planets.
    const combustion = (compound.combustion||[]).filter(c => rel.has(c.planet));
    const retrograde = (compound.retroStrength||[]).filter(r => rel.has(r.planet));
    // 8. Badhaka when it falls on this domain's house OR its lord OR when the Badhakesh
    //    PLANET itself sits in the domain house (e.g. Venus, the 9th-lord Badhakesh for an
    //    Aquarius Lagna, sitting in the 7th — the V6 Native-4 miss).
    const badhaka = (compound.badhaka && (
        compound.badhaka.house===H ||
        compound.badhaka.planet===hLord ||
        (d1P[compound.badhaka.planet] && d1P[compound.badhaka.planet].house===H)
      )) ? compound.badhaka : null;

    const anything = houseState || derivState || lordState || karakaState || rajaYogas.length ||
      yogas.length || neechaBhanga.length || nakshatra.length || combustion.length || retrograde.length || badhaka;
    if(!anything) return null;
    return { house:H, focus:cfg.focus, lord:hLord, karaka:karakaPlanet, derivHouse,
      houseState, derivState, lordState, karakaState,
      rajaYogas, yogas, neechaBhanga, nakshatra, combustion, retrograde, badhaka };
  }catch(_){ return null; }
}
function buildDomainFacts(domainKey, d1Degrees, d1LagnaSign, d9Houses, d9LagnaSign, charaKarakas, dashas, birthDate, ascLon, retroMap, gender, maritalStatus){
  const cfg=DOMAIN_REPORT_CONFIG[domainKey]; if(!cfg) return null;
  const d1P=d1PlacementsFromDegrees(d1Degrees, d1LagnaSign, retroMap);
  if(!d1P) return null;
  // Layers 1–2: compound states + multi-angle house-states, computed once and consumed by
  // the domain builders below. General-law substrate (see ENGINE_DEPTH_DESIGN.md).
  const compound = buildCompoundStates(d1P, d1LagnaSign, d9Houses, d9LagnaSign);
  const houseStates = buildHouseStates(d1P, d1LagnaSign, compound);
  const hLord=houseLord(d1LagnaSign, cfg.house);
  const lordPlacement=hLord?d1P[hLord]:null;
  const occupants=Object.entries(d1P).filter(([p,v])=>v.house===cfg.house && p!=="Lagna").map(([p,v])=>({planet:p,...v}));
  const karakaPlanet=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role===cfg.karaka)||{}).planet:null;
  let vargaChart=null;
  if(cfg.varga && cfg.varga!=="D9"){ vargaChart=buildVargaChart(cfg.varga, d1Degrees, ascLon); }
  const convergences=[];
  if(vargaChart && lordPlacement && hLord){
    // Track the SAME planet (the D1 house-lord) across charts — NOT the varga's own different
    // lord. A genuine "repeated signal" is the SAME ruler landing in the same house in both.
    const hLordInVarga = vargaChart.placements && vargaChart.placements[hLord];
    if(hLordInVarga && hLordInVarga.house===lordPlacement.house){
      convergences.push(`In both your birth chart and your ${cfg.vargaLabel||cfg.varga} chart, ${hLord} — the ruler of your ${ordinalD(cfg.house)} house — sits in the ${ordinalD(lordPlacement.house)} house: the same signal repeated independently.`);
    }
  }
  if(karakaPlanet && d1P[karakaPlanet] && (d1P[karakaPlanet].dignity==="Exalted"||d1P[karakaPlanet].dignity==="Own sign")){
    convergences.push(`${karakaPlanet} (the ${cfg.karaka}) is strongly placed in D1 — a primary support for this domain.`);
  }

  // Deeper checks (added after validating against a real father/child case the
  // shallow version missed):
  // (a) D9 domain-lord in a dusthana (6/8/12) — a maturation-level CAUTION even
  //     when D1 looks fine. This is where a careful astrologer finds the caveat.
  // (b) The domain lord IS the Atmakaraka — the domain is soul-central, not
  //     peripheral; it carries extra weight in the life.
  let d9LordCaution=null;
  if(hLord && d9Houses && d9LagnaSign){
    // (i) the D1-lagna domain lord's position in D9
    let d9House=null;
    for(let h=1;h<=12;h++){ if((d9Houses[h]||[]).includes(hLord)){ d9House=h; break; } }
    if(d9House && [6,8,12].includes(d9House)){
      d9LordCaution=`In the D9 (the maturation chart), the ${ordinalD(cfg.house)}-lord ${hLord} sits in the ${ordinalD(d9House)} house — a house of testing. This adds a note of caution to this area as life matures, even where the birth chart looks settled.`;
    }
    // (ii) the D9 chart's OWN domain lord (from the D9 ascendant) — the technique a
    //      careful reader uses. If that lord sits in a D9 dusthana, it's a caution.
    if(!d9LordCaution){
      const d9DomLord = houseLord(d9LagnaSign, cfg.house);
      if(d9DomLord){
        let d9DomHouse=null;
        for(let h=1;h<=12;h++){ if((d9Houses[h]||[]).includes(d9DomLord)){ d9DomHouse=h; break; } }
        if(d9DomHouse && [6,8,12].includes(d9DomHouse)){
          d9LordCaution=`In the D9 (the maturation chart), its own ${ordinalD(cfg.house)}-lord ${d9DomLord} sits in the ${ordinalD(d9DomHouse)} house — a house of testing. This is the single most important caution in this reading: it asks you to hold this area with extra patience and care as life unfolds.`;
        }
      }
    }
    if(d9LordCaution) convergences.push(d9LordCaution);
  }
  const akPlanet=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role==="Atmakaraka")||{}).planet:null;
  const domainIsSoulCentral = akPlanet && hLord && akPlanet===hLord;
  if(domainIsSoulCentral){
    convergences.push(`The ${ordinalD(cfg.house)}-lord ${hLord} is also your Atmakaraka (soul significator) — so this area is not peripheral; it is one of the central channels through which your life's core work is lived out. Expect it to carry real weight.`);
  }

  const flags={};
  // Headline D1→D9 "shift" — when the domain's key planet changes strength or the
  // domain mode differs between D1 and D9, that pivot is the reader's key takeaway.
  // We flag it so the writer can OPEN the D9 section with a bold verdict line.
  let shiftHeadline=null;
  if(hLord && d1P[hLord]){
    const d1dig=d1P[hLord].dignity, d1house=d1P[hLord].house;
    let d9h=null; if(d9Houses){ for(let h=1;h<=12;h++){ if((d9Houses[h]||[]).includes(hLord)){ d9h=h; break; } } }
    const d1Kendra=[1,4,7,10].includes(d1house), d1Dusthana=[6,8,12].includes(d1house);
    const d9Kendra=d9h!=null&&[1,4,7,10].includes(d9h), d9Dusthana=d9h!=null&&[6,8,12].includes(d9h);
    // karaka placement too (e.g. Amatyakaraka for career)
    const kp = karakaPlanet && d1P[karakaPlanet] ? d1P[karakaPlanet] : null;
    const lordDepth = [8,12].includes(d1house);           // lord in transformation/withdrawal house
    const karakaDepth = kp && [8,12].includes(kp.house);
    if(d1Kendra && d9Dusthana) shiftHeadline=`Your ${cfg.focus} begins in the foreground (a strong D1 placement) but the D9 pulls it toward a quieter, more inward, or independent second-half expression — the visible early mode is likely to give way as life matures.`;
    else if(d1Dusthana && d9Kendra) shiftHeadline=`Your ${cfg.focus} may feel constrained early (a testing D1 placement) but the D9 lifts it into real strength — the second half of life is where this area comes into its own.`;
    else if(lordDepth || karakaDepth) shiftHeadline=`Your ${cfg.focus} is structured around depth rather than surface visibility — as life matures, expect a move away from conventional, front-stage expression toward more independent, specialised, or behind-the-scenes work.`;
    else if(d9Dusthana && !d1Dusthana) shiftHeadline=`As life matures, your ${cfg.focus} shifts toward a more inward, behind-the-scenes, or independent mode than its early expression.`;
  }
  flags.shift = shiftHeadline || null;

  // Disruption signature: the domain lord OR karaka sitting in the 8th house is the
  // classical "periodic disruption and reinvention" pattern. When present, the report
  // should NAME it as 'disruption' explicitly (intensity still tier-appropriate).
  const eighthPlanets = [];
  if(hLord && d1P[hLord] && d1P[hLord].house===8) eighthPlanets.push(hLord);
  if(karakaPlanet && d1P[karakaPlanet] && d1P[karakaPlanet].house===8 && !eighthPlanets.includes(karakaPlanet)) eighthPlanets.push(karakaPlanet);
  flags.disruptionSignature = eighthPlanets.length ? eighthPlanets : null;

  // ── Age-awareness (marriage / career / children read differently for a minor) ──
  // Compute the native's current age; for the "adult-life" domains, a native under
  // 21 gets FUTURE-oriented framing (this area is not yet lived) and the timing is
  // indicated in real terms only from age 21 onward. Health frames only its long-term
  // cautions as future; self/siblings/mother are unchanged (active from childhood).
  const AGE_SENSITIVE = { marriage:21, career:21, children:21 };
  let currentAge = null;
  try { const b=new Date(birthDate); if(!isNaN(b.getTime())) currentAge = Math.floor((Date.now()-b)/(365.25*24*3600*1000)); } catch(_){}
  flags.currentAge = currentAge;
  // ── Life-stage weighting (chart + age derived; no intake) ──
  // Foreground the phase the reader is actually in. Changes EMPHASIS/ORDER only — never the
  // predictions. A 48-year-old wants the current/second-half angle led, the past compressed to
  // recognition; the same chart at 28 wants the establishing angle led.
  let lifeStage=null;
  try{
    let currentMahadasha=null; const now=Date.now();
    if(Array.isArray(dashas)){ for(const md of dashas){ const sd=md.startDate?new Date(md.startDate).getTime():null; const ed=md.endDate?new Date(md.endDate).getTime():null; if(sd!=null&&ed!=null&&now>=sd&&now<ed){ currentMahadasha=md.lord; break; } } }
    if(currentAge!=null){
      let band, emphasis;
      if(currentAge<30){ band="establishing"; emphasis="Foreground what to BUILD now and in the near years ahead — identity, foundation, first establishment. Keep the past brief; put the weight on the near future and what the reader is forming."; }
      else if(currentAge<45){ band="building"; emphasis="Balance present momentum with the decade ahead. The past is a short recognition anchor; the emphasis is consolidating what is live now and preparing what comes next."; }
      else { band="established"; emphasis="Foreground the CURRENT phase and the second half — mastery, consolidation, enterprise, legacy. Compress the early/past arc to a brief recognition anchor (NOT the main event): this reader is living the later chapter now and wants what is live and ahead, not a replay of what passed."; }
      lifeStage={ age:currentAge, band, currentMahadasha, emphasis };
    }
  }catch(_){}
  flags.lifeStage=lifeStage;
  const realTermAge = AGE_SENSITIVE[domainKey] || null;
  flags.ageSensitive = !!realTermAge;
  flags.realTermAge = realTermAge;
  // isMinorForDomain = under the real-term age for an age-sensitive domain
  flags.isMinorForDomain = (realTermAge!=null && currentAge!=null && currentAge < realTermAge);
  flags.healthLongTermFuture = (domainKey==="health" && currentAge!=null && currentAge < 18);

  // ── Shared severity + conditional "Watch out for" (all domains) ──────────────
  // The severity score decides whether a prominent, noticeable caution is EARNED.
  // Only a 'strong' tier (genuine convergence of compounding factors) produces a
  // "Watch out for" line — always framed as a hint to PREPARE, never a verdict.
  const severity = scoreDomainSeverity(d1P, cfg.house, hLord, karakaPlanet, d9LordCaution, occupants, domainKey);

  // Dusthana flavours (descriptive, classically grounded) for the domain-relevant
  // planets. The TONE of how these are presented is driven by severity.tier below
  // (plain = calm/descriptive; strong = noticeable caution) — so a single lord in a
  // dusthana reads calmly, while a dusthana PLUS other compounding factors reads
  // with more weight. This does not change severity scoring — only description.
  const dusthanaReadings = [];
  const seenD = new Set();
  const addDusthana = (planet, roleLabel) => {
    if(!planet || seenD.has(planet)) return;
    const r = dusthanaReading(planet, d1P[planet], roleLabel);
    if(r){ dusthanaReadings.push(r); seenD.add(planet); }
  };
  addDusthana(hLord, ordinalD(cfg.house)+"-lord");
  addDusthana(karakaPlanet, cfg.karaka);
  for(const o of occupants){ addDusthana(o.planet, "in your "+ordinalD(cfg.house)+" house"); }
  flags.severityTier = severity.tier;         // 'plain' | 'moderate' | 'strong'
  flags.severityScore = severity.score;
  flags.severityFactors = severity.factors;
  let watchOutFor = null;
  if(severity.tier==="strong"){
    watchOutFor = `This area shows a genuine convergence of factors (${severity.factors.slice(0,3).join("; ")}) — worth holding with real care and preparation, not as something that will certainly go wrong, but as a part of life that rewards foresight, professional guidance where relevant, and a steady plan.`;
  }
  flags.watchOutFor = watchOutFor;

  if(domainKey==="marriage"){
    const sevOcc=occupants.map(o=>o.planet);
    const ketuIn7=sevOcc.includes("Ketu"), rahuIn7=sevOcc.includes("Rahu");
    const maleficIn7=sevOcc.some(p=>["Saturn","Mars","Rahu","Ketu","Sun"].includes(p));
    const lordWeak=lordPlacement&&(lordPlacement.dignity==="Debilitated"||[6,8,12].includes(lordPlacement.house));
    const _dk=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role==="Darakaraka")||{}).planet:null;
    // Classically-grounded MULTI-FACTOR affliction assessment — replaces the old
    // occupant-only test that produced the V6 false "checks come back clear". It weighs
    // D1 7th occupation AND aspects, the 7th-lord condition, Venus (Kalatrakaraka) in D1
    // and D9, the Darakaraka, the Badhakesh-in-7th, and the D9 7th house + lord.
    const marAff = scoreMarriageAffliction({ d1P, d9Houses, d9LagnaSign, hLord, lordPlacement,
      occupants, darakaraka:_dk, badhaka:(compound&&compound.badhaka)||null, d9LordCaution });
    const afflicted = marAff.afflicted;
    flags.marriageAfflicted=!!afflicted;
    flags.marriageAfflictionDetail=marAff;          // {score,severity,factors,clearChecks}
    flags.remarriageIndicated=!!(ketuIn7 || (maleficIn7 && lordWeak) || (rahuIn7 && lordWeak));
    // Manglik checkpoint — transparent calculation, applied cancellations, non-alarmist net reading.
    try{ flags.manglik = buildManglikCheckpoint(d1P, d1LagnaSign); }catch(_){ flags.manglik=null; }
    // OWNER-ONLY sensitive indications (fidelity / separation) — for the astrologer's confidential
    // consultation. Stripped from the client packet in the report writer; nulled for minors below.
    try{ flags.ownerSensitive = buildMarriageOwnerSensitive(d1P, d1LagnaSign, d9Houses, d9LagnaSign, hLord, marAff); }catch(_){ flags.ownerSensitive=null; }
    // PD-level timing precision — ADD-ON, reversible via ENABLE_PD_TIMING; AD-level windows below
    // are left untouched. Adults only (minors never get a marriage-timing window).
    if(ENABLE_PD_TIMING){
      try{
        const sNum=(nm)=>{ const i=V_SIGNS.indexOf(nm); return i<0?null:i+1; };
        const lagIdx=V_SIGNS.indexOf(d1LagnaSign);
        const d9lagIdx=V_SIGNS.indexOf(d9LagnaSign);
        const signD1={}, signD9={};
        for(const p of Object.keys(d1P)){ if(p==="Lagna")continue; if(d1P[p]&&d1P[p].sign) signD1[p]=sNum(d1P[p].sign); }
        // D9 sign per planet from the D9 house map (sign = nth from D9 lagna)
        for(let h=1;h<=12;h++){ for(const p of (d9Houses[h]||[])){ if(d9lagIdx>=0) signD9[p]=((d9lagIdx+h-1)%12)+1; } }
        const _dkT=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role==="Darakaraka")||{}).planet:null;
        flags.marriageTiming = computeMarriageTimingWindows({
          lagnaSign:(lagIdx>=0?lagIdx+1:null), d9LagnaSign:(d9lagIdx>=0?d9lagIdx+1:null),
          signD1, signD9, darakaraka:_dkT, dashas, birthDate, currentAge });
      }catch(_){ flags.marriageTiming=null; }
    }
    // AD-level tightened windows (reliable 1-3 yr; shortlist + confidence) — reversible.
    if(ENABLE_AD_TIGHTEN){
      try{
        const sNum2=(nm)=>{ const i=V_SIGNS.indexOf(nm); return i<0?null:i+1; };
        const lagIdx2=V_SIGNS.indexOf(d1LagnaSign);
        const signD1b={}; for(const p of Object.keys(d1P)){ if(p!=="Lagna"&&d1P[p]&&d1P[p].sign) signD1b[p]=sNum2(d1P[p].sign); }
        const _dk2=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role==="Darakaraka")||{}).planet:null;
        flags.marriageADWindows = computeMarriageADWindows({ lagnaSign:(lagIdx2>=0?lagIdx2+1:null), signD1:signD1b, darakaraka:_dk2, dashas, birthDate });
      }catch(_){ flags.marriageADWindows=null; }
    }
    // ── Phase 1: Delay Gate + Romance/Marriage conversion filter (reversible via ENABLE_AGE_GATE).
    // Classifies the AD windows against an astronomy-anchored delay gate: windows before it are
    // relationship/proposal windows, the first primary-significator window after it is the legal-
    // marriage window. When present, the writer prefers this over the flat marriageADWindows.
    if(ENABLE_AGE_GATE){
      try{
        const lagNum = V_SIGNS.indexOf(d1LagnaSign)+1 || null;
        const _dkG=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role==="Darakaraka")||{}).planet:null;
        const delayGate = computeDelayGate({ lagnaSign:lagNum, d1P, d9Houses, hLord });
        flags.marriageDelayGate = delayGate;
        flags.marriageLifecycle = delayGate
          ? computeMarriageLifecycle({ lagnaSign:lagNum, darakaraka:_dkG, dashas, birthDate, delayGate })
          : null;
      }catch(_){ flags.marriageDelayGate=null; flags.marriageLifecycle=null; }
    }
    // ── Phase 2: Separation / dissolution timing (reversible via ENABLE_SEPARATION). Only fires a
    // dissolution window when the structural separation severity (ownerSensitive) is notable+.
    if(ENABLE_SEPARATION){
      try{
        const lagNum2 = V_SIGNS.indexOf(d1LagnaSign)+1 || null;
        const sepRisk = flags.ownerSensitive && flags.ownerSensitive.separationRisk ? flags.ownerSensitive.separationRisk : null;
        const marWin = (flags.marriageLifecycle && flags.marriageLifecycle.marriageWindow)
          ? flags.marriageLifecycle.marriageWindow
          : (flags.marriageADWindows && flags.marriageADWindows.windows ? flags.marriageADWindows.windows[0] : null);
        flags.separationTiming = sepRisk
          ? computeSeparationTiming({ separationRisk:sepRisk, marriageWindow:marWin, dashas, lagnaSign:lagNum2 })
          : null;
      }catch(_){ flags.separationTiming=null; }
    }

    // ── Spouse significator + partner profile (gender-aware) ─────────────────────
    // Classical rule: for a WOMAN the husband-significator is Jupiter; for a MAN the
    // wife-significator is Venus. When gender is not given we fall back to Darakaraka
    // (the chara-karaka spouse significator) and tell the writer gender was withheld
    // so it speaks of "your partner" rather than husband/wife.
    const g = String(gender||"unspecified").toLowerCase();
    const genderKnown = (g==="male"||g==="female");
    const darakaraka=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role==="Darakaraka")||{}).planet:null;
    const sigPlanet = g==="female" ? "Jupiter" : g==="male" ? "Venus" : darakaraka;
    const spouseWord = g==="female" ? "husband" : g==="male" ? "wife" : "partner";
    const sigRole = g==="female" ? "Jupiter — the classical significator of the husband for a woman"
                  : g==="male"   ? "Venus — the classical significator of the wife for a man"
                  : (darakaraka ? (darakaraka+" — your Darakaraka, the chart's own spouse significator") : null);
    const SIGN_TEMPERAMENT = {
      Aries:"direct, energetic, independent and quick to act",
      Taurus:"steady, patient, comfort-loving and security-minded",
      Gemini:"talkative, curious, versatile and mentally quick",
      Cancer:"caring, emotional, home-loving and protective",
      Leo:"warm, proud, generous and wanting to be respected",
      Virgo:"practical, discerning, helpful and detail-minded",
      Libra:"gracious, fair-minded, partnership-focused and refined",
      Scorpio:"intense, private, loyal and emotionally deep",
      Sagittarius:"optimistic, freedom-loving, principled and candid",
      Capricorn:"serious, responsible, ambitious and self-disciplined",
      Aquarius:"independent, unconventional, friendly and idealistic",
      Pisces:"gentle, imaginative, compassionate and adaptable",
    };
    const HOUSE_ARENA = {
      1:"someone who strongly shapes your sense of self — the partnership sits front-and-centre in your life",
      2:"someone connected to family, finances, or a settled home life",
      3:"someone met through your own circle, communication, or close to where you live",
      4:"someone tied to home, roots, property or family — a domestic, nurturing bond",
      5:"someone met through romance, creativity or a love-first path",
      6:"a partnership that carries duty, service or friction to work through — it rewards patience",
      7:"the marriage house itself — partnership is a central, defining life theme",
      8:"a bond of depth, intimacy and transformation; shared matters loom large, and some turbulence is possible",
      9:"someone from a different background, place, faith or culture — a values-and-growth match",
      10:"someone linked to career, status or public life — marriage tied to your standing and work",
      11:"someone met through friends, networks or community — a goals-and-gains partnership",
      12:"someone from far away or a private setting — an inward, giving bond that asks for conscious boundaries",
    };
    let partnerProfile=null;
    if(sigPlanet && d1P[sigPlanet]){
      const sp=d1P[sigPlanet];
      let d9House=null; if(d9Houses){ for(let h=1;h<=12;h++){ if((d9Houses[h]||[]).includes(sigPlanet)){ d9House=h; break; } } }
      const dig=sp.dignity;
      const strength = (dig==="Exalted"||dig==="Own sign") ? "strongly placed — a well-defined, supportive partner indication"
                     : dig==="Debilitated" ? "weakly placed — the partner theme asks for conscious effort; qualities can feel muted, delayed, or tested before they settle"
                     : dig==="Combust" ? "close to the Sun (combust) — the partner theme can be overshadowed early and needs room to come into its own"
                     : "moderately placed";
      const retro = !!(retroMap && retroMap[sigPlanet]);
      // BLEND: the partner picture must not rest on the significator alone. Weave in the
      // Darakaraka (the chart's own spouse karaka) and the planets actually sitting IN the
      // marriage house — for native A, three planets in Leo give a proud, expressive,
      // strong-willed spouse that a Jupiter-only read misses entirely.
      const traits=[];
      traits.push({ source:"significator", planet:sigPlanet, sign:sp.sign, trait:SIGN_TEMPERAMENT[sp.sign]||null });
      if(darakaraka && darakaraka!==sigPlanet && d1P[darakaraka]){
        traits.push({ source:"darakaraka", planet:darakaraka, sign:d1P[darakaraka].sign, trait:SIGN_TEMPERAMENT[d1P[darakaraka].sign]||null });
      }
      // marriage-house occupants (the "marriage zone" flavour); dedupe by sign
      const occSeen=new Set();
      (occupants||[]).forEach(o=>{ const pp2=d1P[o.planet]; if(pp2 && pp2.sign && !occSeen.has(pp2.sign)){ occSeen.add(pp2.sign); traits.push({ source:"marriage-zone", planet:o.planet, sign:pp2.sign, trait:SIGN_TEMPERAMENT[pp2.sign]||null }); } });
      // dominant marriage-zone sign (a stellium there is a strong colouring)
      const zoneSigns=(occupants||[]).map(o=>d1P[o.planet]&&d1P[o.planet].sign).filter(Boolean);
      const zoneCount={}; zoneSigns.forEach(s=>zoneCount[s]=(zoneCount[s]||0)+1);
      const marriageZoneSign = Object.keys(zoneCount).sort((a,b)=>zoneCount[b]-zoneCount[a])[0]||null;
      const marriageZoneStellium = marriageZoneSign && zoneCount[marriageZoneSign]>=2;
      partnerProfile={
        genderKnown, nativeGender:g, spouseWord,
        significator:sigPlanet, significatorRole:sigRole,
        sign:sp.sign, house:sp.house, dignity:dig, retro, d9House,
        temperament: SIGN_TEMPERAMENT[sp.sign] || null,
        traits,                                                // blended: significator + DK + marriage-zone
        marriageZoneSign, marriageZoneStellium,
        arena: HOUSE_ARENA[sp.house] || null,
        strength,
        retroNote: retro ? "The significator is retrograde — the partner may come into life in a non-linear way: re-met, from the past, or after a meaningful delay." : null,
        d9Note: (d9House && [6,8,12].includes(d9House)) ? "In the D9 (the marriage chart proper), the significator sits in a testing house — a sign the bond deepens through patience and conscious work rather than arriving effortlessly." : null,
        seventhLord: hLord, seventhLordDignity: lordPlacement?lordPlacement.dignity:null, seventhLordHouse: lordPlacement?lordPlacement.house:null,
        darakaraka, darakarakaSign: (darakaraka&&d1P[darakaraka])?d1P[darakaraka].sign:null,
      };
    }
    flags.partnerProfile=partnerProfile;

    // ── Second-chapter facts (the "second significant union" possibility, grounded) ──
    // When the chart carries remarriage/affliction signals, give the writer a CHART-BASED
    // basis for the possibility (so it isn't an abstract cliffhanger) plus its D9 colour —
    // framed gently as a layered relational life, never a prediction.
    // The "second significant union" possibility is a HEAVY, rare claim: raise it ONLY on the
    // structural remarriage markers (Ketu in 7th, or a pressured 7th with a weak ruler) AND a
    // genuinely strong overall affliction — never on a broad/moderate affliction alone, which
    // would over-claim remarriage (a V6-class error).
    let secondChapter=null;
    if(flags.remarriageIndicated && marAff.severity==="strong"){
      const basis=[];
      if(ketuIn7) basis.push("Ketu in the marriage house (a detaching, karmic signature there)");
      if(maleficIn7 && lordWeak) basis.push("the marriage house under pressure with its ruler placed in a testing house");
      if(rahuIn7 && lordWeak) basis.push("Rahu in the marriage house with a weakened house-ruler");
      if(d9LordCaution) basis.push("the D9 (marriage chart) adding its own caution");
      // D9 colour from the spouse significator's navamsa position
      let d9Colour=null;
      if(partnerProfile && partnerProfile.d9House){
        d9Colour = "In the D9, the spouse significator sits in the "+ordinalD(partnerProfile.d9House)+" — "+( [1,5,9].includes(partnerProfile.d9House) ? "a more supportive placement, suggesting a second bond, if it comes, can be steadier" : [6,8,12].includes(partnerProfile.d9House) ? "a testing placement, suggesting any second bond also asks for conscious work" : "a neutral placement" );
      }
      secondChapter={ indicated:true, basis, d9Colour,
        framing:"a layered relational life — the structural possibility of a second significant union, offered gently as a possibility the chart honestly shows, never a prediction or a certainty, and entirely dependent on the reader's own circumstances and choices" };
    }
    flags.secondChapter=secondChapter;

    // ── Marital-status inference (soft, age + chart) ─────────────────────────────
    // Owner rule: infer a LIKELY status from age and chart so the report speaks to the
    // reader's probable situation — with soft thresholds and gentle, non-presuming
    // wording. Branches: likely-not-yet-married → focus on the spouse-to-come & timing;
    // transitional → dual framing; likely-married → focus on navigating the marriage.
    const AGE = flags.currentAge;
    const spouseNeutral = "spouse";   // general/hedging prose uses the neutral word; the gendered spouseWord is reserved for the partner-character section
    // An EXPLICIT marital status (declared at intake, optional) OVERRIDES the age inference
    // and lets the report drop its hedging and speak directly to the reader's real situation.
    const declared = String(maritalStatus||"").toLowerCase();
    const declaredKnown = ["unmarried","married","separated_divorced"].includes(declared);
    let maritalInference=null;
    if(declaredKnown){
      let status, focus, statusNote=null;
      if(declared==="unmarried"){
        status="unmarried";
        focus=`the character, background and arrival of the ${spouseNeutral} to come — how to recognise the right partnership and prepare for it, plus the periods that most favour marriage`;
      } else if(declared==="married"){
        status="married";
        focus=`navigating and strengthening your existing marriage — understanding your ${spouseNeutral}'s nature and the periods that test or support the bond`;
        if(afflicted||flags.remarriageIndicated) statusNote=`The chart shows periods of real testing in the marriage; the reading names them honestly so you can meet them with care — never as a verdict on the bond.`;
      } else {
        status="separated_divorced";
        focus=`making sense of what the marriage chapter held and what a renewed or second bond can look like — spoken to your situation directly, with dignity and hope`;
        statusNote=`You have told us this chapter has been difficult or has closed; the reading speaks to that directly and to what can come next, without re-opening old ground needlessly.`;
      }
      maritalInference={ age:AGE, nativeGender:g, spouseWord, spouseNeutral, status, focus, statusNote, soft:false, declared:true };
    } else if(AGE!=null){
      let status, focus, statusNote=null;
      if(AGE < 28){
        status="likely-not-yet-married";
        focus=`the character, background and arrival of the ${spouseNeutral} to come — how to recognise the right partnership and prepare for it, plus the periods that most favour marriage`;
      } else if(AGE<=32){
        status="transitional";
        focus=`read both ways — if marriage has not yet happened, the kind of ${spouseNeutral} and the timing ahead; if it is recent, how to settle and strengthen the early years`;
      } else {
        status="likely-married";
        focus=`navigating and strengthening an existing marriage — understanding the ${spouseNeutral}'s nature and the periods that test or support the bond`;
        if(afflicted||flags.remarriageIndicated) statusNote=`If the marriage has met real strain, distance, or a chapter has closed, the reading speaks to that possibility with care — without assuming it has happened.`;
      }
      maritalInference={ age:AGE, nativeGender:g, spouseWord, spouseNeutral, status, focus, statusNote, soft:true, declared:false };
    }
    flags.maritalInference=maritalInference;

    // ── Minor (under 18): guardian-facing mode ───────────────────────────────────
    // A child's marriage report is read by PARENTS. It must NOT portray a future spouse, give
    // romantic/marriage timing, predict a second marriage as an event, address the child as a
    // romantic being, or prescribe romantic remedies — those payloads are stripped. But parents
    // genuinely want the ROAD AHEAD so they can nurture behaviours and coach early, INCLUDING
    // the partnership/relationship areas that only matter after 18. So guardian mode is NOT a
    // blackout: it surfaces, FORWARD-LOOKING and for the parents, (a) the daughter's own
    // relational TEMPERAMENT (how she is likely to approach closeness, affection and partnership
    // as an adult — her style, not a spouse's), (b) the structural growth areas from the
    // affliction assessment, and (c) the developmental framing, so the writer can turn these
    // into concrete, age-appropriate coaching. Honest about cautions, never a verdict, never
    // romantic prediction.
    if(currentAge!=null && currentAge < 18){
      flags.minorMarriageMode=true;
      flags.marriageReader="guardian";
      flags.partnerProfile=null;                   // no spouse portrait for a child
      flags.secondChapter=null;                    // no second-marriage-as-event
      flags.maritalInference=null;
      flags.remarriageIndicated=false;
      flags.manglik=null;                          // a marriage-matching verdict, not childhood coaching
      flags.ownerSensitive=null;                   // no affair/separation read for a child, ever
      flags.marriageTiming=null;                   // no marriage-timing window for a child
      flags.marriageADWindows=null;                // no marriage-timing window for a child
      flags.marriageDelayGate=null;                // no delay gate / romance window for a child
      flags.marriageLifecycle=null;                // no romance/marriage lifecycle for a child
      flags.separationTiming=null;                 // no separation/dissolution read for a child, ever
      // The daughter's OWN relational temperament: the sign on her 7th house (how she approaches
      // close partnership) and her Venus (how she gives and receives affection) — translated into
      // her developmental style, never into a description of a partner.
      const _lagIdx=V_SIGNS.indexOf(d1LagnaSign);
      const _seventhSign = _lagIdx>=0 ? V_SIGNS[(_lagIdx+6)%12] : null;
      const _venusSign = d1P.Venus ? d1P.Venus.sign : null;
      flags.guardianNote={
        age:currentAge, redFlag: marAff.afflicted, severity: marAff.severity,
        factors: marAff.factors, clearChecks: marAff.clearChecks,
        relationalTemperament:{
          approachSign:_seventhSign, approach:_seventhSign?SIGN_TEMPERAMENT[_seventhSign]:null,
          affectionSign:_venusSign, affection:_venusSign?SIGN_TEMPERAMENT[_venusSign]:null
        },
        framing:"Addressed to the young native directly ('you'), for consistency with every other domain: a forward-looking DEVELOPMENTAL note on the groundwork of the relationship area of life, for self-understanding and healthy habits, not prediction. Because the native is under 18 it does NOT portray a future spouse, give marriage timing, or raise events — none of that belongs in a minor's reading. It describes their OWN likely relational temperament (how they tend to approach closeness, affection, independence and compromise) and the growth areas the chart suggests, with age-appropriate things to build now (emotional security, healthy communication, patience, a balanced sense of self). Tendencies to shape, never fixed outcomes."
      };
    }
  }
  if(domainKey==="children"){
    const fifthAfflicted=(lordPlacement&&(lordPlacement.dignity==="Debilitated"||[6,8,12].includes(lordPlacement.house)))
                        ||occupants.some(o=>["Saturn","Mars","Rahu","Ketu"].includes(o.planet))
                        ||!!d9LordCaution;  // NOW also catches the D9 maturation caution
    flags.progenyHighCare=!!fifthAfflicted;
    flags.progenySoulCentral=!!domainIsSoulCentral;
  }
  if(domainKey==="health"){
    flags.healthWatch=true;
    const lagLord = houseLord(d1LagnaSign, 1);
    const sixthLord = houseLord(d1LagnaSign, 6);
    const eighthLord = houseLord(d1LagnaSign, 8);
    const asc1 = occupantsOfHouse(d1P,1);
    const areas=[]; const notes=[]; let cognitivePrimary=false;

    // ── COGNITIVE / NERVOUS-SYSTEM axis — gated by SHARED SEVERITY tier ──
    // Only becomes the PRIMARY emphasis when the chart's overall severity is 'strong'
    // (genuine convergence) AND real cognitive signals are present. Otherwise it is a
    // measured note at most. This is the fix for the 51%-over-firing problem: common
    // single placements no longer trigger a nervous-system headline.
    const merc=d1P.Mercury, moon=d1P.Moon, rahu=d1P.Rahu, ketu=d1P.Ketu;
    const mercDebil = merc && merc.dignity==="Debilitated";
    const moonDebil = moon && moon.dignity==="Debilitated";
    const mercDusthana = merc && [6,8,12].includes(merc.house);
    const moonDusthana = moon && [6,8,12].includes(moon.house);
    const nodeDebil = (rahu && rahu.dignity==="Debilitated") || (ketu && ketu.dignity==="Debilitated");
    const mercuryLagna = ["Gemini","Virgo"].includes(d1LagnaSign);
    const moonLagna = d1LagnaSign==="Cancer";
    const maleficOnAsc0 = asc1.filter(p=>["Saturn","Mars","Rahu","Ketu"].includes(p));
    const nervousConstitution = (mercuryLagna||moonLagna) && maleficOnAsc0.length>0;
    // real cognitive signals (each a genuine affliction, not a common placement)
    const cogSignals = [mercDebil, moonDebil, nodeDebil, (nervousConstitution && (mercDusthana||moonDusthana||nodeDebil)), (mercDusthana&&moonDusthana)].filter(Boolean).length;

    // PRIMARY only when overall severity is strong AND cognitive signals genuinely converge
    if(severity.tier==="strong" && cogSignals>=2){
      cognitivePrimary=true;
      areas.push("the nervous system, mind, focus, and temperament");
      let why=[];
      if(nodeDebil) why.push("the Rahu-Ketu axis is debilitated (a signal linked to restlessness, impulsiveness, and over-stimulation)");
      if(mercDebil||mercDusthana) why.push("Mercury — the significator of the mind and nerves — is sensitively placed");
      if(moonDebil||moonDusthana) why.push("the Moon (emotional regulation) is under emphasis");
      if(nervousConstitution) why.push("a "+d1LagnaSign+" Ascendant carrying malefics gives a finely-tuned, easily-stressed nervous constitution");
      notes.push("This chart places STRONG emphasis on the mind-and-nervous-system dimension of wellbeing: "+why.join("; ")+". This is the area that most rewards proactive attention — steady routines, calm environments, sleep, focus support, and professional guidance where behaviour, attention, or temperament need it. (A structural tendency for extra care, never a diagnosis.)");
    } else if(cogSignals>=1 && (mercDebil||moonDebil||nodeDebil)){
      // measured, secondary note only
      areas.push("nervous system, mind, and rest");
      notes.push("The mind-and-nerves significators carry some stress — steady sleep, mental calm, and focus support are worth prioritising.");
    }

    // ── constitution / vitality ──
    const maleficOnAsc = asc1.filter(p=>["Saturn","Mars","Rahu","Ketu","Sun"].includes(p));
    if(maleficOnAsc.length){ areas.push("overall constitution and vitality"); notes.push(`${maleficOnAsc.join(", ")} on the Ascendant asks for steady attention to baseline vitality and stamina.`); }
    // ── resilience / recovery ──
    const weak = Object.entries(d1P).filter(([p,v])=>p!=="Lagna"&&(v.dignity==="Debilitated")).map(([p])=>p);
    if(weak.length>=2){ areas.push("resilience and recovery"); notes.push(`Several planets sit under pressure (${weak.join(", ")}), which can mean the body asks for more deliberate rest and recovery than average.`); }
    // ── Mars axis (injury/inflammation) — kept but SECONDARY, single mention ──
    const marsAff = d1P.Mars && (d1P.Mars.dignity==="Debilitated" || [6,8,12].includes(d1P.Mars.house));
    if(marsAff && !cognitivePrimary){ areas.push("injuries, inflammation, and physical overexertion"); notes.push("Mars is under strain — some extra care around accidents, inflammation, and overexertion is sensible."); }
    else if(marsAff && cognitivePrimary){ areas.push("physical energy and inflammation (secondary)"); notes.push("Mars under strain adds a secondary note around physical stamina and inflammation — real, but less central than the nervous-system theme above."); }
    // ── chronic axis ──
    if((sixthLord&&d1P[sixthLord]&&[1,8,12].includes(d1P[sixthLord].house)) || (eighthLord&&d1P[eighthLord]&&[1,6,12].includes(d1P[eighthLord].house))){
      areas.push("chronic-tendency awareness"); notes.push("The illness-axis lords sit in sensitive houses — regular check-ups help catch slow-building tendencies early.");
    }
    flags.healthAreas = areas;
    flags.healthNotes = notes;
    flags.healthCognitivePrimary = cognitivePrimary;
    flags.healthStrong = cognitivePrimary || (maleficOnAsc.length>0) || (weak.length>=2) || marsAff;
  }
  flags.domainSoulCentral=!!domainIsSoulCentral;
  flags.d9MaturationCaution=!!d9LordCaution;

  // Neecha Bhanga (debilitation cancellation) — check the domain lord AND any
  // debilitated planet occupying the domain house (the Career sample's Mercury case).
  const neechaBhangaList=[];
  const nbCandidates=[];
  if(lordPlacement && lordPlacement.dignity==="Debilitated" && hLord) nbCandidates.push(hLord);
  for(const o of occupants){ if(o.dignity==="Debilitated") nbCandidates.push(o.planet); }
  // Also: debilitated planets sharing the domain-lord's house (they colour the domain).
  if(lordPlacement && lordPlacement.house){
    for(const [p,v] of Object.entries(d1P)){
      if(p==="Lagna") continue;
      if(v.house===lordPlacement.house && v.dignity==="Debilitated") nbCandidates.push(p);
    }
  }
  for(const cand of [...new Set(nbCandidates)]){
    const place=d1P[cand]; if(!place) continue;
    const dispositor=V_LORD[place.sign];
    if(dispositor && d1P[dispositor] && (d1P[dispositor].dignity==="Exalted"||d1P[dispositor].dignity==="Own sign")){
      neechaBhangaList.push(`${cand} is debilitated in ${place.sign} but its dispositor ${dispositor} is strong (${d1P[dispositor].dignity}) — a debilitation-cancellation (Neecha Bhanga). This means ${cand}'s significations strengthen with maturity rather than staying weak.`);
    }
  }
  const neechaBhanga = neechaBhangaList.length ? neechaBhangaList.join(" ") : null;

  // Dasha timing — MD level PLUS antardasha (AD) sub-periods, since real events
  // land at the AD level. We surface: the current MD+AD, the domain-relevant MDs,
  // and the specific AD sub-windows that most activate the domain's key planets.
  let dashaTiming=null;
  if(dashas && Array.isArray(dashas) && dashas.length){
    let keyPlanets = new Set([hLord, karakaPlanet, ...occupants.map(o=>o.planet)].filter(Boolean));
    // DOMAIN TIMING SUPPORT — real-life events rarely fire on the primary house-lord and
    // karaka alone. Classical timing runs on a domain's SUPPORTING houses and natural
    // karakas too (marriage on the 2–5–11 axis + Venus/Jupiter; career on 6/11 + Sun/
    // Saturn/Mercury/Jupiter; children on the 5–9 santana axis + Jupiter; and so on). The
    // SCORING engine already uses these multi-house sets — this mirrors them into TIMING so
    // keyWindows, the likely-event window, and the dasha reads detect genuine events (e.g. a
    // Saturn-2nd-lord MD / Mars-5th-lord AD marriage that the 7th-lord alone would miss).
    // Supporting houses per domain. Beyond the obvious ones, each domain also folds in its
    // DERIVATIVE (bhavat bhavam) house — the Nth-from-Nth that classically carries a sub-theme
    // of the area — so a lord/occupant/stressor there is caught as a secondary activator:
    //   marriage +8 = 2nd-from-7th (mangalya / the longevity and sustenance of the marriage)
    //   siblings +5 = 3rd-from-3rd (a younger co-born's courage and ventures)
    //   mother   +7 = 4th-from-4th (the mother's own home, comfort and partner)
    //   children  9 = 5th-from-5th (already present — the dharma/continuation of progeny)
    //   career   7th (10th-from-10th) is handled as a dedicated early-signal in buildCareerDisruptions
    const DOMAIN_TIMING_SUPPORT = {
      self:     { houses: [],          karakas: ["Sun","Moon"] },
      career:   { houses: [6, 11],     karakas: ["Sun","Saturn","Mercury","Jupiter"] },
      siblings: { houses: [5, 11],     karakas: ["Mars"] },
      mother:   { houses: [2, 7],      karakas: ["Moon","Venus"] },
      children: { houses: [9, 2],      karakas: ["Jupiter"] },
      health:   { houses: [1, 8, 12],  karakas: ["Sun","Moon","Saturn","Mars"] },
      marriage: { houses: [2, 5, 8, 11],karakas: ["Venus","Jupiter"] },
    };
    const sup = DOMAIN_TIMING_SUPPORT[domainKey] || { houses: [], karakas: [] };
    const supLords = sup.houses.map(h=>houseLord(d1LagnaSign,h)).filter(Boolean);
    const supOcc   = sup.houses.flatMap(h=>occupantsOfHouse(d1P,h));
    // domainActivators = the full set of planets whose dasha can bring an event in this area.
    const domainActivators = new Set([hLord, karakaPlanet, ...occupants.map(o=>o.planet), ...supLords, ...supOcc, ...sup.karakas].filter(Boolean));
    for(const p of domainActivators) keyPlanets.add(p);
    // Health keeps its extra signal: afflicted Mars/Moon/Mercury are vigilance triggers.
    if(domainKey==="health"){
      for(const p of ["Mars","Moon","Mercury"]) if(d1P[p] && (d1P[p].dignity==="Debilitated"||[6,8,12].includes(d1P[p].house))) keyPlanets.add(p);
    }
    // stressors for this domain = malefics + the lords of dusthana houses relative to lagna
    const now = Date.now();
    const yr = (d)=> d? new Date(d).getFullYear() : null;
    // A planet is a "domain stressor" (its AD was likely a testing window) if it is:
    //  - the domain house-lord PLACED IN a dusthana (6/8/12) — e.g. 10th-lord in 8th
    //  - a dusthana (6th/8th/12th) lord relative to the lagna
    //  - debilitated, or a malefic occupying the domain house
    const dusthanaLords = new Set([houseLord(d1LagnaSign,6), houseLord(d1LagnaSign,8), houseLord(d1LagnaSign,12)].filter(Boolean));
    // A malefic in the PRIMARY domain house OR any supporting/derivative domain house is a
    // stressor for the area (e.g. a malefic in the 8th stresses marital longevity).
    const domainHouseMalefics = new Set(
      [...(occupants||[]).map(o=>o.planet), ...supOcc]
        .filter(p=>["Saturn","Mars","Rahu","Ketu"].includes(p)));
    function isStressor(planet){
      if(!planet) return false;
      const pp=d1P[planet];
      if(hLord===planet && pp && [6,8,12].includes(pp.house)) return true; // domain-lord in dusthana
      if(dusthanaLords.has(planet)) return true;
      if(pp && pp.dignity==="Debilitated") return true;
      if(domainHouseMalefics.has(planet)) return true;
      return false;
    }
    const rows=[]; const adWindows=[]; const pastWindows=[]; const forwardADs=[];
    let current=null, currentAD=null;
    for(const md of dashas){
      const st=md.startDate?new Date(md.startDate).getTime():null;
      const en=md.endDate?new Date(md.endDate).getTime():null;
      const yrs = (st!=null&&en!=null) ? (yr(md.startDate)+"–"+yr(md.endDate)) : "";
      const relevant = keyPlanets.has(md.lord);
      const isCurrentMD = (st!=null&&en!=null&&now>=st&&now<en);
      if(isCurrentMD) current={lord:md.lord,years:yrs,relevant};
      if(relevant) rows.push({lord:md.lord,years:yrs,note:(md.lord===hLord?"rules your "+ordinalD(cfg.house)+" house of "+cfg.focus:md.lord===karakaPlanet?"the "+cfg.karaka+", your domain significator":"active in your "+ordinalD(cfg.house)+" house")});
      // scan antardashas
      if(Array.isArray(md.antarDasas)){
        for(const ad of md.antarDasas){
          const ast=ad.startDate?new Date(ad.startDate).getTime():null;
          const aen=ad.endDate?new Date(ad.endDate).getTime():null;
          const ayrs=(ast!=null&&aen!=null)?(yr(ad.startDate)+"–"+yr(ad.endDate)):"";
          if(isCurrentMD && ast!=null&&aen!=null&&now>=ast&&now<aen){
            // include the exact end month so the report can say "wrapping up around <Mon YYYY>"
            // and the reader never wonders whether the boundary year is Now or Ahead.
            let until=""; try{ until = new Date(ad.endDate).toLocaleString("en-US",{month:"long",year:"numeric"}); }catch(_){}
            currentAD={md:md.lord,ad:ad.lord,years:ayrs,until};
          }
          // FORWARD-AD POOL (for the Future Compass): every AD that is current or still
          // ahead — regardless of whether its lord is a domain karaka. This is the fix for
          // older natives whose domain-karaka periods are all in the past: the compass can
          // now break out the live Mahadasha's sub-periods (e.g. Rahu–Jupiter, Rahu–Saturn)
          // with real dates instead of collapsing 18 years into one vague block.
          if(aen!=null && aen>=now){
            forwardADs.push({ md:md.lord, ad:ad.lord, years:ayrs,
              upcoming:(ast!=null && ast>=now), current:(ast!=null&&aen!=null&&now>=ast&&now<aen) });
          }
          // an AD is domain-significant if its lord activates this domain — the
          // AD lord is a domain key planet OR a domain stressor. (Previously this
          // also required the MD to be domain-relevant, which MISSED a critical AD
          // like the 10th-lord's sub-period inside an unrelated MD. Now aligned with
          // the retrospective logic so forward and backward are consistent.)
          if(keyPlanets.has(ad.lord) || isStressor(ad.lord)){
            const upcoming = (ast!=null && ast>=now);
            adWindows.push({ md:md.lord, ad:ad.lord, years:ayrs, upcoming,
              note:(ad.lord===hLord? ad.lord+" (your "+ordinalD(cfg.house)+"-lord) sub-period within "+md.lord+" — a concentrated window for this area"
                    : ad.lord===karakaPlanet? ad.lord+" (the "+cfg.karaka+") sub-period within "+md.lord+" — the domain significator activates here"
                    : ad.lord+" sub-period within "+md.lord+" — an active window for this area, tending to bring new developments or demands") });
          }
          // RETROSPECTIVE (read-only): a PAST sub-period whose lord is a genuine domain
          // stressor was likely a testing window — recognisable confirmation ("yes, that hard
          // patch was then"). RC4: this used to be limited to the CURRENT Mahadasha, so a real
          // event in a PRIOR Mahadasha (e.g. a career break two Mahadashas ago) never surfaced.
          // Now any adult-age prior stressor sub-period qualifies; the nearest are chosen below.
          if(aen!=null && aen<now && isStressor(ad.lord)){
            pastWindows.push({ md:md.lord, ad:ad.lord, years:ayrs, sy:yr(ad.startDate),
              note: ad.lord+" sub-period within "+md.lord+" — a period when "+cfg.focus+" was likely tested, under pressure, or going through real change" });
          }
        }
      }
    }
    // Age-gate: for age-sensitive domains (marriage/career/children), a window is
    // only meaningful once the native reaches the real-term age. Compute the calendar
    // year the native turns realTermAge, and drop windows that end before it — a
    // relationship/career "activation" at age 2 is not a real-life event.
    let realTermYear = null;
    if(realTermAge!=null && birthDate){ try{ realTermYear = new Date(birthDate).getFullYear() + realTermAge; }catch(_){}}
    const yearOfEnd = (yrs)=>{ if(!yrs) return null; const m=String(yrs).match(/(\d{4})\s*$/); return m?parseInt(m[1],10):null; };
    const ageGate = (w)=>{ if(realTermYear==null) return true; const ey=yearOfEnd(w.years); return ey==null || ey>=realTermYear; };
    // 20-YEAR FORWARD CAP (owner rule): read nothing beyond report year + 20 — saves
    // length/tokens and removes the far-future "nothing until old age" frustration.
    const capYear20 = new Date().getFullYear() + 20;
    const startYearOf = (yrs)=>{ const m=String(yrs||"").match(/(\d{4})/); return m?parseInt(m[1],10):null; };
    const within20 = (w)=>{ const sy=startYearOf(w.years); return sy==null || sy<=capYear20; };
    const kw = adWindows.filter(ageGate).filter(within20).slice(0,8);
    // RC4: prefer the MOST RECENT testing windows (nearest to now), across all past
    // Mahadashas, so the reader recognises what they actually lived — not the earliest.
    const pw = pastWindows.filter(ageGate).sort((a,b)=>(b.sy||0)-(a.sy||0)).slice(0,4);
    const fw = forwardADs.filter(ageGate).filter(within20).slice(0,16);
    // LIKELY MARRIAGE/COMMITMENT WINDOW (Looking-back fix): surface the strongest PAST
    // *supportive* domain activation — the karaka / house-lord / benefic-occupant period
    // nearest to real-term age — so Looking Back can name WHEN the area was most likely to
    // have come to fruition (e.g. married), not only when it was tested. adWindows already
    // holds domain-relevant sub-periods; we pick the most recent past one led by a karaka
    // or house-lord (a fruition signature), preferring benefic lords.
    let likelyFruitionWindow=null; let likelyFruitionWindows=[];
    // Fruition windows only make sense for domains whose life-area produces discrete,
    // dateable EVENTS (meeting/marriage, a career step, a child, a sibling milestone, a
    // home/property move). For HEALTH and SELF there is no "when it came to fruition"
    // event — those are ongoing/constitutional — so we skip the two-window Looking-Back
    // there and let that section rest on pastWindows + the forward compass instead.
    const FRUITION_DOMAINS = new Set(["marriage","career","children","siblings","mother"]);
    if(FRUITION_DOMAINS.has(domainKey)) try{
      const benef = new Set(["Jupiter","Venus","Mercury","Moon"]);
      const nowYear = new Date().getFullYear();
      const birthYr = birthDate ? new Date(birthDate).getFullYear() : null;
      const pastDomain = adWindows.filter(w=>{ const ey=yearOfEnd(w.years); return ey!=null && ey< nowYear; })
        .filter(ageGate)
        // any of the widened domain activators counts (primary + supporting-house lords,
        // occupants, karaka, natural karakas) so real timing like a 2nd/5th-lord marriage
        // period, or a 6th/11th-lord career period, is caught — not only the primary lord.
        .filter(w=> domainActivators.has(w.ad))
        // A FRUITION window must not be one the engine ALREADY flagged as a TESTING window
        // (those live in pastWindows) — EXCEPT when the window is led by the house-lord or the
        // karaka itself. A period ruled by the 7th lord or the marriage karaka ACTIVATES the
        // event regardless of that planet's dignity: an afflicted (debilitated/combust) 7th lord
        // like Mercury here still marks the marriage window; its affliction colours HOW it
        // unfolds, it does not demote it to "mere testing". Without this exception the single
        // most important window (e.g. Venus-MD / Mercury-AD = karaka period activating the 7th
        // lord) was being discarded as a stressor sub-period — the V6 Native-2 timing error.
        .filter(w=> (w.ad===hLord || w.ad===karakaPlanet) ||
                    !pastWindows.some(pw=>pw.years===w.years && pw.ad===w.ad));
      // earliest ADULT such window is the likeliest FIRST fruition (met / career launch /
      // first child); a later distinct one is the culminating step (marriage / major advance /
      // further development). Looking Back names both so the reader connects chart to history.
      pastDomain.sort((a,b)=> (startYearOf(a.years)||0) - (startYearOf(b.years)||0));
      // When the Mahadasha ITSELF is the karaka's, the house-lord's, or the domain's NATURAL
      // significator (Venus for marriage, Jupiter for children, …), say so — that is a
      // doubly-strong activation (the significator's own major period), the likeliest true window.
      const NAT_KARAKA={ marriage:"Venus", children:"Jupiter", career:"Saturn", mother:"Moon", siblings:"Mars", self:"Sun" };
      const natK = NAT_KARAKA[domainKey];
      const mdNote=(w)=> w.md===karakaPlanet ? " within your "+w.md+" major period (the "+cfg.karaka+"'s own period)"
                       : w.md===hLord ? " within your "+w.md+" major period (your "+ordinalD(cfg.house)+"-lord's own period)"
                       : w.md===natK ? " within your "+w.md+" major period ("+w.md+", the natural significator of "+cfg.focus+")" : "";
      const noteOf=(w)=> (w.ad===karakaPlanet? (w.ad+" — the "+cfg.karaka+", your domain significator") : w.ad===hLord ? (w.ad+" — your "+ordinalD(cfg.house)+"-lord") : (w.ad+" — a supporting activation of this area")) + mdNote(w);
      const roleFirst = domainKey==="marriage" ? "the most likely window for meeting and a defining commitment"
        : domainKey==="career" ? "the most likely window for a first major step or launch in your working life"
        : domainKey==="children" ? "the most likely window for a first child or a major creative beginning"
        : domainKey==="siblings" ? "the most likely window for a defining development with siblings or in your own initiative and courage"
        : domainKey==="mother" ? "the most likely window for a significant home, property, or family turning point"
        : "the window when this area most likely first came to fruition";
      const roleSecond = domainKey==="marriage" ? "the most likely window for that commitment to have formalised into marriage or deepened decisively"
        : domainKey==="career" ? "the most likely window for a major advance, change, or consolidation in your career"
        : domainKey==="children" ? "the most likely window for a further child or a decisive development"
        : domainKey==="siblings" ? "the most likely window for a further significant development in this area"
        : domainKey==="mother" ? "the most likely window for another major home or family development"
        : "the most recent window of significant development in this area";
      // Two windows that read as the arc of a real life: the EARLIEST adult activator window
      // (meeting / defining commitment) and the LATEST significant past one (the culminating
      // step — marriage usually formalises later, not immediately after meeting). This is why
      // a case like meeting-in-college (1998–2001) then marriage-in-2009 is now captured:
      // the second window is the most RECENT past activator, not merely the next one.
      const picked=[];
      if(pastDomain.length){
        const first=pastDomain[0]; picked.push(first);
        const fy=startYearOf(first.years)||0;
        // The culminating window should land in a plausible EVENT-AGE band, not decades
        // later: marriage/first-major-step usually follows the meeting within the native's
        // 20s–30s, so prefer the EARLIEST qualifying window in that band rather than the most
        // recent activator (which overshot to a far-later period before this fix).
        const band = domainKey==="marriage" ? [22,40] : domainKey==="children" ? [24,44] : domainKey==="career" ? [20,42] : null;
        const inBand = (w)=>{ if(!band||birthYr==null) return true; const a=(startYearOf(w.years)||0)-birthYr; return a>=band[0] && a<=band[1]; };
        const after = (w)=> (startYearOf(w.years)||0)-fy>=2;
        const second = pastDomain.find((w,i)=> i>0 && after(w) && inBand(w))
                    || pastDomain.find((w,i)=> i>0 && after(w));
        if(second) picked.push(second);
      }
      likelyFruitionWindows = picked.map((w,i)=>({ years:w.years, lord:w.ad, md:w.md, note:noteOf(w),
        role: i===0 ? roleFirst : roleSecond }));
      likelyFruitionWindow = likelyFruitionWindows[0] || null;   // kept for back-compat
    }catch(_){}
    dashaTiming={ current, currentAD, relevantPeriods:rows.slice(0,6), keyWindows:kw, pastWindows:pw, forwardADs:fw, likelyFruitionWindow, likelyFruitionWindows, realTermAge, realTermYear };
    // now that timing exists, enrich the watch-out-for with the nearest key window
    if(flags.watchOutFor && dashaTiming.keyWindows){
      // AUDIT FIX (same bug class as the remedy past-window): keyWindows are chronological,
      // so [0] is usually a PAST window — a future caution must point at the nearest
      // UPCOMING window, or carry no date at all rather than a date already behind the reader.
      const w=dashaTiming.keyWindows.find(x=>x.upcoming);
      if(w) flags.watchOutFor += ` This is most worth attention around the ${w.years} window (the ${w.ad} sub-period within ${w.md}).`;
    }
    // RAHU-PERIOD CAUTION (classical Rahu nature): Rahu is the great amplifier of maya
    // (illusion), and it magnifies the significations of THE HOUSE IT OCCUPIES OR ASPECTS.
    // So a Rahu period distorts a given area of life ONLY when Rahu actually touches that
    // area's house or significator — it is NOT a blanket "any Rahu period = overindulgence /
    // new contacts" for every chart and domain (that was an over-generalisation). When Rahu
    // does touch the area, the caution names THAT house's themes as the amplified ones.
    const _curL  = dashaTiming.current  && dashaTiming.current.lord;
    const _curAD = dashaTiming.currentAD && dashaTiming.currentAD.ad;
    if(_curL==="Rahu" || _curAD==="Rahu"){
      const rahuHouse = d1P.Rahu && d1P.Rahu.house;
      const touches = (h)=> !!(h && rahuHouse && (rahuHouse===h || aspectsHouse("Rahu", rahuHouse, h)));
      const rahuTouchesDomain = touches(cfg.house)
        || (hLord && d1P[hLord] && touches(d1P[hLord].house))
        || (karakaPlanet && d1P[karakaPlanet] && touches(d1P[karakaPlanet].house));
      if(rahuTouchesDomain){
        flags.rahuPhaseCaution = "You are in a Rahu period, and Rahu touches your area of "+cfg.focus+" — it sits in or aspects that part of your chart. Rahu magnifies the significations of whatever house it touches, so through this stretch the themes of "+cfg.focus+" run unusually intense, and Rahu's nature is to distort judgment: what you are drawn to here can feel compelling yet prove illusory or unstable. The exact shape is yours to recognise — over-indulgence, fixation, restlessness, idealising more than is real, or chasing something new. Stay grounded, verify before committing, and avoid irreversible decisions taken from a place of intensity or restlessness.";
      }
    }
  }

  // ── Career Compass (career domain only): net-new, additive decision framework ──
  let careerCompass=null;
  if(domainKey==="career"){
    const _ama=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role==="Amatyakaraka")||{}).planet:null;
    try{ careerCompass = buildCareerCompass(hLord, lordPlacement, vargaChart, d9Houses, d9LagnaSign); }catch(_){ careerCompass=null; }
    try{ if(careerCompass) careerCompass.businessLean = buildBusinessLean(d1P, d1LagnaSign, _ama, compound); }catch(_){}
    try{ if(careerCompass) careerCompass.foreign = buildForeignCareer(d1P, d1LagnaSign, compound); }catch(_){}
    try{ if(careerCompass) careerCompass.nakshatra = (compound&&compound.nakshatra||[]).filter(n=> n.planet===hLord || n.planet===_ama); }catch(_){}
    try{ if(careerCompass) careerCompass.money = buildMoneyFlow(d1P, d1LagnaSign, compound, houseStates); }catch(_){}
    try{ if(careerCompass) careerCompass.rajaYogas = (compound&&compound.rajaYogas)||[]; }catch(_){}
    try{ if(careerCompass){ careerCompass.badhaka = (compound&&compound.badhaka)||null; careerCompass.combustion = (compound&&compound.combustion)||[]; careerCompass.retroStrength = (compound&&compound.retroStrength)||[]; } }catch(_){}
    try{ if(careerCompass){ const nk=(compound&&compound.nakshatra)||[]; const hints=[];
      const mn=nk.find(n=>n.planet==="Moon"); const hn=nk.find(n=>n.planet===hLord);
      if(mn&&NAK_SECTOR[mn.nakshatra]) hints.push({source:"Moon (vocational inclination)", nakshatra:mn.nakshatra, sectors:NAK_SECTOR[mn.nakshatra]});
      if(hn&&hn.planet!=="Moon"&&NAK_SECTOR[hn.nakshatra]) hints.push({source:"career ruler "+hLord, nakshatra:hn.nakshatra, sectors:NAK_SECTOR[hn.nakshatra]});
      careerCompass.sectorHints=hints; } }catch(_){}
    try{ if(careerCompass){ careerCompass.disruptions = buildCareerDisruptions(dashas, birthDate, d1LagnaSign, hLord, lordPlacement, d1P, _ama, compound, houseStates); } }catch(_){}
  }

  // ── Domain Compass (every NON-career domain): the same compound-state + multi-angle
  //    house depth that career already has, applied generically by domain parameters.
  let domainCompass=null;
  if(domainKey!=="career"){
    try{ domainCompass = buildDomainCompass(domainKey, cfg, hLord, karakaPlanet, d1P, d1LagnaSign, compound, houseStates); }catch(_){ domainCompass=null; }
  }

  // ── Owner-only sensitive indications for the NON-marriage domains (marriage sets its own,
  //    above, and nulls it for minors). Graded risk signals for the confidential owner edition;
  //    stripped from the client packet by the report writer.
  if(domainKey!=="marriage" && flags.ownerSensitive===undefined){
    try{ flags.ownerSensitive = buildOwnerSensitive(domainKey, d1P, d1LagnaSign, d9Houses, hLord, karakaPlanet, occupants); }catch(_){ flags.ownerSensitive=null; }
  }

  // ── Future Compass (all domains): consolidated, weighted, dated forward view ──
  let futureCompass=null;
  try{ futureCompass = buildFutureCompass(dashaTiming, domainKey, cfg, karakaPlanet, hLord, d1P, occupants); }catch(_){ futureCompass=null; }

  // ── Health: pair each live/upcoming period's planet with the BODY AREAS it governs ──
  // (Kalapurusha body map). So the report can say "the 2027–2030 Saturn stretch asks extra
  // attention on bones, joints, teeth and chronic conditions" — the body-part × dasha link
  // the owner asked to double-check, made explicit per window rather than left general.
  if(domainKey==="health" && dashaTiming){
    try{
      const bodyOf=(p)=> (PLANET_REMEDIES[p] && PLANET_REMEDIES[p].bodyAreas) || null;
      const hw=[];
      const cad=dashaTiming.currentAD;
      if(cad && cad.ad){ const b=bodyOf(cad.ad); if(b) hw.push({ years:cad.years||(dashaTiming.current&&dashaTiming.current.years)||"", planet:cad.ad, bodyAreas:b, when:"now" }); }
      (futureCompass && futureCompass.bands || []).forEach(band=>{ (band.drivers||[]).forEach(p=>{ const b=bodyOf(p); if(b && !hw.some(w=>w.planet===p && w.years===band.years)) hw.push({ years:band.years, planet:p, bodyAreas:b, when:"ahead" }); }); });
      if(hw.length) flags.healthWindows = hw.slice(0,5);
    }catch(_){}
  }

  // ── Remedy facts — two layers of "alignment practices" ───────────────────────────
  // (1) ONGOING domain-weakness: the chronically weak domain significator / house-lord
  //     (debilitated or in 6/8/12). This is a permanent chart feature, so its practice is
  //     an ONGOING habit for the area — NOT tied to a past dasha window (the old bug
  //     prescribed the 7th-lord's long-gone 2004–2007 window as if it were current).
  // (2) ACTIVE-PHASE: the CURRENTLY running Mahadasha lord — the present planetary
  //     weather — gets its own alignment practice regardless of whether it is a domain
  //     karaka, so a long MD like Rahu 2024–2042 is actually addressed. Dignity-aware:
  //     the 'ease off' line leads when the planet is weak.
  let remedyFacts=null;
  try {
    const kw2 = (dashaTiming && dashaTiming.keyWindows) || [];
    const curLord = (dashaTiming && dashaTiming.current) ? dashaTiming.current.lord : null;
    const curAD = (dashaTiming && dashaTiming.currentAD) ? dashaTiming.currentAD : null;
    const curYears = (dashaTiming && dashaTiming.current) ? dashaTiming.current.years : "";
    const mkPick = (p, kind)=>{
      const pp=d1P[p]; if(!pp || !PLANET_REMEDIES[p]) return null;
      const kb=PLANET_REMEDIES[p];
      const inDusthana=[6,8,12].includes(pp.house);
      const deb = pp.dignity==="Debilitated";
      const weak = deb || inDusthana;
      // Use ONLY this domain's temple — never fall back to the marriage temple, which would
      // surface a marriage temple inside a children/siblings/mother report. Empty is fine
      // (the navagraha + general temples still carry the section).
      const domTemple = (kb.temples && kb.temples[domainKey]) || "";
      // upcoming window for this planet (never a past one)
      const upWin = kw2.find(w=>(w.ad===p||w.md===p) && w.upcoming);
      return {
        planet:p, kind,                                        // "ongoing" | "active-phase"
        activePhase: kind==="active-phase",
        reason: deb ? (p+" is weak (debilitated) in your chart")
              : inDusthana ? (p+" sits in your "+ordinalD(pp.house)+" house, a house of testing")
              : (p+" is the planet currently running in your life"),
        role: p===karakaPlanet ? ("the "+cfg.karaka+", your "+cfg.focus+" significator")
              : p===hLord ? (p+", the ruler of your "+ordinalD(cfg.house)+" house of "+cfg.focus)
              : occupants.some(o=>o.planet===p) ? ("placed in your "+ordinalD(cfg.house)+" house of "+cfg.focus)
              : (kind==="active-phase" ? "the planet governing your current life-phase" : "active in this area"),
        // active-phase → the live MD window; ongoing weakness → nearest upcoming window if
        // any, otherwise framed as an ongoing habit (no misleading past date).
        window: kind==="active-phase" ? curYears : (upWin ? upWin.years : ""),
        whenActive: kind==="active-phase"
          ? ("now — you are in the "+p+" main phase"+(curYears?(" ("+curYears+")"):"")+(curAD?(", "+curAD.ad+" sub-phase "+curAD.years):""))
          : (upWin ? ("most concentrated around the "+upWin.years+" window") : "an ongoing habit for this area, worth holding steadily rather than tied to one date"),
        ongoing: kind==="ongoing",
        behavioral: kb.behavioral,
        avoid: weak ? (kb.whenWeak||"") : "",                   // dignity-aware: lead with 'ease off' only when weak
        daan: kb.daan, anchor: kb.anchor,
        navagrahaTemple: kb.navagrahaTemple,
        secondTemple: domTemple,
        bodyAreas: kb.bodyAreas,
      };
    };
    // (1) pick the single weakest domain focus planet (prefer debilitated, then dusthana)
    const focusSet = [...new Set([karakaPlanet, hLord, ...occupants.map(o=>o.planet)].filter(Boolean))];
    const weakFocus = focusSet.map(p=>({p,pp:d1P[p]})).filter(x=>x.pp && PLANET_REMEDIES[x.p] &&
        (x.pp.dignity==="Debilitated" || [6,8,12].includes(x.pp.house)))
      .sort((a,b)=> (a.pp.dignity==="Debilitated"?0:1)-(b.pp.dignity==="Debilitated"?0:1));
    const ongoingPick = weakFocus.length ? mkPick(weakFocus[0].p, "ongoing") : null;
    // (2) active-phase pick = current Mahadasha lord (skip if it IS the ongoing pick)
    const activePick = (curLord && curLord!==(ongoingPick&&ongoingPick.planet)) ? mkPick(curLord, "active-phase") : null;
    const picks = [activePick, ongoingPick].filter(Boolean);
    // Domain-level temple (e.g. the marriage temple) — surfaced whenever a remedy is raised.
    const domainTemple = (DOMAIN_TEMPLES && DOMAIN_TEMPLES[domainKey]) || null;
    if(picks.length) remedyFacts={ focus:picks.slice(0,2), general:GENERAL_TEMPLES, domainTemple };  // 1–2 remedies
  } catch(_){}

  // D9 placements WITH their signs, so the writer never infers a sign from the lagna
  // (root of V5 Error A: a D9 conjunction mislabelled with the lagna sign).
  const d9Placements={};
  try{ const li=V_SIGNS.indexOf(d9LagnaSign); if(li>=0){ for(const[h,arr] of Object.entries(d9Houses||{})){ const hn=+h; if(!hn) continue; const sign=V_SIGNS[(li+hn-1)%12]; (arr||[]).forEach(p=>{ if(p) d9Placements[p]={house:hn, sign}; }); } } }catch(_){}
  return {
    domainKey, title:cfg.title, focus:cfg.focus, house:cfg.house, houseName:ordinalD(cfg.house),
    karaka:cfg.karaka, karakaPlanet, divisional:cfg.varga, vargaLabel:cfg.vargaLabel,
    d1:{ lagnaSign:d1LagnaSign, houseLord:hLord, lordPlacement, occupants, placements:d1P },
    d9:{ lagnaSign:d9LagnaSign, houses:d9Houses, placements:d9Placements },
    vargaChart, convergences, flags, neechaBhanga, dashaTiming, dusthanaReadings, careerCompass, domainCompass, futureCompass, remedyFacts,
    lifeStage: flags.lifeStage
  };
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // Accept either pre-computed houses (from chart.js) or raw house data
    const d1 = { lagnaSign: body?.d1?.lagnaSign, houses: normalizeHouses(body?.d1?.houses) };
    const d9 = { lagnaSign: body?.d9?.lagnaSign, houses: normalizeHouses(body?.d9?.houses) };

    if (!d1.lagnaSign || !d9.lagnaSign) {
      return Response.json({ error:"D1 and D9 lagna signs are required." }, { status:400 });
    }

    const d1Degrees   = body?.d1?.degrees   || null;
    const d1Latitudes = body?.d1?.latitudes || null;

    // FIX 3: D9 combustion/war uses D1 sidereal degrees.
    // Combustion is a physical sky phenomenon (angular distance from Sun).
    // A planet combust in D1 is equally combust when assessing its D9 house —
    // the navamsha chart does not change the planet's actual solar proximity.
    // Passing empty degrees here was producing artificially clean D9 scores.
    const combustD1 = buildCombustFlags(d1Degrees);
    const warD1     = buildWarLosers(d1Degrees, d1Latitudes);
    const combustD9 = buildCombustFlags(d1Degrees);   // same physical degrees
    const warD9     = buildWarLosers(d1Degrees, d1Latitudes); // same physical latitudes

    const yogasD1 = detectYogas(d1);
    const yogasD9 = detectYogas(d9);

    const domains = DOMAIN_CONFIG.map(config =>
      buildDomainResult(d1, d9, config, combustD1, warD1, combustD9, warD9, yogasD1, yogasD9)
    );

    const summary = buildSummary(domains);

    // Build ChartStatements if dasha timeline and birthDate are provided
    let statements = null;
    const dashas    = body?.dashas    || null;
    const birthDate = body?.birthDate || null;
    const gender    = String(body?.gender || "unspecified").toLowerCase();
    const maritalStatus = String(body?.maritalStatus || "").toLowerCase();
    if (dashas && birthDate) {
      statements = buildAllStatements(d1, d9, domains, dashas, birthDate, yogasD1, yogasD9);
    }

    // Strip internal evidence fields before sending to client
    const clientDomains = domains.map(d => {
      const { _d1Result, _d9Result, ...rest } = d;
      return rest;
    });

    // Chart pattern + opening frame (always computed — no dasha needed)
    const classification = classifyChartPattern(d1, d9, yogasD1, yogasD9);
    const chartOpening   = generateChartOpening(classification, d1, d9);

    // Event flags (always computed)
    const combustForFlags = buildCombustFlags(d1Degrees);
    const eventFlags       = detectEventFlags(d1, d9, combustForFlags, yogasD1, yogasD9, classification);
    const compoundPatterns = detectCompoundPatterns(d1, d9, combustForFlags, yogasD1, yogasD9, classification);

    // Chara Karakas (Atmakaraka … Darakaraka) — auto-derived from D1 degrees.
    const charaKarakas = computeCharaKarakas(d1Degrees);

    // Domain-report facts packets (7 domains) — grounded source for the API writer.
    const domainFacts = {};
    if (d1Degrees && d1.lagnaSign) {
      // Ascendant longitude for varga-lagna computation. The chart provides
      // lagnaSign + lagnaDegree (degree-in-sign); reconstruct the exact absolute
      // longitude so divisional lagnas are precise (no mid-sign approximation).
      let ascLon = null;
      const lagDeg = body?.d1?.lagnaDegree;
      if (lagDeg != null && d1.lagnaSign) {
        const li = V_SIGNS.indexOf(d1.lagnaSign);
        if (li >= 0) ascLon = li * 30 + lagDeg;
      }
      if (ascLon == null && d1Degrees && d1Degrees.Lagna != null) ascLon = d1Degrees.Lagna;
      if (ascLon == null) {
        const li = V_SIGNS.indexOf(d1.lagnaSign);
        if (li >= 0) ascLon = li * 30 + 15; // last-resort fallback
      }
      for (const key of Object.keys(DOMAIN_REPORT_CONFIG)) {
        domainFacts[key] = buildDomainFacts(key, d1Degrees, d1.lagnaSign, d9.houses, d9.lagnaSign, charaKarakas, dashas, birthDate, ascLon, (body?.d1?.retro||null), gender, maritalStatus);
      }
    }

    return Response.json({
      generatedAt: new Date().toISOString(),
      summary,
      domains: clientDomains,
      statements,
      classification,
      chartOpening,
      eventFlags,
      compoundPatterns,
      charaKarakas,
      domainFacts,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Unexpected error." }, { status:500 });
  }
}
