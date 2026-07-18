// ─────────────────────────────────────────────────────────────────────────────
// Module: Spiritual Peak & Inclination  (Mobility & Fortune)
// 12th (moksha) + Ketu (moksha kāraka) + Jupiter (guru) + Saturn (renunciation) + 9th
// (dharma), with the D9 revealing depth, and the next spiritual-deepening window.
// Flavour named by the dominant graha. THEORY-STRONG (Jawa-derived), gentle register.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong, kendraTrikona, bandFromScore,
         confidenceFromConvergence, intensityFromNet, nextPeakWindow } from "../shared";

type Factor = EngineFact["converging_factors"][number];

export function spiritualPeak(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let s = 0;
  const g = c.grahas;
  const flavour: Record<string, number> = { DEVOTIONAL: 0, MEDITATIVE: 0, ASCETIC: 0, PHILOSOPHICAL: 0 };

  // Jupiter (guru/wisdom) in the moksha/dharma houses
  if ([9,12].includes(g.Jupiter.house) || veryStrong(c.dignityD1("Jupiter"))) { s += 2; flavour.DEVOTIONAL += 2;
    F.push({ chart:"D1", scope:"PLANET", detail:`Jupiter (wisdom) graces the ${g.Jupiter.house === 12 ? "12th (liberation)" : "dharma"} axis`, weight:2 }); }
  // Ketu (moksha kāraka)
  if ([12,9,1].includes(g.Ketu.house)) { s += 2; flavour.MEDITATIVE += 2;
    F.push({ chart:"D1", scope:"PLANET", detail:`Ketu (the seeker's planet) in the ${g.Ketu.house}th — a pull toward the inner/beyond`, weight:2 }); }
  else if (g.Ketu.house === 7) { s += 1; flavour.MEDITATIVE += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"Ketu on the partnership axis — worldly bonds turn the attention inward", weight:1 }); }
  // 12th house tenanted / 12th-lord strong in D9 (depth beneath the surface)
  if (c.planetsIn(12).length > 0) { s += 1; }
  if (veryStrong(c.dignityD9(c.lordOf(12)))) { s += 1; F.push({ chart:"D9", scope:"LORD", detail:"the inner/liberation dimension runs deep beneath the surface (strong in the navamsa)", weight:2 }); }
  // Saturn (renunciation/discipline) on lagna/12th/9th
  if ([1,12,9].includes(g.Saturn.house)) { s += 1; flavour.ASCETIC += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"Saturn's disciplined, renunciate tone touches the self/dharma axis", weight:1 }); }
  // 9th (dharma / higher wisdom) strong
  if (kendraTrikona(g[c.lordOf(9)].house) || veryStrong(c.dignityD1(c.lordOf(9)))) { s += 1; flavour.PHILOSOPHICAL += 1; }

  if (F.length === 0) F.push({ chart:"D1", scope:"HOUSE", detail:"a modest, this-worldly orientation rather than a strongly spiritual one", weight:1 });

  const { band } = bandFromScore(s,
    [{ band:"PRONOUNCED", min:5 }, { band:"PRESENT", min:2 }, { band:"SUBTLE", min:-Infinity }], 9, 0);
  const confidence = confidenceFromConvergence(s);
  const intensity = intensityFromNet(s);
  const flav = Object.entries(flavour).sort((a,b)=>b[1]-a[1])[0][0];
  const flavWord = flav === "DEVOTIONAL" ? "devotional and wisdom-led" : flav === "MEDITATIVE" ? "meditative and inward" : flav === "ASCETIC" ? "disciplined and renunciate" : "philosophical and dharma-led";

  const spiritualActivation = (lord: Graha): number => {
    let v = 0;
    if (lord === "Ketu") v += 3;
    if (lord === "Jupiter") v += 2;
    if (c.lordOf(12) === lord) v += 2;
    if (lord === "Saturn") v += 1;
    return v;
  };
  const peak = band === "SUBTLE" ? null : nextPeakWindow(c, spiritualActivation, nowISO, "A period favouring inner growth");
  const timing_windows = peak ? [{ label: peak.label, start_iso: peak.start_iso, end_iso: peak.end_iso }] : [];

  const step = band === "PRONOUNCED"
    ? `You carry a genuinely deep spiritual current — ${flavWord} in character. Your inner-growth window ahead is a natural time to deepen practice, study, or retreat; lean into it when it comes.`
    : band === "PRESENT"
      ? `A real spiritual thread runs through your life, ${flavWord} in tone. It tends to surface in defined periods — honour those windows for reflection and practice.`
      : `Your path is more this-worldly than contemplative for now, which is perfectly whole. Spirituality can be a quiet resource rather than a central pursuit.`;

  return {
    module_id: "MOD-MOBILITY-SPIRITUAL",
    category: "MOBILITY",
    question: "How strong is my spiritual inclination, and when does it deepen?",
    band_scale: "SPIRITUAL",
    band,
    intensity,
    confidence,
    converging_factors: F,
    timing_windows,
    coded_outcome: (band === "PRONOUNCED" ? "SPIRITUAL_PEAK_WINDOW" : band === "PRESENT" ? "SPIRITUAL_INCLINATION_PRESENT" : "SPIRITUAL_SUBTLE") + "_" + flav,
    teaser: band === "PRONOUNCED" ? "A deep spiritual current runs through your chart." : band === "PRESENT" ? "A real spiritual thread runs through your life." : "Your path leans practical over contemplative.",
    proactive_step: step,
    owner_only: false,
    guardrail: "none",
  };
}