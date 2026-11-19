import fs from "node:fs";
const ROOT="/home/claude/astro-indicators";
let src=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8");
src+="\nexport { buildDomainFacts, V_SIGNS };\n";
const shim=ROOT+"/functions/api/_cv2_shim.mjs"; fs.writeFileSync(shim,src);
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
  const ck={karakas:[{role:"Atmakaraka",planet:srt[0][0]},{role:"Amatyakaraka",planet:srt[1][0]},{role:"Bhratrukaraka",planet:srt[2][0]},{role:"Matrukaraka",planet:srt[3][0]},{role:"Putrakaraka",planet:srt[4][0]},{role:"Gnathikaraka",planet:srt[5][0]},{role:"Darakaraka",planet:srt[6][0]}]};
  return buildDomainFacts(domain,deg,lagna,d9.houses,d9.lagnaSign,ck,dashas,birthY+"-01-01",lon(lagna,10),retro,"female",""); }
const jk={Sun:lon("Aries",10),Moon:lon("Capricorn",24),Mars:lon("Pisces",17),Mercury:lon("Pisces",9),Jupiter:lon("Cancer",15),Venus:lon("Pisces",3),Saturn:lon("Leo",15),Rahu:lon("Leo",20),Ketu:lon("Aquarius",20)};
console.log("=== ANCHOR (JK/Leo) domainCompass per non-career domain ===");
for(const dom of ["self","siblings","mother","children","health","marriage"]){
  const f=facts(dom,"Leo",{...jk},{Saturn:true},"1979"); const dc=f.domainCompass;
  if(!dc){ console.log(dom+": (null)"); continue; }
  console.log("\n--- "+dom+" (house "+dc.house+", lord "+dc.lord+", karaka "+dc.karaka+") ---");
  if(dc.houseState) console.log("  house: grade="+dc.houseState.grade+" conf="+dc.houseState.confidence);
  if(dc.lordState) console.log("  lord: "+dc.lordState.reading);
  if(dc.karakaState) console.log("  karaka: "+dc.karakaState.reading);
  if(dc.rajaYogas.length) console.log("  rajaYogas: "+dc.rajaYogas.map(r=>r.planets.join("+")).join(", "));
  if(dc.yogas.length) console.log("  yogas: "+dc.yogas.map(y=>y.name).join(", "));
  if(dc.neechaBhanga.length) console.log("  NB: "+dc.neechaBhanga.map(n=>n.planet+"/"+n.level).join(", "));
  if(dc.nakshatra.length) console.log("  nak: "+dc.nakshatra.map(n=>n.planet+" in "+n.nakshatra+" ("+n.effect+")").join(", "));
  if(dc.combustion.length) console.log("  combust: "+dc.combustion.map(c=>c.planet).join(", "));
  if(dc.retrograde.length) console.log("  retro: "+dc.retrograde.map(r=>r.planet).join(", "));
  if(dc.badhaka) console.log("  badhaka: "+dc.badhaka.planet+" ("+dc.badhaka.house+")");
}
// population over-fire check
const PLS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]; const rnd=n=>Math.floor(Math.random()*n);
const DOMAINS=["self","siblings","mother","children","health","marriage"];
const tally={}; for(const d of DOMAINS) tally[d]={n:0,ry:0,nb:0,bad:0,strongHouse:0,weakHouse:0,comb:0};
for(const lag of S){ for(let i=0;i<30;i++){ const deg={}; for(const p of PLS)deg[p]=rnd(360)+Math.random(); const retro={}; for(const p of ["Mars","Mercury","Jupiter","Venus","Saturn"])retro[p]=Math.random()<0.2;
  for(const dom of DOMAINS){ const f=facts(dom,lag,deg,retro); const dc=f.domainCompass; const t=tally[dom]; t.n++; if(!dc)continue;
    if(dc.rajaYogas.length)t.ry++; if(dc.neechaBhanga.length)t.nb++; if(dc.badhaka)t.bad++; if(dc.combustion.length)t.comb++;
    if(dc.houseState&&dc.houseState.grade==="strong")t.strongHouse++; if(dc.houseState&&(dc.houseState.grade==="weak"||dc.houseState.grade==="stressed"))t.weakHouse++; } } }
console.log("\n=== POPULATION FIRE RATES (360 charts/domain) ===");
console.log("domain    rajaYoga  NB   badhaka combust strongHouse weak/stressed");
for(const d of DOMAINS){ const t=tally[d]; const pct=x=>((100*x/t.n).toFixed(0)+"%").padStart(5);
  console.log(d.padEnd(9), pct(t.ry), pct(t.nb), pct(t.bad), pct(t.comb), pct(t.strongHouse), pct(t.weakHouse)); }
fs.unlinkSync(shim);
