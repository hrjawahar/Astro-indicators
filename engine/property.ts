// ─────────────────────────────────────────────────────────────────────────────
// Module: Property & Inheritance  (Career & Wealth)
// 4th house (property) + 8th (inheritance/succession) + 2nd (family wealth) + Jupiter
// (bequest kāraka), with the D1×D9 composite. Emits the "read the silence" discriminator:
// 6th-house involvement → litigation; its absence → private family-friction.
// Validated: case-7 (Jawa) → obstructed inheritance, family-friction (no 6th), owed-but-blocked.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, BENEFICS, kendraTrikona, dusthana,
         confidenceFromMargin, intensityFromNet } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function property(c: ChartData): EngineFact {
  const F: Factor[] = [];
  let sup = 0, det = 0;
  const g = c.grahas;
  const L4 = c.lordOf(4), L2 = c.lordOf(2), L6 = c.lordOf(6);

  // ── 4th lord (property/fixed assets) ────────────────────────────────────────
  if (veryStrong(c.dignityD1(L4))) { sup += 2; F.push({ chart:"D1", scope:"LORD", detail:`property-lord ${L4} is dignified`, weight:2 }); }
  else if (c.dignityD1(L4) === "friend") { sup += 1; F.push({ chart:"D1", scope:"LORD", detail:`property-lord ${L4} is well-disposed`, weight:1 }); }
  else if (weakDig(c.dignityD1(L4))) { det += 1; F.push({ chart:"D1", scope:"LORD", detail:`property-lord ${L4} is weak`, weight:1 }); }
  if (kendraTrikona(g[L4].house) || g[L4].house === 11) { sup += 2; F.push({ chart:"D1", scope:"LORD", detail:"property-lord well-placed", weight:2 }); }
  else if (g[L4].house === 8 || g[L4].house === 12) { det += 2; F.push({ chart:"D1", scope:"LORD", detail:`property-lord in the ${g[L4].house}th — assets come through inheritance/effort, not freely`, weight:2 }); }
  else if (dusthana(g[L4].house)) { det += 1; F.push({ chart:"D1", scope:"LORD", detail:"property-lord in a difficult house", weight:1 }); }

  // ── benefic in the 4th ──────────────────────────────────────────────────────
  for (const occ of c.planetsIn(4)) if (BENEFICS.includes(occ) && !weakDig(c.dignityD1(occ))) {
    sup += 1; F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} graces the property house`, weight:1 }); break; }

  // ── Jupiter (bequest / asset kāraka) ────────────────────────────────────────
  if (g.Jupiter.house === 12) { det += 1; F.push({ chart:"D1", scope:"PLANET", detail:"bequest-significator in the 12th — inheritance is owed but slips / is withheld", weight:2 }); }
  else if (veryStrong(c.dignityD1("Jupiter")) || [1,2,4,5,9,11].includes(g.Jupiter.house)) { sup += 1; F.push({ chart:"D1", scope:"PLANET", detail:"bequest-significator well-disposed", weight:1 }); }

  // ── 2nd lord (family wealth / lineage) ──────────────────────────────────────
  if (weakDig(c.dignityD1(L2)) || dusthana(g[L2].house)) { det += 1; F.push({ chart:"D1", scope:"LORD", detail:"family-wealth lord compromised — the family channel is strained", weight:1 }); }

  // ── D9 durability of the property-lord ──────────────────────────────────────
  if (veryStrong(c.dignityD9(L4))) { sup += 2; F.push({ chart:"D9", scope:"LORD", detail:"property holdings sustain in the navamsa", weight:3 }); }
  else if (weakDig(c.dignityD9(L4))) { det += 1; F.push({ chart:"D9", scope:"LORD", detail:"property-lord weak in navamsa — holding is harder than acquiring", weight:2 }); }

  // ── the "read the silence" discriminator: litigation vs family friction ──────
  const sixthInvolved =
    g[L6].house === 4 || g[L4].house === 6 || g[L6].house === g[L4].house ||
    g.Rahu.house === 4;   // a real 6th↔4th link, or Rahu IN the property house (dispute-prone)

  // ── verdict ─────────────────────────────────────────────────────────────────
  const net = sup - det;
  const band = net >= 4 ? "FAVOURABLE" : net >= 1 ? "MIXED" : "OBSTRUCTED";
  const obstructed = band === "OBSTRUCTED";
  const inheritanceRoute = (g[L4].house === 8 || g[L4].house === 12) && (g.Jupiter.house === 12 || weakDig(c.dignityD1(L2)));

  let outcome: string, step: string;
  if (band === "FAVOURABLE") {
    outcome = "PROPERTY_SUPPORTED";
    step = "Move on property decisions when they arise; your chart backs ownership. Keep documentation clean as a matter of course.";
  } else if (obstructed && sixthInvolved) {
    outcome = "PROPERTY_OBSTRUCTED_LITIGATION";
    step = "Property here carries a dispute-prone edge — keep every title, agreement, and boundary meticulously documented, and resolve disagreements through proper legal channels early, before they harden.";
  } else if (obstructed) {
    outcome = "PROPERTY_OBSTRUCTED_FAMILY";
    step = inheritanceRoute
      ? "What is rightfully yours — especially ancestral or family property — is structurally slow and prone to friction within the family. Pursue your share patiently and persistently through family channels, keep your paperwork in order, and expect it to come by steady pressure rather than freely — without forcing it into open conflict."
      : "Property comes through sustained effort and some family friction. Pursue it patiently, keep documentation clean, and expect it by steady pressure rather than freely.";
  } else {
    outcome = "PROPERTY_VIA_EFFORT";
    step = "Property is attainable but rewards patience — build toward ownership steadily, time major purchases to your stronger periods, and keep your paperwork clean." + (sixthInvolved ? " Given a dispute-prone edge here, document titles and boundaries carefully." : "");
  }

  const confidence = confidenceFromMargin(Math.max(sup, det), Math.min(sup, det));
  const intensity = intensityFromNet(net);

  return {
    module_id: "MOD-WEALTH-PROPERTY",
    category: "WEALTH",
    question: "How do property and inheritance unfold for me?",
    band_scale: "PROPERTY",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows: [],                       // standing life-pattern, not a dated event
    coded_outcome: outcome,
    teaser: band === "FAVOURABLE"
      ? "Your chart supports roots you can own — property tends to come to you."
      : "Property is part of your story, but it asks for patience and care to secure.",
    proactive_step: step,
    owner_only: false,
    guardrail: "none",
  };
}