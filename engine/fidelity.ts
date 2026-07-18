// ─────────────────────────────────────────────────────────────────────────────
// Module: Fidelity & Marital Stress  (Marriage & Relationship) — OWNER-ONLY
// Relationship-restlessness / fidelity-STRESS indicators for practitioner judgment.
// Signature (case-9): Venus (desire) + Mars (passion) via the hidden 6/8/12 houses,
// Rahu on the 7th / with Venus (insatiable, taboo-breaking), and a dissatisfying 7th.
// Bands: LOW/MODERATE/HIGH. NEVER customer-facing, NEVER an accusation or prediction.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, bandFromScore, confidenceFromConvergence, intensityFromNet } from "../shared";

type Factor = EngineFact["converging_factors"][number];
const HIDDEN = [6, 8, 12];   // clandestine / illicit / secret-pleasure houses

export function fidelity(c: ChartData): EngineFact {
  const F: Factor[] = [];
  let s = 0;
  const g = c.grahas;

  // Venus (desire) routed through a hidden house
  if (HIDDEN.includes(g.Venus.house)) { s += 2; F.push({ chart:"D1", scope:"PLANET", detail:`Venus (desire) in the ${g.Venus.house}th — affection routed through private/illicit channels`, weight:2 }); }
  // Mars (passion) in a hidden house
  if (HIDDEN.includes(g.Mars.house)) { s += 1; F.push({ chart:"D1", scope:"PLANET", detail:`Mars (passion) in the ${g.Mars.house}th`, weight:1 }); }
  // Venus + Mars together — intense drive
  if (g.Venus.house === g.Mars.house) { s += 1; F.push({ chart:"D1", scope:"PLANET", detail:"Venus with Mars — strong, restless desire", weight:1 }); }
  // combust Venus in a hidden house (burnt, covert)
  if (g.Venus.combust && HIDDEN.includes(g.Venus.house)) { s += 1; F.push({ chart:"D1", scope:"PLANET", detail:"Venus combust in a hidden house — desire that runs covert", weight:1 }); }

  // Rahu (insatiable / taboo-breaking) on the 7th or with Venus
  if (g.Rahu.house === 7) { s += 2; F.push({ chart:"D1", scope:"HOUSE", detail:"Rahu in the 7th — an appetite that one partner rarely satisfies", weight:2 }); }
  if (g.Rahu.house === g.Venus.house) { s += 2; F.push({ chart:"D1", scope:"PLANET", detail:"Rahu with Venus — boundary-blurring, unconventional desire", weight:2 }); }

  // a dissatisfying / afflicted 7th pushes desire outward
  const L7 = c.lordOf(7);
  const dissatisfied7 = g.Ketu.house === 7 || weakDig(c.dignityD1(L7)) ||
    c.planetsIn(7).some(p => ["Saturn","Mars","Rahu","Ketu","Sun"].includes(p) && !veryStrong(c.dignityD1(p)));
  if (dissatisfied7) { s += 1; F.push({ chart:"D1", scope:"HOUSE", detail:"a dissatisfying marriage house — the sanctioned bond feels incomplete", weight:1 }); }

  // 8th/12th lord tied to Venus (clandestine liaisons)
  if (c.lordOf(8) === g.Venus.house || g.Venus.house === 8) { s += 1; F.push({ chart:"D1", scope:"PLANET", detail:"Venus linked to the 8th — hidden/other-partner themes", weight:1 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"no notable restlessness indicators — the desire nature is contained", weight:1 });

  const { band } = bandFromScore(s,
    [{ band:"HIGH", min:5 }, { band:"MODERATE", min:3 }, { band:"LOW", min:-Infinity }], 9, 0);
  const outcome = band === "HIGH" ? "RESTLESSNESS_HIGH" : band === "MODERATE" ? "RESTLESSNESS_MODERATE" : "RESTLESSNESS_LOW";

  return {
    module_id: "MOD-MARRIAGE-FIDELITY",
    category: "MARRIAGE",
    question: "Relationship-restlessness / fidelity-stress indicators (practitioner context).",
    band_scale: "FIDELITY_STRESS",
    band,
    intensity: intensityFromNet(s),
    confidence: confidenceFromConvergence(s),
    converging_factors: F,
    timing_windows: [],
    coded_outcome: outcome,
    teaser: "Owner-only: fidelity-stress indicators for compassionate counselling context.",
    proactive_step: band === "LOW"
      ? "The chart shows a contained desire nature; no notable restlessness pattern."
      : "The chart carries relationship-restlessness indicators. This is background context for the practitioner's compassionate judgment ONLY — never to be surfaced to a client, never framed as an accusation, a certainty, or a prediction about a real person's conduct.",
    owner_only: true,
    guardrail: "none",
  };
}