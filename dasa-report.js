// ─────────────────────────────────────────────────────────────────────────────
//  FILE: dasa-report.js
//  AstroIndicators — builds the Dasa report (Previous + Current + Next MD).
//
//  Reads the rendered Dasa timeline DOM directly (guaranteed present after the
//  user has generated a chart) so it does NOT depend on internal variables.
//  Uses the engine's own global prompt builders + /api/indicate for AI text.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // Parse the rendered timeline into an array of MD objects with their ADs.
  function readTimeline() {
    const rows = document.querySelectorAll("#dashaTimeline .dasha-row");
    if (!rows || !rows.length) return null;
    const mds = [];
    let currentIdx = -1;
    rows.forEach(function (row, i) {
      const lordEl = row.querySelector(".dasha-lord");
      const datesEl = row.querySelector(".dasha-dates");
      if (!lordEl) return;
      const lord = lordEl.textContent.trim();
      const dates = datesEl ? datesEl.textContent.trim().split(/\s+/) : [];
      const ads = [];
      row.querySelectorAll(".antar-item").forEach(function (ai) {
        const al = ai.querySelector(".antar-lord");
        const ad = ai.querySelector(".antar-dates");
        if (al) ads.push({
          lord: al.textContent.replace(/[^A-Za-z]/g, "").trim(),
          dates: ad ? ad.textContent.trim() : "",
        });
      });
      if (row.classList.contains("current")) currentIdx = mds.length;
      mds.push({
        lord: lord.replace(/[^A-Za-z]/g, "").trim(),
        start: dates[0] || "", end: dates[1] || dates[dates.length - 1] || "",
        ads: ads,
      });
    });
    if (currentIdx === -1) return null;
    return {
      previous: currentIdx > 0 ? mds[currentIdx - 1] : null,
      current:  mds[currentIdx],
      next:     currentIdx < mds.length - 1 ? mds[currentIdx + 1] : null,
    };
  }

  // Get the lagna + chart context for the AI prompts.
  function getCtx() {
    // window.currentData if available; else try to read lagna from the chart screen.
    let lagna = "", ctx = "";
    const cd = window.currentData;
    if (cd && cd.chart && cd.chart.d1) {
      lagna = cd.chart.d1.lagnaSign || "";
      try {
        if (typeof window.buildChartContext === "function") {
          ctx = window.buildChartContext(cd.chart.d1.lagnaSign, cd.chart.d1.houses, cd.chart.planets);
        }
      } catch (e) {}
    }
    if (!lagna) {
      // fallback: read lagna label shown on the chart screen
      const el = document.getElementById("d1LagnaLabel") || document.getElementById("lagnaBar");
      if (el) {
        const m = el.textContent.match(/(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)/);
        if (m) lagna = m[1];
      }
    }
    return { lagna: lagna, ctx: ctx };
  }

  function fetchIndication(prompt) {
    return fetch("/api/indicate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt }),
    }).then(function (r) { return r.ok ? r.text() : ""; })
      .then(extractText).catch(function () { return ""; });
  }

  function extractText(raw) {
    if (!raw) return "";
    if (raw.indexOf("data:") === -1) return raw.trim();
    let out = "";
    raw.split("\n").forEach(function (line) {
      line = line.trim();
      if (line.indexOf("data:") === 0) {
        const p = line.slice(5).trim();
        if (p && p !== "[DONE]") {
          try {
            const o = JSON.parse(p);
            if (o.delta && o.delta.text) out += o.delta.text;
            else if (o.text) out += o.text;
            else if (o.content) out += o.content;
          } catch (e) {}
        }
      }
    });
    return out.trim();
  }

  function mdSections(md, label, lagna, ctx, tick) {
    if (!md) return Promise.resolve([]);
    const out = [];
    const mdPrompt = (typeof window.buildMDPrompt === "function")
      ? window.buildMDPrompt(md.lord, lagna, ctx)
      : "Write a 5-7 sentence overview of the " + md.lord + " Mahadasha for a " + lagna + " ascendant, in second person.";
    tick();
    return fetchIndication(mdPrompt).then(function (ov) {
      out.push({ heading: label + ": " + md.lord + " Mahadasha (" + md.start + " to " + md.end + ")",
                 body: ov || "(overview unavailable)", isMDHeading: true });
      let chain = Promise.resolve();
      (md.ads || []).forEach(function (ad) {
        chain = chain.then(function () {
          const adPrompt = (typeof window.buildADPrompt === "function")
            ? window.buildADPrompt(md.lord, ad.lord, lagna, ctx)
            : "Write a short indication for " + md.lord + " Mahadasha / " + ad.lord + " Antardasha for a " + lagna + " ascendant, second person.";
          tick();
          return fetchIndication(adPrompt).then(function (t) {
            out.push({ heading: ad.lord + " Antardasha (" + ad.dates + ")",
                       body: t || "(indication unavailable)", isAD: true });
          });
        });
      });
      return chain.then(function () { return out; });
    });
  }

  // Public: build the full Previous + Current + Next report.
  window.buildDasaReport = function (_tier, onProgress) {
    const tl = readTimeline();
    if (!tl) return Promise.reject("Open the Dasa Periods tab once, then try again.");
    const c = getCtx();
    if (!c.lagna) return Promise.reject("Could not read your ascendant — open the Charts tab once, then retry.");

    const include = [];
    if (tl.previous) include.push(["Previous period", tl.previous]);
    include.push(["Current period", tl.current]);
    if (tl.next) include.push(["Next period", tl.next]);

    let total = 0;
    include.forEach(function (x) { total += 1 + (x[1].ads ? x[1].ads.length : 0); });
    let done = 0;
    const tick = function () { done++; if (onProgress) onProgress(done, total); };

    let chain = Promise.resolve();
    const all = [];
    include.forEach(function (x) {
      chain = chain.then(function () {
        return mdSections(x[1], x[0], c.lagna, c.ctx, tick).then(function (s) {
          s.forEach(function (sec) { all.push(sec); });
        });
      });
    });
    return chain.then(function () { return all; });
  };

})();
