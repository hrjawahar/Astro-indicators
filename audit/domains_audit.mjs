// Multi-domain gap audit (Phase 2). Runs buildDomainFacts for ALL seven domains over the panel
// + the three real anchors, applying the domain-agnostic correctness probes per domain, and
// emits a per-domain register. Instruments analyze.js via a temp copy (engine untouched).
import fs from "node:fs";
const ROOT="/home/claude/astro-indicators";
let src=fs.readFileSync(ROOT+"/functions/api/analyze.js","utf8");
src+="\nexport { buildDomainFacts, d1PlacementsFromDegrees, V_SIGNS };\n";
const shim=ROOT+"/functions/api/_domaudit_shim.mjs"; fs.writeFileSync(shim,src);
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

const strings=(o,a=[])=>{ if(o==null)return a; if(typeof o==="string"){a.push(o);return a;} if(Array.isArray(o)){for(const x of o)strings(x,a);return a;} if(typeof o==="object"){for(const k of Object.keys(o))strings(o[k],a);return a;} return a; };
const DEBUG_LEAK=/\b(entry:|undefined|\[object|NaN|convergences|lordPlacement|mdStress|tradeScore|businessLean|careerCompass|houseStates|per facts|remoteOnly)\b/;
const CAMEL=/\b[a-z]+[A-Z][A-Za-z]*\b/;
const PLAN=/(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)/;
const DOMAINS=["self","career","siblings","mother","children","health","marriage","wealth"];
const reg={}; for(const d of DOMAINS) reg[d]={leaks:0,camel:0,lordUnnamed:0,convBad:0,crash:0,n:0,ex:[]};
function probe(d,label,f){ const r=reg[d]; r.n++; const strs=strings(f);
  for(const s of strs){ if(DEBUG_LEAK.test(s)){ r.leaks++; if(r.ex.length<4)r.ex.push("LEAK "+label+": "+s.slice(0,70)); }
    const m=s.match(CAMEL); if(m&&!/^(D1|D9|D10|D3|D4|D7|B2B)$/.test(m[0])){ r.camel++; if(r.ex.length<4)r.ex.push("CAMEL '"+m[0]+"' "+label); } }
  // lord-naming correctness: any rendered string that references an "Nth lord"/"house lord"/
  // "career ruler"/"ruler of" MUST name the ruling planet. \d+ catches 10th/11th/12th too.
  for(const s of strs){ if(/(\b\d+(st|nd|rd|th)[- ]?lord|house lord|career ruler|ruler of)/i.test(s)&&!PLAN.test(s)){ r.lordUnnamed++; if(r.ex.length<4)r.ex.push("LORD "+label+": "+s.slice(0,70)); } }
  const conv=f.convergences||[]; const hL=f.d1&&f.d1.houseLord; const vp=f.vargaChart&&f.vargaChart.placements;
  for(const c of conv){ if(!/the same signal repeated independently/.test(c))continue; const m=c.match(/sits in the (\d+)(st|nd|rd|th) house/); if(m&&hL&&vp){ const cl=+m[1]; const d1h=f.d1.placements[hL]&&f.d1.placements[hL].house; const vh=vp[hL]&&vp[hL].house; if(!(d1h===cl&&vh===cl))r.convBad++; } }
}
const anchors=[
  ["Pisces",{Sun:lon("Scorpio",4),Moon:lon("Pisces",5),Mars:lon("Cancer",15),Mercury:lon("Scorpio",22),Jupiter:lon("Gemini",12),Venus:lon("Libra",19),Saturn:lon("Leo",7),Rahu:lon("Virgo",19),Ketu:lon("Pisces",19)},{Jupiter:true},"1977"],
  ["Leo",{Sun:lon("Aries",10),Moon:lon("Capricorn",24),Mars:lon("Pisces",17),Mercury:lon("Pisces",9),Jupiter:lon("Cancer",15),Venus:lon("Pisces",3),Saturn:lon("Leo",15),Rahu:lon("Leo",20),Ketu:lon("Aquarius",20)},{Saturn:true},"1979"],
  ["Aquarius",{Sun:lon("Virgo",8),Moon:lon("Taurus",10),Mars:lon("Leo",4),Mercury:lon("Leo",23),Jupiter:lon("Scorpio",12),Venus:lon("Leo",1),Saturn:lon("Libra",20),Rahu:lon("Gemini",5),Ketu:lon("Sagittarius",5)},{},"1983"],
];
const PLS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"]; const rnd=n=>Math.floor(Math.random()*n);
for(const dom of DOMAINS){
  for(const[lag,deg,retro,by] of anchors){ try{ probe(dom,"ANCHOR-"+lag,facts(dom,lag,{...deg},retro,by)); }catch(e){ reg[dom].crash++; } }
  for(const lag of S){ for(let i=0;i<10;i++){ const deg={}; for(const p of PLS)deg[p]=rnd(360)+Math.random(); const retro={}; for(const p of ["Mars","Mercury","Jupiter","Venus","Saturn"])retro[p]=Math.random()<0.2;
    try{ probe(dom,lag+"#"+i,facts(dom,lag,deg,retro)); }catch(e){ reg[dom].crash++; } } }
}
console.log("=== MULTI-DOMAIN GAP AUDIT ===");
console.log("domain     charts  leaks camel lordUnnamed convBad crash");
for(const d of DOMAINS){ const r=reg[d]; console.log(d.padEnd(10), String(r.n).padStart(5), String(r.leaks).padStart(6), String(r.camel).padStart(5), String(r.lordUnnamed).padStart(11), String(r.convBad).padStart(7), String(r.crash).padStart(5)); }
console.log("\n--- sample findings (non-career domains) ---");
for(const d of DOMAINS){ if(d==="career")continue; if(reg[d].ex.length) console.log("["+d+"] "+reg[d].ex.slice(0,3).join(" | ")); }
fs.unlinkSync(shim);
