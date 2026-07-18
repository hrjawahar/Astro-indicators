// ─────────────────────────────────────────────────────────────────────────────
// AstroIndicators · EngineFact schema (the contract between engine, AI, and UI)
// Language-neutral. Zod refinements encode the Honest-Alert safety law as code.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";

export const BAND_SCALES = {
  CAREER_STABILITY: ["STRONG","STEADY","FLUCTUATING","WEAK"],
  WORK_MODE:        ["INDEPENDENT","HYBRID","INSTITUTIONAL"],
  CAREER_RISE:      ["STRONG","MODERATE","SUBDUED"],
  WEALTH:           ["STRONG","STEADY","MODEST"],
  PROPERTY:         ["FAVOURABLE","MIXED","OBSTRUCTED"],
  MARRIAGE_LIFE:    ["SMOOTH","MANAGEABLE","CHALLENGING"],
  SEPARATION_RISK:  ["LOW","MODERATE","HIGH"],
  MARRIAGE_TYPE:    ["LOVE","EITHER","ARRANGED"],
  PROGENY:          ["SUPPORTED","ATTENTIVE","HIGH_CARE"],
  FIDELITY_STRESS:  ["LOW","MODERATE","HIGH"],
  REMARRIAGE:       ["INDICATED","POSSIBLE","UNLIKELY"],
  MOBILITY:         ["STRONG","MODERATE","WEAK"],
  FORTUNE:          ["RISING","MIXED","DELAYED"],
  SPIRITUAL:        ["PRONOUNCED","PRESENT","SUBTLE"],
  LITIGATION:       ["FAVOURABLE","BALANCED","DIFFICULT"],
  DEBT_PHASE:       ["EASING","MANAGEABLE","PRESSURED"],
  OBSTACLES:        ["FAVOURABLE","CONTESTED","HEAVY"],
  HEALTH:           ["STEADY","WATCHFUL","ELEVATED"],
  MENTAL_PEACE:     ["STEADY","SENSITIVE","STRAINED"],
} as const;
export type BandScale = keyof typeof BAND_SCALES;

export const BUSINESS_TYPES = [
  "PRECIOUS_METALS","LUXURY_ARTS","COMMODITIES_TRADE","RETAIL_IT","REAL_ESTATE",
  "ENGINEERING","FINANCE_ADVISORY","EDUCATION_LAW","FOOD_BEVERAGE","CARE_SERVICES",
  "MANUFACTURING","AGRI_LOGISTICS","IMPORT_EXPORT_TECH","NICHE_SPIRITUAL","LEADERSHIP_PHARMA",
] as const;

const Factor = z.object({
  chart:  z.enum(["D1","D9"]),
  scope:  z.enum(["LAGNA","PLANET","HOUSE","LORD","BHUKTI","DASHA","YOGA","ASPECT"]),
  detail: z.string().min(3),
  weight: z.number().int().min(1).max(3),
});
const Window = z.object({
  label: z.string(), start_iso: z.string().datetime(), end_iso: z.string().datetime(),
}).refine(w => w.end_iso > w.start_iso, { message: "end must be after start", path: ["end_iso"] });

const BusinessType = z.object({
  primary:   z.enum(BUSINESS_TYPES),
  secondary: z.enum(BUSINESS_TYPES).optional(),
  driver:    z.object({ primary: z.string(), secondary: z.string().optional() }),
});

export const EngineFactSchema = z.object({
  module_id:  z.string(),
  category:   z.enum(["CAREER","MARRIAGE","MOBILITY","CRISIS","HEALTH","WEALTH"]),
  question:   z.string(),
  band_scale: z.enum(Object.keys(BAND_SCALES) as [BandScale, ...BandScale[]]),
  band:       z.string(),
  intensity:  z.enum(["LOW","MODERATE","HIGH","SEVERE"]),
  confidence: z.number().int().min(0).max(100),
  converging_factors: z.array(Factor).min(1),
  timing_windows:     z.array(Window),
  coded_outcome: z.string().regex(/^[A-Z_]+$/, "coded_outcome must be an ENUM"),
  business_type: BusinessType.optional(),
  teaser:        z.string(),
  proactive_step: z.string(),
  owner_only:  z.boolean(),
  guardrail:   z.enum(["none","health","visa","legal","child"]),
})
  .refine(d => (BAND_SCALES[d.band_scale] as readonly string[]).includes(d.band),
    { message: "band not valid for band_scale", path: ["band"] })
  .refine(d => d.category !== "HEALTH" || d.guardrail !== "none",
    { message: "Health modules must carry a guardrail", path: ["guardrail"] })
  .refine(d => !/sapphire|gemstone|mantra|pooja|yagna|talisman|amulet|\bwear\b|\bring\b|\bdonate\b|fast on/i.test(d.proactive_step),
    { message: "proactive_step must be an action, not a remedy prescription", path: ["proactive_step"] });

export type EngineFact = z.infer<typeof EngineFactSchema>;