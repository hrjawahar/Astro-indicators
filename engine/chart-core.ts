// ─────────────────────────────────────────────────────────────────────────────
// AstroIndicators · Engine step-zero: chart-core
// Takes raw sidereal (Lahiri) longitudes from the existing chart.js ephemeris and
// derives everything the domain modules need: dignities (D1 & D9), whole-sign
// houses, navamsa, combustion, and the full Vimshottari MD→AD timeline.
// This module NEVER computes ephemeris — it consumes longitudes and reasons on them.
// ─────────────────────────────────────────────────────────────────────────────

export type Graha =
  | "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn" | "Rahu" | "Ketu";
export type Rashi =
  | "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo"
  | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";
export type Dignity =
  | "exalted" | "debilitated" | "own" | "friend" | "neutral" | "enemy";

export const SIGNS: Rashi[] = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
];

const SIGN_LORD: Record<Rashi, Graha> = {
  Aries:"Mars", Taurus:"Venus", Gemini:"Mercury", Cancer:"Moon", Leo:"Sun", Virgo:"Mercury",
  Libra:"Venus", Scorpio:"Mars", Sagittarius:"Jupiter", Capricorn:"Saturn", Aquarius:"Saturn", Pisces:"Jupiter",
};
const EXALT: Partial<Record<Graha, Rashi>> = {
  Sun:"Aries", Moon:"Taurus", Mars:"Capricorn", Mercury:"Virgo",
  Jupiter:"Cancer", Venus:"Pisces", Saturn:"Libra", Rahu:"Taurus", Ketu:"Scorpio",
};
const DEBIL: Partial<Record<Graha, Rashi>> = {
  Sun:"Libra", Moon:"Scorpio", Mars:"Cancer", Mercury:"Pisces",
  Jupiter:"Capricorn", Venus:"Virgo", Saturn:"Aries", Rahu:"Scorpio", Ketu:"Taurus",
};
const OWN: Partial<Record<Graha, Rashi[]>> = {
  Sun:["Leo"], Moon:["Cancer"], Mars:["Aries","Scorpio"], Mercury:["Gemini","Virgo"],
  Jupiter:["Sagittarius","Pisces"], Venus:["Taurus","Libra"], Saturn:["Capricorn","Aquarius"],
};
// Natural (naisargika) friendships → used for relational dignity (friend/neutral/enemy)
const FRIENDS: Record<Graha, Graha[]> = {
  Sun:["Moon","Mars","Jupiter"], Moon:["Sun","Mercury"], Mars:["Sun","Moon","Jupiter"],
  Mercury:["Sun","Venus"], Jupiter:["Sun","Moon","Mars"], Venus:["Mercury","Saturn"],
  Saturn:["Mercury","Venus"], Rahu:["Venus","Saturn","Mercury"], Ketu:["Mars","Venus","Saturn"],
};
const ENEMIES: Record<Graha, Graha[]> = {
  Sun:["Venus","Saturn"], Moon:[], Mars:["Mercury"], Mercury:["Moon"],
  Jupiter:["Mercury","Venus"], Venus:["Sun","Moon"], Saturn:["Sun","Moon","Mars"],
  Rahu:["Sun","Moon","Mars"], Ketu:["Sun","Moon"],
};
// Combustion thresholds (deg from Sun); Mercury/Venus tighter when retrograde
const COMBUST: Partial<Record<Graha, number>> = {
  Moon:12, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15,
};

// Vimshottari
const VIM_ORDER: Graha[] = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const VIM_YEARS: Record<Graha, number> = {
  Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17,
};
const NAK = 360 / 27;            // 13°20'
const YEAR_DAYS = 365.2425;      // tropical-year length used for dasha date mapping

