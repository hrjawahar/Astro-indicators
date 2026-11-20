import { verifyReportFaithfulness } from "../functions/api/report-verify.js";
let pass=0, fail=0;
function expect(name, cond){ if(cond){pass++; console.log("  ✓ "+name);} else {fail++; console.log("  ✗ FAIL: "+name);} }
const sec=(body)=>[{heading:"Section",body}];
const has=(r,type)=>r.violations.some(v=>v.type===type);

// ---- LORDSHIP ----
console.log("LORDSHIP:");
let f={d1:{lagnaSign:"Aquarius",placements:{},occupants:[]}};
expect("'7th lord Ketu' flagged (Aquarius 7th lord is Sun)", has(verifyReportFaithfulness("marriage",f,sec("Your 7th lord Ketu sits in the 1st.")),"lordship"));
expect("'seventh lord, Ketu' word-form flagged", has(verifyReportFaithfulness("marriage",f,sec("The seventh lord, Ketu, is weak.")),"lordship"));
expect("'Ketu, your 7th lord' reversed flagged", has(verifyReportFaithfulness("marriage",f,sec("Ketu, your 7th lord, brings detachment.")),"lordship"));
expect("'7th lord Sun' NOT flagged (correct)", !has(verifyReportFaithfulness("marriage",f,sec("Your 7th lord Sun sits in the 8th house.")),"lordship"));
expect("'sits with the 7th lord' (no planet bound) NOT flagged", !has(verifyReportFaithfulness("marriage",f,sec("Ketu sits with the 7th lord in that sign.")),"lordship"));
expect("'Saturn sits in the 7th' (no lordship claim) NOT flagged", !has(verifyReportFaithfulness("marriage",f,sec("Saturn sits in the 7th house.")),"lordship"));
let fp={d1:{lagnaSign:"Pisces",placements:{},occupants:[]}};
expect("Pisces '10th lord Jupiter' correct NOT flagged", !has(verifyReportFaithfulness("career",fp,sec("Your 10th lord Jupiter is strong.")),"lordship")); // Pisces 10th=Sag=Jupiter
expect("Pisces '10th lord Saturn' wrong flagged", has(verifyReportFaithfulness("career",fp,sec("Your 10th lord Saturn is strong.")),"lordship"));

// ---- ALL-CLEAR ----
console.log("ALL-CLEAR (marriage):");
let fstrong={d1:{lagnaSign:"Pisces",placements:{},occupants:[]},flags:{marriageAfflictionDetail:{severity:"strong",factors:["Venus debilitated in the navamsha","Rahu aspects the 7th"]}}};
expect("false all-clear when severity=strong flagged", has(verifyReportFaithfulness("marriage",fstrong,sec("Your chart carries no major marital affliction — the checks come back clear.")),"all-clear"));
let fclear={d1:{lagnaSign:"Pisces",placements:{},occupants:[]},flags:{marriageAfflictionDetail:{severity:"clear",factors:[]}}};
expect("legitimate all-clear when severity=clear NOT flagged", !has(verifyReportFaithfulness("marriage",fclear,sec("Your chart carries no major marital affliction — a steady foundation.")),"all-clear"));

// ---- MINOR MODE ----
console.log("MINOR MODE:");
let fminor={d1:{lagnaSign:"Scorpio",placements:{},occupants:[]},flags:{minorMarriageMode:true,marriageAfflictionDetail:{severity:"strong",factors:[]}}};
expect("'your husband will be' spouse portrait flagged", has(verifyReportFaithfulness("marriage",fminor,sec("Your husband will be a strong-willed person.")),"minor-mode"));
expect("'her future husband' flagged", has(verifyReportFaithfulness("marriage",fminor,sec("Her future husband is likely to be older.")),"minor-mode"));
expect("'second marriage' event flagged", has(verifyReportFaithfulness("marriage",fminor,sec("A second marriage is possible later in life.")),"minor-mode"));
expect("dated marriage timing flagged", has(verifyReportFaithfulness("marriage",fminor,sec("She is likely to marry around 2035.")),"minor-mode"));
expect("guardian temperament note NOT flagged", !has(verifyReportFaithfulness("marriage",fminor,sec("For the parents: the chart shows a strong-willed temperament to channel with patience.")),"minor-mode"));
expect("forward-looking coaching about future partnerships NOT flagged", !has(verifyReportFaithfulness("marriage",fminor,sec("As she grows, her close relationships may ask for patience; nurturing emotional security now will help her future partnerships be steady and healthy.")),"minor-mode"));
expect("general 'healthy marriage later' (no date/spouse) NOT flagged", !has(verifyReportFaithfulness("marriage",fminor,sec("The groundwork you lay now supports a healthy marriage later in her life.")),"minor-mode"));

