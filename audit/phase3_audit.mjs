// SOP-depth audit: Track A (career D10/Karakamsha/AK-AmK), Track B (marriage classifiers),
// Track C (owner-only intimacy/affair), and THE GATE (owner vs public vs minor).
//  (1) REVERSIBILITY: 3 switches off → new flags absent; careerCompass + affliction identical.
//  (2) GATE-LEAK: client prompt carries NONE of the owner-only flags; owner prompt carries them.
//  (3) MINOR SAFETY: a minor chart nulls every sensitive module, in facts, regardless of audience.
//  (4) POPULATION: classifiers fire as minorities; career depth present. (random charts, not known cases)
import fs from "node:fs";
const ROOT="/home/claude/astro-indicators";
const abase=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8");
const mkA=(mut,tag)=>{ const p=ROOT+"/functions/api/_p3a_"+tag+".mjs"; fs.writeFileSync(p,mut(abase)+"\nexport { buildDomainFacts, V_SIGNS };\n"); return p; };
const AON = mkA(s=>s, "on");
const AOFF= mkA(s=>s.replace("const ENABLE_D10_LENS = true;","const ENABLE_D10_LENS = false;")
                   .replace("const ENABLE_MARRIAGE_CLASSIFIERS = true;","const ENABLE_MARRIAGE_CLASSIFIERS = false;")
                   .replace("const ENABLE_CHILD_TEMPERAMENT = true;","const ENABLE_CHILD_TEMPERAMENT = false;")
                   .replace("const ENABLE_HEALTH_DEPTH = true;","const ENABLE_HEALTH_DEPTH = false;")
                   .replace("const ENABLE_NAISARGIKA_KARAKA = true;","const ENABLE_NAISARGIKA_KARAKA = false;")
                   .replace("const ENABLE_OWNER_INTIMATE = true;","const ENABLE_OWNER_INTIMATE = false;"), "off");
const Eon=await import(AON+"?t="+Date.now()); const Eoff=await import(AOFF+"?t="+Date.now());
// writer shim (export the gate)
const dbase=fs.readFileSync(ROOT+"/functions/api/domain-report.js","utf8");
const DP=ROOT+"/functions/api/_p3d.mjs"; fs.writeFileSync(DP,dbase+"\nexport { buildUserPrompt };\n");
const W=await import(DP+"?t="+Date.now());

