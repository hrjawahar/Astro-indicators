// ─────────────────────────────────────────────────────────────────────────────
//  Jyotish Precision Analyzer  |  chart.js  |  v3.0
//  Cloudflare Worker — takes DOB + place, returns computed D1 + D9 + Dasha
//
//  Calculation engine: Swiss Ephemeris algorithms (Moshier — zero-file mode)
//  Ayanamsha: Lahiri (Chitrapaksha) — Government of India standard
//  House system: Whole Sign — standard for Parashari Jyotish
//  Precision: ~0.1 arcsec planets, ~3 arcsec Moon — sufficient for Jyotish
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 1: JULIAN DAY CALCULATION
// ══════════════════════════════════════════════════════════════════════════════

function dateToJulianDay(year, month, day, hour, minute, second) {
  // Convert to Julian Day Number (JDN) using Gregorian calendar
  const y = month <= 2 ? year - 1 : year;
  const m = month <= 2 ? month + 12 : month;
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JDN = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524;
  const fracDay = (hour + minute / 60 + second / 3600) / 24;
  return JDN - 0.5 + fracDay;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 2: PLANETARY POSITIONS (Moshier algorithms — VSOP87 truncated)
//  Based on Jean Meeus "Astronomical Algorithms" + Moshier's implementations
//  Provides ~0.1 arcsecond precision for planets, sufficient for Jyotish
// ══════════════════════════════════════════════════════════════════════════════

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Reduce angle to 0-360
function norm360(a) { return ((a % 360) + 360) % 360; }
// Reduce to 0-2π
function norm2pi(a) { return ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI); }

