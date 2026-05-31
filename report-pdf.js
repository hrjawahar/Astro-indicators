// ─────────────────────────────────────────────────────────────────────────────
//  FILE: report-pdf.js
//  AstroIndicators — professional, readable PDF report generator.
//  Clean typography, clear MD/AD hierarchy, boxed legal disclaimer, page numbers.
//  Strips screen-only symbols so text is never garbled.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  function clean(s) {
    if (!s) return "";
    return String(s)
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[\u{2600}-\u{27BF}]/gu, "")
      .replace(/[\u{E000}-\u{F8FF}]/gu, "")
      .replace(/[\u2190-\u21FF\u2300-\u23FF]/g, "")
      .replace(/[\u2605\u2606\u25B6\u25BC\u25C0\u25C6\u25C9\u25C8\u2295\u2302\u2644\u2643\u2640\u2642\u263F\u263D\u2609]/g, "")
      .replace(/%[A-Za-z\u00CF\u00CB\u00D1]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  var C = {
    navy: [11, 14, 26], gold: [201, 168, 76], goldDk: [154, 126, 51],
    text: [38, 42, 54], dim: [120, 128, 145], line: [222, 222, 228],
    boxbg: [248, 246, 240],
  };

  window.generateReportPDF = function (opts) {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF library not loaded. Refresh and retry."); return; }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "pt", format: "a4" });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = 50;
    var CW = W - 2 * M;
    var y = 0;

    function needPage(space) { if (y > H - space) { doc.addPage(); y = M + 10; } }

    doc.setFillColor(C.navy[0], C.navy[1], C.navy[2]); doc.rect(0, 0, W, 76, "F");
    doc.setTextColor(C.gold[0], C.gold[1], C.gold[2]);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("AstroIndicators", M, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(180, 188, 200);
    doc.text("Horoscope & Dasa Period Indicators  .  Swiss Ephemeris  .  Lahiri Ayanamsha", M, 58);
    y = 76;

    y += 36;
    doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(clean(opts.reportTitle) || "Your Report", M, y);
    y += 20;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.text("Prepared for: " + (clean(opts.userName) || "Seeker"), M, y);
    y += 8;
    doc.setDrawColor(C.gold[0], C.gold[1], C.gold[2]); doc.setLineWidth(1);
    doc.line(M, y, W - M, y);
    y += 26;

    (opts.sections || []).forEach(function (sec) {
      var heading = clean(sec.heading);
      var body = clean(sec.body);
      var isMD = !!sec.isMDHeading;
      var isAD = !!sec.isAD;

      needPage(110);

      if (isMD) {
        y += 6;
        doc.setFillColor(245, 240, 228);
        var hLines = doc.splitTextToSize(heading, CW - 16);
        var bandH = 16 + hLines.length * 15;
        doc.rect(M, y - 12, CW, bandH, "F");
        doc.setTextColor(C.goldDk[0], C.goldDk[1], C.goldDk[2]);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
        doc.text(hLines, M + 8, y + 2);
        y += bandH + 4;
      } else if (isAD) {
        doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        var hLines2 = doc.splitTextToSize(heading.trim(), CW);
        doc.text(hLines2, M, y);
        y += hLines2.length * 14 + 2;
      } else {
        doc.setTextColor(C.goldDk[0], C.goldDk[1], C.goldDk[2]);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        var hLines3 = doc.splitTextToSize(heading, CW);
        doc.text(hLines3, M, y);
        y += hLines3.length * 15 + 2;
      }

      if (body) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
        doc.setTextColor(C.text[0], C.text[1], C.text[2]);
        var lines = doc.splitTextToSize(body, CW);
        lines.forEach(function (ln) { needPage(70); doc.text(ln, M, y); y += 15; });
      }
      y += 12;
    });

    needPage(150);
    y += 8;
    var disc =
      "Disclaimer: This report is provided for educational and self-reflective purposes only and constitutes " +
      "indicative astrological insight, not professional advice or a guarantee of outcomes. It is not a substitute " +
      "for medical, psychological, legal, or financial counsel. The user assumes full responsibility for any " +
      "decision made in reliance on this report, and AstroIndicators disclaims all liability to the fullest extent " +
      "permitted by law. All payments are final and non-refundable once the report is generated.";
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    var dLines = doc.splitTextToSize(disc, CW - 24);
    var boxH = 18 + dLines.length * 11;
    doc.setFillColor(C.boxbg[0], C.boxbg[1], C.boxbg[2]);
    doc.setDrawColor(C.dim[0], C.dim[1], C.dim[2]); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, boxH, 4, 4, "FD");
    doc.setTextColor(C.dim[0], C.dim[1], C.dim[2]);
    doc.text(dLines, M + 12, y + 14);
    y += boxH;

    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.setTextColor(C.dim[0], C.dim[1], C.dim[2]);
      doc.text("(c) 2026 AstroIndicators  .  astroindicators.com", M, H - 26);
      doc.text("Page " + i + " of " + pages, W - M, H - 26, { align: "right" });
      if (opts.paymentId) doc.text("Ref: " + clean(opts.paymentId), W / 2, H - 26, { align: "center" });
    }

    var safe = (clean(opts.userName) || "report").replace(/[^a-z0-9]/gi, "_");
    doc.save("AstroIndicators_" + safe + ".pdf");
  };

})();
