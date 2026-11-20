import fs from "node:fs";
const ROOT="/home/claude/astro-indicators";
let src=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8");
src+="\nexport { buildDomainFacts, V_SIGNS, planetAvastha };\n";
const shim=ROOT+"/functions/api/_v6_shim.mjs"; fs.writeFileSync(shim,src);
const E=await import(shim+"?t="+Date.now());
const { buildDomainFacts, planetAvastha }=E; const S=E.V_SIGNS; const lon=(sg,d)=>S.indexOf(sg)*30+d;
const VIM=[["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
function navSign(L){ const s=Math.floor(L/30), d=L%30, n=Math.floor(d/(10/3)); return ([0,9,6,3][s%4]+n)%12; }
function d9HousesFrom(deg){ const li=navSign(deg.__asc); const h={}; for(const p of Object.keys(deg)){ if(p==="__asc")continue; const x=((navSign(deg[p])-li+12)%12)+1; (h[x]=h[x]||[]).push(p);} return {houses:h,lagnaSign:S[li]}; }
function genDashas(moonLon,birthY){ const li=Math.floor(moonLon/(360/27))%9; const order=[]; for(let i=0;i<9;i++)order.push(VIM[(li+i)%9]);
  const out=[]; let cur=new Date(birthY+"-01-01").getTime(); const yr=365.25*864e5;
  for(const[lord,years]of order){ const s=cur,e=cur+years*yr; out.push({lord,startDate:new Date(s).toISOString().slice(0,10),endDate:new Date(e).toISOString().slice(0,10),antarDasas:[]}); cur=e; } return out; }
function run(name, lagna, ascDeg, P, gender, birthY){
  const deg={__asc:lon(lagna,ascDeg)}; for(const [p,[sg,d]] of Object.entries(P)) deg[p]=lon(sg,d);
  const d9=d9HousesFrom(deg); const dashas=genDashas(deg.Moon,birthY);
  const seven=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]; const srt=seven.map(p=>[p,(deg[p]%30)]).sort((a,b)=>a[1]-b[1]);
  const dk=srt[0][0]; // lowest degree = Darakaraka
  const ck={karakas:[{role:"Darakaraka",planet:dk},{role:"Atmakaraka",planet:srt[6][0]}]};
  const f=buildDomainFacts("marriage",deg,lagna,d9.houses,d9.lagnaSign,ck,dashas,birthY+"-07-01",lon(lagna,ascDeg),{Saturn:P.Saturn&&false},gender,"");
  console.log("\n######## "+name+" ("+lagna+" lagna, "+gender+") ########");
  console.log("  computed D9 lagna = "+d9.lagnaSign+"   (D9 7th house occupants = "+(d9.houses[7]||[]).join(",")+")");
  const ma=f.flags.marriageAfflictionDetail;
  console.log("  AFFLICTION: severity="+ma.severity+" score="+ma.score+" afflicted="+ma.afflicted);
  ma.factors.forEach(x=>console.log("     ⚠ "+x));
  if(ma.clearChecks.length) console.log("     ✓ clear: "+ma.clearChecks.join(" | "));
  console.log("  minorMarriageMode="+!!f.flags.minorMarriageMode+"  partnerProfile="+(f.flags.partnerProfile?"PRESENT":"null")+"  manglik="+(f.flags.manglik?"present":"null"));
  if(f.flags.guardianNote){ console.log("  GUARDIAN redFlag="+f.flags.guardianNote.redFlag+" severity="+f.flags.guardianNote.severity); }
  const dc=f.domainCompass; if(dc&&dc.badhaka) console.log("  BADHAKA surfaced: "+dc.badhaka.planet+" (house "+dc.badhaka.house+")");
  // avastha of Venus
  const ven=f.d1&&f.d1.placements&&f.d1.placements.Venus; if(ven){ const av=planetAvastha(ven.sign,ven.degInSign); console.log("  Venus avastha: "+(av?av.state+" ("+Math.round(av.strength*100)+"%)":"n/a")+" @ "+ven.degInSign+"° "+ven.sign); }
}
// Native 1 — Shreya — Scorpio, minor (born 2013)
run("Native1 Shreya (MINOR, b.2013)","Scorpio",25.3,{Sun:["Taurus",20],Moon:["Aries",5],Mars:["Taurus",9],Mercury:["Gemini",13],Jupiter:["Gemini",1],Venus:["Gemini",8],Saturn:["Libra",12],Rahu:["Libra",21],Ketu:["Aries",21]},"female","2013");
// Native 2 — RGM — Pisces (born 1990)
run("Native2 RGM (b.1990)","Pisces",2.8,{Sun:["Pisces",13],Moon:["Pisces",29.9],Mars:["Capricorn",19],Mercury:["Pisces",22],Jupiter:["Gemini",9],Venus:["Aquarius",27],Saturn:["Capricorn",1],Rahu:["Capricorn",20],Ketu:["Cancer",20]},"female","1990");
// Native 3 — GreenP — Cancer (born 1986)
run("Native3 GreenP (b.1986)","Cancer",21.7,{Sun:["Sagittarius",22],Moon:["Libra",29],Mars:["Libra",20],Mercury:["Sagittarius",7],Jupiter:["Capricorn",26],Venus:["Sagittarius",19],Saturn:["Scorpio",15],Rahu:["Aries",12],Ketu:["Libra",12]},"male","1986");
// Native 4 — VB — Aquarius (born 1983)
run("Native4 VB (b.1983)","Aquarius",9.2,{Sun:["Virgo",8],Moon:["Aries",15],Mars:["Leo",4],Mercury:["Leo",23],Jupiter:["Scorpio",12],Venus:["Leo",1],Saturn:["Libra",10],Rahu:["Taurus",26],Ketu:["Scorpio",26]},"male","1983");
fs.unlinkSync(shim);
