// ─────────────────────────────────────────────────────────────────────────────
// Module: Litigation, Court Cases & Legal Disputes  (Crisis, Debt & Legal)
// 6th house (disputes/enemies) — positioning to prevail (strong 6th-lord / malefics
// in the 6th upachaya), with the dispute TYPE named by the 6th-lord's fusion
// ("6th-lord in 7th → marital", "in 2/8 → financial", "in 4 → property", "in 10 →
// workplace") and the next dispute-sensitive window. GUARDRAIL: legal (favourable
// positioning, NEVER a guaranteed win). Validated: Jack — marital litigation, 2024-25.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, upachaya, dusthana, bandFromScore,
         confidenceFromConvergence, intensityFromNet, nextPeakWindow } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function litigation(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let s = 0;
  const g = c.grahas;
  const L6 = c.lordOf(6);

  // ── positioning to prevail ──────────────────────────────────────────────────
  if (veryStrong(c.dignityD1(L6)) || upachaya(g[L6].house)) { s += 2; F.push({ chart:"D1", scope:"LORD", detail:`the disputes-lord ${L6} is strong/well-placed — you tend to hold a firm position`, weight:2 }); }
  else if (weakDig(c.dignityD1(L6))) { s -= 1; F.push({ chart:"D1", scope:"LORD", detail:`the disputes-lord ${L6} is weak — your footing in conflict is less secure`, weight:1 }); }
  // malefics in the 6th (upachaya) → prevails over opponents
  for (const occ of c.planetsIn(6)) if (["Mars","Saturn","Rahu"].includes(occ)) { s += 2; F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the 6th — classical strength to overcome opponents`, weight:2 }); break; }
  if (veryStrong(c.dignityD1("Mars"))) { s += 1; }   // Mars = the fighter/dispute karaka
  if (veryStrong(c.dignityD9(L6))) { s += 1; }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"a quiet 6th — disputes are not a prominent theme", weight:1 });

  const { band } = bandFromScore(s,
    [{ band:"FAVOURABLE", min:3 }, { band:"BALANCED", min:1 }, { band:"DIFFICULT", min:-Infinity }], 8, -3);

  // ── dispute TYPE from 6th-lord fusion ───────────────────────────────────────
  const h6l = g[L6].house;
  const type = h6l === 7 ? "MARITAL" : (h6l === 2 || h6l === 8) ? "FINANCIAL" : h6l === 4 ? "PROPERTY"
             : h6l === 10 ? "WORKPLACE" : h6l === 12 ? "HIDDEN" : "GENERAL";
  const typeWord = { MARITAL:"marital or partnership", FINANCIAL:"financial or debt-related", PROPERTY:"property-related",
                     WORKPLACE:"workplace or professional", HIDDEN:"behind-the-scenes or foreign", GENERAL:"general" }[type];
  if (type !== "GENERAL") F.push({ chart:"D1", scope:"LORD", detail:`the disputes-lord sits in the ${ord(h6l)} — any dispute is likely ${typeWord} in nature`, weight:1 });

  const confidence = confidenceFromConvergence(Math.abs(s));
  const intensity = intensityFromNet(s);

  // ── next dispute-sensitive window ───────────────────────────────────────────
  const disputeActivation = (lord: Graha): number => {
    let v = 0;
    if (c.lordOf(6) === lord) v += 3;
    if (lord === "Mars") v += 1;                       // dispute/conflict karaka
    if (c.planetsIn(6).includes(lord)) v += 2;
    return v;
  };
  const peak = nextPeakWindow(c, disputeActivation, nowISO, "A period where disputes may surface — stay measured");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  const step = band === "FAVOURABLE"
    ? `Your chart positions you favourably in disputes${type !== "GENERAL" ? ", most likely " + typeWord + " ones" : ""}. If a matter arises, press firmly and stay disciplined — keep documentation clean and your conduct measured. This is favourable positioning, not a guaranteed verdict; the outcome still rests on your actions and the facts.`
    : band === "BALANCED"
      ? `Your positioning in disputes is balanced — winnable with care${type !== "GENERAL" ? " (most likely " + typeWord + " matters)" : ""}. Prepare thoroughly, seek good counsel, and stay measured rather than combative.`
      : `Disputes are not your strongest ground. Favour negotiation and settlement over prolonged conflict, keep meticulous records, and lean on experienced counsel rather than fighting on principle.`;

  return {
    module_id: "MOD-CRISIS-LITIGATION",
    category: "CRISIS",
    question: "How am I positioned in legal disputes, and are there sensitive periods?",
    band_scale: "LITIGATION",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: (band === "FAVOURABLE" ? "POSITIONING_FAVOURABLE" : band === "BALANCED" ? "POSITIONING_BALANCED" : "POSITIONING_TESTING") + (type !== "GENERAL" ? "_" + type : ""),
    teaser: band === "FAVOURABLE" ? "In conflict, your chart gives you firm ground to stand on." : band === "BALANCED" ? "Disputes are winnable for you with preparation." : "Your chart favours settlement over courtroom battles.",
    proactive_step: step,
    owner_only: false,
    guardrail: "legal",
  };
}
function ord(n: number): string { return n===2?"2nd":n===4?"4th":n===7?"7th":n===8?"8th":n===10?"10th":n===12?"12th":n+"th"; }