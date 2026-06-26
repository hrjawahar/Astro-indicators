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

        // Already PAID this session for THIS chart → open it.
        if (isUnlockedHere(item)) { goToTab(tab); return; }

        // Maybe this chart was paid in a PREVIOUS session — ask the server before
        // ever opening payment. If it's already paid, unlock and open instead of
        // charging again. This is what prevents double-charging across sessions.
        flashStatus(window.t ? window.t("pay_checking") : "Checking your purchase…");
        srvStatus(item).then(function (r) {
          if (r && r.paid) {
            window.AI_unlocked = window.AI_unlocked || {};
            window.AI_unlocked[item] = chartId();          // tag unlock to THIS chart
            if (window.AI_revealDownload) window.AI_revealDownload(item);
            flashStatus(window.t ? window.t("already_paid") : "You already own this report — opening it.");
            goToTab(tab);
            return;
          }
          openPaymentFlow();   // not paid → proceed to Razorpay
        }).catch(function () {
          openPaymentFlow();   // server unreachable → fall back to normal payment
        });
        return;

        function openPaymentFlow() {
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

        // Email is required (for the invoice). Read from the birth form; if it's
        // empty/invalid (e.g. a returning user buying only this report), PROMPT
        // for it inline so they can enter it without hunting for the form field.
        var payerEmail = "";
        try { payerEmail = (document.getElementById("inputEmail") || {}).value || ""; } catch (e) {}
        payerEmail = payerEmail.trim();
        var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(payerEmail)) {
          var promptMsg = window.t ? window.t("email_prompt") : "Enter your email — your invoice will be sent there:";
          var entered = "";
          try { entered = (window.prompt(promptMsg, payerEmail) || "").trim(); } catch (e) {}
          if (!emailRe.test(entered)) {
            flashStatus(window.t ? window.t("email_required") : "Please enter a valid email — your invoice will be sent there.");
            return;
          }
          payerEmail = entered;
          // Mirror it into the birth-form field so it's remembered this session.
          try { var ifld = document.getElementById("inputEmail"); if (ifld) ifld.value = payerEmail; } catch (e) {}
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
          chartId: chartId(),   // pay-once key, forwarded to /api/verify for the DB record
          email: payerEmail,    // for the customers (invoicing) table + Razorpay prefill
        }).then(function (res) {
          if (!res || !res.paymentId) {   // must have a verified payment id
            flashStatus(window.t ? window.t("pay_failed") : "Payment not completed.");
            return;
          }
          window.AI_unlocked = window.AI_unlocked || {};
          window.AI_unlocked[item] = chartId();   // tag unlock to THIS chart
          window.AI_lastPayment = window.AI_lastPayment || {};
          window.AI_lastPayment[item] = res.paymentId;
          flashStatus(window.t ? window.t("pay_success") : "Payment successful!");
          if (window.AI_revealDownload) window.AI_revealDownload(item);
          // Generate + store BOTH languages in the background, regardless of which
          // language is currently selected — so the paid report is saved server-side
          // and either language downloads instantly later with no repeat AI cost.
          // Wait briefly for verify.js to finish writing the paid record (otherwise
          // the store is rejected as "not yet paid"), confirming via the server.
          startPregenerationWhenPaid(item);
          goToTab(tab);
        }).catch(function (err) {
          if (err !== "dismissed") flashStatus(window.t ? window.t("pay_failed") : "Payment not completed.");
        });
        }   // end openPaymentFlow()
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
        const email = (document.getElementById("consultEmail") || {}).value || "";
        const dob   = (document.getElementById("consultDOB")   || {}).value || "";
        const date  = (document.getElementById("consultDate")  || {}).value || "";
        const query = (document.getElementById("consultQuery") || {}).value || "";
        const status = document.getElementById("consultStatus");

        if (!name.trim() || !phone.trim()) {
          if (status) { status.textContent = "Please enter your name and mobile number."; status.style.color = "var(--danger)"; }
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          if (status) { status.textContent = window.t ? window.t("email_required") : "Please enter a valid email — your invoice will be sent there."; status.style.color = "var(--danger)"; }
          try { var cef = document.getElementById("consultEmail"); if (cef) cef.focus(); } catch (e) {}
          return;
        }
        if (!selectedType) {
          if (status) { status.textContent = "Please select a consultation type."; status.style.color = "var(--danger)"; }
          return;
        }

        const booking = {
          type: "consultation",
          name: name, phone: phone, email: email.trim(), dob: dob, date: date, query: query,
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
          email: email.trim(),   // for Razorpay prefill
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

    // Stable chart identity for the pay-once rule: DOB + TOB + place ONLY
    // (name deliberately excluded — same birth data = same paid chart).
    // Reads from currentData.form if present, else the form inputs. Normalised
    // (lowercased/trimmed) so the same chart always hashes identically.
    // Stable chart identity for the pay-once rule. Built ONLY from values that are
    // identical every session for the same birth data: DOB + TOB + coordinates
    // ROUNDED to 2 decimals (~1km — unique enough for a birthplace, but immune to
    // geocoder precision drift). The free-form place STRING is deliberately NOT
    // used because the geocoded text varies between sessions (different length /
    // wording), which previously produced a different id each visit. Name excluded.
    function round2(v) {
      var n = parseFloat(v);
      return isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "";
    }
    function chartId() {
      var f = (window.currentData && window.currentData.form) || {};
      var dob = (f.dob || (document.getElementById("inputDOB") || {}).value || "").trim();
      var tob = (f.tob || (document.getElementById("inputTOB") || {}).value || "").trim();
      var lat = round2(f.lat != null ? f.lat : (document.getElementById("inputLat") || {}).value);
      var lng = round2(f.lng != null ? f.lng : (f.lon != null ? f.lon : (document.getElementById("inputLng") || {}).value));
      var basis = [dob, tob, lat, lng].join("|");
      // djb2 string hash → hex; stable and collision-safe enough for this use.
      var h = 5381;
      for (var i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) >>> 0;
      return "c" + h.toString(16) + "_" + basis.length;
    }
    window.AI_chartId = chartId;

    // An item is unlocked in THIS session only if the unlock flag was set for the
    // CURRENT chart. We store the chartId as the flag value (not just `true`), so a
    // payment for one chart can never leak to a different set of birth details.
    function isUnlockedHere(item) {
      return !!(window.AI_unlocked && window.AI_unlocked[item] === chartId());
    }
    window.AI_isUnlockedHere = isUnlockedHere;
    function revealDownload(item) {
      const card = document.getElementById(item === "dasha" ? "dashaDownloadCard" : "domainDownloadCard");
      if (card) card.style.display = "";
    }
    // Reveal download cards only if unlocked this session FOR THIS CHART.
    if (window.AI_unlocked) {
      if (isUnlockedHere("dasha")) revealDownload("dasha");
      if (isUnlockedHere("domains")) revealDownload("domains");
    }

    // Sync unlock state from the SERVER for the current chart. A returning paid
    // customer has an empty session flag, but the server knows the chart is paid.
    // We set the session flag (= chartId) so the synchronous app.js screen lock
    // and the reveal logic both recognise it. Safe to call repeatedly.
    function syncUnlockFromServer() {
      if (!chartId()) return;
      ["dasha", "domains"].forEach(function (item) {
        srvStatus(item).then(function (r) {
          if (r && r.paid) {
            window.AI_unlocked = window.AI_unlocked || {};
            window.AI_unlocked[item] = chartId();
            revealDownload(item);
          }
        }).catch(function () {});
      });
    }
    window.AI_syncUnlock = syncUnlockFromServer;
    syncUnlockFromServer();   // run once on load for the current chart

    // ── TRANSLATED REPORT (Word) — Stage 1 ───────────────────────────────────
    // English keeps the rich jsPDF PDF. Non-English is delivered as a .doc that
    // mirrors the SAME sections, because jsPDF cannot render Indic scripts but
    // Word uses the reader's system fonts. Reuses the proven /api/indicate
    // translate pattern already used by the Dasa on-screen panels.
    // Go-live languages: English + Tamil only. (Others kept commented for later.)
    var REPORT_LANG_LABELS = { EN: "English", TA: "தமிழ்" };
    // Future: TE:"తెలుగు", HI:"हिंदी", KA:"ಕನ್ನಡ", ML:"മലയാളം"
    function currentLang() {
      // Source of truth = the top language toggle, which app.js persists to
      // localStorage as "jyotish-lang" (EN / TA). Fall back to window state,
      // then EN. Any non-supported value falls back to EN.
      var l = "EN";
      try { l = localStorage.getItem("jyotish-lang") || (window._currentLang || "EN"); } catch (e) { l = window._currentLang || "EN"; }
      return REPORT_LANG_LABELS[l] ? l : "EN";
    }

    // Flatten the section array into one delimited block for a single translate
    // call (one API pass, not dozens). Headings are marked so we can rebuild the
    // structure after translation. **bold** markers are preserved as-is.
    function sectionsToBlock(sections) {
      return sections.map(function (s, i) {
        return "§§H" + i + "§§ " + (s.heading || "") + "\n" + (s.body || "");
      }).join("\n\n§§§\n\n");
    }
    function blockToSections(translated, original) {
      var parts = translated.split(/§§§/);
      return original.map(function (orig, i) {
        var chunk = parts[i] || "";
        // strip the heading marker line; first line after marker is heading
        var m = chunk.match(/§§H\d+§§\s*([^\n]*)\n?([\s\S]*)/);
        return {
          heading: m && m[1] ? m[1].trim() : (orig.heading || ""),
          body: m ? m[2].trim() : chunk.trim(),
          isRich: orig.isRich, isDomain: orig.isDomain, isNote: orig.isNote,
        };
      });
    }

    // One-pass translation of the whole report via the existing API endpoint.
    function translateSections(sections, langCode) {
      var langName = REPORT_LANG_LABELS[langCode] || "English";
      var prompt =
        "Translate the following Vedic astrology report into " + langName + ".\n\n" +
        "Rules:\n" +
        "- Translate all descriptive sentences and headings completely.\n" +
        "- Keep these UNTRANSLATED: planet names (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu), house labels (H1-H12, D1, D9), and technical terms (Mahadasha, Antardasha, Yogakaraka, Lagna, Navamsha, Vimshottari, Parivartana, Raja Yoga, Viparita, Bhadra, Kemadruma, dusthana, Tapas).\n" +
        "- Keep every line that starts with §§H or equals §§§ EXACTLY as-is, unchanged, in the same positions. These are structure markers.\n" +
        "- Keep any **double-asterisk** markers exactly around the same phrase.\n" +
        "- Do not add or remove sections. Do not add commentary.\n\n" +
        "REPORT:\n" + sectionsToBlock(sections);
      return fetch("/api/indicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt, max_tokens: 8000 }),
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        var reader = res.body.getReader(), decoder = new TextDecoder(), full = "";
        return (function read() {
          return reader.read().then(function (r) {
            if (r.done) return full;
            decoder.decode(r.value, { stream: true }).split("\n").forEach(function (line) {
              if (!line.startsWith("data: ")) return;
              var raw = line.slice(6).trim();
              if (raw === "[DONE]") return;
              try { var d = JSON.parse(raw).delta && JSON.parse(raw).delta.text; if (d) full += d; } catch (e) {}
            });
            return read();
          });
        })();
      }).then(function (full) {
        return blockToSections(full, sections);
      });
    }

    // Section-by-section translation for LONG reports (Dasa). Each section is
    // translated in its own API call so nothing is truncated. Runs sequentially
    // (gentle on the API), reporting progress. Headings + **bold** preserved.
    // Fixed Tamil glossary so the bracketed gloss is CONSISTENT every time
    // (not the model's varying guess). English term → Tamil shown in brackets.
    var TA_GLOSSARY = {
      "Sun": "சூரியன்", "Moon": "சந்திரன்", "Mars": "செவ்வாய்", "Mercury": "புதன்",
      "Jupiter": "குரு", "Venus": "சுக்கிரன்", "Saturn": "சனி", "Rahu": "ராகு", "Ketu": "கேது",
      "Aries": "மேஷம்", "Taurus": "ரிஷபம்", "Gemini": "மிதுனம்", "Cancer": "கடகம்",
      "Leo": "சிம்மம்", "Virgo": "கன்னி", "Libra": "துலாம்", "Scorpio": "விருச்சிகம்",
      "Sagittarius": "தனுசு", "Capricorn": "மகரம்", "Aquarius": "கும்பம்", "Pisces": "மீனம்",
      "Mahadasha": "மகா தசை", "Antardasha": "புக்தி", "Lagna": "லக்னம்", "Navamsha": "நவாம்சம்",
      "Yogakaraka": "யோககாரகன்", "Vimshottari": "விம்ஷோத்தரி", "Raja Yoga": "ராஜ யோகம்",
      "Viparita Raja Yoga": "விபரீத ராஜ யோகம்", "Parivartana": "பரிவர்த்தனை",
      "Bhadra": "பத்ர", "Kemadruma": "கேமத்ரும", "dusthana": "துஷ்தான", "Tapas": "தபஸ்",
      "ascendant": "லக்னம்", "exalted": "உச்சம்", "debilitated": "நீசம்",
      "lordship": "அதிபத்தியம்", "lord": "அதிபதி", "retrograde": "வக்ரம்",
      "combust": "அஸ்தமனம்", "aspect": "பார்வை", "conjunction": "சேர்க்கை",
      "own sign": "சொந்த ராசி", "house": "வீடு", "dasha": "தசை", "bhukti": "புக்தி",
    };
    function glossaryText(langCode) {
      if (langCode !== "TA") return "";
      return Object.keys(TA_GLOSSARY).map(function (k) {
        return "  " + k + " = " + TA_GLOSSARY[k];
      }).join("\n");
    }

    // Reformat ISO dates (YYYY-MM-DD) to DD/MM/YYYY for easier reading.
    function reformatDates(text) {
      if (!text) return text;
      return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, function (_, y, m, d) {
        return d + "/" + m + "/" + y;
      });
    }

    function translateSectionsIndividually(sections, langCode, onProgress) {
      var langName = REPORT_LANG_LABELS[langCode] || "English";
      var gloss = glossaryText(langCode);
      var out = [];
      // Translate ONE section → returns a Promise of the translated section.
      function translateOne(s) {
        // Separators carry a fixed label — use a known Tamil translation directly,
        // no API call (and never translate the empty body).
        if (s.isSeparator) {
          var taLabel = s.heading;
          if (langCode === "TA") {
            if (/personal chart interpretation/i.test(s.heading)) taLabel = "உங்கள் சொந்த ஜாதக விளக்கம்";
            else if (/end of your chart interpretation/i.test(s.heading)) taLabel = "உங்கள் ஜாதக விளக்கம் நிறைவடைந்தது";
          }
          return Promise.resolve({ heading: taLabel, body: "", isSeparator: true });
        }
        var prompt =
          "Translate this section of a Vedic astrology report into " + langName + ".\n\n" +
          "STYLE: Write in FORMAL, professional, written " + langName + " — the dignified register used in a paid astrology report or a serious published article, NOT casual spoken/conversational language. " +
          "Use formal verb and sentence endings (in Tamil: என்று / ஆகும் / உள்ளது / கூறுகிறோம் — never spoken forms like னு / சொல்றோம் / இருக்கு / பண்றது / தெரியாதுன்னா / கவலைப்படாதீங்க). " +
          "Avoid slang and casual contractions, but also avoid archaic/over-literary words — aim for clear, respectful, modern formal prose. Translate completely — never stop mid-sentence, never leave English sentences untranslated. " +
          "TECHNICAL TERMS: Keep these in English, but the FIRST time each appears in this section, add its " + langName + " form in brackets right after it" +
          (gloss ? ", using exactly these forms:\n" + gloss + "\n" : ".\n") +
          "Example: \"Jupiter (குரு)\", \"Cancer (கடகம்)\", \"Antardasha (புக்தி)\", \"ascendant (லக்னம்)\", \"exalted (உச்சம்)\", \"lordship (அதிபத்தியம்)\". Keep house/chart labels (H1-H12, D1, D9) in English as-is.\n\n" +
          "DURATIONS & DATES: Translate duration words — 'years'→'வருடங்கள்', 'months'→'மாதங்கள்', 'year'→'வருடம்', 'month'→'மாதம்', and the word 'to' between dates → 'முதல் … வரை'. Keep the numbers and DD/MM/YYYY dates exactly as written.\n\n" +
          "FORMATTING:\n" +
          "- Translate the heading too (add the bracketed " + langName + " term there as well). Output the heading as PLAIN TEXT — do NOT add '#', '##', or '**' around it.\n" +
          "- Keep any **double-asterisk** markers exactly around the same phrase.\n" +
          "- Do not output literal '#' characters.\n" +
          "- Output the heading on the first line, then the body. No commentary, no notes.\n\n" +
          "HEADING: " + (s.heading || "") + "\n\nBODY:\n" + (s.body || "");

        // One network attempt with a hard timeout, so a stalled QUIC/HTTP call
        // can't hang forever — it aborts and the retry wrapper tries again.
        // 180s: long Dasa sections (full MD/AD text) need more than 90s; the
        // shorter timeout was aborting them mid-stream and forcing retries.
        function attemptOnce() {
          var ctrl = new AbortController();
          var timer = setTimeout(function () { ctrl.abort(); }, 180000);  // 180s cap
          return fetch("/api/indicate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt, max_tokens: 4000 }),
            signal: ctrl.signal,
          }).then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            var reader = res.body.getReader(), decoder = new TextDecoder(), full = "";
            return (function read() {
              return reader.read().then(function (r) {
                if (r.done) return full;
                decoder.decode(r.value, { stream: true }).split("\n").forEach(function (line) {
                  if (!line.startsWith("data: ")) return;
                  var raw = line.slice(6).trim();
                  if (raw === "[DONE]") return;
                  try { var p = JSON.parse(raw); var d = p.delta && p.delta.text; if (d) full += d; } catch (e) {}
                });
                return read();
              });
            })();
          }).then(function (full) {
            clearTimeout(timer);
            if (!full || !full.trim()) throw new Error("empty response");
            var lines = full.replace(/\r/g, "").split("\n");
            var heading = (lines.shift() || "").replace(/^HEADING:\s*/i, "").replace(/^#+\s*/, "").trim() || s.heading;
            // Known fixed headings: the AI translation occasionally drops the first
            // Tamil character (e.g. இந்த → ந்த). Force the correct Tamil for these.
            if (langCode === "TA" && s.heading) {
              if (/how to read this report/i.test(s.heading)) heading = "இந்த அறிக்கையை எவ்வாறு படிப்பது";
            }
            var body = lines.join("\n").replace(/^\s*BODY:\s*/i, "").trim();
            return { heading: heading, body: body, isRich: s.isRich, isDomain: s.isDomain, isNote: s.isNote, isSeparator: s.isSeparator };
          }).catch(function (e) { clearTimeout(timer); throw e; });
        }

        // Retry transient failures (QUIC drops, timeouts, 5xx) up to 3 times
        // with a short backoff. Only the final failure rejects.
        function withRetry(attemptsLeft, delay) {
          return attemptOnce().catch(function (e) {
            if (attemptsLeft <= 1) throw e;
            return new Promise(function (resolve) { setTimeout(resolve, delay); })
              .then(function () { return withRetry(attemptsLeft - 1, delay * 2); });
          });
        }
        return withRetry(4, 1500);
      }

      // Run in BATCHES of 4 in parallel — ~4x faster than sequential, while
      // staying gentle on the API (avoids rate-limit bursts). Order preserved.
      var BATCH = 4;
      var done = 0;
      function runBatch(start) {
        if (start >= sections.length) return Promise.resolve(out);
        var slice = sections.slice(start, start + BATCH);
        return Promise.all(slice.map(function (s, k) {
          return translateOne(s).then(function (t) {
            out[start + k] = t;
            done++;
            if (onProgress) onProgress(done, sections.length);
            return t;
          });
        })).then(function () { return runBatch(start + BATCH); });
      }
      return runBatch(0);
    }

    // Build a Word (.doc) file mirroring the English report's sections.
    function downloadWordReport(sections, title, name) {
      // Strip stray markdown (##, **, leading bullets) the model sometimes adds
      // to headings — these were mangling the first character in Word.
      function cleanHeading(h) {
        return (h || "")
          .replace(/^#+\s*/, "")        // leading ## heading markers
          .replace(/\*\*/g, "")          // bold markers
          .replace(/^\s*[-•]\s*/, "")    // stray bullet
          .trim();
      }
      function fmtBody(body) {
        return (body || "").split("\n").map(function (raw) {
          var line = raw.replace(/\s+$/, "");
          if (!line.trim()) return "";
          // A body line that is actually a markdown heading (## ...) → render as
          // a clean bold sub-heading, not literal text with stray symbols.
          if (/^\s*#+\s+/.test(line)) {
            return "<p style='margin:12px 0 4px'><b>" + esc(cleanHeading(line)) + "</b></p>";
          }
          var bold = line.match(/^\s*\*\*(.+?)\*\*\s*$/);
          if (bold) return "<p style='margin:10px 0 2px'><b>" + esc(bold[1].trim()) + "</b></p>";
          var indent = /^\s{2,}[•\-]/.test(raw);
          var txt = esc(line.replace(/^\s+/, "").replace(/\*\*/g, ""));
          return "<p style='margin:0 0 7px" + (indent ? ";padding-left:18px" : "") + "'>" + txt + "</p>";
        }).join("");
      }
      var secHTML = sections.map(function (s) {
        if (s.isSeparator) {
          // Dotted divider with a centered label marking a report boundary.
          return "<div style='margin:26px 0;text-align:center'>" +
            "<div style='border-top:2px dotted #c9a84c;margin-bottom:8px'></div>" +
            "<div style='font-size:12pt;font-weight:bold;color:#5a3e00;letter-spacing:.04em'>" +
            esc(cleanHeading(s.heading)) + "</div>" +
            "<div style='border-top:2px dotted #c9a84c;margin-top:8px'></div>" +
            "</div>";
        }
        return "<h2 style='font-size:13pt;color:#5a3e00;border-bottom:1px solid #c9a84c;padding-bottom:3px;margin:22px 0 8px'>" +
          esc(cleanHeading(s.heading)) + "</h2>" + fmtBody(s.body);
      }).join("");
      var html = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>" +
        "<head><meta charset='utf-8'><title>" + esc(title) + "</title></head>" +
        "<body style='font-family:Nirmala UI,Latha,Arial,sans-serif;font-size:12pt;line-height:1.7;color:#1a1a1a;max-width:720px;margin:36px auto'>" +
        "<h1 style='font-size:17pt;color:#1a2a4a'>AstroIndicators</h1>" +
        "<p style='font-size:10pt;color:#666;margin-top:-6px'>Horoscope &amp; Dasa Period Indicators · Swiss Ephemeris · Lahiri Ayanamsha</p>" +
        "<h2 style='font-size:14pt;color:#1a2a4a;margin-top:14px'>" + esc(title) + "</h2>" +
        (name ? "<p><b>Prepared for:</b> " + esc(name) + "</p>" : "") +
        (currentLang() === "TA"
          ? "<div style='background:#fdf6e3;border:1px solid #c9a84c;border-radius:8px;padding:12px 16px;margin:14px 0;font-size:11pt;color:#5a3e00;line-height:1.7'>" + esc(TA_QUALITY_NOTE) + "</div>"
          : "") +
        secHTML + "</body></html>";
      var blob = new Blob(["\uFEFF", html], { type: "application/msword" });
      var url = URL.createObjectURL(blob);
      var safe = (name || "report").replace(/[^a-z0-9]/gi, "_");
      var a = document.createElement("a");
      a.href = url; a.download = "AstroIndicators_" + safe + "_" + currentLang() + ".doc";
      a.click(); URL.revokeObjectURL(url);
    }

    // For the translated Word path: reformat dates to DD/MM/YYYY and append the
    // SAME disclaimer + Q&A note the English PDF carries, so they get translated
    // too (they live in report-pdf.js for the PDF path, so the Word path must add
    // them explicitly). Returns a new section array; originals untouched.
    // Labels for the two boundary separators (mirror EN ↔ TA). The translator
    // will localise these for Tamil along with everything else; for the English
    // path they print as-is.
    var SEP_TOP_LABEL = "Your Personal Chart Interpretation";
    var SEP_BOTTOM_LABEL = "End of Your Chart Interpretation";
    function sepSection(label) {
      return { heading: label, body: "", isSeparator: true };
    }

    // Insert ONLY the two boundary separators (no Q&A/disclaimer) — for the
    // English PDF path, since report-pdf.js already appends its own notes.
    function addSeparatorsOnly(sections) {
      var out = [];
      var insertedTop = false;
      sections.forEach(function (s) {
        out.push(s);
        if (!insertedTop && /how to read this report/i.test(s.heading || "")) {
          out.push(sepSection(SEP_TOP_LABEL));
          insertedTop = true;
        }
      });
      if (!insertedTop) out.unshift(sepSection(SEP_TOP_LABEL));
      out.push(sepSection(SEP_BOTTOM_LABEL));
      return out;
    }

    function augmentForWord(sections) {
      var out = [];
      // Copy sections, inserting the TOP separator right after the legend
      // ("How to Read This Report") so the reader sees where the personal
      // interpretation begins.
      var insertedTop = false;
      sections.forEach(function (s) {
        out.push({
          heading: reformatDates(s.heading || ""),
          body: reformatDates(s.body || ""),
          isRich: s.isRich, isDomain: s.isDomain, isNote: s.isNote,
        });
        if (!insertedTop && /how to read this report/i.test(s.heading || "")) {
          out.push(sepSection(SEP_TOP_LABEL));
          insertedTop = true;
        }
      });
      // If there was no legend (shouldn't happen), put the top separator first.
      if (!insertedTop) out.unshift(sepSection(SEP_TOP_LABEL));

      // BOTTOM separator — marks the end of the personal interpretation, before
      // the general Q&A + disclaimer notes that follow.
      out.push(sepSection(SEP_BOTTOM_LABEL));
      out.push({
        heading: "Q&A",
        body: "Still unsure what a term means? See the Q&A section on the main page for plain-language explanations of everything used in this report.",
        isNote: true,
      });
      out.push({
        heading: "Important",
        body: "Disclaimer: This report is provided for educational and self-reflective purposes only and constitutes indicative astrological insight, not professional advice or a guarantee of outcomes. It is not a substitute for medical, psychological, legal, or financial counsel. The user assumes full responsibility for any decision made in reliance on this report, and AstroIndicators disclaims all liability to the fullest extent permitted by law. All payments are final and non-refundable once the report is generated.",
        isNote: true,
      });
      return out;
    }

    // ── SERVER PERSISTENCE (paid records + stored reports) ───────────────────
    // Talks to /api/report. Fails soft: if the server/DB is unreachable, the app
    // still works from the in-session flow (no hard dependency for a sale).
    function srvReport(payload) {
      return fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    function srvStatus(item) { return srvReport({ action: "status", chartId: chartId(), item: item }); }
    function srvFetch(item, lang) { return srvReport({ action: "fetch", chartId: chartId(), item: item, lang: lang }); }
    function srvStore(item, lang, sections) {
      return srvReport({ action: "store", chartId: chartId(), item: item, lang: lang, sections: sections });
    }

    // ── BACKGROUND PRE-GENERATION ────────────────────────────────────────────
    // After payment we generate BOTH English and Tamil in the background and
    // store them server-side, so either language downloads instantly later, on
    // any device/session, with no repeat AI cost.
    var _pregenCache = {};   // key → { promise, sections, lang, ready }
    function pregenKey(item, lang) { return item + ":" + lang; }

    // Build the English sections for an item (without rendering to PDF).
    function buildSectionsFor(item) {
      if (item === "domains") {
        return Promise.resolve(augmentForWord(collectDomainSections()));
      }
      if (item === "dasha") {
        if (typeof window.buildDasaReport !== "function") return Promise.reject("Report builder not loaded.");
        var navBtn = document.querySelector('.nav-tab[data-tab="dashaTab"]');
        if (navBtn) navBtn.click();
        return window.buildDasaReport("full", function () {}).then(function (sections) {
          return augmentForWord(humanizeSections(sections));
        });
      }
      return Promise.reject("Unknown report type.");
    }

    // After payment: generate English (instant) + Tamil (translation) and store
    // BOTH on the server. Runs in the background; download reads from server.
    function startPregeneration(item) {
      buildSectionsFor(item).then(function (enSections) {
        // Store English immediately.
        srvStore(item, "EN", enSections);
        _pregenCache[pregenKey(item, "EN")] = { ready: true, sections: enSections, lang: "EN" };
        // Then translate to Tamil and store it too.
        var taEntry = { ready: false, sections: null, lang: "TA", error: null };
        _pregenCache[pregenKey(item, "TA")] = taEntry;
        taEntry.promise = translateSectionsIndividually(enSections, "TA", function (n, tot) {
          taEntry.progress = n + "/" + tot;
        }).then(function (taSections) {
          taEntry.sections = taSections; taEntry.ready = true;
          srvStore(item, "TA", taSections);
          var b = document.querySelector('[data-download="' + item + '"]');
          if (b && b.dataset.busy !== "1") b.textContent = b.getAttribute("data-orig-label") || b.textContent;
          return taSections;
        }).catch(function (e) { taEntry.error = e || true; throw e; });
      }).catch(function () {});
    }
    window.AI_startPregeneration = startPregeneration;

    // Wait until the server confirms the paid record exists (verify.js writes it
    // right after payment), THEN pre-generate + store. Without this, srvStore can
    // fire before the paid row exists and report.js rejects it ("not paid"), so
    // nothing gets saved. Polls a few times, then proceeds regardless.
    function startPregenerationWhenPaid(item) {
      var tries = 0;
      (function poll() {
        tries++;
        srvStatus(item).then(function (r) {
          if (r && r.paid) { startPregeneration(item); return; }
          if (tries < 6) { setTimeout(poll, 1000); }   // up to ~6s
          else { startPregeneration(item); }            // proceed anyway
        }).catch(function () {
          if (tries < 6) { setTimeout(poll, 1000); } else { startPregeneration(item); }
        });
      })();
    }
    window.AI_startPregenerationWhenPaid = startPregenerationWhenPaid;

    // Tamil messages (shown to Tamil-mode customers).
    var TA_WAIT_MSG =
      "உங்கள் தமிழ் அறிக்கை தயாராகிக் கொண்டிருக்கிறது — இதற்கு சுமார் 5–7 நிமிடங்கள் ஆகும். " +
      "தயவுசெய்து சிறிது பொறுமையாகக் காத்திருங்கள். அறிக்கை தயாரானதும் தானாகவே பதிவிறக்கம் தொடங்கும்.";
    // Refined Tamil-quality note placed at the top of translated reports.
    var TA_QUALITY_NOTE =
      "இந்த அறிக்கை, உங்களுக்கு எளிதாக புரியும் வகையில் தமிழில் மொழிபெயர்க்கப்பட்டுள்ளது. " +
      "சில சொற்றொடர்கள் இயல்பான தமிழிலிருந்து சற்று வேறுபட்டு இருக்கலாம் — வார்த்தைகளை விட " +
      "உள்ளடக்கத்தையும் வழிகாட்டுதலையும் கவனத்தில் கொள்ளுமாறு கேட்டுக்கொள்கிறோம். உங்கள் புரிதலுக்கு நன்றி.";

    function showTamilWaitNotice() {
      if (document.getElementById("taWaitNotice")) return;
      var ov = document.createElement("div");
      ov.id = "taWaitNotice";
      ov.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55)";
      ov.innerHTML =
        "<div style='max-width:440px;margin:20px;background:#1a1f33;border:1px solid #c9a84c;border-radius:14px;padding:26px 24px;color:#f0e8d8;font-family:inherit;line-height:1.7;text-align:center'>" +
        "<div style='font-size:15px;margin-bottom:18px'>" + TA_WAIT_MSG + "</div>" +
        "<button id='taWaitOk' style='background:#c9a84c;color:#1a1f33;border:none;border-radius:8px;padding:10px 28px;font-size:15px;font-weight:600;cursor:pointer'>சரி (OK)</button>" +
        "</div>";
      document.body.appendChild(ov);
      var ok = document.getElementById("taWaitOk");
      if (ok) ok.addEventListener("click", function () { ov.remove(); });
    }

    document.querySelectorAll("[data-download]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.getAttribute("data-download");
        if (typeof window.generateReportPDF !== "function") return;
        if (btn.dataset.busy === "1") return;   // prevent double-clicks

        // Safety gate: never generate a paid report without a verified payment.
        // Accept either the in-session unlock flag OR a server-confirmed paid
        // record (a returning customer who paid earlier, even on another device).
        if (isUnlockedHere(item)) {
          proceed();
        } else {
          flashStatus("Checking your purchase…");
          srvStatus(item).then(function (r) {
            if (r && r.paid) {
              window.AI_unlocked = window.AI_unlocked || {};
              window.AI_unlocked[item] = chartId();   // tag to THIS chart
              proceed();
            } else {
              flashStatus(window.t ? window.t("pay_required") : "Please complete payment to download this report.");
            }
          }).catch(function () {
            flashStatus(window.t ? window.t("pay_required") : "Please complete payment to download this report.");
          });
        }

        function proceed() {
        const orig = btn.getAttribute("data-orig-label") || btn.textContent;
        btn.setAttribute("data-orig-label", orig);

        function resetBtn() { btn.disabled = false; btn.dataset.busy = "0"; btn.textContent = orig; }

        // Deliver a non-English report. Order of preference:
        //   1) server-stored report (returning paid customer — instant, no cost)
        //   2) in-session pre-gen cache (just paid this session)
        //   3) start a fresh translation and wait
        function deliverTranslated(item, lang, title) {
          var key = pregenKey(item, lang);
          // 1) Try the server first — a paid chart's report persists across sessions.
          srvFetch(item, lang).then(function (r) {
            if (r && r.paid && r.sections) {
              downloadWordReport(r.sections, title, userName());
              resetBtn();
              return;
            }
            // 2) + 3) fall back to local cache / fresh generation.
            deliverFromCacheOrGenerate(item, lang, title, key);
          }).catch(function () {
            deliverFromCacheOrGenerate(item, lang, title, key);
          });
        }

        function deliverFromCacheOrGenerate(item, lang, title, key) {
          // If a prior pre-gen attempt errored, discard it and start fresh.
          if (_pregenCache[key] && _pregenCache[key].error) { delete _pregenCache[key]; }
          if (!_pregenCache[key]) { try { startPregeneration(item); } catch (e) {} }
          var entry = _pregenCache[key];
          if (entry && entry.ready && entry.sections) {
            downloadWordReport(entry.sections, title, userName());
            resetBtn();
            return;
          }
          // Not ready yet — show the wait notice (Tamil) and wait on the promise.
          if (lang === "TA") showTamilWaitNotice();
          btn.textContent = "Preparing your " + REPORT_LANG_LABELS[lang] + " report…";
          var tick = setInterval(function () {
            if (entry && entry.progress && btn.dataset.busy === "1") btn.textContent = "Preparing… " + entry.progress;
          }, 1000);
          (entry ? entry.promise : Promise.reject("no translation")).then(function (translated) {
            clearInterval(tick);
            downloadWordReport(translated, title, userName());
            resetBtn();
          }).catch(function (e) {
            clearInterval(tick);
            flashStatus("Translation could not be completed. Please try again, or download in English.");
            resetBtn();
          });
        }

        if (item === "dasha") {
          if (typeof window.buildDasaReport !== "function") { flashStatus("Report builder not loaded — please refresh."); return; }
          const navBtn = document.querySelector('.nav-tab[data-tab="dashaTab"]');
          if (navBtn) navBtn.click();  // ensure timeline is rendered
          btn.disabled = true; btn.dataset.busy = "1";
          var dasaLang = currentLang();
          if (dasaLang === "EN") {
            btn.textContent = "Preparing your report… please wait";
            flashStatus(window.t ? window.t("report_preparing") : "Preparing your Dasa report… this can take a few seconds.");
            setTimeout(function () {
              window.buildDasaReport("full", function (done, total) {
                btn.textContent = "Preparing report… " + done + "/" + total;
              }).then(function (sections) {
                resetBtn();
                window.generateReportPDF({
                  userName: userName(),
                  reportTitle: "Dasa Bhukti Period Indications",
                  sections: addSeparatorsOnly(humanizeSections(sections)),
                  paymentId: (window.AI_lastPayment && window.AI_lastPayment.dasha) || null,
                });
              }).catch(function (e) {
                resetBtn();
                flashStatus(typeof e === "string" ? e : "Could not build the report. Please try again.");
              });
            }, 300);
          } else {
            deliverTranslated("dasha", dasaLang, "Dasa Bhukti Period Indications");
          }
        } else {
          // Life Domains
          btn.disabled = true; btn.dataset.busy = "1";
          var lang = currentLang();
          if (lang === "EN") {
            btn.textContent = "Preparing report…";
            setTimeout(function () {
              try {
                window.generateReportPDF({
                  userName: userName(),
                  reportTitle: "Life Domains Indications",
                  sections: addSeparatorsOnly(collectDomainSections()),
                  paymentId: (window.AI_lastPayment && window.AI_lastPayment.domains) || null,
                });
              } catch (e) {
                flashStatus("Could not build the report. Please try again.");
              }
              resetBtn();
            }, 200);
          } else {
            deliverTranslated("domains", lang, "Life Domains Indications");
          }
        }
        }   // end proceed()
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

    // NOTE: language limiting (English + Tamil only) is handled by the
    // INDEPENDENT block at the very end of this file (outside the closure), so it
    // runs reliably regardless of anything in this closure. See AI_pruneLanguages.

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
    // Remove the "standard Vimshottari period lengths" list the MD-overview AI
    // sometimes inserts (a lead line like "...period lengths:" followed by
    // "Planet: N years" lines). Requested removed from the report.
    function stripDurationList(text) {
      if (!text) return text;
      var planets = "Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu";
      // Drop a "period lengths" / "Vimshottari ... lengths" lead line.
      text = text.replace(/^.*\b(period lengths|Vimshottari[^\n]*lengths)\b.*$/gim, "");
      // Drop standalone "Planet: N years" list lines (the 9-planet block).
      text = text.replace(new RegExp("^\\s*[-•]?\\s*(" + planets + ")\\s*:\\s*\\d+\\s*(years?|yrs?)\\.?\\s*$", "gim"), "");
      // Collapse the blank lines left behind.
      return text.replace(/\n{3,}/g, "\n\n").trim();
    }

    function humanizeSections(sections) {
      if (!Array.isArray(sections)) return sections;
      return sections.map(function (sec) {
        if (!sec || typeof sec !== "object") return sec;
        var copy = {};
        for (var k in sec) if (Object.prototype.hasOwnProperty.call(sec, k)) copy[k] = sec[k];
        ["heading", "title", "body", "text"].forEach(function (f) {
          if (typeof copy[f] === "string") copy[f] = stripDurationList(softenText(copy[f]));
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

// ─────────────────────────────────────────────────────────────────────────────
//  INDEPENDENT LANGUAGE LIMITER (English + Tamil only).
//  Deliberately OUTSIDE the main closure so it runs no matter what happens above.
//  Hides the extra-language buttons in BOTH the top i18n toggle and the
//  references "Translate" menu. Self-contained: its own interval + DOM hooks.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  var KEEP = ["EN", "TA"];
  var DROP = /telugu|hindi|kannada|malayalam|తెలుగు|हिन्दी|हिंदी|ಕನ್ನಡ|മലയാളം/i;
  function prune() {
    try {
      var nodes = document.querySelectorAll("button, a, [role='option'], li");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.children && el.children.length > 2) continue;
        var dl = el.getAttribute && el.getAttribute("data-lang");
        if (dl && KEEP.indexOf(dl.toUpperCase()) === -1) { el.style.display = "none"; continue; }
        if (!dl) {
          var txt = (el.textContent || "").trim();
          if (txt.length < 40 && DROP.test(txt)) el.style.display = "none";
        }
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", prune);
  } else {
    prune();
  }
  setInterval(prune, 700);
  window.AI_pruneLanguages = prune;
})();
// ─────────────────────────────────────────────────────────────────────────────
//  Q&A OVERLAY (English + Tamil).  Independent block, outside the main closure.
//  Adds a button on the Birth Data (input) screen that opens a panel with EN/TA
//  tabs. Content is STATIC (pre-written + pre-translated) — no runtime AI.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  var QA_EN = [
    ["How do I use this site?",
     "A simple step-by-step flow:<br>• <b>Enter your birth details</b> — date, time, and place of birth.<br>• <b>Horoscope Chart</b> — generated instantly <i>(Free)</i>.<br>• <b>Dasha Bhukti Report</b> — your planetary period indications <i>(Paid)</i>.<br>• <b>Life Domains</b> — indications across the key areas of your life <i>(Paid)</i>.<br>• <b>Summary</b> — an overview of your chart <i>(Free)</i>.<br>• <b>References</b> — guides to houses, planets, and concepts <i>(Free)</i>.<br>• <b>Personal Consultation</b> — one-on-one guidance <i>(Paid)</i>.<br>• <b>Contact Us</b> — reach us with any questions or feedback."],
    ["What's free and what's paid?",
     "Free: entering your birth details, your Horoscope Chart, the Summary, the References guides, and previewing a sample report. Paid: the full Dasha Bhukti Report, the Life Domains report, and Personal Consultations. You can explore everything that's free before deciding to purchase."],
    ["How should I read this report?",
     "Treat everything in your report as an <i>indication</i>, not a fixed destiny. Vedic astrology points to tendencies and possibilities based on your chart — it does not dictate certainties. How any indication actually unfolds depends on many personal factors: your choices, environment, upbringing, effort, and circumstances. Two people with similar placements can experience them quite differently. Use the report as thoughtful guidance for reflection, not as a fixed prediction."],
    ["Are the indications specific to me, or generic?",
     "Every indication is drawn specifically from the birth details you provide — your date, time, and place of birth. Nothing in your report is generic filler. The calculations use the Swiss Ephemeris (the same precision standard used by professional astrologers), so your report reflects your unique chart."],
    ["Do I have to pay again to download my report later?",
     "No. Once you've paid for a report, it's yours. You can download it again anytime — in English or Tamil — without paying again, as long as you use the same birth details. A new set of birth details is treated as a new chart and requires a separate purchase."],
    ["Can I get a personal consultation?",
     "Yes. If you'd like personalized guidance beyond the automated reports, personal consultations are available — see the Personal Consultation tab to book one."],
    ["How do I share feedback or get help?",
     "We'd love to hear from you. Use the Contact Us tab to send any questions, suggestions, or feedback."],
    ["Which languages are available?",
     "Reports are currently available in English and Tamil. Choose your language using the toggle at the top of the page, and download your report in either language at no extra cost."]
  ];
  var QA_TA = [
    ["இந்த இணையதளத்தை எவ்வாறு பயன்படுத்துவது?",
     "எளிய படிநிலை:<br>• <b>உங்கள் பிறப்பு விவரங்களை உள்ளிடுங்கள்</b> — பிறந்த தேதி, நேரம், இடம்.<br>• <b>ஜாதகம்</b> — உடனடியாக உருவாக்கப்படும் <i>(இலவசம்)</i>.<br>• <b>தசா புக்தி அறிக்கை</b> — உங்கள் கிரக கால அறிகுறிகள் <i>(கட்டணம்)</i>.<br>• <b>வாழ்க்கைத் துறைகள்</b> — உங்கள் வாழ்வின் முக்கிய பகுதிகள் குறித்த அறிகுறிகள் <i>(கட்டணம்)</i>.<br>• <b>சுருக்கம்</b> — உங்கள் ஜாதகத்தின் ஒரு மேலோட்டப் பார்வை <i>(இலவசம்)</i>.<br>• <b>குறிப்புகள்</b> — வீடுகள், கிரகங்கள், கருத்துகள் பற்றிய வழிகாட்டிகள் <i>(இலவசம்)</i>.<br>• <b>தனிப்பட்ட ஆலோசனை</b> — நேரடி வழிகாட்டுதல் <i>(கட்டணம்)</i>.<br>• <b>தொடர்பு கொள்ளவும்</b> — கேள்விகள் அல்லது கருத்துகளுக்கு எங்களை அணுகவும்."],
    ["எது இலவசம், எது கட்டணம்?",
     "இலவசம்: பிறப்பு விவரங்களை உள்ளிடுவது, உங்கள் ஜாதகம், சுருக்கம், குறிப்பு வழிகாட்டிகள், மற்றும் மாதிரி அறிக்கையைப் பார்ப்பது. கட்டணம்: முழு தசா புக்தி அறிக்கை, வாழ்க்கைத் துறைகள் அறிக்கை, மற்றும் தனிப்பட்ட ஆலோசனைகள். வாங்குவதற்கு முன், இலவசமாக உள்ள அனைத்தையும் நீங்கள் பார்வையிடலாம்."],
    ["இந்த அறிக்கையை எவ்வாறு புரிந்துகொள்வது?",
     "உங்கள் அறிக்கையில் உள்ள அனைத்தையும் ஒரு <i>அறிகுறியாகக்</i> கருதுங்கள், மாறாத விதியாக அல்ல. வேத ஜோதிடம் உங்கள் ஜாதகத்தின் அடிப்படையில் சாத்தியங்களையும் போக்குகளையும் சுட்டிக்காட்டுகிறது — அது உறுதியான முடிவுகளைத் தீர்மானிப்பதில்லை. எந்த ஒரு அறிகுறியும் எவ்வாறு வெளிப்படுகிறது என்பது பல தனிப்பட்ட காரணிகளைச் சார்ந்தது: உங்கள் தேர்வுகள், சூழல், வளர்ப்பு, முயற்சி, மற்றும் சூழ்நிலைகள். ஒரே மாதிரியான கிரக நிலைகளைக் கொண்ட இருவர் அவற்றை வெவ்வேறு விதமாக அனுபவிக்கலாம். இந்த அறிக்கையை ஒரு உறுதியான கணிப்பாக அல்லாமல், சிந்தனைக்கான வழிகாட்டுதலாகப் பயன்படுத்துங்கள்."],
    ["அறிகுறிகள் எனக்கு மட்டும் உரியதா, அல்லது பொதுவானதா?",
     "ஒவ்வொரு அறிகுறியும் நீங்கள் வழங்கிய பிறப்பு விவரங்களிலிருந்து — உங்கள் பிறந்த தேதி, நேரம், இடம் — குறிப்பாக எடுக்கப்பட்டது. உங்கள் அறிக்கையில் பொதுவான, அர்த்தமற்ற உள்ளடக்கம் எதுவும் இல்லை. கணக்கீடுகள் Swiss Ephemeris (ஸ்விஸ் எபிமெரிஸ் — தொழில்முறை ஜோதிடர்கள் பயன்படுத்தும் அதே துல்லிய தரநிலை) மூலம் செய்யப்படுகின்றன, எனவே உங்கள் அறிக்கை உங்கள் தனிப்பட்ட ஜாதகத்தைப் பிரதிபலிக்கிறது."],
    ["அறிக்கையை மீண்டும் பதிவிறக்கம் செய்ய மீண்டும் கட்டணம் செலுத்த வேண்டுமா?",
     "வேண்டாம். ஒரு அறிக்கைக்கு நீங்கள் ஒருமுறை கட்டணம் செலுத்திவிட்டால், அது உங்களுடையது. அதே பிறப்பு விவரங்களைப் பயன்படுத்தும் வரை, அதை எப்போது வேண்டுமானாலும் — ஆங்கிலத்திலோ தமிழிலோ — மீண்டும் கட்டணம் இல்லாமல் பதிவிறக்கம் செய்யலாம். புதிய பிறப்பு விவரங்கள் ஒரு புதிய ஜாதகமாகக் கருதப்பட்டு, தனியாகக் கட்டணம் தேவைப்படும்."],
    ["தனிப்பட்ட ஆலோசனை பெற முடியுமா?",
     "ஆம். தானியங்கி அறிக்கைகளுக்கு அப்பால் தனிப்பட்ட வழிகாட்டுதல் தேவைப்பட்டால், தனிப்பட்ட ஆலோசனைகள் கிடைக்கின்றன — பதிவு செய்ய 'தனிப்பட்ட ஆலோசனை' தாவலைப் பார்க்கவும்."],
    ["கருத்து தெரிவிக்க அல்லது உதவி பெற எப்படி?",
     "உங்கள் கருத்தை அறிய நாங்கள் விரும்புகிறோம். ஏதேனும் கேள்விகள், ஆலோசனைகள் அல்லது கருத்துகளை அனுப்ப 'தொடர்பு கொள்ளவும்' தாவலைப் பயன்படுத்தவும்."],
    ["எந்தெந்த மொழிகள் கிடைக்கின்றன?",
     "அறிக்கைகள் தற்போது ஆங்கிலம் மற்றும் தமிழில் கிடைக்கின்றன. பக்கத்தின் மேற்பகுதியில் உள்ள மொழிபெயர்ப்பு பட்டன் மூலம் உங்கள் மொழியைத் தேர்வுசெய்து, கூடுதல் கட்டணம் இல்லாமல் இரு மொழிகளிலும் உங்கள் அறிக்கையைப் பதிவிறக்கம் செய்யலாம்."]
  ];

  function buildList(pairs) {
    return pairs.map(function (qa, i) {
      return "<div style='margin-bottom:18px'>" +
        "<div style='font-weight:700;color:#c9a84c;font-size:15px;margin-bottom:5px'>" + (i + 1) + ". " + qa[0] + "</div>" +
        "<div style='color:#e8e2d4;font-size:14px;line-height:1.7'>" + qa[1] + "</div></div>";
    }).join("");
  }

  function openQA() {
    if (document.getElementById("qaOverlay")) return;
    var ov = document.createElement("div");
    ov.id = "qaOverlay";
    ov.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML =
      "<div style='background:#1a1f33;border:1px solid #c9a84c;border-radius:14px;max-width:620px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;font-family:inherit'>" +
        "<div style='display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(201,168,76,.3)'>" +
          "<div style='display:flex;gap:8px'>" +
            "<button id='qaTabEN' class='qa-tab' style='background:#c9a84c;color:#1a1f33;border:none;border-radius:7px;padding:7px 16px;font-weight:700;cursor:pointer'>English</button>" +
            "<button id='qaTabTA' class='qa-tab' style='background:transparent;color:#c9a84c;border:1px solid #c9a84c;border-radius:7px;padding:7px 16px;font-weight:700;cursor:pointer'>தமிழ்</button>" +
          "</div>" +
          "<button id='qaClose' style='background:transparent;color:#c9a84c;border:none;font-size:24px;cursor:pointer;line-height:1'>&times;</button>" +
        "</div>" +
        "<div id='qaBody' style='padding:20px;overflow-y:auto'></div>" +
      "</div>";
    document.body.appendChild(ov);
    var body = ov.querySelector("#qaBody");
    var tEN = ov.querySelector("#qaTabEN"), tTA = ov.querySelector("#qaTabTA");
    function show(lang) {
      body.innerHTML = buildList(lang === "TA" ? QA_TA : QA_EN);
      var onEN = lang !== "TA";
      tEN.style.background = onEN ? "#c9a84c" : "transparent"; tEN.style.color = onEN ? "#1a1f33" : "#c9a84c";
      tTA.style.background = onEN ? "transparent" : "#c9a84c"; tTA.style.color = onEN ? "#c9a84c" : "#1a1f33";
    }
    tEN.addEventListener("click", function () { show("EN"); });
    tTA.addEventListener("click", function () { show("TA"); });
    ov.querySelector("#qaClose").addEventListener("click", function () { ov.remove(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    // Default to the currently selected app language.
    var cur = "EN";
    try { cur = localStorage.getItem("jyotish-lang") === "TA" ? "TA" : "EN"; } catch (e) {}
    show(cur);
  }
  window.AI_openQA = openQA;

  // Inject a Q&A button onto the input (Birth Data) screen.
  function ensureButton() {
    try {
      var input = document.getElementById("inputTab");
      if (!input || input.querySelector("#qaOpenBtn")) return;
      var btn = document.createElement("button");
      btn.id = "qaOpenBtn";
      btn.textContent = "❓ Q&A · கேள்வி-பதில்கள்";
      btn.style.cssText = "display:block;margin:14px auto 0;background:transparent;color:#c9a84c;border:1px solid #c9a84c;border-radius:8px;padding:9px 20px;font-size:14px;font-weight:600;cursor:pointer";
      btn.addEventListener("click", openQA);
      var card = input.querySelector("[class*='card'], .input-card") || input.firstElementChild || input;
      card.appendChild(btn);
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureButton);
  } else { ensureButton(); }
  setInterval(ensureButton, 1000);
})();

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMER REVIEWS (testimonials).  Independent block, outside the main closure.
//  • Approved reviews shown as static cards on the input (first) screen.
//  • A "Leave a Review" form near the Contact tab, with a privacy popup that
//    tells users they may use a changed name. Submissions are PENDING until the
//    owner approves them in the D1 console. EN + TA aware (reads jyotish-lang).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  function lang() { try { return localStorage.getItem("jyotish-lang") === "TA" ? "TA" : "EN"; } catch (e) { return "EN"; } }
  var T = {
    heading:   { EN: "What our users say", TA: "எங்கள் பயனாளர்கள் கூறுவது" },
    leaveBtn:  { EN: "✍ Leave a Review", TA: "✍ உங்கள் கருத்தை பகிரவும்" },
    privacy:   { EN: "Your privacy matters. You may use a different name or initials instead of your real name — your review will display exactly as you enter it.",
                 TA: "உங்கள் தனியுரிமை முக்கியம். உங்கள் உண்மையான பெயருக்குப் பதிலாக வேறு பெயரையோ அல்லது முதலெழுத்துக்களையோ பயன்படுத்தலாம் — நீங்கள் உள்ளிடும் விதத்திலேயே உங்கள் கருத்து காண்பிக்கப்படும்." },
    gotit:     { EN: "Got it", TA: "சரி" },
    formTitle: { EN: "Share your experience", TA: "உங்கள் அனுபவத்தைப் பகிரவும்" },
    namePh:    { EN: "Name to display (or leave blank)", TA: "காண்பிக்க பெயர் (அல்லது காலியாக விடவும்)" },
    placePh:   { EN: "Place (optional)", TA: "இடம் (விருப்பத்திற்கு)" },
    anon:      { EN: "Post anonymously", TA: "அடையாளமின்றி பதிவிடுங்கள்" },
    reviewPh:  { EN: "Write your review…", TA: "உங்கள் கருத்தை எழுதுங்கள்…" },
    submit:    { EN: "Submit", TA: "சமர்ப்பிக்கவும்" },
    thanks:    { EN: "Thank you! Your review has been submitted and will appear after approval.", TA: "நன்றி! உங்கள் கருத்து சமர்ப்பிக்கப்பட்டது, ஒப்புதலுக்குப் பிறகு காண்பிக்கப்படும்." },
    empty:     { EN: "", TA: "" },
  };
  function t(k) { return (T[k] && T[k][lang()]) || (T[k] && T[k].EN) || ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // ── Load + render approved reviews as static cards on the input screen ──
  function renderCards() {
    var host = document.getElementById("reviewCards");
    if (!host) return;
    fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var list = (d && d.reviews) || [];
        // Heading + "Leave a Review" button (always shown, even with no reviews yet).
        var html =
          "<div style='display:flex;flex-direction:column;align-items:center;gap:10px;margin:6px 0 14px'>" +
            "<div style='font-weight:700;color:#c9a84c;font-size:16px;text-align:center'>" + esc(t("heading")) + "</div>" +
            "<button id='revOpenBtnTop' style='background:#c9a84c;color:#1a1f33;border:none;border-radius:8px;padding:9px 22px;font-size:14px;font-weight:700;cursor:pointer'>" + esc(t("leaveBtn")) + "</button>" +
          "</div>";
        // Review cards below, if any are approved.
        if (list.length) {
          html += "<div style='display:flex;flex-wrap:wrap;gap:12px;justify-content:center'>" +
            list.map(function (rv) {
              var who = esc(rv.name || "Anonymous") + (rv.place ? ", " + esc(rv.place) : "");
              return "<div style='background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:14px 16px;max-width:280px;flex:1 1 240px'>" +
                "<div style='color:#e8e2d4;font-size:13.5px;line-height:1.6;font-style:italic'>“" + esc(rv.body) + "”</div>" +
                "<div style='color:#c9a84c;font-size:12px;margin-top:8px;font-weight:600'>— " + who + "</div></div>";
            }).join("") + "</div>";
        }
        host.innerHTML = html;
        var topBtn = document.getElementById("revOpenBtnTop");
        if (topBtn) topBtn.addEventListener("click", startReview);
      })
      .catch(function () {});
  }

  // ── Privacy popup, shown before the form ──
  function showPrivacyThen(cb) {
    if (document.getElementById("revPrivacy")) return;
    var ov = document.createElement("div");
    ov.id = "revPrivacy";
    ov.style.cssText = "position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML =
      "<div style='background:#1a1f33;border:1px solid #c9a84c;border-radius:14px;max-width:440px;padding:24px;text-align:center;color:#e8e2d4;font-family:inherit;line-height:1.7'>" +
      "<div style='font-size:14.5px;margin-bottom:18px'>" + esc(t("privacy")) + "</div>" +
      "<button id='revPrivacyOk' style='background:#c9a84c;color:#1a1f33;border:none;border-radius:8px;padding:9px 26px;font-weight:700;cursor:pointer'>" + esc(t("gotit")) + "</button>" +
      "</div>";
    document.body.appendChild(ov);
    ov.querySelector("#revPrivacyOk").addEventListener("click", function () { ov.remove(); cb && cb(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
  }

  // ── Review submission form (modal) ──
  function openForm() {
    if (document.getElementById("revForm")) return;
    var ov = document.createElement("div");
    ov.id = "revForm";
    ov.style.cssText = "position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML =
      "<div style='background:#1a1f33;border:1px solid #c9a84c;border-radius:14px;max-width:460px;width:100%;padding:22px;color:#e8e2d4;font-family:inherit'>" +
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px'>" +
        "<div style='font-weight:700;color:#c9a84c;font-size:16px'>" + esc(t("formTitle")) + "</div>" +
        "<button id='revClose' style='background:transparent;color:#c9a84c;border:none;font-size:24px;cursor:pointer;line-height:1'>&times;</button>" +
      "</div>" +
      "<input id='revName' placeholder='" + esc(t("namePh")) + "' style='width:100%;box-sizing:border-box;margin-bottom:10px;padding:9px 11px;border-radius:8px;border:1px solid rgba(201,168,76,.4);background:#12162a;color:#e8e2d4;font-size:14px'>" +
      "<input id='revPlace' placeholder='" + esc(t("placePh")) + "' style='width:100%;box-sizing:border-box;margin-bottom:10px;padding:9px 11px;border-radius:8px;border:1px solid rgba(201,168,76,.4);background:#12162a;color:#e8e2d4;font-size:14px'>" +
      "<label style='display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px;cursor:pointer'><input type='checkbox' id='revAnon'> " + esc(t("anon")) + "</label>" +
      "<textarea id='revBody' placeholder='" + esc(t("reviewPh")) + "' rows='4' style='width:100%;box-sizing:border-box;margin-bottom:12px;padding:9px 11px;border-radius:8px;border:1px solid rgba(201,168,76,.4);background:#12162a;color:#e8e2d4;font-size:14px;resize:vertical'></textarea>" +
      "<button id='revSubmit' style='width:100%;background:#c9a84c;color:#1a1f33;border:none;border-radius:8px;padding:11px;font-weight:700;font-size:15px;cursor:pointer'>" + esc(t("submit")) + "</button>" +
      "<div id='revMsg' style='margin-top:10px;font-size:13px;color:#c9a84c;text-align:center'></div>" +
      "</div>";
    document.body.appendChild(ov);
    ov.querySelector("#revClose").addEventListener("click", function () { ov.remove(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector("#revSubmit").addEventListener("click", function () {
      var body = ov.querySelector("#revBody").value.trim();
      var msg = ov.querySelector("#revMsg");
      if (!body) { msg.textContent = "Please write your review."; return; }
      var payload = {
        action: "submit",
        body: body,
        displayName: ov.querySelector("#revName").value,
        place: ov.querySelector("#revPlace").value,
        anonymous: ov.querySelector("#revAnon").checked,
      };
      ov.querySelector("#revSubmit").disabled = true;
      fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) { msg.style.color = "#7ec77e"; msg.textContent = t("thanks"); setTimeout(function () { ov.remove(); }, 2600); }
          else { msg.textContent = (d && d.error) || "Could not submit."; ov.querySelector("#revSubmit").disabled = false; }
        })
        .catch(function () { msg.textContent = "Could not submit. Please try again."; ov.querySelector("#revSubmit").disabled = false; });
    });
  }
  function startReview() { showPrivacyThen(openForm); }
  window.AI_openReviewForm = startReview;

  // ── Inject the cards host (first screen) + the Leave-a-Review button (Contact) ──
  function ensureUI() {
    try {
      // Cards on the input (first) screen.
      var input = document.getElementById("inputTab");
      if (input && !document.getElementById("reviewCards")) {
        var cards = document.createElement("div");
        cards.id = "reviewCards";
        cards.style.cssText = "margin:22px auto 0;max-width:900px";
        var card = input.querySelector("[class*='card'], .input-card") || input;
        card.appendChild(cards);
        renderCards();
      }
      // "Leave a Review" button near the Contact tab.
      var contact = document.getElementById("contactTab");
      if (contact && !document.getElementById("revOpenBtn")) {
        var btn = document.createElement("button");
        btn.id = "revOpenBtn";
        btn.textContent = t("leaveBtn");
        btn.style.cssText = "display:block;margin:16px auto;background:#c9a84c;color:#1a1f33;border:none;border-radius:8px;padding:11px 24px;font-size:15px;font-weight:700;cursor:pointer";
        btn.addEventListener("click", startReview);
        contact.appendChild(btn);
      } else if (contact) {
        // Keep the Contact button's label in sync with the current language.
        var existing = document.getElementById("revOpenBtn");
        if (existing) existing.textContent = t("leaveBtn");
      }
    } catch (e) {}
  }
  // Re-render the first-page reviews (heading + button + cards) on language switch,
  // so the Tamil/English labels update live.
  document.addEventListener("click", function (e) {
    var tgt = e.target;
    if (tgt && tgt.closest && tgt.closest("[data-setlang],[data-lang]")) {
      setTimeout(function () { renderCards(); ensureUI(); }, 140);
    }
  }, true);
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", ensureUI); }
  else { ensureUI(); }
  setInterval(ensureUI, 1200);
})();

// ─────────────────────────────────────────────────────────────────────────────
//  SAMPLE REPORT OVERLAY (English + Tamil).  Independent block.
//  Repoints the existing "மாதிரி அறிக்கை" (Sample Report) button to show a
//  representative EXCERPT of both reports, with EN | TA tabs (like the Q&A).
//  Content is STATIC (pre-written + pre-translated) — no runtime AI.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  var SAMPLE_EN =
    "<div style='text-align:center;color:#c9a84c;font-weight:700;font-size:13px;letter-spacing:.08em;margin-bottom:14px'>SAMPLE — for preview only</div>" +
    "<h3 style='color:#c9a84c;font-size:16px;margin:0 0 4px'>Dasha Bhukti Period Indications</h3>" +
    "<div style='color:#9aa0b5;font-size:12px;margin-bottom:14px'>A sample showing the depth and style of the full report.</div>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>Understanding Your Dasha Periods</div>" +
    "<p>Your life unfolds through a sequence of planetary periods. A <b>Mahadasha (MD)</b> is a major life chapter — a long season running for several years, during which one planet sets the overall theme of your life. Within each season are shorter <b>Antardasha (AD)</b> sub-periods, where a second planet colours that main theme, shifting the tone from one stretch of time to the next. Your full report covers your previous, current, and next chapters — the current one in complete detail.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>Your Complete 120-Year Dasha Timeline</div>" +
    "<p>1. Saturn Mahadasha — 1980 to 1994 (14.8 years)<br>2. Mercury Mahadasha — 1994 to 2011 (17 years)<br>3. Ketu Mahadasha — 2011 to 2018 (7 years)<br>4. Venus Mahadasha — 2018 to 2038 (20 years) — <b>CURRENT</b><br>5. Sun Mahadasha — 2038 to 2044 (6 years)<br>…continuing through all nine Mahadashas across 120 years.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>Current Period Overview: Venus Mahadasha (2018–2038, 20 years)</div>" +
    "<p>Your Venus Mahadasha unfolds as a mixed season. As your ascendant lord placed in the 7th house of partnerships, Venus brings relationship and collaboration themes strongly to the forefront — significant partnerships that test your independence and reshape how you see yourself and how the world perceives you. Saturn's aspect onto the 7th provides both protection and delay, stabilizing commitments through patience while bringing karmic weight to relationships.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>Sample Sub-Period: Venus — Sun Antardasha (2022–2023)</div>" +
    "<p><i>Career & Profession:</i> The Sun in the 6th house creates a competitive work environment — increased competition, disputes with colleagues, or office politics, requiring you to prove your competence rather than enjoy smooth advancement.<br><i>Relationships & Marriage:</i> Your spouse or partner may become more demanding or distant, with ego clashes or differing goals creating friction around finances and life direction.<br><i>Finances & Wealth:</i> Income may come through effort and competitive work — but expenses around obligations or disputes can drain it as quickly as it arrives.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>Sample Sub-Period: Venus — Moon Antardasha (2023–2024)</div>" +
    "<p><i>Career & Profession:</i> With the Moon ruling and placed in your 10th house of profession, your career comes sharply into focus — visibility and recognition opportunities arise, though they bring workplace pressure and possible repositioning driven by inner restlessness.<br><i>Relationships & Marriage:</i> Emotional sensitivity heightens; the need for stability in close relationships grows, and professional demands may compete with personal time.</p>" +

    "<p style='color:#9aa0b5;font-style:italic;margin-top:10px'>…your full report details every Antardasha sub-period of your current Mahadasha at this depth, plus overviews of your previous and next chapters, and the option to request any other Mahadasha in full.</p>" +

"@@SPLIT@@" +

    "<h3 style='color:#c9a84c;font-size:16px;margin:0 0 4px'>Life Domains Indications</h3>" +
    "<div style='color:#9aa0b5;font-size:12px;margin-bottom:14px'>A sample showing the depth and style of the full report.</div>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>How to Read This Report</div>" +
    "<p>Every indication here is drawn specifically from your own D1 (Birth chart) and D9 (Navamsha chart) placements — not from anything generic. D1 describes outer life as it plays out day to day; D9 describes the inner, soul-level foundation — durability and depth.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>The Dominant Planetary Axis</div>" +
    "<p>This chart carries a Raja signature, with an inherent capacity for visible achievement, social standing, and recognition. The dominant axis is 5–11: creativity and community — individual expression and collective belonging are the central motifs the whole life revolves around.</p>" +

    "<p><b>Identity & Personality</b> — <i>Peak Comes Early:</i> your strongest, clearest sense of self lands earlier in life — lean into it then, as the qualities you build early become your lasting signature.</p>" +
    "<p><b>Wealth & Family</b> — <i>Foundation Holds:</i> the practical side of money and family is solid and reliable; the deeper sense of 'enough' may still be settling, so security can feel less certain than it actually is.</p>" +
    "<p><b>Marriage & Relationship</b> — <i>Foundation Holds:</i> your relationships are practically stable and committed; the emotional depth may still be maturing, so they can feel less settled inside than they look.</p>" +
    "<p><b>Career & Ambition</b> — <i>Peak Comes Early:</i> your strongest career-building window lands earlier — push for position and skill then, as that groundwork carries the rest of your working life.</p>" +
    "<p><b>Health & Vitality</b> — <i>Peak Comes Early:</i> your most robust health window is earlier in life — the habits you set then largely determine how well vitality holds later.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>Specific Indications From Your Chart (a glimpse)</div>" +
    "<p><i>Venus in 7th — natural partner magnetism:</i> a favourable placement for partnership, with a natural capacity for harmony and a refined, socially skilled partner.</p>" +

    "<p style='color:#9aa0b5;font-style:italic;margin-top:10px'>…your full report also includes multi-factor life-pattern indications — compound probability signals drawn from several placements at once.</p>";

  var SAMPLE_TA =
    "<div style='text-align:center;color:#c9a84c;font-weight:700;font-size:13px;letter-spacing:.08em;margin-bottom:14px'>மாதிரி — முன்னோட்டத்திற்கு மட்டும்</div>" +
    "<h3 style='color:#c9a84c;font-size:16px;margin:0 0 4px'>தசா புக்தி கால அறிகுறிகள்</h3>" +
    "<div style='color:#9aa0b5;font-size:12px;margin-bottom:14px'>முழு அறிக்கையின் ஆழத்தையும் பாணியையும் காட்டும் ஒரு மாதிரி.</div>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>உங்கள் தசா காலங்களைப் புரிந்துகொள்ளுதல்</div>" +
    "<p>உங்கள் வாழ்க்கை கிரக காலங்களின் வரிசையாக விரிகிறது. ஒரு <b>மகா தசை (MD)</b> என்பது ஒரு முக்கிய வாழ்க்கை அத்தியாயம் — பல வருடங்கள் நீளும் ஒரு நீண்ட பருவம், அதில் ஒரு கிரகம் உங்கள் வாழ்வின் ஒட்டுமொத்த மையக் கருத்தை அமைக்கிறது. ஒவ்வொரு பருவத்திற்குள்ளும் குறுகிய <b>புக்தி (AD)</b> துணைக்காலங்கள் உள்ளன, அதில் இரண்டாவது கிரகம் அந்த மையக் கருத்துக்கு வண்ணம் சேர்த்து, ஒரு கால கட்டத்திலிருந்து அடுத்ததற்கு தொனியை மாற்றுகிறது. உங்கள் முழு அறிக்கை உங்கள் முந்தைய, தற்போதைய மற்றும் அடுத்த அத்தியாயங்களை உள்ளடக்கியது — தற்போதையது முழுமையான விவரத்துடன்.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>உங்கள் முழுமையான 120-வருட தசா காலவரிசை</div>" +
    "<p>1. சனி மகா தசை — 1980 முதல் 1994 வரை (14.8 வருடங்கள்)<br>2. புதன் மகா தசை — 1994 முதல் 2011 வரை (17 வருடங்கள்)<br>3. கேது மகா தசை — 2011 முதல் 2018 வரை (7 வருடங்கள்)<br>4. சுக்கிர மகா தசை — 2018 முதல் 2038 வரை (20 வருடங்கள்) — <b>தற்போதையது</b><br>5. சூரிய மகா தசை — 2038 முதல் 2044 வரை (6 வருடங்கள்)<br>…மொத்தம் ஒன்பது மகா தசைகளாக 120 வருடங்கள் வரை தொடர்கிறது.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>தற்போதைய கால மேலோட்டம்: சுக்கிர மகா தசை (2018–2038, 20 வருடங்கள்)</div>" +
    "<p>உங்கள் சுக்கிர மகா தசை ஒரு கலப்புப் பருவமாக விரிகிறது. உங்கள் லக்னாதிபதியாக 7வது வீட்டில் (கூட்டாண்மை) அமைந்திருப்பதால், சுக்கிரன் உறவு மற்றும் கூட்டுறவுக் கருத்துகளை முன்னணிக்குக் கொண்டுவருகிறது — உங்கள் சுதந்திரத்தைச் சோதிக்கும், நீங்கள் உங்களை எவ்வாறு பார்க்கிறீர்கள் என்பதையும் உலகம் உங்களை எவ்வாறு உணர்கிறது என்பதையும் மறுவடிவமைக்கும் முக்கியமான கூட்டாண்மைகள். 7வது வீட்டின் மீதான சனியின் பார்வை பாதுகாப்பையும் தாமதத்தையும் தருகிறது — பொறுமையின் மூலம் உறுதிப்பாடுகளை நிலைப்படுத்துகிறது.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>மாதிரி துணைக்காலம்: சுக்கிரன் — சூரிய புக்தி (2022–2023)</div>" +
    "<p><i>தொழில் & வாழ்க்கைத் தொழில்:</i> 6வது வீட்டில் சூரியன் அமைவது போட்டி நிறைந்த பணிச்சூழலை உருவாக்குகிறது — அதிகரித்த போட்டி, சக ஊழியர்களுடன் கருத்து வேறுபாடுகள் அல்லது அலுவலக அரசியல், சுமூகமான முன்னேற்றத்தைவிட உங்கள் திறமையை நிரூபிக்க வேண்டிய நிலை.<br><i>உறவு & திருமணம்:</i> உங்கள் துணை அல்லது கூட்டாளி அதிக கோரிக்கை வைப்பவராகவோ அல்லது விலகியவராகவோ மாறலாம்; சுய மரியாதை மோதல்கள் அல்லது வேறுபட்ட இலக்குகள் நிதி மற்றும் வாழ்க்கைப் பாதையில் உராய்வை உருவாக்கலாம்.<br><i>நிதி & செல்வம்:</i> வருமானம் முயற்சி மற்றும் போட்டிப் பணியின் மூலம் வரலாம் — ஆனால் கடமைகள் அல்லது சர்ச்சைகள் தொடர்பான செலவுகள் அதை விரைவாகவே வடிகட்டிவிடலாம்.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>மாதிரி துணைக்காலம்: சுக்கிரன் — சந்திர புக்தி (2023–2024)</div>" +
    "<p><i>தொழில் & வாழ்க்கைத் தொழில்:</i> சந்திரன் உங்கள் 10வது வீட்டை (தொழில்) ஆண்டு அங்கேயே அமைந்திருப்பதால், உங்கள் தொழில் கூர்மையான கவனத்திற்கு வருகிறது — தெரிவுநிலை மற்றும் அங்கீகார வாய்ப்புகள் எழுகின்றன, இருப்பினும் அவை பணியிட அழுத்தத்தையும், உள் அமைதியின்மையால் இடமாற்றத்தையும் கொண்டுவரலாம்.<br><i>உறவு & திருமணம்:</i> உணர்வுபூர்வ உணர்திறன் அதிகரிக்கிறது; நெருங்கிய உறவுகளில் நிலைத்தன்மைக்கான தேவை வளர்கிறது, மேலும் தொழில் கோரிக்கைகள் தனிப்பட்ட நேரத்துடன் போட்டியிடலாம்.</p>" +

    "<p style='color:#9aa0b5;font-style:italic;margin-top:10px'>…உங்கள் முழு அறிக்கை உங்கள் தற்போதைய மகா தசையின் ஒவ்வொரு புக்தி துணைக்காலத்தையும் இந்த ஆழத்தில் விவரிக்கிறது, மேலும் உங்கள் முந்தைய மற்றும் அடுத்த அத்தியாயங்களின் மேலோட்டங்கள், மற்றும் வேறு எந்த மகா தசையையும் முழுமையாகக் கோரும் வாய்ப்பு.</p>" +

"@@SPLIT@@" +

    "<h3 style='color:#c9a84c;font-size:16px;margin:0 0 4px'>வாழ்க்கைத் துறை அறிகுறிகள்</h3>" +
    "<div style='color:#9aa0b5;font-size:12px;margin-bottom:14px'>முழு அறிக்கையின் ஆழத்தையும் பாணியையும் காட்டும் ஒரு மாதிரி.</div>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>இந்த அறிக்கையை எவ்வாறு படிப்பது</div>" +
    "<p>இங்குள்ள ஒவ்வொரு அறிகுறியும் உங்கள் சொந்த D1 (ஜாதகம்) மற்றும் D9 (நவாம்சம்) கிரக அமைவுகளிலிருந்து குறிப்பாக எடுக்கப்பட்டது — பொதுவான எதிலிருந்தும் அல்ல. D1 அன்றாட வெளி வாழ்க்கையை விவரிக்கிறது; D9 உள், ஆன்மீக அளவிலான அடித்தளத்தை — நிலைத்தன்மையையும் ஆழத்தையும் — விவரிக்கிறது.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>முதன்மை கிரக அச்சு</div>" +
    "<p>இந்த ஜாதகம் ஒரு ராஜ அடையாளத்தைக் கொண்டுள்ளது — புலப்படும் சாதனை, சமூக அந்தஸ்து மற்றும் அங்கீகாரத்திற்கான இயல்பான திறன். முதன்மை அச்சு 5–11: படைப்பாற்றல் மற்றும் சமூகம் — தனிப்பட்ட வெளிப்பாடும் கூட்டு உறுப்புணர்வும் வாழ்க்கை சுற்றிவரும் மையக் கருத்துகள்.</p>" +

    "<p><b>அடையாளம் & ஆளுமை</b> — <i>உச்சம் முன்கூட்டியே வருகிறது:</i> உங்கள் வலுவான, தெளிவான சுய உணர்வு வாழ்க்கையில் முன்னதாகவே வருகிறது — அப்போது அதை நம்பி முன்னேறுங்கள், ஏனெனில் நீங்கள் முன்கூட்டியே உருவாக்கும் பண்புகள் உங்கள் நிரந்தர அடையாளமாகின்றன.</p>" +
    "<p><b>செல்வம் & குடும்பம்</b> — <i>அடித்தளம் உறுதியாக உள்ளது:</i> பணம் மற்றும் குடும்பத்தின் நடைமுறைப் பக்கம் உறுதியானது; 'போதும்' என்ற ஆழமான உணர்வு இன்னும் நிலைபெறலாம், எனவே பாதுகாப்பு உண்மையில் இருப்பதைவிடக் குறைவாகத் தோன்றலாம்.</p>" +
    "<p><b>திருமணம் & உறவு</b> — <i>அடித்தளம் உறுதியாக உள்ளது:</i> உங்கள் உறவுகள் நடைமுறையில் நிலையானவை, அர்ப்பணிப்புள்ளவை; உணர்வு ஆழம் இன்னும் முதிர்ச்சியடையலாம், எனவே அவை வெளியில் தோன்றுவதைவிட உள்ளே குறைவாக நிலைபெற்றதாக உணரலாம்.</p>" +
    "<p><b>தொழில் & லட்சியம்</b> — <i>உச்சம் முன்கூட்டியே வருகிறது:</i> உங்கள் வலுவான தொழில் கட்டமைப்பு காலம் முன்னதாகவே வருகிறது — அப்போது பதவி மற்றும் திறனுக்காக முயலுங்கள், ஏனெனில் அந்த அடித்தளம் உங்கள் வேலை வாழ்க்கையின் மற்ற பகுதிகளைச் சுமக்கிறது.</p>" +
    "<p><b>ஆரோக்கியம் & வீரியம்</b> — <i>உச்சம் முன்கூட்டியே வருகிறது:</i> உங்கள் வலுவான ஆரோக்கிய காலம் வாழ்க்கையில் முன்னதாகவே — அப்போது நீங்கள் அமைக்கும் பழக்கங்கள் பின்னர் வீரியம் எவ்வளவு நன்றாக நிலைக்கும் என்பதைப் பெரிதும் தீர்மானிக்கின்றன.</p>" +

    "<div style='font-weight:700;color:#e8e2d4;margin:14px 0 4px'>உங்கள் ஜாதகத்திலிருந்து குறிப்பிட்ட அறிகுறிகள் (ஒரு பார்வை)</div>" +
    "<p><i>7வது வீட்டில் சுக்கிரன் — இயல்பான கூட்டாளி ஈர்ப்பு:</i> கூட்டாண்மைக்கு ஒரு சாதகமான அமைவு, இணக்கத்திற்கான இயல்பான திறனுடன், ஒரு நேர்த்தியான, சமூகத் திறன் கொண்ட துணை.</p>" +

    "<p style='color:#9aa0b5;font-style:italic;margin-top:10px'>…உங்கள் முழு அறிக்கையில் பல-காரணி வாழ்க்கை-முறை அறிகுறிகளும் அடங்கும் — பல அமைவுகளிலிருந்து ஒரே நேரத்தில் எடுக்கப்படும் கூட்டு நிகழ்தகவு சமிக்ஞைகள்.</p>";

  function openSample(which) {
    if (document.getElementById("sampleOverlay")) return;
    // which: "dasha" → first half, "domains" → second half. Split on the marker.
    function half(full) {
      var parts = full.split("@@SPLIT@@");
      if (which === "domains") return parts[1] || parts[0];
      return parts[0];
    }
    var isTA = false;
    try { isTA = localStorage.getItem("jyotish-lang") === "TA"; } catch (e) {}
    var ov = document.createElement("div");
    ov.id = "sampleOverlay";
    ov.style.cssText = "position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML =
      "<div style='background:#1a1f33;border:1px solid #c9a84c;border-radius:14px;max-width:640px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;font-family:inherit'>" +
        "<div style='display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(201,168,76,.3)'>" +
          "<div style='display:flex;gap:8px'>" +
            "<button id='smpEN' style='border-radius:7px;padding:7px 16px;font-weight:700;cursor:pointer;border:1px solid #c9a84c'>English</button>" +
            "<button id='smpTA' style='border-radius:7px;padding:7px 16px;font-weight:700;cursor:pointer;border:1px solid #c9a84c'>தமிழ்</button>" +
          "</div>" +
          "<button id='smpClose' style='background:transparent;color:#c9a84c;border:none;font-size:24px;cursor:pointer;line-height:1'>&times;</button>" +
        "</div>" +
        "<div id='smpBody' style='padding:20px;overflow-y:auto;color:#d8d2c4;font-size:14px;line-height:1.7'></div>" +
      "</div>";
    document.body.appendChild(ov);
    var body = ov.querySelector("#smpBody"), bEN = ov.querySelector("#smpEN"), bTA = ov.querySelector("#smpTA");
    function show(ta) {
      body.innerHTML = half(ta ? SAMPLE_TA : SAMPLE_EN);
      bEN.style.background = ta ? "transparent" : "#c9a84c"; bEN.style.color = ta ? "#c9a84c" : "#1a1f33";
      bTA.style.background = ta ? "#c9a84c" : "transparent"; bTA.style.color = ta ? "#1a1f33" : "#c9a84c";
      body.scrollTop = 0;
    }
    bEN.addEventListener("click", function () { show(false); });
    bTA.addEventListener("click", function () { show(true); });
    ov.querySelector("#smpClose").addEventListener("click", function () { ov.remove(); });
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    show(isTA);
  }
  window.AI_openSample = openSample;

  // Repoint the two "View Sample Report" buttons. They share a label, so we
  // distinguish by DOM order: the FIRST is the Dasa sample, the SECOND is the
  // Life Domains sample (confirmed on the live page). Each opens only its own
  // report's excerpt, with EN/TA tabs.
  function wireSampleButton() {
    try {
      var all = document.querySelectorAll("a,button");
      var samples = [];
      for (var i = 0; i < all.length; i++) {
        var txt = (all[i].textContent || "").trim();
        if (/மாதிரி அறிக்கை|view sample report|sample report/i.test(txt) && txt.length < 40) samples.push(all[i]);
      }
      samples.forEach(function (el, idx) {
        if (el.dataset.smpWired) return;
        el.dataset.smpWired = "1";
        var which = (idx === 0) ? "dasha" : "domains";  // 0=Dasa, 1=Domains
        el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openSample(which); }, true);
      });
    } catch (e) {}
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", wireSampleButton); }
  else { wireSampleButton(); }
  setInterval(wireSampleButton, 1000);
})();
