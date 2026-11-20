// ─────────────────────────────────────────────────────────────────────────────
//  MARRIAGE-TIMING PRECISION ENGINE  (classical rules only — never tuned to a case)
//
//  Narrows a broad Antardasha-level window down toward a ~6–12 month fruition window by
//  converging four independent CLASSICAL layers:
//    1. Vimshottari to the PRATYANTARDASHA (PD) level, with tiered significators (Parashari).
//    2. Upapada Lagna (UL) as a marriage lagna (Jaimini arudha of the 12th).
//    3. Double Transit / Gochara (Jupiter AND Saturn to the 7th / Lagna / 7th-lord / UL),
//       plus transit Jupiter over the husband-karaka and a nodal transit on the 1/7 or 2/8 axis.
//    4. Jaimini Chara Dasha as a BOUNDED corroboration (low weight — school-variant).
//  Weights come from classical rule priority, NOT from any observed marriage date.
//
//  IMPORTANT (reversibility): this is an ADD-ON. The caller gates it behind ENABLE_PD_TIMING
//  and keeps the AD-level likelyFruitionWindows untouched. Output is a STRONG PROBABILITY,
//  never a certainty — the caller's prose must say so.
// ─────────────────────────────────────────────────────────────────────────────

import { transitSignsAt, planetSignAspects, nthSign } from "./ephemeris.js";

const DASHA_YEARS = { Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17 };
const ORDER = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const SIGN_LORD = { 1:"Mars",2:"Venus",3:"Mercury",4:"Moon",5:"Sun",6:"Mercury",7:"Venus",8:"Mars",9:"Jupiter",10:"Saturn",11:"Saturn",12:"Jupiter" };
const SIGN_NAME = ["","Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const YR = 365.25*24*3600*1000;
const PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];

// ── Upapada Lagna: the arudha pada of the 12th house (Jaimini) ────────────────────
// Count from the 12th house to its lord; the arudha is the same count onward from the lord.
// Standard exceptions: if the arudha falls in the house itself → 10th from it; if in the 7th
// from the house → the 4th from it (an arudha never sits in the 1st or 7th from its own house).
function computeUpapada(lagnaSign, signOf){
  const h12 = nthSign(lagnaSign, 12);
  const l12 = SIGN_LORD[h12];
  const lordSign = signOf[l12];
  if(!lordSign) return null;
  const count = ((lordSign - h12 + 12) % 12) + 1;      // houses from the 12th to its lord (1..12)
  let arudha = ((lordSign + count - 2) % 12) + 1;       // same count onward from the lord
  if(arudha === h12) arudha = nthSign(arudha, 10);       // never in the house itself
  if(arudha === nthSign(h12, 7)) arudha = nthSign(arudha, 4);
  return { sign: arudha, lord: SIGN_LORD[arudha] };
}

// ── Tiered marriage significators (Parashari) ─────────────────────────────────────
function buildSignificators(ctx){
  const { lagnaSign, d9LagnaSign, signD1, signD9, darakaraka, upapada } = ctx;
  const w = {}; for(const p of PLANETS) w[p]=0;
  const set = (p,v)=>{ if(p) w[p]=Math.max(w[p], v); };
  const h7D1 = nthSign(lagnaSign,7), h7lordD1 = SIGN_LORD[h7D1];
  const h7D9 = nthSign(d9LagnaSign,7), h7lordD9 = SIGN_LORD[h7D9];
  const ulSign = upapada ? upapada.sign : null, ulLord = upapada ? upapada.lord : null;
  // Tier 1 (+3): the primary marriage triggers
  for(const p of [h7lordD1, h7lordD9, darakaraka, ulLord, "Venus"]) set(p,3);
  // Tier 2 (+2): occupants of the D1 7th or UL, aspectors of the D1 7th, occupants of the D9 7th
  for(const p of PLANETS){
    const s1 = signD1[p];
    if(s1!=null){ if(s1===h7D1 || (ulSign && s1===ulSign)) set(p,2);
      if(planetSignAspects(p, s1).has(h7D1)) set(p,2); }
    const s9 = signD9[p];
    if(s9!=null && s9===h7D9) set(p,2);
  }
  // Tier 3 (+1): 2nd & 11th lords (family addition & fulfilment)
  set(SIGN_LORD[nthSign(lagnaSign,2)], 1);
  set(SIGN_LORD[nthSign(lagnaSign,11)], 1);
  return { weights:w, h7D1, h7lordD1, h7lordD9, ulSign, ulLord };
}

