// ─────────────────────────────────────────────────────────────────────────────
//  FILE: dasa-report.js
//  AstroIndicators — Dasa report builder.
//
//  Structure:
//    1. Full 120-year timeline (all 9 MD periods with dates) — the map
//    2. Previous MD — overview only
//    3. Current MD  — overview + ALL its Antardashas (the detailed core)
//    4. Following MD — overview only
//
//  Reads the rendered Dasa timeline DOM (no dependency on internal vars) and uses
//  the engine's global prompt builders + /api/indicate for AI text.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  function readTimeline() {
    var rows = document.querySelectorAll("#dashaTimeline .dasha-row");
    if (!rows || !rows.length) return null;
    var mds = [], currentIdx = -1;
    rows.forEach(function (row) {
      var lordEl = row.querySelector(".dasha-lord");
      var datesEl = row.querySelector(".dasha-dates");
      if (!lordEl) return;
      var lord = lordEl.textContent.replace(/[^A-Za-z]/g, "").trim();
      var dtxt = datesEl ? datesEl.textContent.trim() : "";
      var dmatch = dtxt.match(/\d{4}-\d{2}-\d{2}/g) || [];
      var ads = [];
      row.querySelectorAll(".antar-item").forEach(function (ai) {
        var al = ai.querySelector(".antar-lord");
        var ad = ai.querySelector(".antar-dates");
        if (al) {
          var adt = ad ? (ad.textContent.match(/\d{4}-\d{2}-\d{2}/g) || []) : [];
          ads.push({
            lord: al.textContent.replace(/[^A-Za-z]/g, "").trim(),
            start: adt[0] || "", end: adt[1] || "",
          });
        }
      });
      if (row.classList.contains("current")) currentIdx = mds.length;
      mds.push({ lord: lord, start: dmatch[0] || "", end: dmatch[1] || "", ads: ads });
    });
    if (currentIdx === -1) return null;
    return {
      all: mds,
      previous: currentIdx > 0 ? mds[currentIdx - 1] : null,
      current: mds[currentIdx],
      next: currentIdx < mds.length - 1 ? mds[currentIdx + 1] : null,
    };
  }

  function getCtx() {
    var lagna = "", ctx = "";
    var cd = window.currentData;
    if (cd && cd.chart && cd.chart.d1) {
      lagna = cd.chart.d1.lagnaSign || "";
      try {
        if (typeof window.buildChartContext === "function")
          ctx = window.buildChartContext(cd.chart.d1.lagnaSign, cd.chart.d1.houses, cd.chart.planets);
      } catch (e) {}
    }
    if (!lagna) {
      var el = document.getElementById("d1LagnaLabel") || document.getElementById("lagnaBar");
      if (el) { var m = el.textContent.match(/(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)/); if (m) lagna = m[1]; }
    }
    return { lagna: lagna, ctx: ctx };
  }

  function fetchIndication(prompt) {
    return fetch("/api/indicate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt })
    }).then(function (r) { return r.ok ? r.text() : ""; }).then(extractText).catch(function () { return ""; });
  }
  function extractText(raw) {
    if (!raw) return "";
    if (raw.indexOf("data:") === -1) return raw.trim();
    var out = "";
    raw.split("\n").forEach(function (line) {
      line = line.trim();
      if (line.indexOf("data:") === 0) {
        var p = line.slice(5).trim();
        if (p && p !== "[DONE]") { try { var o = JSON.parse(p); if (o.delta && o.delta.text) out += o.delta.text; else if (o.text) out += o.text; else if (o.content) out += o.content; } catch (e) {} }
      }
    });
    return out.trim();
  }

  function mdOverview(md, label, lagna, ctx) {
    var prompt = (typeof window.buildMDPrompt === "function")
      ? window.buildMDPrompt(md.lord, lagna, ctx)
      : "Write a 5-7 sentence overview of the " + md.lord + " Mahadasha for a " + lagna + " ascendant, second person.";
    return fetchIndication(prompt).then(function (ov) {
      return { heading: label + ": " + md.lord + " Mahadasha (" + md.start + " to " + md.end + ")",
               body: ov || "(overview unavailable)", isMDHeading: true };
    });
  }

  window.buildDasaReport = function (_tier, onProgress) {
    var tl = readTimeline();
    if (!tl) return Promise.reject("Open the Dasa Periods tab once, then try again.");
    var c = getCtx();
    if (!c.lagna) return Promise.reject("Could not read your ascendant — open the Charts tab once, then retry.");

    // progress: 1 (prev) + 1 (current overview) + N (current ADs) + 1 (next)
    var total = 1 + 1 + (tl.current.ads ? tl.current.ads.length : 0) + 1;
    var done = 0;
    function tick() { done++; if (onProgress) onProgress(done, total); }

    // 1. Full 120-year timeline as a single readable block, current MD marked.
    var sections0 = [];
    var tlText = tl.all.map(function (m, i) {
      var isCur = (m === tl.current);
      return (i + 1) + ". " + m.lord + " Mahadasha — " + m.start + " to " + m.end + (isCur ? "   ◄ CURRENT" : "");
    }).join("\n");
    sections0.push({ heading: "Your Complete 120-Year Dasha Timeline", body: "", isMDHeading: true });
    sections0.push({ heading: tlText, isTimeline: true, currentLord: tl.current.lord });

    var sections = [];
    var prevSec = null, curOverviewSec = null, nextSec = null;
    var adSecs = [];

    // Build a list of deferred jobs (thunks) so we can run them in batches.
    var thunks = [];

    if (tl.previous) {
      thunks.push(function () { return mdOverview(tl.previous, "Previous period", c.lagna, c.ctx).then(function (s) { prevSec = s; tick(); }); });
    } else { tick(); }

    thunks.push(function () { return mdOverview(tl.current, "Current period", c.lagna, c.ctx).then(function (s) { curOverviewSec = s; tick(); }); });

    (tl.current.ads || []).forEach(function (ad, idx) {
      thunks.push(function () {
        var adPrompt = (typeof window.buildADPrompt === "function")
          ? window.buildADPrompt(tl.current.lord, ad.lord, c.lagna, c.ctx)
          : "Write a short indication for " + tl.current.lord + " Mahadasha / " + ad.lord + " Antardasha for a " + c.lagna + " ascendant, second person.";
        return fetchIndication(adPrompt).then(function (t) {
          adSecs[idx] = { heading: ad.lord + " Antardasha (" + ad.start + " to " + ad.end + ")",
                          body: t || "(indication unavailable)", isAD: true };
          tick();
        });
      });
    });

    if (tl.next) {
      thunks.push(function () { return mdOverview(tl.next, "Next period", c.lagna, c.ctx).then(function (s) { nextSec = s; tick(); }); });
    } else { tick(); }

    // Run in batches of 5 concurrent calls — fast (~1 min) but rate-limit-safe.
    function runBatched(list, size) {
      var i = 0;
      function nextBatch() {
        if (i >= list.length) return Promise.resolve();
        var batch = list.slice(i, i + size).map(function (fn) { return fn(); });
        i += size;
        return Promise.all(batch).then(nextBatch);
      }
      return nextBatch();
    }

    return runBatched(thunks, 5).then(function () {
      if (prevSec) sections.push(prevSec);
      if (curOverviewSec) sections.push(curOverviewSec);
      adSecs.forEach(function (s) { if (s) sections.push(s); });
      if (nextSec) sections.push(nextSec);
      sections.push({
        heading: "Want this depth for your other Dasha periods?",
        body: "If you would like a similarly detailed report for any other Mahadasha and its sub-periods (Antardashas) — like the current period detailed above — please submit a request under the Contact Us tab. You will receive it at an additional cost of Rs.100 per Mahadasha and its Antardasha sub-periods.",
        isNote: true,
      });
      return sections0.concat(sections);
    });
  };

})();
