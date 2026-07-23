// ─────────────────────────────────────────────────────────────────────────────
// AstroIndicators · planetary-strength synthesis (for the Life Indicators book)
// Deterministic, and consistent with the domain engine — it reuses the same
// dignity/house primitives, so it can never contradict a domain reading.
// Output per graha: nature (FAVOURABLE | CHALLENGING | NEUTRAL) + grade (HIGH|MEDIUM|LOW).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "./chart-core";
import { veryStrong, okStrong, weakDig, BENEFICS, kendraTrikona, trikona,
         dusthana, upachaya } from "./shared";

export type StrengthNature = "FAVOURABLE" | "CHALLENGING" | "NEUTRAL";
export type StrengthGrade  = "HIGH" | "MEDIUM" | "LOW";
export interface PlanetStrength {
  graha: Graha; nature: StrengthNature; grade: StrengthGrade;
  score: number; note: string;
}

const GRAHAS: Graha[] = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];

export function planetStrengths(c: ChartData): PlanetStrength[] {
  const g = c.grahas;
  return GRAHAS.map(p => {
    let s = 0; const why: string[] = [];
    const d1 = c.dignityD1(p), d9 = c.dignityD9(p), h = g[p].house;

    // ── D1 dignity ────────────────────────────────────────────────────────────
    if (d1 === "exalted") { s += 3; why.push("exalted"); }
    else if (d1 === "own") { s += 2; why.push("in own sign"); }
    else if (d1 === "friend") { s += 1; }
    else if (d1 === "debilitated") { s -= 3; why.push("debilitated"); }
    else if (d1 === "enemy") { s -= 1; }

    // ── house placement ───────────────────────────────────────────────────────
    if (trikona(h)) { s += 2; why.push(`in a trine (${h}th)`); }
    else if (kendraTrikona(h)) { s += 1; why.push(`in a kendra (${h}th)`); }
    if (dusthana(h)) {
      // malefics tolerate upachaya 6th better; still a strained placement
      const malefic = ["Sun","Mars","Saturn","Rahu","Ketu"].includes(p);
      if (h === 6 && malefic && upachaya(h)) { s -= 1; why.push("in the 6th (fighting-fit but strained)"); }
      else { s -= 2; why.push(`in a difficult ${h}th`); }
    } else if (upachaya(h) && ["Sun","Mars","Saturn"].includes(p)) { s += 1; why.push(`gaining in an upachaya (${h}th)`); }

    // ── combustion / retrograde / node specifics ──────────────────────────────
    if (g[p].combust) { s -= 2; why.push("combust"); }
    if (g[p].retro && (p === "Saturn" || p === "Mars") && !veryStrong(d1)) { s -= 1; why.push("retrograde"); }
    if ((p === "Rahu" || p === "Ketu")) {
      // nodes: judged by house + dispositor, not sign-dignity
      const disp = c.lordOf(g[p].house);
      if (veryStrong(c.dignityD1(disp))) { s += 1; why.push("dispositor is strong"); }
      else if (weakDig(c.dignityD1(disp))) { s -= 1; why.push("dispositor is weak"); }
      if (kendraTrikona(h)) s += 1; if (dusthana(h)) s -= 1;
    }

    // ── D9 durability ─────────────────────────────────────────────────────────
    if (veryStrong(d9)) { s += 1; why.push("holds in the navamsa"); }
    else if (weakDig(d9)) { s -= 1; why.push("weak in the navamsa"); }

    // ── relation with its dispositor (planet in the sign of a strong/weak lord) ─
    const lord = c.lordOf(h);
    if (lord !== p) {
      if (veryStrong(c.dignityD1(lord)) && kendraTrikona(g[lord].house)) { s += 1; }
      else if (weakDig(c.dignityD1(lord)) && dusthana(g[lord].house)) { s -= 1; }
    }

    // ── nature + grade ────────────────────────────────────────────────────────
    // FAVOURABLE if the planet can give clean results; CHALLENGING if it will
    // struggle or act through friction; NEUTRAL when the signals roughly cancel.
    const nature: StrengthNature = s >= 2 ? "FAVOURABLE" : s <= -2 ? "CHALLENGING" : "NEUTRAL";
    const mag = Math.abs(s);
    const grade: StrengthGrade = mag >= 4 ? "HIGH" : mag >= 2 ? "MEDIUM" : "LOW";

    const note = why.slice(0, 2).join(", ") || "mixed, balanced influences";
    return { graha: p, nature, grade, score: s, note };
  });
}
