// ─────────────────────────────────────────────────────────────────────────────
// Module: Wealth & Financial Growth  (Career & Wealth)
// Dhana-yoga scoring (2nd + 11th lords + Jupiter), the D9 durability modifier, and
// datable wealth-activation windows from the dhana-lords' dasha/bhukti periods
// (the first module to emit timing_windows). Validated: case-4 (15-clinic doctor) → STRONG.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, okStrong, weakDig, BENEFICS,
         kendraTrikona, dusthana, intensityFromNet, bandFromScore,
         confidenceFromConvergence, nextPeakWindow, wealthActivation } from "../shared";

type Factor = EngineFact["converging_factors"][number];
// wealth SOURCE hint from the dominant dhana-driving graha
const SOURCE: Record<Graha, string> = {
  Venus:"luxury, metals or beauty trades", Mercury:"trade, commerce or communication",
  Mars:"property, medical or engineering ventures", Jupiter:"finance, advisory or teaching",
  Sun:"leadership, pharma or government-linked work", Moon:"food, public-facing or care services",
  Saturn:"manufacturing, labour or long-cycle assets", Rahu:"foreign trade, technology or ventures",
  Ketu:"niche or specialised trades",
};

export function wealth(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let sup = 0, det = 0;
  const g = c.grahas;
  const L2 = c.lordOf(2), L11 = c.lordOf(11);
  const goodHouse = (h: number) => kendraTrikona(h) || h === 2 || h === 11;

  // ── 2nd lord (accumulation) ─────────────────────────────────────────────────
  scoreLord("wealth-lord", L2);
  // ── 11th lord (gains) ───────────────────────────────────────────────────────
  scoreLord("gains-lord", L11);

  function scoreLord(name: string, L: Graha) {
    if (veryStrong(c.dignityD1(L))) { sup += 2; F.push({ chart:"D1", scope:"LORD", detail:`${name} ${L} is dignified`, weight:2 }); }
    else if (c.dignityD1(L) === "friend") { sup += 1; F.push({ chart:"D1", scope:"LORD", detail:`${name} ${L} is well-disposed`, weight:1 }); }
    else if (weakDig(c.dignityD1(L))) { det += 2; F.push({ chart:"D1", scope:"LORD", detail:`${name} ${L} is weak`, weight:2 }); }
    if (goodHouse(g[L].house)) { sup += 1; F.push({ chart:"D1", scope:"LORD", detail:`${name} well-placed (house ${g[L].house})`, weight:1 }); }
    else if (dusthana(g[L].house)) { det += 2; F.push({ chart:"D1", scope:"LORD", detail:`${name} in a difficult ${g[L].house}th house`, weight:2 }); }
  }

  // ── Dhana yoga: 2nd & 11th lords linked (conjunct / in each other's house / same house) ─
  if (c.houseOfLordOf(2) === 11 || c.houseOfLordOf(11) === 2 || g[L2].house === g[L11].house) { sup += 3;
    F.push({ chart:"D1", scope:"YOGA", detail:"wealth-lord and gains-lord are linked — a money-forming (Dhana) combination", weight:3 }); }

  // ── Jupiter (dhana kāraka) ──────────────────────────────────────────────────
  if (veryStrong(c.dignityD1("Jupiter")) || [2,5,9,11].includes(g.Jupiter.house)) { sup += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"Jupiter (wealth significator) well-disposed", weight:1 }); }

  // ── loaded gain-house (11th) & 2nd occupants (benefic / dignified) ───────────
  let occSup = 0;
  for (const h of [2, 11]) for (const occ of c.planetsIn(h)) {
    if (veryStrong(c.dignityD1(occ)) || (BENEFICS.includes(occ) && !weakDig(c.dignityD1(occ)))) {
      occSup = Math.min(2, occSup + 1);
    }
  }
  if (occSup) { sup += occSup; F.push({ chart:"D1", scope:"HOUSE", detail:"strong planets occupy the wealth/gain houses", weight:occSup as 1|2 }); }

  // ── D9 durability of the dhana-lords ────────────────────────────────────────
  if (veryStrong(c.dignityD9(L2)) || veryStrong(c.dignityD9(L11))) { sup += 2;
    F.push({ chart:"D9", scope:"LORD", detail:"wealth capacity sustains in the navamsa — durable", weight:3 }); }
  else if (weakDig(c.dignityD9(L2)) && weakDig(c.dignityD9(L11))) { det += 2;
    F.push({ chart:"D9", scope:"LORD", detail:"wealth-lords weak in navamsa — accumulation is harder to hold", weight:2 }); }

  // ── verdict ─────────────────────────────────────────────────────────────────
  const net = sup - det;
  const { band } = bandFromScore(net,
    [{ band:"STRONG", min:6 }, { band:"STEADY", min:3 }, { band:"MODEST", min:-Infinity }],
    13, -4);
  const confidence = confidenceFromConvergence(Math.max(sup, det));
  const outcome = band === "STRONG" ? "WEALTH_GROWTH_STRONG"
                : band === "STEADY" ? "WEALTH_ACCUMULATES_STEADY" : "WEALTH_GRADUAL";
  const intensity = intensityFromNet(net);

  // ── next upcoming wealth-activation window (dasha clock, D9 durability) ───────
  const peak = nextPeakWindow(c, wealthActivation(c), nowISO, "Wealth-activation window");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  // ── wealth source (dominant dhana-driver) ───────────────────────────────────
  const driver = pickDriver(c, L2, L11);
  const sourceText = SOURCE[driver];

  return {
    module_id: "MOD-WEALTH-DHANA",
    category: "WEALTH",
    question: "How strong is my wealth-building potential, and when does it activate?",
    band_scale: "WEALTH",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: outcome,
    teaser: band === "STRONG"
      ? "Your chart carries a genuine wealth-building signature — money tends to compound when you engage it."
      : band === "STEADY"
        ? "Your chart supports steady, earned accumulation — wealth grows with consistency."
        : "Your chart favours gradual, disciplined saving over rapid gains.",
    proactive_step: (band === "STRONG"
      ? `Lean into ${sourceText} and let assets compound; act within your activation windows rather than waiting.`
      : band === "STEADY"
        ? `Build steadily through ${sourceText}; automate savings and use your activation windows to push harder.`
        : `Prioritise a strong savings discipline; ${sourceText} suit you, and your activation windows are when to concentrate effort.`),
    owner_only: false,
    guardrail: "none",
  };
}

function pickDriver(c: ChartData, L2: Graha, L11: Graha): Graha {
  const g = c.grahas;
  const cand: { graha: Graha; s: number }[] = [];
  for (const graha of [L2, L11, ...c.planetsIn(11), c.lordOf(2)] as Graha[]) {
    let s = 0;
    if (c.dignityD1(graha) === "exalted") s += 2; else if (veryStrong(c.dignityD1(graha))) s += 1;
    if (g[graha].house === 11) s += 2; else if (g[graha].house === 2) s += 1;
    cand.push({ graha, s });
  }
  cand.sort((a,b)=> b.s - a.s);
  return cand[0]?.graha ?? "Jupiter";
}