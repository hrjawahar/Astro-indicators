// ─────────────────────────────────────────────────────────────────────────────
//  TRANSIT EPHEMERIS  (self-contained — for the marriage-timing precision engine)
//
//  This mirrors the stable astronomical core of chart.js (Moshier / VSOP87-truncated,
//  Lahiri ayanamsha) but is DELIBERATELY SEPARATE so the live natal pipeline in chart.js
//  is never touched. It computes only what transit rules need — Jupiter, Saturn and the
//  nodes (plus the Sun, used internally for the Earth position) — to sidereal SIGN accuracy,
//  which is all the Double-Transit (Gochara) rule requires. If chart.js's ephemeris constants
//  ever change, mirror the change here; the formulae are fixed astronomy and do not drift.
//
//  Everything downstream of this is guarded and reversible (see ENABLE_PD_TIMING): a bug here
//  can only affect the optional marriageTiming output, never the natal chart or the AD-level
//  Looking-Back windows.
// ─────────────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
function norm360(a){ return ((a % 360) + 360) % 360; }
function kepler(M, e){ let E=M+e*Math.sin(M)*(1+e*Math.cos(M)); for(let i=0;i<50;i++){ const dE=(M-E+e*Math.sin(E))/(1-e*Math.cos(E)); E+=dE; if(Math.abs(dE)<1e-10)break; } return E; }

function dateToJulianDay(year, month, day, hour, minute, second){
  const y = month<=2 ? year-1 : year;
  const m = month<=2 ? month+12 : month;
  const A = Math.floor(y/100);
  const B = 2 - A + Math.floor(A/4);
  const JDN = Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + day + B - 1524;
  const fracDay = (hour + minute/60 + second/3600) / 24;
  return JDN - 0.5 + fracDay;
}

function sunPosition(T){
  const L0 = norm360(280.46646 + 36000.76983*T + 0.0003032*T*T);
  const M  = norm360(357.52911 + 35999.05029*T - 0.0001537*T*T) * DEG;
  const C  = (1.9146 - 0.004817*T - 0.000014*T*T)*Math.sin(M)
           + (0.019993 - 0.000101*T)*Math.sin(2*M)
           + 0.000290*Math.sin(3*M);
  const sun_lon = norm360(L0 + C);
  const omega = norm360(125.04 - 1934.136*T);
  const apparent = norm360(sun_lon - 0.00569 - 0.00478*Math.sin(omega*DEG));
  return { longitude: apparent };
}

function outerPlanetPosition(T, L0c, L1c, a, e0, ec, i0, ic, w0, wc, N0, Nc){
  const L = norm360(L0c + L1c*T);
  const e = e0 + ec*T;
  const w = norm360(w0 + wc*T);
  const M = norm360(L - w) * DEG;
  const E = kepler(M, e);
  const nu = 2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
  const r = a*(1 - e*Math.cos(E));
  const lon_helio = norm360(nu*RAD + w);
  const lh = lon_helio*DEG;
  const M_earth = norm360(357.52911 + 35999.05029*T)*DEG;
  const e_earth = 0.016708634;
  const r_e = 1.000001018*(1 - e_earth*Math.cos(M_earth));
  const le = norm360(sunPosition(T).longitude + 180)*DEG;
  const dx = r*Math.cos(lh) - r_e*Math.cos(le);
  const dy = r*Math.sin(lh) - r_e*Math.sin(le);
  return { longitude: norm360(Math.atan2(dy, dx)*RAD) };
}
function jupiterPosition(T){ return outerPlanetPosition(T, 34.351484,3034.9056746,5.202833,0.04849485,0.000163244,1.303270,-0.019882,14.331309,1.6126186,100.464407,1.0209774); }
function saturnPosition(T){ return outerPlanetPosition(T, 50.077444,1222.1138488,9.554909,0.05550825,-0.000346641,2.488878,-0.0037363,92.861372,1.9666395,113.665503,0.8770880); }
function rahuPosition(T){ return { longitude: norm360(125.04452 - 1934.136261*T + 0.0020708*T*T + T*T*T/450000) }; }

function lahiriAyanamsha(JD){
  const T = (JD - 2451545.0)/36525.0;
  return norm360(23.85045311 + (50.2388475/3600)*T*36525/365.25);
}

// JD at noon UTC for a given calendar date (transits are slow — time of day is irrelevant).
function jdFromYMD(year, month, day){ return dateToJulianDay(year, month, day, 12, 0, 0); }

// Sidereal SIGN (1=Aries … 12=Pisces) of the slow transit bodies at a given calendar date.
export function transitSignsAt(year, month, day){
  const JD = jdFromYMD(year, month, day);
  const T = (JD - 2451545.0)/36525.0;
  const ayan = lahiriAyanamsha(JD);
  const sid = (tropLon)=> norm360(tropLon - ayan);
  const signOf = (sidLon)=> Math.floor(norm360(sidLon)/30) + 1;   // 1..12, Aries first
  const jup = jupiterPosition(T).longitude;
  const sat = saturnPosition(T).longitude;
  const rah = rahuPosition(T).longitude;
  return {
    Jupiter: signOf(sid(jup)),
    Saturn:  signOf(sid(sat)),
    Rahu:    signOf(sid(rah)),
    Ketu:    signOf(sid(rah + 180)),
    sidereal: { Jupiter: sid(jup), Saturn: sid(sat), Rahu: sid(rah), Ketu: sid(norm360(rah+180)) },
  };
}

// Parashari sign aspects (rashi drishti by graha): every body aspects the 7th sign from it;
// Mars also 4th/8th, Jupiter 5th/9th, Saturn 3rd/10th, nodes 5th/9th. Signs are 1..12.
const nthSign = (from, n)=> (((from + n - 2) % 12) + 12) % 12 + 1;
export function planetSignAspects(planet, sign){
  const out = new Set([ nthSign(sign, 7) ]);
  if(planet==="Mars"){ out.add(nthSign(sign,4)); out.add(nthSign(sign,8)); }
  else if(planet==="Jupiter"){ out.add(nthSign(sign,5)); out.add(nthSign(sign,9)); }
  else if(planet==="Saturn"){ out.add(nthSign(sign,3)); out.add(nthSign(sign,10)); }
  else if(planet==="Rahu"||planet==="Ketu"){ out.add(nthSign(sign,5)); out.add(nthSign(sign,9)); }
  return out;
}
export { nthSign };
