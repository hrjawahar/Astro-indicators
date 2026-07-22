// ─────────────────────────────────────────────────────────────────────────────
// Module: Business vs Employment  (Career & Wealth)
// Two-pole Employment↔Business score on the D1×D9 composite, with the D9 as the
// durability tie-breaker, plus a kāraka-driven business_type when biz-leaning.
// Validated against case-2 (Pisces): 10th-lord debil in D9 → employment fails;
// enterprise-Venus exalted in D9 → business holds; Venus→metals, Mercury→trade.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChartData, Graha } from "../chart-core";
import type { EngineFact } from "../schema";
import { veryStrong as strong, weakDig as weak, kendraTrikona, bandFromScore,
         confidenceFromConvergence, nextPeakWindow, businessActivation, intensityFromNet } from "../shared";

// kāraka → business domain (primary field a planet points to)
const BIZ_DOMAIN: Record<Graha, EngineFact["business_type"] extends infer T ? any : never> = {} as any;
const KARAKA: Record<Graha, string> = {
  Venus:"PRECIOUS_METALS", Mercury:"COMMODITIES_TRADE", Mars:"REAL_ESTATE",
  Jupiter:"FINANCE_ADVISORY", Sun:"LEADERSHIP_PHARMA", Moon:"FOOD_BEVERAGE",
  Saturn:"MANUFACTURING", Rahu:"IMPORT_EXPORT_TECH", Ketu:"NICHE_SPIRITUAL",
};

type Factor = EngineFact["converging_factors"][number];

