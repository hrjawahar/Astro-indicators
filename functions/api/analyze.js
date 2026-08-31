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
function d1PlacementsFromDegrees(degrees, lagnaSign){
  if(!degrees||lagnaSign==null) return null;
  const lagIdx=V_SIGNS.indexOf(lagnaSign); if(lagIdx<0) return null;
  const out={};
  for(const[p,lon] of Object.entries(degrees)){ if(lon==null)continue; const si=vSi(lon); const house=((si-lagIdx+12)%12)+1; out[p]={sign:V_SIGNS[si],house,degInSign:+vDis(lon).toFixed(1),dignity:vDig(p,V_SIGNS[si])}; }
  return out;
}
function houseLord(lagnaSign, houseNum){
  const lagIdx=V_SIGNS.indexOf(lagnaSign); if(lagIdx<0) return null;
  return V_LORD[V_SIGNS[(lagIdx+houseNum-1)%12]];
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
function buildDomainFacts(domainKey, d1Degrees, d1LagnaSign, d9Houses, d9LagnaSign, charaKarakas, dashas, birthDate, ascLon){
  const cfg=DOMAIN_REPORT_CONFIG[domainKey]; if(!cfg) return null;
  const d1P=d1PlacementsFromDegrees(d1Degrees, d1LagnaSign);
  if(!d1P) return null;
  const hLord=houseLord(d1LagnaSign, cfg.house);
  const lordPlacement=hLord?d1P[hLord]:null;
  const occupants=Object.entries(d1P).filter(([p,v])=>v.house===cfg.house && p!=="Lagna").map(([p,v])=>({planet:p,...v}));
  const karakaPlanet=(charaKarakas&&charaKarakas.karakas)?(charaKarakas.karakas.find(k=>k.role===cfg.karaka)||{}).planet:null;
  let vargaChart=null;
  if(cfg.varga && cfg.varga!=="D9"){ vargaChart=buildVargaChart(cfg.varga, d1Degrees, ascLon); }
  const convergences=[];
  if(vargaChart && lordPlacement){
    const vLord=houseLord(vargaChart.lagnaSign, cfg.house);
    const vLordPlace=vLord?vargaChart.placements[vLord]:null;
    if(vLordPlace && lordPlacement.house===vLordPlace.house){
      convergences.push(`In BOTH D1 and ${cfg.varga}, the ${ordinalD(cfg.house)}-house lord sits in the ${ordinalD(lordPlacement.house)} house — a repeated, independent signal.`);
    }
  }
  if(karakaPlanet && d1P[karakaPlanet] && (d1P[karakaPlanet].dignity==="Exalted"||d1P[karakaPlanet].dignity==="Own sign")){
    convergences.push(`${karakaPlanet} (the ${cfg.karaka}) is strongly placed in D1 — a primary support for this domain.`);
  }
  const flags={};
  if(domainKey==="marriage"){
    const sevOcc=occupants.map(o=>o.planet);
    const ketuIn7=sevOcc.includes("Ketu"), rahuIn7=sevOcc.includes("Rahu");
    const maleficIn7=sevOcc.some(p=>["Saturn","Mars","Rahu","Ketu","Sun"].includes(p));
    const lordWeak=lordPlacement&&(lordPlacement.dignity==="Debilitated"||[6,8,12].includes(lordPlacement.house));
    const afflicted = ketuIn7 || (maleficIn7 && lordWeak) || (rahuIn7 && lordWeak);
    flags.marriageAfflicted=!!afflicted;
    flags.remarriageIndicated=!!afflicted;
  }
  if(domainKey==="children"){
    const fifthAfflicted=(lordPlacement&&(lordPlacement.dignity==="Debilitated"||[6,8,12].includes(lordPlacement.house)))||occupants.some(o=>["Saturn","Mars","Rahu","Ketu"].includes(o.planet));
    flags.progenyHighCare=!!fifthAfflicted;
  }
  if(domainKey==="health"){ flags.healthWatch=true; }

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

  // Dasha timing relevant to this domain — the current period + which upcoming
  // Mahadashas activate the domain's key planets (house lord, karaka, occupants).
  let dashaTiming=null;
  if(dashas && Array.isArray(dashas) && dashas.length){
    const keyPlanets = new Set([hLord, karakaPlanet, ...occupants.map(o=>o.planet)].filter(Boolean));
    const now = Date.now();
    const rows=[];
    let current=null;
    for(const md of dashas){
      const st=md.startDate?new Date(md.startDate).getTime():null;
      const en=md.endDate?new Date(md.endDate).getTime():null;
      const yrs = (st!=null&&en!=null) ? (new Date(md.startDate).getFullYear()+"–"+new Date(md.endDate).getFullYear()) : "";
      const relevant = keyPlanets.has(md.lord);
      if(st!=null&&en!=null&&now>=st&&now<en) current={lord:md.lord,years:yrs,relevant};
      if(relevant) rows.push({lord:md.lord,years:yrs,note:(md.lord===hLord?"rules your "+ordinalD(cfg.house)+" house of "+cfg.focus:md.lord===karakaPlanet?"the "+cfg.karaka+", your domain significator":"active in your "+ordinalD(cfg.house)+" house")});
    }
    dashaTiming={ current, relevantPeriods:rows.slice(0,6) };
  }

  return {
    domainKey, title:cfg.title, focus:cfg.focus, house:cfg.house, houseName:ordinalD(cfg.house),
    karaka:cfg.karaka, karakaPlanet, divisional:cfg.varga, vargaLabel:cfg.vargaLabel,
    d1:{ lagnaSign:d1LagnaSign, houseLord:hLord, lordPlacement, occupants, placements:d1P },
    d9:{ lagnaSign:d9LagnaSign, houses:d9Houses },
    vargaChart, convergences, flags, neechaBhanga, dashaTiming
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
        domainFacts[key] = buildDomainFacts(key, d1Degrees, d1.lagnaSign, d9.houses, d9.lagnaSign, charaKarakas, dashas, birthDate, ascLon);
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
