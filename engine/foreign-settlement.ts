// ─────────────────────────────────────────────────────────────────────────────
// Module: Foreign Settlement & Visa  (Mobility & Fortune)
// house-lord-in-12th (foreign residence) + Rahu/Saturn involvement, D1×D9 composite,
// with the migration-TYPE named by which lord sits in the 12th, and the next foreign-
// activation window (12th-lord / Rahu / Saturn dasha). GUARDRAIL: visa (favourable
// window, never approval). Validated: Neethu, Rekha, Daya, Dhanasekar (case-8).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, kendraTrikona, bandFromScore,
         confidenceFromConvergence, intensityFromNet, nextPeakWindow } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function foreignSettlement(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let s = 0;
  const g = c.grahas;

  // which significant house-lords sit in the 12th (foreign) — names the migration TYPE
  const lordsInTwelfth: { house: number; lord: Graha }[] = [];
  for (const h of [4, 9, 10, 5, 1]) { const L = c.lordOf(h); if (g[L].house === 12) lordsInTwelfth.push({ house: h, lord: L }); }
  if (lordsInTwelfth.length) {
    s += lordsInTwelfth.length >= 2 ? 3 : 2;
    for (const { house, lord } of lordsInTwelfth)
      F.push({ chart:"D1", scope:"LORD", detail:`the ${ordinal(house)}-lord ${lord} sits in the 12th — a settle-abroad signature`, weight: 2 });
  }

  // Rahu on the mobility axis (4/7/9/12) — crossing boundaries
  if ([4,7,9,12].includes(g.Rahu.house)) { s += 1; F.push({ chart:"D1", scope:"PLANET", detail:`Rahu in the ${g.Rahu.house}th supports crossing borders`, weight:1 }); }
  // 12th tenanted / 12th-lord well-disposed
  if (c.planetsIn(12).length > 0) { s += 1; F.push({ chart:"D1", scope:"HOUSE", detail:"an active 12th house (foreign lands / distant residence)", weight:1 }); }
  const L12 = c.lordOf(12);
  if (veryStrong(c.dignityD1(L12)) || kendraTrikona(g[L12].house)) { s += 1; }
  // 9th (long journeys / fortune abroad) linked to 12th
  if (g[c.lordOf(9)].house === 12 || g[L12].house === 9) { s += 1; F.push({ chart:"D1", scope:"YOGA", detail:"the fortune (9th) and foreign (12th) axes are linked", weight:1 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"no strong foreign-settlement signature — life is likely rooted at home", weight:1 });

  // ── band ────────────────────────────────────────────────────────────────────
  const { band } = bandFromScore(s,
    [{ band:"STRONG", min:4 }, { band:"MODERATE", min:2 }, { band:"WEAK", min:-Infinity }], 8, 0);

  // migration type suffix (which lord in 12th)
  const typeMap: Record<number, string> = { 4: "RELOCATE", 9: "STUDY", 10: "CAREER", 5: "FAMILY", 1: "SELF" };
  const primaryType = lordsInTwelfth[0] ? typeMap[lordsInTwelfth[0].house] : "";
  const outcome = (band === "STRONG" ? "FOREIGN_WINDOW_STRONG" : band === "MODERATE" ? "FOREIGN_POSSIBLE_EFFORT" : "FOREIGN_LIMITED")
                + (primaryType ? "_" + primaryType : "");
  const confidence = confidenceFromConvergence(s);
  const intensity = intensityFromNet(s);

  // ── next foreign-activation window ──────────────────────────────────────────
  const foreignActivation = (lord: Graha): number => {
    let v = 0;
    if (c.lordOf(12) === lord) v += 3;
    if (lord === "Rahu") v += 2;
    if (lord === "Saturn") v += 1;
    if (lordsInTwelfth.some(x => x.lord === lord)) v += 2;
    if (c.lordOf(9) === lord) v += 1;
    return v;
  };
  const peak = band === "WEAK" ? null : nextPeakWindow(c, foreignActivation, nowISO, "Favourable window to pursue relocation / visa steps");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  const typeWord = primaryType === "STUDY" ? "for study or higher purpose"
                 : primaryType === "CAREER" ? "through your career/work"
                 : primaryType === "RELOCATE" ? "as a move away from your homeland"
                 : primaryType === "FAMILY" ? "woven with family or creative life" : "";
  const step = band === "STRONG"
    ? `Your chart carries a strong settle-abroad signature${typeWord ? ", most naturally " + typeWord : ""}. This is a favourable window to actively pursue relocation and visa steps — put your effort in; the wind is at your back, and the outcome rests on your action, not on any guarantee.`
    : band === "MODERATE"
      ? "Foreign opportunities are open to you with effort. Pursue relocation/visa steps in your favourable windows and keep your documentation strong — momentum is workable, not automatic."
      : "Your chart leans toward a life rooted closer to home; a foreign move is possible but would take sustained, deliberate effort rather than coming naturally.";

  return {
    module_id: "MOD-MOBILITY-FOREIGN",
    category: "MOBILITY",
    question: "Do I have foreign-settlement / going-abroad indications, and when are they favourable?",
    band_scale: "MOBILITY",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: outcome,
    teaser: band === "STRONG" ? "Your chart points strongly toward a life that crosses borders." : band === "MODERATE" ? "Foreign horizons are open to you with effort." : "Your chart leans toward roots close to home.",
    proactive_step: step,
    owner_only: false,
    guardrail: "visa",
  };
}

function ordinal(n: number): string { return n === 1 ? "1st" : n === 4 ? "4th" : n === 5 ? "5th" : n === 9 ? "9th" : n === 10 ? "10th" : n + "th"; }