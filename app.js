// ─────────────────────────────────────────────────────────────────────────────
//  Jyotish Precision Analyzer  |  app.js  |  v3.1  (Phase 1 — v2 branch)
//  Changes from v3.0:
//  1. Place-of-birth bug fix — validates stored lat/lng before restoring,
//     sanitises place string to reject error responses saved to localStorage
//  2. Chart theme — light/earthy palette replacing dark background
//  3. D9 explainer — updated to smartphone/OS metaphor
//  4. Dasha intro — updated to season/month metaphor
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "jyotish-v3-inputs";
const HISTORY_KEY = "jyotish-v3-history";

// Client-side timezone lookup — mirrors backend TIMEZONE_BY_COUNTRY
const CLIENT_TZ = {
  IN:5.5,  NP:5.75, LK:5.5,  BD:6,    PK:5,    AF:4.5,  IR:3.5,  MM:6.5,
  TH:7,    VN:7,    KH:7,    LA:7,    MY:8,    SG:8,    PH:8,    ID:7,
  CN:8,    TW:8,    HK:8,    MO:8,    JP:9,    KR:9,    KP:9,    MN:8,
  BT:6,    MV:5,    UZ:5,    KZ:6,    TM:5,    TJ:5,    KG:6,    AZ:4,
  GE:4,    AM:4,    IL:2,    SA:3,    AE:4,    QA:3,    KW:3,    BH:3,
  OM:4,    YE:3,    IQ:3,    SY:2,    LB:2,    JO:2,    PS:2,    TR:3,
  GB:0,    IE:0,    PT:0,    IS:0,    FR:1,    DE:1,    ES:1,    IT:1,
  NL:1,    BE:1,    CH:1,    AT:1,    PL:1,    CZ:1,    SK:1,    HU:1,
  SI:1,    HR:1,    BA:1,    RS:1,    ME:1,    MK:1,    AL:1,    LU:1,
  DK:1,    NO:1,    SE:1,    FI:2,    EE:2,    LV:2,    LT:2,    BY:3,
  UA:2,    MD:2,    RO:2,    BG:2,    GR:2,    CY:2,    RU:3,
  MA:0,    DZ:1,    TN:1,    LY:2,    EG:2,    SD:3,    ET:3,    KE:3,
  TZ:3,    ZA:2,    NG:1,    GH:0,    SN:0,    CI:0,
  BR:-3,   AR:-3,   CL:-3,   UY:-3,   PY:-4,   BO:-4,   PE:-5,   CO:-5,
  EC:-5,   VE:-4,   MX:-6,   CR:-6,   PA:-5,   CU:-5,   JM:-5,   HT:-5,
  DO:-4,   TT:-4,   AU:10,   NZ:12,   FJ:12,   PG:10,
};

const PLANET_GLYPHS = {
  Sun:"☉", Moon:"☽", Mars:"♂", Mercury:"☿", Jupiter:"♃",
  Venus:"♀", Saturn:"♄", Rahu:"☊", Ketu:"☋"
};

const PLANET_LIST = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];

// ── City search state ──────────────────────────────────────────────────────────
let _selectedPlace = null; // { lat, lng, displayName, shortName, utcOffset }
let _searchTimer   = null;

// South Indian chart layout
const SI_LAYOUT = [
  [0,2],[0,3],[1,3],[2,3],
  [3,3],[3,2],[3,1],[3,0],
  [2,0],[1,0],[0,0],[0,1]
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tabs      = document.querySelectorAll(".nav-tab");
const screens   = document.querySelectorAll(".screen");
const genBtn    = document.getElementById("generateBtn");
const genText   = document.getElementById("generateBtnText");
const statusMsg = document.getElementById("statusMsg");
const errorBox  = document.getElementById("errorBox");
const saveBtn   = document.getElementById("saveBtn");
const dlBtn     = document.getElementById("downloadBtn");
const resetBtn  = document.getElementById("resetBtn");

let currentData = null;

// ── TAB ROUTING ────────────────────────────────────────────────────────────────
function switchTab(tabId) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabId));
  screens.forEach(s => s.classList.toggle("active", s.id === tabId));
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const requires = tab.dataset.requires;
    if (requires === "chart" && !currentData?.chart) return;
    if (requires === "analysis" && !currentData?.analysis) return;
    switchTab(tab.dataset.tab);
  });
});

// ── FORM HELPERS ──────────────────────────────────────────────────────────────
function getForm() {
  const placeDisplay = document.getElementById("inputPlaceDisplay");
  return {
    name:      document.getElementById("inputName").value.trim(),
    dob:       document.getElementById("inputDOB").value,
    tob:       document.getElementById("inputTOB").value,
    place:     _selectedPlace?.displayName || (placeDisplay ? placeDisplay.value.trim() : ""),
    lat:       _selectedPlace?.lat     || null,
    lng:       _selectedPlace?.lng     || null,
    country:   _selectedPlace?.country || "",
    utcOffset: _selectedPlace?.utcOffset ?? null,
  };
}