// ── input / output types ─────────────────────────────────────────────────────
export interface GrahaInput { graha: Exclude<Graha,"Ketu">; lon: number; retro?: boolean; }
export interface BirthInput {
  birthISO: string;              // birth moment (any tz-aware ISO) — anchors the dasha clock
  asc: number;                   // ascendant sidereal longitude 0–360 (from ephemeris)
  positions: GrahaInput[];       // 8 grahas (Ketu derived from Rahu)
  gender?: "male" | "female" | "unspecified";   // optional — enables gender-specific kalatra-kāraka
}
export interface PlacedGraha {
  graha: Graha; lon: number; rashi: Rashi; degInSign: number; house: number;
  dignityD1: Dignity; navamsa: Rashi; navHouse: number; dignityD9: Dignity;
  retro: boolean; combust: boolean;
}
export interface Dasha { lord: Graha; startISO: string; endISO: string; antar?: Dasha[]; }
export interface ChartData {
  lagna: Rashi; lagnaDeg: number; d9Lagna: Rashi;
  gender: "male" | "female" | "unspecified";
  spouseKaraka: Graha | null;      // Venus for male, Jupiter for female, null if unspecified
  grahas: Record<Graha, PlacedGraha>;
  occupants: Record<number, Graha[]>;                 // house → grahas
  lordOf(house: number): Graha;
  houseOfLordOf(house: number): number;               // where a house's lord sits
  planetsIn(house: number): Graha[];
  dignityD1(g: Graha): Dignity;
  dignityD9(g: Graha): Dignity;
  isDusthana(g: Graha): boolean;                       // in 6/8/12
  dasha: Dasha[];
  mdAt(iso: string): { md: Graha; ad: Graha } | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const norm = (x: number) => ((x % 360) + 360) % 360;
const signIndex = (lon: number) => Math.floor(norm(lon) / 30);
export const rashiOf = (lon: number): Rashi => SIGNS[signIndex(lon)];
// classical navamsa == continuous 1/9-sign mapping: floor(lon / 3°20') mod 12
export const navamsaOf = (lon: number): Rashi => SIGNS[Math.floor(norm(lon) / (30 / 9)) % 12];

function dignity(g: Graha, rashi: Rashi): Dignity {
  if (EXALT[g] === rashi) return "exalted";
  if (DEBIL[g] === rashi) return "debilitated";
  if ((OWN[g] ?? []).includes(rashi)) return "own";
  const lord = SIGN_LORD[rashi];
  if (lord === g) return "own";
  if (FRIENDS[g].includes(lord)) return "friend";
  if (ENEMIES[g].includes(lord)) return "enemy";
  return "neutral";
}
function combust(g: Graha, lon: number, sunLon: number, retro: boolean): boolean {
  const thr = COMBUST[g]; if (!thr || g === "Sun") return false;
  let d = Math.abs(norm(lon - sunLon)); if (d > 180) d = 360 - d;
  const eff = (retro && (g === "Mercury" || g === "Venus")) ? thr - 2 : thr;
  return d < eff;
}

// ── Vimshottari ──────────────────────────────────────────────────────────────
function addYears(iso: string, yrs: number): string {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + Math.round(yrs * YEAR_DAYS)); return d.toISOString();
}
export function vimshottari(moonLon: number, birthISO: string, untilYear = 2100): Dasha[] {
  const nakIdx = Math.floor(norm(moonLon) / NAK);
  const startLord = VIM_ORDER[nakIdx % 9];
  const frac = (norm(moonLon) % NAK) / NAK;              // portion of nakshatra elapsed
  const balance = VIM_YEARS[startLord] * (1 - frac);    // remaining years of first MD
  const seq: Graha[] = [];
  const s = VIM_ORDER.indexOf(startLord);
  for (let i = 0; i < 9; i++) seq.push(VIM_ORDER[(s + i) % 9]);

  const out: Dasha[] = [];
  let cur = birthISO;
  seq.forEach((lord, i) => {
    const dur = i === 0 ? balance : VIM_YEARS[lord];
    const end = addYears(cur, dur);
    out.push({ lord, startISO: cur, endISO: end, antar: antardashas(lord, cur, dur, i === 0 ? frac : 0) });
    cur = end;
  });
  // extend beyond first cycle if needed
  while (new Date(cur).getUTCFullYear() < untilYear) {
    const lord = VIM_ORDER[(VIM_ORDER.indexOf(out[out.length - 1].lord) + 1) % 9];
    const end = addYears(cur, VIM_YEARS[lord]);
    out.push({ lord, startISO: cur, endISO: end, antar: antardashas(lord, cur, VIM_YEARS[lord], 0) });
    cur = end;
  }
  return out;
}
function antardashas(mdLord: Graha, mdStartISO: string, mdYears: number, elapsedFrac: number): Dasha[] {
  // AD order starts from the MD lord; each AD = mdYears * (adYears/120)
  const s = VIM_ORDER.indexOf(mdLord);
  const full: { lord: Graha; yrs: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const lord = VIM_ORDER[(s + i) % 9];
    full.push({ lord, yrs: mdYears * (VIM_YEARS[lord] / 120) });
  }
  // if MD is the partial birth-MD, skip the already-elapsed portion
  let skip = elapsedFrac > 0 ? elapsedFrac * mdYears / (1 - elapsedFrac) : 0; // elapsed years of this MD before birth
  const out: Dasha[] = []; let cur = mdStartISO;
  for (const a of full) {
    let dur = a.yrs;
    if (skip > 0) { if (skip >= dur) { skip -= dur; continue; } dur -= skip; skip = 0; }
    const end = addYears(cur, dur);
    out.push({ lord: a.lord, startISO: cur, endISO: end });
    cur = end;
  }
  return out;
}

