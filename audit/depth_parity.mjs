import fs from "node:fs";
const ROOT="/home/claude/astro-indicators";
let src=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8");
src+="\nexport { buildDomainFacts, V_SIGNS };\n";
const shim=ROOT+"/functions/api/_dp_shim.mjs"; fs.writeFileSync(shim,src);
const E=await import(shim+"?t="+Date.now());
const { buildDomainFacts }=E; const S=E.V_SIGNS; const lon=(sg,d)=>S.indexOf(sg)*30+d;
const VIM=[["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
function navSign(L){ const s=Math.floor(L/30), d=L%30, n=Math.floor(d/(10/3)); return ([0,9,6,3][s%4]+n)%12; }
function d9HousesFrom(deg){ const li=navSign(deg.__asc); const h={}; for(const p of Object.keys(deg)){ if(p==="__asc")continue; const x=((navSign(deg[p])-li+12)%12)+1; (h[x]=h[x]||[]).push(p);} return {houses:h,lagnaSign:S[li]}; }
function genDashas(moonLon,birthY){ const li=Math.floor(moonLon/(360/27))%9; const order=[]; for(let i=0;i<9;i++)order.push(VIM[(li+i)%9]);
  const out=[]; let cur=new Date(birthY+"-01-01").getTime(); const yr=365.25*864e5;
  for(const[lord,years]of order){ const s=cur,e=cur+years*yr; const AD=[]; let a=s;
    for(let j=0;j<9;j++){ const[al,ay]=VIM[(VIM.findIndex(v=>v[0]===lord)+j)%9]; const dur=years*ay/120*yr; AD.push({lord:al,startDate:new Date(a).toISOString().slice(0,10),endDate:new Date(a+dur).toISOString().slice(0,10)}); a+=dur; }
    out.push({lord,startDate:new Date(s).toISOString().slice(0,10),endDate:new Date(e).toISOString().slice(0,10),antarDasas:AD}); cur=e; }
  return out; }
function facts(domain,lagna,deg,retro,birthY="1980"){ const d={...deg,__asc:lon(lagna,10)}; const d9=d9HousesFrom(d); const dashas=genDashas(d.Moon,birthY);
  const seven=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]; const srt=seven.map(p=>[p,deg[p]%30]).sort((a,b)=>b[1]-a[1]);
  const ck={karakas:[{role:"Atmakaraka",planet:srt[0][0]},{role:"Amatyakaraka",planet:srt[1][0]},{role:"Darakaraka",planet:srt[6][0]}]};
  return buildDomainFacts(domain,deg,lagna,d9.houses,d9.lagnaSign,ck,dashas,birthY+"-01-01",lon(lagna,10),retro,"female",""); }
const jk={Sun:lon("Aries",10),Moon:lon("Capricorn",24),Mars:lon("Pisces",17),Mercury:lon("Pisces",9),Jupiter:lon("Cancer",15),Venus:lon("Pisces",3),Saturn:lon("Leo",15),Rahu:lon("Leo",20),Ketu:lon("Aquarius",20)};
const DOMAINS=["self","career","siblings","mother","children","health","marriage"];
// depth features to probe for presence (non-empty) in each domain's facts
function has(o,path){ const parts=path.split("."); let c=o; for(const p of parts){ if(c==null)return false; c=c[p]; } return c!=null && !(Array.isArray(c)&&c.length===0); }
const FEATURES=[
  ["houseStates","houseStates"],           // multi-angle house reading
  ["compound.rajaYogas","compound.rajaYogas"],
  ["compound.neechaBhanga","compound.neechaBhanga"],
  ["compound.nakshatra","compound.nakshatra"],
  ["compound.badhaka","compound.badhaka"],
  ["compound.combustion","compound.combustion"],
  ["compound.yogas","compound.yogas"],
  ["lifeStage","flags.lifeStage"],
  ["dusthanaReadings","dusthanaReadings"],
  ["dashaTiming","dashaTiming"],
  ["futureCompass","futureCompass"],
  ["d9.placements","d9.placements"],
  ["convergences","convergences"],
  ["domainBuilder(compass)","careerCompass"],
];
for(const dom of DOMAINS){
  const f=facts(dom,"Leo",{...jk},{Saturn:true},"1979");
  const present=FEATURES.filter(([_,p])=>has(f,p)).map(([n])=>n);
  const topKeys=Object.keys(f).sort();
  console.log("=== "+dom+" ===");
  console.log("  present: "+present.join(", "));
  console.log("  topKeys: "+topKeys.join(", "));
}
fs.unlinkSync(shim);
