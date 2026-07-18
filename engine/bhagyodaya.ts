// ─────────────────────────────────────────────────────────────────────────────
// Module: Bhagyodaya (Luck, Destiny & Fortune-Rise)  (Mobility & Fortune)
// 9th house (fortune/dharma) + 9th-lord + Jupiter (fortune kāraka) + lagna-lord,
// the dharma-karmādhipati (9th–10th) raja-yoga, D1×D9 composite, and the next
// fortune-rise window. Channel named by where the 9th-lord/Jupiter connects.
// THEORY-STRONG (Jawa-derived); timing provisional pending a dated fortune-rise case.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, BENEFICS, kendraTrikona, dusthana,
         bandFromScore, confidenceFromConvergence, intensityFromNet, nextPeakWindow } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function bhagyodaya(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let s = 0;
  const g = c.grahas;
  const L9 = c.lordOf(9), L10 = c.lordOf(10), L1 = c.lordOf(1);

  // 9th lord (fortune)
  if (veryStrong(c.dignityD1(L9)) || kendraTrikona(g[L9].house)) { s += 2; F.push({ chart:"D1", scope:"LORD", detail:`the fortune-lord ${L9} is strong/well-placed`, weight:2 }); }
  else if (weakDig(c.dignityD1(L9)) || dusthana(g[L9].house)) { s -= 1; F.push({ chart:"D1", scope:"LORD", detail:`the fortune-lord ${L9} is tested — fortune ripens through effort/transformation`, weight:1 }); }

  // Jupiter (fortune / dharma kāraka)
  if (veryStrong(c.dignityD1("Jupiter")) || [1,2,5,9,11].includes(g.Jupiter.house)) { s += 2; F.push({ chart:"D1", scope:"PLANET", detail:"Jupiter (grace/fortune) is well-disposed", weight:2 }); }

  // lagna-lord strong — and exalted/own in the 9th = a crowning dharma yoga
  if ((veryStrong(c.dignityD1(L1)) && g[L1].house === 9)) { s += 3; F.push({ chart:"D1", scope:"YOGA", detail:"the chart-lord is dignified in the house of fortune — a powerful destiny signature", weight:3 }); }
  else if (veryStrong(c.dignityD1(L1))) { s += 1; }

  // dharma-karmādhipati raja-yoga: 9th & 10th lords linked
  if (g[L9].house === 10 || g[L10].house === 9 || g[L9].house === g[L10].house) { s += 3; F.push({ chart:"D1", scope:"YOGA", detail:"the fortune (9th) and action (10th) lords unite — the classic rise-in-life raja-yoga", weight:3 }); }

  if (c.planetsIn(9).some(p => BENEFICS.includes(p))) { s += 1; }
  if (veryStrong(c.dignityD9(L9))) { s += 2; F.push({ chart:"D9", scope:"LORD", detail:"fortune sustains in the navamsa — durable good fortune", weight:2 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"fortune builds steadily and quietly", weight:1 });

  const { band } = bandFromScore(s,
    [{ band:"RISING", min:5 }, { band:"MIXED", min:2 }, { band:"DELAYED", min:-Infinity }], 11, -3);
  const confidence = confidenceFromConvergence(Math.abs(s));
  const intensity = intensityFromNet(s);

  // channel: where the fortune-carriers point
  const carrier = g[L9].house === 12 || g.Jupiter.house === 12 ? "abroad, spiritual life, or behind-the-scenes work"
    : g[L9].house === 10 || g[L9].house === g[L10].house ? "your career and public standing"
    : [2,11].includes(g[L9].house) ? "wealth and gains"
    : g[L9].house === 8 ? "深 transformation, research, or inherited paths" : "dharma, teaching, and higher purpose";

  const bhagyaActivation = (lord: Graha): number => {
    let v = 0;
    if (c.lordOf(9) === lord) v += 3;
    if (lord === "Jupiter") v += 2;
    if (c.lordOf(1) === lord && g[c.lordOf(1)].house === 9) v += 2;
    if ((g[L9].house === 10 || g[L10].house === 9) && c.lordOf(10) === lord) v += 1;
    return v;
  };
  const peak = band === "DELAYED" ? null : nextPeakWindow(c, bhagyaActivation, nowISO, "Fortune-rise window");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  const step = band === "RISING"
    ? `Your chart carries a genuine rise-in-fortune signature, expressing most through ${carrier}. Position yourself and act within your fortune-rise window rather than waiting — luck here rewards initiative.`
    : band === "MIXED"
      ? `Fortune comes in defined waves rather than a steady climb, often through ${carrier}. Use your favourable windows deliberately and let momentum build.`
      : `Fortune ripens later and through sustained effort. Keep investing in your path — the returns are real but earned, not early.`;

  return {
    module_id: "MOD-MOBILITY-BHAGYODAYA",
    category: "MOBILITY",
    question: "When does my luck rise, and how does fortune express in my chart?",
    band_scale: "FORTUNE",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: band === "RISING" ? "FORTUNE_RISING_WINDOW" : band === "MIXED" ? "FORTUNE_MIXED" : "FORTUNE_MATURES_LATER",
    teaser: band === "RISING" ? "Your chart carries a strong rise-in-fortune signature." : band === "MIXED" ? "Your fortune comes in waves — timing is everything." : "Your fortune is a slow, earned climb.",
    proactive_step: step.replace("深 ", ""),
    owner_only: false,
    guardrail: "none",
  };
}