// ─────────────────────────────────────────────────────────────────────────────
// Module: Career Launch & Stability  (Career & Wealth)
// Net-balance-in-the-10th scoring (case-6), the D9 durability modifier, and the
// stability-vs-satisfaction two-axis split. Bands: STRONG · STEADY · FLUCTUATING · WEAK.
// Validated targets: steady-corporate charts → STRONG/STEADY; disrupted careers → FLUCTUATING/WEAK.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, okStrong, weakDig, BENEFICS, MALEFICS,
         kendraTrikona, dusthana, intensityFromNet, bandFromScore,
         confidenceFromConvergence, nextPeakWindow, careerActivation } from "../shared";
type Factor = EngineFact["converging_factors"][number];

export function careerStability(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let sup = 0, det = 0;
  const g = c.grahas;
  const L10 = c.lordOf(10);

  // ── 10th-lord condition ─────────────────────────────────────────────────────
  if (veryStrong(c.dignityD1(L10))) { sup += 2;
    F.push({ chart:"D1", scope:"LORD", detail:`career-lord ${L10} is dignified`, weight:2 }); }
  else if (c.dignityD1(L10) === "friend") { sup += 1;
    F.push({ chart:"D1", scope:"LORD", detail:`career-lord ${L10} is well-disposed`, weight:1 }); }
  else if (weakDig(c.dignityD1(L10))) { det += 2;
    F.push({ chart:"D1", scope:"LORD", detail:`career-lord ${L10} is weak`, weight:2 }); }
  if (kendraTrikona(g[L10].house)) { sup += 2;
    F.push({ chart:"D1", scope:"LORD", detail:"career-lord in a strong (angular/trine) house", weight:2 }); }
  else if (g[L10].house === 11) { sup += 1;
    F.push({ chart:"D1", scope:"LORD", detail:"career-lord in the 11th — career yields steady gains", weight:1 }); }
  else if (dusthana(g[L10].house)) { det += 2;
    F.push({ chart:"D1", scope:"LORD", detail:`career-lord in a difficult ${g[L10].house}th house`, weight:2 }); }

  // ── the 10th house: malefics here give DRIVE (upachaya); only debilitation hurts ─
  for (const occ of c.planetsIn(10)) {
    const dig = c.dignityD1(occ);
    if (dig === "debilitated") { det += 1;
      F.push({ chart:"D1", scope:"HOUSE", detail:`debilitated ${occ} unsettles the career house`, weight:1 }); }
    else if (BENEFICS.includes(occ)) { sup += 1;
      F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} steadies the career house`, weight:1 }); }
    else if (["Sun","Mars","Saturn"].includes(occ)) { sup += 1;
      F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} lends drive and authority to the career house`, weight:1 }); }
  }

  // ── Saturn (perseverance/karma kāraka) ──────────────────────────────────────
  if (veryStrong(c.dignityD1("Saturn"))) { sup += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"dignified Saturn lends perseverance and staying-power", weight:1 }); }
  else if (g.Saturn.retro && weakDig(c.dignityD1("Saturn"))) { det += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"weak retrograde Saturn brings restarts and inconsistency", weight:1 }); }

  // ── D9 durability of the career-lord ────────────────────────────────────────
  if (veryStrong(c.dignityD9(L10))) { sup += 2;
    F.push({ chart:"D9", scope:"LORD", detail:"career-lord sustains in navamsa — durable footing", weight:3 }); }
  else if (weakDig(c.dignityD9(L10))) { det += 2;
    F.push({ chart:"D9", scope:"LORD", detail:"career-lord weak in navamsa — durability is tested", weight:3 }); }

  // ── satisfaction axis (Moon relative to the 10th) ───────────────────────────
  let satisfaction: "SATISFIED" | "MIXED" | "UNSATISFIED" = "MIXED";
  if (g.Moon.house === 10 && weakDig(c.dignityD1("Moon"))) { satisfaction = "UNSATISFIED";
    F.push({ chart:"D1", scope:"PLANET", detail:"afflicted Moon in the career house — fulfilment runs low", weight:2 }); }
  else if (okStrong(c.dignityD1("Moon")) && [1,4,5,7,9,10,11].includes(g.Moon.house)) satisfaction = "SATISFIED";

  // ── verdict ─────────────────────────────────────────────────────────────────
  const net = sup - det;
  const { band } = bandFromScore(net,
    [{ band:"STRONG", min:5 }, { band:"STEADY", min:2 }, { band:"FLUCTUATING", min:-1 }, { band:"WEAK", min:-Infinity }],
    11, -6);
  const confidence = confidenceFromConvergence(Math.max(sup, det));   // confidence = Vedic convergence, not band-proximity
  const peak = nextPeakWindow(c, careerActivation(c), nowISO, "Career-activation window");
  const outcome = band === "STRONG" ? "CAREER_STABLE"
                : band === "STEADY" ? "CAREER_STEADY_MINOR_DIPS"
                : band === "FLUCTUATING" ? "CAREER_INTERRUPTED" : "CAREER_UNSETTLED";
  const intensity = intensityFromNet(net);

  const satNote = satisfaction === "UNSATISFIED"
    ? " Even where the position holds, day-to-day fulfilment may feel thin — factor that into your choices."
    : satisfaction === "SATISFIED" ? " The work also tends to feel personally rewarding." : "";

  const proactive = (band === "STRONG" || band === "STEADY")
    ? "Build long-term equity where you are — depth and continuity are your advantage." + (satisfaction === "UNSATISFIED" ? " Seek roles that engage you, not just ones that are secure." : "")
    : "Expect a non-linear path; keep skills portable and a financial buffer, and treat changes as normal rather than failures.";

  return {
    module_id: "MOD-CAREER-STABILITY",
    category: "CAREER",
    question: "How stable and continuous is my career path?",
    band_scale: "CAREER_STABILITY",
    band,
    intensity: intensity as any,
    confidence,
    converging_factors: F,
    timing_windows: peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [],
    coded_outcome: outcome,
    teaser: (band === "STRONG" || band === "STEADY")
      ? "Your chart carries a 'steady climber' imprint — you compound advantage over time."
      : "Your chart carries a 'restless mover' imprint — your path advances in leaps and pivots, not a straight line.",
    proactive_step: proactive + satNote,
    owner_only: false,
    guardrail: "none",
  };
}