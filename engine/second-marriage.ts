// ─────────────────────────────────────────────────────────────────────────────
// Module: Second-Marriage Prospects  (Marriage & Relationship) — OWNER-ONLY
// Classical remarriage indicators: dual (mutable) sign on the 7th / 7th-lord /
// spouse-kāraka, the 8th house as "the 2nd spouse" (2nd-from-7th), 7th↔8th exchange,
// and a loaded 7th. Gender-aware spouse kāraka. Theory-strong; owner-only like fidelity.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha, Rashi } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, BENEFICS, dusthana, bandFromScore, confidenceFromConvergence, intensityFromNet } from "../shared";

type Factor = EngineFact["converging_factors"][number];
const DUAL: Rashi[] = ["Gemini","Virgo","Sagittarius","Pisces"];   // mutable/dvisvabhāva signs
const isDual = (r: Rashi) => DUAL.includes(r);

export function secondMarriage(c: ChartData): EngineFact {
  const F: Factor[] = [];
  let s = 0;
  const g = c.grahas;
  const L7 = c.lordOf(7), L8 = c.lordOf(8);
  const seventhSign = c.grahas[L7] && c["lagna"] ? null : null;
  // 7th house sign = sign at house 7
  const signAt = (house: number): Rashi => {
    const li = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"] as Rashi[];
    return li[(li.indexOf(c.lagna) + house - 1) % 12];
  };
  const seventh = signAt(7);

  // dual sign on the 7th → classical "more than one marriage"
  if (isDual(seventh)) { s += 2; F.push({ chart:"D1", scope:"HOUSE", detail:"a dual (mutable) sign on the 7th — a classical multiplicity-of-partnership signature", weight:2 }); }
  if (isDual(g[L7].rashi)) { s += 2; F.push({ chart:"D1", scope:"LORD", detail:"marriage-lord in a dual sign — supports more than one union", weight:2 }); }

  // spouse kāraka (gender-specific if known, else both) in a dual sign
  const karakas: Graha[] = c.spouseKaraka ? [c.spouseKaraka] : ["Venus","Jupiter"];
  for (const k of karakas) if (isDual(g[k].rashi)) { s += 2; F.push({ chart:"D1", scope:"PLANET", detail:`spouse significator ${k} in a dual sign`, weight:2 }); break; }

  // the 8th house = "the second spouse" (2nd-from-7th): activity/benefic support there
  if (c.planetsIn(8).some(p => BENEFICS.includes(p))) { s += 1; F.push({ chart:"D1", scope:"HOUSE", detail:"a benefic activates the 8th (the house of the second partner)", weight:1 }); }
  if (veryStrong(c.dignityD1(L8)) && !dusthana(g[L8].house)) { s += 1; F.push({ chart:"D1", scope:"LORD", detail:"the 8th-lord (second-partner lord) is well-disposed", weight:1 }); }

  // 7th ↔ 8th exchange (union tied to the "second" axis)
  if (g[L7].house === 8 || g[L8].house === 7) { s += 2; F.push({ chart:"D1", scope:"YOGA", detail:"a 7th–8th link ties the first union to the second-partnership axis", weight:2 }); }

  // a crowded 7th (multiple planets) → multiplicity of relationships
  if (c.planetsIn(7).length >= 2) { s += 1; F.push({ chart:"D1", scope:"HOUSE", detail:"several planets tenant the 7th — a busy partnership axis", weight:1 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"no notable remarriage indicators", weight:1 });

  const { band } = bandFromScore(s,
    [{ band:"INDICATED", min:5 }, { band:"POSSIBLE", min:3 }, { band:"UNLIKELY", min:-Infinity }], 9, 0);
  const outcome = band === "INDICATED" ? "REMARRIAGE_INDICATED" : band === "POSSIBLE" ? "REMARRIAGE_POSSIBLE" : "REMARRIAGE_UNLIKELY";

  return {
    module_id: "MOD-MARRIAGE-SECOND",
    category: "MARRIAGE",
    question: "Are there indications of a second marriage / subsequent union?",
    band_scale: "REMARRIAGE",
    band,
    intensity: intensityFromNet(s),
    confidence: confidenceFromConvergence(s),
    converging_factors: F,
    timing_windows: [],
    coded_outcome: outcome,
    teaser: "Practitioner context on multiplicity-of-partnership indicators.",
    proactive_step: band === "UNLIKELY"
      ? "The chart does not emphasise a second union; the first partnership axis is the primary story."
      : "The chart carries classical multiplicity-of-partnership indicators. Treat this as background context for counselling — never as a prediction to a client, and never customer-facing.",
    owner_only: true,
    guardrail: "none",
  };
}