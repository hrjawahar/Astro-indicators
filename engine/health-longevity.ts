// ─────────────────────────────────────────────────────────────────────────────
// Module: Health, Vitality & Longevity  (Health)  — GUARDRAIL: health
// Constitution (lagna/lagna-lord/Sun/Moon vitality) vs vulnerability (maraka 2/7 lords,
// 8th-lord/āyuṣ, 6th disease, Saturn chronicity). Bands: STEADY · WATCHFUL · ELEVATED.
// STRICTLY caution-not-diagnosis: NEVER an illness name, body part, or mortality — only
// "health-sensitive periods" and proactive care. Sensitive windows are check-up prompts.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, BENEFICS, kendraTrikona, dusthana,
         bandFromScore, confidenceFromConvergence, intensityFromNet, nextPeakWindow } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function healthLongevity(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let vitality = 0, vuln = 0;
  const g = c.grahas;
  const L1 = c.lordOf(1), L8 = c.lordOf(8);
  const marakaLords = [c.lordOf(2), c.lordOf(7)];

  // ── constitution / vitality ─────────────────────────────────────────────────
  if (veryStrong(c.dignityD1(L1)) || kendraTrikona(g[L1].house)) { vitality += 2; F.push({ chart:"D1", scope:"LORD", detail:"a strong chart-lord — a robust underlying constitution", weight:2 }); }
  if (c.planetsIn(1).length === 0 || c.planetsIn(1).some(p => BENEFICS.includes(p))) { vitality += 1; }
  if (!weakDig(c.dignityD1("Sun")) && !dusthana(g.Sun.house)) { vitality += 1; }   // Sun = vitality
  if (!weakDig(c.dignityD1("Moon")) && !dusthana(g.Moon.house)) { vitality += 1; } // Moon = body fluids/wellbeing

  // ── vulnerability (never named as a disease) ────────────────────────────────
  for (const occ of c.planetsIn(1)) if (["Saturn","Mars","Rahu","Ketu"].includes(occ) && !veryStrong(c.dignityD1(occ))) { vuln += 2; F.push({ chart:"D1", scope:"LAGNA", detail:`${occ} on the ascendant asks for extra attention to the body's resilience`, weight:2 }); break; }
  for (const mL of marakaLords) if (dusthana(g[mL].house) || weakDig(c.dignityD1(mL))) { vuln += 1; }
  if (dusthana(g[L8].house) || weakDig(c.dignityD1(L8))) { vuln += 1; F.push({ chart:"D1", scope:"LORD", detail:"the vitality-reserve (8th) lord is stressed — worth supporting proactively", weight:1 }); }
  if (weakDig(c.dignityD1("Moon")) && dusthana(g.Moon.house)) { vuln += 1; F.push({ chart:"D1", scope:"PLANET", detail:"the Moon (bodily wellbeing) is under strain", weight:1 }); }
  // convergence: multiple maraka/8th afflictions together
  const marakaHits = marakaLords.filter(mL => dusthana(g[mL].house) || weakDig(c.dignityD1(mL))).length;
  if (marakaHits >= 1 && (dusthana(g[L8].house) || weakDig(c.dignityD1(L8)))) { vuln += 1; F.push({ chart:"D1", scope:"YOGA", detail:"several longevity-significators are stressed together — a clear cue for regular, proactive care", weight:2 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"LAGNA", detail:"a fundamentally steady constitution with no major stress markers", weight:1 });

  const net = vuln - vitality;   // higher = more health-attention warranted
  const { band } = bandFromScore(net,
    [{ band:"ELEVATED", min:2 }, { band:"WATCHFUL", min:-1 }, { band:"STEADY", min:-Infinity }], 7, -6);
  const confidence = confidenceFromConvergence(Math.max(vitality, vuln));
  const intensity = intensityFromNet(net);

  // ── health-sensitive window (a check-up prompt, NOT a prediction of illness) ─
  const healthActivation = (lord: Graha): number => {
    let v = 0;
    if (marakaLords.includes(lord)) v += 2;
    if (c.lordOf(8) === lord) v += 2;
    if (c.lordOf(6) === lord) v += 1;
    if (lord === "Saturn") v += 1;
    // only meaningful when the graha is itself stressed
    if (v > 0 && !(weakDig(c.dignityD1(lord)) || dusthana(g[lord].house))) v -= 1;
    return Math.max(0, v);
  };
  const peak = band === "STEADY" ? null : nextPeakWindow(c, healthActivation, nowISO, "A period to prioritise health check-ups and self-care");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  const step = band === "ELEVATED"
    ? "This is one of the more health-significant patterns in your chart — which is a call for proactive care, not alarm. Stay ahead with regular check-ups, don't ignore small signals, keep close to good medical guidance, and prioritise rest and prevention in your sensitive window. Awareness is your strongest protection."
    : band === "WATCHFUL"
      ? "Your health is broadly sound with a few areas worth tending. Keep up routine check-ups and healthy rhythms, and give a little extra attention during your sensitive window — steady prevention keeps you well."
      : "Your chart shows a fundamentally steady constitution. Maintain good habits and routine check-ups, and your resilience tends to carry you well.";

  return {
    module_id: "MOD-HEALTH-LONGEVITY",
    category: "HEALTH",
    question: "How is my overall vitality, and are there periods to prioritise health?",
    band_scale: "HEALTH",
    band, intensity, confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: band === "ELEVATED" ? "HEALTH_WATCH_ELEVATED" : band === "WATCHFUL" ? "HEALTH_WATCH_MODERATE" : "VITALITY_STEADY",
    teaser: band === "STEADY" ? "Your chart carries a steady, resilient constitution." : "Your wellbeing rewards proactive, preventive care.",
    proactive_step: step,
    owner_only: false,
    guardrail: "health",
  };
}