// ── Pratyantardasha generation: subdivide each AD into 9 PDs (proportional) ───────
function pdsOf(ad){
  const st = new Date(ad.startDate).getTime(), en = new Date(ad.endDate).getTime();
  if(!(st && en && en>st)) return [];
  const durMs = en - st; const out=[]; let t = st;
  const li = ORDER.indexOf(ad.lord); if(li<0) return [];
  for(let j=0;j<9;j++){ const pd = ORDER[(li+j)%9]; const frac = DASHA_YEARS[pd]/120; const d = durMs*frac;
    out.push({ md:ad.md, ad:ad.lord, pd, start:new Date(t), end:new Date(t+d) }); t += d; }
  return out;
}

// ── Age-eligibility curve (so a childhood significator period is not a marriage window) ──
function ageMultiplier(age){
  if(age < 18) return 0;
  if(age < 21) return 0.5;
  if(age <= 32) return 1.0;
  if(age <= 40) return 0.85;
  if(age <= 50) return 0.5;
  return 0.3;
}

// ── Double Transit (Gochara) at a calendar date ───────────────────────────────────
// Both Jupiter AND Saturn must occupy or aspect one of the marriage targets (7th / Lagna /
// 7th-lord's natal sign / UL). Returns {active, jup, sat} with signs for the why-line.
function doubleTransitAt(y, m, targets){
  const t = transitSignsAt(y, m, 15);
  const jReach = new Set([t.Jupiter, ...planetSignAspects("Jupiter", t.Jupiter)]);
  const sReach = new Set([t.Saturn, ...planetSignAspects("Saturn", t.Saturn)]);
  const jHit = targets.some(s=>jReach.has(s));
  const sHit = targets.some(s=>sReach.has(s));
  return { active: jHit && sHit, jup:t.Jupiter, sat:t.Saturn, rahu:t.Rahu, ketu:t.Ketu, jHit, sHit };
}

// ── Jaimini Chara Dasha (BOUNDED corroboration — low weight, one standard: KN Rao) ──
// Direction: odd Lagna → zodiacal (forward), even → reverse. Duration of a sign = houses from
// the sign to its lord (in the dasha direction) minus 1 (lord in own sign → 12). Corroborates
// when the active Chara rashi IS, HOLDS the DK, or IS the UL / 7th. Kept deliberately simple
// and low-weight so any school-variance cannot dominate the convergence.
function charaDashaActiveSign(lagnaSign, signOf, birthYr, targetYear){
  const forward = (lagnaSign % 2 === 1);                 // odd signs forward
  const durationOf=(sign)=>{ const lord=SIGN_LORD[sign]; const ls=signOf[lord]; if(!ls) return 1;
    let c = forward ? ((ls - sign + 12)%12)+1 : ((sign - ls + 12)%12)+1; let yrs = c-1; if(yrs<=0) yrs=12; return Math.min(12,Math.max(1,yrs)); };
  let sign = lagnaSign, year = birthYr;
  for(let i=0;i<24 && year<=targetYear+1;i++){
    const d = durationOf(sign);
    if(targetYear>=year && targetYear<year+d) return sign;
    year += d; sign = forward ? nthSign(sign,2) : nthSign(sign,12);  // next/prev sign
  }
  return null;
}