function setStatus(msg, type="") {
  statusMsg.textContent = msg;
  statusMsg.className   = "status-msg" + (type ? ` ${type}` : "");
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearError() { errorBox.classList.add("hidden"); }

// ── PLACE VALIDATION HELPER ────────────────────────────────────────────────────
// Guards against error strings being stored in localStorage as place data.
// The "Unexpected token 'A'" bug was caused by "Access denied" responses from
// Nominatim being saved as the place display name, then JSON.parsed on restore.
function isValidPlaceRecord(s) {
  if (!s || typeof s !== "object") return false;
  const lat = parseFloat(s.lat);
  const lng = parseFloat(s.lng);
  if (!isFinite(lat) || !isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (typeof s.place !== "string" || s.place.length < 2) return false;
  // Reject if place string looks like an error response
  const plLower = s.place.toLowerCase();
  const errorTokens = ["access denied","access den","error","403","401","unexpected","<!doctype","<html"];
  if (errorTokens.some(t => plLower.startsWith(t))) return false;
  return true;
}

// ── MAIN GENERATE FLOW ─────────────────────────────────────────────────────────
genBtn.addEventListener("click", generate);

async function generate() {
  const form = getForm();
  clearError();

  if (!form.dob || !form.tob || !form.place) {
    showError("Please enter date of birth, time of birth, and select a place of birth from the dropdown.");
    return;
  }

  // Extra guard: ensure lat/lng are real numbers before sending to API
  if (!isFinite(parseFloat(form.lat)) || !isFinite(parseFloat(form.lng))) {
    showError("Place of birth not fully resolved. Please clear the place field and select a city from the dropdown list again.");
    return;
  }

  genBtn.disabled = true;
  genText.innerHTML = `<span class="spinner"></span>Calculating chart...`;
  setStatus("Step 1 of 2 — Computing planetary positions via Swiss Ephemeris...", "loading");

  try {
    // Step 1: Chart calculation
    const chartRes = await fetch("/api/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, utcOffset: form.utcOffset ? parseFloat(form.utcOffset) : null })
    });

    if (!chartRes.ok) {
      const body = await chartRes.text().catch(()=>"");
      if (chartRes.status === 405) throw new Error("Chart Worker not found (405). Ensure functions/api/chart.js is deployed in the correct folder in your git repository.");
      throw new Error(`Chart API error ${chartRes.status}: ${body.slice(0,120)}`);
    }
    const chartText = await chartRes.text();
    let chartData;
    try { chartData = JSON.parse(chartText); }
    catch (parseErr) {
      // Surface the raw response to help diagnose the issue
      const preview = chartText.slice(0, 80).replace(/\n/g," ");
      throw new Error(`Chart API returned invalid response. Raw: "${preview}"`);
    }
    if (chartData.error) throw new Error(chartData.error);

    setStatus("Step 2 of 2 — Running precision scoring engine...", "loading");
    genText.innerHTML = `<span class="spinner"></span>Analyzing domains...`;

    // Step 2: Analysis
    const analysisPayload = {
      d1: { lagnaSign: chartData.d1.lagnaSign, houses: chartData.d1.houses, degrees: chartData.d1.degrees, latitudes: chartData.d1.latitudes },
      d9: { lagnaSign: chartData.d9.lagnaSign, houses: chartData.d9.houses, degrees: chartData.d9.degrees, latitudes: chartData.d9.latitudes || {} },
      dashas:    chartData.dasha?.dashas    || null,
      birthDate: form.dob                  || null,
    };

    const analysisRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analysisPayload)
    });

    if (!analysisRes.ok) {
      const body = await analysisRes.text().catch(()=>"");
      if (analysisRes.status === 405) throw new Error("Analysis Worker not found (405). Ensure functions/api/analyze.js is deployed inside the functions/api/ folder in git.");
      throw new Error(`Analysis API error ${analysisRes.status}: ${body.slice(0,120)}`);
    }
    const analysisData = await analysisRes.json();
    if (analysisData.error) throw new Error(analysisData.error);

    currentData = { chart: chartData, analysis: analysisData, form };

    renderChartScreen(chartData);
    renderDashaScreen(chartData);
    renderDomainScreen(analysisData, chartData);
    renderSummaryScreen(analysisData, chartData);
    renderPlanetScreen(chartData);

    tabs.forEach(t => {
      if (t.dataset.requires === "chart" || t.dataset.requires === "analysis") {
        t.disabled = false;
      }
    });

    if (dlBtn) dlBtn.disabled = false;

    setStatus("Chart and analysis complete.", "done");
    switchTab("chartTab");

  } catch (err) {
    showError(err.message || "An unexpected error occurred.");
    setStatus("", "");
  } finally {
    genBtn.disabled = false;
    genText.textContent = "Generate Chart & Insights";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHART SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function renderChartScreen(data) {
  const { d1, d9, planets, ayanamsha } = data;

  const moonNak  = planets.Moon?.nakshatra || "";
  const moonPada = planets.Moon?.pada || "";
  document.getElementById("lagnaBar").innerHTML = `
    <div class="lagna-item"><div class="lagna-key">D1 Lagna</div><div class="lagna-val">${d1.lagnaSign} ${d1.lagnaDegree?.toFixed(1)}°</div></div>
    <div class="lagna-item"><div class="lagna-key">D9 Lagna</div><div class="lagna-val">${d9.lagnaSign}</div></div>
    <div class="lagna-item"><div class="lagna-key">Moon Nakshatra</div><div class="lagna-val">${moonNak} Pada ${moonPada}</div></div>
    <div class="lagna-item"><div class="lagna-key">Ayanamsha</div><div class="lagna-val">Lahiri ${ayanamsha?.toFixed(4)}°</div></div>
    <div class="lagna-item"><div class="lagna-key">Native</div><div class="lagna-val">${data.input?.name || "—"}</div></div>
  `;

  document.getElementById("d1LagnaLabel").textContent = `Lagna: ${d1.lagnaSign}`;
  document.getElementById("d9LagnaLabel").textContent = `Lagna: ${d9.lagnaSign}`;

  const combust   = buildCombustSet(planets);
  const warLosers = buildWarSet(planets);

  renderSIChart("d1ChartWrap", d1.lagnaSign, d1.houses, planets, combust, warLosers, false);
  renderSIChart("d9ChartWrap", d9.lagnaSign, d9.houses, planets, combust, warLosers, true);
}

function buildCombustSet(planets) {
  const orbs = { Moon:7, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15 };
  const combust = new Set();
  if (!planets.Sun) return combust;
  const sunLon = planets.Sun.longitude;
  for (const [p, orb] of Object.entries(orbs)) {
    if (!planets[p]) continue;
    let diff = Math.abs(planets[p].longitude - sunLon);
    if (diff > 180) diff = 360 - diff;
    if (diff <= orb) combust.add(p);
  }
  return combust;
}

function buildWarSet(planets) {
  const warPlanets = ["Mars","Mercury","Jupiter","Venus","Saturn"];
  const losers = new Set();
  for (let i = 0; i < warPlanets.length; i++) {
    for (let j = i+1; j < warPlanets.length; j++) {
      const p1 = warPlanets[i], p2 = warPlanets[j];
      if (!planets[p1] || !planets[p2]) continue;
      let diff = Math.abs(planets[p1].longitude - planets[p2].longitude);
      if (diff > 180) diff = 360 - diff;
      if (diff <= 1.0) {
        losers.add((planets[p1].latitude||0) < (planets[p2].latitude||0) ? p1 : p2);
      }
    }
  }
  return losers;
}

// Dignity helpers
const EXALTATION   = { Sun:"Aries",Moon:"Taurus",Mars:"Capricorn",Mercury:"Virgo",Jupiter:"Cancer",Venus:"Pisces",Saturn:"Libra",Rahu:"Gemini",Ketu:"Sagittarius" };
const DEBILITATION = { Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries",Rahu:"Sagittarius",Ketu:"Gemini" };
const OWN_SIGNS    = { Sun:["Leo"],Moon:["Cancer"],Mars:["Aries","Scorpio"],Mercury:["Gemini","Virgo"],Jupiter:["Sagittarius","Pisces"],Venus:["Taurus","Libra"],Saturn:["Capricorn","Aquarius"],Rahu:[],Ketu:[] };

function getDignity(planet, sign) {
  if (EXALTATION[planet] === sign)             return "ex";
  if (DEBILITATION[planet] === sign)           return "de";
  if ((OWN_SIGNS[planet]||[]).includes(sign))  return "own";
  return "";
}

// ── South Indian chart SVG — LIGHT EARTHY THEME ───────────────────────────────
// Phase 1 change: replaced dark (#07090f) palette with off-white/saffron tones.
// All color changes are isolated here — nothing else in this function changed.
function renderSIChart(containerId, lagnaSign, houses, planets, combustSet, warLosers, isD9) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const SIZE = 400;
  const CELL = SIZE / 4;
  const PAD  = 4;

  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const lagnaIdx = SIGNS.indexOf(lagnaSign);

  const CELL_HOUSE = {
    "0,0":11, "0,1":12, "0,2":1, "0,3":2,
    "1,0":10,                     "1,3":3,
    "2,0":9,                      "2,3":4,
    "3,0":8,  "3,1":7,  "3,2":6, "3,3":5
  };

  const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",`0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("width","100%");

  // ── LIGHT BACKGROUND (was #07090f dark) ──────────────────────────────────
  const bg = document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width", SIZE);
  bg.setAttribute("height", SIZE);
  bg.setAttribute("fill", "#FFF8F0");   // pale saffron
  svg.appendChild(bg);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row===1||row===2)&&(col===1||col===2)) continue;

      const key  = `${row},${col}`;
      const hNum = CELL_HOUSE[key];
      if (!hNum) continue;

      const signInHouse = SIGNS[(lagnaIdx + hNum - 1) % 12];
      const isLagna     = hNum === 1;

      const x = col * CELL;
      const y = row * CELL;

      const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
      rect.setAttribute("x", x + 0.5);
      rect.setAttribute("y", y + 0.5);
      rect.setAttribute("width",  CELL - 1);
      rect.setAttribute("height", CELL - 1);
      // ── Lagna cell: warm amber tint; others: pure white ──────────────────
      rect.setAttribute("fill",   isLagna ? "rgba(180,120,30,0.08)" : "#FFFFFF");
      rect.setAttribute("stroke", isLagna ? "rgba(160,100,20,0.55)" : "rgba(100,75,40,0.18)");
      rect.setAttribute("stroke-width","0.5");
      svg.appendChild(rect);

      // Sign abbreviation — muted brown-gold (was faint gold on dark)
      const signAbbr = signInHouse.substring(0,3).toUpperCase();
      const signTxt  = document.createElementNS("http://www.w3.org/2000/svg","text");
      signTxt.setAttribute("x", x + PAD + 2);
      signTxt.setAttribute("y", y + 11);
      signTxt.setAttribute("font-size","8");
      signTxt.setAttribute("fill","rgba(100,65,10,0.85)");
      signTxt.setAttribute("font-family","Cinzel,serif");
      signTxt.textContent = signAbbr;
      svg.appendChild(signTxt);

      // House number — soft grey (was near-invisible white on dark)
      const hTxt = document.createElementNS("http://www.w3.org/2000/svg","text");
      hTxt.setAttribute("x", x + CELL - PAD - 4);
      hTxt.setAttribute("y", y + 11);
      hTxt.setAttribute("font-size","8");
      hTxt.setAttribute("fill","rgba(0,0,0,0.55)");
      hTxt.setAttribute("text-anchor","end");
      hTxt.textContent = hNum;
      svg.appendChild(hTxt);

      // Lagna ASC marker
      if (isLagna) {
        const lTxt = document.createElementNS("http://www.w3.org/2000/svg","text");
        lTxt.setAttribute("x", x + CELL/2);
        lTxt.setAttribute("y", y + CELL - 6);
        lTxt.setAttribute("font-size","8");
        lTxt.setAttribute("fill","rgba(140,85,15,0.65)");
        lTxt.setAttribute("text-anchor","middle");
        lTxt.textContent = "ASC";
        svg.appendChild(lTxt);
      }

      // Planets in this house
      const planetsHere = (houses[hNum] || []);
      let pY = y + 22;
      planetsHere.forEach(planet => {
        if (pY > y + CELL - 8) return;
        const sign     = isD9 ? (planets[planet]?.d9sign || signInHouse) : signInHouse;
        const dignity  = getDignity(planet, sign);
        const isRetro  = planets[planet]?.retrograde;
        const isCombust= combustSet.has(planet);
        const isWar    = warLosers.has(planet);
        const deg      = planets[planet]?.degree || 0;

        const abbr = planet.substring(0,2);

        // ── Planet colours — dark ink on light background ─────────────────
        // Exalted: deep forest green | Debilitated: deep crimson
        // Own: deep indigo | Combust: burnt amber | Default: dark slate
        let color = "#2c3248";               // default — dark slate
        if      (dignity === "ex")  color = "#1a6e3c";   // deep green
        else if (dignity === "de")  color = "#8f1a1a";   // deep crimson
        else if (dignity === "own") color = "#1e4a8f";   // deep indigo
        if (isCombust)              color = "#a05c00";   // burnt amber (overrides dignity)

        const pTxt = document.createElementNS("http://www.w3.org/2000/svg","text");
        pTxt.setAttribute("x", x + PAD + 2);
        pTxt.setAttribute("y", pY);
        pTxt.setAttribute("font-size","10");
        pTxt.setAttribute("fill", color);
        pTxt.setAttribute("font-family","Inter,sans-serif");
        pTxt.setAttribute("font-weight","500");

        let label = abbr;
        if (isRetro)   label += "ʀ";
        if (isCombust) label += "☀";
        if (isWar)     label += "⚔";
        if (dignity)   label += ` ${dignity==="ex"?"Ex":dignity==="de"?"De":"Ow"}`;
        label += ` ${Math.round(deg)}°`;

        pTxt.textContent = label;
        svg.appendChild(pTxt);
        pY += 13;
      });
    }
  }

  // Diagonal cross lines for center diamond — muted brown (was faint gold)
  const diag1 = document.createElementNS("http://www.w3.org/2000/svg","line");
  diag1.setAttribute("x1",CELL);  diag1.setAttribute("y1",CELL);
  diag1.setAttribute("x2",3*CELL); diag1.setAttribute("y2",3*CELL);
  diag1.setAttribute("stroke","rgba(100,70,20,0.18)");
  diag1.setAttribute("stroke-width","0.5");
  svg.appendChild(diag1);

  const diag2 = document.createElementNS("http://www.w3.org/2000/svg","line");
  diag2.setAttribute("x1",3*CELL); diag2.setAttribute("y1",CELL);
  diag2.setAttribute("x2",CELL);   diag2.setAttribute("y2",3*CELL);
  diag2.setAttribute("stroke","rgba(100,70,20,0.18)");
  diag2.setAttribute("stroke-width","0.5");
  svg.appendChild(diag2);

  wrap.innerHTML = "";
  wrap.appendChild(svg);
}

