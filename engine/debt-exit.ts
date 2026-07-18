// ─────────────────────────────────────────────────────────────────────────────
// Module: Debt Pressure & Exit  (Crisis, Debt & Legal)  — REBUILT (provisional)
// Extends the validated 6th-house (rina/debts) engine: capacity to clear debts
// (strong 6th-lord / malefics in the 6th upachaya) vs structural debt-pressure
// (weak 6th-lord, Rahu amplification in the 6th, strained 2nd/11th repayment
// channels, heavy 12th losses). Bands: EASING · MANAGEABLE · PRESSURED, plus a
// debt-exit window (6th-lord / 11th-lord periods). Provisional per
// CALIBRATION_DEBT.md — no dated debt-clearance outcome yet (Jack Rahu-6th structural).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, upachaya, dusthana, bandFromScore,
         confidenceFromConvergence, intensityFromNet, nextPeakWindow } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function debtExit(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let cap = 0, press = 0;
  const g = c.grahas;
  const L6 = c.lordOf(6), L2 = c.lordOf(2), L11 = c.lordOf(11), L12 = c.lordOf(12);

  // ── capacity to clear (the validated 6th-house strength read) ───────────────
  if (veryStrong(c.dignityD1(L6)) || upachaya(g[L6].house)) { cap += 2;
    F.push({ chart:"D1", scope:"LORD", detail:`the debts-lord ${L6} is strong/well-placed — real capacity to work debts down`, weight:2 }); }
  for (const occ of c.planetsIn(6)) if (["Mars","Saturn"].includes(occ)) { cap += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the 6th — classical strength to grind obligations down`, weight:2 }); break; }
  if (veryStrong(c.dignityD9(L6))) { cap += 1; }

  // ── structural debt-pressure ────────────────────────────────────────────────
  if (weakDig(c.dignityD1(L6))) { press += 1;
    F.push({ chart:"D1", scope:"LORD", detail:`the debts-lord ${L6} is weak — obligations linger`, weight:1 }); }
  if (g.Rahu.house === 6) { press += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:"Rahu in the 6th — debts can balloon or recur; discipline matters", weight:2 }); }
  // repayment channels (2nd accumulation / 11th inflow) strained — dedupe when one
  // planet rules both, and let D9 strength moderate the strain (durability principle)
  const repayLords = [...new Set([L2, L11])];
  for (const L of repayLords) {
    if (weakDig(c.dignityD1(L)) || dusthana(g[L].house)) {
      if (veryStrong(c.dignityD9(L))) {
        F.push({ chart:"D9", scope:"LORD", detail:`the repayment channel is strained on the surface but recovers in the navamsa — capacity to climb back`, weight:1 });
      } else { press += 1;
        F.push({ chart:"D1", scope:"LORD", detail:`the repayment lord ${L} is strained — repayment runs slower`, weight:1 }); }
    }
  }
  // heavy losses channel (12th-lord afflicting the money axis)
  if ([2,11].includes(g[L12].house) && !veryStrong(c.dignityD1(L12))) { press += 1;
    F.push({ chart:"D1", scope:"LORD", detail:"the losses-lord touches the money axis — outflows need watching", weight:1 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"debt is not a prominent structural theme in this chart", weight:1 });

  const net = cap - press;
  const { band } = bandFromScore(net,
    [{ band:"EASING", min:3 }, { band:"MANAGEABLE", min:-1 }, { band:"PRESSURED", min:-Infinity }], 7, -5);
  const confidence = confidenceFromConvergence(Math.max(cap, press));
  const intensity = intensityFromNet(net);
  const outcome = band === "EASING" ? "DEBT_EASING_PHASE" : band === "MANAGEABLE" ? "DEBT_MANAGEABLE" : "DEBT_PRESSURE_PHASE";

  // ── debt-exit window: periods of the debt-clearing drivers ──────────────────
  const debtClearActivation = (lord: Graha): number => {
    let v = 0;
    if (c.lordOf(6) === lord) v += 3;                 // facing/working the obligation itself
    if (c.lordOf(11) === lord) v += 2;                // inflow that repays
    if (c.lordOf(2) === lord) v += 1;
    if (c.planetsIn(6).includes(lord) && ["Mars","Saturn"].includes(lord)) v += 1;
    if (v === 0) return 0;
    let dur = 1;
    if (veryStrong(c.dignityD1(lord))) dur += 0.3; else if (weakDig(c.dignityD1(lord))) dur -= 0.2;
    if (weakDig(c.dignityD9(lord))) dur -= 0.3;
    return v * Math.max(0.4, dur);
  };
  const peak = nextPeakWindow(c, debtClearActivation, nowISO, "Favourable window to consolidate and reduce debt");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  const step = band === "EASING"
    ? "Your chart carries real debt-clearing strength. Use your favourable window to consolidate, negotiate terms, and pay down aggressively — momentum is with you when you engage it."
    : band === "MANAGEABLE"
      ? "Debt is workable for you with steady discipline. Keep a fixed repayment rhythm, avoid new high-cost borrowing, and use your favourable window to consolidate or renegotiate — steady pressure clears it."
      : "Debt asks for extra structure in your chart. Prioritise a strict repayment plan, avoid rollover borrowing, seek professional debt counsel where useful, and use your favourable window to restructure on better terms — the path out is disciplined, not dramatic.";

  return {
    module_id: "MOD-CRISIS-DEBT",
    category: "CRISIS",
    question: "How is my debt pressure, and when is a favourable phase to clear it?",
    band_scale: "DEBT_PHASE",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: outcome,
    teaser: band === "EASING" ? "Your chart carries genuine debt-clearing strength." : band === "MANAGEABLE" ? "Debt is workable ground for you — discipline wins here." : "Your chart asks for extra structure around borrowing.",
    proactive_step: step,
    owner_only: false,
    guardrail: "none",
  };
}
