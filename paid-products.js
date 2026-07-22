// ─────────────────────────────────────────────────────────────────────────────
//  FILE: paid-products.js
//  AstroIndicators — the two engine-powered paid products.
//    1. Life Indicators Report  — flipbook, all customer modules, one AI build, cached
//    2. Instant Clarity Command — pick 3 of 10 questions, instant answer cards
//  Consumes: /api/facts (rule engine) → /api/indicate v2 (guarded narrator)
//  Reuses:   window.startPayment (payments.js), window.AI_chartId, /api/report cache,
//            APP_CONFIG.prices (config.js)
//  Free layer (Hook & Blur): band + teaser visible; timing + proactive step blurred.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";

  // ── the customer 10 (ICC) — each 1:1 with a validated module; fidelity excluded ─
  const ICC_TEN = [
    { id: "MOD-CAREER-BIZEMP",      q: "Am I better suited to business or a job?" },
    { id: "MOD-CAREER-PROMO",       q: "When is my next promotion or career rise?" },
    { id: "MOD-WEALTH-DHANA",       q: "How strong is my wealth potential, and when does it activate?" },
    { id: "MOD-WEALTH-PROPERTY",    q: "Will I own property? How does inheritance unfold?" },
    { id: "MOD-MARRIAGE-LOVE",      q: "Love marriage or arranged — which suits me?" },
    { id: "MOD-MARRIAGE-LIFE",      q: "What will my married life feel like day to day?" },
    { id: "MOD-MARRIAGE-PROGENY",   q: "How are children indicated, and when is planning favourable?" },
    { id: "MOD-MOBILITY-FOREIGN",   q: "Will I settle abroad? When is the favourable window?" },
    { id: "MOD-CRISIS-LITIGATION",  q: "How am I positioned in disputes and legal matters?" },
    { id: "MOD-MOBILITY-BHAGYODAYA",q: "When does my luck rise?" },
  ];
  // Flipbook order: the full customer set, category-grouped
  const BOOK_ORDER = [
    "MOD-CAREER-BIZEMP","MOD-CAREER-STABILITY","MOD-CAREER-PROMO","MOD-WEALTH-DHANA","MOD-WEALTH-PROPERTY",
    "MOD-MARRIAGE-LOVE","MOD-MARRIAGE-LIFE","MOD-MARRIAGE-SEPARATION","MOD-MARRIAGE-PROGENY",
    "MOD-MOBILITY-FOREIGN","MOD-MOBILITY-BHAGYODAYA","MOD-MOBILITY-SPIRITUAL",
    "MOD-CRISIS-LITIGATION","MOD-CRISIS-DEBT","MOD-CRISIS-ENEMIES",
    "MOD-HEALTH-LONGEVITY","MOD-HEALTH-MENTAL",
  ];
  const CATEGORY_LABEL = { CAREER:"Career & Wealth", WEALTH:"Career & Wealth", MARRIAGE:"Marriage & Relationship",
    MOBILITY:"Mobility & Fortune", CRISIS:"Crisis, Debt & Legal", HEALTH:"Health & Wellbeing" };

  let _facts = null;          // cached engine facts for the current chart
  let _factsChartId = null;

  function $(id){ return document.getElementById(id); }
  function esc(s){ const d=document.createElement("div"); d.textContent=String(s??""); return d.innerHTML; }
  function price(key, fallback){ return (window.APP_CONFIG?.prices?.[key]) ?? fallback; }
  function fmtWin(w){ const f=s=>{const d=new Date(s);return d.toLocaleString("en-IN",{month:"short",year:"numeric"});};
    return f(w.start_iso)+" – "+f(w.end_iso); }

  // ── engine facts (fetched once per chart, reused by both products) ──────────
  async function getFacts() {
    const cd = window.currentData;
    if (!cd || !cd.chart) throw new Error("Generate your chart first.");
    const cid = window.AI_chartId ? window.AI_chartId() : "";
    if (_facts && _factsChartId === cid) return _facts;
    const res = await fetch("/api/facts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chart: cd.chart, gender: cd.form?.gender || "unspecified" }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Engine unavailable.");
    _facts = data.facts; _factsChartId = cid;
    return _facts;
  }
  const byId = (facts, id) => facts.find(f => f.module_id === id);


  // ── personalization strip: proves the reading is keyed to THEIR birth data ──
  function fmtDOB(dob, tob) {
    try {
      const [y,m,d] = dob.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m-1, d));
      const day = dt.toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric", timeZone:"UTC" });
      let t = "";
      if (tob) { const [hh,mm] = tob.split(":").map(Number);
        const ap = hh >= 12 ? "PM" : "AM"; const h12 = ((hh + 11) % 12) + 1;
        t = h12 + ":" + String(mm).padStart(2,"0") + " " + ap; }
      return t ? day + " at " + t : day;
    } catch (e) { return dob || ""; }
  }
  function renderPersonalStrip() {
    const f = (window.currentData && window.currentData.form) || {};
    const dob = f.dob || (document.getElementById("inputDOB")||{}).value || "";
    const tob = f.tob || (document.getElementById("inputTOB")||{}).value || "";
    const place = f.place || (document.getElementById("inputPlaceDisplay")||{}).value || "";
    if (!dob) return;
    const html = `<span class="pp-seal">◈</span><span>This reading is calculated from <b>your</b> birth details —
      <b>${esc(fmtDOB(dob, tob))}</b>${place ? `, <b>${esc(place)}</b>` : ""} — not from your sun sign.
      <span class="pp-engine">Every verdict and date below is computed from your chart's own planetary positions
      (Swiss Ephemeris · Lahiri ayanamsa). Change any birth detail and the results change with it.</span></span>`;
    ["liPersonal","iccPersonal"].forEach(id => { const el = $(id); if (el) el.innerHTML = html; });
  }

  // ── HOOK & BLUR teaser (free layer on both product tabs) ────────────────────
  function teaserCard(f, hookLine) {
    const win = f.timing_windows[0];
    return `
    <div class="pp-card">
      <div class="pp-band pp-band-${esc(f.intensity.toLowerCase())}">${esc(f.band.replace(/_/g," "))}</div>
      <div class="pp-q">${esc(f.question)}</div>
      <div class="pp-teaser">${esc(f.teaser)}</div>
      <div class="pp-blur-wrap">
        <div class="pp-blurred">
          ${win ? `<div>◈ ${esc(win.label)}: <b>${esc(fmtWin(win))}</b></div>` : ""}
          <div>◈ ${esc(f.proactive_step.slice(0, 140))}…</div>
        </div>
        <div class="pp-blur-hook">${esc(hookLine)}</div>
      </div>
    </div>`;
  }

  function renderTeasers() {
    renderPersonalStrip();
    getFacts().then(facts => {
      const li = $("liTeasers");
      if (li) li.innerHTML = ["MOD-CAREER-BIZEMP","MOD-WEALTH-DHANA","MOD-MARRIAGE-LIFE","MOD-MOBILITY-BHAGYODAYA"]
        .map(id => byId(facts, id)).filter(Boolean)
        .map(f => teaserCard(f, "Your timing windows and action plan are in the full report")).join("");
      const ic = $("iccPicker");
      if (ic) ic.innerHTML = ICC_TEN.map((t,i) => {
        const f = byId(facts, t.id); if (!f) return "";
        return `<label class="icc-pick"><input type="checkbox" data-mid="${t.id}" onchange="AI_iccLimit(this)">
          <span class="icc-num">${i+1}</span>
          <span class="icc-q">${esc(t.q)}<em class="icc-hint">${esc(f.teaser)}</em></span></label>`;
      }).join("");
    }).catch(e => {
      const msg = `<div class="pp-empty">${esc(e.message)}</div>`;
      if ($("liTeasers")) $("liTeasers").innerHTML = msg;
      if ($("iccPicker")) $("iccPicker").innerHTML = msg;
    });
  }
  window.AI_renderPaidTeasers = renderTeasers;
  window.AI_restoreICC = restoreICC;

  window.AI_iccLimit = function (box) {
    const checked = document.querySelectorAll("#iccPicker input:checked");
    if (checked.length > 3) { box.checked = false; return; }
    const btn = $("iccPayBtn");
    if (btn) btn.textContent = checked.length === 3
      ? `Reveal my 3 answers — ₹${price("icc",499)}`
      : `Pick ${3-checked.length} more question${checked.length===2?"":"s"}`;
    if (btn) btn.disabled = checked.length !== 3;
  };

  // ── narrator call ───────────────────────────────────────────────────────────
  async function narrate(kind, facts) {
    const res = await fetch("/api/indicate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, facts, name: window.currentData?.form?.name || "" }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Narrator unavailable.");
    return data.result;
  }

  // ── product 1: Life Indicators flipbook ─────────────────────────────────────
  async function buildLifeIndicators() {
    const host = $("liBook"); if (!host) return;
    host.innerHTML = `<div class="pp-empty">Preparing your book… (one-time build, then cached)</div>`;
    try {
      const facts = await getFacts();
      const cid = window.AI_chartId();
      // cache first — a paid book is built once per chart, ever
      const cached = await srv({ action:"fetch", chartId: cid, item:"lifeIndicators", lang:"en" });
      let sections = cached && cached.sections;
      if (!sections) {
        const ordered = BOOK_ORDER.map(id => byId(facts, id)).filter(Boolean);
        const out = await narrate("report_section", ordered);
        sections = out.sections || [];
        srv({ action:"store", chartId: cid, item:"lifeIndicators", lang:"en", sections });
      }
      renderFlipbook(host, sections, facts);
    } catch (e) { host.innerHTML = `<div class="pp-empty">${esc(e.message)}</div>`; }
  }

  // ── flipbook renderer: 3D leaf-turn, ported from the approved POC ──────────
  let _book = { pages: [], idx: 0, animating: false, target: 0, meta: "" };

  function renderFlipbook(host, sections, facts) {
    const f0 = (window.currentData && window.currentData.form) || {};
    const cd = window.currentData || {};
    const name = esc(f0.name || "");
    const meta = [f0.dob, f0.tob, f0.place].filter(Boolean).join(" · ");
    _book.meta = meta;
    const P = [];

    // ── 1. cover: branding + disclaimer ──────────────────────────────────────
    P.push(`<div class="pg cover"><div class="frame"></div><div class="in">
      <div class="seal">◈</div>
      <div class="logo" style="margin:10px 0 18px">Astro<span>Indicators</span></div>
      <div class="kick" style="color:var(--ai-gold)">Life Indicators Report</div>
      <h1>The Book of<br>Your Timings</h1>
      <div class="who">${name}</div>
      <div class="disclaim">Indicative astrological insight for reflection and planning — not medical,
      legal, or financial advice, and not a guarantee of outcomes. Every reading here is computed from
      your own birth chart (Swiss Ephemeris · Lahiri ayanamsa).</div>
      </div></div>`);

    // ── 2. birth details ─────────────────────────────────────────────────────
    const d1 = cd.d1 || {}, d9 = cd.d9 || {}, pl = cd.planets || {};
    const row = (k, v) => v ? `<li><b>${esc(k)}</b><i>${esc(v)}</i></li>` : "";
    P.push(`<div class="pg"><div class="kick">Birth Details</div><div class="rule"></div>
      <ul class="toc bdl">
        ${row("Name", f0.name)}
        ${row("Date of birth", f0.dob)}
        ${row("Time of birth", f0.tob)}
        ${row("Place", f0.place)}
        ${row("Ascendant (D1)", d1.lagnaSign ? d1.lagnaSign + " " + (d1.lagnaDegree||0).toFixed(1) + "°" : "")}
        ${row("Navamsa lagna (D9)", d9.lagnaSign)}
        ${row("Moon sign", pl.Moon && pl.Moon.sign)}
        ${row("Nakshatra", pl.Moon ? (pl.Moon.nakshatra || "") + (pl.Moon.pada ? " · pada " + pl.Moon.pada : "") : "")}
        ${row("Ayanamsa", cd.ayanamsha ? "Lahiri " + (typeof cd.ayanamsha === "number" ? cd.ayanamsha.toFixed(2) + "°" : cd.ayanamsha) : "Lahiri")}
      </ul><span class="pnum">2</span></div>`);

    // group the domains
    const groups = [];
    let cur = null;
    for (const sec of sections) {
      const f = byId(facts, sec.module_id); if (!f) continue;
      const cat = CATEGORY_LABEL[f.category] || f.category;
      if (!cur || cur.cat !== cat) { cur = { cat, items: [] }; groups.push(cur); }
      cur.items.push({ sec, f });
    }

    // ── 3. index ─────────────────────────────────────────────────────────────
    let at = 7;                                     // domains begin on page 7
    const fixed = [["Your Birth Charts (D1 · D9)", 4], ["Your Life Axis", 6]];
    const tocRows = fixed.map(([t, n]) => `<li><b>${t}</b><i>${String(n).padStart(2,"0")}</i></li>`)
      .concat(groups.map(g => { const a = at; at += g.items.length + 1;
        return `<li><b>${esc(g.cat)}</b><i>${String(a).padStart(2,"0")}</i></li>`; }))
      .concat([`<li><b>Worth Considering</b><i>${String(at).padStart(2,"0")}</i></li>`]).join("");
    P.push(`<div class="pg"><div class="kick">Contents</div><div class="rule"></div>
      <ul class="toc">${tocRows}</ul><span class="pnum">3</span></div>`);

    // ── 4 & 5. D1 and D9 charts (rendered after the page is placed) ──────────
    P.push(`<div class="pg"><div class="kick">Your Birth Chart</div><div class="rule"></div>
      <h2>Rāśi · D1</h2>
      <div class="fb-chart" id="fbD1Wrap"></div>
      <div class="chart-note">The visible life — body, circumstances, and events.
      Lagna: <b>${esc(d1.lagnaSign || "")}</b></div><span class="pnum">4</span></div>`);
    P.push(`<div class="pg"><div class="kick">Your Birth Chart</div><div class="rule"></div>
      <h2>Navāṁśa · D9</h2>
      <div class="fb-chart" id="fbD9Wrap"></div>
      <div class="chart-note">The inner chart — what endures when the visible is tested.
      Lagna: <b>${esc(d9.lagnaSign || "")}</b></div><span class="pnum">5</span></div>`);

    // ── 6. life axis ─────────────────────────────────────────────────────────
    P.push(lifeAxisPage(cd, facts, 6));

    // ── 7+. domains ──────────────────────────────────────────────────────────
    let n = 7;
    for (const g of groups) {
      P.push(`<div class="pg sec-divider"><div class="in">
        <div class="seal">◈</div><div class="domain">${esc(g.cat)}</div>
        <div class="rule"></div></div><span class="pnum">${n++}</span></div>`);
      for (const { sec, f } of g.items) {
        const win = f.timing_windows[0];
        P.push(`<div class="pg"><div class="kick">${esc(g.cat)}</div><div class="rule"></div>
          <h2>${esc(sec.heading)}</h2>
          <div class="chiprow"><span class="chip">${esc(f.band.replace(/_/g," "))}</span>
            <span class="chip ghost">${f.confidence}% confidence</span></div>
          <div class="bd">${esc(sec.narrative)}</div>
          ${win ? `<div class="ref">◈ ${esc(win.label)}<b>${esc(fmtWin(win))}</b></div>` : ""}
          <span class="pnum">${n++}</span></div>`);
      }
    }

    // ── closing. worth considering ───────────────────────────────────────────
    P.push(worthConsideringPage(groups, n++));
    P.push(`<div class="pg cover close"><div class="frame"></div><div class="in">
      <div class="seal">◈</div>
      <div class="who" style="margin-top:12px">Best wishes from Team AstroIndicators</div>
      <div class="closing">We hope you find this useful in getting an indication of how you are
      navigating and where you are heading${name ? ", " + name : ""}.</div>
      <div class="closing">If you find it useful, please don't hesitate to share it with all those
      whom you care about.</div>
      <div class="closing">If you wish, write a brief review about our work.</div>
      <button class="fb-review" id="fbReview">Write a review</button>
      <div class="logo">Astro<span>Indicators</span></div></div></div>`);

    _book.pages = P; _book.idx = 0; _book.animating = false; _book.target = 0;

    host.innerHTML = `
      <div class="pp-paybar" style="justify-content:flex-end">
        <button id="fbPdf" class="pp-pay">Download PDF</button></div>
      <div class="stage"><div class="book" id="fbBook">
        <div class="page" id="fbStatic"></div>
        <div class="leaf" id="fbLeaf">
          <div class="leaf-face" id="fbLeafFront"></div>
          <div class="leaf-face leaf-back" id="fbLeafBack"></div>
          <div class="shade" id="fbShade"></div>
        </div></div></div>
      <div class="controls"><button class="fb-nav" id="fbPrev">‹</button>
        <div class="dots" id="fbDots"></div>
        <button class="fb-nav" id="fbNext">›</button></div>
      <div class="hint">Swipe, use ← → keys, or tap the dots</div>`;

    bindBook();
    bookRender();
    $("fbPdf").onclick = () => exportPDF(sections, facts);
  }

  // Life Axis — the anchors the whole book is read against.
  function lifeAxisPage(cd, facts, pnum) {
    const pl = cd.planets || {}, d1 = cd.d1 || {}, d9 = cd.d9 || {};
    const moon = pl.Moon || {}, sun = pl.Sun || {};
    const axis = (label, val, note) => val
      ? `<div class="axis-row"><div class="axis-k">${esc(label)}</div>
         <div class="axis-v">${esc(val)}</div><div class="axis-n">${esc(note)}</div></div>` : "";
    // nearest active window across the whole book
    let soon = null;
    for (const f of facts) { const w = f.timing_windows[0]; if (!w) continue;
      if (!soon || w.start_iso < soon.start_iso) soon = w; }
    return `<div class="pg"><div class="kick">Your Life Axis</div><div class="rule"></div>
      <h2>The four anchors of your chart</h2>
      ${axis("Lagna — the life you build", (d1.lagnaSign || "") + (d1.lagnaDegree != null ? "  " + d1.lagnaDegree.toFixed(1) + "°" : ""),
             "How you meet the world, and the body you do it in.")}
      ${axis("Moon — the mind you carry", (moon.sign || "") + (moon.nakshatra ? " · " + moon.nakshatra : ""),
             "How you feel, react, and find rest. Your dasha clock is set from here.")}
      ${axis("Sun — the self you become", sun.sign || "",
             "What you are here to stand for, and where you seek recognition.")}
      ${axis("Navamsa lagna — what endures", d9.lagnaSign || "",
             "The inner chart. It decides whether what you build in D1 holds when tested.")}
      <div class="bd axis-note">
      These four set the frame every domain in this book is read against. Where a domain seems to
      contradict itself, it is usually because one anchor pulls against another — and that tension is
      itself the instruction.${soon ? " Your nearest active window opens " + esc(fmtWin(soon)) + "." : ""}</div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // Worth Considering — one action-oriented line per domain, derived from bands.
  function worthConsideringPage(groups, pnum) {
    const HARD = ["CHALLENGING","HIGH","HIGH_CARE","ELEVATED","STRAINED","OBSTRUCTED","WEAK","DIFFICULT","PRESSURED","HEAVY","DELAYED","SUBDUED"];
    const SOFT = ["MANAGEABLE","MODERATE","ATTENTIVE","WATCHFUL","SENSITIVE","MIXED","FLUCTUATING","BALANCED","CONTESTED","MODEST","HYBRID","STEADY"];
    const ACTION = {
      "Career & Wealth":        ["Keep skills portable and a cash buffer — treat pivots as routing, not failure.",
                                 "Act inside your activation windows; waiting costs more here than moving does."],
      "Marriage & Relationship":["Name the recurring friction early and out loud — this area needs honest attention, not soft-pedalling.",
                                 "Protect the bond with steady, ordinary care rather than grand gestures."],
      "Mobility & Fortune":     ["Fortune here arrives in waves — start things inside your windows, not between them.",
                                 "If you want a move abroad, drive it deliberately; it will not arrive on its own tide."],
      "Crisis, Debt & Legal":   ["Favour negotiation over prolonged conflict, and keep documentation meticulous.",
                                 "Hold one fixed repayment rhythm and avoid new high-cost borrowing."],
      "Health & Wellbeing":     ["Guard sleep and routine — your resilience is maintained, not assumed.",
                                 "Keep check-ups regular and act on small signals early."],
    };
    const rows = groups.map(g => {
      const hard = g.items.filter(x => HARD.includes(x.f.band)).length;
      const soft = g.items.filter(x => SOFT.includes(x.f.band)).length;
      const pool = ACTION[g.cat] || ["Act inside your windows rather than waiting for certainty."];
      const line = hard >= 1 ? pool[0] : (soft >= 2 ? (pool[1] || pool[0]) : (pool[1] || pool[0]));
      return `<li><b>${esc(g.cat)}</b>${esc(line)}</li>`;
    }).join("");
    return `<div class="pg"><div class="kick">Worth Considering</div><div class="rule"></div>
      <h2>What to actually do with this</h2>
      <ul class="wc-list">${rows}</ul>
      <div class="ref">◈ Read this page again in six months<b>The chart does not change; your position in its timeline does.</b></div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // ── South-Indian chart, drawn self-contained (no dependency on app.js scope) ─
  const P_ABBR = { Sun:"Su", Moon:"Mo", Mars:"Ma", Mercury:"Me", Jupiter:"Ju",
                   Venus:"Ve", Saturn:"Sa", Rahu:"Ra", Ketu:"Ke" };
  const SIGN_ABBR = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
  const SIGNS_FULL = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio",
                      "Sagittarius","Capricorn","Aquarius","Pisces"];
  const CELL_HOUSE = { "0,0":11,"0,1":12,"0,2":1,"0,3":2, "1,0":10,"1,3":3,
                       "2,0":9,"2,3":4, "3,0":8,"3,1":7,"3,2":6,"3,3":5 };

  function chartSVG(lagnaSign, houses) {
    const li = SIGNS_FULL.indexOf(lagnaSign);
    if (li < 0) return "";
    const S = 300, C = S / 4;
    let out = `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" class="fbchart-svg">`;
    out += `<rect x="0" y="0" width="${S}" height="${S}" fill="none" stroke="#8A6E2F" stroke-width="1.5"/>`;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const h = CELL_HOUSE[r + "," + c];
      if (!h) continue;
      const x = c * C, y = r * C;
      const signIdx = (li + h - 1) % 12;
      out += `<rect x="${x}" y="${y}" width="${C}" height="${C}" fill="${h===1?"rgba(201,164,76,.22)":"none"}" stroke="#8A6E2F" stroke-width=".7"/>`;
      out += `<text x="${x+4}" y="${y+12}" font-size="8.5" fill="#8A6E2F">${SIGN_ABBR[signIdx]}</text>`;
      if (h === 1) out += `<text x="${x+C-4}" y="${y+12}" font-size="8.5" fill="#8A6E2F" text-anchor="end">Asc</text>`;
      const occ = (houses && houses[h]) || (houses && houses[String(h)]) || [];
      occ.forEach((pl, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        out += `<text x="${x + 8 + col*32}" y="${y + 32 + row*15}" font-size="11.5" font-weight="600" fill="#23252E">${P_ABBR[pl] || pl.slice(0,2)}</text>`;
      });
    }
    out += `</svg>`;
    return out;
  }
  function paintCharts() {
    const cd = window.currentData; if (!cd) return;
    const d1 = cd.d1 || {}, d9 = cd.d9 || {};
    const w1 = $("fbD1Wrap"), w9 = $("fbD9Wrap");
    if (w1 && !w1.firstChild) w1.innerHTML = chartSVG(d1.lagnaSign, d1.houses);
    if (w9 && !w9.firstChild) w9.innerHTML = chartSVG(d9.lagnaSign, d9.houses);
  }

  function bookRender() {
    const P = _book.pages;
    $("fbStatic").innerHTML = P[_book.idx];
    paintCharts();
    const rv = $("fbReview");
    if (rv) rv.onclick = () => {
      const t = document.querySelector('.nav-tab[data-tab="reviewTab"], .nav-tab[data-tab="reviewsTab"]');
      if (t) t.click(); else alert("Thank you! The review section is on the Contact Us tab.");
    };
    $("fbPrev").disabled = _book.idx === 0;
    $("fbNext").disabled = _book.idx === P.length - 1;
    const d = $("fbDots"); d.innerHTML = "";
    P.forEach((_, i) => {
      const s = document.createElement("div");
      s.className = "dot" + (i === _book.idx ? " on" : "");
      s.onclick = () => bookJump(i);
      d.appendChild(s);
    });
  }
  function bookFlip(forward) {
    if (_book.animating) return;
    _book.animating = true;
    const to = _book.target, P = _book.pages;
    const leaf = $("fbLeaf");
    $("fbStatic").innerHTML = P[to];
    paintCharts();
    $("fbLeafFront").innerHTML = forward ? P[_book.idx] : P[to];
    $("fbLeafBack").innerHTML  = forward ? P[to] : P[_book.idx];
    leaf.style.transition = "none";
    leaf.style.transform = "rotateY(" + (forward ? 0 : -180) + "deg)";
    leaf.style.display = "block";
    $("fbShade").style.opacity = forward ? 0 : .5;
    void leaf.offsetWidth;
    leaf.style.transition = "transform .72s cubic-bezier(.3,.1,.2,1)";
    leaf.style.transform = "rotateY(" + (forward ? -180 : 0) + "deg)";
    $("fbShade").style.opacity = forward ? .5 : 0;
  }
  function bookJump(i) { if (_book.animating || i === _book.idx) return; _book.target = i; bookFlip(i > _book.idx); }
  function bookNext() { if (_book.animating || _book.idx >= _book.pages.length-1) return; _book.target = _book.idx+1; bookFlip(true); }
  function bookPrev() { if (_book.animating || _book.idx <= 0) return; _book.target = _book.idx-1; bookFlip(false); }

  let _bookBound = false;
  function bindBook() {
    const leaf = $("fbLeaf");
    leaf.addEventListener("transitionend", function (e) {
      if (e.propertyName !== "transform") return;
      leaf.style.display = "none"; _book.animating = false; _book.idx = _book.target; bookRender();
    });
    $("fbNext").onclick = bookNext;
    $("fbPrev").onclick = bookPrev;
    let sx = 0;
    const bk = $("fbBook");
    bk.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive:true });
    bk.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) < 40) return; dx < 0 ? bookNext() : bookPrev();
    });
    if (!_bookBound) {
      document.addEventListener("keydown", e => {
        if (!$("fbBook")) return;
        if (e.key === "ArrowRight") bookNext();
        if (e.key === "ArrowLeft") bookPrev();
      });
      _bookBound = true;
    }
  }

  // ── PDF export (jsPDF, already loaded for the dasa report) ──────────────────
  function exportPDF(sections, facts) {
    const J = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!J) { alert("PDF library not loaded."); return; }
    const doc = new J({ unit:"pt", format:"a4" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 56; let y = 0;
    const NAVY = [11,14,26], GOLD = [201,164,76], INK = [40,40,44];
    const f0 = (window.currentData && window.currentData.form) || {};

    // cover
    doc.setFillColor(...NAVY); doc.rect(0,0,W,H,"F");
    doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.rect(M/2,M/2,W-M,H-M);
    doc.setTextColor(...GOLD); doc.setFontSize(11);
    doc.text("LIFE INDICATORS REPORT", W/2, H/2-90, { align:"center" });
    doc.setTextColor(255,255,255); doc.setFontSize(30);
    doc.text("The Book of", W/2, H/2-40, { align:"center" });
    doc.text("Your Timings", W/2, H/2-6, { align:"center" });
    doc.setFontSize(14); doc.setTextColor(...GOLD);
    if (f0.name) doc.text(String(f0.name), W/2, H/2+40, { align:"center" });
    doc.setFontSize(9); doc.setTextColor(220,220,220);
    if (_book.meta) doc.text(_book.meta, W/2, H/2+62, { align:"center" });
    doc.setFontSize(8);
    doc.text("Swiss Ephemeris · Lahiri ayanamsa", W/2, H-70, { align:"center" });

    let page = 1;
    const newPage = () => { doc.addPage(); page++; y = M;
      doc.setTextColor(...INK); };
    newPage();
    let lastCat = "";
    for (const sec of sections) {
      const f = byId(facts, sec.module_id); if (!f) continue;
      const cat = CATEGORY_LABEL[f.category] || f.category;
      const win = f.timing_windows[0];
      const body = doc.splitTextToSize(sec.narrative, W - M*2);
      const need = 96 + body.length*14 + (win ? 34 : 0);
      if (y + need > H - M) newPage();
      if (cat !== lastCat) {
        lastCat = cat;
        if (y + need + 40 > H - M) newPage();
        doc.setFillColor(...NAVY); doc.rect(M, y, W-M*2, 30, "F");
        doc.setTextColor(...GOLD); doc.setFontSize(10);
        doc.text(cat.toUpperCase(), M+12, y+20);
        y += 46;
      }
      doc.setTextColor(...INK); doc.setFontSize(14);
      doc.text(sec.heading, M, y); y += 20;
      doc.setFontSize(9); doc.setTextColor(...GOLD);
      doc.text(f.band.replace(/_/g," ") + "  ·  " + f.confidence + "% confidence", M, y); y += 18;
      doc.setFontSize(10.5); doc.setTextColor(...INK);
      doc.text(body, M, y); y += body.length*14 + 6;
      if (win) {
        doc.setDrawColor(...GOLD); doc.line(M, y, W-M, y); y += 14;
        doc.setFontSize(9.5); doc.setTextColor(...GOLD);
        doc.text(win.label + ": " + fmtWin(win), M, y); y += 22;
      }
      y += 14;
    }
    const total = doc.internal.getNumberOfPages();
    for (let i = 2; i <= total; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text(String(i-1), W/2, H-28, { align:"center" });
    }
    const safe = (f0.name || "report").replace(/[^\w-]+/g,"_");
    doc.save("AstroIndicators_LifeIndicators_" + safe + ".pdf");
  }

  // ── product 2: ICC answer cards ─────────────────────────────────────────────
  // A purchase = one SET of 3 answers, stored server-side. Re-entry replays the
  // sets already bought; a new set of questions requires a new payment.
  let _iccRenderedFor = null;          // chartId the visible answers belong to

  async function buildICC(pickedIds, existingSets) {
    const host = $("iccAnswers"); if (!host) return;
    host.innerHTML = `<div class="pp-empty">Reading your chart…</div>`;
    try {
      const facts = await getFacts();
      const picked = pickedIds.map(id => byId(facts, id)).filter(Boolean);
      const out = await narrate("icc_answer", picked);
      const sets = (existingSets || []).concat([{ answers: out.answers || [] }]);
      srv({ action:"store", chartId: window.AI_chartId(), item:"icc", lang:"en", sections: sets });
      renderICC(host, sets, facts);
    } catch (e) { host.innerHTML = `<div class="pp-empty">${esc(e.message)}</div>`; }
  }

  function renderICC(host, sets, facts) {
    let html = "";
    sets.forEach((set, i) => {
      if (sets.length > 1) html += `<div class="icc-setlabel">Set ${i+1}</div>`;
      html += (set.answers || []).map(a => {
        const f = byId(facts, a.module_id); if (!f) return "";
        const win = f.timing_windows[0];
        return `<div class="pp-card icc-answer">
          <div class="pp-band pp-band-${esc(f.intensity.toLowerCase())}">${esc(f.band.replace(/_/g," "))}</div>
          <div class="pp-q">${esc(f.question)}</div>
          <div class="icc-nar">${esc(a.narrative)}</div>
          ${win ? `<div class="fb-win">◈ ${esc(win.label)} — <b>${esc(fmtWin(win))}</b></div>` : ""}
          <div class="icc-conf">Confidence: <b>${f.confidence}%</b> <span class="icc-confbar"><i style="width:${f.confidence}%"></i></span></div>
        </div>`;
      }).join("");
    });
    // repeat purchase: a genuinely NEW set, charged again
    html += `<div class="pp-paybar"><button id="iccMoreBtn" class="pp-pay">Ask 3 new questions — ₹${price("icc",499)}</button>
      <span class="pp-guar">Your answered sets stay saved on this chart</span></div>`;
    host.innerHTML = html;
    _iccRenderedFor = window.AI_chartId ? window.AI_chartId() : null;
    const w = $("iccPickerWrap"); if (w) w.style.display = "none";
    const more = $("iccMoreBtn");
    if (more) more.onclick = () => {
      if (w) w.style.display = "";
      host.innerHTML = "";
      _iccRenderedFor = null;
      document.querySelectorAll("#iccPicker input:checked").forEach(b => b.checked = false);
      window.AI_iccLimit({ checked:false });
      window._iccExistingSets = sets;     // next purchase appends to these
      if (w) w.scrollIntoView({ behavior:"smooth", block:"start" });
    };
  }

  // Returning customer on the SAME chart: replay the sets already paid for.
  async function restoreICC() {
    const host = $("iccAnswers"); if (!host || !window.AI_chartId) return false;
    const cid = window.AI_chartId();
    const cached = await srv({ action:"fetch", chartId: cid, item:"icc", lang:"en" });
    let sets = cached && cached.sections;
    if (!sets || !sets.length) return false;
    if (Array.isArray(sets) && sets[0] && sets[0].module_id) sets = [{ answers: sets }];  // legacy flat format
    try { renderICC(host, sets, await getFacts()); return true; } catch (e) { return false; }
  }

  // Birth details changed → clear another chart's answers from the DOM.
  function resetICCIfChartChanged() {
    const cid = window.AI_chartId ? window.AI_chartId() : null;
    if (_iccRenderedFor && _iccRenderedFor !== cid) {
      const host = $("iccAnswers"); if (host) host.innerHTML = "";
      const w = $("iccPickerWrap"); if (w) w.style.display = "";
      _iccRenderedFor = null; window._iccExistingSets = null;
      document.querySelectorAll("#iccPicker input:checked").forEach(b => b.checked = false);
    }
  }


  function srv(payload) {
    return fetch("/api/report", { method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload) }).then(r => r.ok ? r.json() : null).catch(() => null);
  }

  // ── payment wiring (mirrors uiv4 pattern: session unlock → server status → pay) ─
  // ── pre-checkout gate: mandatory email + no-refund confirm (mirrors ui-v4) ──
  // Email is MANDATORY for the invoice. Read from the birth form; if empty or
  // invalid, BLOCK payment, go to the Birth Data tab, cue the field, and explain.
  function requireEmail() {
    var email = "";
    try { email = (document.getElementById("inputEmail") || {}).value || ""; } catch (e) {}
    email = email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
    var ef = document.getElementById("inputEmail");
    try {
      if (window.goToTab) window.goToTab("inputTab");
      else document.querySelector('.nav-tab[data-tab="inputTab"]')?.click();
    } catch (e) {}
    if (ef) {
      ef.style.border = "2px solid #c9a84c";
      ef.style.boxShadow = "0 0 0 2px rgba(201,168,76,0.25)";
      try { ef.focus(); ef.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
      var clearHi = function () {
        ef.style.border = ""; ef.style.boxShadow = "";
        ef.removeEventListener("input", clearHi);
      };
      ef.addEventListener("input", clearHi);
    }
    alert(window.t ? window.t("email_required")
      : "Please enter a valid email — your invoice will be sent there.");
    return null;
  }

  function unlockedHere(item) {
    return window.AI_unlocked && window.AI_unlocked[item] === (window.AI_chartId && window.AI_chartId());
  }
  async function payThenRun(item, amount, label, run, forcePay) {
    if (!window.currentData || !window.currentData.chart) {
      alert("Generate your chart first (Birth Data tab)."); return;
    }
    const cid = window.AI_chartId();
    if (!forcePay) {
      if (unlockedHere(item)) { run(); return; }
      const st = await srv({ action:"status", chartId: cid, item });
      if (st && st.paid) { (window.AI_unlocked=window.AI_unlocked||{})[item]=cid; run(); return; }
    }
    let owner=false; try{ owner = (localStorage.getItem("ai_owner") === "own-kSfeE_BD9rv3_GSIKVpAA583"); }catch(e){}
    if (owner) { (window.AI_unlocked=window.AI_unlocked||{})[item]=cid; run(); return; }

    const email = requireEmail();
    if (!email) return;
    if (!window.confirm(window.t ? window.t("refund_confirm")
        : "No refund — please confirm before you proceed to payment.")) return;

    window.startPayment({ item, amount, label, email, chartId: cid })
      .then(res => {
        if (!res || !res.paymentId) { alert("Payment not completed."); return; }
        (window.AI_unlocked=window.AI_unlocked||{})[item]=cid;
        window.AI_lastPayment = window.AI_lastPayment || {};
        window.AI_lastPayment[item] = res.paymentId;
        run();
      })
      .catch(err => { if (err !== "dismissed") alert("Payment failed: " + err); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // owner mode: reveal the internal tabs (Dasa/Domains/Summary) hidden from customers
    try { if (localStorage.getItem("ai_owner") === "own-kSfeE_BD9rv3_GSIKVpAA583")
      document.body.classList.add("ai-owner"); } catch (e) {}
    const liBtn = $("liPayBtn");
    if (liBtn) { liBtn.textContent = `Unlock the full report — ₹${price("lifeIndicators",999)}`;
      liBtn.onclick = () => payThenRun("lifeIndicators", price("lifeIndicators",999),
        "Life Indicators Report", buildLifeIndicators); }
    const iccBtn = $("iccPayBtn");
    if (iccBtn) iccBtn.onclick = async () => {
      const ids = [...document.querySelectorAll("#iccPicker input:checked")].map(b => b.dataset.mid);
      if (ids.length !== 3) return;
      // if this chart already has a paid answer-set, replay it — never grant a
      // second set of questions on a single payment
      const existing = window._iccExistingSets || null;
      if (!existing && await restoreICC()) return;   // first entry: replay what's paid
      payThenRun("icc", price("icc",499),
        existing ? "Instant Clarity — new set of 3" : "Instant Clarity Command (3 answers)",
        () => { window._iccExistingSets = null; buildICC(ids, existing); },
        !!existing);                                  // repeat set = always charge
    };
    // teasers render when the tabs are first opened
    document.querySelectorAll('.nav-tab[data-tab="lifeIndTab"], .nav-tab[data-tab="iccTab"]')
      .forEach(b => b.addEventListener("click", function () {
        renderTeasers();
        if (b.dataset.tab === "iccTab") { resetICCIfChartChanged(); restoreICC(); }
      }));
  });
})();