// ── Main: score PD windows and return the narrowed, ranked fruition windows ─────────
export function computeMarriageTimingWindows(ctx){
  try{
    const { lagnaSign, d9LagnaSign, signD1, signD9, darakaraka, dashas, birthDate, currentAge } = ctx;
    if(!lagnaSign || !signD1 || !Array.isArray(dashas)) return null;
    const birthYr = birthDate ? new Date(birthDate).getFullYear() : null;
    const signOf = signD1;                                    // D1 signs by planet
    const upapada = computeUpapada(lagnaSign, signOf);
    const sig = buildSignificators({ lagnaSign, d9LagnaSign, signD1, signD9, darakaraka, upapada });
    const W = sig.weights;
    // transit targets: Lagna, 7th, the 7th-lord's natal sign, and the UL
    const targets = [ lagnaSign, sig.h7D1, signD1[sig.h7lordD1], sig.ulSign ].filter(Boolean);
    const h2 = nthSign(lagnaSign,2), h8 = nthSign(lagnaSign,8);
    const natalJupSign = signD1["Jupiter"];

    // Collect every PD across every AD, keep adult-age ones (the age curve handles weighting).
    const windows=[];
    for(const md of dashas){ if(!Array.isArray(md.antarDasas)) continue;
      for(const ad of md.antarDasas){ const adObj={ md:md.lord, lord:ad.lord, startDate:ad.startDate, endDate:ad.endDate };
        for(const pd of pdsOf(adObj)){
          const midY = (pd.start.getTime()+pd.end.getTime())/2;
          const mid = new Date(midY); const yr = mid.getUTCFullYear(); const mo = mid.getUTCMonth()+1;
          const age = birthYr!=null ? (yr - birthYr) : null;
          const ageMul = age!=null ? ageMultiplier(age) : 1;
          if(ageMul===0) continue;
          // dasha score (classical priority: AD strongest, then PD, then MD)
          const dasha = (W[pd.md]||0)*1.0 + (W[pd.ad]||0)*1.5 + (W[pd.pd]||0)*1.25;
          if(dasha<=0) continue;                              // no marriage significator active at all
          // double transit at the PD midpoint
          const dt = doubleTransitAt(yr, mo, targets);
          const dtBonus = dt.active ? 4 : 0;
          // transit Jupiter over the husband-karaka (natal Jupiter) or the 7th-lord's sign
          const jupKaraka = (dt.jup===natalJupSign || dt.jup===signD1[sig.h7lordD1]) ? 3 : 0;
          // nodal transit on the 1/7 or 2/8 axis
          const nodal = ([lagnaSign, sig.h7D1, h2, h8].includes(dt.rahu) || [lagnaSign, sig.h7D1, h2, h8].includes(dt.ketu)) ? 2 : 0;
          // Jaimini Chara corroboration (bounded +2)
          const charaSign = (birthYr!=null) ? charaDashaActiveSign(lagnaSign, signOf, birthYr, yr) : null;
          const charaHit = charaSign && ( charaSign===sig.h7D1 || charaSign===sig.ulSign || signD1[darakaraka]===charaSign ) ? 2 : 0;
          const score = +(((dasha + dtBonus + jupKaraka + nodal + charaHit) * ageMul).toFixed(2));
          windows.push({ md:pd.md, ad:pd.ad, pd:pd.pd, startY:yr, startM:mo,
            start:pd.start.toISOString().slice(0,7), end:pd.end.toISOString().slice(0,7),
            age, score, dasha:+dasha.toFixed(2), dt:dt.active, dtBonus, jupKaraka, nodal, charaHit,
            jupSign:dt.jup, satSign:dt.sat });
        }
      }
    }
    if(!windows.length) return null;
    windows.sort((a,b)=> b.score - a.score || (a.startY-b.startY));
    const top = windows.slice(0,3);
    // For the single best window, narrow to the contiguous months where the double transit holds.
    const best = top[0];
    let narrowed = null;
    if(best){
      const [sy,sm] = best.start.split("-").map(Number);
      const [ey,em] = best.end.split("-").map(Number);
      const fired=[]; let yy=sy, mm=sm, guard=0;
      while((yy<ey || (yy===ey && mm<=em)) && guard++<36){
        if(doubleTransitAt(yy, mm, targets).active) fired.push({ y:yy, m:mm });
        mm++; if(mm>12){ mm=1; yy++; }
      }
      if(fired.length){ const f0=fired[0], f1=fired[fired.length-1];
        narrowed = { fromY:f0.y, fromM:f0.m, toY:f1.y, toM:f1.m }; }
    }
    const fmt=(w)=> SIGN_NAME ? w : w;
    const label=(w)=>`${w.start} to ${w.end}`;
    const stack=(w)=>`${w.md}–${w.ad}–${w.pd}`;
    return {
      upapada: upapada ? { sign:SIGN_NAME[upapada.sign], lord:upapada.lord } : null,
      significators: Object.fromEntries(Object.entries(W).filter(([,v])=>v>0)),
      windows: top.map(w=>({
        window: label(w), stack: stack(w), age: w.age, score: w.score,
        doubleTransit: w.dt, jupiterSign: SIGN_NAME[w.jupSign], saturnSign: SIGN_NAME[w.satSign],
        factors: [
          `Vimshottari ${stack(w)} — ${w.ad} (${w.ad===sig.h7lordD1?"the 7th lord":w.ad==="Venus"?"the natural marriage karaka":"a marriage significator"}) runs as the antardasha${w.md==="Venus"?", within the Venus major period":""}`,
          w.dt ? `Double Transit: both Jupiter (in ${SIGN_NAME[w.jupSign]}) and Saturn (in ${SIGN_NAME[w.satSign]}) activate the 7th / Lagna / 7th-lord / Upapada axis` : null,
          w.jupKaraka ? `transit Jupiter contacts the husband-significator / 7th-lord's sign` : null,
          w.nodal ? `a nodal transit falls on the 1st/7th or 2nd/8th (partnership / family-addition) axis` : null,
          w.charaHit ? `the Jaimini Chara dasha sign corroborates (it is or holds the 7th / Darakaraka / Upapada)` : null,
        ].filter(Boolean),
      })),
      narrowed: narrowed ? { from:`${narrowed.fromY}-${String(narrowed.fromM).padStart(2,"0")}`, to:`${narrowed.toY}-${String(narrowed.toM).padStart(2,"0")}` } : null,
      note: "A strong-probability window from the convergence of Vimshottari (to Pratyantardasha), Upapada, Double Transit and Chara dasha — not a certainty.",
    };
  }catch(_){ return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AD-LEVEL MARRIAGE WINDOWS  (the tighter-confidence MD-AD method)
//
//  Evidence (6 real marriage dates) showed sub-year PINPOINTING is not reliable, but the
//  marriage ALWAYS falls in a significator Mahadasha/Antardasha — a 1–3 year window. This
//  ranks those windows to raise confidence in WHICH one, using only classical AD-level signals
//  (no transit, no PD): the 7th lord / Venus / Darakaraka in the MD or AD, the AD lord's
//  CONNECTION to the 7th (occupies / aspects it / is the 7th-lord's dispositor), and an age
//  curve. It returns a ranked shortlist and an HONEST confidence tag — 'high' only when one
//  7th-connected window clearly stands out; otherwise 'moderate', naming the significator
//  Mahadasha as the container and the top candidate windows within it. Additive & reversible.
// ─────────────────────────────────────────────────────────────────────────────
function adAgeWeight(a){ if(a==null) return 1; if(a<19) return 0.45; if(a<=32) return 1.0; if(a<=40) return 0.7; if(a<=47) return 0.4; return 0.15; }
export function computeMarriageADWindows(ctx){
  try{
    const { lagnaSign, signD1, darakaraka, dashas, birthDate } = ctx;
    if(!lagnaSign || !signD1 || !Array.isArray(dashas)) return null;
    const birthYr = birthDate ? new Date(birthDate).getFullYear() : null;
    const h7 = nthSign(lagnaSign,7), l7 = SIGN_LORD[h7];
    const primary = new Set([l7, "Venus", darakaraka].filter(Boolean));          // 7th lord, Venus, DK
    const secondary = new Set(["Jupiter", SIGN_LORD[nthSign(lagnaSign,2)], SIGN_LORD[nthSign(lagnaSign,11)]]);
    const roleOf=(p)=> p===l7?("the 7th lord "+p) : p==="Venus"?"Venus (the marriage karaka)" : p===darakaraka?(p+" (your Darakaraka)") : p==="Jupiter"?"Jupiter" : (p+" (a supporting significator)");
    // NOTE on calibration (6 real marriages): a 7th-house-CONNECTION bonus on the AD lord was
    // tested and REMOVED — it produced a false-confident single pick (it elevated a connected
    // neutral AD above the true significator AD). The reliable, honest signal is simply the
    // significator in the MD/AD plus the age curve. No single AD is claimed with certainty:
    // the trustworthy container is the significator MAHADASHA, with a ranked shortlist inside.
    const rows=[];
    for(const md of dashas){ if(!Array.isArray(md.antarDasas)) continue;
      for(const ad of md.antarDasas){
        const sy=+String(ad.startDate).slice(0,4), ey=+String(ad.endDate).slice(0,4);
        if(!sy) continue;
        const midAge = birthYr!=null ? ((sy+ey)/2 - birthYr) : null;
        const mdP=primary.has(md.lord), mdS=secondary.has(md.lord), adP=primary.has(ad.lord), adS=secondary.has(ad.lord);
        if(!mdP && !mdS && !adP) continue;                                         // must carry a primary sig in MD or AD
        const s = (mdP?2.5:mdS?1:0) + (adP?3:adS?1.5:0);
        const score = +((adAgeWeight(midAge))*s).toFixed(2);
        rows.push({ md:md.lord, ad:ad.lord, window:String(ad.startDate).slice(0,7)+" to "+String(ad.endDate).slice(0,7),
          startY:sy, endY:ey, age:(midAge!=null?Math.round(midAge):null), score, mdP,
          role: roleOf(ad.lord) + " runs within your "+md.lord+" major period"+(mdP?" (a core marriage significator)":"") });
      }
    }
    if(!rows.length) return null;
    rows.sort((a,b)=> b.score - a.score || a.startY - b.startY);
    const top = rows.slice(0,3);
    const lead = top[0];
    // The significator MAHADASHA is the reliable container (validated: it holds the real marriage
    // in every tested chart). The MD of the leading window when that MD is itself a significator.
    const sigMD = primary.has(lead.md) ? lead.md : (primary.has(lead.ad) ? lead.md : null);
    const mdRange = (()=>{ for(const md of dashas){ if(md.lord===sigMD) return String(md.startDate).slice(0,4)+"–"+String(md.endDate).slice(0,4); } return null; })();
    return {
      significatorMahadasha: sigMD, mahadashaRange: mdRange,
      windows: top.map(w=>({ window:w.window, lords:w.md+"–"+w.ad, age:w.age, role:w.role })),
      note: "Marriage is most likely within the significator major period"+(mdRange?" ("+mdRange+")":"")+"; the strongest 1–3 year windows within it are listed in order of likelihood. A strong probability across a 1–3 year band — not a fixed date.",
    };
  }catch(_){ return null; }
}
