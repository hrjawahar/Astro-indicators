// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui-v4.js
//  AstroIndicators — new UI behaviour added in the v4 rebuild.
//  Handles: full-site language toggle, clickable feature cards, sample-report
//  modal, and the personal-consultation booking form.
//
//  This file is self-contained. It does NOT touch the astrology engine (app.js).
//
//  ── OWNER CONFIG ──  Edit the values in CONSULT_CONFIG below with your details.
// ─────────────────────────────────────────────────────────────────────────────

// ====== OWNER CONFIG — EDIT THESE ============================================
const CONSULT_CONFIG = {
  name:        "[ Your name here ]",
  title:       "[ Your credentials / title ]",
  bio:         "[ Your short bio — 3 to 4 lines. ]",
  photo:       "consultant.jpg",          // put your photo file in the app folder
  // Consultation types: label is shown to the user; amount is in rupees.
  types: [
    { id: "30min", minutes: 30, amount: 500 },
    { id: "60min", minutes: 60, amount: 999 },
  ],
  // Where booking notifications go (used later when payment is wired in Phase 4):
  notifyMobile: "+91XXXXXXXXXX",
  notifyEmail:  "you@example.com",
};
// =============================================================================

(function () {
  "use strict";

  // Wait until DOM + i18n.js are ready
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {

    // ── 1. APPLY SAVED LANGUAGE ON LOAD ──────────────────────────────────────
    let savedLang = "EN";
    try { savedLang = localStorage.getItem("jyotish-lang") || "EN"; } catch (e) {}
    if (typeof window.applyLanguage === "function") {
      window.applyLanguage(savedLang);
      updateLangToggleLabel(savedLang);
    }

    // ── 2. LANGUAGE TOGGLE DROPDOWN ──────────────────────────────────────────
    const langBtn  = document.getElementById("langToggleBtn");
    const langMenu = document.getElementById("langDropdown");

    if (langBtn && langMenu) {
      langBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        const open = langMenu.style.display !== "none";
        langMenu.style.display = open ? "none" : "block";
        langBtn.setAttribute("aria-expanded", open ? "false" : "true");
      });

      langMenu.querySelectorAll(".lang-option").forEach(function (opt) {
        opt.addEventListener("click", function () {
          const code = opt.getAttribute("data-setlang");
          if (typeof window.applyLanguage === "function") window.applyLanguage(code);
          // keep the chart-cell planet-name buttons in sync if present
          if (typeof window._currentLang !== "undefined") window._currentLang = code;
          syncPlanetNameButtons(code);
          updateLangToggleLabel(code);
          langMenu.style.display = "none";
          langBtn.setAttribute("aria-expanded", "false");
          // re-render charts/planets in new language if the engine exposes it
          try {
            if (window.currentData && window.currentData.chart) {
              if (typeof window.renderChartScreen === "function") window.renderChartScreen(window.currentData.chart);
              if (typeof window.renderPlanetScreen === "function") window.renderPlanetScreen(window.currentData.chart);
            }
          } catch (err) {}
        });
      });

      // close dropdown on outside click
      document.addEventListener("click", function () {
        langMenu.style.display = "none";
        langBtn.setAttribute("aria-expanded", "false");
      });
    }

    function updateLangToggleLabel(code) {
      const label = document.getElementById("langToggleLabel");
      if (!label || !window.LANG_META) return;
      const meta = window.LANG_META.find(function (m) { return m.code === code; });
      if (meta) label.textContent = meta.native;
    }

    // Keep the in-chart planet-name buttons (data-lang) visually in sync
    function syncPlanetNameButtons(code) {
      document.querySelectorAll(".lang-btn").forEach(function (b) {
        b.classList.toggle("active", b.dataset.lang === code);
      });
    }
    syncPlanetNameButtons(savedLang);

    // ── 3. CLICKABLE FEATURE CARDS & GET IT BUTTONS ──────────────────────────
    // The top nav tabs already work perfectly (they call the engine's switchTab
    // after checking the data is ready). So every card and Get It button simply
    // triggers the matching nav tab's own click — guaranteed identical behaviour.
    function goToTab(tabId) {
      const navBtn = document.querySelector('.nav-tab[data-tab="' + tabId + '"]');
      if (!navBtn) return;
      navBtn.click();  // delegate to the proven-working nav tab
      // If nothing happened (data not ready yet), the engine ignored it — nudge.
      setTimeout(function () {
        const screen = document.getElementById(tabId);
        if (screen && !screen.classList.contains("active")) {
          const birth = document.querySelector('.nav-tab[data-tab="inputTab"]');
          if (birth) birth.click();
          flashStatus(window.t ? window.t("locked_generate_first") : "Generate your chart first, then unlock this report.");
        }
      }, 50);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Map paid features to their tab id.
    const PAY_TAB = { dasha: "dashaTab", domains: "domainTab", summary: "summaryTab" };

    // Price lookup from central config.
    function priceFor(item) {
      const p = (window.APP_CONFIG && window.APP_CONFIG.prices) || {};
      if (item === "dasha")   return p.dasha   || 399;
      if (item === "domains") return p.lifeDomains || 299;
      return 0;
    }

    // Card-level click (the whole tile) — but ignore clicks that land on a button.
    document.querySelectorAll(".feature-card[data-goto]").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest("button")) return;  // button handles its own click
        goToTab(card.getAttribute("data-goto"));
      });
    });

    // "Get It" buttons that navigate directly (free features).
    document.querySelectorAll('button[data-goto]').forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        goToTab(btn.getAttribute("data-goto"));
      });
    });

    // "Get It" buttons on PAID features → Razorpay checkout, then open on success.
    document.querySelectorAll("button[data-pay]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const item = btn.getAttribute("data-pay");
        const tab  = PAY_TAB[item] || "inputTab";

        // Already PAID this session → open it.
        if (window.AI_unlocked && window.AI_unlocked[item] === true) { goToTab(tab); return; }

        // Require a generated chart first (need the data to build the report).
        const navBtn = document.querySelector('.nav-tab[data-tab="' + tab + '"]');
        if (navBtn && navBtn.disabled) {
          flashStatus(window.t ? window.t("locked_generate_first") : "Generate your chart first.");
          goToTab("inputTab");
          return;
        }

        // Payment must be available. If not, BLOCK (never hand over paid content).
        if (typeof window.startPayment !== "function") {
          flashStatus(window.t ? window.t("pay_unavailable") : "Payment is temporarily unavailable. Please try again shortly.");
          return;
        }

        // Refund notice — acknowledged BEFORE payment opens. Plain text (not a
        // t() key) so it always shows real wording, never a raw key like
        // "refund_confirm". Cancel stops here; Razorpay never opens.
        if (!window.confirm("No refund — please confirm before you proceed to payment.")) {
          flashStatus(window.t ? window.t("pay_cancelled") : "Payment cancelled.");
          return;
        }

        // Title for the checkout label — safe lookup (works in every language).
        let label = item;
        try {
          const card = btn.closest(".feature-card");
          const titleEl = card && card.querySelector(".fc-title");
          if (titleEl) label = titleEl.textContent;
        } catch (e) {}

        flashStatus(window.t ? window.t("pay_processing") : "Opening payment...");
        window.startPayment({
          item: item,
          amount: priceFor(item),
          label: label,
        }).then(function (res) {
          if (!res || !res.paymentId) {   // must have a verified payment id
            flashStatus(window.t ? window.t("pay_failed") : "Payment not completed.");
            return;
          }
          window.AI_unlocked = window.AI_unlocked || {};
          window.AI_unlocked[item] = true;
          window.AI_lastPayment = window.AI_lastPayment || {};
          window.AI_lastPayment[item] = res.paymentId;
          flashStatus(window.t ? window.t("pay_success") : "Payment successful!");
          if (window.AI_revealDownload) window.AI_revealDownload(item);
          goToTab(tab);
        }).catch(function (err) {
          if (err !== "dismissed") flashStatus(window.t ? window.t("pay_failed") : "Payment not completed.");
        });
      });
    });

    // ── 4. SAMPLE REPORT MODAL ───────────────────────────────────────────────
    const modal      = document.getElementById("sampleModal");
    const modalTitle = document.getElementById("sampleModalTitle");
    const modalBody  = document.getElementById("sampleModalBody");
    const modalClose = document.getElementById("sampleModalClose");

    // Sample content comes from samples-data.js (rich, realistic, translatable).
    // Picks the active language, falls back to English.
    function getSample(key) {
      const all = window.SAMPLES || {};
      const set = all[key];
      if (!set) return null;
      const lang = (typeof window._currentLang !== "undefined" && window._currentLang) ? window._currentLang : "EN";
      return set[lang] || set.EN || null;
    }

    function renderSample(key) {
      const data = getSample(key);
      if (!data || !modal) return;
      modalTitle.textContent = data.title;
      let html = "";
      if (data.example) html += '<div class="sample-example">' + esc(data.example) + "</div>";
      (data.blocks || []).forEach(function (b) {
        html += '<div class="sample-block"><div class="sample-block-h">' + esc(b[0]) +
                '</div><div class="sample-block-p">' + esc(b[1]) + "</div></div>";
      });
      if (data.locked) {
        html += '<div class="sample-locked">' +
                  '<div class="sample-locked-label">' + esc(data.locked.label) + "</div>" +
                  '<div class="sample-locked-teaser">' + esc(data.locked.teaser) + "</div>" +
                "</div>";
      }
      modalBody.innerHTML = html;
      modal.style.display = "flex";
    }

    document.querySelectorAll("[data-sample]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        renderSample(btn.getAttribute("data-sample"));
      });
    });

    if (modalClose) modalClose.addEventListener("click", function () { modal.style.display = "none"; });
    if (modal) modal.addEventListener("click", function (e) { if (e.target === modal) modal.style.display = "none"; });

    // ── 6. CONSULTATION TAB ──────────────────────────────────────────────────
    // Fill consultant profile from config
    setText("consultantName",  CONSULT_CONFIG.name);
    setText("consultantTitle", CONSULT_CONFIG.title);
    setText("consultantBio",   CONSULT_CONFIG.bio);
    const photoEl = document.getElementById("consultantPhoto");
    if (photoEl && CONSULT_CONFIG.photo) photoEl.src = CONSULT_CONFIG.photo;

    // Build consultation-type buttons
    const typesWrap = document.getElementById("consultTypes");
    let selectedType = null;
    if (typesWrap) {
      CONSULT_CONFIG.types.forEach(function (ty, i) {
        const el = document.createElement("div");
        el.className = "consult-type" + (i === 0 ? " active" : "");
        const minLabel = window.t ? window.t("consult_min") : "min";
        el.innerHTML =
          '<div class="consult-type-dur">' + ty.minutes + " " + minLabel + "</div>" +
          '<div class="consult-type-price">₹' + ty.amount + "</div>";
        el.addEventListener("click", function () {
          typesWrap.querySelectorAll(".consult-type").forEach(function (x) { x.classList.remove("active"); });
          el.classList.add("active");
          selectedType = ty;
        });
        typesWrap.appendChild(el);
        if (i === 0) selectedType = ty;
      });
    }

    // Booking button — Razorpay payment, then owner notification + confirmation.
    const consultBtn = document.getElementById("consultPayBtn");
    if (consultBtn) {
      consultBtn.addEventListener("click", function () {
        const name  = (document.getElementById("consultName")  || {}).value || "";
        const phone = (document.getElementById("consultPhone") || {}).value || "";
        const dob   = (document.getElementById("consultDOB")   || {}).value || "";
        const date  = (document.getElementById("consultDate")  || {}).value || "";
        const query = (document.getElementById("consultQuery") || {}).value || "";
        const status = document.getElementById("consultStatus");

        if (!name.trim() || !phone.trim()) {
          if (status) { status.textContent = "Please enter your name and mobile number."; status.style.color = "var(--danger)"; }
          return;
        }
        if (!selectedType) {
          if (status) { status.textContent = "Please select a consultation type."; status.style.color = "var(--danger)"; }
          return;
        }

        const booking = {
          type: "consultation",
          name: name, phone: phone, dob: dob, date: date, query: query,
          duration: selectedType.minutes + " min",
          amount: selectedType.amount,
        };

        if (typeof window.startPayment !== "function") {
          // Payment system not loaded — show confirmation as a fallback.
          showConsultConfirmed(status);
          return;
        }

        if (status) { status.textContent = window.t ? window.t("pay_processing") : "Opening payment..."; status.style.color = "var(--text-dim)"; }
        window.startPayment({
          item: "consult_" + selectedType.id,
          amount: selectedType.amount,
          label: "Consultation (" + selectedType.minutes + " min)",
          booking: booking,
        }).then(function () {
          showConsultConfirmed(status);
        }).catch(function (err) {
          if (status) {
            status.textContent = (err === "dismissed") ? "" : (window.t ? window.t("pay_failed") : "Payment not completed.");
            status.style.color = "var(--danger)";
          }
        });
      });
    }

    function showConsultConfirmed(status) {
      const confirmed = document.getElementById("consultConfirmed");
      if (confirmed) confirmed.classList.remove("hidden");
      if (status) status.textContent = "";
    }

    // ── 6b. PDF DOWNLOAD BUTTONS (paid Dasa + Life Domains) ──────────────────
    // After payment unlocks a report, its download card is revealed and this
    // builds a branded PDF from the on-screen content (user name only).
    function userName() {
      const el = document.getElementById("inputName");
      return (el && el.value.trim()) ? el.value.trim() : "Seeker";
    }
    function revealDownload(item) {
      const card = document.getElementById(item === "dasha" ? "dashaDownloadCard" : "domainDownloadCard");
      if (card) card.style.display = "";
    }
    // Reveal download cards if already unlocked this session.
    if (window.AI_unlocked) {
      if (window.AI_unlocked.dasha) revealDownload("dasha");
      if (window.AI_unlocked.domains) revealDownload("domains");
    }
    document.querySelectorAll("[data-download]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.getAttribute("data-download");
        if (typeof window.generateReportPDF !== "function") return;
        // Safety gate: never generate a paid PDF without a verified payment.
        if (!(window.AI_unlocked && window.AI_unlocked[item] === true)) {
          flashStatus(window.t ? window.t("pay_required") : "Please complete payment to download this report.");
          return;
        }
        if (btn.dataset.busy === "1") return;   // prevent double-clicks

        const orig = btn.getAttribute("data-orig-label") || btn.textContent;
        btn.setAttribute("data-orig-label", orig);

        function resetBtn() { btn.disabled = false; btn.dataset.busy = "0"; btn.textContent = orig; }

        if (item === "dasha") {
          if (typeof window.buildDasaReport !== "function") { flashStatus("Report builder not loaded — please refresh."); return; }
          const navBtn = document.querySelector('.nav-tab[data-tab="dashaTab"]');
          if (navBtn) navBtn.click();  // ensure timeline is rendered
          btn.disabled = true; btn.dataset.busy = "1";
          btn.textContent = "Preparing your report… please wait";   // immediate cue
          flashStatus(window.t ? window.t("report_preparing") : "Preparing your Dasa report… this can take a few seconds.");
          setTimeout(function () {
            window.buildDasaReport("full", function (done, total) {
              btn.textContent = "Preparing report… " + done + "/" + total;
            }).then(function (sections) {
              resetBtn();
              window.generateReportPDF({
                userName: userName(),
                reportTitle: "Dasa Bhukti Period Indications",
                sections: humanizeSections(sections),   // gentle wording + plain English
                paymentId: (window.AI_lastPayment && window.AI_lastPayment.dasha) || null,
              });
            }).catch(function (e) {
              resetBtn();
              flashStatus(typeof e === "string" ? e : "Could not build the report. Please try again.");
            });
          }, 300);
        } else {
          // Life Domains — clean structured sections from rendered cards.
          btn.disabled = true; btn.dataset.busy = "1";
          btn.textContent = "Preparing report…";
          setTimeout(function () {
            try {
              window.generateReportPDF({
                userName: userName(),
                reportTitle: "Life Domains Indications",
                sections: collectDomainSections(),
                paymentId: (window.AI_lastPayment && window.AI_lastPayment.domains) || null,
              });
            } catch (e) {
              flashStatus("Could not build the report. Please try again.");
            }
            resetBtn();
          }, 200);
        }
      });
    });

    // ── Filter out sensitive domains everywhere (screen + report) ──
    const HIDDEN_DOMAINS = ["emotional fidelity", "hidden connection"];
    function isHiddenDomain(title) {
      const t = (title || "").trim().toLowerCase();
      return HIDDEN_DOMAINS.some(function (h) { return t.indexOf(h) !== -1; });
    }
    // SURGICAL: remove ONLY the sensitive cards + the Emotional Fidelity nav entry.
    // Legitimate, non-sensitive chart indicators are always preserved. A block is
    // collapsed only if EVERY card inside it turned out to be sensitive.
    function pruneHiddenDomains() {
      try {
        // 1) Life Domains main cards — hide by sensitive title only.
        document.querySelectorAll("#domainCards .domain-card").forEach(function (c) {
          var titleEl = c.querySelector(".rc-title");
          if (titleEl && isHiddenDomain(titleEl.textContent)) c.style.display = "none";
        });

        // 2) Verdict-summary minis — hide by sensitive title only.
        document.querySelectorAll("#verdictSummary .verdict-mini").forEach(function (vm) {
          var vt = vm.querySelector(".vm-title");
          if (vt && isHiddenDomain(vt.textContent)) vm.style.display = "none";
        });

        // 3) Event-flags cards — hide ONLY the sensitive ones; keep the rest.
        document.querySelectorAll("#eventFlagsBlock .ef-card").forEach(function (card) {
          var tag   = card.querySelector(".ef-domain-tag");
          var title = card.querySelector(".ef-card-title");
          var txt   = (tag ? tag.textContent : "") + " " + (title ? title.textContent : "");
          if (isHiddenDomain(txt) || /sensitive/i.test(txt)) card.style.display = "none";
        });

        // 4) Compound-pattern cards — hide ONLY those carrying the sensitive tag.
        document.querySelectorAll("#compoundPatternsBlock .cp-tag-sensitive").forEach(function (tag) {
          var card = tag.closest(".cp-card") || tag.closest("#compoundPatternsGrid > *");
          if (card) card.style.display = "none";
        });
        // ...and any compound card whose text names a hidden domain (belt & braces).
        document.querySelectorAll("#compoundPatternsBlock .cp-card").forEach(function (card) {
          if (isHiddenDomain(card.textContent)) card.style.display = "none";
        });

        // 5) Collapse a block ONLY if it has cards AND none remain visible — so a
        //    legitimate non-sensitive indicator always keeps its block on screen.
        [["eventFlagsBlock", ".ef-card"], ["compoundPatternsBlock", ".cp-card"]].forEach(function (pair) {
          var block = document.getElementById(pair[0]);
          if (!block) return;
          var cards = block.querySelectorAll(pair[1]);
          if (!cards.length) return;  // nothing rendered yet — leave the block alone
          var anyVisible = [].slice.call(cards).some(function (c) { return c.style.display !== "none"; });
          block.style.display = anyVisible ? "" : "none";
        });

        // 6) Remove the "Emotional Fidelity" entry from the top nav bar (by text).
        document.querySelectorAll(".nav-tab, [data-tab]").forEach(function (tab) {
          if (isHiddenDomain(tab.textContent)) tab.style.display = "none";
        });
      } catch (e) {
        if (window.console) console.warn("pruneHiddenDomains failed:", e);
      }
    }
    // Expose globally so it's always reachable.
    window.pruneHiddenDomains = pruneHiddenDomains;

    // The engine RE-RENDERS domain cards each time the tab opens, which restores
    // hidden cards. So we self-heal: a lightweight repeating check that re-hides
    // them. Runs every 800ms — cheap, and defeats any re-render.
    setInterval(function () {
      try { pruneHiddenDomains(); } catch (e) {}
    }, 800);

    // Also observe both containers and re-prune on any change.
    ["domainCards", "verdictSummary", "eventFlagsBlock", "compoundPatternsBlock"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && "MutationObserver" in window) {
        new MutationObserver(function () { pruneHiddenDomains(); }).observe(el, { childList: true, subtree: true });
      }
    });
    pruneHiddenDomains();

    // ── PLAIN-LANGUAGE + GENTLE-WORDING LAYER (reports only) ─────────────────
    // Turns the engine's technical astrology text into clear plain English and
    // softens alarming health / relationship phrasing — WITHOUT changing meaning.
    // Runs only at PDF-build time, so it never fights the live engine or flickers.

    // (1) GENTLE WORDING — calmer, non-catastrophic equivalents. Longest first.
    var GENTLE_MAP = [
      // health
      [/life[-\s]?threatening\s+(illness|disease|condition)s?/gi, "serious health concern"],
      [/mysterious ailments that evade diagnosis/gi, "health issues that may take time to identify"],
      [/undiagnosed ailments?/gi, "health concerns that need attention"],
      [/requiring hospitalization or isolation/gi, "that may call for rest and recovery"],
      [/risk of hospitalizations?/gi, "a need for extra rest or care"],
      [/hospitalizations?/gi, "periods of rest or medical care"],
      [/strange infections/gi, "minor infections"],
      [/immune system weakness/gi, "lowered immunity"],
      [/heart palpitations/gi, "occasional heart-related sensitivity"],
      [/health crises/gi, "health challenges"],
      [/health crisis/gi, "health challenge"],
      // relationships
      [/secret affairs/gi, "private or complicated connections"],
      [/physical separation from (?:your |the )?spouse/gi, "time spent apart from your partner"],
      [/physical separation/gi, "periods of distance"],
      [/emotionally unavailable/gi, "less emotionally available"],
      [/frequent misunderstandings/gi, "occasional misunderstandings"],
      // general catastrophising
      [/\ba\s+prolonged identity crisis/gi, "an extended period of self-doubt"],
      [/\ban?\s+identity crisis/gi, "a period of self-doubt"],
      [/identity crisis/gi, "period of self-doubt"],
      [/\bcrises\b/gi, "challenges"],
      [/\bcrisis\b/gi, "challenging phase"],
      [/forced departures?/gi, "unexpected changes"],
      [/career setbacks/gi, "career slowdowns"],
    ];
    function softenText(s) {
      if (!s) return s;
      GENTLE_MAP.forEach(function (p) { s = s.replace(p[0], p[1]); });
      return s;
    }

    // Focused softener for the chart-indication cards: tones down alarming
    // health/illness phrasing (per request: "soften only health wording") while
    // leaving the astrological content of the card intact. Applied ONLY to those
    // two card sections, not to domain cards.
    var HEALTH_SOFTEN = [
      [/elevated serious illness probability/gi, "a health area worth extra attention"],
      [/elevated markers for (?:a |an )?serious or life-impacting health event/gi, "raised emphasis on health and vitality"],
      [/elevated markers for (?:a |an )?life-impacting health event/gi, "raised emphasis on health and vitality"],
      [/serious or life-impacting health event/gi, "a significant health matter"],
      [/life-impacting health event/gi, "a significant health matter"],
      [/serious illness probability/gi, "a health area to keep an eye on"],
      [/\bserious illness\b/gi, "a significant health matter"],
      [/elevated (?:risk|markers) (?:for|of)\b/gi, "raised emphasis on"],
      [/risk signal/gi, "area to watch"],
    ];
    function softenHealth(s) {
      if (!s) return s;
      s = softenText(s);                                   // shared gentle pass
      HEALTH_SOFTEN.forEach(function (p) { s = s.replace(p[0], p[1]); });
      return s;
    }

    // (2) PLAIN ENGLISH — rewrite the engine's standard sentences, then de-jargon
    //     anything left over with a term glossary.
    var BOILERPLATE = [
      [/Neither D1 nor D9 is strongly established\.\s*The potential exists but has not crystallised into consistent outer or inner expression\.\s*Dasha periods of the domain activating planets are the windows when the pattern sharpens\./gi,
       "This area of life is still taking shape. The potential is there but hasn't fully settled yet. It comes into focus during the life periods linked to this area."],
      [/The D1 structure is reliable — the external circumstances, capacity, and effort are present\.\s*D9 suggests the soul-level resonance is still forming; the domain functions well but may feel less settled internally than it appears externally\./gi,
       "The practical side of this area is solid — the circumstances, ability, and effort are there. The deeper, inner side is still settling, so it tends to work well in practice even if it doesn't always feel settled inside."],
      [/Both the outer experience \(D1\) and the soul-level confirmation \(D9\) align — this domain operates with natural momentum and rarely needs to be forced\./gi,
       "Both the outer experience and the deeper, inner sense agree here — this area tends to flow naturally and rarely needs forcing."],
    ];
    var TERM_MAP = [
      // chart divisions / house shorthand (most specific first)
      [/\bD1[-\s]?H(\d{1,2})\b/gi, "house $1 of the birth chart"],
      [/\bD9:\s*/gi, "Deeper chart: "],
      [/\bD9\b/gi, "the deeper chart"],
      [/\bD1\/D9\b/gi, "both charts"],
      [/\bD1\b/gi, "the birth chart"],
      // yogas → plain gloss
      [/Viparita Raja Yoga/gi, "a difficulties-into-gains combination"],
      [/Raja Yoga/gi, "a success-bringing combination"],
      [/Kemadruma Yoga/gi, "a combination that can bring emotional ups and downs"],
      // dignities / roles
      [/\byogakaraka\b/gi, "most beneficial planet"],
      [/\bkendra lord\b/gi, "angular-house ruler"],
      [/\btrikona lord\b/gi, "fortune-house ruler"],
      [/\bdusthana lords?\b/gi, "challenge-house rulers"],
      [/\bdusthanas?\b/gi, "challenge houses"],
      [/\bcombust\b/gi, "weakened by closeness to the Sun"],
      [/\bdebilitated\b/gi, "in a weakened position"],
      [/\bfunctional malefic\b/gi, "a more challenging planet for you"],
      [/\bfunctional benefic\b/gi, "a supportive planet for you"],
      [/\bas benefic\b/gi, "(a supportive influence)"],
      [/\bas neutral\b/gi, "(a neutral influence)"],
      [/\bas malefic\b/gi, "(a more challenging influence)"],
      // periods
      [/\bMahadasha\b/gi, "major life period"],
      [/\bAntardasha\b/gi, "sub-period"],
      [/\bMD\b/g, "major period"],
      [/\bAD\b/g, "sub-period"],
      [/\blagna\b/gi, "rising sign"],
      [/\bascendant\b/gi, "rising sign"],
      // leftover house shorthand
      [/\bown sign in H(\d{1,2})\b/gi, "strong in house $1"],
      [/\bin H(\d{1,2})\b/gi, "in house $1"],
      [/\bH(\d{1,2})\b/gi, "house $1"],
      // standalone benefic/malefic (after the functional/ "as" rules above)
      [/\bbenefic\b/gi, "supportive"],
      [/\bmalefic\b/gi, "challenging"],
    ];
    function plainifyText(s) {
      if (!s) return s;
      BOILERPLATE.forEach(function (p) { s = s.replace(p[0], p[1]); });
      TERM_MAP.forEach(function (p) { s = s.replace(p[0], p[1]); });
      s = s.replace(/\s*·\s*/g, ". ");           // tidy the "·" separators
      s = s.replace(/[ \t]{2,}/g, " ").trim();   // collapse double spaces
      return s;
    }

    // Combined: soften first (so plain glosses don't block the gentle matches),
    // then plainify.
    function humanize(s) { return plainifyText(softenText(s)); }

    // Map over an array of report sections. For the Dasa report we apply ONLY
    // the gentle-wording pass (softens alarming health/relationship phrasing) and
    // deliberately DO NOT run the jargon rewrite — the astrological vocabulary
    // (Mahadasha, Antardasha, combust, debilitated, house placements, yogas) is
    // the value of the report and must stay intact, especially now that the
    // report defines MD/AD terms itself.
    function humanizeSections(sections) {
      if (!Array.isArray(sections)) return sections;
      return sections.map(function (sec) {
        if (!sec || typeof sec !== "object") return sec;
        var copy = {};
        for (var k in sec) if (Object.prototype.hasOwnProperty.call(sec, k)) copy[k] = sec[k];
        ["heading", "title", "body", "text"].forEach(function (f) {
          if (typeof copy[f] === "string") copy[f] = softenText(copy[f]);
        });
        return copy;
      });
    }

    // Full "How to read this report" legend page. Each term is KEPT, with a
    // plain "what this means" line beneath it.
    function domainLegendSection() {
      return {
        heading: "How to Read This Report",
        body:
          "A few terms appear throughout this report. Here is what each one means, in plain language, so the pages that follow read clearly.\n\n" +

          "Don't worry if the technical logic in this report isn't familiar to you — you don't need to understand it. It is included only to show the astrological basis behind each indication. What matters is this: every indication here is drawn specifically from your own D1 (Birth chart) and D9 (Navamsha chart) planetary placements and their interpretation — not from anything generic.\n\n" +

          "**D1 (Birth chart)**\n" +
          "What this means: your main birth chart — the snapshot of the sky at your birth. It describes outer life: circumstances, events, and how things actually play out day to day.\n\n" +

          "**D9 (Deeper chart)**\n" +
          "What this means: a finer 'zoom-in' chart (the Navamsha). It describes the inner, soul-level side of a matter — durability, depth, and how something feels on the inside rather than how it looks on the outside.\n\n" +

          "**D1 vs D9 — the difference**\n" +
          "What this means: D1 is the outer experience; D9 is the inner foundation. When both agree, an area of life is both visible and solid. When only D1 is strong, it works in practice but may feel unsettled inside. When only D9 is strong, it feels right within but hasn't fully shown up outwardly yet.\n\n" +

          "**H (House 1-12)**\n" +
          "What this means: 'H' is a House — one of the twelve life areas of a chart (for example H1 = self and identity, H7 = partnership, H10 = career). 'D1-H7' means the 7th house of the birth chart; 'D9-H3' means the 3rd house of the deeper chart.\n\n" +

          "**Strength — how settled an area of life is right now**\n" +
          "  • Still Forming — the potential is there but hasn't fully taken shape yet.\n" +
          "  • Foundation Holds — the practical side is solid; the inner side is still settling.\n" +
          "  • In Full Flow — the outer and inner sides agree and tend to flow naturally.\n\n" +

          "**Confidence — how strongly the signs point the same way**\n" +
          "  • High — the main signals agree, so the reading is dependable.\n" +
          "  • Low — the signals are mixed, so timing and personal effort matter more.\n\n" +

          "**Other terms you may see**\n" +
          "  • Conscious Renewal — a phase where growth comes from deliberately letting go of an old pattern and rebuilding it on purpose, rather than waiting for it to change on its own.\n" +
          "  • Soul-Level Sustenance — the deeper, inner nourishment an area gives you (meaning and fulfilment), as opposed to its outward, material results.\n" +
          "  • A counterweight that must be navigated — there are two opposing pulls in this area (for example, the urge for security versus the urge for freedom, or independence versus closeness). The point is to consciously balance the two so you avoid swinging to either extreme or getting stuck.\n" +
          "  • Strongest periods — the life stages when this area is most active and most worth acting on.",
        isRich: true,
      };
    }

    // The chart's dominant planetary axis — reproduced from the real on-screen
    // summary card (#coOpeningText / #coAxisText / #coModifierText), with a short
    // definition of what the axis means. Returns null if the card isn't present.
    function dominantAxisSection() {
      var t = function (id) { var el = document.getElementById(id); return el ? el.textContent.trim() : ""; };
      var badges = [];
      document.querySelectorAll("#coPatternBadge .co-badge").forEach(function (b) {
        var s = b.textContent.trim(); if (s) badges.push(s);
      });
      var opening  = t("coOpeningText");
      var axisLine = t("coAxisText");
      var modifier = t("coModifierText");
      if (!opening && !axisLine && !modifier) return null;   // card not rendered

      var body = "";
      body += "What this means: every chart turns around a central axis — the pair of life areas that form its core theme, the polarity the whole life tends to revolve around. It is the single most important lens for reading everything else below.\n\n";
      if (badges.length) body += "**Chart signature: " + badges.join("  ·  ") + "**\n";
      if (opening)  body += opening + "\n\n";
      if (axisLine) body += "**" + axisLine + "**\n";
      if (modifier) body += "\n" + modifier;
      return { heading: "The Dominant Planetary Axis", body: body.trim(), isRich: true };
    }
    window.AI_humanizeSections = humanizeSections;  // reusable by the Dasa path

    // Build clean Life Domains sections from the rendered domain cards.
    // Plain "what it means for you" line per domain × strength tier. Gives every
    // domain a human takeaway even when it isn't covered in the card sections.
    // Unmapped tiers fall back to a sensible generic line (see whatItMeans()).
    var DOMAIN_MEANING = {
      "identity & personality": {
        "still forming":     "your sense of self and how you come across is still taking shape. The raw material is there, but it firms up through the active periods below rather than all at once.",
        "foundation holds":  "your core identity is steady and dependable on the outside; the inner sense of self is still settling, so you may feel less certain within than you appear.",
        "peak comes early":  "your strongest, clearest sense of self lands earlier in life — lean into it then, as the qualities you build early become your lasting signature.",
        "in full flow":      "your identity and self-expression move with natural confidence — who you are and how you show up are well aligned."
      },
      "wealth & family": {
        "still forming":     "your financial and family footing is still building. Stability comes from steady habits during the active periods rather than from any single windfall.",
        "foundation holds":  "the practical side of money and family is solid and reliable; the deeper sense of 'enough' may still be settling, so security can feel less certain than it is.",
        "peak comes early":  "your strongest earning and family-building window arrives earlier — save and consolidate aggressively then, as those gains anchor the later years.",
        "in full flow":      "wealth and family support move smoothly and tend to sustain themselves with little forcing."
      },
      "marriage & relationship": {
        "still forming":     "your partnership life is still finding its shape. Connections deepen and steady through the active periods rather than arriving fully formed.",
        "foundation holds":  "your relationships are practically stable and committed; the emotional depth may still be maturing, so they can feel less settled inside than they look.",
        "peak comes early":  "your most significant relationship window comes earlier — the bonds and patterns set then tend to define your relational life going forward.",
        "in full flow":      "partnership comes naturally to you — closeness and commitment tend to flow without strain."
      },
      "career & ambition": {
        "still forming":     "your professional direction is still crystallising. Momentum builds through the active periods, so consistent effort now matters more than early results.",
        "foundation holds":  "your career has a solid, dependable base; the sense of true calling may still be forming, so outward success can outpace inner conviction for a while.",
        "peak comes early":  "your strongest career-building window lands earlier — push for position and skill then, as that groundwork carries the rest of your working life.",
        "in full flow":      "work and ambition move with natural momentum — opportunity and capability tend to line up."
      },
      "health & vitality": {
        "still forming":     "your vitality and physical resilience are still taking shape. The foundation isn't fully set, so steady habits and attention during the active periods matter more than assuming it will hold on its own.",
        "foundation holds":  "your physical constitution is fundamentally sound; the deeper resilience is still settling, so consistent routines keep it dependable.",
        "peak comes early":  "your strongest, most robust health window is earlier in life — the habits you set then largely determine how well vitality holds later, so build them deliberately.",
        "in full flow":      "your health and energy tend to sustain themselves naturally, recovering well with ordinary care."
      }
    };
    function whatItMeans(domainTitle, strength) {
      var d = (domainTitle || "").trim().toLowerCase();
      var s = (strength || "").trim().toLowerCase();
      var row = DOMAIN_MEANING[d];
      if (row && row[s]) return row[s];
      // Generic fallback keyed on common phrasings, so no domain is left blank.
      if (s.indexOf("still") !== -1 || s.indexOf("forming") !== -1)
        return "this area is still taking shape — it firms up through the active periods below rather than all at once.";
      if (s.indexOf("foundation") !== -1)
        return "the practical side of this area is solid; the inner side is still settling, so it may feel less certain than it looks.";
      if (s.indexOf("peak") !== -1 || s.indexOf("early") !== -1)
        return "this area is strongest earlier in life — act on it during that window, as what you build then tends to last.";
      if (s.indexOf("flow") !== -1)
        return "this area moves with natural ease and tends to sustain itself without forcing.";
      return "read this area alongside its strength and timing below — the active periods are when it comes into focus.";
    }

    function collectDomainSections() {
      const out = [];
      const root = document.getElementById("domainCards");
      if (!root) return out;
      out.push(domainLegendSection());   // full how-to-read page leads the report
      var axisSec = dominantAxisSection();
      if (axisSec) out.push(axisSec);    // real dominant-axis card, if present

      // helper used throughout
      const t = function (el) { return el ? el.textContent.trim() : ""; };

      root.querySelectorAll(".domain-card").forEach(function (c) {
        const title = c.querySelector(".rc-title");
        if (title && isHiddenDomain(title.textContent)) return;  // skip hidden domains
        const verdict = c.querySelector(".rc-verdict");
        const pattern = c.querySelector(".rc-pattern");
        const confLine = c.querySelector(".rc-confidence-line");
        const windowEl = c.querySelector(".rc-window, .rc-activation");
        const yoga = c.querySelector(".rc-yoga-badges");

        // Kept VERBATIM, exactly as on screen. The repeated tier-explanation
        // paragraph (.rc-indication) is intentionally OMITTED here — its meaning
        // is defined once in the legend — so the same sentence no longer prints
        // under every domain. Each domain keeps only its UNIQUE, chart-specific
        // content: the Strength label, the specific Pattern, any Yoga badges,
        // the Activation Window, and the Confidence reason.
        let body = "";
        if (verdict)  body += "Strength: " + t(verdict) + "\n";
        if (yoga && t(yoga)) body += "Yogas: " + t(yoga) + "\n";
        if (pattern)  body += "Key pattern: " + t(pattern) + "\n";
        body += "What it means for you: " + whatItMeans(t(title), t(verdict)) + "\n";
        if (windowEl) body += t(windowEl) + "\n";   // already labelled "Activation Window"
        if (confLine) body += t(confLine);

        out.push({ heading: t(title) || "Domain", body: body, isDomain: true });
      });

      // ── Specific Indications From Your Chart (#eventFlagsBlock) ──────────────
      // Reproduced from the real card structure: bold title + indication.
      // Caution lines dropped (the bottom disclaimer covers self-reflection use).
      // Sensitive cards excluded; health/illness wording gently softened.
      const efCards = [];
      document.querySelectorAll("#eventFlagsBlock .ef-card").forEach(function (card) {
        const ttl  = t(card.querySelector(".ef-card-title"));
        const tag  = t(card.querySelector(".ef-domain-tag"));
        if (isHiddenDomain(ttl + " " + tag) || /sensitive/i.test(ttl + " " + tag)) return;
        const ind  = t(card.querySelector(".ef-card-indication"));
        const caut = t(card.querySelector(".ef-card-caution"));
        var block = "";
        if (ttl)  block += "**" + ttl + "**\n";
        if (ind)  block += softenHealth(ind);
        if (caut) block += "\n" + softenHealth(caut.replace(/^[⚠\s]+/, "Tip: "));
        if (block.trim()) efCards.push(block.trim());
      });
      if (efCards.length) {
        out.push({
          heading: "Specific Indications From Your Chart",
          body: "Configurations that carry classical significance beyond the domain reading.\n\n" +
                efCards.join("\n\n"),
          isRich: true,
        });
      }

      // ── Life Pattern Indications (#compoundPatternsBlock) ────────────────────
      // Reproduced: bold title + indicator count + indication + activation window.
      // Caution lines dropped. Sensitive cards excluded; health softened.
      const cpCards = [];
      document.querySelectorAll("#compoundPatternsBlock .cp-card").forEach(function (card) {
        if (card.querySelector(".cp-tag-sensitive") || isHiddenDomain(card.textContent)) return;
        const ttl   = t(card.querySelector(".cp-card-title"));
        const tag   = t(card.querySelector(".cp-domain-tag"));
        const count = t(card.querySelector(".cp-cond-label"));
        const ind   = t(card.querySelector(".cp-indication"));
        const caut  = t(card.querySelector(".cp-caution"));
        const win   = t(card.querySelector(".cp-window"));
        var block = "";
        if (ttl)   block += "**" + softenHealth(ttl) + "**\n";
        if (tag)   block += softenHealth(tag) + (count ? "  (" + count + ")" : "") + "\n";
        else if (count) block += count + "\n";
        if (ind)   block += softenHealth(ind);
        if (caut)  block += "\n" + softenHealth(caut.replace(/^[⚠\s]+/, "Tip: "));
        if (win)   block += "\n" + win;
        if (block.trim()) cpCards.push(block.trim());
      });
      if (cpCards.length) {
        out.push({
          heading: "Life Pattern Indications",
          body: "Multi-factor compound patterns — probability signals, not predictions.\n\n" +
                cpCards.join("\n\n"),
          isRich: true,
        });
      }

      return out;
    }
    // Expose so payments can reveal the button on success.
    window.AI_revealDownload = revealDownload;

    // ── 7. CONTACT US TAB ─────────────────────────────────────────────────────
    const contactType = document.getElementById("contactType");
    const contactMDWrap = document.getElementById("contactMDWrap");
    if (contactType && contactMDWrap) {
      contactType.addEventListener("change", function () {
        contactMDWrap.style.display = (contactType.value === "Extra MD report") ? "" : "none";
      });
    }
    const contactBtn = document.getElementById("contactSubmitBtn");
    if (contactBtn) {
      contactBtn.addEventListener("click", function () {
        const status = document.getElementById("contactStatus");
        const name = (document.getElementById("contactName") || {}).value || "";
        const email = (document.getElementById("contactEmail") || {}).value || "";
        const phone = (document.getElementById("contactPhone") || {}).value || "";
        const message = (document.getElementById("contactMessage") || {}).value || "";
        const type = contactType ? contactType.value : "Others";
        const mdWanted = (document.getElementById("contactMD") || {}).value || "";

        if (!name.trim() || (!email.trim() && !phone.trim())) {
          if (status) { status.textContent = "Please enter your name and email or phone."; status.style.color = "var(--danger)"; }
          return;
        }
        if (status) { status.textContent = "Sending..."; status.style.color = "var(--text-dim)"; }
        contactBtn.disabled = true;

        fetch("/api/contact", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: type, name: name, email: email, phone: phone, message: message, mdWanted: mdWanted }),
        }).then(function (r) { return r.json(); }).then(function (res) {
          contactBtn.disabled = false;
          if (res && res.ok) {
            const confirmed = document.getElementById("contactConfirmed");
            if (confirmed) confirmed.classList.remove("hidden");
            if (status) status.textContent = "";
            ["contactName", "contactEmail", "contactPhone", "contactMessage", "contactMD"].forEach(function (id) {
              const el = document.getElementById(id); if (el) el.value = "";
            });
          } else {
            if (status) { status.textContent = (res && res.error) || "Could not send. Please try again."; status.style.color = "var(--danger)"; }
          }
        }).catch(function () {
          contactBtn.disabled = false;
          if (status) { status.textContent = "Could not send. Please try again."; status.style.color = "var(--danger)"; }
        });
      });
    }

    // ── 7. REFERENCES READER (in-app pages, in-place translation) ────────────
    const refLibrary  = document.getElementById("refLibrary");
    const refReader   = document.getElementById("refReader");
    const refArticle  = document.getElementById("refArticle");
    const refBackBtn  = document.getElementById("refBackBtn");
    const refTrBtn    = document.getElementById("refTranslateBtn");
    const refTrMenu   = document.getElementById("refTranslateMenu");
    let   currentRefKey = null;
    let   currentRefLang = "EN";

    // Map the translate-menu codes (lowercase google-style) to our lang codes.
    const TR_CODE_MAP = { en:"EN", ta:"TA", te:"TE", hi:"HI", kn:"KA", ml:"ML" };

    function getRefData(key, lang) {
      const all = window.REFERENCES || {};
      const entry = all[key];
      if (!entry) return null;
      if (lang === "EN") return entry;
      if (entry.langs && entry.langs[lang]) return entry.langs[lang];
      return null; // translation not available yet
    }

    function renderRef(key, lang) {
      const entry = (window.REFERENCES || {})[key];
      if (!entry || !refArticle) return;
      const data = getRefData(key, lang);
      if (!data) {
        // Translation not ready for this language — show English + a notice.
        const en = entry;
        let html = '<div class="ref-coming-soon">🌐 ' +
          (lang === "TA" ? "தமிழ் மொழிபெயர்ப்பு விரைவில்" : "Translation coming soon — showing English") +
          "</div>";
        html += '<h1 class="ref-h1">' + esc(en.title) + "</h1>";
        if (en.subtitle) html += '<p class="ref-subtitle">' + esc(en.subtitle) + "</p>";
        if (en.intro) html += '<p class="ref-intro-para">' + esc(en.intro) + "</p>";
        (en.sections || []).forEach(function (sec) {
          html += '<h2 class="ref-h2">' + esc(sec.h) + "</h2>";
          (sec.p || []).forEach(function (para) { html += '<p class="ref-para">' + esc(para) + "</p>"; });
        });
        refArticle.innerHTML = html;
        return;
      }
      let html = '<h1 class="ref-h1">' + esc(data.title) + "</h1>";
      if (data.subtitle) html += '<p class="ref-subtitle">' + esc(data.subtitle) + "</p>";
      if (data.intro) html += '<p class="ref-intro-para">' + esc(data.intro) + "</p>";
      (data.sections || []).forEach(function (sec) {
        html += '<h2 class="ref-h2">' + esc(sec.h) + "</h2>";
        (sec.p || []).forEach(function (para) { html += '<p class="ref-para">' + esc(para) + "</p>"; });
      });
      refArticle.innerHTML = html;
    }

    function openReference(key) {
      currentRefKey = key;
      currentRefLang = (typeof window._currentLang !== "undefined" && window._currentLang) ? window._currentLang : "EN";
      renderRef(key, currentRefLang);
      if (refLibrary) refLibrary.style.display = "none";
      if (refReader)  refReader.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function closeReference() {
      if (refReader)  refReader.style.display = "none";
      if (refLibrary) refLibrary.style.display = "block";
      currentRefKey = null;
    }

    document.querySelectorAll("[data-openref]").forEach(function (btn) {
      btn.addEventListener("click", function () { openReference(btn.getAttribute("data-openref")); });
    });
    if (refBackBtn) refBackBtn.addEventListener("click", closeReference);

    // Translate button → switches the guide language IN PLACE (stays on the guide).
    if (refTrBtn && refTrMenu) {
      refTrBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        refTrMenu.style.display = refTrMenu.style.display === "none" ? "block" : "none";
      });
      refTrMenu.querySelectorAll(".ref-tr-opt").forEach(function (opt) {
        opt.addEventListener("click", function (e) {
          e.stopPropagation();
          const code = TR_CODE_MAP[opt.getAttribute("data-trlang")] || "EN";
          currentRefLang = code;
          if (currentRefKey) renderRef(currentRefKey, code);
          refTrMenu.style.display = "none";
        });
      });
      document.addEventListener("click", function () { refTrMenu.style.display = "none"; });
    }

    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ── small helpers ────────────────────────────────────────────────────────
    function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
    function flashStatus(msg) {
      const s = document.getElementById("statusMsg");
      if (!s) return;
      s.textContent = msg; s.style.color = "var(--gold)";
      setTimeout(function () { if (s.textContent === msg) s.textContent = ""; }, 2500);
    }

  });
})();
