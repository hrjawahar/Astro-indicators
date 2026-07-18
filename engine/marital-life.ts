// ─────────────────────────────────────────────────────────────────────────────
// Module: Marital Life Indication  (Marriage & Relationship)
// Net stress − mitigation, with the 7th-affliction FLOOR (any direct hit ⇒ at least
// Manageable), classical Mangal-dosha cancellation, the D9 marriage-chart, and
// flavour-rules (Mars=conflict, Saturn=distance, Rahu=turbulence).
// Bands: SMOOTH · MANAGEABLE · CHALLENGING.  Calibrated on 5 challenging charts.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, BENEFICS, kendraTrikona, dusthana,
         confidenceFromMargin, intensityFromNet } from "../shared";

type Factor = EngineFact["converging_factors"][number];
const HARD_MALEFIC: Graha[] = ["Saturn","Mars","Rahu","Sun","Ketu"];
const FLAVOUR: Partial<Record<Graha, string>> = {
  Mars:"conflict and friction", Saturn:"distance and reserve", Rahu:"turbulence and unconventional dynamics",
  Sun:"ego and separateness", Ketu:"detachment",
};
const flavourCode: Partial<Record<Graha, string>> = { Mars:"CONFLICT", Saturn:"DISTANCE", Rahu:"TURBULENCE", Sun:"DISTANCE", Ketu:"DISTANCE" };