// ── build ────────────────────────────────────────────────────────────────────
export function buildChart(input: BirthInput): ChartData {
  const li = signIndex(input.asc);
  const lagna = SIGNS[li];
  const sun = input.positions.find(p => p.graha === "Sun")!;
  const rahu = input.positions.find(p => p.graha === "Rahu")!;
  const all: GrahaInput[] = [...input.positions, { graha: "Ketu" as any, lon: norm(rahu.lon + 180), retro: true }];

  const grahas = {} as Record<Graha, PlacedGraha>;
  const occupants: Record<number, Graha[]> = {}; for (let h = 1; h <= 12; h++) occupants[h] = [];

  for (const p of all) {
    const g = p.graha as Graha;
    const rashi = rashiOf(p.lon);
    const house = ((signIndex(p.lon) - li + 12) % 12) + 1;
    const nav = navamsaOf(p.lon);
    const navHouse = ((SIGNS.indexOf(nav) - navSignIndexForLagna(input.asc) + 12) % 12) + 1;
    grahas[g] = {
      graha: g, lon: norm(p.lon), rashi, degInSign: +(norm(p.lon) % 30).toFixed(2), house,
      dignityD1: dignity(g, rashi), navamsa: nav, navHouse, dignityD9: dignity(g, nav),
      retro: !!p.retro, combust: combust(g, p.lon, sun.lon, !!p.retro),
    };
    occupants[house].push(g);
  }

  const moon = grahas.Moon;
  const dasha = vimshottari(moon.lon, input.birthISO);
  const d9Lagna = navamsaOf(input.asc);

  const lordOf = (house: number): Graha => SIGN_LORD[SIGNS[(li + house - 1) % 12]];

  const gender = input.gender ?? "unspecified";
  const spouseKaraka: Graha | null = gender === "male" ? "Venus" : gender === "female" ? "Jupiter" : null;
  return {
    lagna, lagnaDeg: +(norm(input.asc) % 30).toFixed(2), d9Lagna, gender, spouseKaraka, grahas, occupants,
    lordOf,
    houseOfLordOf: (house) => grahas[lordOf(house)].house,
    planetsIn: (house) => occupants[house],
    dignityD1: (g) => grahas[g].dignityD1,
    dignityD9: (g) => grahas[g].dignityD9,
    isDusthana: (g) => [6, 8, 12].includes(grahas[g].house),
    dasha,
    mdAt: (iso) => {
      const t = new Date(iso).getTime();
      for (const md of dasha) {
        if (t >= new Date(md.startISO).getTime() && t < new Date(md.endISO).getTime()) {
          const ad = (md.antar ?? []).find(a => t >= new Date(a.startISO).getTime() && t < new Date(a.endISO).getTime());
          return { md: md.lord, ad: ad ? ad.lord : md.lord };
        }
      }
      return null;
    },
  };
}
// navamsa house is measured from the D9 lagna
function navSignIndexForLagna(asc: number): number { return SIGNS.indexOf(navamsaOf(asc)); }