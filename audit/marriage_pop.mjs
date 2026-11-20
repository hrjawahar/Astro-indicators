import fs from "node:fs";
const ROOT="/home/claude/astro-indicators";
let src=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8"); src+="\nexport { buildDomainFacts, V_SIGNS };\n";
const shim=ROOT+"/functions/api/_mp_shim.mjs"; fs.writeFileSync(shim,src);
const E=await import(shim+"?t="+Date.now()); const { buildDomainFacts }=E; const S=E.V_SIGNS; const lon=(sg,d)=>S.indexOf(sg)*30+d;
const VIM=[["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
function navSign(L){ const s=Math.floor(L/30), d=L%30, n=Math.floor(d/(10/3)); return ([0,9,6,3][s%4]+n)%12; }
function d9HousesFrom(deg){ const li=navSign(deg.__asc); const h={}; for(const p of Object.keys(deg)){ if(p==="__asc")continue; const x=((navSign(deg[p])-li+12)%12)+1; (h[x]=h[x]||[]).push(p);} return {houses:h,lagnaSign:S[li]}; }
function genDashas(moonLon,birthY){ const li=Math.floor(moonLon/(360/27))%9; const out=[]; let cur=new Date(birthY+"-01-01").getTime(); const yr=365.25*864e5;
  for(let i=0;i<9;i++){ const [lord,years]=VIM[(li+i)%9]; const s=cur,e=cur+years*yr; out.push({lord,startDate:new Date(s).toISOString().slice(0,10),endDate:new Date(e).toISOString().slice(0,10),antarDasas:[]}); cur=e; } return out; }
const PLS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]; const rnd=n=>Math.floor(Math.random()*n);
const tally={clear:0,mild:0,moderate:0,strong:0}; let n=0;
for(const lag of S){ for(let i=0;i<120;i++){
  const deg={__asc:lon(lag,10)}; const ra=rnd(360); for(const p of PLS){ if(p==="Ketu"){deg.Ketu=(deg.Rahu+180)%360;} else if(p==="Rahu"){deg.Rahu=ra+Math.random();} else deg[p]=rnd(360)+Math.random(); }
  const d9=d9HousesFrom(deg); const dashas=genDashas(deg.Moon,"1985");
  const seven=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]; const srt=seven.map(p=>[p,deg[p]%30]).sort((a,b)=>a[1]-b[1]);
  const ck={karakas:[{role:"Darakaraka",planet:srt[0][0]}]};
  try{ const f=buildDomainFacts("marriage",deg,lag,d9.houses,d9.lagnaSign,ck,dashas,"1985-07-01",lon(lag,10),{},"female","");
    const sev=f.flags.marriageAfflictionDetail.severity; tally[sev]++; n++; }catch(e){}
}}
console.log("marriage affliction distribution over "+n+" random charts:");
for(const k of ["clear","mild","moderate","strong"]) console.log("  "+k.padEnd(9)+": "+tally[k]+"  ("+(100*tally[k]/n).toFixed(1)+"%)");
console.log("  → afflicted (mild+): "+(100*(n-tally.clear)/n).toFixed(1)+"%   clear: "+(100*tally.clear/n).toFixed(1)+"%");
fs.unlinkSync(shim);
