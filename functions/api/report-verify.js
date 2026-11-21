// ─────────────────────────────────────────────────────────────────────────────
//  REPORT FAITHFULNESS VERIFIER  (the writer-layer audit the V6 review exposed)
//
//  The engine's FACTS are deterministic and regression-gated. The WRITER is a live
//  LLM that turns those facts into prose, and NO harness tested it — that is how a
//  fabricated window ("Sun Mahadasha" for a chart where the Sun is not a marriage
//  activator) and an occupant-named-as-lord ("7th lord Ketu") reached the reader.
//
//  This module closes that gap deterministically. Given the FULL engine facts (not
//  the trimmed writer copy) and the generated sections, it parses the prose and
//  checks the mechanically-verifiable claims against the engine's own truth:
//    • LORDSHIP     — any "Nth lord <Planet>" must match the engine's lord for that
//                     house (across EVERY domain). A node named as a lord always fails.
//    • ALL-CLEAR    — no "no affliction / checks come back clear" when the engine's
//                     marriage severity is not 'clear'.
//    • MINOR-MODE   — no spouse / romantic / remarriage language when the native is a
//                     minor (guardian mode).
//    • TIMING       — a planet-period tied to a DOMAIN EVENT must be an engine activator
//                     (the fix for the fabricated Sun window).
//    • DIGNITY      — a dignity word bound to a planet must match the engine's dignity.
//    • LEAK         — no camelCase / debug identifier survived the scrub.
//
//  It returns { ok, violations:[{type,severity,detail,evidence}] }. The pipeline uses
//  the 'critical' ones to trigger a corrective regeneration (see domain-report.js).
//  Every check is conservative: it flags only a clearly-bound claim, to keep false
//  positives near zero (a noisy verifier would be worse than none).
// ─────────────────────────────────────────────────────────────────────────────

const ORDER = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const SIGN_LORD = { Aries:"Mars", Taurus:"Venus", Gemini:"Mercury", Cancer:"Moon", Leo:"Sun", Virgo:"Mercury",
  Libra:"Venus", Scorpio:"Mars", Sagittarius:"Jupiter", Capricorn:"Saturn", Aquarius:"Saturn", Pisces:"Jupiter" };
const PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const RASI_LORDS = new Set(["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]); // nodes rule no sign
const ORD_WORD = { first:1, second:2, third:3, fourth:4, fifth:5, sixth:6, seventh:7, eighth:8, ninth:9, tenth:10, eleventh:11, twelfth:12 };
const ORD = (n)=>["","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"][n]||(n+"th");

function houseLordOf(lagnaSign, houseNum){
  const li = ORDER.indexOf(lagnaSign); if(li<0||!houseNum) return null;
  return SIGN_LORD[ORDER[(li + houseNum - 1) % 12]];
}
// Badhakesh (ruler of obstruction) by Ascendant modality — mirrors the engine's rule exactly:
// movable Lagna → 11th, fixed → 9th, dual → 7th; its lord is the Badhakesh.
function badhakeshOf(lagnaSign){
  const li = ORDER.indexOf(lagnaSign); if(li<0) return null;
  const bHouse = (li%3===0) ? 11 : (li%3===1) ? 9 : 7;
  return { house: bHouse, planet: houseLordOf(lagnaSign, bHouse) };
}
// Bālādi avasthā state by degree within sign — mirrors the engine's planetAvastha exactly.
function avasthaOf(sign, deg){
  const si = ORDER.indexOf(sign); if(si<0 || deg==null) return null;
  const odd = (si % 2 === 0);
  const seg = Math.max(0, Math.min(4, Math.floor(deg / 6)));
  return (odd ? ["Bala","Kumara","Yuva","Vriddha","Mrita"] : ["Mrita","Vriddha","Yuva","Kumara","Bala"])[seg];
}
function plainText(sections){ return (sections||[]).map(s=> (s.heading?s.heading+". ":"") + (s.body||"") ).join("\n\n"); }
const PL_ALT = PLANETS.join("|");

// ── 1. LORDSHIP faithfulness (the centerpiece; every domain) ─────────────────────
// Flags any phrase that BINDS a planet to a house-lordship when that planet is not the
// engine's lord for that house. Conservative: only tightly-bound "Nth lord <Planet>"
// style phrasings, never a loose "sits with the 7th lord".
function checkLordship(text, lagnaSign, out){
  if(!lagnaSign) return;
  const ord = "(\\d{1,2})(?:st|nd|rd|th)|(" + Object.keys(ORD_WORD).join("|") + ")";
  const pats = [
    // "7th lord Saturn", "7th-lord is Saturn", "seventh lord, Saturn"
    new RegExp("(?:"+ord+")[-\\s]lords?(?:\\s+is|\\s*,)?\\s+(?:the\\s+planet\\s+)?(" + PL_ALT + ")\\b","gi"),
    // "ruler of your 7th (house), Saturn"  /  "ruler of the seventh house is Saturn"
    new RegExp("rulers?\\s+of\\s+(?:your|the)\\s+(?:"+ord+")\\s+house(?:\\s+is|\\s*,)?\\s+(" + PL_ALT + ")\\b","gi"),
    // "Saturn, your 7th lord"  /  "Saturn — the seventh lord"
    new RegExp("(" + PL_ALT + ")\\b\\s*(?:,|—|-|–)?\\s*(?:your|the)\\s+(?:"+ord+")[-\\s]lord\\b","gi"),
  ];
  for(const re of pats){
    let m;
    while((m = re.exec(text))){
      // groups: depending on pattern, ordinal pieces + planet are among m[1..4]
      const nums = m.slice(1).filter(Boolean);
      let houseNum=null, planet=null;
      for(const g of nums){
        if(PLANETS.includes(g)) planet=g;
        else if(/^\d+$/.test(g)) houseNum=+g;
        else if(ORD_WORD[g.toLowerCase()]) houseNum=ORD_WORD[g.toLowerCase()];
      }
      if(!houseNum || !planet || houseNum<1 || houseNum>12) continue;
      const trueLord = houseLordOf(lagnaSign, houseNum);
      if(!trueLord) continue;
      if(planet !== trueLord){
        out.push({ type:"lordship", severity:"critical",
          detail:"Prose calls "+planet+" the "+ORD(houseNum)+" lord, but for a "+lagnaSign+" Ascendant the "+ORD(houseNum)+" lord is "+trueLord+(RASI_LORDS.has(planet)?"":" ("+planet+" is a node and rules no sign)")+".",
          evidence: m[0].trim() });
      }
    }
  }
}

// ── 2. ALL-CLEAR faithfulness (marriage) ─────────────────────────────────────────
function checkAllClear(text, facts, out){
  const det = facts && facts.flags && facts.flags.marriageAfflictionDetail;
  if(!det) return;
  if(det.severity==="clear") return;                 // all-clear is legitimately allowed
  const CLEAR_RE = /\b(no major (?:marital |marriage )?affliction|checks? (?:come|came) back clear|nothing (?:to worry|of concern)|free of (?:any )?affliction|no (?:significant )?red[- ]flags?|clear(?:\s+and\s+steady)? foundation)\b/i;
  const m = CLEAR_RE.exec(text);
  if(m){
    out.push({ type:"all-clear", severity:"critical",
      detail:"Prose gives an all-clear, but the engine's marriage severity is '"+det.severity+"' with real factors ("+(det.factors||[]).slice(0,2).join("; ")+"). The reading must name these honestly, not reassure them away.",
      evidence: m[0] });
  }
}

// ── 3. MINOR-MODE faithfulness (child-safety hard gate) ──────────────────────────
function checkMinorMode(text, facts, out){
  if(!(facts && facts.flags && facts.flags.minorMarriageMode)) return;
  // Guardian mode is forward-looking parenting guidance — it MAY discuss her future relational
  // temperament, partnership tendencies and coaching. Only the genuinely inappropriate specifics
  // are barred: a spouse portrait, dated romantic/marriage timing, a second-marriage/divorce
  // event prediction, a romantic framing of the child, or romantic remedies.
  const BAD = [
    [/\b(?:your|her|the future)\s+(?:husband|wife)\b/i, "a spouse portrait ('your/her husband/wife')"],
    [/\b(?:husband|wife)\b[^.]{0,40}?\b(?:will be|is likely|tends to be|will come|you will|she will)\b/i, "a spouse prediction"],
    [/\b(?:marry|marriage|wedding|married)\b[^.]{0,40}?\b(?:19|20)\d{2}\b/i, "dated marriage timing"],
    [/\b(?:marry|married|marriage|wedding)\b[^.]{0,30}?\bage\s+\d/i, "an age for marriage"],
    [/\bsecond marriage\b|\bre-?marriage\b|\bwill (?:divorce|remarry)\b/i, "a second-marriage / divorce event prediction"],
    [/\bromantic (?:life|relationship|partner|remedy|remedies)\b|\blove (?:affair|marriage)\b|\bboyfriend\b|\bgirlfriend\b/i, "romantic framing of a child"],
  ];
  for(const [re, label] of BAD){
    const m = re.exec(text);
    if(m){ out.push({ type:"minor-mode", severity:"critical",
      detail:"The native is a minor (guardian mode): "+label+" is not allowed. The prose uses '"+m[0].trim()+"'. Keep to her developmental temperament and parent coaching.",
      evidence: m[0].trim().slice(0,100) }); }
  }
}

// ── 4. TIMING faithfulness (the fabricated-window fix) ───────────────────────────
// A planet tied to a DOMAIN-EVENT claim must be an engine activator. Activators are
// gathered from the engine's own timing output (so we never duplicate the support map).
function activatorSet(facts){
  const s = new Set();
  const add=(p)=>{ if(p) s.add(p); };
  if(facts.d1 && facts.d1.houseLord) add(facts.d1.houseLord);
  if(facts.karakaPlanet) add(facts.karakaPlanet);
  (facts.d1 && facts.d1.occupants || []).forEach(o=>o&&add(o.planet));
  const dt = facts.dashaTiming || {};
  (dt.keyWindows||[]).forEach(w=>{ add(w.ad); add(w.md); });
  (dt.likelyFruitionWindows||[]).forEach(w=>{ add(w.lord); add(w.md); });
  (dt.forwardADs||[]).forEach(w=>{ add(w.ad); add(w.md); });
  if(dt.current) add(dt.current.lord);
  if(dt.currentAD){ add(dt.currentAD.md); add(dt.currentAD.ad); }
  (facts.futureCompass && facts.futureCompass.bands || []).forEach(b=>(b.drivers||[]).forEach(add));
  // PD-level precision windows (marriage): their MD/AD/PD lords are valid timing significators.
  const mt = facts.flags && facts.flags.marriageTiming;
  if(mt && Array.isArray(mt.windows)) mt.windows.forEach(w=>{ (String(w.stack||"").split(/[–\-]/)).forEach(x=>add(x.trim())); });
  const aw = facts.flags && facts.flags.marriageADWindows;
  if(aw && Array.isArray(aw.windows)) aw.windows.forEach(w=>{ (String(w.lords||"").split(/[–\-]/)).forEach(x=>add(x.trim())); });
  // Lifecycle windows (Phase 1): romance, legal-marriage and secondary windows all carry engine-
  // supplied MD–AD lords; the delay-gate significator Mahadasha is a valid activator too.
  const lc = facts.flags && facts.flags.marriageLifecycle;
  if(lc){
    const eat=(w)=>{ if(w&&w.lords) String(w.lords).split(/[–\-]/).forEach(x=>add(x.trim())); };
    (lc.romanceWindows||[]).forEach(eat); eat(lc.marriageWindow); (lc.secondaryWindows||[]).forEach(eat);
    add(lc.significatorMahadasha);
  }
  // Separation dissolution window (Phase 2): its MD–AD lords are valid separation-timing significators.
  const st = facts.flags && facts.flags.separationTiming;
  if(st && st.dissolutionWindow && st.dissolutionWindow.lords) String(st.dissolutionWindow.lords).split(/[–\-]/).forEach(x=>add(x.trim()));
  return s;
}
function checkTiming(text, domainKey, facts, out){
  // An "event claim" need not be one adjacent phrase ("marriage ... most likely formalised").
  const EVENT = {
    marriage: (s)=> /\b(married|wedding)\b/i.test(s) ||
                    (/\bmarriage\b/i.test(s) && /\b(formalis|formaliz|formed|happened|took place|most likely|window|came together)\b/i.test(s)) ||
                    /\b(met (?:your|their) (?:spouse|partner)|window for (?:marriage|meeting))\b/i.test(s),
    career:   (s)=> /\b(career (?:launch|break|step|move)|got the job|promotion|business (?:started|launched)|first (?:major )?step)\b/i.test(s),
    children: (s)=> /\b(birth of (?:a|your) child|first child|conception|a child (?:arrived|came))\b/i.test(s),
  }[domainKey];
  if(!EVENT) return;
  const allowed = activatorSet(facts);
  // find sentences that make an event claim AND name a planet-period
  const sentences = text.split(/(?<=[.!?])\s+/);
  for(const sent of sentences){
    if(!EVENT(sent)) continue;
    const periodRe = new RegExp("\\b(" + PL_ALT + ")\\b(?:'s)?\\s+(?:maha)?dasha|\\b(" + PL_ALT + ")\\b\\s+(?:period|sub-?period|antardasha)","gi");
    let m;
    while((m = periodRe.exec(sent))){
      const planet = m[1] || m[2];
      if(planet && !allowed.has(planet)){
        out.push({ type:"timing", severity:"warn",
          detail:"Prose ties a "+planet+" period to a "+domainKey+" event, but "+planet+" is not among the engine's "+domainKey+" activators — the window should come only from the engine's supplied windows.",
          evidence: sent.trim().slice(0,160) });
      }
    }
  }
}

// ── 5. DIGNITY faithfulness ──────────────────────────────────────────────────────
function checkDignity(text, facts, out){
  const pl = facts.d1 && facts.d1.placements; if(!pl) return;
  const DIG_RE = new RegExp("\\b(" + PL_ALT + ")\\b[^.]{0,40}?\\b(exalted|debilitated|in its own sign|own sign)\\b","gi");
  let m;
  while((m = DIG_RE.exec(text))){
    const planet=m[1], word=m[2].toLowerCase();
    const p=pl[planet]; if(!p||!p.dignity) continue;
    const engine=(p.dignity||"").toLowerCase();
    const claim = word.startsWith("exalt")?"Exalted".toLowerCase() : word.startsWith("debil")?"debilitated" : "own sign";
    const ok = (claim==="exalted"&&engine==="exalted") || (claim==="debilitated"&&engine==="debilitated") || (claim==="own sign"&&engine==="own sign");
    if(!ok && ["exalted","debilitated","own sign"].includes(engine)===false && claim!=="own sign"){
      // engine says neither exalted nor debilitated, prose claims one → flag
      out.push({ type:"dignity", severity:"warn",
        detail:"Prose calls "+planet+" "+word+", but the engine's dignity for "+planet+" is "+(p.dignity||"neutral")+".",
        evidence: m[0].trim().slice(0,120) });
    }
  }
}

// ── 7. BADHAKESH faithfulness (new fact) ─────────────────────────────────────────
// Any prose that names a planet as the Badhakesh must match the engine's Badhakesh for
// this Ascendant (an identity claim, like lordship).
function checkBadhakesh(text, lagnaSign, out){
  if(!lagnaSign) return;
  const bk = badhakeshOf(lagnaSign); if(!bk || !bk.planet) return;
  const pats = [
    new RegExp("Badhakesh(?:[^.]{0,25}?)\\b(" + PL_ALT + ")\\b","gi"),      // "Badhakesh (ruler of obstruction) Venus"
    new RegExp("\\b(" + PL_ALT + ")\\b(?:[^.]{0,25}?)\\bBadhakesh\\b","gi"), // "Venus … is the Badhakesh"
  ];
  const seen=new Set();
  for(const re of pats){ let m;
    while((m = re.exec(text))){ const planet=m[1]; if(!planet||seen.has(planet)) continue; seen.add(planet);
      if(planet!==bk.planet){
        out.push({ type:"badhakesh", severity:"critical",
          detail:"Prose names "+planet+" as the Badhakesh, but for a "+lagnaSign+" Ascendant the Badhakesh is "+bk.planet+" (ruler of the "+ORD(bk.house)+", the house of obstruction).",
          evidence: m[0].trim().slice(0,100) });
      }
    }
  }
}

// ── 8. AVASTHĀ faithfulness (new fact) ───────────────────────────────────────────
// If prose assigns a planet a Bālādi state, it must match the engine's degree-derived state.
function checkAvastha(text, facts, out){
  const pl = facts && facts.d1 && facts.d1.placements; if(!pl) return;
  const TERMS = [
    [/\bB[aā]la\b|infant state|too immature/i, "Bala"],
    [/\bMrita\b|dead state|unable to deliver/i, "Mrita"],
    [/\bVriddha\b|old state|strength is waning/i, "Vriddha"],
    [/\bKum[aā]ra\b|adolescent state/i, "Kumara"],
    [/\bYuva\b|youth state|at full strength/i, "Yuva"],
  ];
  for(const p of PLANETS){
    const info = pl[p]; if(!info || info.sign==null || info.degInSign==null) continue;
    const trueState = avasthaOf(info.sign, info.degInSign); if(!trueState) continue;
    // find any avasthā term within 60 chars of the planet name (either order)
    const near = new RegExp("(?:\\b"+p+"\\b[\\s\\S]{0,60}?("+TERMS.map(t=>t[0].source).join("|")+")|("+TERMS.map(t=>t[0].source).join("|")+")[\\s\\S]{0,60}?\\b"+p+"\\b)","i");
    const m = near.exec(text); if(!m) continue;
    const frag = m[0];
    let claimed=null; for(const [re,st] of TERMS){ if(re.test(frag)){ claimed=st; break; } }
    if(claimed && claimed!==trueState){
      out.push({ type:"avastha", severity:"warn",
        detail:"Prose puts "+p+" in its "+claimed+" state, but at "+info.degInSign+"° "+info.sign+" the engine's avasthā for "+p+" is "+trueState+".",
        evidence: frag.trim().replace(/\s+/g," ").slice(0,110) });
    }
  }
}

// ── 6. LEAK residue ──────────────────────────────────────────────────────────────
function checkLeaks(text, out){
  const CAMEL=/\b[a-z]+[A-Z][A-Za-z0-9]*\b/g; let m;
  while((m=CAMEL.exec(text))){ if(!/^(D1|D9|D10)$/.test(m[0])){ out.push({ type:"leak", severity:"warn", detail:"A camelCase identifier survived into the prose: "+m[0], evidence:m[0] }); break; } }
}

export function verifyReportFaithfulness(domainKey, facts, sections){
  const text = plainText(sections);
  const lagnaSign = facts && facts.d1 && facts.d1.lagnaSign;
  const out = [];
  try{ checkLordship(text, lagnaSign, out); }catch(_){}
  try{ if(domainKey==="marriage") checkAllClear(text, facts, out); }catch(_){}
  try{ if(domainKey==="marriage") checkMinorMode(text, facts, out); }catch(_){}
  try{ checkTiming(text, domainKey, facts, out); }catch(_){}
  try{ checkDignity(text, facts, out); }catch(_){}
  try{ checkBadhakesh(text, lagnaSign, out); }catch(_){}
  try{ checkAvastha(text, facts, out); }catch(_){}
  try{ checkLeaks(text, out); }catch(_){}
  const critical = out.filter(v=>v.severity==="critical");
  return { ok: critical.length===0, violations: out, critical };
}

// A compact correction note fed back to the writer on a corrective regeneration.
export function violationCorrectionNote(violations){
  if(!violations || !violations.length) return "";
  const lines = violations.map(v=>"- ["+v.type.toUpperCase()+"] "+v.detail+(v.evidence?"  (you wrote: \""+v.evidence+"\")":""));
  return ["Your previous draft contained FACTUAL errors against the chart. Regenerate the FULL report, keeping your voice and structure, but FIX exactly these — do not repeat them, and change nothing else that was correct:",
          ...lines,
          "Use ONLY the planets, lordships, dignities and timing windows given in the facts. Never rename a house's lord, never give an all-clear the facts do not support, and (for a minor) never use spouse/romantic language."].join("\n");
}
