// ─────────────────────────────────────────────────────────────────────────────
//  FILE: dasa-report.js
//  AstroIndicators — builds the structured two-tier Dasa report.
//
//  Tier 1 (₹399): Current MD (overview + each AD) + Next MD (overview + each AD)
//  Tier 2 (₹499): Previous MD + Current MD + Next MD (each: overview + each AD)
//
//  It reuses the engine's own data (window.currentData) and its AI indication
//  endpoint (/api/indicate) so the report matches what's on screen.
//
//  Because a full report needs many AI calls, it shows progress while building.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // Find previous / current / next Mahadasha from the engine's data.
  function locateMDs() {
    const cd = window.currentData;
    if (!cd || !cd.chart || !cd.chart.dasha || !cd.chart.dasha.dashas) return null;
    const dashas = cd.chart.dasha.dashas;
    const today = new Date().toISOString().split("T")[0];
    let curIdx = -1;
    for (let i = 0; i < dashas.length; i++) {
      if (dashas[i].startDate <= today && today < dashas[i].endDate) { curIdx = i; break; }
    }
    if (curIdx === -1) return null;
    return {
      previous: curIdx > 0 ? dashas[curIdx - 1] : null,
      current:  dashas[curIdx],
      next:     curIdx < dashas.length - 1 ? dashas[curIdx + 1] : null,
      lagna:    cd.chart.d1 ? cd.chart.d1.lagnaSign : (cd.chart.lagnaSign || ""),
      today:    today,
    };
  }

  // Call the AI indication endpoint for one prompt; returns plain text.
  function fetchIndication(prompt) {
    return fetch("/api/indicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt }),
    }).then(function (r) {
      if (!r.ok) return "";
      // The endpoint streams SSE; read it fully and extract text.
      return r.text();
    }).then(function (raw) {
      return extractText(raw);
    }).catch(function () { return ""; });
  }

  // Pull readable text out of the streamed SSE response.
  function extractText(raw) {
    if (!raw) return "";
    // If it's already plain text, return it.
    if (raw.indexOf("data:") === -1) return raw.trim();
    let out = "";
    raw.split("\n").forEach(function (line) {
      line = line.trim();
      if (line.indexOf("data:") === 0) {
        const payload = line.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            const obj = JSON.parse(payload);
            if (obj.delta && obj.delta.text) out += obj.delta.text;
            else if (obj.text) out += obj.text;
            else if (obj.content) out += obj.content;
          } catch (e) {}
        }
      }
    });
    return out.trim();
  }

  // Build the MD overview + AD sections for one Mahadasha.
  function buildMDSections(md, label, lagna, chartCtx, onProgress) {
    if (!md) return Promise.resolve([]);
    const sections = [];
    const mdPrompt = (typeof window.buildMDPrompt === "function")
      ? window.buildMDPrompt(md.lord, lagna, chartCtx)
      : "Write a 5-7 sentence overview of the " + md.lord + " Mahadasha for a " + lagna + " ascendant, in second person.";

    return fetchIndication(mdPrompt).then(function (overview) {
      sections.push({
        heading: label + ": " + md.lord + " Mahadasha (" + md.startDate + " to " + md.endDate + ")",
        body: overview || "(overview unavailable)",
        isMDHeading: true,
      });
      const ads = md.antarDasas || [];
      let chain = Promise.resolve();
      ads.forEach(function (ad) {
        chain = chain.then(function () {
          const adPrompt = (typeof window.buildADPrompt === "function")
            ? window.buildADPrompt(md.lord, ad.lord, lagna, chartCtx)
            : "Write a short indication for " + md.lord + " Mahadasha / " + ad.lord + " Antardasha for a " + lagna + " ascendant, in second person.";
          if (onProgress) onProgress();
          return fetchIndication(adPrompt).then(function (txt) {
            sections.push({
              heading: ad.lord + " Antardasha (" + ad.startDate + " to " + ad.endDate + ")",
              body: txt || "(indication unavailable)",
              isAD: true,
            });
          });
        });
      });
      return chain.then(function () { return sections; });
    });
  }

  // Public: build the full report. tier = "current_next" or "full".
  //   onProgress(done, total) called as it works.
  window.buildDasaReport = function (tier, onProgress) {
    const md = locateMDs();
    if (!md) return Promise.reject("No dasha data — generate a chart first.");

    // Build the chart context the AI prompts need (reuse engine's builder).
    const cd = window.currentData;
    let chartCtx = "";
    try {
      if (typeof window.buildChartContext === "function" && cd && cd.chart && cd.chart.d1) {
        chartCtx = window.buildChartContext(cd.chart.d1.lagnaSign, cd.chart.d1.houses, cd.chart.planets);
      }
    } catch (e) {}

    const include = [];
    if (tier === "full" && md.previous) include.push(["Previous period", md.previous]);
    include.push(["Current period", md.current]);
    if (md.next) include.push(["Next period", md.next]);

    let total = 0;
    include.forEach(function (x) { total += 1 + ((x[1].antarDasas || []).length); });
    let done = 0;
    const tick = function () { done++; if (onProgress) onProgress(done, total); };

    let chain = Promise.resolve([]);
    const all = [];
    include.forEach(function (x) {
      chain = chain.then(function () {
        tick();
        return buildMDSections(x[1], x[0], md.lagna, chartCtx, tick).then(function (secs) {
          secs.forEach(function (s) { all.push(s); });
        });
      });
    });
    return chain.then(function () { return all; });
  };

})();
