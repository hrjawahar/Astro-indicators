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
          setTimeout(function () {
            window.buildDasaReport("full", function (done, total) {
              btn.textContent = "Preparing report… " + done + "/" + total;
            }).then(function (sections) {
              resetBtn();
              window.generateReportPDF({
                userName: userName(),
                reportTitle: "Dasa Bhukti Period Indications",
                sections: sections,
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
    function pruneHiddenDomains() {
      document.querySelectorAll("#domainCards .domain-card").forEach(function (c) {
        const titleEl = c.querySelector(".rc-title");
        if (titleEl && isHiddenDomain(titleEl.textContent)) c.style.display = "none";
      });
      document.querySelectorAll("#verdictSummary .verdict-mini").forEach(function (vm) {
        const vt = vm.querySelector(".vm-title");
        if (vt && isHiddenDomain(vt.textContent)) vm.style.display = "none";
      });
      // Special "ef-card" flag cards: hide if the domain tag OR the title is sensitive.
      document.querySelectorAll(".ef-card").forEach(function (card) {
        const tag = card.querySelector(".ef-domain-tag");
        const title = card.querySelector(".ef-card-title");
        const tagHit = tag && isHiddenDomain(tag.textContent);
        const titleHit = title && isHiddenDomain(title.textContent);
        if (tagHit || titleHit) card.style.display = "none";
      });
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
    ["domainCards", "verdictSummary"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && "MutationObserver" in window) {
        new MutationObserver(function () { pruneHiddenDomains(); }).observe(el, { childList: true, subtree: true });
      }
    });
    pruneHiddenDomains();

    // Build clean Life Domains sections from the rendered domain cards.
    function collectDomainSections() {
      const out = [];
      const root = document.getElementById("domainCards");
      if (!root) return out;
      root.querySelectorAll(".domain-card").forEach(function (c) {
        const title = c.querySelector(".rc-title");
        if (title && isHiddenDomain(title.textContent)) return;  // skip hidden domains
        const verdict = c.querySelector(".rc-verdict");
        const pattern = c.querySelector(".rc-pattern");
        const indication = c.querySelector(".rc-indication");
        const confLine = c.querySelector(".rc-confidence-line");
        const windowEl = c.querySelector(".rc-window, .rc-activation");
        const t = function (el) { return el ? el.textContent.trim() : ""; };

        // Each domain becomes a heading + a structured body.
        let body = "";
        if (verdict) body += "Strength: " + t(verdict) + "\n";
        if (pattern) body += "Key pattern: " + t(pattern) + "\n";
        if (indication) body += "Indication: " + t(indication) + "\n";
        if (windowEl) body += "Best period: " + t(windowEl) + "\n";
        if (confLine) body += t(confLine);

        out.push({ heading: t(title) || "Domain", body: body, isDomain: true });
      });
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