// ---- TIMING ----
console.log("TIMING:");
let ftime={d1:{lagnaSign:"Pisces",houseLord:"Mercury",placements:{},occupants:[]},karakaPlanet:"Venus",
  dashaTiming:{likelyFruitionWindows:[{lord:"Venus",md:"Venus"}],keyWindows:[{ad:"Venus",md:"Venus"},{ad:"Mercury",md:"Venus"}],forwardADs:[],current:{lord:"Moon"},currentAD:{md:"Moon",ad:"Mars"}},futureCompass:{bands:[]}};
expect("Sun-period tied to marriage flagged (Sun not an activator)", has(verifyReportFaithfulness("marriage",ftime,sec("Your marriage most likely formalised during the Sun Mahadasha around 2017.")),"timing"));
expect("Venus-period tied to marriage NOT flagged (Venus is activator)", !has(verifyReportFaithfulness("marriage",ftime,sec("Your marriage most likely formalised during the Venus Mahadasha.")),"timing"));
expect("naming current Moon MD without event claim NOT flagged", !has(verifyReportFaithfulness("marriage",ftime,sec("You are currently in the Moon Mahadasha.")),"timing"));

// ---- DIGNITY ----
console.log("DIGNITY:");
let fdig={d1:{lagnaSign:"Aquarius",placements:{Mars:{dignity:"neutral"},Venus:{dignity:"Debilitated"}},occupants:[]}};
expect("'Mars exalted' when engine neutral flagged", has(verifyReportFaithfulness("marriage",fdig,sec("Mars is exalted and strong here.")),"dignity"));

// ---- CLEAN REPORT: zero violations ----
console.log("CLEAN:");
let fok={d1:{lagnaSign:"Aquarius",houseLord:"Sun",placements:{Sun:{dignity:"neutral"}},occupants:[]},karakaPlanet:"Venus",dashaTiming:{keyWindows:[],likelyFruitionWindows:[]},flags:{marriageAfflictionDetail:{severity:"moderate",factors:["x"]}}};
const rc=verifyReportFaithfulness("marriage",fok,sec("Your 7th lord Sun sits in the 8th house. There is a real factor to hold with care here."));
expect("clean report → no critical violations", rc.critical.length===0);

// ---- BADHAKESH (new fact) ----
console.log("BADHAKESH:");
let fbk={d1:{lagnaSign:"Aquarius",placements:{},occupants:[]}}; // Aquarius fixed -> 9th Libra -> Venus
expect("'Badhakesh Venus' correct (Aquarius) NOT flagged", !has(verifyReportFaithfulness("marriage",fbk,sec("The Badhakesh Venus sits in your 7th house.")),"badhakesh"));
expect("'Badhakesh Saturn' wrong (Aquarius) flagged", has(verifyReportFaithfulness("marriage",fbk,sec("The Badhakesh Saturn blocks the area.")),"badhakesh"));
let fbp={d1:{lagnaSign:"Pisces",placements:{},occupants:[]}}; // Pisces dual -> 7th Virgo -> Mercury
expect("'Venus is the Badhakesh' wrong (Pisces) flagged", has(verifyReportFaithfulness("marriage",fbp,sec("Venus here is the Badhakesh for your Ascendant.")),"badhakesh"));
expect("'Badhakesh Mercury' correct (Pisces) NOT flagged", !has(verifyReportFaithfulness("marriage",fbp,sec("The Badhakesh Mercury rules obstruction.")),"badhakesh"));

// ---- AVASTHA (new fact) ----
console.log("AVASTHA:");
let fav={d1:{lagnaSign:"Aquarius",placements:{Venus:{sign:"Leo",degInSign:1},Mars:{sign:"Aries",degInSign:15}},occupants:[]}};
expect("Venus@1Leo 'infant (Bala) state' correct NOT flagged", !has(verifyReportFaithfulness("marriage",fav,sec("Venus, at 1° Leo, is in its infant (Bala) state, giving a fraction of its results.")),"avastha"));
expect("Venus@1Leo claimed 'full strength (Yuva)' flagged", has(verifyReportFaithfulness("marriage",fav,sec("Venus is at full strength (Yuva) in Leo.")),"avastha"));
expect("Mars@15Aapollo 'dead (Mrita) state' flagged (true Yuva)", has(verifyReportFaithfulness("marriage",fav,sec("Mars sits in its dead (Mrita) state here.")),"avastha"));
expect("no avastha claim NOT flagged", !has(verifyReportFaithfulness("marriage",fav,sec("Venus in Leo adds warmth to the bond.")),"avastha"));

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
