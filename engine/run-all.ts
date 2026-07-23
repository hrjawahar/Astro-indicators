// ─────────────────────────────────────────────────────────────────────────────
// AstroIndicators · run-all: one call → 19 validated EngineFacts
// The single entry the Cloudflare Functions import. Owner-only modules
// (Fidelity, Second-Marriage) are excluded unless includeOwnerOnly is set —
// they must NEVER reach a customer-facing surface.
// ─────────────────────────────────────────────────────────────────────────────
import { buildChart, type BirthInput } from "./chart-core";
import { EngineFactSchema, type EngineFact } from "./schema";
import { chartResponseToBirthInput, type ChartApiResponse } from "./adapter";
import { planetStrengths, type PlanetStrength } from "./planet-strength";
import { lifeGuidance, type GuidanceLine } from "./life-guidance";

import { businessVsEmployment } from "./modules/business-vs-employment";
import { careerStability } from "./modules/career-stability";
import { promotionWindow } from "./modules/promotion-window";
import { wealth } from "./modules/wealth";
import { property } from "./modules/property";
import { maritalLife } from "./modules/marital-life";
import { separationRisk } from "./modules/separation-risk";
import { loveMarriage } from "./modules/love-marriage";
import { progeny } from "./modules/progeny";
import { fidelity } from "./modules/fidelity";
import { secondMarriage } from "./modules/second-marriage";
import { foreignSettlement } from "./modules/foreign-settlement";
import { bhagyodaya } from "./modules/bhagyodaya";
import { spiritualPeak } from "./modules/spiritual-peak";
import { litigation } from "./modules/litigation";
import { debtExit } from "./modules/debt-exit";
import { enemies } from "./modules/enemies";
import { healthLongevity } from "./modules/health-longevity";
import { mentalPeace } from "./modules/mental-peace";

export { chartResponseToBirthInput, planetStrengths, lifeGuidance };
export type { PlanetStrength, GuidanceLine };
export type { ChartApiResponse, EngineFact };

export interface RunResult {
  facts: EngineFact[];
  errors: { module: string; issues: unknown }[];
}

export function runEngine(
  input: BirthInput,
  opts: { nowISO?: string; includeOwnerOnly?: boolean } = {},
): RunResult {
  const now = opts.nowISO ?? new Date().toISOString();
  const c = buildChart(input);
  const raw: EngineFact[] = [
    businessVsEmployment(c, now), careerStability(c, now), promotionWindow(c, now),
    wealth(c, now), property(c),
    maritalLife(c), separationRisk(c, now), loveMarriage(c), progeny(c, now),
    fidelity(c), secondMarriage(c),
    foreignSettlement(c, now), bhagyodaya(c, now), spiritualPeak(c, now),
    litigation(c, now), debtExit(c, now), enemies(c),
    healthLongevity(c, now), mentalPeace(c),
  ];
  const facts: EngineFact[] = [];
  const errors: RunResult["errors"] = [];
  for (const f of raw) {
    const v = EngineFactSchema.safeParse(f);
    if (!v.success) { errors.push({ module: f.module_id, issues: v.error.issues }); continue; }
    if (f.owner_only && !opts.includeOwnerOnly) continue;   // structural guarantee
    facts.push(v.data);
  }
  return { facts, errors };
}

export function runEngineFromChartResponse(
  chart: ChartApiResponse,
  gender: "male" | "female" | "unspecified",
  opts: { nowISO?: string; includeOwnerOnly?: boolean } = {},
): RunResult {
  return runEngine(chartResponseToBirthInput(chart, gender), opts);
}

// book extras: planetary-strength table + behavioural guidance, from a chart response
export function bookExtras(chart: ChartApiResponse, gender: "male"|"female"|"unspecified") {
  const c = buildChart(chartResponseToBirthInput(chart, gender));
  return { strengths: planetStrengths(c), guidance: lifeGuidance(c) };
}