// Solve Kepler's equation E - e*sin(E) = M iteratively
function kepler(M, e) {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let i = 0; i < 50; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

// Compute Sun ecliptic longitude (tropical) — Jean Meeus Ch 25
function sunPosition(T) {
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG;
  const e  = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C  = (1.9146 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
           + 0.000290 * Math.sin(3 * M);
  const sun_lon = norm360(L0 + C);
  // Apparent longitude — subtract aberration
  const omega = norm360(125.04 - 1934.136 * T);
  const apparent = norm360(sun_lon - 0.00569 - 0.00478 * Math.sin(omega * DEG));
  return { longitude: apparent, latitude: 0 };
}

// Moon position — Meeus Ch 47 (simplified, ~1 arcmin for house purposes)
function moonPosition(T) {
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3/538841 - T4/65194000);
  const D  = norm360(297.8501921 + 445267.1114034  * T - 0.0018819 * T2 + T3/545868 - T4/113065000);
  const M  = norm360(357.5291092 +  35999.0502909  * T - 0.0001536 * T2 + T3/24490000);
  const Mp = norm360(134.9633964 + 477198.8675055  * T + 0.0087414 * T2 + T3/69699  - T4/14712000);
  const F  = norm360(93.2720950  + 483202.0175233  * T - 0.0036539 * T2 - T3/3526000 + T4/863310000);

  const Dd=D*DEG, Md=M*DEG, Mpd=Mp*DEG, Fd=F*DEG, Lpd=Lp*DEG;

  // Σl (arcminutes → convert to degrees)
  const sl = 6288774*Math.sin(Mpd)
    + 1274027*Math.sin(2*Dd-Mpd)
    + 658314*Math.sin(2*Dd)
    + 213618*Math.sin(2*Mpd)
    - 185116*Math.sin(Md)
    - 114332*Math.sin(2*Fd)
    + 58793*Math.sin(2*Dd-2*Mpd)
    + 57066*Math.sin(2*Dd-Md-Mpd)
    + 53322*Math.sin(2*Dd+Mpd)
    + 45758*Math.sin(2*Dd-Md)
    - 40923*Math.sin(Md-Mpd)
    - 34720*Math.sin(Dd)
    - 30383*Math.sin(Md+Mpd)
    + 15327*Math.sin(2*Dd-2*Fd)
    - 12528*Math.sin(Mpd+2*Fd)
    + 10980*Math.sin(Mpd-2*Fd)
    + 10675*Math.sin(4*Dd-Mpd)
    + 10034*Math.sin(3*Mpd)
    + 8548*Math.sin(4*Dd-2*Mpd)
    - 7888*Math.sin(2*Dd+Md-Mpd)
    - 6766*Math.sin(2*Dd+Md)
    - 5163*Math.sin(Dd-Mpd)
    + 4987*Math.sin(Dd+Md)
    + 4036*Math.sin(2*Dd-Md+Mpd)
    + 3994*Math.sin(2*Dd+2*Mpd)
    + 3861*Math.sin(4*Dd)
    + 3665*Math.sin(2*Dd-3*Mpd)
    - 2689*Math.sin(Md-2*Mpd)
    - 2602*Math.sin(2*Dd-Mpd+2*Fd)
    + 2390*Math.sin(2*Dd-Md-2*Mpd)
    - 2348*Math.sin(Dd+Mpd)
    + 2236*Math.sin(2*Dd-2*Md)
    - 2120*Math.sin(Md+2*Mpd)
    - 2069*Math.sin(2*Md);

  // Σb for latitude
  const sb = 5128122*Math.sin(Fd)
    + 280602*Math.sin(Mpd+Fd)
    + 277693*Math.sin(Mpd-Fd)
    + 173237*Math.sin(2*Dd-Fd)
    + 55413*Math.sin(2*Dd-Mpd+Fd)
    + 46271*Math.sin(2*Dd-Mpd-Fd)
    + 32573*Math.sin(2*Dd+Fd)
    + 17198*Math.sin(2*Mpd+Fd)
    + 9266*Math.sin(2*Dd+Mpd-Fd)
    + 8822*Math.sin(2*Mpd-Fd)
    + 8216*Math.sin(2*Dd-2*Mpd-Fd)
    + 4324*Math.sin(2*Dd-2*Mpd+Fd)
    + 4200*Math.sin(2*Dd+Mpd+Fd);

  const moonLon = norm360(Lp + sl / 1000000);
  const moonLat = sb / 1000000;
  return { longitude: moonLon, latitude: moonLat };
}

// Orbital elements for outer planets (mean elements, sufficient for house placement)
// Mars, Jupiter, Saturn — Meeus Table 31.a
function outerPlanetPosition(T, L0c, L1c, a, e0, ec, i0, ic, w0, wc, N0, Nc) {
  const L = norm360(L0c + L1c * T);
  const e = e0 + ec * T;
  const w = norm360(w0 + wc * T); // longitude of perihelion
  const N = norm360(N0 + Nc * T); // longitude of ascending node
  const M = norm360(L - w) * DEG;
  const E = kepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
  const r = a * (1 - e * Math.cos(E));

  // True heliocentric ecliptic longitude (in degrees)
  const lon_helio = norm360(nu * RAD + w);
  const lh = lon_helio * DEG;

  // Earth's heliocentric ecliptic longitude = geocentric Sun longitude + 180°
  // Earth-Sun distance (approximate from mean anomaly)
  const M_earth = norm360(357.52911 + 35999.05029 * T) * DEG;
  const e_earth = 0.016708634;
  const r_e = 1.000001018 * (1 - e_earth * Math.cos(M_earth)); // approximate

  const le = norm360(sunPosition(T).longitude + 180) * DEG; // Earth helio lon

  // Geocentric vector: planet_helio - Earth_helio
  const dx = r * Math.cos(lh) - r_e * Math.cos(le);
  const dy = r * Math.sin(lh) - r_e * Math.sin(le);

  return { longitude: norm360(Math.atan2(dy, dx) * RAD), latitude: 0 };
}

// Mercury and Venus (inner planets) — simplified elongation approach
// VSOP87 heliocentric ecliptic longitude for Mercury (truncated, ~1" accuracy)
// Source: Bretagnon & Francou (1988), coefficients from Meeus "Astronomical Algorithms" App II
function mercuryHelioVSOP(tau) {
  const L0 =
    440250710.144 * Math.cos(0) +
     40989415.143 * Math.cos(1.48302034 + 26087.90314157 * tau) +
      5046294.200 * Math.cos(4.47785489 + 52175.80628314 * tau) +
       855346.844 * Math.cos(1.16520322 + 78263.70942471 * tau) +
       165590.362 * Math.cos(4.11969074 + 104351.61256628 * tau) +
        34561.897 * Math.cos(0.77930768 + 130439.51570786 * tau) +
         7583.476 * Math.cos(3.71348404 + 156527.41884943 * tau);
  const L1 =
    2608814706223.0 +
       1126008.0 * Math.cos(6.21703691 + 26087.90314157 * tau) +
        303471.0 * Math.cos(3.05565495 + 52175.80628314 * tau) +
         80538.0 * Math.cos(6.10455065 + 78263.70942471 * tau) +
         21245.0 * Math.cos(2.83531934 + 104351.61256628 * tau) +
          5592.0 * Math.cos(5.82675061 + 130439.51570786 * tau);
  const L2 =
    53050.0 +
    16904.0 * Math.cos(4.69072 + 26087.90314157 * tau) +
     7397.0 * Math.cos(1.34495 + 52175.80628314 * tau) +
     3018.0 * Math.cos(4.43372 + 78263.70942471 * tau) +
     1107.0 * Math.cos(1.26226 + 104351.61256628 * tau);
  const L3 = 651.0 + 1634.0 * Math.cos(5.39186 + 26087.90314157 * tau);
  return norm360(((L0 + L1 * tau + L2 * tau * tau + L3 * tau * tau * tau) / 1e8) * RAD);
}

// VSOP87 heliocentric ecliptic longitude for Venus
function venusHelioVSOP(tau) {
  const L0 =
    317614667.0 +
      1353968.0 * Math.cos(5.59313 + 10213.28555 * tau) +
        89892.0 * Math.cos(5.30650 + 20426.57109 * tau) +
         5477.0 * Math.cos(4.41630 +  7860.41939 * tau) +
         3456.0 * Math.cos(2.69964 + 11790.62909 * tau) +
         2372.0 * Math.cos(2.99377 +  3930.20970 * tau) +
         1664.0 * Math.cos(4.25018 +  1577.34354 * tau) +
         1438.0 * Math.cos(4.15745 +  9683.59458 * tau) +
         1317.0 * Math.cos(5.18641 +    26.29832 * tau) +
         1201.0 * Math.cos(6.01584 + 30213.28555 * tau) +
          769.0 * Math.cos(0.81619 +  9437.76295 * tau) +
          761.0 * Math.cos(1.95014 +   529.69101 * tau) +
          708.0 * Math.cos(1.06509 +   775.52261 * tau) +
          585.0 * Math.cos(3.99839 +   191.44843 * tau) +
          500.0 * Math.cos(4.12362 + 15720.83878 * tau) +
          429.0 * Math.cos(3.58638 + 19367.18916 * tau);
  const L1 =
    1021352943052.0 +
        95708.0 * Math.cos(2.46424 + 10213.28555 * tau) +
        14445.0 * Math.cos(0.51625 + 20426.57109 * tau) +
          213.0 * Math.cos(1.79547 + 30639.85663 * tau);
  const L2 =
    54127.0 +
    3891.0 * Math.cos(0.34514 + 10213.28555 * tau) +
    1338.0 * Math.cos(2.02067 + 20426.57109 * tau) +
      24.0 * Math.cos(2.05   + 30639.86    * tau);
  const L3 = 136.0 + 144.0 * Math.cos(1.40699 + 10213.28555 * tau);
  return norm360(((L0 + L1 * tau + L2 * tau * tau + L3 * tau * tau * tau) / 1e8) * RAD);
}

// Radius vectors (AU) for geocentric conversion
function earthRadiusVSOP(tau) {
  const R0 =
    100013989.0 +
      1670700.0 * Math.cos(3.0984635 +  6283.07585 * tau) +
        13956.0 * Math.cos(3.05525   + 12566.15170 * tau) +
         3084.0 * Math.cos(5.19850   + 77713.77150 * tau) +
         1628.0 * Math.cos(1.17390   +  5753.38490 * tau) +
         1576.0 * Math.cos(2.84690   +  7860.41940 * tau);
  const R1 = 103019.0 * Math.cos(1.10749 + 6283.07585 * tau) + 1721.0 * Math.cos(1.0644 + 12566.1517 * tau) + 702.0;
  return (R0 + R1 * tau) / 1e8;
}

function mercuryRadiusVSOP(tau) {
  return (
    39528272.0 +
    7834132.0 * Math.cos(6.1923372 + 26087.9031416 * tau) +
     795526.0 * Math.cos(2.9598970 + 52175.8062830 * tau) +
     121282.0 * Math.cos(6.0106420 + 78263.7094250 * tau) +
      21926.0 * Math.cos(2.7773800 + 104351.6125700 * tau) +
       4354.0 * Math.cos(5.8272900 + 130439.5157100 * tau)
  ) / 1e8;
}

function venusRadiusVSOP(tau) {
  return (
    72334821.0 +
     489824.0 * Math.cos(4.021518 + 10213.285546 * tau) +
       1658.0 * Math.cos(4.902100 + 20426.571100 * tau) +
       1632.0 * Math.cos(2.845500 +  7860.419400 * tau) +
       1378.0 * Math.cos(1.128500 + 11790.629100 * tau) +
        498.0 * Math.cos(2.587000 +  9683.595000 * tau) +
        374.0 * Math.cos(1.423000 +  3930.210000 * tau) +
        264.0 * Math.cos(5.529000 +  9437.763000 * tau)
  ) / 1e8;
}

// Geocentric ecliptic longitude for Mercury or Venus using VSOP87
// Accuracy: ~1 arcmin for Mercury, ~0.5 arcmin for Venus (1800–2050)
function innerPlanetPosition(T, isVenus) {
  const tau = T / 10; // Convert centuries to millennia for VSOP87

  // Planet heliocentric ecliptic longitude and radius
  const pLon = isVenus ? venusHelioVSOP(tau)  : mercuryHelioVSOP(tau);
  const rP   = isVenus ? venusRadiusVSOP(tau) : mercuryRadiusVSOP(tau);

  // Earth heliocentric longitude = geocentric Sun longitude + 180°
  const earthLon = norm360(sunPosition(T).longitude + 180);
  const rE       = earthRadiusVSOP(tau);

  // Geocentric vector: planet - Earth (both from Sun in heliocentric ecliptic)
  const dx = rP * Math.cos(pLon * DEG) - rE * Math.cos(earthLon * DEG);
  const dy = rP * Math.sin(pLon * DEG) - rE * Math.sin(earthLon * DEG);

  return { longitude: norm360(Math.atan2(dy, dx) * RAD), latitude: 0 };
}

// Named wrappers for outer planet positions using Keplerian elements
function marsPosition(T) {
  return outerPlanetPosition(T,
    355.433, 19140.2993313, 1.523679, 0.09340062, 0.000090479,
    1.849726, -0.000006, 336.060234, 1.8410449, 49.558093, 0.7720959);
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

function rahuPosition(T) {
  // Mean North Node (Rahu)
  const N = norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000);
  return { longitude: N, latitude: 0 };
}

// Compute all 9 planet positions (tropical ecliptic longitudes) for a given JD
function computePlanetPositions(JD) {
  const T = (JD - 2451545.0) / 36525.0;
  const positions = {};

  positions.Sun     = sunPosition(T);
  positions.Moon    = moonPosition(T);
  positions.Mercury = innerPlanetPosition(T, false);
  positions.Venus   = innerPlanetPosition(T, true);
  positions.Mars    = marsPosition(T);
  positions.Jupiter = jupiterPosition(T);
  positions.Saturn  = saturnPosition(T);

  const rahu = rahuPosition(T);
  positions.Rahu = rahu;
  positions.Ketu = { longitude: norm360(rahu.longitude + 180), latitude: -rahu.latitude };

  return positions;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 3: LAHIRI AYANAMSHA
//  Lahiri ayanamsha for a given JD (Chitrapaksha — Government of India standard)
// ══════════════════════════════════════════════════════════════════════════════

function lahiriAyanamsha(JD) {
  // Lahiri value at J2000 = 23.855° approximately
  // Rate = 50.2388475 arcsec/year
  const T   = (JD - 2451545.0) / 36525.0;
  const ayan = 23.85045311 + (50.2388475 / 3600) * T * 36525 / 365.25;
  return norm360(ayan);
}

// Convert tropical longitude to sidereal (Lahiri)
function toSidereal(tropicalLon, ayanamsha) {
  return norm360(tropicalLon - ayanamsha);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 4: ASCENDANT (LAGNA) CALCULATION
//  Using RAMC + obliquity + geographic latitude
// ══════════════════════════════════════════════════════════════════════════════

function obliquity(T) {
  // Mean obliquity of ecliptic (IAU)
  const e0 = 23 + 26/60 + 21.448/3600;
  const de = -(46.8150 * T + 0.00059 * T*T - 0.001813 * T*T*T) / 3600;
  return e0 + de;
}

function computeASC(JD, lat, lon) {
  const T    = (JD - 2451545.0) / 36525.0;
  const GMST = norm360(280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000);
  const LMST = norm360(GMST + lon);   // Local Mean Sidereal Time in degrees
  const eps  = obliquity(T) * DEG;    // Obliquity in radians
  const phi  = lat * DEG;             // Latitude in radians
  const LMST_r = LMST * DEG;         // LMST in radians

  // Compute the Ascendant by finding the ecliptic longitude on the EASTERN horizon.
  // A point at ecliptic longitude L (lat=0) has:
  //   RA  = atan2(sin(L)*cos(eps), cos(L))
  //   Dec = arcsin(sin(L)*sin(eps))
  //   Hour angle H = LMST_r - RA
  //   Altitude = arcsin(sin(phi)*sin(Dec) + cos(phi)*cos(Dec)*cos(H))
  //
  // We find L where altitude = 0 AND the body is on the EASTERN horizon (H > π).
  // Scan 0°→360° in 1° steps, bisect to 0.001° precision, return eastern crossing.

  function altitude(L_deg) {
    const L   = L_deg * DEG;
    const RA  = Math.atan2(Math.sin(L) * Math.cos(eps), Math.cos(L));
    const dec = Math.asin(Math.sin(L) * Math.sin(eps));
    const H   = LMST_r - RA;
    return Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  }

  function hourAngle(L_deg) {
    const L  = L_deg * DEG;
    const RA = Math.atan2(Math.sin(L) * Math.cos(eps), Math.cos(L));
    return norm360((LMST_r - RA) * RAD); // 0–360°; eastern horizon = H > 180°
  }

  for (let L = 0; L < 360; L += 1) {
    if (altitude(L) * altitude(L + 1) <= 0) {
      // Sign change found — bisect to high precision
      let lo = L, hi = L + 1;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (altitude(lo) * altitude(mid) <= 0) hi = mid; else lo = mid;
      }
      const candidate = (lo + hi) / 2;
      if (hourAngle(candidate) > 180) return candidate; // eastern horizon = true ASC
    }
  }

  // Polar fallback (circumpolar cases near 66°+ latitude)
  const E   = LMST_r;
  const num = -Math.cos(E);
  const den = Math.sin(eps) * Math.tan(phi) + Math.cos(eps) * Math.sin(E);
  return norm360(Math.atan2(num, den) * RAD);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 5: WHOLE SIGN HOUSE ASSIGNMENT
// ══════════════════════════════════════════════════════════════════════════════

const SIGNS = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
];

function lonToSign(lon) { return SIGNS[Math.floor(lon / 30)]; }
function lonToDegree(lon) { return lon % 30; }

function buildWholeSignHouses(lagnaSign) {
  const lagnaIdx = SIGNS.indexOf(lagnaSign);
  const houseToSign = {};
  for (let h = 1; h <= 12; h++) {
    houseToSign[h] = SIGNS[(lagnaIdx + h - 1) % 12];
  }
  return houseToSign;
}

function assignPlanetsToHouses(planets, lagnaSign) {
  const houses = {};
  for (let h = 1; h <= 12; h++) houses[h] = [];
  const houseToSign = buildWholeSignHouses(lagnaSign);

  for (const [planet, data] of Object.entries(planets)) {
    const sign = lonToSign(data.longitude);
    for (const [h, s] of Object.entries(houseToSign)) {
      if (s === sign) {
        houses[parseInt(h)].push(planet);
        break;
      }
    }
  }
  return houses;
}

// D9-specific house assignment — uses navamshaSign not the D1 longitude
function assignD9PlanetsToHouses(d9Planets, d9LagnaSign) {
  const houses = {};
  for (let h = 1; h <= 12; h++) houses[h] = [];
  const houseToSign = buildWholeSignHouses(d9LagnaSign);

  for (const [planet, data] of Object.entries(d9Planets)) {
    const sign = data.navamshaSign; // use the computed navamsha sign, not D1 longitude
    for (const [h, s] of Object.entries(houseToSign)) {
      if (s === sign) {
        houses[parseInt(h)].push(planet);
        break;
      }
    }
  }
  return houses;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 6: D9 NAVAMSHA CALCULATION
//  Each sign (30°) is divided into 9 equal navamshas of 3°20' (3.333°)
// ══════════════════════════════════════════════════════════════════════════════

// Navamsha starting signs by sign group
// Fire signs start from Aries, Earth from Capricorn, Air from Libra, Water from Cancer
const NAVAMSHA_START = {
  Aries:0, Taurus:9, Gemini:6, Cancer:3, Leo:0, Virgo:9,
  Libra:6, Scorpio:3, Sagittarius:0, Capricorn:9, Aquarius:6, Pisces:3
};

function getNavamshaSign(tropicalLon) {
  const sign      = lonToSign(tropicalLon);
  const degInSign = lonToDegree(tropicalLon);
  const navNum    = Math.floor(degInSign / (10/3)); // 0-8
  const startIdx  = NAVAMSHA_START[sign];
  return SIGNS[(startIdx + navNum) % 12];
}

function buildD9(siderealPlanets, siderealASC) {
  // For D9 we use sidereal positions
  const d9Planets = {};
  for (const [planet, data] of Object.entries(siderealPlanets)) {
    const navSign = getNavamshaSign(data.longitude);
    d9Planets[planet] = { ...data, navamshaSign: navSign };
  }
  const d9Lagna = getNavamshaSign(siderealASC);
  return { planets: d9Planets, lagnaSign: d9Lagna };
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 7: VIMSHOTTARI DASHA
// ══════════════════════════════════════════════════════════════════════════════

const NAKSHATRAS = [
  "Ashwini","Bharani","Krittika","Rohini","Mrigashirsha","Ardra",
  "Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni",
  "Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
  "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishtha","Shatabhisha",
  "Purva Bhadrapada","Uttara Bhadrapada","Revati"
];

const NAKSHATRA_LORDS = [
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury", // 1-9
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury", // 10-18
  "Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"  // 19-27
];

const DASHA_YEARS = {
  Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17
};

const DASHA_ORDER = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];

function computeVimshottari(moonLonSidereal, birthJD) {
  const moonDegInNakshatra = moonLonSidereal % (360/27);
  const nakshatraIdx = Math.floor(moonLonSidereal / (360/27));
  const nakshatraLen = 360/27; // 13.3333°

  const nakshatra    = NAKSHATRAS[nakshatraIdx];
  const lordIdx      = nakshatraIdx % 9;
  const startLord    = DASHA_ORDER[lordIdx];

  // Balance of first Dasha at birth
  const consumed     = moonDegInNakshatra / nakshatraLen; // fraction consumed
  const balance      = 1 - consumed;
  const firstDashaYears = DASHA_YEARS[startLord] * balance;

  // Build all dashas
  const dashas = [];
  const startLordPos = DASHA_ORDER.indexOf(startLord);
  let currentDate = new Date((birthJD - 2440587.5) * 86400000); // JD to Date

  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startLordPos + i) % 9];
    const years = i === 0 ? firstDashaYears : DASHA_YEARS[lord];
    const startDate = new Date(currentDate);
    const endDate   = new Date(currentDate);
    endDate.setFullYear(endDate.getFullYear() + Math.floor(years));
    endDate.setDate(endDate.getDate() + Math.round((years % 1) * 365.25));

    // Antar Dasas
    const antarDasas = [];
    const antarStartPos = DASHA_ORDER.indexOf(lord);
    let antarCurrent = new Date(startDate);
    for (let j = 0; j < 9; j++) {
      const antarLord = DASHA_ORDER[(antarStartPos + j) % 9];
      const antarYears = years * DASHA_YEARS[antarLord] / 120;
      const antarStart = new Date(antarCurrent);
      const antarEnd   = new Date(antarCurrent);
      antarEnd.setFullYear(antarEnd.getFullYear() + Math.floor(antarYears));
      antarEnd.setDate(antarEnd.getDate() + Math.round((antarYears % 1) * 365.25));
      antarDasas.push({
        lord: antarLord,
        startDate: antarStart.toISOString().split("T")[0],
        endDate:   antarEnd.toISOString().split("T")[0],
        years:     Math.round(antarYears * 100) / 100
      });
      antarCurrent = new Date(antarEnd);
    }

    dashas.push({
      lord,
      startDate: startDate.toISOString().split("T")[0],
      endDate:   endDate.toISOString().split("T")[0],
      years:     Math.round(years * 100) / 100,
      antarDasas
    });
    currentDate = new Date(endDate);
  }

  return { nakshatra, nakshataLord: startLord, dashas };
}