// ══════════════════════════════════════════════════════════════════════════════
//  DASHA SCREEN
// ══════════════════════════════════════════════════════════════════════════════

const FUNCTIONAL_STATUS_MAP = {
  Aries:      {Sun:"N",Moon:"B",Mars:"Y",Mercury:"N",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
  Taurus:     {Sun:"M",Moon:"N",Mars:"M",Mercury:"N",Jupiter:"N",Venus:"B",Saturn:"Y",Rahu:"N",Ketu:"N"},
  Gemini:     {Sun:"M",Moon:"M",Mars:"M",Mercury:"Y",Jupiter:"B",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Cancer:     {Sun:"B",Moon:"N",Mars:"Y",Mercury:"M",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
  Leo:        {Sun:"N",Moon:"M",Mars:"Y",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"M",Rahu:"N",Ketu:"N"},
  Virgo:      {Sun:"M",Moon:"M",Mars:"M",Mercury:"N",Jupiter:"B",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Libra:      {Sun:"M",Moon:"M",Mars:"M",Mercury:"B",Jupiter:"N",Venus:"N",Saturn:"Y",Rahu:"N",Ketu:"N"},
  Scorpio:    {Sun:"M",Moon:"B",Mars:"Y",Mercury:"N",Jupiter:"M",Venus:"M",Saturn:"M",Rahu:"N",Ketu:"N"},
  Sagittarius:{Sun:"N",Moon:"M",Mars:"M",Mercury:"M",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
  Capricorn:  {Sun:"M",Moon:"M",Mars:"Y",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Aquarius:   {Sun:"M",Moon:"M",Mars:"N",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
  Pisces:     {Sun:"M",Moon:"N",Mars:"M",Mercury:"N",Jupiter:"B",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
};

const PLANET_GLYPHS_FULL = { Sun:"☉",Moon:"☽",Mars:"♂",Mercury:"☿",Jupiter:"♃",Venus:"♀",Saturn:"♄",Rahu:"☊",Ketu:"☋" };

function renderDashaScreen(data) {
  const { dasha, d1 } = data;
  if (!dasha || !dasha.dashas) return;
  const lagna = d1.lagnaSign;
  const today = new Date().toISOString().split("T")[0];

  let currentMaha = null, currentAntar = null;
  for (const d of dasha.dashas) {
    if (d.startDate <= today && today < d.endDate) {
      currentMaha = d;
      for (const a of d.antarDasas || []) {
        if (a.startDate <= today && today < a.endDate) { currentAntar = a; break; }
      }
      break;
    }
  }

  const cdEl = document.getElementById("currentDashaDisplay");
  if (cdEl && currentMaha) {
    const mahaFS   = FUNCTIONAL_STATUS_MAP[lagna]?.[currentMaha.lord] || "N";
    const mahaNote = mahaFS==="Y"?"This planet is a yogakaraka for your lagna — a powerful season in your life."
                   : mahaFS==="B"?"This planet is a functional benefic for your lagna — this season generally favours growth."
                   : mahaFS==="M"?"This planet is a functional malefic for your lagna — this season may bring tests that require patience."
                   : "This planet is neutral for your lagna — mixed results, shaped by the sub-periods.";
    cdEl.innerHTML = `
      <div class="current-dasha-display">
        <div class="cd-block">
          <div class="cd-label">Maha Dasa (Major Period / Season)</div>
          <div class="cd-lord">${PLANET_GLYPHS_FULL[currentMaha.lord] || ""} ${currentMaha.lord}</div>
          <div class="cd-dates">${currentMaha.startDate} → ${currentMaha.endDate}</div>
          <div class="cd-note">${mahaNote}</div>
        </div>
        <div class="cd-block">
          <div class="cd-label">Antar Dasa (Sub-Period / Month within the Season)</div>
          <div class="cd-lord">${currentAntar ? (PLANET_GLYPHS_FULL[currentAntar.lord]||"") + " " + currentAntar.lord : "—"}</div>
          <div class="cd-dates">${currentAntar ? currentAntar.startDate + " → " + currentAntar.endDate : "—"}</div>
          <div class="cd-note">${currentAntar ? "The Antar Dasa planet colours the specific events unfolding now within the broader season." : ""}</div>
        </div>
        <div class="cd-block">
          <div class="cd-label">Moon Nakshatra</div>
          <div class="cd-lord">${dasha.nakshatra}</div>
          <div class="cd-dates">Dasa starts with: ${dasha.nakshataLord}</div>
          <div class="cd-note">The Moon's nakshatra at birth determines the starting point of your Vimshottari Dasha sequence.</div>
        </div>
      </div>
    `;
  }

  const timeline = document.getElementById("dashaTimeline");
  if (!timeline) return;
  timeline.innerHTML = "";

  const nowMs   = new Date().getTime();

  dasha.dashas.forEach(d => {
    const isCurrent = d.startDate <= today && today < d.endDate;
    const dStart = new Date(d.startDate).getTime();
    const dEnd   = new Date(d.endDate).getTime();
    const dLen   = dEnd - dStart;

    let progress = 0;
    if (isCurrent) progress = Math.max(0,Math.min(100,((nowMs - dStart) / dLen) * 100));
    else if (dEnd < nowMs) progress = 100;

    const fs = FUNCTIONAL_STATUS_MAP[lagna]?.[d.lord] || "N";
    const fsLabel = fs==="Y"?"Yogakaraka ★":fs==="B"?"Benefic":fs==="M"?"Malefic":"Neutral";

    const row = document.createElement("div");
    row.className = "dasha-row" + (isCurrent ? " current" : "");
    row.innerHTML = `
      <div class="dasha-header">
        <div class="dasha-planet-glyph">${PLANET_GLYPHS_FULL[d.lord]||""}</div>
        <div>
          <div class="dasha-lord">${d.lord}</div>
          <div style="font-size:11px;color:var(--text-dim)">${fsLabel}</div>
        </div>
        <div class="dasha-dates">${d.startDate}<br>${d.endDate}</div>
        <div class="dasha-years">${d.years} yrs</div>
        <div class="dasha-expand">${isCurrent?"▼":"▶"}</div>
      </div>
      <div class="dasha-bar-wrap"><div class="dasha-bar" style="width:${progress}%"></div></div>
      <div class="antar-list">
        ${(d.antarDasas||[]).map(a => {
          const isCurAntar = a.startDate <= today && today < a.endDate;
          return `<div class="antar-item${isCurAntar?" current-antar":""}">
            <div class="antar-lord">${PLANET_GLYPHS_FULL[a.lord]||""} ${a.lord}</div>
            <div class="antar-dates">${a.startDate} → ${a.endDate}</div>
            <div class="antar-yrs">${a.years} yrs</div>
          </div>`;
        }).join("")}
      </div>
    `;

    const header = row.querySelector(".dasha-header");
    header.addEventListener("click", () => row.classList.toggle("open"));
    if (isCurrent) row.classList.add("open");

    timeline.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  DOMAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function verdictClass(v) {
  if (!v) return "forming";
  const k = v.toLowerCase();
  if (k.includes("full flow"))        return "stable";
  if (k.includes("needs tending"))    return "vulnerable";
  if (k.includes("peak comes"))       return "early";
  if (k.includes("deferred"))         return "delayed";
  if (k.includes("foundation holds")) return "moderate";
  if (k.includes("ripening"))         return "ripening";
  if (k.includes("still forming"))    return "forming";
  if (k.includes("stable"))           return "stable";
  if (k.includes("vulnerable"))       return "vulnerable";
  if (k.includes("early"))            return "early";
  if (k.includes("delayed")||k.includes("improving")) return "delayed";
  if (k.includes("moderate"))         return "moderate";
  return "forming";
}

function renderDomainScreen(analysis, chart) {
  const { domains, statements, chartOpening, classification, eventFlags } = analysis;
  if (!domains) return;

  if (chartOpening) {
    const block   = document.getElementById('chartOpeningBlock');
    const badge   = document.getElementById('coPatternBadge');
    const opening = document.getElementById('coOpeningText');
    const axis    = document.getElementById('coAxisText');
    const mod     = document.getElementById('coModifierText');

    const primary   = classification?.primaryPattern;
    const secondary = classification?.secondaryPattern;
    const dominant  = classification?.dominantPlanet;

    badge.innerHTML = [
      primary   ? `<span class="co-badge co-badge-${primary.name.toLowerCase()}">${primary.name}</span>` : '',
      secondary ? `<span class="co-badge co-badge-secondary">${secondary.name}</span>` : '',
      dominant  ? `<span class="co-badge co-badge-planet">${dominant} dominant</span>` : '',
    ].filter(Boolean).join('');

    opening.textContent = chartOpening.opening   || '';
    axis.textContent    = chartOpening.axisLine  || '';
    mod.textContent     = chartOpening.modifier  || '';
    block.classList.remove('hidden');
  }

  const vGrid = document.getElementById('verdictSummary');
  vGrid.innerHTML = domains.map(d => `
    <div class="verdict-mini vm-${verdictClass(d.verdict)}" title="${d.verdict}">
      <div class="vm-title">${d.title.replace(' & ',' &amp; ')}</div>
      <div class="vm-verdict">${d.verdict}</div>
    </div>
  `).join('');

  const container = document.getElementById('domainCards');
  container.innerHTML = '';

  domains.forEach((d, i) => {
    const stmt = statements?.statements?.[i] || null;
    const vc   = verdictClass(d.verdict);

    const card = document.createElement('div');
    card.className = `domain-card reading-card ${vc}`;

    const confColor = { High: 'var(--stable)', Medium: 'var(--accent-gold)', Low: 'var(--vuln)' };
    const cColor = confColor[stmt?.confidence] || 'var(--text-muted)';
    const confDots = stmt?.confidence
      ? `<span class="conf-dots" style="color:${cColor}">${stmt.confidence==='High'?'●●●':stmt.confidence==='Medium'?'●●○':'●○○'}</span>`
      : '';

    const windowHTML = stmt?.windowSummary
      ? `<div class="rc-section">
           <div class="rc-label">⏱ Activation Window</div>
           <div class="rc-window">${stmt.windowSummary}</div>
         </div>`
      : '';

    const cautionsHTML = stmt?.cautions?.length
      ? `<div class="rc-section">
           <div class="rc-label">⚠ Caution${stmt.cautions.length > 1 ? 's' : ''}</div>
           ${stmt.cautions.map(c => `<div class="rc-caution">${c}</div>`).join('')}
         </div>`
      : '';

    const yogas = [...new Set(
      (d.reasons||[]).filter(r=>r.startsWith('[YOGA]'))
        .map(r => r.replace('[YOGA] ','').split(':')[0].trim())
    )];
    const yogaHTML = yogas.length
      ? `<div class="rc-yoga-badges">${yogas.map(y=>`<span class="yoga-badge">★ ${y}</span>`).join('')}</div>`
      : '';

    card.innerHTML = `
      <div class="rc-header">
        <div class="rc-title">${d.title}</div>
        <div class="rc-verdict-wrap">
          <span class="rc-verdict ${vc}">${d.verdict}</span>
          ${confDots}
        </div>
      </div>

      ${yogaHTML}

      ${stmt ? `
        <div class="rc-section">
          <div class="rc-label">Pattern</div>
          <div class="rc-pattern">${stmt.pattern || ''}</div>
        </div>

        <div class="rc-section rc-indication-block">
          <div class="rc-label">Indication</div>
          <div class="rc-indication">${stmt.indication || ''}</div>
        </div>

        ${windowHTML}
        ${cautionsHTML}

        <div class="rc-confidence-line">
          Confidence: <strong style="color:${cColor}">${stmt.confidence}</strong>
          <span class="rc-conf-reason"> — ${stmt.confidenceReason || ''}</span>
        </div>

      ` : `
        <div class="rc-section">
          <div class="rc-indication">${d.factorOverview || ''}</div>
        </div>
        <div class="rc-section">
          <div class="rc-caution">${d.flagLogic || ''}</div>
        </div>
      `}
    `;

    container.appendChild(card);
  });

  if (eventFlags && eventFlags.length) {
    const block = document.getElementById('eventFlagsBlock');
    const grid  = document.getElementById('eventFlagsGrid');
    block.classList.remove('hidden');

    grid.innerHTML = eventFlags.map(flag => {
      const confColor = { High: 'var(--stable)', Medium: 'var(--accent-gold)', Low: 'var(--vuln)' };
      const cc = confColor[flag.confidence] || 'var(--text-muted)';
      const domainLabel = flag.domain
        ? `<span class="ef-domain-tag">${flag.domain}</span>`
        : `<span class="ef-domain-tag ef-cross">Chart-level</span>`;

      const windowLine = flag.windowLords?.length
        ? `<div class="ef-window">Activates during: ${flag.windowLords.join(', ')} dasha</div>`
        : '';

      return `
        <div class="ef-card">
          <div class="ef-card-header">
            ${domainLabel}
            <span class="ef-conf" style="color:${cc}">${flag.confidence}</span>
          </div>
          <div class="ef-card-title">${flag.title}</div>
          <div class="ef-card-indication">${flag.indication}</div>
          ${flag.caution ? `<div class="ef-card-caution">⚠ ${flag.caution}</div>` : ''}
          ${windowLine}
        </div>
      `;
    }).join('');
  }

  const { compoundPatterns } = analysis;
  if (compoundPatterns && compoundPatterns.length) {
    const cpBlock = document.getElementById('compoundPatternsBlock');
    const cpGrid  = document.getElementById('compoundPatternsGrid');
    if (cpBlock && cpGrid) {
      cpBlock.classList.remove('hidden');

      cpGrid.innerHTML = compoundPatterns.map(p => {
        const confColor = { High: 'var(--stable)', Medium: 'var(--accent-gold)', Low: 'var(--vuln)' };
        const cc = confColor[p.confidence] || 'var(--text-muted)';
        const icon = p.risk_note ? '⚡' : p.sensitivity_note ? '◈' : p.stability_note ? '✦' : '◉';
        const tagClass = p.risk_note ? 'cp-tag-risk' : p.sensitivity_note ? 'cp-tag-sensitive' : p.stability_note ? 'cp-tag-stable' : 'cp-tag-neutral';
        const tagText  = p.risk_note ? 'Risk signal' : p.sensitivity_note ? 'Sensitive' : p.stability_note ? 'Positive' : 'Pattern';

        const windowLine = p.windowLords?.length
          ? `<div class="cp-window">Activation: ${p.windowLords.join(' → ')} dasha</div>`
          : '';

        const condBar = `<div class="cp-cond-bar" title="${p.conditionsMet} of ${p.totalConditions} indicators present">
          ${Array.from({length: p.totalConditions}, (_,i) =>
            `<span class="cp-cond-dot ${i < p.conditionsMet ? 'cp-cond-on' : 'cp-cond-off'}"></span>`
          ).join('')}
          <span class="cp-cond-label">${p.conditionsMet}/${p.totalConditions} indicators</span>
        </div>`;

        return `
          <div class="cp-card ${p.risk_note?'cp-risk':p.stability_note?'cp-stable':''}">
            <div class="cp-card-header">
              <span class="cp-icon">${icon}</span>
              <span class="cp-domain-tag ${tagClass}">${tagText} · ${p.domain || 'Chart-level'}</span>
              <span class="cp-conf" style="color:${cc}">${p.confidence}</span>
            </div>
            <div class="cp-card-title">${p.title}</div>
            ${condBar}
            <div class="cp-indication">${p.indication}</div>
            ${p.caution ? `<div class="cp-caution">⚠ ${p.caution}</div>` : ''}
            ${windowLine}
          </div>
        `;
      }).join('');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUMMARY SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function renderSummaryScreen(analysis, chart) {
  const { summary, domains } = analysis;
  const { dasha, d1 } = chart;

  document.getElementById("summaryOverall").innerHTML = `
    <div class="card-title">Overall chart pattern</div>
    <div class="so-pattern">${summary?.overallPattern || ""}</div>
  `;

  document.getElementById("summaryEarlyText").textContent = summary?.earlyLife  || "";
  document.getElementById("summaryLaterText").textContent = summary?.laterLife  || "";

  const allYogas = [];
  (domains||[]).forEach(d => {
    (d.reasons||[]).filter(r=>r.startsWith("[YOGA]")).forEach(r => {
      const text = r.replace("[YOGA] ","");
      const name = text.split(":")[0].trim();
      if (!allYogas.find(y=>y.name===name)) allYogas.push({ name, reason: text });
    });
  });
  const yogaList = document.getElementById("summaryYogasList");
  if (allYogas.length) {
    yogaList.innerHTML = allYogas.map(y => `
      <div class="yoga-item">
        <div>
          <div class="yoga-name">★ ${y.name}</div>
          <div class="yoga-reason">${y.reason}</div>
        </div>
      </div>
    `).join("");
  } else {
    yogaList.innerHTML = `<div class="card-body">No major yogas detected in this chart.</div>`;
  }

  const today = new Date().toISOString().split("T")[0];
  let currentMaha = null, currentAntar = null;
  if (dasha?.dashas) {
    for (const d of dasha.dashas) {
      if (d.startDate <= today && today < d.endDate) {
        currentMaha = d;
        for (const a of d.antarDasas||[]) {
          if (a.startDate <= today && today < a.endDate) { currentAntar = a; break; }
        }
        break;
      }
    }
  }
  const dashaEl = document.getElementById("summaryDashaText");
  if (currentMaha && d1?.lagnaSign) {
    const fs = FUNCTIONAL_STATUS_MAP[d1.lagnaSign]?.[currentMaha.lord] || "N";
    const fsDesc = fs==="Y"?"a yogakaraka — a uniquely powerful season for your lagna, capable of elevating life circumstances significantly."
                 : fs==="B"?"a functional benefic for your lagna — this season generally supports growth and positive outcomes."
                 : fs==="M"?"a functional malefic for your lagna — this season may bring delays, challenges, or karmic tests that require patience."
                 : "functionally neutral for your lagna — results will be mixed and shaped by the sub-periods and transits.";
    const antarDesc = currentAntar ? ` Within this, the ${currentAntar.lord} Antar Dasa (ending ${currentAntar.endDate}) further narrows the focus — the qualities of ${currentAntar.lord} colour the specific events unfolding right now.` : "";
    dashaEl.innerHTML = `<div class="card-body">You are currently in the <strong>${currentMaha.lord} Maha Dasa</strong>, running until ${currentMaha.endDate}. ${currentMaha.lord} is ${fsDesc}${antarDesc}</div>`;
  } else {
    dashaEl.innerHTML = `<div class="card-body">Generate a chart to see your current dasha reading.</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PLANET SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function renderPlanetScreen(data) {
  const { planets, d1 } = data;
  if (!planets) return;
  const lagna   = d1.lagnaSign;
  const combust = buildCombustSet(planets);
  const warLosers = buildWarSet(planets);

  const container = document.getElementById("planetCards");
  container.innerHTML = "";

  PLANET_LIST.forEach(planet => {
    const p = planets[planet];
    if (!p) return;
    const dignity = getDignity(planet, p.sign);
    const isC = combust.has(planet);
    const isW = warLosers.has(planet);
    const fs  = FUNCTIONAL_STATUS_MAP[lagna]?.[planet] || "N";
    const fsLabel = fs==="Y"?"Yogakaraka ★":fs==="B"?"Benefic":fs==="M"?"Malefic":"Neutral";
    const dignityLabel = dignity==="ex"?"Exalted":dignity==="de"?"Debilitated":dignity==="own"?"Own sign":"—";
    const dignityClass = dignity==="ex"?"exalted":dignity==="de"?"debilitated":dignity==="own"?"own":"";

    const card = document.createElement("div");
    card.className = "planet-card";
    card.innerHTML = `
      <div class="pc-header">
        <div class="pc-name">${planet}</div>
        <div class="pc-glyph">${PLANET_GLYPHS_FULL[planet]||""}</div>
      </div>
      <div class="pc-row"><span class="pc-key">Sign (D1)</span><span class="pc-val">${p.sign}</span></div>
      <div class="pc-row"><span class="pc-key">Degree</span><span class="pc-val">${p.degree?.toFixed(2)}° in ${p.sign}</span></div>
      <div class="pc-row"><span class="pc-key">D9 sign</span><span class="pc-val">${p.d9sign || "—"}</span></div>
      <div class="pc-row"><span class="pc-key">Nakshatra</span><span class="pc-val">${p.nakshatra} Pada ${p.pada}</span></div>
      <div class="pc-row"><span class="pc-key">Dignity</span><span class="pc-val ${dignityClass}">${dignityLabel}</span></div>
      <div class="pc-row"><span class="pc-key">For ${lagna} lagna</span><span class="pc-val${fs==="Y"?" yogakaraka":fs==="M"?" retrograde":""}">${fsLabel}</span></div>
      <div class="pc-row"><span class="pc-key">Retrograde</span><span class="pc-val ${p.retrograde?"retrograde":""}">${p.retrograde ? "Yes ℞" : "No"}</span></div>
      ${isC ? `<div class="pc-row"><span class="pc-key">Combustion</span><span class="pc-val combust">Combust ☀ (−1 penalty)</span></div>` : ""}
      ${isW ? `<div class="pc-row"><span class="pc-key">Planetary war</span><span class="pc-val combust">Defeated ⚔ (−1 penalty)</span></div>` : ""}
    `;
    container.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  LOCAL STORAGE — SAVE / HISTORY
// ══════════════════════════════════════════════════════════════════════════════

function saveInputs() {
  const f = getForm();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

function restoreInputs() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  let s;
  try { s = JSON.parse(raw); }
  catch {
    // Corrupted localStorage — clear it and start fresh
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const set = (id, v) => { const el=document.getElementById(id); if(el&&v) el.value=v; };
  set("inputName", s.name);
  set("inputDOB",  s.dob);
  set("inputTOB",  s.tob);

  // ── PLACE BUG FIX ─────────────────────────────────────────────────────────
  // Only restore place if lat/lng are genuine finite numbers AND the place
  // string doesn't look like an error response that was accidentally stored.
  if (isValidPlaceRecord(s)) {
    const plDisp   = document.getElementById("inputPlaceDisplay");
    const plSearch = document.getElementById("inputPlaceSearch");
    const clearBtn = document.getElementById("placeClearBtn");

    if (plDisp)   plDisp.value = s.place;
    const shortName = s.place.split(",").slice(0,3).join(",").trim();
    if (plSearch) {
      _suppressSearch = true;
      plSearch.value  = shortName;
      _suppressSearch = false;
    }
    if (clearBtn) clearBtn.style.display = "inline-flex";

    _selectedPlace = {
      displayName: s.place,
      lat:         parseFloat(s.lat),
      lng:         parseFloat(s.lng),
      country:     s.country || "",
      shortName,
      utcOffset:   s.utcOffset != null ? parseFloat(s.utcOffset) : (CLIENT_TZ[s.country] ?? null)
    };
    showPlaceConfirmed(shortName, _selectedPlace.utcOffset);
  }
}

function getHistory() {
  try { const r=localStorage.getItem(HISTORY_KEY); return r?JSON.parse(r):[]; } catch { return []; }
}

function saveToHistory() {
  if (!currentData) return;
  const f = currentData.form;
  const c = currentData.chart;
  const entry = {
    id:       Date.now().toString(),
    name:     f.name || "Unnamed",
    savedAt:  new Date().toISOString(),
    dob:      f.dob,
    tob:      f.tob,
    place:    f.place,
    country:  _selectedPlace?.country || "",
    utcOffset:f.utcOffset,
    lat:      f.lat,
    lng:      f.lng,
    d1Lagna:  c.d1?.lagnaSign || "",
    d9Lagna:  c.d9?.lagnaSign || ""
  };
  const hist = getHistory();
  hist.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0,25)));
  renderHistory();
}

function renderHistory() {
  const box  = document.getElementById("historyBox");
  const hist = getHistory();
  if (!hist.length) { box.className="history-empty"; box.textContent="No saved charts yet."; return; }
  box.className="";
  box.innerHTML = hist.map(h => `
    <div class="history-item">
      <div class="history-main">
        <div class="history-name">${h.name}</div>
        <div class="history-meta">${h.dob} · ${h.tob} · ${h.place}</div>
        <div class="history-meta">D1: ${h.d1Lagna} · D9: ${h.d9Lagna} · Saved ${new Date(h.savedAt).toLocaleDateString()}</div>
      </div>
      <div class="history-actions">
        <button class="btn-sm-ghost hist-load" data-id="${h.id}">Load</button>
        <button class="btn-sm-danger hist-del" data-id="${h.id}">×</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll(".hist-load").forEach(btn => btn.addEventListener("click", () => loadHistory(btn.dataset.id)));
  box.querySelectorAll(".hist-del").forEach(btn => btn.addEventListener("click", () => deleteHistory(btn.dataset.id)));
}

function loadHistory(id) {
  const h = getHistory().find(x=>x.id===id);
  if (!h) return;
  const set=(el,v)=>{ if(el&&v!=null) el.value=v; };
  set(document.getElementById("inputName"), h.name);
  set(document.getElementById("inputDOB"),  h.dob);
  set(document.getElementById("inputTOB"),  h.tob);

  const plDisp   = document.getElementById("inputPlaceDisplay");
  const plSearch = document.getElementById("inputPlaceSearch");
  const clearBtn = document.getElementById("placeClearBtn");

  // ── PLACE BUG FIX — same guard as restoreInputs ───────────────────────────
  if (isValidPlaceRecord(h)) {
    if (plDisp)   plDisp.value = h.place;
    const shortName = h.place.split(",").slice(0,3).join(",").trim();
    if (plSearch) { _suppressSearch = true; plSearch.value = shortName; _suppressSearch = false; }
    if (clearBtn) clearBtn.style.display = "inline-flex";
    _selectedPlace = {
      displayName: h.place,
      lat:         parseFloat(h.lat),
      lng:         parseFloat(h.lng),
      country:     h.country || "",
      shortName,
      utcOffset:   h.utcOffset != null ? parseFloat(h.utcOffset) : (CLIENT_TZ[h.country] ?? null)
    };
    showPlaceConfirmed(shortName, _selectedPlace.utcOffset);
  }
  saveInputs();
}

function deleteHistory(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(x=>x.id!==id)));
  renderHistory();
}

// ── Button events ─────────────────────────────────────────────────────────────
saveBtn.addEventListener("click", () => {
  saveInputs();
  saveToHistory();
  const txt = saveBtn.textContent;
  saveBtn.textContent = "Saved ✓";
  setTimeout(() => saveBtn.textContent = txt, 1400);
});

resetBtn.addEventListener("click", () => {
  if (confirm("Reset all inputs and clear current chart?")) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
});

dlBtn.addEventListener("click", () => {
  if (!currentData) return;
  const html = buildHTMLReport(currentData);
  const blob  = new Blob(["\uFEFF",html], { type:"application/msword" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href = url;
  a.download = `jyotish-${currentData.form?.name||"chart"}-${currentData.form?.dob||"report"}.doc`;
  a.click();
  URL.revokeObjectURL(url);
});

function buildHTMLReport(data) {
  const { chart, analysis, form } = data;
  const { summary, domains } = analysis;
  return `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>Jyotish Report</title>
  <style>body{font-family:Arial,sans-serif;color:#222;line-height:1.6}h1,h2,h3{color:#1a2a4a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#f0f4fa}.yoga{color:#7a5b00;font-style:italic}.disclaimer{font-size:11px;color:#888;border-top:1px solid #ccc;margin-top:40px;padding-top:12px}</style>
  </head><body>
  <h1>Jyotish Precision Analyzer — Birth Chart Report</h1>
  <p><strong>Native:</strong> ${form.name||"—"} &nbsp;|&nbsp; <strong>DOB:</strong> ${form.dob} &nbsp;|&nbsp; <strong>TOB:</strong> ${form.tob} &nbsp;|&nbsp; <strong>Place:</strong> ${form.place}</p>
  <p><strong>D1 Lagna:</strong> ${chart.d1?.lagnaSign} &nbsp;|&nbsp; <strong>D9 Lagna:</strong> ${chart.d9?.lagnaSign} &nbsp;|&nbsp; <strong>Ayanamsha:</strong> Lahiri ${chart.ayanamsha}°</p>
  <h2>Summary</h2>
  <p>${summary?.overallPattern}</p><p>${summary?.earlyLife}</p><p>${summary?.laterLife}</p>
  <h2>Domain Analysis</h2>
  <table><tr><th>Domain</th><th>D1</th><th>D9</th><th>Verdict</th></tr>
  ${(domains||[]).map(d=>`<tr><td>${d.title}</td><td>${d.d1Strength}</td><td>${d.d9Strength}</td><td>${d.verdict}</td></tr>`).join("")}
  </table>
  ${(domains||[]).map(d=>`
    <h3>${d.title}</h3>
    <p><strong>Verdict:</strong> ${d.verdict}</p>
    <p>${d.factorOverview}</p>
    <ul>${(d.reasons||[]).map(r=>`<li${r.startsWith("[YOGA]")?' class="yoga"':''}>${r.replace(/^\[.+?\] /,"")}</li>`).join("")}</ul>
  `).join("")}
  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report provides astrological analysis for educational and self-reflective purposes only. It is not a substitute for medical, psychological, legal, or financial advice. All interpretations are indicative in nature.<br>
    Generated by Jyotish Precision Analyzer · Swiss Ephemeris · Lahiri Ayanamsha · Parashari Jyotish · © 2025 All rights reserved.
  </div>
  </body></html>`;
}

// ── Auto-save inputs on change ────────────────────────────────────────────────
document.querySelectorAll("input,select").forEach(el => {
  el.addEventListener("change", saveInputs);
  el.addEventListener("input",  saveInputs);
});

// ── City search autocomplete ──────────────────────────────────────────────────

let _suppressSearch = false;

function initCitySearch() {
  const input    = document.getElementById("inputPlaceSearch");
  const dropdown = document.getElementById("placeDropdown");
  const display  = document.getElementById("inputPlaceDisplay");
  const clearBtn = document.getElementById("placeClearBtn");
  const utcEl    = document.getElementById("detectedUTC");
  if (!input || !dropdown) return;

  input.addEventListener("input", () => {
    if (_suppressSearch) return;
    const q = input.value.trim();
    clearTimeout(_searchTimer);
    if (q.length < 2) { dropdown.innerHTML = ""; dropdown.style.display = "none"; return; }
    _searchTimer = setTimeout(() => fetchCitySuggestions(q), 320);
  });

  input.addEventListener("keydown", e => {
    const items  = dropdown.querySelectorAll(".place-item");
    const active = dropdown.querySelector(".place-item.active");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = active ? active.nextElementSibling : items[0];
      if (next) { active?.classList.remove("active"); next.classList.add("active"); }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = active ? active.previousElementSibling : items[items.length-1];
      if (prev) { active?.classList.remove("active"); prev.classList.add("active"); }
    } else if (e.key === "Enter" && active) {
      e.preventDefault();
      active.click();
    } else if (e.key === "Escape") {
      dropdown.style.display = "none";
    }
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".place-search-wrap")) {
      dropdown.style.display = "none";
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      _selectedPlace = null;
      if (input)   input.value   = "";
      if (display) display.value = "";
      if (utcEl)   utcEl.textContent = "";
      clearBtn.style.display = "none";
      dropdown.innerHTML = ""; dropdown.style.display = "none";
      input.focus();
    });
  }
}

async function fetchCitySuggestions(query) {
  const dropdown = document.getElementById("placeDropdown");
  if (!dropdown) return;
  dropdown.innerHTML = `<div class="place-item place-loading">Searching...</div>`;
  dropdown.style.display = "block";
  try {
    const url = `https://nominatim.openstreetmap.org/search`
      + `?q=${encodeURIComponent(query)}`
      + `&format=json&limit=8&addressdetails=1&accept-language=en`;

    const res = await fetch(url, {
      headers: { "User-Agent": "JyotishPrecisionApp/3.1 (astrology chart calculator)" }
    });

    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    const data = await res.json();

    if (!data || !data.length) {
      dropdown.innerHTML = `<div class="place-item place-no-result">No cities found. Try a different spelling or include country.</div>`;
      return;
    }

    const places = data.map(r => ({
      lat:         parseFloat(r.lat),
      lng:         parseFloat(r.lon),
      displayName: r.display_name,
      shortName:   [
        r.address?.city || r.address?.town || r.address?.village || r.name,
        r.address?.state,
        r.address?.country
      ].filter(Boolean).join(", "),
      country: (r.address?.country_code || "").toUpperCase()
    }));

    // Only keep results with valid coordinates
    const validPlaces = places.filter(r => isFinite(r.lat) && isFinite(r.lng) && !(r.lat===0&&r.lng===0));

    if (!validPlaces.length) {
      dropdown.innerHTML = `<div class="place-item place-no-result">No valid locations found. Try again.</div>`;
      return;
    }

    dropdown.innerHTML = validPlaces.map((r, i) => `
      <div class="place-item" data-idx="${i}" data-lat="${r.lat}" data-lng="${r.lng}"
           data-name="${(r.displayName||"").replace(/"/g,"&quot;")}"
           data-short="${(r.shortName||"").replace(/"/g,"&quot;")}"
           data-country="${(r.country||"").toUpperCase()}">
        <span class="pi-name">${r.shortName || r.displayName}</span>
        <span class="pi-country">${r.country || ""}</span>
      </div>
    `).join("");
    dropdown.style.display = "block";
    dropdown.querySelectorAll(".place-item[data-lat]").forEach(item => {
      item.addEventListener("click", () => selectPlace(item));
    });
  } catch (e) {
    dropdown.innerHTML = `<div class="place-item place-no-result">
      Could not reach location service. Check your internet connection, or try again in a moment.
    </div>`;
    console.warn("City search error:", e.message);
  }
}

async function selectPlace(item) {
  const dropdown = document.getElementById("placeDropdown");
  const input    = document.getElementById("inputPlaceSearch");
  const display  = document.getElementById("inputPlaceDisplay");
  const clearBtn = document.getElementById("placeClearBtn");
  const utcEl    = document.getElementById("detectedUTC");

  const lat     = parseFloat(item.dataset.lat);
  const lng     = parseFloat(item.dataset.lng);
  const name    = item.dataset.name;
  const short   = item.dataset.short;
  const country = (item.dataset.country || "").toUpperCase();

  // Validate before storing — prevents bad data entering localStorage
  if (!isFinite(lat) || !isFinite(lng)) {
    console.warn("selectPlace: invalid coordinates, skipping", item.dataset);
    return;
  }

  const utcOffset = CLIENT_TZ[country] ?? null;

  _selectedPlace = { displayName: name, shortName: short, lat, lng, country, utcOffset };

  if (input)    input.value   = short;
  if (display)  display.value = name;
  if (clearBtn) clearBtn.style.display = "inline-flex";

  showPlaceConfirmed(short, utcOffset);
  dropdown.innerHTML = ""; dropdown.style.display = "none";
  saveInputs();
}

function showPlaceConfirmed(name, utcOffset) {
  const utcEl = document.getElementById("detectedUTC");
  if (!utcEl) return;
  const offsetStr = utcOffset != null
    ? `GMT${utcOffset >= 0 ? "+" : ""}${utcOffset}`
    : "GMT offset unknown — enter manually if needed";
  utcEl.innerHTML = `<span class="utc-ok">✓ ${name}</span> <span class="utc-offset">${offsetStr}</span>`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
restoreInputs();
renderHistory();
initCitySearch();
