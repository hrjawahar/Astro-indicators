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
  let _extras = null;         // { strengths, guidance } from the engine

  // Canonical disclaimer — identical wording used on the site footer, the flipbook
  // cover, and every generated PDF, so the legal text never drifts between places.
  const CANON_DISCLAIMER = "This app provides astrological analysis (Swiss Ephemeris / Lahiri Ayanamsa) strictly for educational, entertainment, and self-reflective purposes. All timings and interpretations are indicative only and guarantee no outcomes. THIS IS NOT A SUBSTITUTE FOR PROFESSIONAL MEDICAL, PSYCHOLOGICAL, LEGAL, OR FINANCIAL ADVICE. BY USING THIS APP, YOU AGREE THAT ALL CONTENT IS PROVIDED \"AS IS\" AND YOUR USE IS AT YOUR OWN RISK. THE DEVELOPERS EXPLICITLY DISCLAIM ALL WARRANTIES AND ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY LOSS, DAMAGE, OR ACTIONS TAKEN BASED ON THIS DATA.";
  // Short, plain-language disclaimer for the flipbook COVER (the full CANON_DISCLAIMER
  // still appears on the downloadable PDF covers where the complete legal text belongs).
  const COVER_DISCLAIMER = "For educational and self-reflective purposes only — not a substitute for professional medical, psychological, legal, or financial advice. All interpretations are indicative and guarantee no outcomes.";

  function $(id){ return document.getElementById(id); }
  function ord(n){ return n + (["th","st","nd","rd"][(n%100>10&&n%100<14)?0:(n%10<4?n%10:0)]); }
  const SIGN_LORD = { Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",
    Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter" };
  function esc(s){ const d=document.createElement("div"); d.textContent=String(s??""); return d.innerHTML; }
  function price(key, fallback){ return (window.APP_CONFIG?.prices?.[key]) ?? fallback; }
  function fmtWin(w){ const f=s=>{const d=new Date(s);return d.toLocaleString("en-IN",{month:"short",year:"numeric"});};
    return f(w.start_iso)+" – "+f(w.end_iso); }

  // ── engine facts (fetched once per chart, reused by both products) ──────────
  async function getFacts() {
    const cd = window.currentData;
    if (!cd || !cd.chart) throw new Error("Generate your chart first.");
    const cid = window.AI_chartId ? window.AI_chartId() : "";
    if (_facts && _factsChartId === cid) { window._extras = _extras; return _facts; }
    const res = await fetch("/api/facts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chart: cd.chart, gender: cd.form?.gender || "unspecified" }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Engine unavailable.");
    _facts = data.facts; _factsChartId = cid;
    _extras = data.extras || null; window._extras = _extras;
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
  function readerName() {
    const f = (window.currentData && window.currentData.form) || {};
    return (f.callName || f.name || "").trim();
  }
  function renderPersonalStrip() {
    const f = (window.currentData && window.currentData.form) || {};
    const dob = f.dob || (document.getElementById("inputDOB")||{}).value || "";
    const tob = f.tob || (document.getElementById("inputTOB")||{}).value || "";
    const place = f.place || (document.getElementById("inputPlaceDisplay")||{}).value || "";
    if (!dob) return;
    const html = `<div class="pp-personal-lead">This reading is calculated from your birth details:</div>
      <div class="pp-personal-line"><b>${esc(fmtDOB(dob, tob))}</b></div>` +
      (place ? `<div class="pp-personal-line"><b>${esc(place)}</b></div>` : "");
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
    host.innerHTML = `<div class="pp-empty">Reading your chart and writing your report.<br>
      <span style="display:inline-block;margin:10px 0;padding:5px 16px;background:rgba(201,168,76,0.16);border:1px solid rgba(201,168,76,0.6);border-radius:999px;color:#c9a84c;font-weight:700;font-size:1.03em">⏱ This usually takes 1–2 minutes</span><br>
      Please keep this page open — it is built once, then saved so it re-opens instantly.</div>`;
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
  let _bookChartId = null;   // which chart the currently rendered book belongs to

  function renderFlipbook(host, sections, facts) {
    const f0 = (window.currentData && window.currentData.form) || {};
    const cd = window.currentData || {};
    // Snapshot the engine extras for THIS chart now, and pass it explicitly into
    // the pages that use it — so the strengths/guidance pages can never paint a
    // stale module-level _extras left over from a previously viewed chart.
    const extras = _extras;
    _bookChartId = window.AI_chartId ? window.AI_chartId() : null;
    const rn = readerName();
    const name = esc(f0.name || "");
    const coverName = esc(readerName() || f0.name || "");   // same source the letter greets
    const nameComma = rn ? ", " + esc(rn) : "";
    const meta = [f0.dob, f0.tob, f0.place].filter(Boolean).join(" · ");
    _book.meta = meta;
    const _m = chartModel() || {};
    const d1 = _m.d1 || {}, d9 = _m.d9 || {};
    const pl = (chartSource().planets) || {};
    const P = [];

    // ── 1. cover ─────────────────────────────────────────────────────────────
    P.push(`<div class="pg cover"><div class="frame"></div><div class="in">
      <div class="seal">◈</div>
      <div class="logo" style="margin:10px 0 16px">Astro<span>Indicators</span></div>
      <div class="kick" style="color:var(--ai-gold)">Life Indicators Report</div>
      <h1>Life Analysis &amp;<br>Mapping Profile — LAMP</h1>
      <div class="cover-sub">Your personalized blueprint for conscious self-reflection</div>
      <div class="who">${coverName || "&nbsp;"}</div>
      </div>
      <div class="disclaim cover-disc"><b>Disclaimer:</b> ${esc(COVER_DISCLAIMER)}</div>
      </div>`);

    // ── 2. birth details ─────────────────────────────────────────────────────
    const row = (k, v) => v ? `<li><b>${esc(k)}</b><i>${esc(v)}</i></li>` : "";
    P.push(`<div class="pg"><div class="kick">Birth Details</div><div class="rule"></div>
      <ul class="toc bdl">
        ${row("Name", f0.name)}
        ${row("Date of birth", f0.dob)}
        ${row("Time of birth", f0.tob ? f0.tob + " (24-hr)" : "")}
        ${row("Place", f0.place)}
        ${row("Ascendant (D1)", d1.lagnaSign ? d1.lagnaSign + " " + (d1.lagnaDegree||0).toFixed(1) + "°" : "")}
        ${row("Navamsa lagna (D9)", d9.lagnaSign)}
        ${row("Moon sign", (_m.lons && _m.lons.Moon != null) ? _m.sign(_m.lons.Moon) : (pl.Moon && pl.Moon.sign))}
      </ul><span class="pnum">2</span></div>`);

    // ── 3. index ─────────────────────────────────────────────────────────────
    const groups = [];
    let curg = null;
    for (const sec of sections) {
      const f = byId(facts, sec.module_id); if (!f) continue;
      const cat = CATEGORY_LABEL[f.category] || f.category;
      if (!curg || curg.cat !== cat) { curg = { cat, items: [] }; groups.push(curg); }
      curg.items.push({ sec, f });
    }
    let at = 10;                                    // domains begin at page 10
    const fixed = [["A Note Before You Begin", 4], ["Your Birth Chart · D1", 5],
                   ["Your Birth Chart · D9", 6], ["Your Planetary Strengths", 7], ["Your Life Axis", 8],
                   ["Your Life Theme", 9]];
    const tocRows = fixed.map(([t, n]) => `<li><b>${esc(t)}</b><i>${String(n).padStart(2,"0")}</i></li>`)
      .concat(groups.map(gp => { const a = at; at += gp.items.length + 1;
        return `<li><b>${esc(gp.cat)}</b><i>${String(a).padStart(2,"0")}</i></li>`; }))
      .concat([`<li><b>What To Actually Do With This</b><i>${String(at++).padStart(2,"0")}</i></li>`,
               `<li><b>A Closing Note</b><i>${String(at).padStart(2,"0")}</i></li>`]).join("");
    P.push(`<div class="pg"><div class="kick">Contents</div><div class="rule"></div>
      <ul class="toc">${tocRows}</ul><span class="pnum">3</span></div>`);

    // ── 4. opening letter (may run to a second leaf; that's fine) ─────────────
    P.push(openingLetterPage(4));

    // ── 5 & 6. D1 / D9 charts, with beginner metaphors ───────────────────────
    P.push(`<div class="pg"><div class="kick">Your Birth Chart</div><div class="rule"></div>
      <h2>The house from the street</h2>
      <div class="chart-label">Rāśi chart · D1</div>
      <div class="fb-chart" id="fbD1Wrap"></div>
      <div class="chart-note"><b>New to charts? Picture a house you're about to buy.</b> D1 is what you
      see from the street — the shape, the rooms, the life visibly on offer: your body, circumstances,
      and the events others can see. Lagna: <b>${esc(d1.lagnaSign || "")}</b></div>
      ${chartLegend()}<span class="pnum">5</span></div>`);
    P.push(`<div class="pg"><div class="kick">Your Birth Chart</div><div class="rule"></div>
      <h2>The foundation you walk in to inspect</h2>
      <div class="chart-label">Navāṁśa chart · D9</div>
      <div class="fb-chart" id="fbD9Wrap"></div>
      <div class="chart-note"><b>Now you step inside and check the foundation.</b> D9 is what the house is
      truly built on — what will hold, and what will manifest as you actually live in it. A room that
      looks fine from the street (strong D1) but rests on a weak footing (weak D9) tends to need work;
      strong here, it lasts. Lagna: <b>${esc(d9.lagnaSign || "")}</b></div>
      ${chartLegend()}<span class="pnum">6</span></div>`);

    // ── 7. planetary strengths table ─────────────────────────────────────────
    P.push(planetStrengthPage(7, extras));

    // ── 8. life axis (with house lords) ──────────────────────────────────────
    P.push(lifeAxisPage(_m, facts, 8));

    // ── 9. life theme ────────────────────────────────────────────────────────
    P.push(lifeThemePage(_m, 9));

    // ── 10+. domains ─────────────────────────────────────────────────────────
    let n = 10;
    for (const gp of groups) {
      P.push(`<div class="pg sec-divider"><div class="in">
        <div class="seal">◈</div><div class="domain">${esc(gp.cat)}</div>
        <div class="rule"></div></div><span class="pnum">${n++}</span></div>`);
      for (const { sec, f } of gp.items) {
        const win = f.timing_windows[0];
        P.push(`<div class="pg"><div class="kick">${esc(gp.cat)}</div><div class="rule"></div>
          <h2>${esc(sec.heading)}</h2>
          <div class="chiprow"><span class="chip">${esc(f.band.replace(/_/g," "))}</span>
            <span class="chip ghost">${f.confidence}% confidence</span></div>
          <div class="bd">${esc(sec.narrative)}</div>
          ${win ? `<div class="ref">◈ ${esc(win.label)}<b>${esc(fmtWin(win))}</b></div>` : ""}
          <span class="pnum">${n++}</span></div>`);
      }
    }

    // ── what to actually do (concrete, behaviour-level) ──────────────────────
    P.push(guidancePage(n++, extras));

    // ── closing letter ───────────────────────────────────────────────────────
    P.push(closingLetterPage(n++));

    // ── final page ───────────────────────────────────────────────────────────
    P.push(`<div class="pg cover close"><div class="frame"></div><div class="in">
      <div class="seal">◈</div>
      <div class="closing" style="margin-top:16px">May this book help you see, with a little more clarity,
      how you are navigating and where you are heading${nameComma}.</div>
      <div class="closing">If it served you, please share it with those you care about. And if our
      work was useful, we'd value a short review — the <b>Leave a Review</b> button is on the
      Birth Details page.</div>
      <div class="final-signoff"><div class="who">Best wishes,</div>
      <div class="logo">Team Astro<span>Indicators</span></div></div></div></div>`);

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
      <div class="fb-dlbar"><button id="fbFull" class="pp-pay ghost">⛶ Full screen</button>
        <button id="fbPdf" class="pp-pay">Download PDF</button></div>`;

    bindBook();
    bookRender();
    $("fbPdf").onclick = () => exportPDF(sections, facts);
    const fsBtn = $("fbFull");
    if (fsBtn) fsBtn.onclick = () => {
      const box = $("liBook");
      if (!box) return;
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (box.requestFullscreen) { box.classList.add("fb-fs"); box.requestFullscreen().catch(()=>{}); }
      else alert("Full screen isn't supported in this browser.");
    };
    document.addEventListener("fullscreenchange", () => {
      const box = $("liBook"); if (box && !document.fullscreenElement) box.classList.remove("fb-fs");
    });
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


  // ── reader letters (name-aware; "Dear reader" when no name) ─────────────────
  function letterSalutation() { const rn = readerName(); return rn ? "Dear " + esc(rn) + "," : "Dear friend,"; }

  function openingLetterPage(pnum) {
    return `<div class="pg letter"><div class="kick">A Note Before You Begin</div><div class="rule"></div>
      <h2>Why we built this for you</h2>
      <div class="bd letter-bd">
        <p>${letterSalutation()}</p>
        <p>For most of us, the need to consult astrology arises only when something is
        <i>not going as we hoped</i> — rarely when life is going well. That was true for us too. In
        seeking guidance for our own lives, the answers were often hard to interpret, felt clear in the
        moment then <i>dissolved once we left</i>, and an appointment could take <i>weeks to get</i>. And
        still, the two questions that mattered most were left unanswered.</p>
        <p>So we built <b>AstroIndicators</b> — after much learning, research, and testing against real
        charts — with one goal: to give you not <i>prediction</i>, but <b>clarity</b>. A clarity that
        stays within your reach, so you can answer for yourself:</p>
        <p class="letter-q">“Why am I going through what I am going through?”<br>
        “How do I see the road ahead?”</p>
        <p>To do this, the system reads both your <b>D1</b> — what is <i>promised in your foundation</i> —
        and your <b>D9</b> — what <i>takes shape as you grow beyond it</i> — and lays out the reasoning so
        you connect the dots yourself. Our hope is that it helps you <b>relax, reflect, and rejuvenate</b>,
        and begin to meet your questions with understanding.</p>
        <p style="text-align:center;font-style:italic">Happy reading. We'll meet you again at the end.</p>
      </div>
      <span class="pnum">${pnum}</span></div>`;
  }

  function closingLetterPage(pnum) {
    return `<div class="pg letter"><div class="kick">A Closing Note</div><div class="rule"></div>
      <h2>Awareness is where it begins</h2>
      <div class="bd letter-bd">
        <p>${letterSalutation()}</p>
        <p>We hope these indications have given you a genuine sense of awareness, and some answers to the
        questions that may have been quietly weighing on you.</p>
        <p>If a few don't seem to fit, hold them this way: each indication is a <b>signboard on a road</b> —
        it tells you, reliably, <i>what lies ahead and how far</i>. But this signboard carries something
        extra: a <b>weather forecast for the journey</b>. The road is your chart; the weather is your
        <i>timing</i>. Many people share birth details close to yours and travel much the same road — but
        each sets out in a <i>different season</i>. The signboard reads the same for all; the weather each
        meets does not. That is why some indications land squarely and others feel a step away.</p>
        <p>With that awareness, you can begin to sort what lies <b>within your control</b> from what lies
        <b>beyond it</b> — where a quiet, hard-won peace begins.</p>
        <p class="letter-q">“God, grant me the serenity to accept the things I cannot change, the courage
        to change the things I can, and the wisdom to know the difference.”</p>
        <p class="letter-attrib">— the Serenity Prayer, attributed to Dr Reinhold Niebuhr</p>
        <p>That wisdom is well within your reach. Because in the end — <b>awareness and acceptance are
        where suffering ends.</b></p>
      </div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // ── planetary-strength table ────────────────────────────────────────────────
  // ── Functional-status nudge (display-layer) ─────────────────────────────────
  // Mirrors the domain engine's per-lagna benefic/malefic map. The engine's
  // planetStrengths() scores on dignity + house + D9 only; this adds a modest
  // per-lagna functional weight (Y+2, B+1, M-1) at display time, so a yogakaraka
  // or benefic no longer reads identically to a functional malefic in the same
  // dignity/house. It re-derives nature/grade from the adjusted score using the
  // SAME thresholds as the engine. Falls back to the engine's values if the lagna
  // is unknown or a row lacks a numeric score — so it can never blank the table.
  const FS_MAP = {
    Aries:{Sun:"N",Moon:"B",Mars:"Y",Mercury:"N",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
    Taurus:{Sun:"M",Moon:"N",Mars:"M",Mercury:"N",Jupiter:"N",Venus:"B",Saturn:"Y",Rahu:"N",Ketu:"N"},
    Gemini:{Sun:"M",Moon:"M",Mars:"M",Mercury:"Y",Jupiter:"B",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
    Cancer:{Sun:"B",Moon:"N",Mars:"Y",Mercury:"M",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
    Leo:{Sun:"N",Moon:"M",Mars:"Y",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"M",Rahu:"N",Ketu:"N"},
    Virgo:{Sun:"M",Moon:"M",Mars:"M",Mercury:"N",Jupiter:"B",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
    Libra:{Sun:"M",Moon:"M",Mars:"M",Mercury:"B",Jupiter:"N",Venus:"N",Saturn:"Y",Rahu:"N",Ketu:"N"},
    Scorpio:{Sun:"M",Moon:"B",Mars:"Y",Mercury:"N",Jupiter:"M",Venus:"M",Saturn:"M",Rahu:"N",Ketu:"N"},
    Sagittarius:{Sun:"N",Moon:"M",Mars:"M",Mercury:"M",Jupiter:"N",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"},
    Capricorn:{Sun:"M",Moon:"M",Mars:"Y",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
    Aquarius:{Sun:"M",Moon:"M",Mars:"N",Mercury:"B",Jupiter:"N",Venus:"M",Saturn:"N",Rahu:"N",Ketu:"N"},
    Pisces:{Sun:"M",Moon:"N",Mars:"M",Mercury:"N",Jupiter:"B",Venus:"N",Saturn:"M",Rahu:"N",Ketu:"N"}
  };
  const FS_W = { Y:2, B:1, N:0, M:-1 };
  const FS_G2E = { Surya:"Sun",Ravi:"Sun",Chandra:"Moon",Soma:"Moon",Mangala:"Mars",Mangal:"Mars",Kuja:"Mars",Budha:"Mercury",Guru:"Jupiter",Brihaspati:"Jupiter",Shukra:"Venus",Shani:"Saturn",Rahu:"Rahu",Ketu:"Ketu" };
  function fsAdjustRows(rows) {
    try {
      const src = chartSource() || {};
      const lagna = (src.d1 && src.d1.lagnaSign) || "";
      const row = FS_MAP[lagna];
      if (!row || !Array.isArray(rows)) return rows;
      return rows.map(p => {
        if (!p || typeof p.score !== "number") return p;
        const gk = row[p.graha] ? p.graha : (FS_G2E[p.graha] || p.graha);
        const w = FS_W[row[gk] || "N"] || 0;
        if (!w) return p;
        const s = p.score + w;
        const nature = s >= 2 ? "FAVOURABLE" : s <= -2 ? "CHALLENGING" : "NEUTRAL";
        const mag = Math.abs(s);
        const grade = mag >= 4 ? "HIGH" : mag >= 2 ? "MEDIUM" : "LOW";
        return Object.assign({}, p, { score: s, nature, grade });
      });
    } catch (e) { return rows; }
  }

  function planetStrengthPage(pnum, extras) {
    const ex = extras || _extras;
    const rows = fsAdjustRows((ex && ex.strengths) || []);
    const Pl = (chartSource().planets) || {};
    // Navamsha (D9) dignity — computed from each planet's D9 sign, so we can show
    // whether the D1 strength deepens or softens over time. Classical exaltation
    // signs; own sign via SIGN_LORD; everything else neutral.
    const G2E = { Surya:"Sun",Ravi:"Sun",Chandra:"Moon",Soma:"Moon",Mangala:"Mars",Mangal:"Mars",Kuja:"Mars",Budha:"Mercury",Guru:"Jupiter",Brihaspati:"Jupiter",Shukra:"Venus",Shani:"Saturn",Rahu:"Rahu",Ketu:"Ketu" };
    const EXALT = { Sun:"Aries",Moon:"Taurus",Mars:"Capricorn",Mercury:"Virgo",Jupiter:"Cancer",Venus:"Pisces",Saturn:"Libra" };
    const DEBIL = { Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries" };
    const dignOf = (planet, sign) => { if(!sign) return ""; if(EXALT[planet]===sign) return "ex"; if(DEBIL[planet]===sign) return "de"; if(SIGN_LORD[sign]===planet) return "own"; return "neu"; };
    const tierOf = d => d==="ex"?3:d==="own"?2:d==="neu"?1:d==="de"?0:1;
    const digLbl = d => d==="ex"?"Exalt":d==="de"?"Debil":d==="own"?"Own":d==="neu"?"Neutral":"—";
    const d9Cell = (graha) => {
      const gp = Pl[graha] ? graha : (G2E[graha] || graha);
      const pl = Pl[gp];
      if(!pl || !pl.d9sign) return `<span style="color:#9a9a9a">—</span>`;
      const d9 = dignOf(gp, pl.d9sign), dt = tierOf(d9) - tierOf(dignOf(gp, pl.sign));
      const arrow = dt>0?"▲":dt<0?"▼":"▬";
      const col = dt>0?"#2e6e3a":dt<0?"#9a3b2e":"#8a7a45";
      return `<span style="color:${col};font-weight:700;white-space:nowrap">${digLbl(d9)} <span style="font-size:.82em">${arrow}</span></span>`;
    };
    const cell = (p, nat) => {
      if (p.nature !== nat) return "";
      const g = p.grade === "HIGH" ? "H" : p.grade === "MEDIUM" ? "M" : "L";
      return `<span class="ps-dot ps-${p.grade.toLowerCase()}">${g}</span>`;
    };
    const body = rows.map(p => `<tr>
      <td class="ps-name">${esc(p.graha)}</td>
      <td class="ps-fav">${cell(p,"FAVOURABLE")}</td>
      <td class="ps-cha">${cell(p,"CHALLENGING")}</td>
      <td class="ps-neu">${cell(p,"NEUTRAL")}</td>
      <td class="ps-d9" style="text-align:center">${d9Cell(p.graha)}</td></tr>`).join("");
    return `<div class="pg"><div class="kick">Your Planetary Strengths</div><div class="rule"></div>
      <h2>How each planet tends to act for you</h2>
      <div class="ps-legend"><span>H strong · M moderate · L mild</span><span class="ps-legend-d9"><b>In D9:</b> Stronger <b style="color:#2e6e3a">▲</b> · Holds ▬ · Softer <b style="color:#9a3b2e">▼</b></span></div>
      <table class="ps-table"><thead><tr>
        <th>Planet</th><th class="ps-fav">Favourable</th><th class="ps-cha">Challenging</th><th class="ps-neu">Neutral</th><th class="ps-d9" style="text-align:center">In D9</th>
      </tr></thead><tbody>${body}</tbody></table>
      <div class="foot">D1 = how a planet acts now; D9 shows whether that strength deepens or softens over time. See the <b>References</b> page for what each planet signifies.</div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // ── what to actually do (behaviour-level guidance) ──────────────────────────
  function guidancePage(pnum, extras) {
    const lines = ((extras || _extras) && (extras || _extras).guidance) || [];
    const rows = lines.map(l => `<li><b>${esc(l.actor)} · ${ord(l.house)} house</b>${esc(l.text)}</li>`).join("");
    return `<div class="pg"><div class="kick">What To Actually Do With This</div><div class="rule"></div>
      <h2>The few choices that change the most</h2>
      <ul class="guide-list">${rows || '<li>Your chart carries no single dominant friction — steadiness across the board serves you best.</li>'}</ul>
      <div class="ref">◈ Read this again in six months<b>The chart does not change; your position in its timeline does.</b></div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // Life Axis — the anchors the whole book is read against.
  function lifeAxisPage(m, facts, pnum) {
    const d1 = (m && m.d1) || {}, d9 = (m && m.d9) || {};
    const Pl = chartSource().planets || {};
    const lordOf = (sign) => sign ? SIGN_LORD[sign] : "";
    const moonSign = (m && m.lons && m.lons.Moon != null) ? m.sign(m.lons.Moon) : (Pl.Moon && Pl.Moon.sign);
    const sunSign  = (m && m.lons && m.lons.Sun != null) ? m.sign(m.lons.Sun) : (Pl.Sun && Pl.Sun.sign);
    const moonNak  = (Pl.Moon && Pl.Moon.nakshatra) || "";
    const axis = (label, sign, extra, note) => sign
      ? `<div class="axis-row"><div class="axis-k">${esc(label)}</div>
         <div class="axis-v">${esc(sign)}${extra ? " " + esc(extra) : ""} <span class="axis-lord">(lord: ${esc(lordOf(sign))})</span></div>
         <div class="axis-n">${esc(note)}</div></div>` : "";
    let soon = null;
    for (const f of facts) { const w = f.timing_windows[0]; if (!w) continue;
      if (!soon || w.start_iso < soon.start_iso) soon = w; }
    return `<div class="pg"><div class="kick">Your Life Axis</div><div class="rule"></div>
      <h2>The four anchors of your chart</h2>
      ${axis("Lagna — the life you build", d1.lagnaSign, d1.lagnaDegree != null ? d1.lagnaDegree.toFixed(1)+"°" : "", "How you meet the world, and the body you do it in.")}
      ${axis("Moon — the mind you carry", moonSign, moonNak ? "· "+moonNak : "", "How you feel and find rest. Your dasha clock is set from here.")}
      ${axis("Sun — the self you become", sunSign, "", "What you stand for, and where you seek recognition.")}
      ${axis("Navamsa lagna — what endures", d9.lagnaSign, "", "The inner chart. It decides whether what you build holds when tested.")}
      <div class="foot">Please see the <b>References</b> page on this site to learn what each sign, house,
      and planetary lord signifies.</div>
      <span class="pnum">${pnum}</span></div>`;
  }

  // Worth Considering  // Worth Considering — one action-oriented line per domain, derived from bands.
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
  function chartLegend() {
    return `<div class="fb-legend">` + Object.keys(P_ABBR).map(k =>
      `<span><b>${P_ABBR[k]}</b> = ${k}</span>`).join("") + `</div>`;
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
      const lord = SIGN_LORD[SIGNS_FULL[signIdx]] || "";
      const lordAb = P_ABBR[lord] || "";
      out += `<text x="${x+4}" y="${y+11}" font-size="8.5" font-weight="600" fill="#5A4410">${SIGN_ABBR[signIdx]}</text>`;
      out += `<text x="${x+4}" y="${y+C-5}" font-size="7.5" fill="#7A5E1E">${lordAb}</text>`;
      out += `<text x="${x+C-4}" y="${y+C-5}" font-size="10" font-weight="700" fill="${h===1?"#5A4410":"#8A6E2F"}" text-anchor="end">${h}</text>`;
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
    host.innerHTML = `<div class="pp-empty">Reading your chart and preparing your answers.<br>
      <span style="display:inline-block;margin:10px 0;padding:5px 16px;background:rgba(201,168,76,0.16);border:1px solid rgba(201,168,76,0.6);border-radius:999px;color:#c9a84c;font-weight:700;font-size:1.03em">⏱ This usually takes 1–2 minutes</span><br>
      Please keep this page open.</div>`;
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

  // If the birth chart has changed since the flipbook / facts were built, drop the
  // cached facts + extras and clear the rendered book, so it rebuilds from scratch
  // for the new chart. Without this, switching charts left the previous chart's
  // strengths/guidance (and rendered pages) on screen.
  function resetLifeIndicatorsIfChartChanged() {
    const cid = window.AI_chartId ? window.AI_chartId() : null;
    if (_factsChartId && _factsChartId !== cid) {
      _facts = null; _extras = null; _factsChartId = null; window._extras = null;
    }
    if (_bookChartId && _bookChartId !== cid) {
      const host = $("liBook"); if (host) host.innerHTML = "";
      _book = { pages: [], idx: 0, animating: false, target: 0, meta: "" };
      _bookChartId = null;
    }
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
    try {
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
    doc.setFontSize(7.5); doc.setTextColor(180,180,188);
    const iccDisc = doc.splitTextToSize("DISCLAIMER: " + CANON_DISCLAIMER, W-M*2.2);
    doc.text(iccDisc, W/2, H-84 - iccDisc.length*9, { align:"center" });
    doc.setFontSize(8); doc.setTextColor(200,200,205);
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
        doc.setFontSize(13); const q = doc.splitTextToSize(f.question, W-M*2);
        doc.setFontSize(12.5); const body = doc.splitTextToSize(a.narrative, W-M*2-4);
        const need = q.length*16 + body.length*16 + (win ? 34 : 0) + 50;
        if (y + need > H - M) { doc.addPage(); y = M; }
        doc.setFontSize(13); doc.setTextColor(...INK); doc.text(q, M, y); y += q.length*16 + 6;
        doc.setFontSize(9); doc.setTextColor(...GOLD);
        doc.text(f.band.replace(/_/g," ") + "  ·  " + f.confidence + "% confidence", M, y); y += 18;
        doc.setFontSize(12.5); doc.setLineHeightFactor(1.5); doc.setTextColor(...INK); doc.text(body, M, y); doc.setLineHeightFactor(1.15); y += body.length*18 + 8;
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
    } catch (err) {
      console.error("ICC PDF build error:", err);
      try { doc.save("AstroIndicators_InstantClarity.pdf"); }
      catch (e2) { alert("Sorry — the PDF could not be generated. Please try again."); }
    }
  }

  // ── PDF export (jsPDF) — mirrors the flipbook structure ────────────────────
  function exportPDF(sections, facts) {
    try {
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
    const name = readerName() || f0.name || "";

    // ── cover ────────────────────────────────────────────────────────────────
    doc.setFillColor(...NAVY); doc.rect(0,0,W,H,"F");
    doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.rect(M/2,M/2,W-M,H-M);
    doc.setTextColor(...GOLD); doc.setFontSize(12);
    doc.text("LAMP REPORT", W/2, H/2-140, { align:"center" });
    doc.setTextColor(255,255,255); doc.setFontSize(28);
    doc.text("Life Analysis &", W/2, H/2-98, { align:"center" });
    doc.text("Mapping Profile — LAMP", W/2, H/2-66, { align:"center" });
    doc.setFontSize(11); doc.setTextColor(...GOLD);
    doc.text("Your personalized blueprint for conscious self-reflection", W/2, H/2-38, { align:"center" });
    doc.setFontSize(15); doc.setTextColor(255,255,255);
    if (name) doc.text(String(name), W/2, H/2+6, { align:"center" });
    if (_book.meta) { doc.setFontSize(9); doc.setTextColor(210,210,215);
      doc.text(_book.meta, W/2, H/2+24, { align:"center" }); }
    // hardened disclaimer, larger + readable
    doc.setTextColor(215,215,220); doc.setFontSize(9);
    const disc = doc.splitTextToSize("DISCLAIMER: " + CANON_DISCLAIMER, W-M*2.2);
    doc.text(disc, W/2, H - M - disc.length*11 - 4, { align:"center" });

    const newPage = () => { doc.addPage(); y = M; doc.setTextColor(...INK); };
    const heading = (txt) => { doc.setFontSize(11); doc.setTextColor(...GOLD);
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
        if (h === 1) {
          // ascendant cell tint — GState is unavailable in the UMD build, so
          // fall back to a light solid gold fill instead of opacity.
          if (typeof doc.GState === "function" && doc.setGState) {
            doc.setFillColor(201,164,76); doc.setGState(new doc.GState({opacity:.18}));
            doc.rect(x,yy,C,C,"F"); doc.setGState(new doc.GState({opacity:1}));
          } else {
            doc.setFillColor(245,225,170); doc.rect(x,yy,C,C,"F");
          }
        }
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
    // opening letter
    newPage(); heading("A Note Before You Begin");
    doc.setFontSize(13); doc.setTextColor(...INK); doc.text("Why we built this for you", M, y); y += 22;
    const rn = readerName();
    doc.setFontSize(10.5);
    const para = (t) => { doc.setFontSize(10.5); const tx = doc.splitTextToSize(t, W-M*2); if (y+tx.length*15>H-M) newPage();
      doc.setTextColor(...INK); doc.text(tx, M, y); y += tx.length*14 + 8; };
    para((rn ? "Dear " + rn + "," : "Dear reader,"));
    para("For most of us, the need to consult astrology arises only when something is not going as we hoped — rarely when life is going well. That was true for us too. The guidance we sought was often hard to interpret, felt clear in the moment then dissolved once we left, and still left the two questions that mattered most unanswered.");
    para("So we built AstroIndicators with one goal: to give you not prediction, but clarity — a clarity that stays within your reach, so you can answer for yourself: Why am I going through what I am going through? And how do I see the road ahead?");
    para("The system reads both your D1 (what is promised in your foundation) and your D9 (what takes shape as you grow beyond it), and lays out the reasoning so you connect the dots yourself. Our hope is that it helps you relax, reflect, and rejuvenate. Happy reading — we'll meet you again at the end.");

    newPage(); heading("Your Birth Charts");
    drawChart(d1.lagnaSign, d1.houses, "Rasi · D1 — the stage",
      "Think of D1 as the play as it is performed: the set, the cast, the entrances and exits — your body, your circumstances, and the events people can see.");
    drawChart(d9.lagnaSign, d9.houses, "Navamsa · D9 — the root system",
      "If D1 is the tree, D9 is the root. Nobody sees it, and it decides whether the tree survives a storm. A promise strong in D1 but weak here tends to arrive and not stay.");

    // ── planetary strengths ──────────────────────────────────────────────────
    const strengths = fsAdjustRows((window._extras && window._extras.strengths) || []);
    if (strengths.length) {
      newPage(); heading("Your Planetary Strengths");
      const Pl9 = (chartSource().planets) || {};
      const G2E = { Surya:"Sun",Ravi:"Sun",Chandra:"Moon",Soma:"Moon",Mangala:"Mars",Mangal:"Mars",Kuja:"Mars",Budha:"Mercury",Guru:"Jupiter",Brihaspati:"Jupiter",Shukra:"Venus",Shani:"Saturn",Rahu:"Rahu",Ketu:"Ketu" };
      const EX = { Sun:"Aries",Moon:"Taurus",Mars:"Capricorn",Mercury:"Virgo",Jupiter:"Cancer",Venus:"Pisces",Saturn:"Libra" };
      const DE = { Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries" };
      const dg = (pn,sg) => { if(!sg) return ""; if(EX[pn]===sg) return "ex"; if(DE[pn]===sg) return "de"; if(SIGN_LORD[sg]===pn) return "own"; return "neu"; };
      const trk = d => d==="ex"?3:d==="own"?2:d==="neu"?1:d==="de"?0:1;
      const dl = d => d==="ex"?"Exalted":d==="de"?"Debilit.":d==="own"?"Own":d==="neu"?"Neutral":"-";
      doc.setFontSize(10.5); doc.setTextColor(...INK);
      doc.text("How each planet tends to act for you", M, y); y += 16;
      doc.setFontSize(8); doc.setTextColor(...MUTE);
      doc.text("High/Med/Low = D1 influence.   In D9 = Navamsha standing (^ strengthens, - holds, v softens from D1).", M, y); y += 18;
      const cw = (W-M*2)/5;
      doc.setFontSize(8.5); doc.setTextColor(...GOLD);
      ["Planet","Favourable","Challenging","Neutral","In D9"].forEach((hd,i)=>doc.text(hd, M+cw*i+4, y));
      y += 6; doc.setDrawColor(...GOLD); doc.line(M,y,W-M,y); y += 14;
      doc.setFontSize(10);
      const gr = { HIGH:"High", MEDIUM:"Med", LOW:"Low" };
      for (const p of strengths) {
        if (y > H-M-16) { newPage(); }
        doc.setTextColor(...INK); doc.text(p.graha, M+4, y);
        const col = p.nature==="FAVOURABLE"?1:p.nature==="CHALLENGING"?2:3;
        doc.setTextColor(...(p.nature==="CHALLENGING"?[154,59,46]:p.nature==="FAVOURABLE"?[46,110,58]:MUTE));
        doc.text(gr[p.grade], M+cw*col+4, y);
        const gp9 = Pl9[p.graha] ? p.graha : (G2E[p.graha] || p.graha);
        const pl9 = Pl9[gp9];
        if (pl9 && pl9.d9sign) {
          const d9 = dg(gp9, pl9.d9sign), dt = trk(d9) - trk(dg(gp9, pl9.sign));
          doc.setTextColor(...(dt>0?[46,110,58]:dt<0?[154,59,46]:MUTE));
          doc.text(dl(d9) + (dt>0?" ^":dt<0?" v":" -"), M+cw*4+4, y);
        } else { doc.setTextColor(...MUTE); doc.text("-", M+cw*4+4, y); }
        y += 16;
      }
      y += 4; doc.setFontSize(8); doc.setTextColor(...MUTE);
      doc.text(doc.splitTextToSize("D1 shows how a planet acts now; D9 (Navamsha) shows whether that strength deepens or softens over time. See the References page to learn what each planet signifies.", W-M*2), M, y);
    }

    // ── life axis ────────────────────────────────────────────────────────────
    newPage(); heading("Your Life Axis");
    const moon = { sign: mSign("Moon"), nakshatra: (pl.Moon && pl.Moon.nakshatra) || "" };
    const sun = { sign: mSign("Sun") };
    const axes = [
      ["Lagna — the life you build", (d1.lagnaSign||"") + (d1.lagnaDegree!=null ? "  "+d1.lagnaDegree.toFixed(1)+"°" : ""), "How you meet the world, and the body you do it in."],
      ["Moon — the mind you carry", (moon.sign||"") + (moon.nakshatra ? " · "+moon.nakshatra : ""), "How you feel, react, and find rest. Your dasha clock is set from here."],
      ["Sun — the self you become", sun.sign||"", "What you are here to stand for, and where you seek recognition."],
      ["Navamsa lagna — what endures", d9.lagnaSign||"", "The inner chart. It decides whether what you build holds when tested."]];
    const LORD = { Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter" };
    const signOf = (v) => (v||"").split(" ")[0];
    for (const [k,v,n] of axes) { if (!v) continue;
      doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text(k, M, y); y += 15;
      const lord = LORD[signOf(v)] ? "  (lord: " + LORD[signOf(v)] + ")" : "";
      doc.setFontSize(12); doc.setTextColor(...INK); doc.text(String(v)+lord, M, y); y += 13;
      doc.setFontSize(8.5); doc.setTextColor(...MUTE);
      doc.text(doc.splitTextToSize(n, W-M*2), M, y); y += 22; }
    y += 4; doc.setFontSize(8); doc.setTextColor(...MUTE);
    doc.text(doc.splitTextToSize("Please see the References page on this site to learn what each sign, house, and planetary lord signifies.", W-M*2), M, y);

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
      doc.setFontSize(12.5);                        // set BEFORE splitting so wrap width matches render
      const body = doc.splitTextToSize(sec.narrative, W - M*2 - 4);
      const need = 96 + body.length*18 + (win ? 34 : 0);
      if (y + need > H - M) newPage();
      if (cat !== lastCat) { lastCat = cat;
        if (y + need + 40 > H - M) newPage();
        doc.setFillColor(...NAVY); doc.rect(M, y, W-M*2, 30, "F");
        doc.setTextColor(...GOLD); doc.setFontSize(10); doc.text(cat.toUpperCase(), M+12, y+20); y += 46; }
      doc.setTextColor(...INK); doc.setFontSize(16); doc.text(sec.heading, M, y); y += 24;
      doc.setFontSize(9); doc.setTextColor(...GOLD);
      doc.text(f.band.replace(/_/g," ") + "  ·  " + f.confidence + "% confidence", M, y); y += 18;
      doc.setFontSize(12.5); doc.setLineHeightFactor(1.5); doc.setTextColor(...INK); doc.text(body, M, y); doc.setLineHeightFactor(1.15); y += body.length*18 + 8;
      if (win) { doc.setDrawColor(...GOLD); doc.line(M, y, W-M, y); y += 14;
        doc.setFontSize(9.5); doc.setTextColor(...GOLD);
        doc.text(win.label + ": " + fmtWin(win), M, y); y += 22; }
      y += 14;
    }

    // ── what to actually do (concrete guidance) ──────────────────────────────
    newPage(); heading("What To Actually Do With This");
    doc.setFontSize(13); doc.setTextColor(...INK); doc.text("The few choices that change the most", M, y); y += 24;
    const guide = (window._extras && window._extras.guidance) || [];
    for (const l of guide) {
      const label = l.actor + " · " + l.house + (l.house===1?"st":l.house===2?"nd":l.house===3?"rd":"th") + " house";
      const txt = doc.splitTextToSize(l.text, W - M*2 - 14);
      if (y + txt.length*13 + 30 > H - M) newPage();
      doc.setFontSize(8); doc.setTextColor(...GOLD); doc.text(label.toUpperCase(), M+12, y); y += 13;
      doc.setDrawColor(...GOLD); doc.setLineWidth(1.6);
      doc.line(M+2, y-17, M+2, y + txt.length*13 - 4); doc.setLineWidth(.8);
      doc.setFontSize(10); doc.setTextColor(...INK); doc.text(txt, M+12, y); y += txt.length*13 + 16;
    }

    // ── closing letter ───────────────────────────────────────────────────────
    newPage(); heading("A Closing Note");
    doc.setFontSize(13); doc.setTextColor(...INK); doc.text("Awareness is where it begins", M, y); y += 22;
    doc.setFontSize(10.5);
    para((rn ? "Dear " + rn + "," : "Dear reader,"));
    para("We hope these indications have given you a genuine sense of awareness, and some answers to the questions that may have been quietly weighing on you.");
    para("If a few don't seem to fit, hold them this way: each indication is a signboard on a road — it tells you, reliably, what lies ahead and how far. But this signboard carries a weather forecast too. The road is your chart; the weather is your timing. Many people share birth details close to yours and travel much the same road, but each sets out in a different season. The signboard reads the same for all; the weather each meets does not — which is why some indications land squarely and others feel a step away.");
    para("With that awareness, you can begin to sort what lies within your control from what lies beyond it. As the Serenity Prayer asks: grant me the serenity to accept what I cannot change, the courage to change what I can, and the wisdom to know the difference. Because in the end — awareness and acceptance are where suffering ends.");

    // ── final page ─────────────────────────────────────────────────────────────
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
    } catch (err) {
      console.error("PDF build error:", err);
      try { doc.save("AstroIndicators_LifeIndicators.pdf"); }
      catch (e2) { alert("Sorry — the PDF could not be generated. Please try again or use the on-screen book."); }
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
  function requireEmail(resumeItem, resumeAmount, resumeLabel, resumeRun) {
    var email = "";
    try { email = (document.getElementById("inputEmail") || {}).value || ""; } catch (e) {}
    email = email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
    // arrange a one-shot return to the paid tab + payment once a valid email is typed
    if (resumeItem) {
      var ef2 = document.getElementById("inputEmail");
      if (ef2) {
        var resume = function () {
          var v = (ef2.value || "").trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
          ef2.removeEventListener("blur", resume); ef2.removeEventListener("change", resume);
          var backTab = resumeItem === "icc" ? "iccTab" : "lifeIndTab";
          document.querySelector('.nav-tab[data-tab="'+backTab+'"]')?.click();
          setTimeout(function(){ payThenRun(resumeItem, resumeAmount, resumeLabel, resumeRun); }, 200);
        };
        ef2.addEventListener("blur", resume);
        ef2.addEventListener("change", resume);
      }
    }
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

    const email = requireEmail(item, amount, label, run);
    if (!email) return;
    // No-refund confirmation removed here — it is covered by the onboarding
    // click-wrap terms the user must accept before using the app.

    window.startPayment({ item, amount, label: label + " — pay once & download", email, chartId: cid })
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
        resetLifeIndicatorsIfChartChanged();
        renderTeasers();
        if (b.dataset.tab === "iccTab") { resetICCIfChartChanged(); restoreICC(); }
      }));
  });
})();