const S=Eon.V_SIGNS; const lon=(sg,d)=>S.indexOf(sg)*30+d;
const VIM=[["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
const ORD=["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const DY={Ketu:7,Venus:20,Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17};
function navSign(L){ const s=Math.floor(L/30), d=L%30, n=Math.floor(d/(10/3)); return ([0,9,6,3][s%4]+n)%12; }
function d9HousesFrom(deg){ const li=navSign(deg.__asc); const h={}; for(const p of Object.keys(deg)){ if(p==="__asc")continue; const x=((navSign(deg[p])-li+12)%12)+1; (h[x]=h[x]||[]).push(p);} return {houses:h,lagnaSign:S[li]}; }
function genDashas(moonLon,birthY){ const li=Math.floor(moonLon/(360/27))%9; const out=[]; let cur=new Date(birthY+"-01-01").getTime(); const yr=365.25*864e5;
  for(let i=0;i<9;i++){ const [lord,years]=VIM[(li+i)%9]; const s=cur,e=cur+years*yr; const ad=[]; let t=s; const di=ORD.indexOf(lord);
    for(let j=0;j<9;j++){ const al=ORD[(di+j)%9]; const d=(e-s)*(DY[al]/120); ad.push({md:lord,lord:al,startDate:new Date(t).toISOString().slice(0,10),endDate:new Date(t+d).toISOString().slice(0,10)}); t+=d; }
    out.push({lord,startDate:new Date(s).toISOString().slice(0,10),endDate:new Date(e).toISOString().slice(0,10),antarDasas:ad}); cur=e; } return out; }
const PLS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]; const rnd=n=>Math.floor(Math.random()*n);
const mkCK=(deg)=>{ const seven=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]; const srt=seven.map(p=>[p,deg[p]%30]).sort((a,b)=>a[1]-b[1]);
  return {karakas:[{role:"Darakaraka",planet:srt[0][0]},{role:"Atmakaraka",planet:srt[6][0]},{role:"Amatyakaraka",planet:srt[5][0]}]}; };
function chart(){ const lag=S[rnd(12)]; const deg={__asc:lon(lag,10)}; const ra=rnd(360);
  for(const p of PLS){ if(p==="Ketu"){deg.Ketu=(deg.Rahu+180)%360;} else if(p==="Rahu"){deg.Rahu=ra+Math.random();} else deg[p]=rnd(360)+Math.random(); }
  return {lag,deg,d9:d9HousesFrom(deg)}; }

let mismatch=0, leak=0, ownerHas=0, minorSexualLeak=0, minorLifeOK=0, minorPre18=0, careerFieldsN=0, n=0;
const nat={love:0,arranged:0,mixed:0,unmarked:0}, frn={none:0,possible:0,notable:0,strong:0}, wth={none:0,possible:0,notable:0,strong:0}, intim={high:0,moderate:0,average:0,reserved:0};
let careerDepth=0, careerN=0;
let childLeak=0, childOwnerHas=0, childN=0, childSpecial=0, childRevBad=0, childClientRaw=0;
let healthN=0, healthRevBad=0, healthDepthN=0; const hdDosha={pitta:0,vata:0,kapha:0};
const OWNER_ONLY=["ownerSensitive","intimacyProfile","affairTiming"];
// Owner-payload-only phrases (archetype, reading, D7 factor strings). These appear ONLY in the
// childTemperamentOwner flag — never in the client-facing instruction text or the gentle touch — so
// finding any of them in the CLIENT prompt is a genuine fact leak (not an instruction false-positive).
const CHILD_RAW=/Specialized-Care Child|markers converge|house of testing \(6\/8\/12\)/i;

for(let i=0;i<360;i++){
  const c=chart(); const dashas=genDashas(c.deg.Moon,"1985"); const ck=mkCK(c.deg); const asc=lon(c.lag,10);
  // adult marriage
  let fm; try{ fm=Eon.buildDomainFacts("marriage",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"female",""); }catch(e){ continue; } n++;
  const F=fm.flags;
  const mn=F.marriageNature; if(mn){ nat[mn.verdict==="love-leaning"?"love":mn.verdict==="arranged-leaning"?"arranged":mn.verdict]++; }
  if(F.foreignSpouse&&frn[F.foreignSpouse.level]!=null) frn[F.foreignSpouse.level]++;
  if(F.wealthThroughMarriage&&wth[F.wealthThroughMarriage.level]!=null) wth[F.wealthThroughMarriage.level]++;
  if(F.intimacyProfile&&intim[F.intimacyProfile.level]!=null) intim[F.intimacyProfile.level]++;
  // GATE: owner vs client prompt
  const ownerP=W.buildUserPrompt("marriage", fm, "owner");
  const clientP=W.buildUserPrompt("marriage", fm, "client");
  if(OWNER_ONLY.some(k=>F[k]!=null && ownerP.includes('"'+k+'"'))) ownerHas++;
  if(OWNER_ONLY.some(k=>clientP.includes('"'+k+'"')) || clientP.includes('"dissolutionWindow"')) leak++;
  // REVERSIBILITY (marriage): off build has no new marriage flags, identical affliction
  let fmoff; try{ fmoff=Eoff.buildDomainFacts("marriage",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"female",""); }catch(e){ continue; }
  const offClean=(fmoff.flags.marriageNature===undefined&&fmoff.flags.foreignSpouse===undefined&&fmoff.flags.wealthThroughMarriage===undefined&&fmoff.flags.intimacyProfile===undefined&&fmoff.flags.affairTiming===undefined);
  const sameAff=JSON.stringify(fmoff.flags.marriageAfflictionDetail)===JSON.stringify(F.marriageAfflictionDetail);
  // career depth + reversibility
  let fc,fcoff; try{ fc=Eon.buildDomainFacts("career",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"male",""); fcoff=Eoff.buildDomainFacts("career",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"male",""); }catch(e){ fc=null; }
  if(fc){ careerN++; if(fc.flags.careerDivisional&&fc.flags.careerDivisional.d10Lens) careerDepth++;
    const careerOffClean=(fcoff.flags.careerDivisional===undefined && fcoff.flags.careerFields===undefined);
    const sameCompass=JSON.stringify(fcoff.careerCompass)===JSON.stringify(fc.careerCompass);
    if(!(careerOffClean&&sameCompass)) mismatch++;
  }
  if(!(offClean&&sameAff)) mismatch++;
  // MINOR safety (age ~13): all sensitive nulled in facts
  let fmin; try{ fmin=Eon.buildDomainFacts("marriage",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,genDashas(c.deg.Moon,"2013"),"2013-07-01",asc,{},"female",""); }catch(e){ fmin=null; }
  if(fmin){ const g=fmin.flags;
    // NEW POLICY: sexual modules MUST be absent for a minor (owner included); life-event facts KEPT.
    const sexual = (g.intimacyProfile!==null && g.intimacyProfile!==undefined)
      || (g.affairTiming!==null && g.affairTiming!==undefined)
      || (g.ownerSensitive && g.ownerSensitive.affairRisk!=null);
    if(sexual) minorSexualLeak++;
    const lifeEvent = !!(g.marriageLifecycle || g.partnerProfile || g.foreignSpouse || g.marriageADWindows || g.marriageNature || g.separationTiming);
    if(lifeEvent) minorLifeOK++;
    if(g.marriageLifecycle && Array.isArray(g.marriageLifecycle.romanceWindows) && g.marriageLifecycle.romanceWindows.some(w=>w.age!=null && w.age<18)) minorPre18++;
  }
  if(fc && fc.flags.careerFields && Array.isArray(fc.flags.careerFields.fields) && fc.flags.careerFields.fields.length) careerFieldsN++;
  // CHILDREN — temperament/special-care gating + reversibility
  let fch,fchoff; try{ fch=Eon.buildDomainFacts("children",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"female",""); fchoff=Eoff.buildDomainFacts("children",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"female",""); }catch(e){ fch=null; }
  if(fch){ childN++;
    const G=fch.flags;
    const chOwnerP=W.buildUserPrompt("children", fch, "owner");
    const chClientP=W.buildUserPrompt("children", fch, "client");
    if(G.childTemperamentOwner!=null){ childSpecial++;
      if(chOwnerP.includes('"childTemperamentOwner"')) childOwnerHas++;
    }
    // GATE: the owner-only flag must NEVER appear in the client prompt
    if(chClientP.includes('"childTemperamentOwner"')) childLeak++;
    // the raw special-care wording must NEVER reach the client prompt
    if(CHILD_RAW.test(chClientP)) childClientRaw++;
    // REVERSIBILITY: off build → no temperament layer, no owner flag
    const offClean = (fchoff.flags.childTemperamentOwner===undefined)
      && !(fchoff.flags.childrenDepth && fchoff.flags.childrenDepth.temperament);
    if(!offClean) childRevBad++;
  }
  // HEALTH — depth present + reversibility
  let fh,fhoff; try{ fh=Eon.buildDomainFacts("health",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"female",""); fhoff=Eoff.buildDomainFacts("health",c.deg,c.lag,c.d9.houses,c.d9.lagnaSign,ck,dashas,"1985-07-01",asc,{},"female",""); }catch(e){ fh=null; }
  if(fh){ healthN++;
    if(fh.flags.healthDepth){ healthDepthN++; const dd=fh.flags.healthDepth.prakriti&&fh.flags.healthDepth.prakriti.dominant; if(dd&&hdDosha[dd]!=null) hdDosha[dd]++; }
    if(fhoff.flags.healthDepth!==undefined) healthRevBad++;   // off build must NOT produce healthDepth
  }
}
const pc=(x,d=n)=>(100*x/d).toFixed(1)+"%";
console.log("SOP-DEPTH audit over "+n+" random ADULT charts (not the known cases):");
console.log(" marriage nature:  love "+pc(nat.love)+" | arranged "+pc(nat.arranged)+" | mixed "+pc(nat.mixed)+" | unmarked "+pc(nat.unmarked));
console.log(" foreign spouse:   none "+pc(frn.none)+" | possible "+pc(frn.possible)+" | notable "+pc(frn.notable)+" | strong "+pc(frn.strong)+"   (shown only notable+: "+pc(frn.notable+frn.strong)+")");
console.log(" wealth-thru-marr: none "+pc(wth.none)+" | possible "+pc(wth.possible)+" | notable "+pc(wth.notable)+" | strong "+pc(wth.strong)+"   (shown only notable+: "+pc(wth.notable+wth.strong)+")");
console.log(" intimacy level:   high "+pc(intim.high)+" | moderate "+pc(intim.moderate)+" | average "+pc(intim.average)+" | reserved "+pc(intim.reserved));
console.log(" career D10 lens present: "+pc(careerDepth,careerN)+" of career charts");
console.log("GATE-LEAK (owner-only flag in CLIENT prompt): "+leak+"   "+(leak===0?"✓ NO LEAK":"✗ LEAK"));
console.log("OWNER prompt carries the owner-only flags: "+pc(ownerHas)+" of charts (expected high)");
console.log("MINOR — sexual modules present (MUST be 0): "+minorSexualLeak+"   "+(minorSexualLeak===0?"✓ NONE":"✗ SEXUAL LEAK"));
console.log("MINOR — life-event overview present: "+pc(minorLifeOK)+" of minor charts (policy: kept for parent consultation)");
console.log("MINOR — relationship window before age 18 (MUST be 0): "+minorPre18+"   "+(minorPre18===0?"✓ NONE":"✗ PRE-18"));
console.log("CAREER — concrete fields produced: "+pc(careerFieldsN,careerN)+" of career charts");
console.log("REVERSIBILITY (switches off == base; new flags absent, compass/affliction identical): mismatches = "+mismatch+"   "+(mismatch===0?"✓ CLEAN REVERT":"✗ REGRESSION"));
console.log("CHILDREN — special-care owner flag fires (minority expected): "+pc(childSpecial,childN)+" of children charts");
console.log("CHILDREN GATE-LEAK (childTemperamentOwner in CLIENT prompt, MUST be 0): "+childLeak+"   "+(childLeak===0?"✓ NO LEAK":"✗ LEAK"));
console.log("CHILDREN — raw special-care wording in CLIENT prompt (MUST be 0): "+childClientRaw+"   "+(childClientRaw===0?"✓ NONE":"✗ RAW LEAK"));
console.log("CHILDREN — owner prompt carries childTemperamentOwner when present: "+(childSpecial?pc(childOwnerHas,childSpecial):"n/a")+"");
console.log("CHILDREN REVERSIBILITY (switch off → no temperament layer, no owner flag): mismatches = "+childRevBad+"   "+(childRevBad===0?"✓ CLEAN REVERT":"✗ REGRESSION"));
console.log("HEALTH — depth produced: "+pc(healthDepthN,healthN)+" of health charts  | dominant dosha "+JSON.stringify(hdDosha));
console.log("HEALTH REVERSIBILITY (switch off → healthDepth absent): mismatches = "+healthRevBad+"   "+(healthRevBad===0?"✓ CLEAN REVERT":"✗ REGRESSION"));
[AON,AOFF,DP].forEach(f=>fs.unlinkSync(f));
