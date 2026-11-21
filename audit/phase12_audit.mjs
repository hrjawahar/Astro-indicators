// Phase 1 (delay gate + romance/marriage lifecycle) + Phase 2 (separation timing) audit.
//  (1) POPULATION: delay-gate tier spread, separation-applicable rate (MUST be a minority),
//      lifecycle marriage-window presence — on random charts (NOT the six known cases).
//  (2) REVERSIBILITY: with ENABLE_AGE_GATE/ENABLE_SEPARATION forced false, the new flags are
//      absent and marriageADWindows + marriageAfflictionDetail are byte-identical.
import fs from "node:fs";
const ROOT="/home/claude/astro-indicators";
const base=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8");

function shimFrom(srcMut, tag){
  let src=srcMut(base)+"\nexport { buildDomainFacts, V_SIGNS };\n";
  const p=ROOT+"/functions/api/_p12_"+tag+".mjs"; fs.writeFileSync(p,src); return p;
}
const ON = shimFrom(s=>s, "on");
const OFF= shimFrom(s=>s.replace("const ENABLE_AGE_GATE = true;","const ENABLE_AGE_GATE = false;")
                       .replace("const ENABLE_SEPARATION = true;","const ENABLE_SEPARATION = false;"), "off");
const Eon = await import(ON+"?t="+Date.now());
const Eoff= await import(OFF+"?t="+Date.now());
const S=Eon.V_SIGNS; const lon=(sg,d)=>S.indexOf(sg)*30+d;
const VIM=[["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
const ORD=["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
const DY={Ketu:7,Venus:20,Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17};
function navSign(L){ const s=Math.floor(L/30), d=L%30, n=Math.floor(d/(10/3)); return ([0,9,6,3][s%4]+n)%12; }
function d9HousesFrom(deg){ const li=navSign(deg.__asc); const h={}; for(const p of Object.keys(deg)){ if(p==="__asc")continue; const x=((navSign(deg[p])-li+12)%12)+1; (h[x]=h[x]||[]).push(p);} return {houses:h,lagnaSign:S[li]}; }
function genDashas(moonLon,birthY){ const li=Math.floor(moonLon/(360/27))%9; const out=[]; let cur=new Date(birthY+"-01-01").getTime(); const yr=365.25*864e5;
  for(let i=0;i<9;i++){ const [lord,years]=VIM[(li+i)%9]; const s=cur,e=cur+years*yr;
    // proportional antardashas so lifecycle windows are exercised
    const ad=[]; let t=s; const di=ORD.indexOf(lord);
    for(let j=0;j<9;j++){ const al=ORD[(di+j)%9]; const d=(e-s)*(DY[al]/120);
      ad.push({md:lord,lord:al,startDate:new Date(t).toISOString().slice(0,10),endDate:new Date(t+d).toISOString().slice(0,10)}); t+=d; }
    out.push({lord,startDate:new Date(s).toISOString().slice(0,10),endDate:new Date(e).toISOString().slice(0,10),antarDasas:ad}); cur=e; }
  return out; }
const PLS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]; const rnd=n=>Math.floor(Math.random()*n);

const tier={low:0,moderate:0,high:0}; const sep={none:0,possible:0,notable:0,strong:0};
let n=0, sepApplic=0, sepWindow=0, lcWin=0, lcRomance=0, mismatches=0;
const mkCK=(deg)=>{ const seven=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]; const srt=seven.map(p=>[p,deg[p]%30]).sort((a,b)=>a[1]-b[1]); return {karakas:[{role:"Darakaraka",planet:srt[0][0]}]}; };

for(const lag of S){ for(let i=0;i<60;i++){
  const deg={__asc:lon(lag,10)}; const ra=rnd(360);
  for(const p of PLS){ if(p==="Ketu"){deg.Ketu=(deg.Rahu+180)%360;} else if(p==="Rahu"){deg.Rahu=ra+Math.random();} else deg[p]=rnd(360)+Math.random(); }
  const d9=d9HousesFrom(deg); const dashas=genDashas(deg.Moon,"1985"); const ck=mkCK(deg);
  let fon;
  try{ fon=Eon.buildDomainFacts("marriage",deg,lag,d9.houses,d9.lagnaSign,ck,dashas,"1985-07-01",lon(lag,10),{},"female",""); }catch(e){ continue; }
  n++;
  const g=fon.flags.marriageDelayGate; if(g&&tier[g.tier]!=null) tier[g.tier]++;
  const sr=fon.flags.ownerSensitive&&fon.flags.ownerSensitive.separationRisk; if(sr&&sep[sr.level]!=null) sep[sr.level]++;
  const st=fon.flags.separationTiming; if(st&&st.applicable){ sepApplic++; if(st.dissolutionWindow) sepWindow++; }
  const lc=fon.flags.marriageLifecycle; if(lc&&lc.marriageWindow) lcWin++; if(lc&&lc.romanceWindows&&lc.romanceWindows.length) lcRomance++;
  // reversibility: OFF build must have none of the new flags, and identical affliction + AD windows
  let foff; try{ foff=Eoff.buildDomainFacts("marriage",deg,lag,d9.houses,d9.lagnaSign,ck,dashas,"1985-07-01",lon(lag,10),{},"female",""); }catch(e){ continue; }
  const newAbsent = (foff.flags.marriageLifecycle==null && foff.flags.marriageDelayGate==null && foff.flags.separationTiming==null);
  const sameAff = JSON.stringify(foff.flags.marriageAfflictionDetail)===JSON.stringify(fon.flags.marriageAfflictionDetail);
  const sameAD  = JSON.stringify(foff.flags.marriageADWindows)===JSON.stringify(fon.flags.marriageADWindows);
  if(!(newAbsent&&sameAff&&sameAD)) mismatches++;
}}
const pct=x=>(100*x/n).toFixed(1)+"%";
console.log("PHASE 1+2 population over "+n+" random charts (NOT the six known cases):");
console.log(" delay-gate tier:   low "+pct(tier.low)+" | moderate "+pct(tier.moderate)+" | high "+pct(tier.high));
console.log(" separation level:  none "+pct(sep.none)+" | possible "+pct(sep.possible)+" | notable "+pct(sep.notable)+" | strong "+pct(sep.strong));
console.log(" separation TIMING applicable (notable+): "+sepApplic+"  ("+pct(sepApplic)+")   with a dated window: "+sepWindow);
console.log(" lifecycle produced a marriage window: "+pct(lcWin)+" | a romance window: "+pct(lcRomance));
console.log("REVERSIBILITY (switches off == today): mismatches = "+mismatches+"  "+(mismatches===0?"✓ CLEAN REVERT":"✗ REGRESSION"));
fs.unlinkSync(ON); fs.unlinkSync(OFF);
