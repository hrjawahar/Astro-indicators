// ─────────────────────────────────────────────────────────────────────────────
//  FILE: report-pdf.js
//  AstroIndicators — generates a branded, downloadable PDF of a paid report.
//  Used for: paid Dasa report, paid Life Domains report.
//
//  Design choices (per owner):
//  - Shows the USER'S NAME ONLY (no birth date/time/place) → protects personal data
//  - Disclaimer framed as "insight to correlate with real events; adapt your plans"
//  - "No refund" line included
//  - AstroIndicators branding (navy + gold)
//
//  Uses jsPDF (loaded from CDN in index.html). No server needed.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // Generate and download a report PDF.
  //   opts = { userName, reportTitle, sections: [{ heading, body }], paymentId? }
  window.generateReportPDF = function (opts) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library not loaded. Please refresh and try again.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 48;                 // margin
    let y = 0;

    const NAVY = [11, 14, 26];
    const GOLD = [201, 168, 76];
    const TEXT = [40, 40, 50];
    const DIM  = [120, 128, 145];

    // ── Header band ──
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, W, 84, "F");
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("AstroIndicators", M, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(180, 188, 200);
    doc.text("Horoscope & Dasa Period Indicators · Swiss Ephemeris · Lahiri Ayanamsha", M, 62);
    y = 84;

    // ── Report title + name ──
    y += 40;
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(opts.reportTitle || "Your Report", M, y);
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text("Prepared for: " + (opts.userName || "—"), M, y);
    y += 10;
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);
    y += 28;

    // ── Sections ──
    (opts.sections || []).forEach(function (sec) {
      if (y > H - 140) { doc.addPage(); y = M; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.text(sec.heading || "", M, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      const lines = doc.splitTextToSize(sec.body || "", W - 2 * M);
      lines.forEach(function (ln) {
        if (y > H - 120) { doc.addPage(); y = M; }
        doc.text(ln, M, y);
        y += 16;
      });
      y += 14;
    });

    // ── Disclaimer (always on its own clean footing) ──
    if (y > H - 200) { doc.addPage(); y = M; }
    y += 10;
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(DIM[0], DIM[1], DIM[2]);
    doc.text("How to use this report", M, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const disclaimer =
      "This report is offered as an insight to help you correlate the indications with the actual events, " +
      "contexts, and circumstances of your life — which differ from one person to another. It is intended " +
      "as a reflective input, not a fixed prediction. Please use it to inform and adapt your own real-time " +
      "plans and decisions, applying your judgement to your specific situation. " +
      "Astrological interpretations are indicative in nature and are not a substitute for professional " +
      "medical, psychological, legal, or financial advice. AstroIndicators is not liable for decisions taken " +
      "solely on the basis of this report. All payments are final and non-refundable once the report is generated.";
    const dLines = doc.splitTextToSize(disclaimer, W - 2 * M);
    dLines.forEach(function (ln) {
      if (y > H - 60) { doc.addPage(); y = M; }
      doc.text(ln, M, y);
      y += 13;
    });

    // ── Footer on every page ──
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(DIM[0], DIM[1], DIM[2]);
      doc.text("© 2026 AstroIndicators · astroindicators.com", M, H - 28);
      doc.text("Page " + i + " of " + pages, W - M, H - 28, { align: "right" });
      if (opts.paymentId) {
        doc.text("Ref: " + opts.paymentId, W / 2, H - 28, { align: "center" });
      }
    }

    const safeName = (opts.userName || "report").replace(/[^a-z0-9]/gi, "_");
    doc.save("AstroIndicators_" + safeName + ".pdf");
  };

})();
