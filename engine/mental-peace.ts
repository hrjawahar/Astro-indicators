// ─────────────────────────────────────────────────────────────────────────────
// Module: Mental Peace & Emotional Wellbeing  (Health)  — GUARDRAIL: health
// Moon (manas) + Mercury (nerves) + 4th (inner peace), read via dignity AND malefic
// aspects (Saturn=heaviness, nodes=anxiety, Mars=agitation), plus D9. Bands: STEADY ·
// SENSITIVE · STRAINED. Caution-not-diagnosis: never a clinical label — supportive framing.
// Validated: case-5 child (Saturn→Moon, deb-Mars→Mercury, Rahu-4th) → STRAINED;
// case-4 (friend-Moon in lagna, unafflicted) → not-strained.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, okStrong, weakDig, BENEFICS, kendraTrikona, dusthana,
         bandFromScore, confidenceFromConvergence, intensityFromNet } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function mentalPeace(c: ChartData): EngineFact {
  const F: Factor[] = [];
  let calm = 0, unease = 0;
  const g = c.grahas;
  const L4 = c.lordOf(4);

  // does malefic `mal` aspect/conjoin planet at house `th`? (graha-specific special aspects)
  const afflicts = (mal: Graha, targetHouse: number): boolean => {
    const d = ((targetHouse - g[mal].house) + 12) % 12;
    if (d === 0 || d === 6) return true;                          // conjunction / opposition
    if (mal === "Saturn" && (d === 2 || d === 9)) return true;    // Saturn 3rd/10th
    if (mal === "Mars" && (d === 3 || d === 7)) return true;      // Mars 4th/8th
    if ((mal === "Rahu" || mal === "Ketu") && (d === 4 || d === 8)) return true; // nodal 5th/9th
    return false;
  };
  const debCount = (["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"] as Graha[])
    .filter(p => c.dignityD1(p) === "debilitated").length;

  // ── steadying factors ───────────────────────────────────────────────────────
  if (veryStrong(c.dignityD1("Moon")) && !dusthana(g.Moon.house)) { calm += 2; F.push({ chart:"D1", scope:"PLANET", detail:"a strong, well-placed Moon — an emotionally steady mind", weight:2 }); }
  else if (okStrong(c.dignityD1("Moon")) && !dusthana(g.Moon.house)) { calm += 1; F.push({ chart:"D1", scope:"PLANET", detail:"a well-disposed Moon — a fundamentally steady temperament", weight:1 }); }
  if (c.planetsIn(4).some(p => BENEFICS.includes(p))) { calm += 1; F.push({ chart:"D1", scope:"HOUSE", detail:"a benefic steadies the heart's foundation (4th)", weight:1 }); }
  if ([1,4].includes(g.Jupiter.house) || [1,3,11].includes(g.Jupiter.house)) { calm += 1; }   // Jupiter's grace on mind
  if (!weakDig(c.dignityD1("Mercury")) && !(["Saturn","Mars","Rahu","Ketu"] as Graha[]).some(m => afflicts(m, g.Mercury.house))) { calm += 1; }

  // ── unease factors (never a clinical diagnosis) ─────────────────────────────
  if (weakDig(c.dignityD1("Moon")) || dusthana(g.Moon.house)) { unease += 2; F.push({ chart:"D1", scope:"PLANET", detail:"the Moon (the mind) is under strain — feelings can run intense or restless", weight:2 }); }
  // malefic aspects on the Moon
  if (afflicts("Saturn", g.Moon.house)) { unease += 1; F.push({ chart:"D1", scope:"ASPECT", detail:"Saturn's weight on the Moon can bring heaviness or low moods", weight:1 }); }
  if (afflicts("Rahu", g.Moon.house) || afflicts("Ketu", g.Moon.house)) { unease += 1; F.push({ chart:"D1", scope:"ASPECT", detail:"a nodal touch on the Moon can bring anxiety or a restless mind", weight:1 }); }
  if (afflicts("Mars", g.Moon.house)) { unease += 1; }
  // Mercury (nerves/thinking) afflicted
  if (weakDig(c.dignityD1("Mercury")) || (["Saturn","Mars","Rahu","Ketu"] as Graha[]).some(m => afflicts(m, g.Mercury.house))) { unease += 1; F.push({ chart:"D1", scope:"PLANET", detail:"the thinking/nervous function (Mercury) is under pressure", weight:1 }); }
  // 4th (inner peace) genuinely afflicted — 6th/8th, not the introspective 12th
  if ([6,8].includes(g[L4].house) || weakDig(c.dignityD1(L4))) { unease += 1; }
  // nodes on the self/peace axis
  if ([1,4].includes(g.Ketu.house) || [1,4].includes(g.Rahu.house)) { unease += 1; F.push({ chart:"D1", scope:"HOUSE", detail:"an unsettled, seeking quality touches the inner world", weight:1 }); }
  // a broadly stressed psyche (several debilitations)
  if (debCount >= 3) { unease += 1; F.push({ chart:"D1", scope:"YOGA", detail:"several planets sit in fall together — an inner landscape that carries extra weight", weight:1 }); }
  if (weakDig(c.dignityD9("Moon"))) { unease += 1; }

  if (F.length === 0) F.push({ chart:"D1", scope:"PLANET", detail:"a naturally settled, resilient temperament", weight:1 });

  const net = unease - calm;
  const { band } = bandFromScore(net,
    [{ band:"STRAINED", min:3 }, { band:"SENSITIVE", min:-1 }, { band:"STEADY", min:-Infinity }], 8, -6);
  const confidence = confidenceFromConvergence(Math.max(calm, unease));
  const intensity = intensityFromNet(net);

  const step = band === "STRAINED"
    ? "Your mind feels things deeply and can carry real weight — this is a call for gentle, active care, not a diagnosis. Protect your sleep and routines, build in calming practices, lean on people you trust, and don't hesitate to seek supportive professional help; steady support makes a genuine difference here."
    : band === "SENSITIVE"
      ? "You have a sensitive, feeling mind that runs richer than most — a strength that also needs tending. Keep steady routines, calming practices, and honest outlets, and be gentle with yourself in intense stretches."
      : "Your temperament is naturally steady and resilient. Keep the habits that ground you, and your equanimity tends to hold well through life's ups and downs.";

  return {
    module_id: "MOD-HEALTH-MENTAL",
    category: "HEALTH",
    question: "How is my mental peace and emotional wellbeing?",
    band_scale: "MENTAL_PEACE",
    band, intensity, confidence,
    converging_factors: F,
    timing_windows: [],
    coded_outcome: band === "STRAINED" ? "MIND_STRAIN_ELEVATED" : band === "SENSITIVE" ? "STRESS_SENSITIVE_PERIOD" : "MIND_STEADY",
    teaser: band === "STEADY" ? "Your chart carries a naturally steady mind." : "Yours is a deep, feeling mind — a strength worth tending.",
    proactive_step: step,
    owner_only: false,
    guardrail: "health",
  };
}