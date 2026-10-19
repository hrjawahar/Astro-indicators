// ─────────────────────────────────────────────────────────────────────────────
//  FILE: testcode-ui.js   (load right AFTER payments.js, not deferred)
//  One-time TEST CODES — lets selected users unlock ONE report for ONE birth
//  chart without paying. The server (/api/redeem) decides everything.
//
//  HOW A TESTER GETS IN
//  • Personal link:  https://astroindicators.com/?testcode=AI-TEST-XXXXX-XXXXX
//    (the code is saved on their device and removed from the address bar), or
//  • "Have a test code?" link in the footer → type it in.
//
//  WHAT HAPPENS AT PAY TIME
//  window.startPayment is wrapped: for an eligible report (not the domain bundle,
//  not a consultation) with a saved code, we call /api/redeem first.
//    ok  → resolve exactly like a successful payment (callers unlock as usual)
//    no  → short notice, code cleared, and the normal Razorpay checkout opens.
//  A code works once; afterwards it's bound to that birth chart on the server.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";
  var KEY = "ai_testcode";
  var INELIGIBLE = /^(domain_all|consult)/;

  function get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function set(c) { try { c ? localStorage.setItem(KEY, c) : localStorage.removeItem(KEY); } catch (e) {} renderBanner(); }
  function clean(c) { return String(c || "").toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 40); }

  // 1. Pick the code up from ?testcode= and tidy the URL.
  try {
    var u = new URL(window.location.href);
    var q = u.searchParams.get("testcode");
    if (q) {
      localStorage.setItem(KEY, clean(q));
      u.searchParams.delete("testcode");
      history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash);
    }
  } catch (e) {}

  // 2. Small UI: toast, banner, footer link + entry box.
  function toast(msg, good) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:2147483647;max-width:92vw;" +
      "padding:12px 18px;border-radius:12px;font:600 14px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);" +
      (good ? "background:#C9A44C;color:#0B0E1A" : "background:#141B33;color:#EDEBE4;border:1px solid #C9A44C");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }
  function renderBanner() {
    var b = document.getElementById("aiTestcodeBanner");
    var code = get();
    if (!code) { if (b) b.remove(); return; }
    if (!document.body) return;
    if (!b) {
      b = document.createElement("div");
      b.id = "aiTestcodeBanner";
      b.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;align-items:center;" +
        "max-width:94vw;padding:9px 14px;border-radius:999px;background:#0B0E1A;border:1px solid #C9A44C;color:#E8D9AE;" +
        "font:500 13px/1.3 Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)";
      document.body.appendChild(b);
    }
    b.innerHTML = "🎟 <span>Test code ready — your next report unlocks free (one birth chart).</span>" +
      "<button type='button' aria-label='Remove test code' style='background:none;border:0;color:#C9A44C;font-size:16px;cursor:pointer;padding:0 2px'>✕</button>";
    b.querySelector("button").onclick = function () { set(""); };
  }
  function openEntry() {
    var old = document.getElementById("aiTestcodeBox"); if (old) old.remove();
    var box = document.createElement("div");
    box.id = "aiTestcodeBox";
    box.style.cssText = "position:fixed;inset:0;z-index:99998;background:rgba(5,8,20,.7);display:flex;align-items:center;justify-content:center;padding:16px";
    box.innerHTML =
      "<div style='background:#141B33;border:1px solid #C9A44C;border-radius:16px;padding:20px;width:100%;max-width:380px;color:#EDEBE4;font:14px/1.5 Inter,system-ui,sans-serif'>" +
      "<div style='font-weight:700;color:#E8D9AE;font-size:16px;margin-bottom:6px'>Have a test code?</div>" +
      "<div style='opacity:.85;margin-bottom:12px'>It unlocks one report for one birth chart. Enter it, then choose your report as usual.</div>" +
      "<input id='aiTestcodeInput' autocomplete='off' autocapitalize='characters' placeholder='AI-TEST-XXXXX-XXXXX' " +
      "style='width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid #3a4266;background:#0B0E1A;color:#EDEBE4;font-size:15px;letter-spacing:.04em'>" +
      "<div style='display:flex;gap:10px;justify-content:flex-end;margin-top:14px'>" +
      "<button type='button' data-x style='background:none;border:1px solid #3a4266;color:#EDEBE4;border-radius:10px;padding:9px 14px;cursor:pointer'>Cancel</button>" +
      "<button type='button' data-ok style='background:#C9A44C;border:0;color:#0B0E1A;font-weight:700;border-radius:10px;padding:9px 16px;cursor:pointer'>Save code</button>" +
      "</div></div>";
    document.body.appendChild(box);
    var inp = box.querySelector("#aiTestcodeInput"); inp.value = get(); inp.focus();
    box.querySelector("[data-x]").onclick = function () { box.remove(); };
    box.onclick = function (e) { if (e.target === box) box.remove(); };
    box.querySelector("[data-ok]").onclick = function () {
      var c = clean(inp.value);
      if (c.replace(/-/g, "").length < 8) { inp.style.borderColor = "#c0392b"; return; }
      set(c); box.remove(); toast("Code saved. Pick your report — it will unlock without payment.", true);
    };
  }
  function addFooterLink() {
    var foot = document.querySelector("footer") || document.body;
    if (!foot || document.getElementById("aiTestcodeLink")) return;
    var a = document.createElement("a");
    a.id = "aiTestcodeLink"; a.href = "#"; a.textContent = "Have a test code?";
    a.style.cssText = "display:block;text-align:center;margin:10px auto 18px;font:500 12px Inter,system-ui,sans-serif;color:#9aa0b8;text-decoration:underline";
    a.onclick = function (e) { e.preventDefault(); openEntry(); };
    foot.appendChild(a);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { renderBanner(); addFooterLink(); });
  else { renderBanner(); addFooterLink(); }

  function chooseBox(isBundle, amount) {
    return new Promise(function (resolve) {
      var old = document.getElementById("aiTestcodeChoose"); if (old) old.remove();
      var price = amount ? " ₹" + Number(amount).toLocaleString("en-IN") : "";
      var box = document.createElement("div");
      box.id = "aiTestcodeChoose";
      box.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(5,8,20,.72);display:flex;align-items:center;justify-content:center;padding:16px";
      box.innerHTML =
        "<div role='dialog' aria-modal='true' style='background:#141B33;border:1px solid #C9A44C;border-radius:16px;padding:20px;width:100%;max-width:400px;color:#EDEBE4;font:14px/1.55 Inter,system-ui,sans-serif'>" +
        "<div style='font-weight:700;color:#E8D9AE;font-size:16px;margin-bottom:8px'>🎟 Your test code covers one individual report</div>" +
        "<div style='opacity:.92'>" + (isBundle
          ? "Use it on <b>any single Domain report (₹750)</b> — Career, Marriage, Self and the rest — or the Life Indicators report. It doesn't cover the <b>All 7 Domains bundle</b>."
          : "Use it on <b>any single Domain report (₹750)</b> or the Life Indicators report. It doesn't cover <b>consultations</b>.") +
        "<br><span style='color:#C9A44C'>Your code stays saved.</span></div>" +
        "<div style='display:flex;flex-direction:column;gap:10px;margin-top:16px'>" +
        "<button type='button' data-back style='background:#C9A44C;border:0;color:#0B0E1A;font-weight:700;border-radius:10px;padding:11px 14px;cursor:pointer;font-size:15px'>Choose a single report</button>" +
        "<button type='button' data-pay style='background:none;border:1px solid #3a4266;color:#EDEBE4;border-radius:10px;padding:10px 14px;cursor:pointer'>Pay" + price + " for " + (isBundle ? "the bundle" : "the consultation") + "</button>" +
        "</div></div>";
      document.body.appendChild(box);
      function done(v) { box.remove(); resolve(v); }
      box.querySelector("[data-back]").onclick = function () {
        done(false);
        try { document.querySelector('.nav-tab[data-tab="domainReportTab"]') && document.querySelector('.nav-tab[data-tab="domainReportTab"]').click(); } catch (e) {}
      };
      box.querySelector("[data-pay]").onclick = function () { done(true); };
      box.onclick = function (e) { if (e.target === box) done(false); };
    });
  }

  // 3. Wrap startPayment (defined by payments.js, which must load first).
  var realStart = window.startPayment;
  if (typeof realStart !== "function") { try { console.warn("testcode-ui.js: load after payments.js"); } catch (e) {} return; }

  // Guards against the SAME report being started twice (double-tap, or the
  // email-field "resume" helper firing alongside a click): while a code is being
  // redeemed, or after it succeeded, repeat calls for that chart + report share
  // the result instead of opening Razorpay on top of the unlocked report.
  var inflight = {}, redeemed = {};

  window.startPayment = function (opts) {
    opts = opts || {};
    var chartId = opts.chartId || window.AI_chartId || null;
    if (typeof chartId === "function") { try { chartId = chartId(); } catch (e) { chartId = null; } }
    var key = String(chartId || "") + "|" + String(opts.item || "");
    if (redeemed[key]) return Promise.resolve(redeemed[key]);
    if (inflight[key]) return inflight[key];

    var code = get();
    if (code && (opts.booking || /^(domain_all|consult)/.test(String(opts.item || "")))) {
      // Saved code, but this purchase isn't eligible → let the tester choose:
      // go back and pick a single report (code kept), or pay for this item.
      var isBundle = /^domain_all/.test(String(opts.item || ""));
      return chooseBox(isBundle, opts.amount).then(function (pay) {
        return pay ? realStart(opts) : Promise.reject("dismissed");   // callers ignore "dismissed"
      });
    }
    if (!code || !opts.item || INELIGIBLE.test(String(opts.item))) return realStart(opts);
    if (!chartId) return realStart(opts);

    var p = redeemWith(code, chartId, opts, key);
    inflight[key] = p;
    p.then(function () { delete inflight[key]; }, function () { delete inflight[key]; });
    return p;
  };

  function redeemWith(code, chartId, opts, key) {
    return fetch("/api/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, chartId: String(chartId), item: opts.item, email: opts.email || "" }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j = j || {}; j._status = r.status; return j; }); })
      .then(function (res) {
        if (res._status === 429 || res._status >= 500) {        // keep the code; just pay now or retry later
          toast((res.error || "Please try again shortly.") + " Continuing to payment…", false);
          return new Promise(function (r) { setTimeout(r, 1400); }).then(function () { return realStart(opts); });
        }
        if (res && res.ok) {
          set("");                                              // one-time: forget it
          (window.AI_unlocked = window.AI_unlocked || {})[opts.item] = String(chartId);
          toast("✓ Unlocked with your test code — enjoy your report!", true);
          redeemed[key] = { paymentId: res.paymentId, item: opts.item, clientCode: null, test: true };
          return redeemed[key];
        }
        set("");
        toast((res && res.error ? res.error : "This code couldn't be used.") + " Continuing to payment…", false);
        return new Promise(function (r) { setTimeout(r, 1400); }).then(function () { return realStart(opts); });
      }, function () { return realStart(opts); });       // network trouble → normal payment
  }
})();
