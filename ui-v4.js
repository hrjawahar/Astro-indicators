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

    // ── 3. CLICKABLE FEATURE CARDS ───────────────────────────────────────────
    // A card (or its "Get It" button) navigates to the relevant tab.
    function goToTab(tabId) {
      const navBtn = document.querySelector('.nav-tab[data-tab="' + tabId + '"]');
      if (navBtn) {
        navBtn.click();                       // reuse the engine's own tab routing
        // if routing was blocked (needs chart first), nudge user to birth tab
        const screen = document.getElementById(tabId);
        if (screen && !screen.classList.contains("active")) {
          const birth = document.querySelector('.nav-tab[data-tab="inputTab"]');
          if (birth) birth.click();
          flashStatus(window.t ? window.t("btn_generate") : "Generate your chart first");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    document.querySelectorAll("[data-goto]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        goToTab(el.getAttribute("data-goto"));
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

    // ── 5. PAYMENT BUTTONS (stub — live Razorpay wired in Phase 4) ───────────
    document.querySelectorAll("[data-pay]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        // For now, payments are not live. Show the "coming soon / free" message
        // and route the user to the relevant section so the app stays usable.
        flashStatus(window.t ? window.t("pay_coming_soon") : "Payments launching soon.");
        const tab = btn.getAttribute("data-pay") === "dasha" ? "dashaTab" : "inputTab";
        setTimeout(function () { goToTab(tab); }, 900);
      });
    });

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

    // Booking button (payment + notification wired live in Phase 4)
    const consultBtn = document.getElementById("consultPayBtn");
    if (consultBtn) {
      consultBtn.addEventListener("click", function () {
        const name  = (document.getElementById("consultName")  || {}).value || "";
        const phone = (document.getElementById("consultPhone") || {}).value || "";
        const status = document.getElementById("consultStatus");
        if (!name.trim() || !phone.trim()) {
          if (status) { status.textContent = "Please enter your name and mobile number."; status.style.color = "var(--danger)"; }
          return;
        }
        // For now (pre-Razorpay): show the confirmation message.
        // In Phase 4 this becomes: create order → Razorpay checkout → on success,
        // POST booking to /api/book-consultation → SMS + email fire to the owner.
        if (status) { status.textContent = window.t ? window.t("pay_processing") : "Processing..."; status.style.color = "var(--text-dim)"; }
        setTimeout(function () {
          const confirmed = document.getElementById("consultConfirmed");
          if (confirmed) confirmed.classList.remove("hidden");
          if (status) status.textContent = "";
        }, 700);
      });
    }

    // ── 7. REFERENCES READER (in-app pages + Google Translate button) ────────
    const refLibrary  = document.getElementById("refLibrary");
    const refReader   = document.getElementById("refReader");
    const refArticle  = document.getElementById("refArticle");
    const refBackBtn  = document.getElementById("refBackBtn");
    const refTrBtn    = document.getElementById("refTranslateBtn");
    const refTrMenu   = document.getElementById("refTranslateMenu");

    function openReference(key) {
      const data = (window.REFERENCES || {})[key];
      if (!data || !refArticle) return;
      let html = '<h1 class="ref-h1">' + esc(data.title) + "</h1>";
      if (data.subtitle) html += '<p class="ref-subtitle">' + esc(data.subtitle) + "</p>";
      if (data.intro) html += '<p class="ref-intro-para">' + esc(data.intro) + "</p>";
      (data.sections || []).forEach(function (sec) {
        html += '<h2 class="ref-h2">' + esc(sec.h) + "</h2>";
        (sec.p || []).forEach(function (para) {
          html += '<p class="ref-para">' + esc(para) + "</p>";
        });
      });
      refArticle.innerHTML = html;
      if (refLibrary) refLibrary.style.display = "none";
      if (refReader)  refReader.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function closeReference() {
      if (refReader)  refReader.style.display = "none";
      if (refLibrary) refLibrary.style.display = "block";
    }

    document.querySelectorAll("[data-openref]").forEach(function (btn) {
      btn.addEventListener("click", function () { openReference(btn.getAttribute("data-openref")); });
    });
    if (refBackBtn) refBackBtn.addEventListener("click", closeReference);

    // Translate button → opens the live page in Google Translate, chosen language.
    if (refTrBtn && refTrMenu) {
      refTrBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        refTrMenu.style.display = refTrMenu.style.display === "none" ? "block" : "none";
      });
      refTrMenu.querySelectorAll(".ref-tr-opt").forEach(function (opt) {
        opt.addEventListener("click", function () {
          const lang = opt.getAttribute("data-trlang");
          const pageUrl = encodeURIComponent(window.location.href);
          const gt = "https://translate.google.com/translate?sl=en&tl=" + lang + "&u=" + pageUrl;
          window.open(gt, "_blank", "noopener");
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
