// ─────────────────────────────────────────────────────────────────────────────
//  FILE: referral-ui.js
//  AstroIndicators — Client ID display + Referral & Reward Program (frontend).
//
//  What it does, all self-contained:
//    • Injects three rows under the Place field on the birth form:
//        CLIENT ID   (read-only line, "—" until a chart is generated, tap-to-copy)
//        Mobile number (optional)  — "No promotional or follow-up messages — ever."
//        Referral ID  (optional)   — "if referred by an existing user" + live ✓/✗
//    • After chart generation: computes the code, registers it via /api/referral
//      (action:"register") so it becomes a valid referral code, updates the form
//      line, and can add a matching line to the chart page's lagna bar.
//    • Exposes getters payments.js reads automatically (no caller changes).
//    • Holds every piece of program copy in ONE place (AIref.copy) so the home
//      page block, flipbook letter paragraph, PDF final page and the payment
//      activation message all stay consistent.
//
//  Wiring (2 lines total — see INTEGRATION-NOTES.md):
//    index.html : <script src="referral-ui.js"></script>   (BEFORE payments.js)
//    app.js     : AIref.onChartGenerated(chartId);          (after chart succeeds)
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // ⚠️ KEEP IN SYNC — friendlyCode()/normalizeCode() exist in FOUR places (no
  //    build step, duplicated by design): site/referral-ui.js (this file),
  //    functions/api/referral.js, functions/api/order.js, functions/api/verify.js.
  //    All copies MUST be byte-identical or codes will mismatch.
  function friendlyCode(chartId) {
    var s = String(chartId || "");
    function fnv(seed) {
      var h = seed >>> 0;
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        // h = (h * 16777619) mod 2^32, without Math.imul for max compatibility
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return h >>> 0;
    }
    var A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Crockford-style: no 0/O/1/I
    var h1 = fnv(0x811c9dc5), h2 = fnv(0x9747b28c), out = "", i;
    for (i = 0; i < 4; i++) { out += A[h1 & 31]; h1 >>>= 5; }
    for (i = 0; i < 4; i++) { out += A[h2 & 31]; h2 >>>= 5; }
    return "AI-" + out.slice(0, 4) + "-" + out.slice(4);
  }

  function normalizeCode(raw) {
    var s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.slice(0, 2) === "AI") s = s.slice(2);
    if (s.length !== 8) return null;
    if (/[01IO]/.test(s)) return null; // alphabet never contains these
    return "AI-" + s.slice(0, 4) + "-" + s.slice(4);
  }

  // ── All program copy, one authoritative place ──────────────────────────────
  var copy = {
    clientIdLabel: "Client ID",
    clientIdPending: "Generates automatically with your chart",
    clientIdTip: "",
    mobileLabel: 'Mobile number <span class="ai-opt">Optional</span>',
    mobileTip: "For sending gift vouchers by SMS — no marketing, ever.",
    referralLabel: 'Referral ID <span class="ai-opt">Optional</span>',
    referralTip: "if referred by an existing user",
    refValid: "\u2713 Valid referral",
    refInvalid: "\u2717 Referral ID not found",
    refSelf: "That's your own Client ID",
    refPending: "Generate your chart to confirm this referral",
    copied: "Copied!",
    invite: "Sharing is caring \uD83D\uDC9B \u2014 share your Client ID with friends. " +
            "When they name it as referrer, we'll thank you with a reward.",
    activation: function (code) {
      return "\u2713 Your Client ID " + code + " is now active for referrals \u2014 share it!";
    },
    letterParagraph: function (code) {
      return "If this reading brought you clarity, pass it on. Share this with someone " +
             "who may need it \u2014 and mention your Client ID, " + code + ", when they " +
             "get their own report, so we can send you a small gift of thanks.";
    },
    homepageHTML:
      '<div class="ai-ref-program">' +
      '<h3>Referral &amp; Reward Program <span class="ai-ref-lt">(Limited time)</span></h3>' +
      '<p><em>For our paid report members.</em> Your unique <strong>Client ID</strong> doubles as your ' +
      'referral code. Share it with friends and family \u2014 when they enter it while purchasing ' +
      'their own report, you earn an Amazon gift voucher for every successful referral: ' +
      '<strong>\u20B9250</strong> for a LAMP report, <strong>\u20B9150</strong> for a Q&amp;A report. ' +
      'Vouchers are sent by SMS to your registered mobile number within a week of your friend\u2019s purchase.</p>' +
      '<p>This is a limited-period launch offer \u2014 start sharing today.</p>' +
      '<p class="ai-ref-note"><em>Please note:</em> Your Client ID is generated from your birth details. ' +
      'Changing any detail creates a new chart with a new Client ID, so always share the ID printed on your report.</p>' +
      '</div>',
  };

  // ── Minimal styling; inherits the site's fonts/colors everywhere possible ──
  var CSS =
    ".ai-ref-row{margin:10px 0}" +
    ".ai-ref-key{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.65;margin-bottom:2px}" +
    ".ai-opt{display:inline-block;font-size:9.5px;letter-spacing:.06em;padding:1px 6px;margin-left:6px;" +
      "color:#C9A44C;background:rgba(201,164,76,.12);border:1px solid rgba(201,164,76,.5);" +
      "border-radius:8px;text-transform:uppercase;vertical-align:middle}" +
    ".ai-ref-code.ai-pending{font-family:inherit;font-size:12.5px;font-weight:400;opacity:.55;cursor:default;font-style:italic}" +
    ".ai-ref-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;" +
      "font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;user-select:all}" +
    ".ai-ref-code svg{width:14px;height:14px;opacity:.55}" +
    ".ai-ref-tip{font-size:11.5px;opacity:.6;margin-top:2px}" +
    ".ai-ref-input{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;" +
      "border:1px solid rgba(128,128,128,.4);border-radius:6px;background:transparent;color:inherit}" +
    ".ai-ref-input.ai-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
      "text-transform:uppercase;letter-spacing:.05em}" +
    ".ai-ref-status{font-size:12px;margin-top:3px;min-height:15px;opacity:.7}" +
    ".ai-ref-status.ok{color:#2e9e5b;opacity:1}.ai-ref-status.bad{color:#c0392b;opacity:1}" +
    ".ai-ref-flash{color:#2e9e5b;font-size:11px;margin-left:6px}" +
    ".ai-ref-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);" +
      "background:#1d1d1d;color:#ffd76a;padding:12px 18px;border-radius:10px;font-size:14px;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.35);z-index:99999;max-width:92vw;text-align:center}" +
    ".ai-ref-program{font-size:12.5px;line-height:1.5;opacity:.9;margin-top:14px;" +
      "padding-top:12px;border-top:1px solid rgba(128,128,128,.18)}" +
    ".ai-ref-program h3{margin:0 0 6px;font-size:13.5px;letter-spacing:.01em;color:var(--ai-gold,#C9A44C)}" +
    ".ai-ref-program p{margin:0 0 6px}" +
    ".ai-ref-program .ai-ref-lt{font-size:.85em;opacity:.7;font-weight:500}" +
    ".ai-ref-program .ai-ref-note{font-size:.92em;opacity:.75}";

  var COPY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

  var state = { chartId: null, code: null, registered: false };

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function injectCSS() {
    if (document.getElementById("ai-ref-css")) return;
    var s = document.createElement("style");
    s.id = "ai-ref-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Find the form row that contains the Place input, to insert after it.
  function findPlaceRow() {
    var sels = ["#inputPlaceSearch",            // this site's Place field (index.html)
                "#place", "#placeInput", "#birthPlace", "#pob",
                'input[name="place"]', 'input[name="birthPlace"]',
                'input[placeholder*="lace" i]'];
    for (var i = 0; i < sels.length; i++) {
      var inp = document.querySelector(sels[i]);
      if (inp) {
        // climb to the row wrapper (label+input group) but stay inside the form
        var row = inp.closest(".form-row, .form-group, .field, .input-group, label") || inp;
        return row.parentElement === null ? inp : row;
      }
    }
    return null;
  }

  // ── Build the three rows on the birth form ─────────────────────────────────
  function injectFormFields(afterEl) {
    injectCSS();
    var anchor = afterEl || findPlaceRow();
    if (!anchor || document.getElementById("aiRefBlock")) return;

    var block = el(
      '<div id="aiRefBlock">' +
        '<div class="ai-ref-row" id="aiClientIdRow">' +
          '<div class="ai-ref-key">' + copy.clientIdLabel + "</div>" +
          '<span class="ai-ref-code ai-pending" id="aiClientIdVal" title="Tap to copy">' + copy.clientIdPending + "</span>" +
          '<span class="ai-ref-flash" id="aiCopyFlash"></span>' +
          (copy.clientIdTip ? '<div class="ai-ref-tip" id="aiClientIdTip">' + copy.clientIdTip + "</div>" : "") +
          '<div class="ai-ref-tip" id="aiInviteLine" style="display:none">' + copy.invite + "</div>" +
        "</div>" +
        '<div class="ai-ref-row">' +
          '<div class="ai-ref-key">' + copy.mobileLabel + "</div>" +
          '<input class="ai-ref-input" id="aiMobile" type="tel" inputmode="tel" ' +
                 'autocomplete="tel" maxlength="16" placeholder="+91\u2026">' +
          '<div class="ai-ref-tip">' + copy.mobileTip + "</div>" +
        "</div>" +
        '<div class="ai-ref-row">' +
          '<div class="ai-ref-key">' + copy.referralLabel + "</div>" +
          '<input class="ai-ref-input ai-code" id="aiReferral" type="text" ' +
                 'autocomplete="off" spellcheck="false" maxlength="14" placeholder="AI-XXXX-XXXX">' +
          '<div class="ai-ref-tip">' + copy.referralTip + "</div>" +
          '<div class="ai-ref-status" id="aiRefStatus"></div>' +
        "</div>" +
      "</div>"
    );
    anchor.insertAdjacentElement("afterend", block);

    document.getElementById("aiClientIdVal").addEventListener("click", copyCode);

    var refInput = document.getElementById("aiReferral");
    var t = null;
    refInput.addEventListener("input", function () {
      if (t) clearTimeout(t);
      t = setTimeout(liveCheck, 500);
    });

    // Save the mobile number when the user leaves the field (and again is
    // harmless — the server COALESCEs). Only meaningful once a chart exists.
    var mobInput = document.getElementById("aiMobile");
    if (mobInput) {
      mobInput.addEventListener("blur", function () { saveMobile(); });
    }
  }

  // Persist the form's mobile onto the customer row via the register action.
  // No-op until a chart has been generated (we need the chartId as the key).
  function saveMobile() {
    if (!state.chartId) return;
    var m = document.getElementById("aiMobile");
    var val = m ? m.value.trim() : "";
    if (!val) return;
    fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", chartId: state.chartId, mobile: val }),
    }).catch(function () {});
  }

  function copyCode() {
    if (!state.code) return;
    var flash = document.getElementById("aiCopyFlash");
    function done() {
      if (!flash) return;
      flash.textContent = copy.copied;
      setTimeout(function () { flash.textContent = ""; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.code).then(done).catch(done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = state.code;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      done();
    }
  }

  // ── Live ✓/✗ on the Referral ID field (advisory only) ─────────────────────
  function liveCheck() {
    var input = document.getElementById("aiReferral");
    var status = document.getElementById("aiRefStatus");
    if (!input || !status) return;
    var norm = normalizeCode(input.value);
    if (!input.value.trim()) { status.textContent = ""; status.className = "ai-ref-status"; return; }
    if (!norm) { status.textContent = copy.refInvalid; status.className = "ai-ref-status bad"; return; }
    // Resolve the current chartId at check time — don't depend on onChartGenerated
    // having already set state.chartId. This makes the self-referral guard robust
    // even if the user types their own code before/while the chart is generating.
    // ── Self-referral guard + trustworthy validity ───────────────────────────
    // The ONLY fully reliable "own code" is state.code, set at generation. Before
    // that, window.AI_chartId() may be stale (freshly re-entered details not yet
    // recomputed), so we must NOT show a confident green "valid" — a stale id
    // could let the user's own code slip through as valid. Policy:
    //   • If we can PROVE self (any resolved id derives to the typed code) → reject.
    //   • Else if the chart is generated (state.code set) → trust server result.
    //   • Else (pre-generate) → neutral "generate to confirm", never green.
    var provenSelf = false;
    var candidates = [];
    if (state.chartId) candidates.push(state.chartId);
    var live = resolveChartId(); if (live) candidates.push(live);
    for (var ci = 0; ci < candidates.length; ci++) {
      if (friendlyCode(candidates[ci]) === norm) { provenSelf = true; break; }
    }
    var shownEl = document.getElementById("aiClientIdVal");
    if (!provenSelf && shownEl && !shownEl.classList.contains("ai-pending")) {
      if (normalizeCode(shownEl.textContent) === norm) provenSelf = true;
    }
    if (provenSelf) {
      status.textContent = copy.refSelf; status.className = "ai-ref-status bad"; return;
    }
    // Not proven self. If the chart isn't generated yet, we can't trust a green
    // tick — stay neutral and ask them to generate.
    if (!state.code) {
      status.textContent = copy.refPending; status.className = "ai-ref-status";
      return;
    }
    // Chart generated → state.code is authoritative; the server check is safe to
    // trust (and it also re-checks self against the real chartId we pass).
    var cid = state.chartId;
    fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", code: norm, chartId: cid }),
    })
    .then(function (r) { return r.json(); })
    .then(function (v) {
      if (v.self)       { status.textContent = copy.refSelf;    status.className = "ai-ref-status bad"; }
      else if (v.valid) { status.textContent = copy.refValid;   status.className = "ai-ref-status ok";  }
      else              { status.textContent = copy.refInvalid; status.className = "ai-ref-status bad"; }
    })
    .catch(function () { status.textContent = ""; }); // network blip → stay quiet
  }

  // ── Called by app.js once a chart has been generated ───────────────────────
  // Accepts a chartId string, a function returning one (window.AI_chartId is a
  // FUNCTION in this codebase), or nothing (falls back to window.AI_chartId).
  function resolveChartId(x) {
    var v = (x === undefined || x === null) ? (typeof window !== "undefined" ? window.AI_chartId : null) : x;
    if (typeof v === "function") { try { v = v(); } catch (e) { v = null; } }
    return v ? String(v) : null;
  }
  function onChartGenerated(chartId) {
    var cid = resolveChartId(chartId);
    if (!cid) return null;
    if (state.chartId !== cid) state.registered = false;  // new chart → re-register
    state.chartId = cid;
    state.code = friendlyCode(state.chartId);

    // Update the form line + reveal the invite line.
    var val = document.getElementById("aiClientIdVal");
    if (val) { val.innerHTML = state.code + " " + COPY_ICON; val.classList.remove("ai-pending"); }
    var inv = document.getElementById("aiInviteLine");
    if (inv) inv.style.display = "";

    // Register server-side so this code is validatable as a referral
    // (free users included). Fire-and-forget; retried on next generation.
    if (!state.registered) {
      var m0 = document.getElementById("aiMobile");
      var mob0 = m0 ? m0.value.trim() : "";
      fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", chartId: state.chartId, mobile: mob0 }),
      }).then(function () { state.registered = true; }).catch(function () {});
    }

    // Re-check any referral already typed (self-guard now knows our chartId).
    liveCheck();
    return state.code;
  }

  // ── Chart page: a lagna-bar item matching the existing key/value style ─────
  // Call after renderChartScreen(), e.g. AIref.appendLagnaItem("#lagnaBar")
  function appendLagnaItem(sel) {
    injectCSS();
    var bar = typeof sel === "string" ? document.querySelector(sel || "#lagnaBar") : sel;
    if (!bar || !state.code) return;
    var old = document.getElementById("aiLagnaClientId");
    if (old) old.remove();
    bar.insertAdjacentHTML("beforeend",
      '<div class="lagna-item" id="aiLagnaClientId"><div class="lagna-key">' +
      copy.clientIdLabel + '</div><div class="lagna-val ai-ref-code" title="Tap to copy">' +
      state.code + "</div></div>");
    var v = bar.querySelector("#aiLagnaClientId .lagna-val");
    if (v) v.addEventListener("click", copyCode);
  }

  // ── Payment success: activation toast (called by payments.js) ──────────────
  function showActivation(code) {
    injectCSS();
    var toast = el('<div class="ai-ref-toast">' + copy.activation(code || state.code || "") + "</div>");
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 7000);
  }

  // ── Home page: inject the program block (call with a container selector) ───
  function renderHomepageBlock(sel) {
    injectCSS();
    var host = document.querySelector(sel);
    if (host && !host.querySelector(".ai-ref-program")) host.insertAdjacentHTML("beforeend", copy.homepageHTML);
  }

  // ── Getters payments.js pulls automatically ────────────────────────────────
  function getMobile() {
    var m = document.getElementById("aiMobile");
    return m ? m.value.trim() : "";
  }
  function getReferralCode() {
    var r = document.getElementById("aiReferral");
    return r ? (normalizeCode(r.value) || "") : "";
  }
  function getClientCode() { return state.code || ""; }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.AIref = {
    friendlyCode: friendlyCode,
    normalizeCode: normalizeCode,
    injectFormFields: injectFormFields,
    onChartGenerated: onChartGenerated,
    appendLagnaItem: appendLagnaItem,
    showActivation: showActivation,
    renderHomepageBlock: renderHomepageBlock,
    getMobile: getMobile,
    getReferralCode: getReferralCode,
    getClientCode: getClientCode,
    getChartId: function () { return state.chartId || resolveChartId(); },
    copy: copy,
  };

  // Auto-inject on load if the birth form is on the page.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { injectFormFields(); });
  } else {
    injectFormFields();
  }

})();
