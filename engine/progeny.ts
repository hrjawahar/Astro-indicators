// ─────────────────────────────────────────────────────────────────────────────
// Module: Progeny & Child Development  (Marriage & Relationship)
// 5th house (children) + 5th-lord + Jupiter (putrakāraka), D1×D9 composite, and
// favourable child-planning windows from the 5th-lord/Jupiter dasha periods.
// Bands: SUPPORTED · ATTENTIVE · HIGH_CARE.  GUARDRAIL: child — supportive framing,
// NEVER a verdict on whether children happen, never blame. Validated: Rekha → HIGH_CARE.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, BENEFICS, kendraTrikona, dusthana,
         bandFromScore, confidenceFromConvergence, intensityFromNet, nextPeakWindow } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function progeny(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let sup = 0, care = 0;
  const g = c.grahas;
  const L5 = c.lordOf(5);

  // ── 5th lord (children) ─────────────────────────────────────────────────────
  if (veryStrong(c.dignityD1(L5))) { sup += 2; F.push({ chart:"D1", scope:"LORD", detail:`the children-lord ${L5} is dignified`, weight:2 }); }
  else if (c.dignityD1(L5) === "friend") { sup += 1; }
  else if (weakDig(c.dignityD1(L5))) { care += 2; F.push({ chart:"D1", scope:"LORD", detail:`the children-lord ${L5} is weak`, weight:2 }); }
  if (kendraTrikona(g[L5].house)) { sup += 2; F.push({ chart:"D1", scope:"LORD", detail:"the children-lord is well-placed", weight:2 }); }
  else if (dusthana(g[L5].house)) { care += 2; F.push({ chart:"D1", scope:"LORD", detail:`the children-lord sits in the ${g[L5].house}th — a house asking for extra care`, weight:2 }); }

  // ── Jupiter (putrakāraka — the natural significator of children) ─────────────
  if (veryStrong(c.dignityD1("Jupiter")) || g.Jupiter.house === 5 || [1,3,11].includes(g.Jupiter.house)) {
    sup += 2; F.push({ chart:"D1", scope:"PLANET", detail:"Jupiter (the child significator) is well-disposed and blesses the 5th", weight:2 }); }
  else if (dusthana(g.Jupiter.house) || weakDig(c.dignityD1("Jupiter")) || g.Jupiter.combust) {
    care += 2; F.push({ chart:"D1", scope:"PLANET", detail:"the child-significator Jupiter is under strain — parenthood is a high-attention area", weight:2 }); }

  // ── occupants of the 5th ────────────────────────────────────────────────────
  for (const occ of c.planetsIn(5)) {
    if (BENEFICS.includes(occ) && !weakDig(c.dignityD1(occ))) { sup += 1; F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} blesses the children house`, weight:1 }); }
    else if (["Saturn","Mars","Rahu","Ketu"].includes(occ)) { care += 1; F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the 5th asks for patience and support around children`, weight:1 }); }
  }

  // ── D9 durability ───────────────────────────────────────────────────────────
  if (veryStrong(c.dignityD9(L5)) || veryStrong(c.dignityD9("Jupiter"))) { sup += 1; }
  else if (weakDig(c.dignityD9(L5))) { care += 1; F.push({ chart:"D9", scope:"LORD", detail:"the children-lord is weak in the navamsa", weight:1 }); }

  // convergence: both the children-lord AND the putrakāraka afflicted → compounding high-care signal
  const L5Afflicted = weakDig(c.dignityD1(L5)) || dusthana(g[L5].house);
  const jupAfflicted = dusthana(g.Jupiter.house) || weakDig(c.dignityD1("Jupiter")) || g.Jupiter.combust;
  if (L5Afflicted && jupAfflicted) { care += 2;
    F.push({ chart:"D1", scope:"YOGA", detail:"both the children-lord and the child-significator are strained together — a clear call for early, proactive support", weight:2 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"the children house is balanced and unafflicted", weight:1 });

  // ── per-child reading (5th = 1st child, 7th = 2nd, 9th = 3rd) — avoid blanket verdicts ──
  const childHouseAffliction = (house: number): number => {
    let a = 0;
    for (const occ of c.planetsIn(house)) {
      if (["Saturn","Mars","Rahu","Ketu"].includes(occ) && !veryStrong(c.dignityD1(occ))) a += 2;
      if (c.dignityD1(occ) === "debilitated") a += 2;
    }
    const hl = c.lordOf(house);
    if (weakDig(c.dignityD1(hl))) a += 2;
    if (dusthana(g[hl].house)) a += 2;
    if (house === 5 && (dusthana(g.Jupiter.house) || weakDig(c.dignityD1("Jupiter")))) a += 2;
    return a;
  };
  const child1 = childHouseAffliction(5), child2 = childHouseAffliction(7), child3 = childHouseAffliction(9);
  // which children are high-care vs well-supported
  const hi = (x: number) => x >= 4, ok = (x: number) => x <= 1;
  let perChildNote = "";
  if (hi(child1) && ok(child2)) perChildNote = " Importantly, this focus is not uniform across children — the indications point to a first child needing this extra care, while a second child looks notably better supported.";
  else if (ok(child1) && hi(child2)) perChildNote = " This care-focus points more to a second child than the first, which looks well-supported.";
  else if (hi(child1) && hi(child2)) perChildNote = " More than one child may benefit from this proactive attention.";

  // ── band (higher care = more support needed) ────────────────────────────────
  const net = care - sup;   // NOTE: this scale runs toward HIGH_CARE as care exceeds support
  const { band } = bandFromScore(net,
    [{ band:"HIGH_CARE", min:3 }, { band:"ATTENTIVE", min:1 }, { band:"SUPPORTED", min:-Infinity }], 8, -6);
  const outcome = band === "HIGH_CARE" ? "CHILD_DEV_HIGH_SUPPORT" : band === "ATTENTIVE" ? "CHILDREN_WITH_CARE" : "CHILDREN_SUPPORTED";
  const confidence = confidenceFromConvergence(Math.max(sup, care));
  const intensity = intensityFromNet(net);

  // ── favourable child-planning windows (5th-lord / Jupiter periods) ──────────
  const progenyActivation = (lord: Graha): number => {
    let s = 0;
    if (c.lordOf(5) === lord) s += 3;
    if (lord === "Jupiter") s += 2;
    if (g[lord].house === 5) s += 1;
    if (s === 0) return 0;
    let dur = 1;
    if (veryStrong(c.dignityD1(lord))) dur += 0.3; else if (weakDig(c.dignityD1(lord))) dur -= 0.2;
    return s * Math.max(0.4, dur);
  };
  const peak = nextPeakWindow(c, progenyActivation, nowISO, "Favourable window for child planning");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  // ── supportive framing (child guardrail — NEVER a verdict) ───────────────────
  const step = band === "HIGH_CARE"
    ? "Children are a deeply meaningful, high-attention area for you. If you're planning or parenting, prioritise early support — good medical guidance, patience, and steady involvement make the biggest difference. Approach it with care and hope, not pressure." + perChildNote
    : band === "ATTENTIVE"
      ? "Parenthood is well within reach and benefits from conscious planning. Favour your supportive windows, keep care proactive, and move at a pace that feels right."
      : "Children and parenthood are well-supported in your chart. When you're ready, your favourable windows are good times to plan.";

  return {
    module_id: "MOD-MARRIAGE-PROGENY",
    category: "MARRIAGE",
    question: "How are children and parenthood indicated, and what are favourable windows for planning?",
    band_scale: "PROGENY",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: outcome,
    teaser: band === "SUPPORTED" ? "Your chart supports the joy of children." : "Children are a meaningful theme in your chart, worth planning with care.",
    proactive_step: step,
    owner_only: false,
    guardrail: "child",
  };
}