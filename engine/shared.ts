// ─────────────────────────────────────────────────────────────────────────────
// AstroIndicators · shared engine primitives
// One definition each of "dignified", "dusthana", benefic/malefic, and the
// scoring helpers — so every domain module reasons on identical foundations.
// ─────────────────────────────────────────────────────────────────────────────
import type { Graha, Dignity } from "./chart-core";

// ── dignity tiers ────────────────────────────────────────────────────────────
export const veryStrong = (d: Dignity) => d === "exalted" || d === "own";
export const okStrong   = (d: Dignity) => d === "exalted" || d === "own" || d === "friend";
export const weakDig    = (d: Dignity) => d === "debilitated" || d === "enemy";

// ── house classes ────────────────────────────────────────────────────────────
export const kendra        = (h: number) => [1, 4, 7, 10].includes(h);
export const trikona       = (h: number) => [1, 5, 9].includes(h);
export const kendraTrikona = (h: number) => [1, 4, 5, 7, 9, 10].includes(h);
export const dusthana      = (h: number) => [6, 8, 12].includes(h);
export const upachaya      = (h: number) => [3, 6, 10, 11].includes(h);   // malefics strengthen here

// ── planet natures ───────────────────────────────────────────────────────────
export const BENEFICS: Graha[] = ["Jupiter", "Venus", "Mercury", "Moon"];
export const MALEFICS: Graha[] = ["Sun", "Mars", "Saturn", "Rahu", "Ketu"];

// ── scoring helpers ──────────────────────────────────────────────────────────
export type Intensity = "LOW" | "MODERATE" | "HIGH" | "SEVERE";

/** Confidence from how decisively one pole outweighs the other. */
export function confidenceFromMargin(hi: number, lo: number, floor = 45, cap = 95): number {
  const h = Math.max(hi, 1);
  return Math.min(cap, Math.max(floor, Math.round(48 + 48 * (h - lo) / h)));
}

/** Intensity band from the net-score magnitude. */
export function intensityFromNet(net: number): Intensity {
  const a = Math.abs(net);
  return a >= 7 ? "SEVERE" : a >= 5 ? "HIGH" : a >= 3 ? "MODERATE" : "LOW";
}

// ─── overfitting-resistant banding ───────────────────────────────────────────
// Turns a raw score into { band, confidence }. Confidence is HIGH when the score
// sits deep inside a band's zone and LOW near a boundary — so a borderline chart
// reads "MODERATE, 58%" rather than being confidently mis-banded. The top band's
// ceiling is the CLASSICAL maximum (a textbook-perfect chart), not our best sample,
// which decouples each band from the exemplars we happened to calibrate on.
export interface BandZone { band: string; min: number; }   // list DESCENDING by min; last min = -Infinity

export function bandFromScore(
  score: number,
  zones: BandZone[],
  classicalMax?: number,
  classicalMin?: number,
): { band: string; confidence: number } {
  let idx = zones.findIndex(z => score >= z.min);
  if (idx === -1) idx = zones.length - 1;
  const band = zones[idx].band;
  const upper = idx > 0 ? zones[idx - 1].min : (classicalMax ?? zones[0].min + 6);
  const lower = idx < zones.length - 1 ? zones[idx].min : (classicalMin ?? zones[zones.length - 1].min);
  const nearest = Math.min(Math.abs(upper - score), Math.abs(score - lower));
  const halfZone = Math.max(1, (upper - lower) / 2);
  const confidence = Math.round(Math.min(92, Math.max(50, 50 + 42 * Math.min(1, nearest / halfZone))));
  return { band, confidence };
}

// ─── confidence = strength of Vedic convergence (NOT threshold proximity) ─────
// The band is set by classical rules; confidence reflects how strongly the
// independent factors AGREE. A chart is STRONG if the rules say so — full stop;
// confidence just says how emphatically the chart states it.
export function confidenceFromConvergence(winningWeight: number): number {
  return Math.min(93, Math.max(48, Math.round(48 + 5.5 * winningWeight)));
}

// ─── next upcoming PEAK window (dasha = clock, D9 = durability check) ──────────
import type { ChartData, Graha } from "./chart-core";
export interface PeakWindow { label: string; start_iso: string; end_iso: string; driver: Graha; durable: boolean; score: number; }

// activation(lord) = how strongly this graha's period activates the domain (domain-specific, rule-based)
export function nextPeakWindow(
  c: ChartData,
  activation: (lord: Graha) => number,
  nowISO: string,
  label = "Peak window",
  horizonYears = 18,
): PeakWindow | null {
  const now = new Date(nowISO).getTime();
  const horizon = now + horizonYears * 365.25 * 86400 * 1000;
  const maxAct = Math.max(...(Object.keys(c.grahas) as Graha[]).map(activation), 0.001);
  const bar = Math.max(1.5, maxAct * 0.5);                 // a "genuine" activation, relative to the chart's own best
  type Cand = { start: string; end: string; driver: Graha; score: number; t: number };
  const cands: Cand[] = [];
  for (const md of c.dasha) {
    const aMd = activation(md.lord);
    for (const ad of md.antar ?? []) {
      const st = new Date(ad.startISO).getTime(), en = new Date(ad.endISO).getTime();
      if (en <= now || st > horizon) continue;              // must be ongoing or future
      const aAd = activation(ad.lord);
      const score = aMd * 0.6 + aAd;                        // MD sets the era, AD sharpens it
      if (score < bar) continue;
      const driver = aAd >= aMd ? ad.lord : md.lord;
      cands.push({ start: ad.startISO, end: ad.endISO, driver, score: +score.toFixed(2), t: st });
    }
  }
  if (!cands.length) return null;
  // NEXT upcoming: earliest-starting qualifying window (ties → higher score)
  cands.sort((a, b) => a.t - b.t || b.score - a.score);
  const w = cands[0];
  const durable = !weakDig(c.dignityD9(w.driver));          // D9 durability check on the driving graha
  return { label, start_iso: w.start, end_iso: w.end, driver: w.driver, durable, score: w.score };
}