export function businessVsEmployment(c: ChartData, nowISO = new Date().toISOString()): EngineFact {
  const F: Factor[] = [];
  let biz = 0, emp = 0;
  const g = c.grahas;
  const tenthLord = c.lordOf(10), seventhLord = c.lordOf(7), thirdLord = c.lordOf(3);

  // ── EMPLOYMENT pole (needs positive institutional strength) ─────────────────
  if (c.dignityD1("Saturn") === "exalted") { emp += 3;
    F.push({ chart:"D1", scope:"PLANET", detail:"Saturn (service) exalted — strong salaried-service temperament", weight:3 }); }
  else if (strong(c.dignityD1("Saturn")) && !g.Saturn.retro) { emp += 2;
    F.push({ chart:"D1", scope:"PLANET", detail:"Saturn (service) dignified and steady", weight:2 }); }
  if (kendraTrikona(g[tenthLord].house) && !weak(c.dignityD1(tenthLord))) { emp += 2;
    F.push({ chart:"D1", scope:"LORD", detail:"career-lord well-anchored in a strong house", weight:2 }); }
  for (const b of ["Jupiter","Venus","Mercury","Moon"] as Graha[]) if (g[b].house === 10) { emp += 2;
    F.push({ chart:"D1", scope:"HOUSE", detail:`${b} steadies the career house`, weight:2 }); break; }
  if ([1,10,11].includes(g.Sun.house) && !weak(c.dignityD1("Sun"))) { emp += 2;
    F.push({ chart:"D1", scope:"PLANET", detail:"Sun supports standing within a hierarchy", weight:2 }); }
  if (strong(c.dignityD9(tenthLord))) { emp += 2;
    F.push({ chart:"D9", scope:"LORD", detail:"career-lord sustains in navamsa — institutional path holds", weight:3 }); }
  else if (weak(c.dignityD9(tenthLord))) { emp -= 2;
    F.push({ chart:"D9", scope:"LORD", detail:"career-lord weak in navamsa — institutional footing less durable", weight:2 }); }

  // ── BUSINESS pole (needs positive enterprise signals) ───────────────────────
  if (g[tenthLord].house === 7) { biz += 3;
    F.push({ chart:"D1", scope:"LORD", detail:"career-lord sits in the trade house — vocation is self-directed", weight:3 }); }
  if (strong(c.dignityD1(seventhLord)) && [1,7,10,11].includes(g[seventhLord].house)) { biz += 2;
    F.push({ chart:"D1", scope:"LORD", detail:"strong business-house lord on an active angle", weight:2 }); }
  for (const k of ["Mercury","Mars","Rahu"] as Graha[]) if (c.lordOf(10) === k || c.lordOf(7) === k) { biz += 1;
    F.push({ chart:"D1", scope:"LORD", detail:`${k} (enterprise) governs the trade/vocation axis`, weight:1 }); }
  if (g.Saturn.retro && g.Saturn.house === g.Rahu.house) { biz += 2;
    F.push({ chart:"D1", scope:"PLANET", detail:"retrograde Saturn with Rahu — strong resistance to hierarchy", weight:2 }); }
  else if (g.Saturn.retro || g.Saturn.house === g.Rahu.house) { biz += 1;
    F.push({ chart:"D1", scope:"PLANET", detail:"Saturn unsettled by hierarchy (independence pull)", weight:1 }); }
  if (g.Ketu.house === 1) { biz += 1;
    F.push({ chart:"D1", scope:"LAGNA", detail:"Ketu on the ascendant (unconventional self-direction)", weight:1 }); }
  for (const el of [thirdLord, seventhLord]) if (c.dignityD9(el) === "exalted") { biz += 2;
    F.push({ chart:"D9", scope:"LORD", detail:`enterprise planet ${el} exalted in navamsa — independent capacity deepens`, weight:3 }); break; }

  // ── verdict ────────────────────────────────────────────────────────────────
  const net = biz - emp;
  const { band } = bandFromScore(net,
    [{ band:"INDEPENDENT", min:3 }, { band:"HYBRID", min:-1 }, { band:"INSTITUTIONAL", min:-Infinity }],
    /*classicalMax*/ 9, /*classicalMin*/ -9);
  const confidence = confidenceFromConvergence(Math.max(biz, emp));
  const outcome = band === "INDEPENDENT" ? "BUSINESS_FAVOURED"
                : band === "INSTITUTIONAL" ? "EMPLOYMENT_FAVOURED" : "HYBRID_PATH";
  const intensity = Math.abs(net) >= 5 ? "HIGH" : Math.abs(net) >= 3 ? "MODERATE" : "LOW";

  // ── business_type (only when biz-leaning) ──────────────────────────────────
  let business_type: EngineFact["business_type"];
  if (band !== "INSTITUTIONAL") {
    business_type = deriveBusinessType(c);
    if (business_type) {
      const st = deriveStructure(c);
      business_type.structure = st.structure;
      business_type.structure_reason = st.reason;
      business_type.scale = deriveScale(c);
    }
  }

  const fact: EngineFact = {
    module_id: "MOD-CAREER-BIZEMP",
    category: "CAREER",
    question: "Am I better suited to business or corporate employment?",
    band_scale: "WORK_MODE",
    band,
    intensity: intensity as any,
    confidence,
    converging_factors: F,
    timing_windows: (() => { const pk = band !== "INSTITUTIONAL" ? nextPeakWindow(c, businessActivation(c), nowISO, "Business-activation window") : null; return pk ? [{ label: pk.label, start_iso: pk.start_iso, end_iso: pk.end_iso }] : []; })(),
    coded_outcome: outcome,
    ...(business_type ? { business_type } : {}),
    teaser: band === "INSTITUTIONAL"
      ? "Your chart carries a 'steady builder' imprint — you compound advantage inside strong structures."
      : "Your chart carries an 'independent maverick' imprint — you thrive on autonomy, restless under control.",
    proactive_step: band === "INSTITUTIONAL"
      ? "Invest in a role with real ownership and progression inside a solid organisation."
      : business_type
        ? `Build toward your own venture — your chart leans to ${labelize(business_type.primary)}${business_type.secondary ? " and " + labelize(business_type.secondary) : ""}.`
          + (business_type.structure === "PARTNERSHIP"
              ? " Structure it WITH a partner or co-owner: your partnership house genuinely adds strength, so a shared entity suits you better than going it alone."
              : business_type.structure === "PROPRIETORSHIP"
                ? " Structure it as a proprietorship or keep control clearly yours: your chart shows partnerships diluting more than they add."
                : " Either a partnership or a sole proprietorship can work — decide on the individual person, not the structure.")
          + (business_type.scale === "LARGE"
              ? " The gains axis supports scaling well beyond a local operation."
              : business_type.scale === "REGIONAL"
                ? " Build for a regional footprint before reaching wider."
                : " Start focused and local; depth will serve you better than spread.")
        : "Build toward your own venture; keep a stable base while it takes root.",
    owner_only: false,
    guardrail: "none",
  };
  return fact;
}

// pick the business field(s) from the strongest enterprise-driving planet(s)
// ── ownership structure: 7th house (partners) vs 1st/10th (self-driven) ──────
function deriveStructure(c: ChartData): { structure: "PARTNERSHIP"|"PROPRIETORSHIP"|"EITHER"; reason: string } {
  const g = c.grahas;
  const L7 = c.lordOf(7), L1 = c.lordOf(1), L10 = c.lordOf(10);
  let partner = 0, solo = 0;
  const why: string[] = [];

  // strong, well-placed 7th lord → partners add real strength
  if (strong(c.dignityD1(L7))) { partner += 2; why.push(`the partnership-lord ${L7} is dignified`); }
  if (kendraTrikona(g[L7].house)) { partner += 1; }
  if (strong(c.dignityD9(L7))) { partner += 1; why.push("partnerships hold in the navamsa"); }
  // benefics tenanting the 7th → co-owners are supportive
  for (const b of ["Jupiter","Venus","Mercury","Moon"] as Graha[])
    if (g[b].house === 7 && !weak(c.dignityD1(b))) { partner += 2; why.push(`${b} supports the partnership house`); break; }
  // 7th-lord linked to the 10th/11th → shared venture yields
  if (g[L7].house === 10 || g[L7].house === 11 || g[L10].house === 7) { partner += 2; why.push("the partnership and vocation axes are linked"); }

  // afflicted 7th → partnerships strain; go alone
  for (const m of ["Saturn","Mars","Rahu","Ketu","Sun"] as Graha[])
    if (g[m].house === 7 && !strong(c.dignityD1(m))) { solo += 2; why.push(`${m} stresses the partnership house`); break; }
  if (weak(c.dignityD1(L7))) { solo += 2; why.push(`the partnership-lord ${L7} is weak`); }
  if (c.isDusthana(L7)) { solo += 2; why.push("the partnership-lord sits in a difficult house"); }
  // strong lagna-lord / Sun on an angle → the venture runs on the owner
  if (strong(c.dignityD1(L1)) && kendraTrikona(g[L1].house)) { solo += 2; why.push("a strong, well-placed chart-lord — the venture runs on you"); }
  if (g.Sun.house === 10 && !weak(c.dignityD1("Sun"))) { solo += 1; }
  if (g.Ketu.house === 7) { solo += 1; why.push("Ketu on the partnership axis favours independence"); }

  const net = partner - solo;
  const structure = net >= 2 ? "PARTNERSHIP" : net <= -2 ? "PROPRIETORSHIP" : "EITHER";
  const reason = why.slice(0, 3).join("; ") || "no decisive partnership signature either way";
  return { structure, reason };
}

