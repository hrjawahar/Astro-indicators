// ─────────────────────────────────────────────────────────────────────────────
// Module: Love Marriage & Relationships  (Marriage & Relationship)
// 5th (romance) ↔ 7th (marriage) linkage = love-marriage; Venus in/ruling 5th-7th;
// Venus–Mars = intensity; Rahu on 5th/7th/Venus = inter-cultural / unconventional partner.
// Bands: LOVE · EITHER · ARRANGED (+ inter-cultural flag). Validated: Neethu & Daya (case-8).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, bandFromScore, confidenceFromConvergence, intensityFromNet } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function loveMarriage(c: ChartData): EngineFact {
  const F: Factor[] = [];
  let love = 0, arranged = 0;
  const g = c.grahas;
  const L5 = c.lordOf(5), L7 = c.lordOf(7);

  // 5th↔7th lord linkage — the core love-marriage signature
  const exchange = g[L5].house === 7 || g[L7].house === 5;
  const conjunct = g[L5].house === g[L7].house;
  if (exchange) { love += 3; F.push({ chart:"D1", scope:"YOGA", detail:"the romance (5th) and marriage (7th) lords exchange houses — a strong love-marriage signature", weight:3 }); }
  else if (conjunct) { love += 2; F.push({ chart:"D1", scope:"YOGA", detail:"the romance and marriage lords sit together — romance flows into marriage", weight:2 }); }
  // (absence of a 5–7 link is neutral — many love matches lack the exact exchange)

  // Venus (romance kāraka) in or ruling the 5th/7th
  if (g.Venus.house === 5 || g.Venus.house === 7) { love += 2; F.push({ chart:"D1", scope:"PLANET", detail:"Venus graces the romance/marriage axis", weight:2 }); }
  if (L5 === "Venus" || L7 === "Venus") { love += 1; }

  // self-directed romantic nature: 5th-lord (romance) prominent in lagna/kendra
  if ([1,4,7,10].includes(g[L5].house)) { love += 1; F.push({ chart:"D1", scope:"LORD", detail:"the romance-lord is prominent and self-directed — an independent, feelings-led approach to partnership", weight:1 }); }

  // Venus–Mars contact → passion/intensity
  if (g.Venus.house === g.Mars.house) { love += 1; F.push({ chart:"D1", scope:"PLANET", detail:"Venus with Mars — intense, passion-led attraction", weight:1 }); }

  // Saturn / Jupiter tradition on the 7th without a 5–7 link → leans arranged
  if (g.Saturn.house === 7 || L7 === "Saturn") { arranged += 2; F.push({ chart:"D1", scope:"HOUSE", detail:"Saturn's dutiful, traditional stamp on the 7th", weight:2 }); }
  if (g.Jupiter.house === 7 && !exchange && !conjunct) { arranged += 1; F.push({ chart:"D1", scope:"HOUSE", detail:"Jupiter's conventional, family-sanctioned tone on the 7th", weight:1 }); }

  // ── inter-cultural / unconventional partner (Rahu on 5/7/Venus) ──────────────
  const intercultural = g.Rahu.house === 7 || g.Rahu.house === 5 || g.Rahu.house === g.Venus.house || g.Ketu.house === 7;
  if (intercultural) { love += 1; F.push({ chart:"D1", scope:"PLANET", detail:"Rahu touches the partnership axis — an unconventional or inter-cultural union", weight:1 }); }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"partnership style is balanced between chosen and introduced paths", weight:1 });

  const net = love - arranged;
  const { band } = bandFromScore(net,
    [{ band:"LOVE", min:3 }, { band:"EITHER", min:0 }, { band:"ARRANGED", min:-Infinity }], 8, -4);
  const outcome = band === "LOVE" ? (intercultural ? "LOVE_MARRIAGE_INTERCULTURAL" : "LOVE_MARRIAGE_INDICATED")
                : band === "EITHER" ? "EITHER_PATH_OPEN" : "ARRANGED_LIKELY";
  const confidence = confidenceFromConvergence(Math.max(love, arranged));

  const step = band === "LOVE"
    ? (intercultural
        ? "A love match is strongly favoured — likely across a cultural, community, or unconventional line. Trust that attraction, and give a cross-boundary relationship the family groundwork it needs to land well."
        : "A love match is strongly favoured — you're wired to marry someone you choose and fall for. Follow genuine connection; it aligns with your chart.")
    : band === "ARRANGED"
      ? "Your chart leans toward a considered, family-involved union — an introduced or arranged match tends to suit you, and can absolutely include real warmth. Let trusted people help; it plays to your grain."
      : "Both paths are open to you — love or arranged can each work. Choose by the quality of the person and the connection rather than the route you meet them through.";

  return {
    module_id: "MOD-MARRIAGE-LOVE",
    category: "MARRIAGE",
    question: "Am I more likely to have a love marriage or an arranged one?",
    band_scale: "MARRIAGE_TYPE",
    band,
    intensity: intensityFromNet(net),
    confidence,
    converging_factors: F,
    timing_windows: [],
    coded_outcome: outcome,
    teaser: band === "LOVE" ? "Your chart leans toward marrying for love." : band === "ARRANGED" ? "Your chart leans toward a considered, introduced match." : "Both love and arranged paths are open to you.",
    proactive_step: step,
    owner_only: false,
    guardrail: "none",
  };
}