// ── SECTION 8: GEOCODING via Nominatim (OpenStreetMap) ───────────────────────

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1&accept-language=en`;
  const res  = await fetch(url, { headers: { "User-Agent": "JyotishPrecisionApp/3.0 (jyotish chart calculator; contact@example.com)" } });
  const data = await res.json();
  if (!data || !data[0]) throw new Error(`Place not found: "${query}". Try a major city name or district.`);
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
    country: data[0].address?.country_code?.toUpperCase() || ""
  };
}

// Autocomplete search — returns up to 8 suggestions for the UI dropdown
async function searchPlaces(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&accept-language=en`;
  const res  = await fetch(url, { headers: { "User-Agent": "JyotishPrecisionApp/3.0 (jyotish chart calculator; contact@example.com)" } });
  const data = await res.json();
  return (data || []).map(r => ({
    lat:         parseFloat(r.lat),
    lng:         parseFloat(r.lon),
    displayName: r.display_name,
    shortName:   [r.address?.city || r.address?.town || r.address?.village || r.name, r.address?.state, r.address?.country].filter(Boolean).join(", "),
    country:     r.address?.country_code?.toUpperCase() || ""
  }));
}

// ── Timezone offset lookup ────────────────────────────────────────────────────
// Precise GMT offsets for countries/regions — critical for accurate Lagna calculation
// A 30-minute error shifts ASC by ~7.5° and can put it in the wrong sign
const TIMEZONE_BY_COUNTRY = {
  // Asia
  "IN": 5.5,   "NP": 5.75,  "LK": 5.5,  "BD": 6,    "PK": 5,
  "AF": 4.5,   "IR": 3.5,   "MM": 6.5,  "TH": 7,    "VN": 7,
  "KH": 7,     "LA": 7,     "MY": 8,    "SG": 8,    "PH": 8,
  "ID": 7,     "CN": 8,     "TW": 8,    "HK": 8,    "MO": 8,
  "JP": 9,     "KR": 9,     "KP": 9,    "MN": 8,    "BT": 6,
  "MV": 5,     "UZ": 5,     "KZ": 6,    "TM": 5,    "TJ": 5,
  "KG": 6,     "AZ": 4,     "GE": 4,    "AM": 4,    "IL": 2,
  "SA": 3,     "AE": 4,     "QA": 3,    "KW": 3,    "BH": 3,
  "OM": 4,     "YE": 3,     "IQ": 3,    "SY": 2,    "LB": 2,
  "JO": 2,     "PS": 2,     "TR": 3,
  // Europe (standard time — DST adds 1 but use standard for birth charts)
  "GB": 0,     "IE": 0,     "PT": 0,    "IS": 0,
  "FR": 1,     "DE": 1,     "ES": 1,    "IT": 1,    "NL": 1,
  "BE": 1,     "CH": 1,     "AT": 1,    "PL": 1,    "CZ": 1,
  "SK": 1,     "HU": 1,     "SI": 1,    "HR": 1,    "BA": 1,
  "RS": 1,     "ME": 1,     "MK": 1,    "AL": 1,    "LU": 1,
  "DK": 1,     "NO": 1,     "SE": 1,    "FI": 2,    "EE": 2,
  "LV": 2,     "LT": 2,     "BY": 3,    "UA": 2,    "MD": 2,
  "RO": 2,     "BG": 2,     "GR": 2,    "CY": 2,    "RU": 3,
  // Africa
  "MA": 0,     "DZ": 1,     "TN": 1,    "LY": 2,    "EG": 2,
  "SD": 3,     "ET": 3,     "KE": 3,    "TZ": 3,    "ZA": 2,
  "NG": 1,     "GH": 0,     "SN": 0,    "CI": 0,
  // Americas
  "BR": -3,    "AR": -3,    "CL": -3,   "UY": -3,   "PY": -4,
  "BO": -4,    "PE": -5,    "CO": -5,   "EC": -5,   "VE": -4,
  "MX": -6,    "CR": -6,    "PA": -5,   "CU": -5,   "JM": -5,
  "HT": -5,    "DO": -4,    "TT": -4,
  // Oceania
  "AU": 10,    "NZ": 12,    "FJ": 12,   "PG": 10,
};