// Retrospective + prospective windows: the most-recent PAST qualifying window
// (already expressed) and the NEXT upcoming one. For event-risk modules that must
// acknowledge a past event AND flag the next sensitive period (careful register).
export function pastAndNextWindows(
  c: ChartData,
  activation: (lord: Graha) => number,
  nowISO: string,
  label = "Sensitive window",
  horizonYears = 15,
): { past: PeakWindow | null; next: PeakWindow | null } {
  const now = new Date(nowISO).getTime();
  const horizon = now + horizonYears * 365.25 * 86400 * 1000;
  const birth = new Date(c.dasha[0].startISO).getTime();
  const adultFloor = birth + 20 * 365.25 * 86400 * 1000;   // relationship events only after ~marriageable age
  const maxAct = Math.max(...(Object.keys(c.grahas) as Graha[]).map(activation), 0.001);
  const bar = Math.max(1.5, maxAct * 0.5);
  const mk = (adStart: string, adEnd: string, driver: Graha, score: number): PeakWindow =>
    ({ label, start_iso: adStart, end_iso: adEnd, driver, durable: !weakDig(c.dignityD9(driver)), score: +score.toFixed(2) });
  let past: (PeakWindow & { t: number }) | null = null;
  let next: (PeakWindow & { t: number }) | null = null;
  for (const md of c.dasha) {
    const aMd = activation(md.lord);
    for (const ad of md.antar ?? []) {
      const st = new Date(ad.startISO).getTime(), en = new Date(ad.endISO).getTime();
      const aAd = activation(ad.lord);
      const score = aMd * 0.6 + aAd;
      if (score < bar) continue;
      const driver = aAd >= aMd ? ad.lord : md.lord;
      const w = { ...mk(ad.startISO, ad.endISO, driver, score), t: st };
      if (en <= now && st >= adultFloor) { if (!past || st > past.t) past = w; }              // MOST RECENT past (adult)
      else if (en > now && st <= horizon) { if (!next || st < next.t) next = w; }              // soonest upcoming
    }
  }
  const strip = (w: (PeakWindow & { t: number }) | null): PeakWindow | null =>
    w ? { label: w.label, start_iso: w.start_iso, end_iso: w.end_iso, driver: w.driver, durable: w.durable, score: w.score } : null;
  return { past: strip(past), next: strip(next) };
}

// activation-set builders (domain-specific, classical) ------------------------
export function careerActivation(c: ChartData) {
  return (lord: Graha): number => {
    const g = c.grahas; let s = 0;
    if (c.lordOf(10) === lord) s += 3;
    if (c.lordOf(11) === lord) s += 2;
    if (c.lordOf(6) === lord) s += 1;
    if (g[lord].house === 10) s += 2;
    if (lord === "Sun") s += 1; if (lord === "Saturn") s += 1;
    if (s === 0) return 0;
    let dur = 1;
    if (veryStrong(c.dignityD1(lord))) dur += 0.4; else if (weakDig(c.dignityD1(lord))) dur -= 0.3;
    if (veryStrong(c.dignityD9(lord))) dur += 0.4; else if (weakDig(c.dignityD9(lord))) dur -= 0.4;
    if (kendraTrikona(g[lord].house)) dur += 0.2;
    return s * Math.max(0.3, dur);
  };
}
export function businessActivation(c: ChartData) {
  return (lord: Graha): number => {
    const g = c.grahas; let s = 0;
    if (c.lordOf(7) === lord) s += 3;
    if (c.lordOf(3) === lord) s += 2;
    if (c.lordOf(11) === lord) s += 2;
    if (c.lordOf(10) === lord) s += 1;
    if ([3,7,11].includes(g[lord].house)) s += 1;
    if (["Venus","Mercury","Rahu"].includes(lord)) s += 1;
    if (s === 0) return 0;
    let dur = 1;
    if (veryStrong(c.dignityD1(lord))) dur += 0.4; else if (weakDig(c.dignityD1(lord))) dur -= 0.3;
    if (veryStrong(c.dignityD9(lord))) dur += 0.5; else if (weakDig(c.dignityD9(lord))) dur -= 0.4;
    return s * Math.max(0.3, dur);
  };
}
export function wealthActivation(c: ChartData) {
  return (lord: Graha): number => {
    const g = c.grahas; let s = 0;
    if (c.lordOf(2) === lord) s += 3;
    if (c.lordOf(11) === lord) s += 3;
    if (lord === "Jupiter") s += 1;
    if ([2,11].includes(g[lord].house)) s += 1;
    if (s === 0) return 0;
    let dur = 1;
    if (veryStrong(c.dignityD1(lord))) dur += 0.4; else if (weakDig(c.dignityD1(lord))) dur -= 0.3;
    if (veryStrong(c.dignityD9(lord))) dur += 0.4; else if (weakDig(c.dignityD9(lord))) dur -= 0.4;
    return s * Math.max(0.3, dur);
  };
}