// ── scale: 11th (gains network) + 10th strength + Rahu/Jupiter expansion ─────
function deriveScale(c: ChartData): "LOCAL" | "REGIONAL" | "LARGE" {
  const g = c.grahas; let s = 0;
  const L11 = c.lordOf(11), L10 = c.lordOf(10), L2 = c.lordOf(2);
  if (strong(c.dignityD1(L11))) s += 2; else if (weak(c.dignityD1(L11))) s -= 1;
  if (kendraTrikona(g[L11].house) || g[L11].house === 11) s += 1;
  if (strong(c.dignityD1(L10)) && kendraTrikona(g[L10].house)) s += 2;
  if (strong(c.dignityD9(L11)) || strong(c.dignityD9(L10))) s += 1;
  if ([2,10,11].includes(g.Jupiter.house) || strong(c.dignityD1("Jupiter"))) s += 1;
  if ([10,11].includes(g.Rahu.house)) s += 1;                       // Rahu expands/scales
  if (strong(c.dignityD1(L2)) || c.planetsIn(11).length >= 2) s += 1;
  return s >= 6 ? "LARGE" : s >= 3 ? "REGIONAL" : "LOCAL";
}

function deriveBusinessType(c: ChartData): EngineFact["business_type"] {
  const g = c.grahas;
  const score: { graha: Graha; s: number }[] = [];
  // trade/vocation houses (7th, 10th) define the TYPE of business; income houses (2/11) weigh less
  // classical vocation set: 10th (karma) and 7th (trade) name the FIELD;
  // 11th (gains) and 2nd (accumulation) say how strongly it pays.
  const RULE_W: Record<number, number> = { 10: 3, 7: 3, 11: 2, 2: 1 };
  const bizHouses = [7, 10, 2, 11];
  for (const graha of Object.keys(g) as Graha[]) {
    let s = 0;
    // rules a business house? (trade/vocation weighted highest)
    for (const h of [7, 10, 11, 2]) if (c.lordOf(h) === graha) s += RULE_W[h];
    // placed in one? trade/vocation placement worth more than income placement
    if ([7, 10].includes(g[graha].house)) s += 2;
    else if ([2, 11].includes(g[graha].house)) s += 1;
    // a graha that both RULES and OCCUPIES the vocation axis is the clearest pointer
    if ((c.lordOf(10) === graha && g[graha].house === 10) ||
        (c.lordOf(7)  === graha && g[graha].house === 7)) s += 2;
    // amatyakaraka-style emphasis: the 10th-lord's dispositor also colours the field
    if (c.lordOf(10) === graha && kendraTrikona(g[graha].house)) s += 1;
    // dignity D1 / D9
    if (strong(c.dignityD1(graha))) s += 1; if (c.dignityD1(graha) === "exalted") s += 1;
    if (strong(c.dignityD9(graha))) s += 1; if (c.dignityD9(graha) === "exalted") s += 2;
    // Mercury is THE trade planet → strongest karaka edge; other commerce grahas a lighter edge
    if (graha === "Mercury") s += 2;
    else if (["Venus","Mars","Rahu"].includes(graha)) s += 1;
    score.push({ graha, s });
  }
  score.sort((a,b)=> b.s - a.s);
  const p = score[0], sec = score[1];
  return {
    primary: KARAKA[p.graha] as any,
    ...(sec && sec.s >= p.s - 1 ? { secondary: KARAKA[sec.graha] as any } : {}),
    driver: { primary: p.graha, ...(sec && sec.s >= p.s - 1 ? { secondary: sec.graha } : {}) },
  };
}

function labelize(code: string): string {
  return code.toLowerCase().replace(/_/g, " ");
}
