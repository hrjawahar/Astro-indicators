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
      body: JSON.stringify({ kind, facts }),   // no name: books cache per chart, not per person
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
    const _m = chartModel() || {};
    const d1 = _m.d1 || {}, d9 = _m.d9 || {}, pl = (chartSource().planets) || {};
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
    let at = 8;                                     // domains begin on page 8
    const fixed = [["Your Birth Charts (D1 · D9)", 4], ["Your Life Axis", 6], ["Your Life Theme", 7]];
    const tocRows = fixed.map(([t, n]) => `<li><b>${t}</b><i>${String(n).padStart(2,"0")}</i></li>`)
      .concat(groups.map(g => { const a = at; at += g.items.length + 1;
        return `<li><b>${esc(g.cat)}</b><i>${String(a).padStart(2,"0")}</i></li>`; }))
      .concat([`<li><b>Worth Considering</b><i>${String(at).padStart(2,"0")}</i></li>`]).join("");
    P.push(`<div class="pg"><div class="kick">Contents</div><div class="rule"></div>
      <ul class="toc">${tocRows}</ul><span class="pnum">3</span></div>`);

    // ── 4 & 5. D1 and D9 charts (rendered after the page is placed) ──────────
    P.push(`<div class="pg"><div class="kick">Your Birth Chart</div><div class="rule"></div>
      <h2>Rāśi · D1 — the stage</h2>
      <div class="fb-chart" id="fbD1Wrap"></div>
      <div class="chart-note"><b>Think of D1 as the play as it is performed.</b> The set, the cast, the
      entrances and exits — your body, your circumstances, the events people can see. Lagna:
      <b>${esc(d1.lagnaSign || "")}</b></div>
      ${chartLegend()}<span class="pnum">4</span></div>`);
    P.push(`<div class="pg"><div class="kick">Your Birth Chart</div><div class="rule"></div>
      <h2>Navāṁśa · D9 — the root system</h2>
      <div class="fb-chart" id="fbD9Wrap"></div>
      <div class="chart-note"><b>If D1 is the tree, D9 is the root.</b> Nobody sees it, and it decides
      whether the tree survives a storm. A promise strong in D1 but weak here tends to arrive and
      not stay; strong here, it holds when tested. Lagna: <b>${esc(d9.lagnaSign || "")}</b></div>
      ${chartLegend()}<span class="pnum">5</span></div>`);

    // ── 6. life axis ─────────────────────────────────────────────────────────
    P.push(lifeAxisPage(_m, facts, 6));

    P.push(lifeThemePage(_m, 7));

    // ── 8+. domains ──────────────────────────────────────────────────────────
    let n = 8;
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
      <div class="closing">If our work was useful to you, we'd be grateful for a short review —
      you'll find the <b>Leave a Review</b> button on the Birth Details page.</div>
      <div class="logo">Astro<span>Indicators</span></div></div></div>`);

    _book.pages = P; _book.idx = 0; _book.animating = false; _book.target = 0;

    host.innerHTML = `
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
      <div class="hint">Swipe, use ← → keys, or tap the dots</div>
      <div class="fb-dlbar"><button id="fbPdf" class="pp-pay">Download PDF</button></div>`;

    bindBook();
    bookRender();
    $("fbPdf").onclick = () => exportPDF(sections, facts);
  }


  // ── the dominant life theme: which house-axis carries the most weight ───────
  const AXES = [
    { pair:"1 × 7",  name:"Self and Partnership",   houses:[1,7],
      theme:"Your life is organised around the meeting of self and other. Who you become is worked out through relationship — partnership, marriage, business alliances. Independence and intimacy are the two poles you keep negotiating.",
      work:"Learning to stay yourself inside a bond, without disappearing into it or defending against it." },
    { pair:"2 × 8",  name:"Wealth and Transformation", houses:[2,8],
      theme:"Your life turns on what you accumulate and what you must let go of. Resources, family assets, shared money, and periodic upheaval are the recurring machinery of your story.",
      work:"Building security while accepting that some of it will be dismantled and rebuilt — more than once." },
    { pair:"3 × 9",  name:"Effort and Fortune",      houses:[3,9],
      theme:"Your life is a dialogue between your own initiative and the larger current carrying you. Courage, siblings, communication, teaching, belief, and long journeys keep reappearing.",
      work:"Knowing when to push with your own hand and when to let the wider current do the work." },
    { pair:"4 × 10", name:"Roots and Standing",      houses:[4,10],
      theme:"Your life is built between home and the world — the private ground you stand on and the public position you occupy. Property, mother, inner peace, career, and reputation form your central axis.",
      work:"Keeping the foundation intact while you climb, so the standing you win still has somewhere to rest." },
    { pair:"5 × 11", name:"Creation and Gain",       houses:[5,11],
      theme:"Your life moves through what you create and what it returns to you. Children, intelligence, creative output, networks, and the fruits of your work are the through-line.",
      work:"Creating for its own sake while still letting the returns arrive — neither pure idealism nor pure calculation." },
    { pair:"6 × 12", name:"Service and Release",     houses:[6,12],
      theme:"Your life is shaped by what you overcome and what you surrender. Work, health, obstacles, debts, solitude, foreign lands, and the inner world are its recurring terrain.",
      work:"Meeting difficulty without being defined by it, and letting go of what no longer needs carrying." },
  ];
  function pickTheme(m) {
    if (!m || !m.d1 || !m.d1.houses) return null;
    const h = m.d1.houses;
    const KEY = { Sun:1.2, Moon:1.2, Mars:1, Mercury:1, Jupiter:1.2, Venus:1, Saturn:1.2, Rahu:.9, Ketu:.9 };
    const scored = AXES.map(a => {
      let s = 0;
      for (const hn of a.houses) for (const p of (h[hn] || [])) s += (KEY[p] || 1);
      return { a, s };
    }).sort((x,y) => y.s - x.s);
    const top = scored[0];
    const occ = top.a.houses.map(hn => (h[hn]||[]).map(p => P_ABBR[p]||p).join(" ")).filter(Boolean);
    return { a: top.a, second: scored[1], score: top.s,
      evidence: occ.length ? "Why this axis: your " + top.a.houses.join("th and ") + "th houses carry "
        + occ.join(" / ") + " — the heaviest concentration in your chart." : "" };
  }

  function lifeThemePage(m, pnum) {
    if (!m || !m.d1 || !m.d1.houses) return `<div class="pg"><div class="kick">Your Life Theme</div>
      <div class="rule"></div><div class="bd">Chart data unavailable.</div><span class="pnum">${pnum}</span></div>`;
    const h = m.d1.houses;
    const KEY = { Sun:1.2, Moon:1.2, Mars:1, Mercury:1, Jupiter:1.2, Venus:1, Saturn:1.2, Rahu:.9, Ketu:.9 };
    const scored = AXES.map(a => {
      let s = 0;
      for (const hn of a.houses) for (const p of (h[hn] || [])) s += (KEY[p] || 1);
      return { a, s };
    }).sort((x,y) => y.s - x.s);
    const top = scored[0], second = scored[1];
    const tenanted = (ax) => ax.houses.map(hn => (h[hn]||[]).map(p => P_ABBR[p]||p).join(" ")).filter(Boolean);
    const occ = tenanted(top.a);
    return `<div class="pg"><div class="kick">Your Life Theme</div><div class="rule"></div>
      <h2>${esc(top.a.pair)} — ${esc(top.a.name)}</h2>
      <div class="chiprow"><span class="chip">Primary axis</span>
        ${second && second.s > 0 ? `<span class="chip ghost">then ${esc(second.a.pair)} · ${esc(second.a.name)}</span>` : ""}</div>
      <div class="bd">
        <p>${esc(top.a.theme)}</p>
        <p class="theme-work"><b>The work of this birth:</b> ${esc(top.a.work)}</p>
        ${occ.length ? `<p class="theme-ev">Why this axis: your ${esc(top.a.houses.join("th and "))}th houses carry
          ${esc(occ.join(" / "))} — the heaviest concentration in your chart.</p>` : ""}
        <p class="theme-ev">Every domain that follows is a different window onto this same theme. Where a
        reading feels unexpectedly heavy or unexpectedly easy, it is usually because it sits on or away
        from this axis.</p>
      </div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // Life Axis — the anchors the whole book is read against.
  function lifeAxisPage(m, facts, pnum) {
    const d1 = (m && m.d1) || {}, d9 = (m && m.d9) || {};
    const P = chartSource().planets || {};
    const moon = { sign: (m && m.lons && m.lons.Moon != null) ? m.sign(m.lons.Moon) : (P.Moon && P.Moon.sign),
                   nakshatra: (P.Moon && P.Moon.nakshatra) || "" };
    const sun  = { sign: (m && m.lons && m.lons.Sun != null) ? m.sign(m.lons.Sun) : (P.Sun && P.Sun.sign) };
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

  const WC_ACTION = {
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
  const WC_HARD = ["CHALLENGING","HIGH","HIGH_CARE","ELEVATED","STRAINED","OBSTRUCTED","WEAK","DIFFICULT","PRESSURED","HEAVY","DELAYED","SUBDUED"];
  function worthConsideringLines(groups) {
    return groups.map(g => {
      const hard = g.items.filter(x => WC_HARD.includes(x.f.band)).length;
      const pool = WC_ACTION[g.cat] || ["Act inside your windows rather than waiting for certainty."];
      return { cat: g.cat, action: hard >= 1 ? pool[0] : (pool[1] || pool[0]) };
    });
  }

  // Worth Considering — one action-oriented line per domain, derived from bands.
  function worthConsideringPage(groups, pnum) {
    const rows = worthConsideringLines(groups)
      .map(r => `<li><b>${esc(r.cat)}</b>${esc(r.action)}</li>`).join("");
    return `<div class="pg"><div class="kick">Worth Considering</div><div class="rule"></div>
      <h2>What to actually do with this</h2>
      <ul class="wc-list">${rows}</ul>
      <div class="ref">◈ Read this page again in six months<b>The chart does not change; your position in its timeline does.</b></div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // ── chart data: read from the SAME object we send to /api/facts, and derive
  // houses from longitudes so we never depend on an assumed `houses` shape ────
  const SIGNS_FULL2 = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio",
                       "Sagittarius","Capricorn","Aquarius","Pisces"];
  function chartSource() {
    const cd = window.currentData || {};
    return cd.chart || cd;                     // /api/chart response
  }
  function chartModel() {
    const src = chartSource();
    const d1 = src.d1 || {}, d9 = src.d9 || {};
    const deg = d1.degrees || {};
    let asc = null;
    if (typeof d1.lagnaSign === "string" && SIGNS_FULL2.indexOf(d1.lagnaSign) >= 0)
      asc = SIGNS_FULL2.indexOf(d1.lagnaSign) * 30 + (d1.lagnaDegree || 0);
    else if (typeof src.ascendant === "number") asc = src.ascendant;
    if (asc == null) return null;

    const norm = x => ((x % 360) + 360) % 360;
    const si = l => Math.floor(norm(l) / 30);
    const nav = l => SIGNS_FULL2[Math.floor(norm(l) / (30 / 9)) % 12];
    const names = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
    const lons = {};
    for (const n of names) if (typeof deg[n] === "number") lons[n] = deg[n];
    if (lons.Rahu != null && lons.Ketu == null) lons.Ketu = norm(lons.Rahu + 180);
    if (!Object.keys(lons).length) return null;

    const h1 = {}, h9 = {};
    for (let h = 1; h <= 12; h++) { h1[h] = []; h9[h] = []; }
    const li = si(asc), d9li = SIGNS_FULL2.indexOf(nav(asc));
    for (const n of names) {
      if (lons[n] == null) continue;
      h1[((si(lons[n]) - li + 12) % 12) + 1].push(n);
      h9[((SIGNS_FULL2.indexOf(nav(lons[n])) - d9li + 12) % 12) + 1].push(n);
    }
    return {
      d1: { lagnaSign: SIGNS_FULL2[li], lagnaDegree: norm(asc) % 30, houses: h1 },
      d9: { lagnaSign: d9.lagnaSign || SIGNS_FULL2[d9li], houses: h9 },
      lons, sign: l => SIGNS_FULL2[si(l)], nav,
    };
  }

  // ── South-Indian chart, drawn self-contained (no dependency on app.js scope) ─
  const P_ABBR = { Sun:"Su", Moon:"Mo", Mars:"Ma", Mercury:"Me", Jupiter:"Ju",
                   Venus:"Ve", Saturn:"Sa", Rahu:"Ra", Ketu:"Ke" };
  const P_TAMIL = { Sun:"சூரியன்", Moon:"சந்திரன்", Mars:"செவ்வாய்", Mercury:"புதன்",
                    Jupiter:"குரு", Venus:"சுக்கிரன்", Saturn:"சனி", Rahu:"ராகு", Ketu:"கேது" };
  function chartLegend() {
    return `<div class="fb-legend">` + Object.keys(P_ABBR).map(k =>
      `<span><b>${P_ABBR[k]}</b> = ${P_TAMIL[k]}</span>`).join("") + `</div>`;
  }
  const SIGN_ABBR = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
  const SIGNS_FULL = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio",
                      "Sagittarius","Capricorn","Aquarius","Pisces"];
  const CELL_HOUSE = { "0,0":11,"0,1":12,"0,2":1,"0,3":2, "1,0":10,"1,3":3,
                       "2,0":9,"2,3":4, "3,0":8,"3,1":7,"3,2":6,"3,3":5 };

  // Standard South-Indian layout: sign positions are FIXED; the house number in
  // each cell is counted from the lagna sign (lagna cell = house 1).
  const CELL_SIGN = { "0,0":11,"0,1":0,"0,2":1,"0,3":2,   // Pisces, Aries, Taurus, Gemini
                      "1,0":10,            "1,3":3,        // Aquarius … Cancer
                      "2,0":9,             "2,3":4,        // Capricorn … Leo
                      "3,0":8,"3,1":7,"3,2":6,"3,3":5 };   // Sagittarius, Scorpio, Libra, Virgo
  function chartSVG(lagnaSign, houses) {
    const li = SIGNS_FULL.indexOf(lagnaSign);
    if (li < 0) return "";
    const S = 300, C = S / 4;
    let out = `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" class="fbchart-svg">`;
    out += `<rect x="0" y="0" width="${S}" height="${S}" fill="none" stroke="#8A6E2F" stroke-width="1.5"/>`;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const key = r + "," + c;
      if (!(key in CELL_SIGN)) continue;
      const signIdx = CELL_SIGN[key];
      const h = ((signIdx - li + 12) % 12) + 1;      // house number from the lagna
      const x = c * C, y = r * C;
      out += `<rect x="${x}" y="${y}" width="${C}" height="${C}" fill="${h===1?"rgba(201,164,76,.22)":"none"}" stroke="#8A6E2F" stroke-width=".7"/>`;
      out += `<text x="${x+4}" y="${y+11}" font-size="8" fill="#8A6E2F">${SIGN_ABBR[signIdx]}</text>`;
      out += `<text x="${x+C-4}" y="${y+C-5}" font-size="9.5" font-weight="700" fill="${h===1?"#8A6E2F":"#B09A63"}" text-anchor="end">${h}</text>`;
      if (h === 1) out += `<text x="${x+C-4}" y="${y+11}" font-size="8" fill="#8A6E2F" text-anchor="end">Asc</text>`;
      const occ = (houses && (houses[h] || houses[String(h)])) || [];
      occ.forEach((pl, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        out += `<text x="${x + 8 + col*32}" y="${y + 30 + row*15}" font-size="11.5" font-weight="600" fill="#23252E">${P_ABBR[pl] || pl.slice(0,2)}</text>`;
      });
    }
    out += `</svg>`;
    return out;
  }

  function paintCharts() {
    const m = chartModel(); if (!m) return;
    const w1 = $("fbD1Wrap"), w9 = $("fbD9Wrap");
    if (w1 && !w1.firstChild) w1.innerHTML = chartSVG(m.d1.lagnaSign, m.d1.houses);
    if (w9 && !w9.firstChild) w9.innerHTML = chartSVG(m.d9.lagnaSign, m.d9.houses);
  }

  function bookRender() {
    const P = _book.pages;
    $("fbStatic").innerHTML = P[_book.idx];
    paintCharts();

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

  // ── product 2: ICC answer cards ─────────────────────────────────────────────
  // A purchase = one SET of 3 answers, stored server-side. Re-entry replays the
  // sets already bought; a new set of questions requires a new payment.
  let _iccRenderedFor = null;

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
    html += `<div class="pp-paybar"><button id="iccPdf" class="pp-pay">Download PDF</button>
      <button id="iccMoreBtn" class="pp-pay ghost">Ask 3 new questions — ₹${price("icc",499)}</button>
      <span class="pp-guar">Your answered sets stay saved on this chart</span></div>`;
    host.innerHTML = html;
    _iccRenderedFor = window.AI_chartId ? window.AI_chartId() : null;
    const w = $("iccPickerWrap"); if (w) w.style.display = "none";
    const pdfBtn = $("iccPdf");
    if (pdfBtn) pdfBtn.onclick = () => exportICCPDF(sets, facts);
    const more = $("iccMoreBtn");
    if (more) more.onclick = () => {
      if (w) w.style.display = "";
      host.innerHTML = ""; _iccRenderedFor = null;
      document.querySelectorAll("#iccPicker input:checked").forEach(b => b.checked = false);
      window.AI_iccLimit({ checked:false });
      window._iccExistingSets = sets;
      if (w) w.scrollIntoView({ behavior:"smooth", block:"start" });
    };
  }

  async function restoreICC() {
    const host = $("iccAnswers"); if (!host || !window.AI_chartId) return false;
    const cached = await srv({ action:"fetch", chartId: window.AI_chartId(), item:"icc", lang:"en" });
    let sets = cached && cached.sections;
    if (!sets || !sets.length) return false;
    if (Array.isArray(sets) && sets[0] && sets[0].module_id) sets = [{ answers: sets }];
    try { renderICC(host, sets, await getFacts()); return true; } catch (e) { return false; }
  }

  function resetICCIfChartChanged() {
    const cid = window.AI_chartId ? window.AI_chartId() : null;
    if (_iccRenderedFor && _iccRenderedFor !== cid) {
      const host = $("iccAnswers"); if (host) host.innerHTML = "";
      const w = $("iccPickerWrap"); if (w) w.style.display = "";
      _iccRenderedFor = null; window._iccExistingSets = null;
      document.querySelectorAll("#iccPicker input:checked").forEach(b => b.checked = false);
    }
  }


  // ── ICC PDF export ─────────────────────────────────────────────────────────
  function exportICCPDF(sets, facts) {
    const J = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!J) { alert("PDF library not loaded."); return; }
    const doc = new J({ unit:"pt", format:"a4" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 56; let y = 0;
    const NAVY = [11,14,26], GOLD = [201,164,76], INK = [40,40,44], MUTE = [110,110,120];
    const f0 = (window.currentData && window.currentData.form) || {};
    const name = f0.name || "";

    doc.setFillColor(...NAVY); doc.rect(0,0,W,H,"F");
    doc.setDrawColor(...GOLD); doc.rect(M/2,M/2,W-M,H-M);
    doc.setTextColor(...GOLD); doc.setFontSize(11);
    doc.text("INSTANT CLARITY COMMAND", W/2, H/2-70, { align:"center" });
    doc.setTextColor(255,255,255); doc.setFontSize(26);
    doc.text("Your Questions,", W/2, H/2-28, { align:"center" });
    doc.text("Answered", W/2, H/2+2, { align:"center" });
    doc.setFontSize(13); doc.setTextColor(...GOLD);
    if (name) doc.text(name, W/2, H/2+40, { align:"center" });
    doc.setFontSize(8); doc.setTextColor(200,200,205);
    const meta = [f0.dob, f0.tob, f0.place].filter(Boolean).join(" · ");
    if (meta) doc.text(doc.splitTextToSize(meta, W-M*2), W/2, H/2+64, { align:"center" });
    doc.text("Swiss Ephemeris · Lahiri ayanamsa", W/2, H-70, { align:"center" });

    doc.addPage(); y = M;
    sets.forEach((set, si) => {
      if (sets.length > 1) {
        if (y + 40 > H - M) { doc.addPage(); y = M; }
        doc.setFontSize(9); doc.setTextColor(...GOLD);
        doc.text("SET " + (si+1), M, y); y += 6;
        doc.setDrawColor(...GOLD); doc.line(M, y, W-M, y); y += 20;
      }
      (set.answers || []).forEach(a => {
        const f = byId(facts, a.module_id); if (!f) return;
        const win = f.timing_windows[0];
        const q = doc.splitTextToSize(f.question, W-M*2);
        const body = doc.splitTextToSize(a.narrative, W-M*2);
        const need = q.length*16 + body.length*14 + (win ? 34 : 0) + 50;
        if (y + need > H - M) { doc.addPage(); y = M; }
        doc.setFontSize(13); doc.setTextColor(...INK); doc.text(q, M, y); y += q.length*16 + 6;
        doc.setFontSize(9); doc.setTextColor(...GOLD);
        doc.text(f.band.replace(/_/g," ") + "  ·  " + f.confidence + "% confidence", M, y); y += 18;
        doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(body, M, y); y += body.length*14 + 6;
        if (win) { doc.setDrawColor(...GOLD); doc.line(M, y, W-M, y); y += 14;
          doc.setFontSize(9.5); doc.setTextColor(...GOLD);
          doc.text(win.label + ": " + fmtWin(win), M, y); y += 20; }
        y += 16;
      });
    });
    const total = doc.internal.getNumberOfPages();
    for (let i = 2; i <= total; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text(String(i-1), W/2, H-28, { align:"center" }); }
    doc.save("AstroIndicators_InstantClarity_" + (name||"report").replace(/[^\w-]+/g,"_") + ".pdf");
  }

  // ── PDF export (jsPDF) — mirrors the flipbook structure ────────────────────
  function exportPDF(sections, facts) {
    const J = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!J) { alert("PDF library not loaded."); return; }
    const doc = new J({ unit:"pt", format:"a4" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 56; let y = 0;
    const NAVY = [11,14,26], GOLD = [201,164,76], INK = [40,40,44], MUTE = [110,110,120];
    const cd = window.currentData || {};
    const _m = chartModel() || {};
    const f0 = cd.form || {}, d1 = _m.d1 || {}, d9 = _m.d9 || {}, pl = (chartSource().planets) || {};
    const mSign = (k) => (_m.lons && _m.lons[k] != null) ? _m.sign(_m.lons[k]) : ((pl[k] && pl[k].sign) || "");
    const name = f0.name || "";

    // ── cover ────────────────────────────────────────────────────────────────
    doc.setFillColor(...NAVY); doc.rect(0,0,W,H,"F");
    doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.rect(M/2,M/2,W-M,H-M);
    doc.setTextColor(...GOLD); doc.setFontSize(11);
    doc.text("LIFE INDICATORS REPORT", W/2, H/2-110, { align:"center" });
    doc.setTextColor(255,255,255); doc.setFontSize(30);
    doc.text("The Book of", W/2, H/2-62, { align:"center" });
    doc.text("Your Timings", W/2, H/2-28, { align:"center" });
    doc.setFontSize(14); doc.setTextColor(...GOLD);
    if (name) doc.text(String(name), W/2, H/2+16, { align:"center" });
    doc.setFontSize(8); doc.setTextColor(200,200,205);
    const disc = doc.splitTextToSize("Indicative astrological insight for reflection and planning — not medical, legal, or financial advice, and not a guarantee of outcomes. Every reading is computed from your own birth chart (Swiss Ephemeris · Lahiri ayanamsa).", W-M*3);
    doc.text(disc, W/2, H/2+60, { align:"center" });

    const newPage = () => { doc.addPage(); y = M; doc.setTextColor(...INK); };
    const heading = (txt) => { doc.setFontSize(9); doc.setTextColor(...GOLD);
      doc.text(txt.toUpperCase(), M, y); y += 6;
      doc.setDrawColor(...GOLD); doc.line(M, y, W-M, y); y += 20; };

    // ── birth details ────────────────────────────────────────────────────────
    newPage(); heading("Birth Details");
    const rows = [["Name", name], ["Date of birth", f0.dob], ["Time of birth", f0.tob],
      ["Place", f0.place],
      ["Ascendant (D1)", d1.lagnaSign ? d1.lagnaSign + " " + (d1.lagnaDegree||0).toFixed(1) + "°" : ""],
      ["Navamsa lagna (D9)", d9.lagnaSign],
      ["Moon sign", mSign("Moon")],
      ["Nakshatra", pl.Moon ? (pl.Moon.nakshatra||"") + (pl.Moon.pada ? " · pada " + pl.Moon.pada : "") : ""]];
    doc.setFontSize(10);
    for (const [k,v] of rows) { if (!v) continue;
      doc.setTextColor(...MUTE); doc.text(String(k), M, y);
      doc.setTextColor(...INK); doc.text(String(v), M+150, y); y += 17; }

    // ── charts (drawn as grids) ──────────────────────────────────────────────
    const CELLS = { "0,0":11,"0,1":0,"0,2":1,"0,3":2, "1,0":10,"1,3":3,
                    "2,0":9,"2,3":4, "3,0":8,"3,1":7,"3,2":6,"3,3":5 };   // fixed SIGN index per cell
    const SG = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
    const SF = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
    const AB = { Sun:"Su",Moon:"Mo",Mars:"Ma",Mercury:"Me",Jupiter:"Ju",Venus:"Ve",Saturn:"Sa",Rahu:"Ra",Ketu:"Ke" };
    function drawChart(lagnaSign, houses, label, note) {
      const li = SF.indexOf(lagnaSign); if (li < 0) return;
      if (y + 300 > H - M) newPage();
      doc.setFontSize(12); doc.setTextColor(...INK); doc.text(label, M, y); y += 14;
      const S = Math.min(300, W - M*2), C = S/4, x0 = M;
      doc.setDrawColor(...GOLD); doc.setLineWidth(.8);
      for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
        const key = r+","+c; if (!(key in CELLS)) continue;
        const signIdx = CELLS[key];
        const h = ((signIdx - li + 12) % 12) + 1;      // house counted from the lagna
        const x = x0 + c*C, yy = y + r*C;
        if (h === 1) { doc.setFillColor(201,164,76); doc.setGState && doc.setGState(new doc.GState({opacity:.18}));
          doc.rect(x,yy,C,C,"F"); doc.setGState && doc.setGState(new doc.GState({opacity:1})); }
        doc.rect(x,yy,C,C);
        doc.setFontSize(6.5); doc.setTextColor(...MUTE);
        doc.text(SG[signIdx], x+3, yy+9);
        doc.setFontSize(7.5); doc.text(String(h), x+C-3, yy+C-4, { align:"right" });
        doc.setFontSize(6.5);
        if (h===1) doc.text("Asc", x+C-3, yy+9, { align:"right" });
        const occ = (houses && (houses[h] || houses[String(h)])) || [];
        doc.setFontSize(9); doc.setTextColor(...INK);
        occ.forEach((p,i) => doc.text(AB[p]||String(p).slice(0,2), x+6+(i%2)*28, yy+24+Math.floor(i/2)*11));
      }
      y += S + 14;
      doc.setFontSize(8.5); doc.setTextColor(...MUTE);
      const nt = doc.splitTextToSize(note, W-M*2);
      doc.text(nt, M, y); y += nt.length*11 + 8;
      // legend (English — jsPDF core fonts cannot render Tamil glyphs)
      doc.setFontSize(7); doc.setTextColor(...MUTE);
      const leg = Object.keys(AB).map(k => AB[k] + " = " + k).join("   ·   ");
      doc.text(doc.splitTextToSize(leg, W-M*2), M, y); y += 22;
    }
    newPage(); heading("Your Birth Charts");
    drawChart(d1.lagnaSign, d1.houses, "Rasi · D1 — the stage",
      "Think of D1 as the play as it is performed: the set, the cast, the entrances and exits — your body, your circumstances, and the events people can see.");
    drawChart(d9.lagnaSign, d9.houses, "Navamsa · D9 — the root system",
      "If D1 is the tree, D9 is the root. Nobody sees it, and it decides whether the tree survives a storm. A promise strong in D1 but weak here tends to arrive and not stay.");

    // ── life axis ────────────────────────────────────────────────────────────
    newPage(); heading("Your Life Axis");
    const moon = { sign: mSign("Moon"), nakshatra: (pl.Moon && pl.Moon.nakshatra) || "" };
    const sun = { sign: mSign("Sun") };
    const axes = [
      ["Lagna — the life you build", (d1.lagnaSign||"") + (d1.lagnaDegree!=null ? "  "+d1.lagnaDegree.toFixed(1)+"°" : ""), "How you meet the world, and the body you do it in."],
      ["Moon — the mind you carry", (moon.sign||"") + (moon.nakshatra ? " · "+moon.nakshatra : ""), "How you feel, react, and find rest. Your dasha clock is set from here."],
      ["Sun — the self you become", sun.sign||"", "What you are here to stand for, and where you seek recognition."],
      ["Navamsa lagna — what endures", d9.lagnaSign||"", "The inner chart. It decides whether what you build holds when tested."]];
    for (const [k,v,n] of axes) { if (!v) continue;
      doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text(k, M, y);
      doc.setFontSize(12); doc.setTextColor(...INK); doc.text(String(v), W-M, y, { align:"right" }); y += 14;
      doc.setFontSize(8.5); doc.setTextColor(...MUTE);
      doc.text(doc.splitTextToSize(n, W-M*2), M, y); y += 22; }

    // ── life theme ───────────────────────────────────────────────────────────
    const themePick = pickTheme(_m);
    if (themePick) {
      newPage(); heading("Your Life Theme");
      doc.setFontSize(15); doc.setTextColor(...INK);
      doc.text(themePick.a.pair + " — " + themePick.a.name, M, y); y += 24;
      doc.setFontSize(10.5);
      let tx = doc.splitTextToSize(themePick.a.theme, W-M*2); doc.text(tx, M, y); y += tx.length*14 + 12;
      doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text("THE WORK OF THIS BIRTH", M, y); y += 14;
      doc.setFontSize(10.5); doc.setTextColor(...INK);
      tx = doc.splitTextToSize(themePick.a.work, W-M*2); doc.text(tx, M, y); y += tx.length*14 + 14;
      if (themePick.evidence) {
        doc.setFontSize(9); doc.setTextColor(...MUTE);
        tx = doc.splitTextToSize(themePick.evidence, W-M*2); doc.text(tx, M, y); y += tx.length*12 + 10;
      }
      doc.setFontSize(9); doc.setTextColor(...MUTE);
      tx = doc.splitTextToSize("Every domain that follows is a different window onto this same theme. Where a reading feels unexpectedly heavy or unexpectedly easy, it is usually because it sits on or away from this axis.", W-M*2);
      doc.text(tx, M, y);
    }

    // ── domains ──────────────────────────────────────────────────────────────
    newPage();
    let lastCat = "";
    const groups = [];
    for (const sec of sections) {
      const f = byId(facts, sec.module_id); if (!f) continue;
      const cat = CATEGORY_LABEL[f.category] || f.category;
      const g = groups.find(x => x.cat === cat) || (groups.push({cat, items:[]}), groups[groups.length-1]);
      g.items.push({ sec, f });
      const win = f.timing_windows[0];
      const body = doc.splitTextToSize(sec.narrative, W - M*2);
      const need = 96 + body.length*14 + (win ? 34 : 0);
      if (y + need > H - M) newPage();
      if (cat !== lastCat) { lastCat = cat;
        if (y + need + 40 > H - M) newPage();
        doc.setFillColor(...NAVY); doc.rect(M, y, W-M*2, 30, "F");
        doc.setTextColor(...GOLD); doc.setFontSize(10); doc.text(cat.toUpperCase(), M+12, y+20); y += 46; }
      doc.setTextColor(...INK); doc.setFontSize(14); doc.text(sec.heading, M, y); y += 20;
      doc.setFontSize(9); doc.setTextColor(...GOLD);
      doc.text(f.band.replace(/_/g," ") + "  ·  " + f.confidence + "% confidence", M, y); y += 18;
      doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(body, M, y); y += body.length*14 + 6;
      if (win) { doc.setDrawColor(...GOLD); doc.line(M, y, W-M, y); y += 14;
        doc.setFontSize(9.5); doc.setTextColor(...GOLD);
        doc.text(win.label + ": " + fmtWin(win), M, y); y += 22; }
      y += 14;
    }

    // ── worth considering ────────────────────────────────────────────────────
    newPage(); heading("Worth Considering");
    doc.setFontSize(13); doc.setTextColor(...INK); doc.text("What to actually do with this", M, y); y += 24;
    for (const line of worthConsideringLines(groups)) {
      const txt = doc.splitTextToSize(line.action, W - M*2 - 14);
      if (y + txt.length*13 + 26 > H - M) newPage();
      doc.setFontSize(8); doc.setTextColor(...GOLD); doc.text(line.cat.toUpperCase(), M+12, y); y += 12;
      doc.setDrawColor(...GOLD); doc.setLineWidth(1.6);
      doc.line(M+2, y-16, M+2, y + txt.length*13 - 4); doc.setLineWidth(.8);
      doc.setFontSize(10); doc.setTextColor(...INK); doc.text(txt, M+12, y); y += txt.length*13 + 16;
    }

    // ── closing ──────────────────────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(...NAVY); doc.rect(0,0,W,H,"F");
    doc.setDrawColor(...GOLD); doc.rect(M/2,M/2,W-M,H-M);
    doc.setTextColor(...GOLD); doc.setFontSize(20);
    doc.text("Best wishes from", W/2, H/2-40, { align:"center" });
    doc.text("Team AstroIndicators", W/2, H/2-12, { align:"center" });
    doc.setFontSize(10); doc.setTextColor(225,225,230);
    const close = doc.splitTextToSize("We hope you find this useful in getting an indication of how you are navigating and where you are heading" + (name ? ", " + name : "") + ". If you find it useful, please don't hesitate to share it with all those whom you care about. If our work was useful, we'd be grateful for a short review — the Leave a Review button is on the Birth Details page.", W-M*3);
    doc.text(close, W/2, H/2+24, { align:"center" });

    const total = doc.internal.getNumberOfPages();
    for (let i = 2; i < total; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text(String(i-1), W/2, H-28, { align:"center" }); }
    doc.save("AstroIndicators_LifeIndicators_" + (name||"report").replace(/[^\w-]+/g,"_") + ".pdf");
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
