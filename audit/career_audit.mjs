// Career-domain gap audit harness (regression gate). Instruments analyze.js via a temp copy
// (engine file stays untouched), runs buildDomainFacts over a panel + the two real anchors,
// and applies programmatic probes per gap-class. Emits a gap register.
import fs from "node:fs"; import path from "node:path";
const ROOT="/home/claude/astro-indicators";
let src=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8");
src+="\nexport { buildDomainFacts, d1PlacementsFromDegrees, houseLord, V_SIGNS, V_LORD };\n";
const shim=ROOT+"/functions/api/_audit_shim.mjs"; fs.writeFileSync(shim,src);
const E=await import(shim+"?t="+Date.now());
const { buildDomainFacts }=E;
const S=E.V_SIGNS;
const lon=(sg,d)=>S.indexOf(sg)*30+d;

// ---- navamsha (element-start rule) + Vimshottari dasha generator (panel inputs) ----
const VIM=[["Ketu",7],["Venus",20],["Sun",6],["Moon",10],["Mars",7],["Rahu",18],["Jupiter",16],["Saturn",19],["Mercury",17]];
function navSign(L){ const s=Math.floor(L/30), d=L%30, n=Math.floor(d/(10/3)); const start=[0,9,6,3][s%4]; return (start+n)%12; }
function d9HousesFrom(deg){ // compute D9 sign per planet, d9 lagna from asc, then houses
  const d9lagIdx=navSign(deg.__asc); const houses={};
  for(const p of Object.keys(deg)){ if(p==="__asc") continue; const ns=navSign(deg[p]); const h=((ns-d9lagIdx+12)%12)+1; (houses[h]=houses[h]||[]).push(p); }
  return { houses, lagnaSign:S[d9lagIdx] };
}
function genDashas(moonLon, birthY){ const nak=Math.floor(moonLon/(360/27)); const li=nak%9;
  const order=[]; for(let i=0;i<9;i++) order.push(VIM[(li+i)%9]);
  const out=[]; let cur=new Date(birthY+"-01-01").getTime(); const yr=365.25*24*3600*1000;
  for(const [lord,years] of order){ const start=cur, end=cur+years*yr; const ADs=[]; let ac=start;
    for(let j=0;j<9;j++){ const [al,ay]=VIM[(VIM.findIndex(v=>v[0]===lord)+j)%9]; const adur=years*ay/120*yr; ADs.push({lord:al,startDate:new Date(ac).toISOString().slice(0,10),endDate:new Date(ac+adur).toISOString().slice(0,10)}); ac+=adur; }
    out.push({lord,startDate:new Date(start).toISOString().slice(0,10),endDate:new Date(end).toISOString().slice(0,10),antarDasas:ADs}); cur=end; }
  return out;
}
function chart(lagna, deg, retro, birthY="1980"){ deg.__asc=lon(lagna,10); const d9=d9HousesFrom(deg); const dashas=genDashas(deg.Moon, birthY);
  // amatyakaraka ~ 2nd highest degInSign
  const seven=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]; const sorted=seven.map(p=>[p,deg[p]%30]).sort((a,b)=>b[1]-a[1]);
  const ck={karakas:[{role:"Atmakaraka",planet:sorted[0][0]},{role:"Amatyakaraka",planet:sorted[1][0]}]};
  return buildDomainFacts("career", deg, lagna, d9.houses, d9.lagnaSign, ck, dashas, birthY+"-01-01", deg.__asc, retro, "male", "");
}