export function maritalLife(c: ChartData): EngineFact {
  const F: Factor[] = [];
  let stress = 0, mit = 0, directHit = false;
  const g = c.grahas;
  const L7 = c.lordOf(7);
  const flavourWeight: Record<string, number> = {};
  const addFlavour = (planet: Graha, w: number) => { const fc = flavourCode[planet]; if (fc) flavourWeight[fc] = (flavourWeight[fc] ?? 0) + w; };

  // D9 seventh-house occupants
  const d9Seventh = (Object.keys(g) as Graha[]).filter(k => g[k].navHouse === 7);

  // ── STRESS ──────────────────────────────────────────────────────────────────
  // malefic in the 7th (dignified malefic milder)
  for (const occ of c.planetsIn(7)) if (HARD_MALEFIC.includes(occ)) {
    let w = (occ === "Saturn" || occ === "Mars" || occ === "Rahu") ? 3 : 2;
    if (veryStrong(c.dignityD1(occ))) w -= 1;
    stress += w; directHit = true; addFlavour(occ, w);
    F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the marriage house — ${FLAVOUR[occ]}`, weight:Math.max(1, Math.min(3, w)) as 1|2|3 });
  }
  // 7th lord in dusthana / debilitated
  if (dusthana(g[L7].house)) { stress += 3; directHit = true;
    F.push({ chart:"D1", scope:"LORD", detail:`marriage-lord in the difficult ${g[L7].house}th house`, weight:3 }); }
  if (weakDig(c.dignityD1(L7))) { stress += 2; directHit = true;
    F.push({ chart:"D1", scope:"LORD", detail:"marriage-lord is weak", weight:2 }); }

  // Venus (kalatra kāraka) affliction
  if (c.dignityD1("Venus") === "debilitated") { stress += 2; F.push({ chart:"D1", scope:"PLANET", detail:"Venus (love) debilitated — affection is tested", weight:2 }); }
  if (dusthana(g.Venus.house)) { stress += 1; }
  if (g.Venus.combust) { stress += 1; F.push({ chart:"D1", scope:"PLANET", detail:"Venus combust — warmth can feel eclipsed", weight:1 }); }
  if (g.Venus.house === g.Mars.house) { stress += 1; addFlavour("Mars", 1); F.push({ chart:"D1", scope:"PLANET", detail:"Venus with Mars — passion runs hot, and so can conflict", weight:1 }); }

  // Mangal (Kuja) dosha with classical cancellation
  const marsH = g.Mars.house;
  if ([1,2,4,7,8,12].includes(marsH)) {
    let w = 3;
    if (veryStrong(c.dignityD1("Mars"))) w -= 2;                 // Mars own/exalted cancels much of the dosha
    if ([1,3,11].includes(g.Jupiter.house)) w -= 1;             // Jupiter's aspect on the 7th tempers it
    w = Math.max(0, w);
    if (w > 0) { stress += w; if (w >= 2) directHit = true; addFlavour("Mars", w);
      F.push({ chart:"D1", scope:"PLANET", detail:`Mars stresses the partnership axis${w < 3 ? " (partly cancelled)" : ""}`, weight:Math.min(3, w) as 1|2|3 }); }
  }

  // nodal axis across 1–7
  if ([1,7].includes(g.Rahu.house) || [1,7].includes(g.Ketu.house)) { stress += 2; directHit = true; addFlavour("Rahu", 2);
    F.push({ chart:"D1", scope:"HOUSE", detail:"the nodal axis crosses the partnership axis", weight:2 }); }

  // D9 marriage-chart afflictions
  for (const occ of d9Seventh) if (HARD_MALEFIC.includes(occ)) { stress += 2; addFlavour(occ, 1);
    F.push({ chart:"D9", scope:"HOUSE", detail:`${occ} weighs on the marriage in the navamsa`, weight:2 }); }
  if (c.dignityD9("Venus") === "debilitated") { stress += 2;
    F.push({ chart:"D9", scope:"PLANET", detail:"Venus weak in the navamsa — inner ease is harder-won", weight:2 }); }

  // ── MITIGATION ───────────────────────────────────────────────────────────────
  for (const occ of c.planetsIn(7)) if (BENEFICS.includes(occ) && !weakDig(c.dignityD1(occ))) { mit += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the 7th softens and steadies the bond`, weight:2 }); break; }
  if ([1,3,11].includes(g.Jupiter.house)) { mit += 2; F.push({ chart:"D1", scope:"ASPECT", detail:"Jupiter's aspect graces the marriage house", weight:2 }); }
  if (veryStrong(c.dignityD1(L7)) && kendraTrikona(g[L7].house)) { mit += 3; F.push({ chart:"D1", scope:"LORD", detail:"marriage-lord strong and well-placed", weight:3 }); }
  if (veryStrong(c.dignityD1("Venus")) && !dusthana(g.Venus.house)) { mit += 2; F.push({ chart:"D1", scope:"PLANET", detail:"Venus strong and well-placed", weight:2 }); }
  for (const occ of d9Seventh) if (BENEFICS.includes(occ)) { mit += 2; F.push({ chart:"D9", scope:"HOUSE", detail:`${occ} supports the marriage in the navamsa`, weight:2 }); break; }

  // ── verdict (with the 7th-affliction floor) ─────────────────────────────────
  const net = stress - mit;
  const band = net >= 6 ? "CHALLENGING" : (directHit || net >= 1) ? "MANAGEABLE" : "SMOOTH";

  // dominant flavour
  const flav = Object.entries(flavourWeight).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "CONFLICT";
  const outcome = band === "SMOOTH" ? "MARRIAGE_HARMONIOUS"
                : band === "MANAGEABLE" ? "MARRIAGE_WORKABLE_EFFORT"
                : `MARRIAGE_CHALLENGING_${flav}`;
  const flavWord = flav === "DISTANCE" ? "emotional distance" : flav === "TURBULENCE" ? "turbulence and unpredictability" : "friction and clashes";

  const confidence = confidenceFromMargin(Math.max(stress, mit), Math.min(stress, mit));
  const intensity = intensityFromNet(net);

  const step = band === "SMOOTH"
    ? "Your partnership tends to steady the rest of your life — invest in it and let it be a foundation."
    : band === "MANAGEABLE"
      ? `This is a workable partnership that responds to conscious effort — the recurring theme to manage is ${flavWord}. Name it early, communicate openly, and it holds well.`
      : `This is a demanding partnership configuration, with ${flavWord} as the central theme. It genuinely responds to conscious effort, counselling, and patience — awareness of that specific pattern is what makes it navigable rather than overwhelming.`;

  return {
    module_id: "MOD-MARRIAGE-LIFE",
    category: "MARRIAGE",
    question: "What is the day-to-day texture of my married life?",
    band_scale: "MARRIAGE_LIFE",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows: [],
    coded_outcome: outcome,
    teaser: band === "SMOOTH"
      ? "Your chart supports a partnership that feels like home."
      : "Partnership is a central, formative theme for you — rich, and worth tending with care.",
    proactive_step: step,
    owner_only: false,
    guardrail: "none",
  };
}