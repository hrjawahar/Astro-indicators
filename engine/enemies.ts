// ─────────────────────────────────────────────────────────────────────────────
// Module: Enemies, Rivals & Obstacles  (Crisis, Debt & Legal)  — REBUILT (provisional)
// Extends the validated 6th-house engine to adversaries/rivals: positioning against
// open opponents (strong 6th-lord / malefics in the 6th upachaya), courage (3rd),
// and allies (strong 11th). PLACEMENT-ONLY: no timing windows.
// GUARDRAIL: legal — favourable POSITIONING, never a guaranteed win over anyone.
// Bands: FAVOURABLE · CONTESTED · HEAVY. Provisional per CALIBRATION_DEBT.md.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, upachaya, dusthana, kendraTrikona,
         bandFromScore, confidenceFromConvergence, intensityFromNet } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function enemies(c: ChartData): EngineFact {
  const F: Factor[] = [];
  let s = 0;
  const g = c.grahas;
  const L6 = c.lordOf(6), L3 = c.lordOf(3), L11 = c.lordOf(11);

  // ── positioning against open adversaries (the validated 6th-house read) ─────
  if (veryStrong(c.dignityD1(L6)) || upachaya(g[L6].house)) { s += 2;
    F.push({ chart:"D1", scope:"LORD", detail:`the adversaries-lord ${L6} is strong/well-placed — rivals rarely gain the upper hand`, weight:2 }); }
  else if (weakDig(c.dignityD1(L6)) || dusthana(g[L6].house)) { s -= 1;
    F.push({ chart:"D1", scope:"LORD", detail:`the adversaries-lord ${L6} is weakened — friction tends to drain rather than resolve`, weight:1 }); }
  for (const occ of c.planetsIn(6)) if (["Mars","Saturn","Rahu"].includes(occ)) { s += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the 6th — classical strength to subdue opposition`, weight:2 }); break; }

  // ── courage / initiative (3rd) ──────────────────────────────────────────────
  if (veryStrong(c.dignityD1(L3)) || veryStrong(c.dignityD1("Mars"))) { s += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"strong courage-significators — you meet opposition head-on", weight:1 }); }

  // ── allies (a strong 11th surrounds you with support) ───────────────────────
  if (veryStrong(c.dignityD1(L11)) || kendraTrikona(g[L11].house) || g[L11].house === 11) { s += 1;
    F.push({ chart:"D1", scope:"LORD", detail:"a strong allies-house — support networks tilt contests your way", weight:1 }); }

  // ── D9 durability of the standing ───────────────────────────────────────────
  if (veryStrong(c.dignityD9(L6))) { s += 1; }
  else if (weakDig(c.dignityD9(L6))) { s -= 1;
    F.push({ chart:"D9", scope:"LORD", detail:"the adversaries-lord weakens in the navamsa — hold your ground with preparation", weight:1 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"open opposition is not a prominent theme in this chart", weight:1 });

  const { band } = bandFromScore(s,
    [{ band:"FAVOURABLE", min:3 }, { band:"CONTESTED", min:-2 }, { band:"HEAVY", min:-Infinity }], 7, -4);
  const confidence = confidenceFromConvergence(Math.abs(s));
  const intensity = intensityFromNet(s);
  const outcome = band === "FAVOURABLE" ? "OPPOSITION_POSITIONING_FAVOURABLE"
                : band === "CONTESTED" ? "OPPOSITION_CONTESTED" : "OPPOSITION_HEAVY_GROUND";

  const step = band === "FAVOURABLE"
    ? "Your chart positions you favourably against open rivals and obstacles — when opposed, stand firm, act cleanly, and let your natural resilience work. This is favourable positioning, not a promised victory over anyone; outcomes still rest on your conduct and the merits."
    : band === "CONTESTED"
      ? "Contests are winnable but not automatic for you. Choose battles deliberately, prepare thoroughly, keep allies close, and favour steady pressure over open confrontation."
      : "Head-on conflict is not your strongest ground. Favour negotiation, alliances, and patience over direct confrontation; document everything and let disciplined conduct — not force — carry you through friction.";

  return {
    module_id: "MOD-CRISIS-ENEMIES",
    category: "CRISIS",
    question: "How am I positioned against rivals, opposition, and obstacles?",
    band_scale: "OBSTACLES",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows: [],                       // placement-only by design — no timing
    coded_outcome: outcome,
    teaser: band === "FAVOURABLE" ? "When opposed, your chart gives you firm ground." : band === "CONTESTED" ? "Contests are winnable for you with preparation." : "Your chart favours alliances over confrontation.",
    proactive_step: step,
    owner_only: false,
    guardrail: "legal",
  };
}
