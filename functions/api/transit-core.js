// ─────────────────────────────────────────────────────────────────────────────
//  transit-core.js — self-contained ephemeris for SLOW-PLANET SIDEREAL SIGN
//
//  Functions copied VERBATIM from chart.js's calculation engine (Meeus / truncated
//  Keplerian outer-planet model, Lahiri ayanamsha). Computes Jupiter's/Saturn's
//  sidereal sign for any date.
//
//  ⚠️  NOT WIRED INTO THE REPORTS — DO NOT USE FOR TRANSIT YEAR-PINNING YET. ⚠️
//  Validated 2026-11: this model is accurate for SIGN-LEVEL BIRTH placement at the
//  epochs tested (it reproduces validated real birth charts), BUT it carries
//  EPOCH-DEPENDENT ERRORS UP TO ~1 SIGN for transits at some times — e.g. it skips
//  Capricorn in the Jupiter 2008→2009 run, and reads Saturn as Virgo in 2012 when it
//  was Libra. A ~1-sign error = ~1 year (Jupiter) of timing error, which would make a
//  gochara-based marriage-YEAR pin WRONG at those epochs — worse than the honest
//  "most likely window" the reports currently use.
//
//  The truncated outer-planet model omits the Jupiter–Saturn mutual perturbation terms
//  that matter over multi-decade spans. Before this can pin transit years, the ephemeris
//  needs an accuracy upgrade (full VSOP87 Jupiter/Saturn terms, or a real ephemeris
//  service). Kept here as the validated building block + record of the exact limitation.
//  If chart.js's ephemeris is upgraded, keep these in sync.
// ─────────────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
function norm360(a) { return ((a % 360) + 360) % 360; }

function dateToJulianDay(year, month, day, hour, minute, second) {
  const y = month <= 2 ? year - 1 : year;
  const m = month <= 2 ? month + 12 : month;
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JDN = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524;
  const fracDay = (hour + minute / 60 + second / 3600) / 24;
  return JDN - 0.5 + fracDay;
}

function kepler(M, e) {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

function sunPosition(T) {
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const C  = (1.9146 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
           + 0.000290 * Math.sin(3 * M);
  const sun_lon = norm360(L0 + C);
  const omega = norm360(125.04 - 1934.136 * T);
  const apparent = norm360(sun_lon - 0.00569 - 0.00478 * Math.sin(omega * DEG));
  return { longitude: apparent, latitude: 0 };
}

function outerPlanetPosition(T, L0c, L1c, a, e0, ec, i0, ic, w0, wc, N0, Nc) {
  const L = norm360(L0c + L1c * T);
  const e = e0 + ec * T;
  const w = norm360(w0 + wc * T);
  const M = norm360(L - w) * DEG;
  const E = kepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
  const r = a * (1 - e * Math.cos(E));
  const lon_helio = norm360(nu * RAD + w);
  const lh = lon_helio * DEG;
  const M_earth = norm360(357.52911 + 35999.05029 * T) * DEG;
  const e_earth = 0.016708634;
  const r_e = 1.000001018 * (1 - e_earth * Math.cos(M_earth));
  const le = norm360(sunPosition(T).longitude + 180) * DEG;
  const dx = r * Math.cos(lh) - r_e * Math.cos(le);
  const dy = r * Math.sin(lh) - r_e * Math.sin(le);
  return { longitude: norm360(Math.atan2(dy, dx) * RAD), latitude: 0 };
}

function jupiterPosition(T) {
  return outerPlanetPosition(T,
    34.351484, 3034.9056746, 5.202833, 0.04849485, 0.000163244,
    1.303270, -0.019882, 14.331309, 1.6126186, 100.464407, 1.0209774);
}
function saturnPosition(T) {
  return outerPlanetPosition(T,
    50.077444, 1222.1138488, 9.554909, 0.05550825, -0.000346641,
    2.488878, -0.0037363, 92.861372, 1.9666395, 113.665503, 0.8770880);
}

function lahiriAyanamsha(JD) {
  const T   = (JD - 2451545.0) / 36525.0;
  const ayan = 23.85045311 + (50.2388475 / 3600) * T * 36525 / 365.25;
  return norm360(ayan);
}
function toSidereal(tropicalLon, ayanamsha) { return norm360(tropicalLon - ayanamsha); }

const TC_SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

// Sidereal sign INDEX (0=Aries … 11=Pisces) of Jupiter or Saturn at a given date.
function transitSignIndex(planet, year, month, day) {
  const JD = dateToJulianDay(year, month || 7, day || 1, 12, 0, 0);
  const T  = (JD - 2451545.0) / 36525.0;
  const trop = planet === "Jupiter" ? jupiterPosition(T).longitude
             : planet === "Saturn"  ? saturnPosition(T).longitude : null;
  if (trop == null) return null;
  const sid = toSidereal(trop, lahiriAyanamsha(JD));
  return Math.floor(sid / 30);
}

export { transitSignIndex, TC_SIGNS, dateToJulianDay, jupiterPosition, saturnPosition, lahiriAyanamsha, toSidereal };
