// ─────────────────────────────────────────────────────────────────────────────
// Module: Separation / Divorce Risk  (Marriage & Relationship)
// Structural rupture-risk (LOW/MODERATE/HIGH) from 7th-house affliction, plus the
// next rupture-sensitive WINDOW (afflicted-7th-lord's own bhukti / malefic-to-7th /
// nodal & maraka periods). Careful register: a "needs-attention" window, never a verdict.
// Validated: case-3 (deb-Jupiter-in-7th → divorced 2024) & Jawa (Ketu-7th → divorced 2014) → HIGH.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, weakDig, BENEFICS, kendraTrikona, dusthana,
         intensityFromNet, bandFromScore, confidenceFromConvergence, pastAndNextWindows } from "../shared";

type Factor = EngineFact["converging_factors"][number];
const HARD_MALEFIC: Graha[] = ["Saturn","Mars","Rahu","Ketu"];

export function separationRisk(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let risk = 0, mit = 0;
  const g = c.grahas;
  const L7 = c.lordOf(7);
  const afflicted7 = weakDig(c.dignityD1(L7)) || dusthana(g[L7].house);

  // ── rupture-risk factors ────────────────────────────────────────────────────
  if (dusthana(g[L7].house)) { const w = g[L7].house === 6 || g[L7].house === 8 ? 3 : 2; risk += w;
    F.push({ chart:"D1", scope:"LORD", detail:`marriage-lord in the ${g[L7].house}th — the bond is pulled toward ${g[L7].house===6?"conflict":g[L7].house===8?"upheaval/endings":"distance/loss"}`, weight:Math.min(3,w) as 1|2|3 }); }
  if (weakDig(c.dignityD1(L7))) { const inSeventh = g[L7].house === 7; risk += inSeventh ? 3 : 2;
    F.push({ chart:"D1", scope:"LORD", detail:`marriage-lord is weak${inSeventh ? " and sits in the marriage house itself" : ""}`, weight:inSeventh ? 3 : 2 }); }
  for (const occ of c.planetsIn(7)) if (c.dignityD1(occ) === "debilitated") {
    const isKaraka = occ === "Jupiter" || occ === "Venus";
    const w = isKaraka ? 3 : 2; risk += w;
    F.push({ chart:"D1", scope:"HOUSE", detail:`${isKaraka ? "the marriage significator " : ""}${occ}, debilitated in the marriage house, weakens its very foundation`, weight:3 });
  }
  if (g.Ketu.house === 7) { risk += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:"Ketu in the 7th — a detaching, sometimes non-cohabiting pull on partnership", weight:2 }); }
  for (const occ of c.planetsIn(7)) if (["Saturn","Mars","Rahu"].includes(occ) && !veryStrong(c.dignityD1(occ))) { risk += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the 7th stresses the union`, weight:2 }); break; }
  if ([1,7].includes(g.Rahu.house) || [1,7].includes(g.Ketu.house)) { risk += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:"the nodal axis crosses the self–partner axis", weight:2 }); }
  if (g.Venus.combust && dusthana(g.Venus.house)) { risk += 2;
    F.push({ chart:"D1", scope:"PLANET", detail:"Venus combust in a difficult house — affection is strained and vulnerable to wandering", weight:2 }); }
  else if (c.dignityD1("Venus") === "debilitated") { risk += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"Venus (love) is debilitated", weight:1 }); }
  // spouse significator (gender-specific): Venus for a man, Jupiter for a woman
  const sk = c.spouseKaraka;
  if (sk && c.dignityD1(sk) === "debilitated") { risk += 2;
    F.push({ chart:"D1", scope:"PLANET", detail:`the spouse significator (${sk}) is debilitated — the partner-axis significator is weak`, weight:2 }); }
  else if (sk && weakDig(c.dignityD9(sk))) { risk += 1;
    F.push({ chart:"D9", scope:"PLANET", detail:`the spouse significator (${sk}) is weak in the navamsa`, weight:1 }); }
  // D9 durability of the bond
  if (weakDig(c.dignityD9(L7))) { risk += 2;
    F.push({ chart:"D9", scope:"LORD", detail:"marriage-lord weak in the navamsa — the bond is harder to sustain when tested", weight:3 }); }

  // ── mitigation ───────────────────────────────────────────────────────────────
  for (const occ of c.planetsIn(7)) if (BENEFICS.includes(occ) && !weakDig(c.dignityD1(occ))) { mit += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:`${occ} in the 7th steadies the bond`, weight:2 }); break; }
  if ([1,3,11].includes(g.Jupiter.house)) { mit += 2; F.push({ chart:"D1", scope:"ASPECT", detail:"Jupiter's aspect protects the marriage", weight:2 }); }
  if (veryStrong(c.dignityD1(L7)) && kendraTrikona(g[L7].house)) { mit += 3; F.push({ chart:"D1", scope:"LORD", detail:"marriage-lord strong and well-placed", weight:3 }); }
  if (veryStrong(c.dignityD9(L7))) { mit += 1; }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"the partnership axis carries no major affliction", weight:1 });

  // ── band (classical) ────────────────────────────────────────────────────────
  const net = risk - mit;
  const { band } = bandFromScore(net,
    [{ band:"HIGH", min:6 }, { band:"MODERATE", min:3 }, { band:"LOW", min:-Infinity }], 12, -4);
  const outcome = band === "HIGH" ? "SEPARATION_RISK_WINDOW" : band === "MODERATE" ? "STRAIN_WATCH_WINDOW" : "BOND_DURABLE";
  const confidence = confidenceFromConvergence(Math.max(risk, mit));
  const intensity = intensityFromNet(net);

  // ── next rupture-sensitive window (only when there IS structural risk) ────────
  const separationActivation = (lord: Graha): number => {
    let s = 0;
    if (c.lordOf(7) === lord) { s += 2; if (afflicted7) s += 2; }
    if (g.Ketu.house === 7 && lord === "Ketu") s += 3;
    if (c.planetsIn(7).includes(lord) && (HARD_MALEFIC.includes(lord) || c.dignityD1(lord) === "debilitated")) s += 2;
    if ((c.lordOf(2) === lord || c.lordOf(7) === lord)) s += 1;  // maraka activation
    return s;
  };
  const wins = band === "LOW" ? { past: null, next: null }
             : pastAndNextWindows(c, separationActivation, nowISO, "Relationship-sensitive window", 15);
  const timing_windows: EngineFact["timing_windows"] = [];
  if (wins.next) timing_windows.push({ label: "A sensitive period ahead — approach with attention and care", start_iso: wins.next.start_iso, end_iso: wins.next.end_iso });
  const hadPast = !!wins.past;   // a past adult activation existed → acknowledge generally (no false-precise date)

  const retro = hadPast ? "This is a standing pattern rather than a one-time event, so if you've already navigated a significant separation, the same sensitivity continues to ask for conscious attention. " : "";
  const step = band === "HIGH"
    ? retro + "This partnership axis carries real structural strain. If you value a relationship, treat honest communication and (where helpful) counselling as essential rather than optional — and give the sensitive window ahead extra care and patience."
    : band === "MODERATE"
      ? retro + "There's a manageable strain on the partnership axis. Stay attentive during the sensitive window ahead — address friction early and openly, and it holds well."
      : "The partnership axis is fundamentally durable. Ordinary care keeps it steady.";

  return {
    module_id: "MOD-MARRIAGE-SEPARATION",
    category: "MARRIAGE",
    question: "How durable is my marriage, and are there periods needing extra care?",
    band_scale: "SEPARATION_RISK",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: outcome,
    teaser: band === "LOW"
      ? "Your chart supports a partnership that endures."
      : "Partnership is a theme that rewards conscious tending in your chart.",
    proactive_step: step,
    owner_only: false,
    guardrail: "none",
  };
}