// ---- probes ----
const strings=(o,acc=[])=>{ if(o==null)return acc; if(typeof o==="string"){acc.push(o);return acc;} if(Array.isArray(o)){for(const x of o)strings(x,acc);return acc;} if(typeof o==="object"){for(const k of Object.keys(o))strings(o[k],acc);return acc;} return acc; };
const DEBUG_LEAK=/\b(entry:|undefined|\[object|NaN|convergences|lordPlacement|mdStress|tradeScore|businessLean|careerCompass|houseStates|null)\b/;
const CAMEL=/\b[a-z]+[A-Z][A-Za-z]*\b/;
function probe(label, facts, reg){
  const strs=strings(facts);
  // P1 debug/camel leaks (exclude allowed tokens)
  for(const s of strs){ if(DEBUG_LEAK.test(s)) reg.leaks.push(label+": "+s.slice(0,90));
    const m=s.match(CAMEL); if(m && !/^(D1|D9|D10|B2B)$/.test(m[0])) reg.camel.push(label+": '"+m[0]+"' in: "+s.slice(0,70)); }
  // P2 lord named: any "Nth lord / house lord / career ruler" string must name a planet
  const PLAN=/(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)/;
  for(const s2 of strs){ if(/(\b\d(st|nd|rd|th)[- ]?lord|house lord|career ruler|ruler of)/i.test(s2) && !PLAN.test(s2)) reg.lordUnnamed.push(label+": "+s2.slice(0,80)); }
  // P3 convergence consistency: "BOTH ... sits in the Nth house" must hold for the SAME planet (hLord) in d1 AND varga
  const conv=facts.convergences||[]; const hLord=facts.d1&&facts.d1.houseLord; const vp=facts.vargaChart&&facts.vargaChart.placements;
  for(const c of conv){ if(!/the same signal repeated independently/.test(c)) continue; const m=c.match(/sits in the (\d+)(st|nd|rd|th) house/); if(m && hLord && vp){ const claimed=+m[1];
    const d1h=facts.d1.placements[hLord]&&facts.d1.placements[hLord].house; const vh=vp[hLord]&&vp[hLord].house;
    if(!(d1h===claimed && vh===claimed)) reg.convBad.push(label+": claims "+claimed+" but "+hLord+" is d1="+d1h+" varga="+vh); } }
  // P4 raja yoga presence (does any fact mention a raja/dharma-karmadhipati yoga?)
  if(strs.some(s=>/raja yoga|dharma-?karma|yogakaraka conjunct|9th.*10th lord/i.test(s))) reg.rajaYogaSeen++;
  // P5 working-abroad: exalted planet in 12th but foreign suppressed
  const d1=facts.d1&&facts.d1.placements; if(d1){ const exIn12=Object.values(d1).some(pl=>pl&&pl.house===12&&pl.dignity==="Exalted");
    const fg=facts.careerCompass&&facts.careerCompass.foreign&&facts.careerCompass.foreign.grade;
    if(exIn12 && (!fg||fg==="none")) reg.abroadMiss.push(label); }
}
const reg={leaks:[],camel:[],lordUnnamed:[],convBad:[],rajaYogaSeen:0,abroadMiss:[],n:0};

// anchors
const durai={Sun:lon("Scorpio",4),Moon:lon("Pisces",5),Mars:lon("Cancer",15),Mercury:lon("Scorpio",22),Jupiter:lon("Gemini",12),Venus:lon("Libra",19),Saturn:lon("Leo",7),Rahu:lon("Virgo",19),Ketu:lon("Pisces",19)};
const jk={Sun:lon("Aries",10),Moon:lon("Capricorn",24),Mars:lon("Capricorn",5),Mercury:lon("Pisces",9),Jupiter:lon("Cancer",15),Venus:lon("Pisces",27),Saturn:lon("Leo",15),Rahu:lon("Leo",20),Ketu:lon("Aquarius",20)};
reg.n++; probe("ANCHOR-Durai(Pisces)", chart("Pisces",{...durai},{Jupiter:true},"1977"), reg);
reg.n++; probe("ANCHOR-JK(Leo)", chart("Leo",{...jk},{Saturn:true},"1979"), reg);
// panel: 12 lagnas x 20 random charts
const PLS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]; const rnd=n=>Math.floor(Math.random()*n);
for(const lag of S){ for(let i=0;i<20;i++){ const deg={}; for(const p of PLS) deg[p]=rnd(360)+Math.random();
  const retro={}; for(const p of ["Mars","Mercury","Jupiter","Venus","Saturn"]) retro[p]=Math.random()<0.2;
  reg.n++; try{ probe(lag+"#"+i, chart(lag,deg,retro), reg); }catch(e){ reg.leaks.push(lag+"#"+i+" CRASH: "+e.message); } } }

console.log("=== CAREER GAP AUDIT ===  charts audited: "+reg.n);
console.log("\n[Class 1] Debug/field leaks: "+reg.leaks.length); reg.leaks.slice(0,8).forEach(x=>console.log("  "+x));
console.log("\n[Class 1] camelCase leaks: "+reg.camel.length); [...new Set(reg.camel.map(x=>x.split("'")[1]))].slice(0,15).forEach(x=>console.log("  token: "+x));
console.log("\n[Class 1] 'lord' refs not naming a planet: "+reg.lordUnnamed.length); [...new Set(reg.lordUnnamed.map(x=>x.split(': ')[1]))].slice(0,8).forEach(x=>console.log("  "+x));
console.log("\n[Class 1] convergence claims inconsistent w/ same-planet varga placement: "+reg.convBad.length); reg.convBad.slice(0,6).forEach(x=>console.log("  "+x));
console.log("\n[Class 2] Raja-Yoga mentions across all charts: "+reg.rajaYogaSeen+"  => "+(reg.rajaYogaSeen===0?"MISSING (no detector)":"present"));
console.log("\n[Class 6] Exalted-12th charts with foreign suppressed: "+reg.abroadMiss.length+" of "+reg.n+"  (should get Remote-Only template)");
fs.unlinkSync(shim);