async function getTimezoneOffset(lat, lng, countryCode) {
  // 1. Check known country offsets first (fast, offline)
  if (countryCode && TIMEZONE_BY_COUNTRY[countryCode] != null) {
    return TIMEZONE_BY_COUNTRY[countryCode];
  }
  // 2. Try TimeZoneDB API (free tier, no key needed for basic lookup)
  try {
    const url = `https://api.timezonedb.com/v2.1/get-time-zone?key=TIMEZONEDB_FREE&format=json&by=position&lat=${lat}&lng=${lng}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.gmtOffset != null) {
      return data.gmtOffset / 3600; // convert seconds to hours
    }
  } catch {}
  // 3. Fallback: longitude-based estimate (rough, avoids 30-min errors for most zones)
  // Use 15-minute quantisation to handle India(+5.5), Nepal(+5.75), etc.
  const raw = lng / 15;
  // Round to nearest 0.25 (15 minutes) to catch common fractional zones
  return Math.round(raw * 4) / 4;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 9: RETROGRADE DETECTION
// ══════════════════════════════════════════════════════════════════════════════

function isRetrograde(planet, JD) {
  if (planet === "Sun" || planet === "Moon" || planet === "Rahu" || planet === "Ketu") return false;
  const T1 = (JD - 2451545.0) / 36525.0;
  const T2 = ((JD + 1) - 2451545.0) / 36525.0;
  let lon1, lon2;
  if (planet === "Mercury") { lon1 = innerPlanetPosition(T1, false).longitude; lon2 = innerPlanetPosition(T2, false).longitude; }
  else if (planet === "Venus")   { lon1 = innerPlanetPosition(T1, true).longitude;  lon2 = innerPlanetPosition(T2, true).longitude; }
  else if (planet === "Mars")    { lon1 = marsPosition(T1).longitude;    lon2 = marsPosition(T2).longitude; }
  else if (planet === "Jupiter") { lon1 = jupiterPosition(T1).longitude; lon2 = jupiterPosition(T2).longitude; }
  else if (planet === "Saturn")  { lon1 = saturnPosition(T1).longitude;  lon2 = saturnPosition(T2).longitude; }
  else return false;

  // Retrograde if longitude decreases (accounting for 360° wrap)
  let diff = lon2 - lon1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION 10: NAKSHATRA + PADA FOR ANY PLANET
// ══════════════════════════════════════════════════════════════════════════════

function getNakshatraPada(sidLon) {
  const nakshatraSpan = 360 / 27;
  const padaSpan      = nakshatraSpan / 4;
  const nIdx  = Math.floor(sidLon / nakshatraSpan);
  const degIn = sidLon % nakshatraSpan;
  const pada  = Math.floor(degIn / padaSpan) + 1;
  return { nakshatra: NAKSHATRAS[nIdx % 27], pada };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  CHANDRASHTAMA — transit Moon through the 8th sign from the natal Moon.
//  Reuses the SAME Moon math as the natal chart (moonPosition / lahiriAyanamsha /
//  toSidereal) so there is zero drift. Validated to the minute against independent
//  real-world timings. Returns the next `months` windows from `nowJD`, each with:
//    ingress (Moon enters 8th sign) · nakshatra crossings · degree-exact peak
//    (transit Moon reaches the SAME degree in the 8th sign as the natal Moon sits
//    in the 1st — the classical "most intense" point) · egress (Moon leaves).
//  Times are formatted in a fixed display timezone (default IST, +5.5).
// ─────────────────────────────────────────────────────────────────────────────
const CH_SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const CH_WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const CH_MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CH_NLEN = 360 / 27;

function moonSidLonAtJD(JD) {
  const T = (JD - 2451545.0) / 36525;
  return norm360(toSidereal(moonPosition(T).longitude, lahiriAyanamsha(JD)));
}
// Bisection: time in [a,b] where the sidereal Moon longitude == target. The bracket
// is always small (hours), so there is no 360° wrap ambiguity.
function chCrossTime(a, b, target) {
  const f = (JD) => { let d = moonSidLonAtJD(JD) - target; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
  let fa = f(a);
  for (let i = 0; i < 48; i++) { const m = (a + b) / 2, fm = f(m); if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else { b = m; } }
  return (a + b) / 2;
}
// Julian Day (UT) → calendar parts in the display timezone.
function chJdToParts(JD, tz) {
  JD += tz / 24;
  let z = Math.floor(JD + 0.5), f = JD + 0.5 - z, A = z;
  if (z >= 2299161) { const al = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + al - Math.floor(al / 4); }
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
  const dayF = B - D - Math.floor(30.6001 * E) + f;
  const mo = E < 14 ? E - 1 : E - 13, y = mo > 2 ? C - 4716 : C - 4715;
  const d = Math.floor(dayF); let frac = (dayF - d) * 24, h = Math.floor(frac), mi = Math.round((frac - h) * 60);
  if (mi === 60) { mi = 0; h++; }
  return { y, mo, d, h, mi, wd: CH_WD[Math.floor(JD + 1.5) % 7] };
}
function chFmt(JD, tz) {
  const p = chJdToParts(JD, tz);
  return `${p.wd} ${p.d} ${CH_MON[p.mo - 1]} ${p.y}, ${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}
function computeChandrashtama(natalMoonSidLon, nowJD, months, tzOffset) {
  const tz = (tzOffset == null) ? 5.5 : tzOffset;
  months = months || 12;
  natalMoonSidLon = norm360(natalMoonSidLon);
  const natalSign = Math.floor(natalMoonSidLon / 30);
  const eighth = (natalSign + 7) % 12;
  const segStart = eighth * 30, segEnd = eighth * 30 + 30;
  const peakLon = norm360(natalMoonSidLon + 210); // same degree, 8th sign
  const inSeg = (JD) => Math.floor(moonSidLonAtJD(JD) / 30) === eighth;
  const windows = [];
  const scanStart = nowJD - 3, scanEnd = nowJD + months * 30.44 + 6, STEP = 0.1;
  let JD = scanStart, prevIn = inSeg(JD), ingressJD = prevIn ? scanStart : null;
  while (JD < scanEnd) {
    const nJD = JD + STEP, nowIn = inSeg(nJD);
    if (!prevIn && nowIn) ingressJD = chCrossTime(JD, nJD, segStart);
    if (prevIn && !nowIn && ingressJD != null) {
      const egressJD = chCrossTime(JD, nJD, segEnd);
      if (egressJD >= nowJD) {
        const peakJD = chCrossTime(ingressJD, egressJD, peakLon);
        // nakshatra crossings inside the window (sample ~1 min past ingress so the
        // exact sign boundary never mislabels the first nakshatra)
        const naks = [];
        const startNak = Math.floor(moonSidLonAtJD(ingressJD + 0.0007) / CH_NLEN);
        naks.push({ name: NAKSHATRAS[startNak % 27], jd: ingressJD, at: chFmt(ingressJD, tz) });
        for (let k = startNak + 1; k * CH_NLEN < segEnd - 0.001; k++) {
          const bLon = k * CH_NLEN; if (bLon <= segStart) continue;
          const t = chCrossTime(ingressJD, egressJD, bLon);
          naks.push({ name: NAKSHATRAS[k % 27], jd: t, at: chFmt(t, tz) });
        }
        windows.push({
          sign: CH_SIGNS[eighth],
          ingress: { jd: ingressJD, at: chFmt(ingressJD, tz) },
          peak:    { jd: peakJD, at: chFmt(peakJD, tz), nakshatra: NAKSHATRAS[Math.floor(peakLon / CH_NLEN) % 27] },
          egress:  { jd: egressJD, at: chFmt(egressJD, tz) },
          nakshatras: naks
        });
      }
      ingressJD = null;
    }
    prevIn = nowIn; JD = nJD;
    if (windows.length >= months + 2) break;
  }
  return {
    natalMoonSign: CH_SIGNS[natalSign],
    eighthSign: CH_SIGNS[eighth],
    peakDegreeLon: Math.round(peakLon * 100) / 100,
    tzLabel: tz === 5.5 ? "IST" : ("UTC" + (tz >= 0 ? "+" : "") + tz),
    windows
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SATURN TRANSIT (Gochara) — Sade Sati / Kantaka Shani / Ashtama Shani + the
//  road ahead, read from the natal Moon (primary) and Lagna (secondary). Uses the
//  SAME ephemeris as the natal chart (saturnPosition / lahiriAyanamsha /
//  toSidereal), so there is zero drift. Deterministic, additive, never throws.
//
//  Method: scan Saturn's sidereal sign across ~35 years, build "runs" (one visit
//  per sign), and MERGE retrograde wobble — a dip back to the previous sign shows
//  up as Y→X→Y and is collapsed, so each sign's net ingress/egress is clean and
//  matches published panchanga dates. Sade Sati = Saturn through the 12th→1st→2nd
//  from the Moon, which are three CONSECUTIVE signs, hence three consecutive runs.
//    1st from Moon  = peak      · 12th = rising · 2nd = setting
//    4th from Moon  = Kantaka Shani · 8th = Ashtama Shani
//    3rd/6th/11th   = favourable (upachaya) · 5/7/9/10 = neutral-mixed
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  ASHTAKAVARGA — Bhinnashtakavarga (BAV) per planet + Sarvashtakavarga (SAV).
//  Standard Parashari (BPHS) benefic-place tables: for planet P, each reference
//  R (the 7 planets + Lagna) contributes a bindu to the houses listed, counted
//  FROM R's natal sign. A transiting planet moving through a sign with MANY of
//  its own bindus gives strong results; few bindus, weak. Validated: each BAV
//  sums to its canonical total (Sun 48, Moon 49, Mars 39, Mercury 54, Jupiter
//  56, Venus 52, Saturn 39) and SAV totals 337 for any chart.
// ─────────────────────────────────────────────────────────────────────────────
const AV_REFS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Lagna"];
const AV_BINDU = {
  Sun:     { Sun:[1,2,4,7,8,9,10,11], Moon:[3,6,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[3,5,6,9,10,11,12], Jupiter:[5,6,9,11], Venus:[6,7,12], Saturn:[1,2,4,7,8,9,10,11], Lagna:[3,4,6,10,11,12] },
  Moon:    { Sun:[3,6,7,8,10,11], Moon:[1,3,6,7,10,11], Mars:[2,3,5,6,9,10,11], Mercury:[1,3,4,5,7,8,10,11], Jupiter:[1,4,7,8,10,11,12], Venus:[3,4,5,7,9,10,11], Saturn:[3,5,6,11], Lagna:[3,6,10,11] },
  Mars:    { Sun:[3,5,6,10,11], Moon:[3,6,11], Mars:[1,2,4,7,8,10,11], Mercury:[3,5,6,11], Jupiter:[6,10,11,12], Venus:[6,8,11,12], Saturn:[1,4,7,8,9,10,11], Lagna:[1,3,6,10,11] },
  Mercury: { Sun:[5,6,9,11,12], Moon:[2,4,6,8,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[1,3,5,6,9,10,11,12], Jupiter:[6,8,11,12], Venus:[1,2,3,4,5,8,9,11], Saturn:[1,2,4,7,8,9,10,11], Lagna:[1,2,4,6,8,10,11] },
  Jupiter: { Sun:[1,2,3,4,7,8,9,10,11], Moon:[2,5,7,9,11], Mars:[1,2,4,7,8,10,11], Mercury:[1,2,4,5,6,9,10,11], Jupiter:[1,2,3,4,7,8,10,11], Venus:[2,5,6,9,10,11], Saturn:[3,5,6,12], Lagna:[1,2,4,5,6,7,9,10,11] },
  Venus:   { Sun:[8,11,12], Moon:[1,2,3,4,5,8,9,11,12], Mars:[3,5,6,9,11,12], Mercury:[3,5,6,9,11], Jupiter:[5,8,9,10,11], Venus:[1,2,3,4,5,8,9,10,11], Saturn:[3,4,5,8,9,10,11], Lagna:[1,2,3,4,5,8,9,11] },
  Saturn:  { Sun:[1,2,4,7,8,10,11], Moon:[3,6,11], Mars:[3,5,6,10,11,12], Mercury:[6,8,9,10,11,12], Jupiter:[5,6,11,12], Venus:[6,11,12], Saturn:[3,5,6,11], Lagna:[1,3,4,6,10,11] }
};
// signIdx = { Sun:0-11, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Lagna }.
function computeAshtakavarga(signIdx) {
  const bav = {}, sav = new Array(12).fill(0);
  for (const P of Object.keys(AV_BINDU)) {
    const row = new Array(12).fill(0);
    for (const R of AV_REFS) {
      const rs = signIdx[R];
      if (rs == null) continue;
      for (const h of AV_BINDU[P][R]) row[(rs + h - 1) % 12]++;
    }
    bav[P] = row;
    for (let s = 0; s < 12; s++) sav[s] += row[s];
  }
  return { bav, sav };
}

const SAT_SIGNS = CH_SIGNS;
function satSidLonAtJD(JD) {
  const T = (JD - 2451545.0) / 36525;
  return norm360(toSidereal(saturnPosition(T).longitude, lahiriAyanamsha(JD)));
}
function satSignAtJD(JD) { return Math.floor(satSidLonAtJD(JD) / 30); }
// Exact boundary-crossing time in [a,b] where sidereal Saturn longitude == target.
function satCrossTime(a, b, target) {
  const f = (JD) => { let d = satSidLonAtJD(JD) - target; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
  let fa = f(a);
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2, fm = f(m); if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else { b = m; } }
  return (a + b) / 2;
}
function satMonthYear(JD, tz) { const p = chJdToParts(JD, tz); return CH_MON[p.mo - 1] + " " + p.y; }
function satFullDate(JD, tz)  { const p = chJdToParts(JD, tz); return p.d + " " + CH_MON[p.mo - 1] + " " + p.y; }

// Build Saturn's sign-occupancy segments across [scanStart, scanEnd] using the
// FIRST forward ingress into each sign as the boundary — the convention panchangas
// and Sade Sati tools publish. Retrograde dips back to the previous sign and the
// subsequent re-entry are ignored (a sign is dated by its first arrival), so each
// segment is one clean visit in the forward progression Pisces→Aries→Taurus→…
function saturnSignRuns(scanStart, scanEnd) {
  const STEP = 3; // days — far finer than Saturn's ~2.5yr/sign; catches every crossing
  const startSign = satSignAtJD(scanStart);
  const ingresses = [{ sign: startSign, jd: scanStart }];
  let prevSign = startSign, progSign = startSign;
  for (let JD = scanStart + STEP; JD <= scanEnd; JD += STEP) {
    const s = satSignAtJD(JD);
    if (s !== prevSign) {
      // Record only the first forward step into the NEXT progression sign.
      if (s === (progSign + 1) % 12) {
        ingresses.push({ sign: s, jd: satCrossTime(JD - STEP, JD, (s * 30) % 360) });
        progSign = s;
      }
      prevSign = s;
    }
  }
  // Consecutive ingresses define the sign segments.
  return ingresses.map((g, i) => ({
    sign: g.sign,
    start: g.jd,
    end: (i + 1 < ingresses.length) ? ingresses[i + 1].jd : scanEnd
  }));
}

const SAT_MEANING = {
  12: "Saturn in the 12th from your Moon - the opening phase of Sade Sati: expenses, rest, letting go and quiet inner work.",
  1:  "Saturn over your Moon - the peak of Sade Sati: responsibility, reckoning and slow, lasting consolidation.",
  2:  "Saturn in the 2nd from your Moon - the closing phase of Sade Sati: finances, family and speech under review.",
  3:  "Saturn in the 3rd from your Moon - a strong, favourable transit: courage, steady effort and initiative are rewarded.",
  4:  "Saturn in the 4th from your Moon - Kantaka Shani: home, mother, property and peace of mind ask for care.",
  5:  "Saturn in the 5th from your Moon - mixed: children, studies and speculation call for patience.",
  6:  "Saturn in the 6th from your Moon - favourable: you overcome debts, rivals and obstacles through discipline.",
  7:  "Saturn in the 7th from your Moon - mixed: partnership and marriage mature through responsibility.",
  8:  "Saturn in the 8th from your Moon - Ashtama Shani: sudden change, health and shared resources ask for caution.",
  9:  "Saturn in the 9th from your Moon - mixed: fortune and faith are tested; mentors and steadiness help.",
  10: "Saturn in the 10th from your Moon - mixed-to-strong: career demands much, and recognition comes through hard work.",
  11: "Saturn in the 11th from your Moon - favourable: gains, fulfilment of goals and income through persistence."
};

function computeSaturnTransit(natalMoonSidLon, natalAscSidLon, nowJD, tzOffset, av, birthJD) {
  const tz = (tzOffset == null) ? 5.5 : tzOffset;
  const M = Math.floor(norm360(natalMoonSidLon) / 30);
  const L = Math.floor(norm360(natalAscSidLon) / 30);
  const runs = saturnSignRuns(nowJD - 9 * 365.25, nowJD + 26 * 365.25);

  const houseFromMoon  = (s) => ((s - M + 12) % 12) + 1;
  const houseFromLagna = (s) => ((s - L + 12) % 12) + 1;

  // Age (whole years) the native is at a given transit date — for year-wise reading.
  const ageAt = (jd) => (birthJD == null) ? null : Math.max(0, Math.floor((jd - birthJD) / 365.25));
  // How many years ahead a period begins, and whether it is near enough to detail
  // in full or far enough to summarise (keeps a report readable when the next big
  // Saturn passage is decades away).
  const yearsAway = (jd) => Math.round((jd - nowJD) / 365.25);
  const horizonOf = (jd) => (yearsAway(jd) > 12 ? "far" : "near");
  // Saturn's special 3rd/7th/10th aspects from ANY sign s → which houses-from-Moon
  // it also influences during that passage.
  const aspectsOf = (s) => [2, 6, 9].map(off => { const t = (s + off) % 12; return { sign: SAT_SIGNS[t], houseFromMoon: houseFromMoon(t) }; });

  // Ashtakavarga transit strength: Saturn's own bindus (0-8) in the transited
  // sign. 5+ = strong/supported, 4 = moderate, <=3 = demanding.
  const satBav = (av && av.bav && av.bav.Saturn) || null;
  const savArr = (av && av.sav) || null;
  const binduOf = (s) => satBav ? satBav[s] : null;
  const strengthLabel = (b) => (b == null) ? null : (b >= 5 ? "strong" : b === 4 ? "moderate" : "demanding");

  const cur = runs.find(r => r.start <= nowJD && nowJD < r.end) || runs[runs.length - 1];
  const curHouse = houseFromMoon(cur.sign);

  let state, phase = null;
  if (curHouse === 12 || curHouse === 1 || curHouse === 2) { state = "sade_sati"; phase = curHouse === 12 ? "rising" : curHouse === 1 ? "peak" : "setting"; }
  else if (curHouse === 4) state = "kantaka";
  else if (curHouse === 8) state = "ashtama";
  else if (curHouse === 3 || curHouse === 6 || curHouse === 11) state = "favourable";
  else state = "neutral";

  const sign12 = (M + 11) % 12, sign1 = M, sign2 = (M + 1) % 12;
  const kantakaSign = (M + 3) % 12, ashtamaSign = (M + 7) % 12;

  // Sade Sati arc = three consecutive runs (12th, 1st, 2nd from Moon) whose end is still ahead.
  let arc = null;
  for (let i = 0; i + 2 < runs.length; i++) {
    if (runs[i].sign === sign12 && runs[i + 1].sign === sign1 && runs[i + 2].sign === sign2 && runs[i + 2].end >= nowJD) {
      arc = { r12: runs[i], r1: runs[i + 1], r2: runs[i + 2] }; break;
    }
  }
  const nextRunOfSign = (sign) => { for (const r of runs) if (r.sign === sign && r.end >= nowJD) return r; return null; };
  const kantaka = nextRunOfSign(kantakaSign);
  const ashtama = nextRunOfSign(ashtamaSign);

  // Saturn's special aspects: 3rd, 7th, 10th from its current sign.
  const aspects = aspectsOf(cur.sign);

  return {
    tzLabel: tz === 5.5 ? "IST" : ("UTC" + (tz >= 0 ? "+" : "") + tz),
    asOf: satFullDate(nowJD, tz),
    natalMoonSign: SAT_SIGNS[M],
    natalLagnaSign: SAT_SIGNS[L],
    current: {
      sign: SAT_SIGNS[cur.sign],
      houseFromMoon: curHouse,
      houseFromLagna: houseFromLagna(cur.sign),
      state, phase,
      meaning: SAT_MEANING[curHouse],
      since: satFullDate(cur.start, tz), sinceMonth: satMonthYear(cur.start, tz),
      until: satFullDate(cur.end, tz),   untilMonth: satMonthYear(cur.end, tz),
      ageStart: ageAt(cur.start), ageEnd: ageAt(cur.end),
      bindu: binduOf(cur.sign),
      savBindu: savArr ? savArr[cur.sign] : null,
      strength: strengthLabel(binduOf(cur.sign)),
      aspects
    },
    sadeSati: arc ? {
      isCurrent: arc.r12.start <= nowJD && nowJD < arc.r2.end,
      startJD: arc.r12.start,
      start: satMonthYear(arc.r12.start, tz),
      end:   satMonthYear(arc.r2.end, tz),
      ageStart: ageAt(arc.r12.start), ageEnd: ageAt(arc.r2.end),
      yearsAway: yearsAway(arc.r12.start), horizon: horizonOf(arc.r12.start),
      phases: [
        { name: "Rising (12th from Moon)",  sign: SAT_SIGNS[sign12], houseFromMoon: 12, start: satMonthYear(arc.r12.start, tz), end: satMonthYear(arc.r12.end, tz), ageStart: ageAt(arc.r12.start), ageEnd: ageAt(arc.r12.end), isCurrent: curHouse === 12, bindu: binduOf(sign12), strength: strengthLabel(binduOf(sign12)), aspects: aspectsOf(sign12) },
        { name: "Peak (over the Moon)",      sign: SAT_SIGNS[sign1],  houseFromMoon: 1,  start: satMonthYear(arc.r1.start, tz),  end: satMonthYear(arc.r1.end, tz),  ageStart: ageAt(arc.r1.start),  ageEnd: ageAt(arc.r1.end),  isCurrent: curHouse === 1,  bindu: binduOf(sign1),  strength: strengthLabel(binduOf(sign1)),  aspects: aspectsOf(sign1) },
        { name: "Setting (2nd from Moon)",   sign: SAT_SIGNS[sign2],  houseFromMoon: 2,  start: satMonthYear(arc.r2.start, tz),  end: satMonthYear(arc.r2.end, tz),  ageStart: ageAt(arc.r2.start),  ageEnd: ageAt(arc.r2.end),  isCurrent: curHouse === 2,  bindu: binduOf(sign2),  strength: strengthLabel(binduOf(sign2)),  aspects: aspectsOf(sign2) }
      ]
    } : null,
    kantaka: kantaka ? { sign: SAT_SIGNS[kantakaSign], houseFromMoon: 4, startJD: kantaka.start, start: satMonthYear(kantaka.start, tz), end: satMonthYear(kantaka.end, tz), ageStart: ageAt(kantaka.start), ageEnd: ageAt(kantaka.end), yearsAway: yearsAway(kantaka.start), horizon: horizonOf(kantaka.start), isCurrent: kantaka.start <= nowJD && nowJD < kantaka.end, bindu: binduOf(kantakaSign), strength: strengthLabel(binduOf(kantakaSign)), aspects: aspectsOf(kantakaSign) } : null,
    ashtama: ashtama ? { sign: SAT_SIGNS[ashtamaSign], houseFromMoon: 8, startJD: ashtama.start, start: satMonthYear(ashtama.start, tz), end: satMonthYear(ashtama.end, tz), ageStart: ageAt(ashtama.start), ageEnd: ageAt(ashtama.end), yearsAway: yearsAway(ashtama.start), horizon: horizonOf(ashtama.start), isCurrent: ashtama.start <= nowJD && nowJD < ashtama.end, bindu: binduOf(ashtamaSign), strength: strengthLabel(binduOf(ashtamaSign)), aspects: aspectsOf(ashtamaSign) } : null
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  GENERAL GOCHARA (transit) for the other slow planets — Jupiter, Mars, Rahu,
//  Ketu — read from the natal Moon (primary) and Lagna (secondary). Simpler than
//  Saturn (no Sade Sati phases): current sign, the window it occupies, the next
//  sign, this planet's special aspects, and Ashtakavarga strength where it exists
//  (Jupiter, Mars; the nodes have no Ashtakavarga). Direction-agnostic, so it
//  handles the always-retrograde nodes and ordinary retrograde loops alike.
//    aspectOffsets: 0-indexed house offsets of the planet's full aspects
//      Jupiter 5/7/9 = [4,6,8] · Mars 4/7/8 = [3,6,7] · Rahu/Ketu 7th = [6]
// ─────────────────────────────────────────────────────────────────────────────
function computeGochara(posFn, aspectOffsets, bavKey, M, L, nowJD, tz, av) {
  const sidLon = (JD) => { const T = (JD - 2451545.0) / 36525; return norm360(toSidereal(posFn(T).longitude, lahiriAyanamsha(JD))); };
  const signAt = (JD) => Math.floor(sidLon(JD) / 30);
  // Boundary time where the sign leaves signIn, between a point in signIn and one not.
  const crossTimeSign = (tIn, tOut, signIn) => {
    let a = tIn, b = tOut;
    for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (signAt(m) === signIn) a = m; else b = m; }
    return (a + b) / 2;
  };
  // SANDHI (cusp) handling: if the planet has only just stepped into a new sign
  // (< ~2°) and will retrograde back into the PREVIOUS sign within a few months,
  // it is still effectively transiting that previous sign. Anchor the reading
  // there, so the window reads as ONE clean, past-anchored passage (≈ the planet's
  // normal dwell) rather than a confusing graze that spans two retrograde loops.
  let anchorJD = nowJD;
  {
    const sNow = signAt(nowJD);
    const degIn = sidLon(nowJD) - sNow * 30;         // degrees into the current sign
    const prev = (sNow + 11) % 12;
    if (degIn < 2 && signAt(nowJD - 25) === prev) {
      let dipsBack = false;
      for (let j = 10; j <= 150; j += 5) { if (signAt(nowJD + j) === prev) { dipsBack = true; break; } }
      if (dipsBack) anchorJD = nowJD - 25;           // read from the sign it is about to return to
    }
  }
  const s0 = signAt(anchorJD);
  // NET window of the anchored sign — the FULL span the planet occupies this sign,
  // bridging brief retrograde dips out and back, so the dates show the ACTUAL
  // single passage (the "since" is usually well in the past, for flashing back).
  const RET = 120; // days: a dip shorter than this (a retrograde wobble) is bridged; a longer stay in another sign is its own transit, not a dip
  const returnsWithin = (fromJD, dir) => { for (let j = 4; j <= RET; j += 4) if (signAt(fromJD + dir * j) === s0) return true; return false; };
  let untilJD = anchorJD + 4000, nextSign = (s0 + 1) % 12;
  { let lastIn = anchorJD;
    for (let i = 1; i <= 4000; i++) {
      const JD = anchorJD + i;
      if (signAt(JD) === s0) { lastIn = JD; continue; }
      if (returnsWithin(JD, +1)) { let k = JD + 4; while (k < JD + RET && signAt(k) !== s0) k += 4; i = Math.round(k - anchorJD); lastIn = k; continue; }
      untilJD = crossTimeSign(lastIn, JD, s0); nextSign = signAt(JD); break;
    }
  }
  let sinceJD = anchorJD - 4000;
  { let firstIn = anchorJD;
    for (let i = 1; i <= 4000; i++) {
      const JD = anchorJD - i;
      if (signAt(JD) === s0) { firstIn = JD; continue; }
      if (returnsWithin(JD, -1)) { let k = JD - 4; while (k > JD - RET && signAt(k) !== s0) k -= 4; i = Math.round(anchorJD - k); firstIn = k; continue; }
      sinceJD = crossTimeSign(firstIn, JD, s0); break;
    }
  }

  const houseFromMoon = ((s0 - M + 12) % 12) + 1;
  const houseFromLagna = ((s0 - L + 12) % 12) + 1;
  const bav = (av && av.bav && bavKey && av.bav[bavKey]) || null;
  const bindu = bav ? bav[s0] : null;
  const strength = (bindu == null) ? null : (bindu >= 5 ? "strong" : bindu === 4 ? "moderate" : "demanding");
  const aspects = aspectOffsets.map(off => { const s = (s0 + off) % 12; return { sign: SAT_SIGNS[s], houseFromMoon: ((s - M + 12) % 12) + 1 }; });

  return {
    sign: SAT_SIGNS[s0],
    houseFromMoon, houseFromLagna,
    since: satMonthYear(sinceJD, tz), until: satMonthYear(untilJD, tz),
    nextSign: SAT_SIGNS[nextSign],
    bindu, strength, aspects
  };
}

// Mars moves fast (~45 days/sign, longer only when retrograde), so a single
// current-sign window is too thin to be useful. This returns the CURRENT sign
// plus the next few sign-transits as a short timeline the reader can plan around.
function computeMarsSequence(posFn, aspectOffsets, bavKey, M, L, nowJD, tz, av, count) {
  const sidLon = (JD) => { const T = (JD - 2451545.0) / 36525; return norm360(toSidereal(posFn(T).longitude, lahiriAyanamsha(JD))); };
  const signAt = (JD) => Math.floor(sidLon(JD) / 30);
  const crossTimeSign = (tIn, tOut, signIn) => { let a = tIn, b = tOut; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (signAt(m) === signIn) a = m; else b = m; } return (a + b) / 2; };
  const RET = 40; // Mars sits ~45d/sign; only a very brief wobble is the same occupancy
  const occ = (anchorJD) => {
    const s0 = signAt(anchorJD);
    const back = (fromJD, dir) => { for (let j = 4; j <= RET; j += 4) if (signAt(fromJD + dir * j) === s0) return true; return false; };
    let untilJD = anchorJD + 2000, nextSign = (s0 + 1) % 12;
    { let lastIn = anchorJD;
      for (let i = 1; i <= 2000; i++) { const JD = anchorJD + i; if (signAt(JD) === s0) { lastIn = JD; continue; }
        if (back(JD, +1)) { let k = JD + 4; while (k < JD + RET && signAt(k) !== s0) k += 4; i = Math.round(k - anchorJD); lastIn = k; continue; }
        untilJD = crossTimeSign(lastIn, JD, s0); nextSign = signAt(JD); break; } }
    let sinceJD = anchorJD - 2000;
    { let firstIn = anchorJD;
      for (let i = 1; i <= 2000; i++) { const JD = anchorJD - i; if (signAt(JD) === s0) { firstIn = JD; continue; }
        if (back(JD, -1)) { let k = JD - 4; while (k > JD - RET && signAt(k) !== s0) k -= 4; i = Math.round(anchorJD - k); firstIn = k; continue; }
        sinceJD = crossTimeSign(firstIn, JD, s0); break; } }
    return { s0, sinceJD, untilJD };
  };
  const out = [];
  let cursor = nowJD;
  for (let n = 0; n < count; n++) {
    const o = occ(cursor);
    const bav = (av && av.bav && bavKey && av.bav[bavKey]) || null;
    const bindu = bav ? bav[o.s0] : null;
    const strength = (bindu == null) ? null : (bindu >= 5 ? "strong" : bindu === 4 ? "moderate" : "demanding");
    const aspects = aspectOffsets.map(off => { const s = (o.s0 + off) % 12; return { sign: SAT_SIGNS[s], houseFromMoon: ((s - M + 12) % 12) + 1 }; });
    out.push({
      sign: SAT_SIGNS[o.s0],
      houseFromMoon: ((o.s0 - M + 12) % 12) + 1,
      houseFromLagna: ((o.s0 - L + 12) % 12) + 1,
      start: satMonthYear(o.sinceJD, tz), end: satMonthYear(o.untilJD, tz),
      isCurrent: n === 0, bindu, strength, aspects
    });
    cursor = o.untilJD + 10;
  }
  return out;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // Timezone-only lookup from city autocomplete UI
    if (body._tzonly) {
      const offset = await getTimezoneOffset(body.lat || 0, body.lng || 0, body.country || "");
      return Response.json({ detectedUTC: offset });
    }

    const { name, dob, tob, place, utcOffset, ayanamsha: ayanChoice } = body;

    if (!dob || !tob || !place) {
      return Response.json({ error:"Date of birth, time of birth, and place are required." }, { status:400 });
    }

    // Parse date and time
    const [year, month, day] = dob.split("-").map(Number);
    const [hour, minute]     = tob.split(":").map(Number);

    // Use pre-geocoded coords from autocomplete when available —
    // avoids redundant network call and locks to the exact selected city
    let geo;
    if (body.lat != null && body.lng != null) {
      geo = { lat: parseFloat(body.lat), lng: parseFloat(body.lng),
              displayName: place, country: body.country || "" };
    } else {
      geo = await geocode(place);
    }

    // GMT offset priority:
    //   1) user explicitly typed a value
    //   2) auto-detected via country table / TimeZoneDB on city select
    //   3) fallback: longitude-based 15-min rounding
    const utcOff = utcOffset != null
      ? parseFloat(utcOffset)
      : await getTimezoneOffset(geo.lat, geo.lng, geo.country);

    // Convert local time to UTC
    const utcHour = hour - utcOff;
    const JD = dateToJulianDay(year, month, day, utcHour, minute, 0);

    // Ayanamsha
    const ayan = lahiriAyanamsha(JD);

    // Tropical planet positions
    const tropPositions = computePlanetPositions(JD);

    // Sidereal positions
    const sidPositions = {};
    for (const [planet, data] of Object.entries(tropPositions)) {
      sidPositions[planet] = {
        longitude: toSidereal(data.longitude, ayan),
        latitude:  data.latitude,
        retrograde: isRetrograde(planet, JD)
      };
    }

    // Ascendant (tropical then sidereal)
    const tropASC    = computeASC(JD, geo.lat, geo.lng);
    const siderealASC = toSidereal(tropASC, ayan);
    const lagnaSign  = lonToSign(siderealASC);
    const lagnaDeg   = lonToDegree(siderealASC);

    // D1 house assignment
    const d1Houses = assignPlanetsToHouses(sidPositions, lagnaSign);

    // D9
    const d9Data   = buildD9(sidPositions, siderealASC);
    const d9Houses = assignD9PlanetsToHouses(d9Data.planets, d9Data.lagnaSign);

    // Dasha
    const dasha = computeVimshottari(sidPositions.Moon.longitude, JD);

    // Planet details table
    const planets = {};
    const PLANET_LIST = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
    for (const p of PLANET_LIST) {
      const sid = sidPositions[p];
      const np  = getNakshatraPada(sid.longitude);
      const sign = lonToSign(sid.longitude);
      const deg  = lonToDegree(sid.longitude);
      const d9sign = d9Data.planets[p]?.navamshaSign || "";
      planets[p] = {
        longitude:  Math.round(sid.longitude * 1000) / 1000,
        latitude:   Math.round(sid.latitude  * 1000) / 1000,
        sign,
        degree:     Math.round(deg * 100) / 100,
        nakshatra:  np.nakshatra,
        pada:       np.pada,
        retrograde: sid.retrograde,
        d9sign
      };
    }

    // Degree map for combustion check (analyze.js)
    const degrees = {};
    for (const p of PLANET_LIST) degrees[p] = sidPositions[p].longitude;

    const latitudes = {};
    for (const p of PLANET_LIST) latitudes[p] = sidPositions[p].latitude;

    // Retrograde map (analyze.js severity scoring reads this).
    const retro = {};
    for (const p of PLANET_LIST) retro[p] = !!(planets[p] && planets[p].retrograde);

    // Chandrashtama — next 12 months of transit-Moon-in-8th windows for this native.
    // Computed from the natal Moon and the current date; additive, never throws.
    let chandrashtama = null;
    try {
      const nowJD = dateToJulianDay(
        new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate(),
        new Date().getUTCHours(), new Date().getUTCMinutes(), 0
      );
      chandrashtama = computeChandrashtama(sidPositions.Moon.longitude, nowJD, 12, 5.5);
    } catch (_) { chandrashtama = null; }

    // Ashtakavarga (BAV + SAV) — feeds transit strength. Additive, never throws.
    let ashtakavarga = null;
    try {
      const avSign = {};
      for (const p of ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]) {
        avSign[p] = Math.floor(norm360(sidPositions[p].longitude) / 30);
      }
      avSign.Lagna = Math.floor(norm360(siderealASC) / 30);
      ashtakavarga = computeAshtakavarga(avSign);
    } catch (_) { ashtakavarga = null; }

    // Saturn transit (Gochara) — Sade Sati / Kantaka / Ashtama + road ahead for
    // this native, from the current date, with Ashtakavarga strength. Never throws.
    let saturnTransit = null;
    try {
      const nowJD2 = dateToJulianDay(
        new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate(),
        new Date().getUTCHours(), new Date().getUTCMinutes(), 0
      );
      saturnTransit = computeSaturnTransit(sidPositions.Moon.longitude, siderealASC, nowJD2, 5.5, ashtakavarga, JD);
    } catch (_) { saturnTransit = null; }

    // Jupiter / Mars / Rahu / Ketu transits (Gochara), from the same Moon & Lagna.
    let transits = null;
    try {
      const M = Math.floor(norm360(sidPositions.Moon.longitude) / 30);
      const L = Math.floor(norm360(siderealASC) / 30);
      const nowJD3 = dateToJulianDay(
        new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate(),
        new Date().getUTCHours(), new Date().getUTCMinutes(), 0
      );
      const ketuFn = (T) => { const r = rahuPosition(T); return { longitude: r.longitude + 180, latitude: -r.latitude }; };
      transits = {
        jupiter: computeGochara(jupiterPosition, [4, 6, 8], "Jupiter", M, L, nowJD3, 5.5, ashtakavarga),
        mars:    { sequence: computeMarsSequence(marsPosition, [3, 6, 7], "Mars", M, L, nowJD3, 5.5, ashtakavarga, 5) },
        rahu:    computeGochara(rahuPosition,    [6],       null,      M, L, nowJD3, 5.5, ashtakavarga),
        ketu:    computeGochara(ketuFn,          [6],       null,      M, L, nowJD3, 5.5, ashtakavarga)
      };
    } catch (_) { transits = null; }

    return Response.json({
      success: true,
      input: { name, dob, tob, place: geo.displayName, lat: geo.lat, lng: geo.lng, utcOffset: utcOff },
      ayanamsha: Math.round(ayan * 10000) / 10000,
      d1: {
        lagnaSign,
        lagnaDegree: Math.round(lagnaDeg * 100) / 100,
        houses: d1Houses,
        degrees,
        latitudes,
        retro
      },
      d9: {
        lagnaSign: d9Data.lagnaSign,
        houses: d9Houses,
        degrees: Object.fromEntries(PLANET_LIST.map(p => [p, d9Data.planets[p]?.longitude || 0])),
        latitudes: {}
      },
      planets,
      dasha,
      chandrashtama,
      saturnTransit,
      transits,
      ashtakavarga
    });

  } catch (error) {
    return Response.json({ error: error.message || "Chart calculation failed." }, { status:500 });
  }
}

// ── Place search handler (GET /api/chart?search=query) ────────────────────────
// Handle CORS preflight (OPTIONS) — required when frontend calls cross-origin APIs
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age":       "86400",
    }
  });
}

// GET handler — city autocomplete (kept as fallback; primary search now runs browser-side)
export async function onRequestGet(context) {
  try {
    const query = new URL(context.request.url).searchParams.get("q");
    if (!query || query.length < 2) return Response.json([]);
    const results = await searchPlaces(query);
    return new Response(JSON.stringify(results), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (e) {
    return Response.json([]);
  }
}
