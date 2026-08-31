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
  // Referral & Reward: the buyer's friendly Client ID (from referral-ui.js).
  // Falls back to deriving it from AI_chartId directly, so it works even if
  // onChartGenerated was never called; returns "" if the module is absent —
  // every caller below renders nothing in that case.
  function clientCode(){
    try {
      if (window.AIref) {
        const got = AIref.getClientCode();
        if (got) return got;
        // AI_chartId is a FUNCTION in this codebase (see _bookChartId) — resolve it.
        const cid = (typeof window.AI_chartId === "function") ? window.AI_chartId() : window.AI_chartId;
        return cid ? AIref.friendlyCode(cid) : "";
      }
    } catch (e) {}
    return "";
  }
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
          <div>◈ ${esc(f.proactive_step.slice(0, 55))}…</div>
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
    // Bring the progress message into view — after payment the page is often
    // scrolled elsewhere, leaving the user staring at a seemingly frozen screen.
    // rAF lets the DOM paint the message first, then we scroll to it.
    try {
      requestAnimationFrame(function () {
        host.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (e) {
      try { host.scrollIntoView(); } catch (_) {}
    }
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
        srv({ action:"store", chartId: cid, item:"lifeIndicators", lang:"en", sections,
              paymentId: (window.AI_lastPayment && window.AI_lastPayment.lifeIndicators) || null });
      }
      renderFlipbook(host, sections, facts);
    } catch (e) { host.innerHTML = `<div class="pp-empty">${esc(e.message)}</div>`; }
  }

  // ═══ DOMAIN REPORTS (Career, Marriage, …) — API-written, same flipbook shell ═══
  // Shared flipbook state (used by both LAMP and domain reports).
  let _book = { pages: [], idx: 0, animating: false, target: 0, meta: "" };
  const DOMAIN_KEYS = ["self","career","siblings","mother","children","health","marriage"];
  const DOMAIN_LABELS = {
    self:"Self & Character", career:"Career", siblings:"Siblings & Courage",
    mother:"Mother & Home", children:"Children", health:"Health & Wellbeing", marriage:"Marriage"
  };
  const DOMAIN_ITEM = (k) => "domain_" + k;   // paid_reports item string per domain

  function renderDomainPicker() {
    const wrap = $("domainPicker"); if (!wrap) return;
    const ready = !!(window.currentData && window.currentData.chart);
    if (!ready) { wrap.innerHTML = `<div class="pp-empty">Generate your chart first (Birth Data tab).</div>`; return; }
    const P = price;
    const DOMAIN_BLURB = {
      self:"Your soul, character, and life-direction — read from D1 and D9.",
      career:"Career path, timing, and direction — confirmed by the D10 chart.",
      siblings:"Siblings, courage, and initiative — confirmed by the D3 chart.",
      mother:"Mother, home, and inner security — confirmed by the D4 chart.",
      children:"Children, creativity, and progeny — confirmed by the D7 chart.",
      health:"Health, vitality, and resilience — read from D1 (6th & 8th) and D9.",
      marriage:"Marriage, partnership, and timing — confirmed by the D9 chart.",
    };
    wrap.innerHTML = DOMAIN_KEYS.map(k => `
      <div class="icc-pick" data-domain="${k}">
        <div class="icc-num">\u2726</div>
        <div style="flex:1">
          <div class="icc-q">${esc(DOMAIN_LABELS[k])} Blueprint</div>
          <span class="icc-hint">${esc(DOMAIN_BLURB[k]||"")}</span>
        </div>
        <button class="pp-pay" data-domain-buy="${k}" style="flex:0 0 auto">\u20B9${P(DOMAIN_ITEM(k),750)}</button>
      </div>`).join("");
    wrap.querySelectorAll("[data-domain-buy]").forEach(btn => {
      const k = btn.getAttribute("data-domain-buy");
      btn.onclick = () => payThenRun(DOMAIN_ITEM(k), P(DOMAIN_ITEM(k),750),
        DOMAIN_LABELS[k] + " Blueprint", () => openDomainReport(k));
    });
  }

  async function openDomainReport(domainKey) {
    const host = $("domainReport"); if (!host) return;
    host.innerHTML = `<div class="pp-empty">Reading your ${esc(DOMAIN_LABELS[domainKey]||"domain")} blueprint.<br>
      <span style="display:inline-block;margin:10px 0;padding:5px 16px;background:rgba(201,168,76,0.16);border:1px solid rgba(201,168,76,0.6);border-radius:999px;color:#c9a84c;font-weight:700">⏱ This usually takes 1–2 minutes</span><br>
      Please keep this page open.</div>`;
    try { host.scrollIntoView(); } catch (_) {}
    try {
      const cid = window.AI_chartId();
      const item = DOMAIN_ITEM(domainKey);
      const cached = await srv({ action:"fetch", chartId: cid, item, lang:"en" });
      let sections = cached && cached.sections;
      if (!sections) {
        const facts = (window.currentData && window.currentData.analysis
                      && window.currentData.analysis.domainFacts
                      && window.currentData.analysis.domainFacts[domainKey]) || null;
        if (!facts) throw new Error("Chart facts unavailable — please regenerate your chart.");
        const res = await fetch("/api/domain-report", {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ domainKey, facts })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Report writer unavailable.");
        sections = data.sections || [];
        srv({ action:"store", chartId: cid, item, lang:"en", sections,
              paymentId: (window.AI_lastPayment && window.AI_lastPayment[item]) || null });
      }
      renderDomainFlipbook(host, domainKey, sections);
    } catch (e) { host.innerHTML = `<div class="pp-empty">${esc(e.message)}</div>`; }
  }

  // Comparison page: D1 · D9 · divisional side-by-side, per planet, with a short note.
  function domainComparisonPage(domainKey, pnum) {
    const facts = (window.currentData && window.currentData.analysis
                  && window.currentData.analysis.domainFacts
                  && window.currentData.analysis.domainFacts[domainKey]) || null;
    if (!facts || !facts.d1 || !facts.d1.placements) return "";
    const PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
    const d1P = facts.d1.placements;
    // D9 placements: derive from d9.houses (house→planets) — invert to planet→house
    const d9P = {};
    if (facts.d9 && facts.d9.houses) {
      for (const h of Object.keys(facts.d9.houses)) for (const p of (facts.d9.houses[h]||[])) d9P[p] = { house:+h };
    }
    const vP = (facts.vargaChart && facts.vargaChart.placements) || null;
    const vLabel = facts.divisional || (domainKey==="marriage"?"D9":"—");
    // short per-planet note anchored to the domain
    const NOTE = (p) => {
      const a = d1P[p]; if (!a) return "";
      if (a.dignity === "Exalted") return "strong — a genuine asset here";
      if (a.dignity === "Debilitated") return "under pressure — handle with care";
      if (a.dignity === "Own sign") return "at home — reliable strength";
      if (p === facts.karakaPlanet) return "your "+facts.karaka+" — key to this domain";
      if (facts.d1.houseLord === p) return "rules your "+facts.houseName+" house";
      return "";
    };
    const rows = PLANETS.filter(p=>d1P[p]).map(p => {
      const a = d1P[p];
      const d9h = d9P[p] ? (ordK(d9P[p].house)) : "—";
      const vh = (vP && vP[p]) ? (vP[p].sign+" "+ordK(vP[p].house)) : (domainKey==="marriage"?"(see D9)":"—");
      return `<tr style="border-bottom:1px solid rgba(201,168,76,.12)">
        <td style="font-weight:600;padding:2px 4px">${esc(p)}</td>
        <td style="padding:2px 4px">${esc(a.sign)} ${esc(ordK(a.house))}${a.dignity&&a.dignity!=="Neutral"?" · "+esc(a.dignity):""}</td>
        <td style="padding:2px 4px">${esc(d9h)}</td>
        <td style="padding:2px 4px">${esc(vh)}</td>
        <td style="opacity:.8;padding:2px 4px">${esc(NOTE(p))}</td>
      </tr>`;
    }).join("");
    return `<div class="pg"><div class="kick">Chart Comparison</div><div class="rule"></div>
      <h2 style="font-size:1.15rem">D1 · D9 · ${esc(vLabel)} at a glance</h2>
      <div class="bd" style="margin-bottom:6px;font-size:.82rem">Where a planet holds strength across more than one chart, that agreement is the most reliable signal in your reading.</div>
      <table class="cmp-table" style="width:100%;border-collapse:collapse;font-size:.72rem;line-height:1.25">
        <thead><tr style="color:var(--ai-gold);text-align:left;border-bottom:1px solid rgba(201,168,76,.4)">
          <th style="padding:3px 4px">Planet</th><th style="padding:3px 4px">D1 (birth)</th>
          <th style="padding:3px 4px">D9</th><th style="padding:3px 4px">${esc(vLabel)}</th>
          <th style="padding:3px 4px">Note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="foot" style="margin-top:8px;font-size:.72rem">Houses are counted from each chart's own ascendant. “—” means the planet's divisional position isn't a focus for this domain.</div>
      <span class="pnum">${pnum}</span></div>`;
  }

  function domainSectionsToPages(domainKey, sections) {
    const f0 = (window.currentData && window.currentData.form) || {};
    const title = (DOMAIN_LABELS[domainKey]||"Domain") + " Blueprint";
    const P = [];
    // Cover
    P.push(`<div class="pg cover"><div class="frame"></div><div class="in">
      <div class="seal">◈</div>
      <div class="logo" style="margin:10px 0 16px">Astro<span>Indicators</span></div>
      <div class="kick" style="color:var(--ai-gold)">${esc(DOMAIN_LABELS[domainKey]||"")} Report</div>
      <h1>${esc(title)}</h1>
      <div class="cover-sub">A Vedic reading of your ${esc(DOMAIN_LABELS[domainKey]||"")}</div>
      <div class="cover-meta" style="margin-top:14px;opacity:.85">${esc(fmtDOB(f0.dob,f0.tob)||"")} · ${esc(f0.place||"")}</div>
      </div></div>`);
    // Birth details
    const _cc = clientCode();
    P.push(`<div class="pg"><div class="kick">Birth Details</div><div class="rule"></div>
      <ul class="toc bdl">
        <li><b>Name</b><i>${esc(f0.name||"—")}</i></li>
        <li><b>Date of birth</b><i>${esc(f0.dob||"—")}</i></li>
        <li><b>Time of birth</b><i>${esc(f0.tob?f0.tob+" (24-hr)":"—")}</i></li>
        <li><b>Place</b><i>${esc(f0.place||"—")}</i></li>
        ${_cc?`<li><b>Client ID</b><i>${esc(_cc)}</i></li>`:""}
      </ul>
      <span class="pnum">2</span></div>`);
    const cmp = domainComparisonPage(domainKey, 0);
    let n = 3;
    const PAGE_BUDGET = 1050;   // chars a single page comfortably holds
    const emitSection = (sec) => {
      const heading = esc(sec.heading||"");
      const paras = String(sec.body||"").split(/\n\s*\n|\n/).map(s=>s.trim()).filter(Boolean);
      const total = paras.reduce((a,p)=>a+p.length+2, 0);
      // How many pages this section needs, then a BALANCED target per page so the
      // last page is never left with a lone orphan line.
      const pagesNeeded = Math.max(1, Math.ceil(total / PAGE_BUDGET));
      const targetPerPage = Math.ceil(total / pagesNeeded);
      const chunks = [];
      let cur = "", curLen = 0;
      for (const p of paras) {
        const add = p.length + 2;
        // start a new page only when we've reached the balanced target AND there's
        // already content — keeps whole paragraphs together, pages evenly filled.
        if (cur && curLen + add > targetPerPage && chunks.length < pagesNeeded - 1) {
          chunks.push(cur); cur = p; curLen = add;
        } else {
          cur = cur ? (cur + "\n\n" + p) : p; curLen += add;
        }
      }
      if (cur) chunks.push(cur);
      if (!chunks.length) chunks.push("");
      const many = chunks.length > 1;
      chunks.forEach((chunk, ci) => {
        const contHead = ci===0 ? heading : heading + (many ? " <span style=\"opacity:.55;font-size:.75em\">(continued)</span>" : "");
        const bodyHtml = esc(chunk).replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>");
        P.push(`<div class="pg"><div class="kick">${esc(title)}</div><div class="rule"></div>
          <h2>${contHead}</h2>
          <div class="bd"><p>${bodyHtml}</p></div>
          <span class="pnum">${n++}</span></div>`);
      });
    };
    sections.forEach((sec, si) => {
      emitSection(sec);
      if (si === 0 && cmp) P.push(cmp.replace(/<span class="pnum">0<\/span>/, `<span class="pnum">${n++}</span>`));
    });
    // Close with disclaimer (stronger for health)
    const disc = (domainKey==="health")
      ? "This wellbeing blueprint is for self-reflection only and is NOT medical advice, diagnosis, or treatment. Always consult a qualified doctor for any health concern."
      : "This blueprint offers interpretive guidance for reflection, in the spirit of the classical texts — not a prediction of fixed outcomes.";
    P.push(`<div class="pg"><div class="kick">${esc(title)}</div><div class="rule"></div>
      <h2>A closing note</h2>
      <div class="bd">${esc(disc)}</div>
      <div class="foot" style="margin-top:12px">You are encouraged to sit with this reading against your own lived experience — that is the truest test of any blueprint.</div>
      ${(function(){ const _cc = clientCode(); return _cc ? `<div class="closing" style="margin-top:14px">Your Client ID<br><b style="font-size:1.3em;letter-spacing:.1em">${esc(_cc)}</b><br><span style="opacity:.85">astroindicators.com</span></div>` : ""; })()}
      <span class="pnum">${n++}</span></div>`);
    return P;
  }

  function renderDomainFlipbook(host, domainKey, sections) {
    const P = domainSectionsToPages(domainKey, sections);
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
    $("fbPdf").onclick = () => exportDomainPDF(domainKey, sections);
    const fsBtn = $("fbFull");
    if (fsBtn) fsBtn.onclick = () => {
      const box = $("domainReport"); if (!box) return;
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      if (box.requestFullscreen) { box.classList.add("fb-fs"); box.requestFullscreen().catch(()=>{}); }
    };
    try { requestAnimationFrame(function(){ var bar=document.querySelector("#domainReport .fb-dlbar")||$("fbPdf"); if(bar) bar.scrollIntoView({behavior:"smooth",block:"center"}); }); } catch(e){}
  }

  function exportDomainPDF(domainKey, sections) {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF library not loaded. Refresh and retry."); return; }
    try {
      const jsPDF = window.jspdf.jsPDF;
      const doc = new jsPDF({ unit:"pt", format:"a4" });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      const M = 56; let y = 0;
      const GOLD=[201,164,76], INK=[40,40,44], MUTE=[110,110,120];
      const f0 = (window.currentData && window.currentData.form) || {};
      const title = (DOMAIN_LABELS[domainKey]||"Domain") + " Blueprint";
      const newPage=()=>{ doc.addPage(); y=M; };
      const kbreak=(need)=>{ if(y+need>H-M) newPage(); };
      const para=(t,size,color,gap)=>{ doc.setFont("helvetica","normal"); doc.setFontSize(size); doc.setTextColor(...color); const L=doc.splitTextToSize(t,W-M*2); kbreak(L.length*(size+2.5)+6); doc.text(L,M,y); y+=L.length*(size+2.5)+(gap||0); };
      const sectionHeading=(t)=>{ kbreak(72); doc.setFont("helvetica","bold"); doc.setFontSize(13.5); doc.setTextColor(176,130,38); const L=doc.splitTextToSize(t,W-M*2); doc.text(L,M,y); y+=L.length*17+3; doc.setDrawColor(220,205,170); doc.setLineWidth(0.5); doc.line(M,y,M+70,y); y+=12; doc.setFont("helvetica","normal"); };
      // header
      doc.setFillColor(11,14,26); doc.rect(0,0,W,72,"F");
      doc.setTextColor(201,164,76); doc.setFont("helvetica","bold"); doc.setFontSize(18);
      doc.text("AstroIndicators", M, 42);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(180,188,200);
      doc.text("Swiss Ephemeris · Lahiri Ayanamsha", M, 58);
      y = 100;
      doc.setTextColor(...INK); doc.setFont("helvetica","bold"); doc.setFontSize(17);
      doc.text(title, M, y); y+=20;
      doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...MUTE);
      doc.text((fmtDOB(f0.dob,f0.tob)||"") + "  ·  " + (f0.place||""), M, y); y+=8;
      doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.line(M,y,W-M,y); y+=22;
      // Comparison table renderer (called AFTER the first/context section)
      const drawComparison = () => {
        try {
          const facts = (window.currentData && window.currentData.analysis
                        && window.currentData.analysis.domainFacts
                        && window.currentData.analysis.domainFacts[domainKey]) || null;
          if (!(facts && facts.d1 && facts.d1.placements)) return;
          const PLANETS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
          const d1P=facts.d1.placements, vP=(facts.vargaChart&&facts.vargaChart.placements)||null;
          const d9P={}; if(facts.d9&&facts.d9.houses){ for(const h of Object.keys(facts.d9.houses)) for(const p of (facts.d9.houses[h]||[])) d9P[p]={house:+h}; }
          const vLabel=facts.divisional||(domainKey==="marriage"?"D9":"—");
          const ordP=(x)=>{var s=["th","st","nd","rd"],v=x%100;return x+(s[(v-20)%10]||s[v]||s[0]);};
          sectionHeading("Chart Comparison — D1 · D9 · "+vLabel);
          const SGN3 = (s)=> (s||"").slice(0,3);  // Sagittarius→Sag, prevents overflow
          doc.setFontSize(8.5);
          // column x-positions with enough width; last col wide for the note
          const cP=M, cD1=M+70, cD9=M+180, cDx=M+225, cN=M+320;
          doc.setTextColor(...MUTE); doc.setFont("helvetica","bold");
          doc.text("Planet",cP,y); doc.text("D1 (birth)",cD1,y); doc.text("D9",cD9,y); doc.text(vLabel,cDx,y); doc.text("Note",cN,y);
          y+=4; doc.setDrawColor(220,205,170); doc.setLineWidth(0.4); doc.line(M,y,W-M,y); y+=11;
          doc.setFont("helvetica","normal");
          for(const p of PLANETS){ const a=d1P[p]; if(!a) continue; kbreak(14);
            const d9h=d9P[p]?ordP(d9P[p].house):"—";
            const vh=(vP&&vP[p])?(SGN3(vP[p].sign)+" "+ordP(vP[p].house)):(domainKey==="marriage"?"see D9":"—");
            let note=""; if(a.dignity==="Exalted")note="strong asset"; else if(a.dignity==="Debilitated")note="under pressure"; else if(a.dignity==="Own sign")note="at home"; else if(p===facts.karakaPlanet)note=facts.karaka; else if(facts.d1.houseLord===p)note="rules "+facts.houseName;
            const d1txt = SGN3(a.sign)+" "+ordP(a.house)+(a.dignity==="Exalted"?" (Ex)":a.dignity==="Debilitated"?" (Db)":a.dignity==="Own sign"?" (Own)":"");
            doc.setTextColor(...INK); doc.setFont("helvetica","bold"); doc.text(p,cP,y);
            doc.setFont("helvetica","normal"); doc.setTextColor(...MUTE);
            doc.text(d1txt, cD1, y);
            doc.text(String(d9h), cD9, y);
            doc.text(String(vh), cDx, y);
            doc.text(String(note), cN, y);
            y+=12.5;
          }
          y+=12;
        } catch(_){}
      };
      sections.forEach((sec, si) => {
        sectionHeading(sec.heading||"");
        para(String(sec.body||""), 10.5, INK, 12);
        if (si === 0) drawComparison();
      });
      // disclaimer
      kbreak(80);
      const disc=(domainKey==="health")
        ? "Disclaimer: This wellbeing blueprint is for self-reflection only and is NOT medical advice, diagnosis, or treatment. Always consult a qualified doctor."
        : "Disclaimer: This report is educational and self-reflective, offering indicative astrological insight, not professional advice or a guarantee of outcomes. All payments are final.";
      para(disc, 8.5, MUTE, 4);
      const pages=doc.internal.getNumberOfPages();
      for(let i=1;i<=pages;i++){ doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTE);
        doc.text("(c) 2026 AstroIndicators · astroindicators.com", M, H-26);
        doc.text("Page "+i+" of "+pages, W-M, H-26, {align:"right"}); }
      const safe=(clientCode()||"report").replace(/[^a-z0-9]/gi,"_");
      // Use a Blob URL rather than doc.save() — some browser PDF viewers render the
      // default jsPDF save() output blank; a proper Blob download is standards-clean.
      try {
        const fname = "AstroIndicators_"+domainKey+"_"+safe+".pdf";
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 4000);
      } catch(_) {
        doc.save("AstroIndicators_"+domainKey+"_"+safe+".pdf");  // fallback
      }
    } catch(e){ alert("Sorry — the PDF could not be generated. Please try again or use the on-screen book."); }
  }


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
        ${row("Client ID", clientCode())}
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
    // The Karakas chapter is inserted after Life Axis (page 8). It adds 0 or 2
    // pages depending on whether karakas can be computed for this chart — so the
    // contents must shift the pages that follow by the same amount.
    const _ckToc = computeCharaKarakas(_m);
    // Karaka chapter = opener + 7 karaka pages + big-picture close = 9 pages (or 0).
    const kCount = (_ckToc && _ckToc.karakas && _ckToc.karakas.length === 7) ? 9 : 0;
    let at = 10 + kCount;                            // domains begin after karaka pages
    const fixed = [["A Note Before You Begin", 4], ["Your Birth Chart · D1", 5],
                   ["Your Birth Chart · D9", 6], ["Your Planetary Strengths", 7], ["Your Life Axis", 8]]
      .concat(kCount ? [["The Karakas", 9]] : [])
      .concat([["Your Life Theme", 9 + kCount]]);
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

    // ── 9(+). the karakas — inserted after Life Axis. 0, 1, or 2 pages. ───────
    const kPages = karakaPages(_m, 9);
    kPages.forEach(pg => P.push(pg));
    // running page number continues after the karaka pages (9 if none added)
    let n = 9 + kPages.length;

    // ── life theme ───────────────────────────────────────────────────────────
    P.push(lifeThemePage(_m, n++));

    // ── domains ──────────────────────────────────────────────────────────────
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

    // ── go deeper: Domain Reports (lead-gen) ─────────────────────────────────
    P.push(domainLeadPage(n++));

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
      ${(function(){ const _cc = clientCode(); return _cc ? `<div class="closing" style="margin-top:14px">Your Client ID<br>
      <b style="font-size:1.3em;letter-spacing:.1em">${esc(_cc)}</b><br>
      <span style="opacity:.85">astroindicators.com</span></div>` : ""; })()}
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

    // Report is ready — bring the Download / Full screen bar into view so the
    // user sees the next actions instead of having to hunt/scroll for them.
    try {
      requestAnimationFrame(function () {
        var bar = document.querySelector("#liBook .fb-dlbar") || $("fbPdf");
        if (bar) bar.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (e) {}
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

  function domainLeadPage(pnum) {
    return `<div class="pg"><div class="kick">Go Deeper</div><div class="rule"></div>
      <h2>Domain Blueprints — one life-area, in real depth</h2>
      <div class="bd">This LAMP report maps your <b>whole</b> chart across every area of life. But for the one question that matters most to you right now — your <b>career</b>, your <b>marriage</b>, your <b>children</b>, your <b>health</b> — there is a deeper reading.</div>
      <div class="bd" style="margin-top:8px">Each <b>Domain Blueprint</b> takes a single karaka and reads it across <b>three charts</b>: your birth chart (D1), your Navamsha (D9), and the divisional chart built specifically for that area — <b>D10 for career, D7 for children, D4 for home</b>, and so on. Where two independent charts agree, that convergence becomes the most trustworthy signal in the reading — the kind of confirmation a single chart can never give.</div>
      <div class="bd" style="margin-top:8px">Where LAMP tells you <i>what</i> your chart holds, a Domain Blueprint tells you <i>how</i> that one area unfolds — first half of life versus second, with dasha timing for when it activates.</div>
      <div class="closing" style="margin-top:14px">Choose a Domain Blueprint from the <b>Domain Reports</b> tab · ₹750 each</div>
      <span class="pnum">${pnum}</span></div>`;
  }

  function closingLetterPage(pnum) {
    const _cc = clientCode();
    const _refPara = _cc ? `<p>If this reading brought you clarity, pass it on. Share this with someone
        who may need it — and mention your Client ID, <b>${esc(_cc)}</b>, when they get their own
        report, so we can send you a small gift of thanks.</p>` : "";
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
        ${_refPara}
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

  // The Karakas — Atmakaraka … Darakaraka. ONE karaka per page (avoids the
  // overflow/font-shrink seen when many were crammed on one page): an opener page,
  // then 7 karaka pages (each with definition, your-planet, degree, D1→D9 arc),
  // then a Big-Picture close. Returns an ARRAY of page HTML strings, or [].
  function karakaPages(m, pStart) {
    const ck = computeCharaKarakas(m);
    if (!ck || !ck.karakas || ck.karakas.length !== 7) return [];
    let pn = pStart;
    const pages = [];

    const tieNote = ck.tie && ck.excluded
      ? `<div class="foot">Two of your planets shared the same whole degree, so Rahu entered the ranking (counted in reverse) and ${esc(ck.excluded.planet)} falls outside the seven portfolios for this chart.</div>` : "";

    // Opener
    pages.push(`<div class="pg"><div class="kick">The Karakas</div><div class="rule"></div>
      <h2>The planets that carry your life's themes</h2>
      <div class="bd">Drawn from the sage Jaimini, this system asks a subtler question than “which planet sits in which house.” By the exact degree each planet occupies, one planet steps forward to carry each major theme of your life — from your soul (<b>Atmakaraka</b>, highest degree) down to your partnerships (<b>Darakaraka</b>, lowest degree).</div>
      <div class="bd" style="margin-top:8px">For each, we read two layers: <b>the reality now</b> (your D1 birth chart — the daily grind) and <b>the promise as you mature</b> (your D9 chart — how it deepens in the second half of life).</div>
      ${tieNote}
      <div class="foot" style="margin-top:10px"><i>This chapter offers interpretive guidance for reflection, in the spirit of the classical texts. Read it as a mirror for your own life, not as fixed fate.</i></div>
      <span class="pnum">${pn++}</span></div>`);

    // One page per karaka
    for (const k of ck.karakas) {
      const revBadge = k.reversed ? ` <span class="axis-lord">(Rahu, reversed)</span>` : "";
      const digBadge = k.d1Dig ? ` · <span class="axis-lord">${esc(k.d1Dig)} in D1</span>` : "";
      pages.push(`<div class="pg"><div class="kick">The Karakas · ${esc(k.short)}</div><div class="rule"></div>
        <h2>${esc(k.role)} — ${esc(k.title)}</h2>
        <div class="axis-v" style="margin-bottom:6px">${esc(k.planet)} · ${k.degInSign.toFixed(1)}°${revBadge}${digBadge} <span class="axis-lord">· ${esc(k.domain)}</span></div>
        <div class="bd">${esc(k.roleDef)}</div>
        <div class="bd" style="margin-top:6px">${esc(k.planetRole)} ${esc(k.stage)}</div>
        ${k.reality ? `<div class="bd" style="margin-top:6px">${esc(k.reality)}</div>` : ""}
        ${k.promise ? `<div class="bd" style="margin-top:4px">${esc(k.promise)}</div>` : ""}
        ${k.arc ? `<div class="bd" style="margin-top:4px"><b>${esc(k.arc)}</b></div>` : ""}
        <span class="pnum">${pn++}</span></div>`);
    }

    // Big Picture close
    const bp = ck.bigPicture
      ? `<div class="bd">${esc(ck.bigPicture)}</div>`
      : `<div class="bd">Taken together, your seven karakas map where your life's major themes are concentrated — and how each one is invited to mature from its D1 reality into its D9 promise.</div>`;
    pages.push(`<div class="pg"><div class="kick">The Karakas</div><div class="rule"></div>
      <h2>The big picture</h2>
      ${bp}
      <div class="foot" style="margin-top:10px">You are free to learn more about each of these planets and the karakas they carry from the many sources available — and to see how the themes connect with your own circumstances. Your lived experience is the real test of any reading.</div>
      <span class="pnum">${pn++}</span></div>`);

    return pages;
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

  // ── Chara Karakas (Atmakaraka … Darakaraka) — shared by PDF + flipbook ──────
  // Locked rule: 7 frozen portfolios; ranked high→low by degree-in-sign; on an
  // integer-degree tie between two classical planets, Rahu enters with reversed
  // degree (30−dis), all 8 rank, top 7 fill the portfolios, the lowest (8th) is
  // excluded. Enhanced with D1/D9 synthesis. KEEP IN SYNC with the mirror copy in
  // functions/api/analyze.js.
  const KARAKA_PORTF = [
    ["Atmakaraka","AK","Soul / Self","The King"],
    ["Amatyakaraka","AmK","Career / Intellect","The Prime Minister"],
    ["Bhratrukaraka","BK","Siblings / Guru","The Ally"],
    ["Matrukaraka","MK","Mother and Father / Home","The Home Base"],
    ["Putrakaraka","PK","Children / Education","The Future Engine"],
    ["Gnathikaraka","GK","Obstacles / Debts","The Gym"],
    ["Darakaraka","DK","Spouse / Partnerships","The Mirror"]
  ];
  const KARAKA_ROLE_DEF = {
    Atmakaraka:"The King of your chart. This is your soul's deepest drive and the rawest version of who you are when nobody is watching — the one life-theme your soul came here to master.",
    Amatyakaraka:"Your Prime Minister — the chief advisor to your soul. It runs your career, how your mind solves problems under pressure, and the energy you must channel to earn your living and your respect.",
    Bhratrukaraka:"Your siblings, closest allies, and mentors — and your everyday courage, the resilience you reach for when the world turns competitive.",
    Matrukaraka:"Your one home-base portfolio: mother and father both, your domestic happiness, your physical home, and the heart-centre you return to.",
    Putrakaraka:"The engine of your future — children, your raw creativity, your higher intelligence, and your education.",
    Gnathikaraka:"The gym and the dustbin of your chart — your obstacles, health, debts, and rivals, and the discipline it takes to master them.",
    Darakaraka:"Your Mirror — your spouse, your long-term partner, key partnerships, and how you meet another person one-to-one."
  };
  const KARAKA_PLANET_ROLE = {
    Sun:"With the Sun here, this runs on authority, pride, and visibility. You are asked to lead from your true self, not your ego.",
    Moon:"With the Moon here, this runs on feeling and care. It thrives when your inner world is calm, and wobbles when it isn't.",
    Mars:"With Mars here, this runs on drive, courage, and heat. Your work is to turn raw force and impatience into disciplined strength.",
    Mercury:"With Mercury here, this runs on intellect and words. You work it out by thinking, talking, analysing, and staying curious.",
    Jupiter:"With Jupiter here, this expands toward wisdom and meaning. You naturally want to teach, guide, and find the higher purpose.",
    Venus:"With Venus here, this softens toward harmony, beauty, and union. You seek balance, comfort, and the grace of good relationship.",
    Saturn:"With Saturn here, this is built slowly through duty and endurance. Nothing comes by shortcut; it comes by showing up, for years.",
    Rahu:"With Rahu here, this hungers for the new, the foreign, and the unconventional. It pulls you off the well-worn path."
  };
  // Vivid planet×role interpretation (felt daily life + soul's lesson), per source materials.
  const KARAKA_PLANET_BY_ROLE = {
    Atmakaraka: {
      Sun:"Your soul is wired for authority, recognition, and standing at the centre. In daily life you feel a pull to be seen and to lead — and your deepest lesson is to build a self worth following from the inside, so your worth no longer depends on applause.",
      Moon:"Your soul is wired for feeling, care, and belonging. In daily life your inner weather colours everything — when you are at peace you flourish, when unsettled you struggle. Your lesson is to become the steady source of your own comfort rather than needing the world to supply it.",
      Mars:"You naturally possess a warrior spirit, but your soul's lesson is to evolve from raw aggression or impatience into conscious, disciplined strength. In daily interactions you will notice an intense drive to protect your independence and a low tolerance for stagnation — the work is to aim that fire, not extinguish it.",
      Mercury:"Your soul is wired for intelligence, communication, and understanding. In daily life you meet everything first with the mind — analysing, questioning, connecting. Your lesson is to let that brilliant mind serve wisdom and truth, not just cleverness or endless noise.",
      Jupiter:"Your soul is wired for meaning, wisdom, and faith. In daily life you seek the larger picture and the higher why behind things. Your lesson is to grow into a genuine guide for others while staying humble enough to keep learning yourself.",
      Venus:"Your soul is wired for love, beauty, and connection. In daily life you are drawn to harmony, relationship, and the finer things — and can lose yourself in them. Your lesson is to love fully while keeping your discernment, so the heart leads without being deceived.",
      Saturn:"Your soul is wired for endurance, responsibility, and mastery through time. In daily life you carry weight others don't, and success rarely comes quick or easy. Your lesson is to keep building patiently until restriction itself becomes a strange kind of freedom."
    },
    Amatyakaraka: {
      Sun:"Your career runs on visibility and authority — you're built to lead, be seen, and hold responsibility. Day to day, work satisfies you most when you're recognised and in charge; the growth is to lead from competence and heart, not ego.",
      Moon:"Your career runs on care, intuition, and connection with people. Day to day, you succeed through empathy and reading the room — the growth is to stay emotionally steady so others' moods don't run your professional life.",
      Mars:"Your career runs on drive, competition, and decisive action. Day to day, you thrive on challenge and hate being idle; the growth is to channel that force into disciplined execution rather than burning out on constant urgency.",
      Mercury:"Your career runs on intellect, communication, and versatility. Day to day, your professional edge is your mind — analysis, writing, negotiation, quick learning; the growth is to go deep, not just wide.",
      Jupiter:"Your career runs on wisdom, teaching, and expansion. Day to day, you rise by guiding, advising, and seeing the bigger strategy; the growth is to turn vast knowledge into practical, grounded action.",
      Venus:"Your career runs on relationship, aesthetics, and diplomacy. Day to day, you succeed through charm, taste, and the ability to bring people together; the growth is to hold firm standards beneath the harmony.",
      Saturn:"Your professional life operates on the laws of patience, structure, and sheer endurance. Career success comes not from shortcuts but from showing up consistently, building systems, and carrying heavy responsibility. Your mind is geared toward long-term planning and duty — and that is exactly what earns you lasting authority."
    },
    Darakaraka: {
      Sun:"You are drawn to partners with presence, dignity, and strength of self — someone whose light is clear. Partnership becomes a mirror for your own authority, teaching you as much about yourself as about them.",
      Moon:"You are drawn to partners who feel like home — nurturing, emotionally present, safe. Partnership is where your need for belonging is both met and tested, and where you learn what real emotional security means.",
      Mars:"You are drawn to partners with drive, directness, and strength. There is heat here — passion and, at times, friction; the relationship teaches you to handle conflict cleanly and to let another's fire meet yours without a war.",
      Mercury:"You are drawn to partners who are quick, communicative, and youthful in spirit. Your bond lives in conversation and the meeting of minds; partnership stays alive when the talking, learning, and laughing never stop.",
      Jupiter:"You are drawn to partners who are wise, principled, and expansive — someone who widens your world. There is a note of the teacher in your partner, and the relationship grows you toward greater meaning.",
      Venus:"Your partnerships orient around harmony, beauty, comfort, and unconditional support. Your spouse or closest partners bring a balancing, soothing, diplomatic energy that softens your sharper edges — union sits close to the very centre of your path.",
      Saturn:"You are drawn to partners who are steady, serious, and enduring — often older in spirit. Partnership is built slowly and asks for commitment, patience, and staying power; what it lacks in early fireworks it repays in lasting reliability."
    },
    Bhratrukaraka: {
      Sun:"Your courage and your allies carry a proud, leaderly quality — you brave the world by standing tall, and your mentors are authority figures who show you how to command respect.",
      Moon:"Your everyday courage is emotional and intuitive; you face the world best when inwardly at peace, and your siblings or closest allies act as an emotional anchor. You seek mentors who offer safety, not just facts.",
      Mars:"Your courage is raw and ready — you meet competition head-on. Siblings and peers may be a source of both rivalry and fierce loyalty; the growth is turning combativeness into protective strength.",
      Mercury:"Your courage is mental and verbal — you win through wit, communication, and adaptability. Your mentors and peers are the ones you can think out loud with.",
      Jupiter:"Your courage is moral and hopeful — you brave things by believing in a larger good. Your mentors are genuine guides and teachers, and you often become one for others.",
      Venus:"Your courage is relational — you face the world with grace and the support of harmonious bonds. Allies and siblings bring beauty, comfort, and diplomacy into your struggles.",
      Saturn:"Your courage is quiet endurance — you outlast difficulty rather than charge it. Relationships with siblings or mentors may carry duty and distance, and mature slowly into deep respect."
    },
    Matrukaraka: {
      Sun:"Home and parents carry a strong, authoritative tone; your sense of inner peace is tied to pride, dignity, and being seen within the family. You settle when you can stand tall at home.",
      Moon:"Home is deeply emotional and nurturing for you; your inner peace rises and falls with the emotional climate of your household. A calm, caring home is oxygen to you.",
      Mars:"Home carries energy and can carry friction; your domestic life is passionate and active, and your peace depends on channelling that heat into protection and provision rather than conflict.",
      Mercury:"Having Mercury here brings a communicative, intellectual, fluid dynamic to home and parents. A happy home for you is full of books, ideas, and lively conversation; inner peace is sustained by curiosity and a mentally vibrant environment.",
      Jupiter:"Home is a place of wisdom, generosity, and growth; your parents feel like guides, and your inner peace deepens when your household holds meaning, faith, and room to expand.",
      Venus:"Home is your sanctuary of beauty, comfort, and affection; domestic happiness comes through harmony, pleasant surroundings, and warm relationships under your roof.",
      Saturn:"Home carries responsibility and structure; early domestic life may feel heavy or restrained, and your peace is built slowly through duty, stability, and the security that endures."
    },
    Putrakaraka: {
      Sun:"Your creativity and your bond with children carry authority and pride — you create to be seen and to lead, and you guide the young with a strong, radiant presence.",
      Moon:"Your creativity flows from feeling and imagination; your bond with children is deeply nurturing and intuitive, and your best ideas arrive when your heart is at ease.",
      Mars:"Your creativity is bold and energetic; you produce through drive and courage, and your relationship with children is active, protective, and direct.",
      Mercury:"Your creativity is intellectual and expressive — ideas, words, design; you connect with children and students through communication, play, and shared curiosity.",
      Jupiter:"Jupiter excels here: your creative expression and bond with children are philosophical, generous, and wisdom-seeking. You manifest intelligence through teaching and mentoring, and your creative work is rarely shallow — it wants to expand and do good.",
      Venus:"Your creativity is artistic and beauty-driven; you create what is lovely and harmonious, and your bond with children is affectionate, playful, and warm.",
      Saturn:"Your creativity is disciplined and structural; you build lasting works slowly and take your responsibilities to children seriously, offering steadiness more than spontaneity."
    },
    Gnathikaraka: {
      Sun:"With the Sun handling your obstacles, daily friction often involves ego, authority figures, or your visibility. When problems arise you overcome them by burning away pride and stepping into leadership — you conquer by facing things head-on, not hiding.",
      Moon:"Your obstacles are often emotional — moods, sensitivities, and the weight of others' needs. You overcome them by tending your inner world and finding calm; your discipline is emotional, not brute force.",
      Mars:"Your obstacles show up as conflict, rivals, and impatience; you overcome them through direct, courageous action — the discipline is to fight the right battles and let the rest go.",
      Mercury:"Your obstacles are often mental — overthinking, miscommunication, scattered focus; you overcome them through clear analysis, planning, and turning anxiety into organised thought.",
      Jupiter:"Your obstacles can come from over-optimism or excess; you overcome them through wisdom, ethics, and faith — standing on higher principles to burn difficulty away.",
      Venus:"Your obstacles often touch relationships, comfort, or indulgence; you overcome them through balance, fairness, and the discipline to not let pleasure or people-pleasing steer you off course.",
      Saturn:"Your obstacles are the classic Saturnian ones — delay, debt, hard work, endurance; you overcome them exactly as Saturn demands: patience, discipline, and refusing to quit until the weight is carried."
    }
  };


  const KARAKA_HOUSE_MEAN = {
    1:"your identity, body, and the way you meet the world",
    2:"family, speech, savings, and what you truly value",
    3:"courage, self-effort, communication, and skills you build yourself",
    4:"home, mother, inner peace, and your emotional foundations",
    5:"children, creativity, intelligence, and self-expression",
    6:"daily work, service, debts, rivals, and health",
    7:"partnership, marriage, and one-to-one public life",
    8:"crises, sudden change, secrets, and deep transformation",
    9:"beliefs, higher law, fortune, teachers, and long journeys",
    10:"career, status, and visible worldly action",
    11:"gains, networks, and the rewards you aim for",
    12:"solitude, letting go, foreign lands, and the inner and spiritual world"
  };
  const KARAKA_EX = { Sun:"Aries",Moon:"Taurus",Mars:"Capricorn",Mercury:"Virgo",Jupiter:"Cancer",Venus:"Pisces",Saturn:"Libra",Rahu:"Gemini",Ketu:"Sagittarius" };
  const KARAKA_DE = { Sun:"Libra",Moon:"Scorpio",Mars:"Cancer",Mercury:"Pisces",Jupiter:"Capricorn",Venus:"Virgo",Saturn:"Aries",Rahu:"Sagittarius",Ketu:"Gemini" };
  const KARAKA_OWN = { Sun:["Leo"],Moon:["Cancer"],Mars:["Aries","Scorpio"],Mercury:["Gemini","Virgo"],Jupiter:["Sagittarius","Pisces"],Venus:["Taurus","Libra"],Saturn:["Capricorn","Aquarius"],Rahu:[],Ketu:[] };
  function karakaDIS(lon){ return ((((lon)%30)+30)%30); }
  function karakaDig(p,s){ if(KARAKA_EX[p]===s)return"Exalted"; if(KARAKA_DE[p]===s)return"Debilitated"; if((KARAKA_OWN[p]||[]).includes(s))return"Own sign"; return""; }
  function karakaDigPhrase(l){ return l==="Exalted"?", at peak strength":l==="Debilitated"?", under real pressure":l==="Own sign"?", strong and at home":""; }
  function karakaOrd(n){var s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
  function karakaStage(dis){
    if(dis>=15) return "At "+dis.toFixed(0)+"° this is a high degree — a mature, heavy portfolio you cannot ignore; it presses on you with daily prominence.";
    if(dis<=5)  return "At "+dis.toFixed(0)+"° this is a low, fresh degree — nascent potential that wakes up through the people and situations around you.";
    return "At "+dis.toFixed(0)+"° this is a developing degree — ripening steadily through lived experience.";
  }
  function karakaHouseOf(houses,p){ if(!houses)return null; for(let h=1;h<=12;h++){ if((houses[h]||[]).includes(p))return h; } return null; }
  function karakaSignOfHouse(lagnaSign,h){ const i=SIGNS_FULL2.indexOf(lagnaSign); if(i<0)return""; return SIGNS_FULL2[(i+h-1)%12]; }

  // ── D1/D9 interpretation library (hybrid: composed base + enriched cells) ─────

  // House arena (lived) — used by the composed base
  const CK_HOUSE_ARENA = {
    1:"your identity, body, and how you meet the world",
    2:"money, family, speech, and self-worth",
    3:"effort, courage, communication, and your dealings with peers",
    4:"home, mother, and inner emotional security",
    5:"children, creativity, romance, and self-expression",
    6:"daily work, health, debts, service, and rivals",
    7:"partnership, marriage, and one-to-one dealings",
    8:"crises, secrets, sudden change, and deep psychological shifts",
    9:"beliefs, fortune, teachers, ethics, and long journeys",
    10:"career, status, and public responsibility",
    11:"gains, networks, ambitions, and your social circles",
    12:"solitude, foreign lands, spirituality, and the inner world"
  };
  // What the house becomes as a MATURE strength (D9 evolution arena)
  const CK_HOUSE_PROMISE = {
    1:"a grounded, self-possessed presence",
    2:"real security, resources, and a steadying voice",
    3:"courageous self-effort, skill, and independent action",
    4:"deep inner peace and an emotionally rich home",
    5:"creative mastery and wise guidance of the young",
    6:"the power to defeat obstacles and serve with discipline",
    7:"balanced, righteous partnership and counsel",
    8:"mastery of crisis, depth, and transformation",
    9:"wisdom, higher truth, and the role of a guide",
    10:"visible authority and lasting achievement",
    11:"abundant networks and fulfilled ambitions",
    12:"spiritual wealth, release, and inner freedom"
  };
  const CK_PLANET_LESSON = {
    Sun:"lead from genuine self-worth rather than pride or the need for applause",
    Moon:"stay emotionally steady rather than be ruled by moods and others' needs",
    Mars:"act with disciplined courage rather than out of panic, anger, or defense",
    Mercury:"think and speak with clarity rather than scatter into overthinking",
    Jupiter:"grow through wisdom and restraint rather than excess or easy optimism",
    Venus:"seek balance and true value rather than indulgence or people-pleasing",
    Saturn:"carry responsibility with patience rather than fear, delay, or bitterness"
  };
  const CK_PLANET_FEEL = {
    Sun:"a drive to be seen and to matter",
    Moon:"a strong emotional sensitivity",
    Mars:"an intense, restless drive",
    Mercury:"a busy, questioning mind",
    Jupiter:"a search for meaning and the larger picture",
    Venus:"a pull toward harmony, beauty, and closeness",
    Saturn:"a weight of duty and quiet pressure"
  };
  const CK_PLANET_BECOMES = {
    Sun:"a confident, principled authority",
    Moon:"a calm, emotionally wealthy centre",
    Mars:"a disciplined protector and strategist",
    Mercury:"a clear, masterful communicator",
    Jupiter:"a genuine teacher and guide",
    Venus:"a source of harmony, beauty, and grace",
    Saturn:"an unshakeable, enduring builder"
  };

  // ENRICHED CELLS — hand-written for highest impact (from source examples).
  // Keyed "planet-house". D1 = daily reality+lesson; D9 = evolution+promise.
  const CK_D1_ENRICH = {
    "Mars-8":"Your daily life forces you to confront crises, sudden changes, secrets, or deep psychological shifts. Your first instinct may be defensive aggression or hidden anxiety — and your real lesson is to stop reacting from panic and act from steadiness instead.",
    "Saturn-1":"You carry immense pressure directly on your shoulders. Daily life can feel like a constant test of your authority, reputation, and self-discipline, as though the weight of everything rests on you.",
    "Moon-6":"Your emotional courage is tested by daily routines, debts, service, or draining dynamics with others. It is easy to feel worn down here, as if your inner reserves are always being spent.",
    "Mercury-8":"Early home life, inner peace, or communication may feel ungrounded, chaotic, or prone to misunderstanding — a mind that churns on what lies hidden beneath the surface.",
    "Jupiter-12":"Your wisdom and insight run deep, spiritual, and private. You process the world in solitude and feel pulled toward what lies beyond the material — sometimes at the cost of worldly footing.",
    "Sun-9":"You possess a powerful, almost blinding drive to stand on higher law, ethics, and truth. Obstacles and ego-clashes are met head-on, with conviction — the work is to lead without needing to dominate.",
    "Venus-8":"Your closest relationships begin intense, private, and transformative. Love is never casual for you; it involves deep bonding and navigating life's hidden currents together."
  };
  const CK_D9_ENRICH = {
    "Mars-7":"Your soul ultimately evolves into a protector, counselor, and strategist. Your raw survival drive matures into a quest for higher truth, shared through balanced, righteous partnerships.",
    "Saturn-3":"The pressure pays off. Your professional intellect channels into powerful self-effort — writing, communication, and highly independent executing skill. You become the author of your own work.",
    "Moon-12":"An incredible shift: when you step back into quiet, solitude, or foreign spaces, your mind becomes deeply stable and emotionally wealthy. Your true strength is a private, untouchable inner sanctuary.",
    "Mercury-4":"A complete reversal. Through lived experience you master your environment, building a home life that is organized, brilliant, and intellectually peaceful — clear logic curing the early confusion.",
    "Jupiter-3":"You do not stay a silent mystic. You bring deep wisdom down to earth — teaching, writing, and guiding others with confident authority in your everyday circle.",
    "Sun-12":"Your ultimate lesson is surrender: true victory over obstacles comes when you learn when to step back and channel your powerful ego into selfless service and spiritual detachment.",
    "Venus-2":"The intense bond settles into a nurturing reality — your partner brings tangible security, warm family focus, sweet speech, and shared resources into your everyday life."
  };

  function ckDignTone(dig, layer){
    // layer: 'd1' or 'd9'
    if(dig==="Exalted") return layer==="d9" ? " Here it reaches its peak — an incredible strengthening as life matures." : " Even here it holds real power.";
    if(dig==="Debilitated") return layer==="d9" ? " And it is reborn at full strength — a striking reversal from difficult beginnings." : " It works under real pressure here, and asks to be handled with care.";
    if(dig==="Own sign") return " It stands strong and at home.";
    return "";
  }

  // Compose a D1 reading
  function ckReadD1(planet, house, sign, dig){
    const key=planet+"-"+house;
    let base = CK_D1_ENRICH[key] ||
      ("In daily life your "+planet+" here brings "+CK_PLANET_FEEL[planet]+" into "+(CK_HOUSE_ARENA[house]||"this area of life")+". The lesson is to "+CK_PLANET_LESSON[planet]+".");
    return "The reality now (D1) — "+planet+" in your "+ordK(house)+" house"+(sign?" in "+sign:"")+(dig?" ("+dig+")":"")+": "+base+ckDignTone(dig,"d1");
  }
  // Compose a D9 reading
  function ckReadD9(planet, house, sign, dig){
    const key=planet+"-"+house;
    let base = CK_D9_ENRICH[key] ||
      ("As it matures your "+planet+" moves toward "+(CK_HOUSE_PROMISE[house]||"a deeper expression")+", so this part of you grows into "+CK_PLANET_BECOMES[planet]+" in the second half of life.");
    return "The promise as you mature (D9) — "+planet+" in your "+ordK(house)+" house"+(sign?" in "+sign:"")+(dig?" ("+dig+")":"")+": "+base+ckDignTone(dig,"d9");
  }
  function ordK(n){var s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}


  // ── Enriched Big Picture — resonates with the source "Exaltation Alchemy" voice ─
  function ckBigPictureRich(karakas){
    let rev=0, rise=0, transf=0, exD9=0, exD1=0, ownD9=0;
    const transfList=[], exaltList=[];
    for(const k of karakas){
      if(k.reversal) rev++;
      if(k.rise) rise++;
      if(k.d1House===8||k.d1House===12){ transf++; transfList.push(k.role); }
      if(k.d9Dig==="Exalted"){ exD9++; exaltList.push(k.role); }
      if(k.d1Dig==="Exalted") exD1++;
      if(k.d9Dig==="Own sign") ownD9++;
    }
    const strongD9 = exD9 + ownD9;

    // Strongest pattern: transformation-house D1 → exalted/strong D9 = "Exaltation Alchemy"
    if((rev+rise)>=2 && (transf>=2 || strongD9>=3)){
      return "Read as a whole, your chart carries an unmistakable arc — what the tradition calls exaltation alchemy: initial struggle systematically refined into brilliant strength. Several of your karakas begin in the houses of crisis, loss, and letting-go (the hard, hidden, exhausting side of daily life) and resolve into their most powerful placements as life matures. This is the signature of someone built for a strong second half. Your path asks you to lean into discipline, trust your quieter and more inward side, and hold faith that the difficulty of the early chapters is not a verdict — it is actively building the mastery of the later ones. What drains you now is, quite literally, training the strength you are meant to become.";
    }
    if(strongD9>=3){
      return "Read as a whole, your chart concentrates its real power in the second half of life — several of your karakas reach their strongest placements only in the maturing D9 chart. What you build slowly and patiently now ripens into genuine authority and inner wealth later. You are rewarded not for speed, but for staying the course.";
    }
    if(rev>=1 || rise>=1){
      return "Read as a whole, your chart holds a clear upward turn — at least one core portfolio begins under pressure and is rebuilt into strength as life matures. Where things have felt hardest is often exactly where your later mastery is quietly forming. Trust the direction of travel: it bends toward strength.";
    }
    if(exD1>=2){
      return "Read as a whole, your chart carries real early strength — several karakas begin already well-placed. Your work is less about transformation and more about stewardship: honouring and building on the gifts you were given, rather than letting them sit idle.";
    }
    return null;
  }

  function computeCharaKarakas(m){
    if(!m || !m.lons) return null;
    const lons=m.lons;
    const CL=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
    const list=[];
    for(const p of CL){ if(lons[p]==null) return null; list.push({planet:p,dis:karakaDIS(lons[p]),reversed:false}); }
    let tie=false;
    for(let a=0;a<list.length&&!tie;a++) for(let b=a+1;b<list.length;b++){ if(Math.floor(list[a].dis)===Math.floor(list[b].dis)){tie=true;break;} }
    if(tie && lons.Rahu!=null) list.push({planet:"Rahu",dis:30-karakaDIS(lons.Rahu),reversed:true});
    list.sort((x,y)=>y.dis-x.dis);
    const assigned=list.slice(0,7), excluded=list.length>7?list[7]:null;

    const d1H=(m.d1&&m.d1.houses)||null, d9H=(m.d9&&m.d9.houses)||null;
    const d1L=(m.d1&&m.d1.lagnaSign)||"", d9L=(m.d9&&m.d9.lagnaSign)||"";

    const karakas=assigned.map((b,i)=>{
      const p=b.planet;
      const d1house=karakaHouseOf(d1H,p), d9house=karakaHouseOf(d9H,p);
      const d1sign=d1house?karakaSignOfHouse(d1L,d1house):"", d9sign=d9house?karakaSignOfHouse(d9L,d9house):"";
      const d1dig=d1sign?karakaDig(p,d1sign):"", d9dig=d9sign?karakaDig(p,d9sign):"";
      const reversal=(d1dig==="Debilitated"&&(d9dig==="Exalted"||d9dig==="Own sign"));
      const rise=(d1dig!=="Exalted"&&d9dig==="Exalted");
      let reality="", promise="", arc="";
      if(d1house){ reality=ckReadD1(p, d1house, d1sign, d1dig); }
      if(d9house){ promise=ckReadD9(p, d9house, d9sign, d9dig); }
      if(reversal) arc="This is a striking reversal — what began strained or ungrounded is rebuilt into genuine mastery. The early struggle was the training.";
      else if(rise) arc="The direction is upward — early friction refines into real strength.";
      return {
        role:KARAKA_PORTF[i][0], short:KARAKA_PORTF[i][1], domain:KARAKA_PORTF[i][2], title:KARAKA_PORTF[i][3],
        planet:p, degInSign:parseFloat(b.dis.toFixed(1)), reversed:b.reversed,
        roleDef:KARAKA_ROLE_DEF[KARAKA_PORTF[i][0]],
        planetRole:(KARAKA_PLANET_BY_ROLE[KARAKA_PORTF[i][0]] && KARAKA_PLANET_BY_ROLE[KARAKA_PORTF[i][0]][p]) || KARAKA_PLANET_ROLE[p] || "",
        stage:karakaStage(b.dis),
        d1House:d1house, d1Sign:d1sign, d1Dig:d1dig, d9House:d9house, d9Sign:d9sign, d9Dig:d9dig,
        reality, promise, arc, reversal, rise
      };
    });
    const ak=karakas[0], dk=karakas[karakas.length-1];
    return { tie, rahuUsed:tie&&lons.Rahu!=null,
      excluded: excluded?{planet:excluded.planet,degInSign:parseFloat(excluded.dis.toFixed(1)),reversed:excluded.reversed}:null,
      karakas, atmakaraka:ak, darakaraka:dk, bigPicture:ckBigPictureRich(karakas) };
  }
  function karakaBigPicture(karakas){
    let rev=0,rise=0,transf=0,exD9=0;
    for(const k of karakas){ if(k.reversal)rev++; if(k.rise)rise++; if(k.d1House===8||k.d1House===12)transf++; if(k.d9Dig==="Exalted")exD9++; }
    if((rev+rise)>=2 && (transf>=2||exD9>=3))
      return "Read as a whole, your chart carries one clear arc: hard, hidden, or unsettled beginnings that are built — deliberately — into real strength. Several of your karakas start in the houses of crisis and letting-go and resolve into their most powerful placements as life matures. You are made for a strong second half. The difficulty in the early chapters is not a verdict; it is the training your later mastery is standing on.";
    if(exD9>=3)
      return "Read as a whole, your chart concentrates its power in the second half of life — several karakas reach their strongest placements only in the maturing D9 chart. What you build slowly now ripens into genuine authority later.";
    if(rev>=1)
      return "Read as a whole, your chart holds at least one deep reversal — a portfolio that begins under pressure and is rebuilt into strength. Where life has felt hardest is often exactly where your later mastery is forming.";
    return null;
  }

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
    // Bring the progress message into view (see buildLifeIndicators for why).
    try {
      requestAnimationFrame(function () {
        host.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (e) {
      try { host.scrollIntoView(); } catch (_) {}
    }
    try {
      const facts = await getFacts();
      const picked = pickedIds.map(id => byId(facts, id)).filter(Boolean);
      const out = await narrate("icc_answer", picked);
      const sets = (existingSets || []).concat([{ answers: out.answers || [] }]);
      srv({ action:"store", chartId: window.AI_chartId(), item:"icc", lang:"en", sections: sets,
            paymentId: (window.AI_lastPayment && window.AI_lastPayment.icc) || null });
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

    // Answers are ready — bring the Download bar into view.
    try {
      requestAnimationFrame(function () {
        var bar = document.querySelector("#iccAnswers .pp-paybar") || $("iccPdf");
        if (bar) bar.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (e) {}
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
    const _cc = clientCode();
    const meta = [f0.dob, f0.tob, f0.place, _cc ? "Client ID " + _cc : ""].filter(Boolean).join(" · ");
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
    const heading = (txt) => { doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(176,130,38);
      doc.text(txt.toUpperCase(), M, y); doc.setFont("helvetica","normal"); y += 7;
      doc.setDrawColor(176,130,38); doc.setLineWidth(1); doc.line(M, y, W-M, y); doc.setLineWidth(.8); y += 20; };

    // ── birth details ────────────────────────────────────────────────────────
    newPage(); heading("Birth Details");
    const rows = [["Name", name], ["Date of birth", f0.dob], ["Time of birth", f0.tob],
      ["Place", f0.place],
      ["Client ID", clientCode()],
      ["Ascendant (D1)", d1.lagnaSign ? d1.lagnaSign + " " + (d1.lagnaDegree||0).toFixed(1) + "°" : ""],
      ["Navamsa lagna (D9)", d9.lagnaSign],
      ["Moon sign", mSign("Moon")],
      ["Nakshatra", pl.Moon ? (pl.Moon.nakshatra||"") + (pl.Moon.pada ? " · pada " + pl.Moon.pada : "") : ""]];
    doc.setFontSize(12);
    for (const [k,v] of rows) { if (!v) continue;
      doc.setTextColor(...MUTE); doc.text(String(k), M, y);
      doc.setTextColor(...INK); doc.text(String(v), M+150, y); y += 20; }

    // ── charts (drawn as grids) ──────────────────────────────────────────────
    const CELLS = { "0,0":11,"0,1":0,"0,2":1,"0,3":2, "1,0":10,"1,3":3,
                    "2,0":9,"2,3":4, "3,0":8,"3,1":7,"3,2":6,"3,3":5 };   // fixed SIGN index per cell
    const SG = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
    const SF = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
    const AB = { Sun:"Su",Moon:"Mo",Mars:"Ma",Mercury:"Me",Jupiter:"Ju",Venus:"Ve",Saturn:"Sa",Rahu:"Ra",Ketu:"Ke" };
    function drawChart(lagnaSign, houses, label, note) {
      const li = SF.indexOf(lagnaSign); if (li < 0) return;
      if (y + 300 > H - M) newPage();
      doc.setFontSize(12); doc.setTextColor(...INK); doc.text(label, M, y); y += 15;
      doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor(...GOLD);
      doc.text("Lagna: " + lagnaSign, M, y); doc.setFont("helvetica","normal"); y += 16;
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
    doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(176,130,38); doc.text("Why we built this for you", M, y); doc.setFont("helvetica","normal"); y += 24;
    const rn = readerName();
    doc.setFontSize(12);
    const para = (t) => { doc.setFontSize(12); const tx = doc.splitTextToSize(t, W-M*2); if (y+tx.length*17>H-M) newPage();
      doc.setTextColor(...INK); doc.setLineHeightFactor(1.5); doc.text(tx, M, y); doc.setLineHeightFactor(1.15); y += tx.length*17 + 8; };
    para((rn ? "Dear " + rn + "," : "Dear reader,"));
    para("For most of us, the need to consult astrology arises only when something is not going as we hoped — rarely when life is going well. That was true for us too. The guidance we sought was often hard to interpret, felt clear in the moment then dissolved once we left, and still left the two questions that mattered most unanswered.");
    para("So we built AstroIndicators with one goal: to give you not prediction, but clarity — a clarity that stays within your reach, so you can answer for yourself:");
    if (y + 70 > H - M) newPage();
    y += 6;
    doc.setFont("helvetica","bold"); doc.setFontSize(12.5); doc.setTextColor(...GOLD);
    doc.text("Why am I going through what I am going through?", M+18, y); y += 20;
    doc.text("And how do I see the road ahead?", M+18, y); y += 28;
    doc.setFont("helvetica","normal"); doc.setTextColor(...INK);
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
      doc.setFontSize(12.5); doc.setTextColor(...INK); doc.text(String(v)+lord, M, y); y += 15;
      doc.setFontSize(10.5); doc.setTextColor(...MUTE);
      doc.text(doc.splitTextToSize(n, W-M*2), M, y); y += 26; }
    y += 6; doc.setFontSize(10); doc.setTextColor(...MUTE);
    doc.text(doc.splitTextToSize("Please see the References page on this site to learn what each sign, house, and planetary lord signifies.", W-M*2), M, y);

    // ── the karakas (Atmakaraka … Darakaraka) — D1/D9 synthesis ───────────────
    const ck = computeCharaKarakas(_m);
    if (ck && ck.karakas && ck.karakas.length === 7) {
      const kbreak = (need) => { if (y + need > H - M) newPage(); };
      const kpara = (txt, size, color, gap) => {
        doc.setFontSize(size); doc.setTextColor(...color);
        const lines = doc.splitTextToSize(txt, W-M*2);
        kbreak(lines.length * (size + 2.5) + 6);
        doc.text(lines, M, y);
        y += lines.length * (size + 2.5) + (gap || 0);
      };

      newPage(); heading("The Karakas — The Planets That Carry Your Life's Themes");
      kpara("Drawn from the sage Jaimini, this system asks a subtler question than 'which planet sits in which house.' By the exact degree each planet occupies, one planet steps forward to carry each major theme of your life — from your soul (Atmakaraka, highest degree) down to your partnerships (Darakaraka, lowest degree).", 10.5, MUTE, 8);
      kpara("For each karaka we read two layers: the reality now (your D1 birth chart, the daily grind) and the promise as you mature (your D9 chart, how it deepens in the second half of life).", 10.5, MUTE, 8);
      if (ck.tie && ck.excluded) {
        kpara("Two of your planets shared the same whole degree, so Rahu entered the ranking (counted in reverse) and " + ck.excluded.planet + " falls outside the seven portfolios for this chart.", 9.5, MUTE, 8);
      }
      kpara("This chapter offers interpretive guidance for reflection, in the spirit of the classical texts. Read it as a mirror for your own life, not as fixed fate.", 9, MUTE, 6);

      for (const k of ck.karakas) {
        kbreak(150);
        doc.setFontSize(10); doc.setTextColor(...GOLD);
        doc.text(k.role + "  (" + k.short + ")  —  " + k.title, M, y); y += 15;
        doc.setFontSize(12); doc.setTextColor(...INK);
        const revNote = k.reversed ? "  (Rahu, reversed)" : "";
        const digNote = k.d1Dig ? "  ·  " + k.d1Dig + " in D1" : "";
        doc.text(k.planet + "  ·  " + k.degInSign.toFixed(1) + "\u00b0" + revNote + digNote + "  ·  " + k.domain, M, y); y += 16;
        kpara(k.roleDef, 10, MUTE, 5);
        kpara(k.planetRole + " " + k.stage, 10, MUTE, 5);
        if (k.reality) kpara(k.reality, 10, INK, 4);
        if (k.promise) kpara(k.promise, 10, INK, 4);
        if (k.arc)     kpara(k.arc, 10, GOLD, 12);
      }

      newPage(); heading("The Karakas — The Big Picture");
      if (ck.bigPicture) kpara(ck.bigPicture, 11, INK, 10);
      else kpara("Taken together, your seven karakas map where your life's major themes are concentrated — and how each is invited to mature from its D1 reality into its D9 promise.", 11, INK, 10);
      kpara("You are free to learn more about each of these planets and the karakas they carry from the many sources available — and to see for yourself how the themes connect with your own circumstances. Your lived experience is the real test of any reading.", 9.5, MUTE, 4);
    }

    // ── life theme ───────────────────────────────────────────────────────────
    const themePick = pickTheme(_m);
    if (themePick) {
      newPage(); heading("Your Life Theme");
      doc.setFontSize(15); doc.setTextColor(...INK);
      doc.text(themePick.a.pair + " — " + themePick.a.name, M, y); y += 26;
      doc.setFontSize(12);
      let tx = doc.splitTextToSize(themePick.a.theme, W-M*2); doc.text(tx, M, y); y += tx.length*16 + 12;
      doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text("THE WORK OF THIS BIRTH", M, y); y += 14;
      doc.setFontSize(12); doc.setTextColor(...INK);
      tx = doc.splitTextToSize(themePick.a.work, W-M*2); doc.text(tx, M, y); y += tx.length*16 + 14;
      if (themePick.evidence) {
        doc.setFontSize(10.5); doc.setTextColor(...MUTE);
        tx = doc.splitTextToSize(themePick.evidence, W-M*2); doc.text(tx, M, y); y += tx.length*14 + 10;
      }
      doc.setFontSize(10.5); doc.setTextColor(...MUTE);
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
      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(170,128,40);
      doc.text(f.band.replace(/_/g," ").toUpperCase() + "   ·   " + f.confidence + "% confidence", M, y);
      doc.setFont("helvetica","normal"); y += 19;
      doc.setFontSize(12.5); doc.setLineHeightFactor(1.5); doc.setTextColor(...INK); doc.text(body, M, y); doc.setLineHeightFactor(1.15); y += body.length*18 + 8;
      if (win) { doc.setDrawColor(...GOLD); doc.setLineWidth(1); doc.line(M, y, W-M, y); doc.setLineWidth(.8); y += 15;
        doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(170,128,40);
        doc.text(win.label + ":  ", M, y); const _lw = doc.getTextWidth(win.label + ":  ");
        doc.setTextColor(...INK); doc.text(fmtWin(win), M + _lw, y); doc.setFont("helvetica","normal"); y += 22; }
      y += 14;
    }

    // ── what to actually do (concrete guidance) ──────────────────────────────
    newPage(); heading("What To Actually Do With This");
    doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(176,130,38); doc.text("The few choices that change the most", M, y); doc.setFont("helvetica","normal"); y += 26;
    const guide = (window._extras && window._extras.guidance) || [];
    for (const l of guide) {
      const label = l.actor + " · " + l.house + (l.house===1?"st":l.house===2?"nd":l.house===3?"rd":"th") + " house";
      doc.setFontSize(12); const txt = doc.splitTextToSize(l.text, W - M*2 - 14);
      if (y + txt.length*16 + 30 > H - M) newPage();
      doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text(label.toUpperCase(), M+12, y); y += 14;
      doc.setDrawColor(...GOLD); doc.setLineWidth(1.6);
      doc.line(M+2, y-17, M+2, y + txt.length*16 - 4); doc.setLineWidth(.8);
      doc.setFontSize(12); doc.setTextColor(...INK); doc.setLineHeightFactor(1.5); doc.text(txt, M+12, y); doc.setLineHeightFactor(1.15); y += txt.length*16 + 16;
    }

    // ── closing letter ───────────────────────────────────────────────────────
    newPage(); heading("A Closing Note");
    doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(176,130,38); doc.text("Awareness is where it begins", M, y); doc.setFont("helvetica","normal"); y += 24;
    doc.setFontSize(10.5);
    para((rn ? "Dear " + rn + "," : "Dear reader,"));
    para("We hope these indications have given you a genuine sense of awareness, and some answers to the questions that may have been quietly weighing on you.");
    para("If a few don't seem to fit, hold them this way: each indication is a signboard on a road — it tells you, reliably, what lies ahead and how far. But this signboard carries a weather forecast too. The road is your chart; the weather is your timing. Many people share birth details close to yours and travel much the same road, but each sets out in a different season. The signboard reads the same for all; the weather each meets does not — which is why some indications land squarely and others feel a step away.");
    para("With that awareness, you can begin to sort what lies within your control from what lies beyond it. As the Serenity Prayer asks:");
    if (y + 80 > H - M) newPage();
    y += 6;
    doc.setFont("helvetica","bolditalic"); doc.setFontSize(12.5); doc.setTextColor(176,130,38);
    var _spr = doc.splitTextToSize("\u201Cgrant me the serenity to accept what I cannot change, the courage to change what I can, and the wisdom to know the difference.\u201D", W-M*2-36);
    doc.setLineHeightFactor(1.5); doc.text(_spr, M+18, y); doc.setLineHeightFactor(1.15); y += _spr.length*18 + 6;
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...MUTE);
    doc.text("\u2014 Reinhold Niebuhr", M+18, y); y += 18;
    doc.setFont("helvetica","normal"); doc.setTextColor(...INK);
    para("Because in the end — awareness and acceptance are where suffering ends.");
    { const _cc = clientCode();
      if (_cc) para("If this reading brought you clarity, pass it on. Share this with someone who may need it — and mention your Client ID, " + _cc + ", when they get their own report, so we can send you a small gift of thanks."); }

    // ── final page ─────────────────────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(...NAVY); doc.rect(0,0,W,H,"F");
    doc.setDrawColor(...GOLD); doc.rect(M/2,M/2,W-M,H-M);
    doc.setTextColor(...GOLD); doc.setFontSize(24);
    doc.text("Best wishes from", W/2, H/2-44, { align:"center" });
    doc.text("Team AstroIndicators", W/2, H/2-14, { align:"center" });
    doc.setFontSize(12.5); doc.setTextColor(225,225,230); doc.setLineHeightFactor(1.5);
    const close = doc.splitTextToSize("We hope you find this useful in getting an indication of how you are navigating and where you are heading" + (name ? ", " + name : "") + ". If you find it useful, please don't hesitate to share it with all those whom you care about. If our work was useful, we'd be grateful for a short review — the Leave a Review button is on the Birth Details page.", W-M*3);
    doc.text(close, W/2, H/2+30, { align:"center" }); doc.setLineHeightFactor(1.15);
    { const _cc = clientCode();
      if (_cc) {
        const _cy = H/2 + 30 + close.length*19 + 34;
        doc.setFontSize(15); doc.setTextColor(...GOLD);
        doc.text("Client ID  " + _cc, W/2, _cy, { align:"center" });
        doc.setFontSize(10.5); doc.setTextColor(200,200,205);
        doc.text("astroindicators.com", W/2, _cy + 20, { align:"center" });
      } }

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
          var backTab = (resumeItem && resumeItem.indexOf("domain_") === 0) ? "domainReportTab" : "lifeIndTab";
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
    if (!cid) {
      alert("Your chart is still finalizing (location not resolved yet). Please wait a moment and try again.");
      return;
    }
    if (!forcePay) {
      if (unlockedHere(item)) { run(); return; }
      const _pid = (window.AI_lastPayment && window.AI_lastPayment[item]) || null;
      const st = await srv({ action:"status", chartId: cid, item, paymentId: _pid });
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
    // Domain Reports — build the 7-karaka picker + wire each to pay→openDomainReport
    renderDomainPicker();
    // teasers render when the tabs are first opened
    document.querySelectorAll('.nav-tab[data-tab="lifeIndTab"], .nav-tab[data-tab="domainReportTab"]')
      .forEach(b => b.addEventListener("click", function () {
        resetLifeIndicatorsIfChartChanged();
        renderTeasers();
        if (b.dataset.tab === "domainReportTab") { renderDomainPicker(); }
      }));
  });
})();
