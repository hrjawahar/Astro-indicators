// ─────────────────────────────────────────────────────────────────────────────
// AstroIndicators · adapter: /api/chart response → engine BirthInput
// Principle 11: production consumes the app's own chart.js longitudes, so the
// engine's lagna/houses/dasha always match what the customer sees on screen.
// ─────────────────────────────────────────────────────────────────────────────
import type { BirthInput, GrahaInput } from "./chart-core";

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

export interface ChartApiResponse {
  input: { dob: string; tob: string; utcOffset: number };
  d1: { lagnaSign: string; lagnaDegree: number; degrees: Record<string, number> };
  planets: Record<string, { retrograde: boolean }>;
}

export function chartResponseToBirthInput(
  chart: ChartApiResponse,
  gender: "male" | "female" | "unspecified" = "unspecified",
): BirthInput {
  const si = SIGNS.indexOf(chart.d1.lagnaSign);
  if (si < 0) throw new Error("Unknown lagna sign in chart response");
  const asc = si * 30 + chart.d1.lagnaDegree;

  const NAMES = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu"] as const;
  const positions: GrahaInput[] = NAMES.map(g => {
    const lon = chart.d1.degrees[g];
    if (typeof lon !== "number") throw new Error(`Missing longitude for ${g}`);
    return { graha: g, lon, retro: !!chart.planets[g]?.retrograde };
  });

  // local birth time − utcOffset → UTC ISO (anchors the dasha clock)
  const [y, mo, d] = chart.input.dob.split("-").map(Number);
  const [h, mi] = chart.input.tob.split(":").map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - chart.input.utcOffset * 3600_000;
  const birthISO = new Date(utcMs).toISOString();

  return { birthISO, asc, positions, gender };
}
