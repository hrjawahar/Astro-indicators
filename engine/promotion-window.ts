// ─────────────────────────────────────────────────────────────────────────────
// Module: Career Launch & Promotion Window  (Career & Wealth)
// Positive-event timing: rates the rise-driving planets (10th-lord = elevation,
// 11th-lord = raises, Sun = recognition, Jupiter = expansion) on the D1×D9 composite,
// then surfaces datable career-rise windows from their dasha/bhukti periods.
// Validated: aqu-9° promotion from ~2018 lands in the 10th-lord (Mars) MD.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, kendraTrikona, dusthana,
         intensityFromNet, bandFromScore,
         confidenceFromConvergence, nextPeakWindow, careerActivation } from "../shared";

type Factor = EngineFact["converging_factors"][number];

// strength of a rise-driver on the D1×D9 composite (roughly -4..+5)
function driverStrength(c: ChartData, g: Graha): number {
  let s = 0;
  const d1 = c.dignityD1(g), d9 = c.dignityD9(g), h = c.grahas[g].house;
  if (veryStrong(d1)) s += 2; else if (d1 === "friend") s += 1; else if (weakDig(d1)) s -= 1;
  if (kendraTrikona(h)) s += 2; else if (h === 11) s += 1; else if (dusthana(h)) s -= 1;
  if (veryStrong(d9)) s += 1; else if (weakDig(d9)) s -= 2;   // D9 weakness caps durability of a rise
  return s;
}

export function promotionWindow(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  const g = c.grahas;
  const L10 = c.lordOf(10), L11 = c.lordOf(11);

  const s10 = driverStrength(c, L10);
  const s11 = driverStrength(c, L11);
  F.push({ chart:"D1", scope:"LORD", detail:`elevation-lord ${L10} strength ${s10 >= 2 ? "high" : s10 >= 0 ? "moderate" : "low"}`, weight: (s10 >= 2 ? 3 : s10 >= 0 ? 2 : 1) as 1|2|3 });
  F.push({ chart:"D1", scope:"LORD", detail:`raise-lord ${L11} strength ${s11 >= 2 ? "high" : s11 >= 0 ? "moderate" : "low"}`, weight: (s11 >= 2 ? 2 : 1) as 1|2 });

  // 11th-lord IN the 10th (or vice-versa) = career itself yields elevation+gains
  if (g[L11].house === 10 || g[L10].house === 11) { F.push({ chart:"D1", scope:"YOGA", detail:"career and gains houses are linked — rises come with real reward", weight:2 }); }

  // recognition / expansion contributors
  const sun = driverStrength(c, "Sun"), jup = driverStrength(c, "Jupiter");
  if (sun >= 2) F.push({ chart:"D1", scope:"PLANET", detail:"strong Sun brings recognition to advancement", weight:1 });
  if (jup >= 2) F.push({ chart:"D1", scope:"PLANET", detail:"strong Jupiter expands opportunities to rise", weight:1 });

  // overall rise potential
  const riseScore = s10 * 1.5 + s11 + Math.max(0, sun >= 2 ? 1 : 0) + Math.max(0, jup >= 2 ? 1 : 0)
                  + ((g[L11].house === 10 || g[L10].house === 11) ? 2 : 0);
  const { band } = bandFromScore(riseScore,
    [{ band:"STRONG", min:6 }, { band:"MODERATE", min:2.5 }, { band:"SUBDUED", min:-Infinity }],
    11, -4);
  const outcome = band === "STRONG" ? "PROMOTION_LIKELY" : band === "MODERATE" ? "GRADUAL_RISE" : "RISE_DELAYED";

  // ── next upcoming career-rise window (dasha clock, D9 durability) ─────────────
  const peak = nextPeakWindow(c, careerActivation(c), nowISO, "Career-rise window");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  const confidence = confidenceFromConvergence(F.reduce((a,f)=>a+f.weight,0));
  const intensity = intensityFromNet(Math.round(riseScore));

  return {
    module_id: "MOD-CAREER-PROMO",
    category: "CAREER",
    question: "When is my next window for a promotion or career rise?",
    band_scale: "CAREER_RISE",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: outcome,
    teaser: band === "STRONG"
      ? "Your chart is wired to rise — advancement comes when you position for it, not by waiting."
      : band === "MODERATE"
        ? "Your rises come in defined windows — timing your moves matters more than constant pushing."
        : "Your path rewards patience — advancement is steadier than sudden, so build leverage between windows.",
    proactive_step: timing_windows.length
      ? "Line up visibility and a clear case for advancement ahead of your next rise-window, then make your move inside it."
      : "Keep building demonstrable results; position for advancement as your stronger periods approach.",
    owner_only: false,
    guardrail: "none",
  };
}