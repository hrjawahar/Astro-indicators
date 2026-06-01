// ─────────────────────────────────────────────────────────────────────────────
//  FILE: report-pdf.js
//  AstroIndicators — professional PDF generator.
//  Bold headings, markdown-aware body (**bold**, ## subheads), each AD as its own
//  spaced block, boxed legal disclaimer, page numbers. Strips garbled symbols.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // Strip emoji / icon-font / private-use / stray encoding artefacts.
  function clean(s) {
    if (!s) return "";
    return String(s)
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[\u{2600}-\u{27BF}]/gu, "")
      .replace(/[\u{E000}-\u{F8FF}]/gu, "")
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
      .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
      .replace(/[\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF\u2B00-\u2BFF]/g, "")
      .replace(/[\u2605\u2606\u25B6\u25BC\u25C0\u25C6\u25C9\u25C8\u2295\u2302\u2640\u2642\u263F\u263D\u2609\u2644\u2643\u2295]/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/%[\u00C0-\u00FF\u0080-\u00BFA-Za-z]{1,3}/g, "")  // %Ï %Ë etc
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  // Remove doubled dates like "1993-03-212011-03-21" -> keep readable range.
  function fixDates(s) {
    // collapse two ISO dates stuck together: 1993-03-212011-03-21
    return s.replace(/(\d{4}-\d{2}-\d{2})(\d{4}-\d{2}-\d{2})/g, "$1");
  }

  var C = {
    navy: [11, 14, 26], gold: [201, 168, 76], goldDk: [154, 126, 51],
    text: [38, 42, 54], dim: [120, 128, 145], sub: [90, 70, 20],
    boxbg: [248, 246, 240],
  };

  window.generateReportPDF = function (opts) {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF library not loaded. Refresh and retry."); return; }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "pt", format: "a4" });
    var W = doc.internal.pageSize.getWidth();
    var H = doc.internal.pageSize.getHeight();
    var M = 50, CW = W - 2 * M, y = 0;

    function needPage(space) { if (y > H - space) { doc.addPage(); y = M + 10; } }

    // Header band
    doc.setFillColor(C.navy[0], C.navy[1], C.navy[2]); doc.rect(0, 0, W, 76, "F");
    doc.setTextColor(C.gold[0], C.gold[1], C.gold[2]);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("AstroIndicators", M, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(180, 188, 200);
    doc.text("Horoscope & Dasa Period Indicators  .  Swiss Ephemeris  .  Lahiri Ayanamsha", M, 58);
    y = 76 + 36;

    doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(clean(opts.reportTitle) || "Your Report", M, y); y += 20;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.text("Prepared for: " + (clean(opts.userName) || "Seeker"), M, y); y += 8;
    doc.setDrawColor(C.gold[0], C.gold[1], C.gold[2]); doc.setLineWidth(1);
    doc.line(M, y, W - M, y); y += 26;

    // Render one body string with markdown awareness (**bold**, ## subhead).
    function renderBody(body) {
      body = fixDates(clean(body));
      if (!body) return;
      // Split into segments on ## subheadings (convert "## TITLE" to bold line).
      // First, normalise: turn "## X" and "**X**" markers into tokens.
      // Split on subheading markers while keeping them.
      var parts = body.split(/(?:^|\s)##\s*/); // crude: ## starts a subhead
      // If no ## present, parts has 1 element (the whole body).
      parts.forEach(function (part, idx) {
        if (!part.trim()) return;
        // For parts after the first, the leading words up to a capitalised run act as subhead.
        // Simpler: detect a leading ALLCAPS phrase as a subheading.
        var subMatch = part.match(/^([A-Z][A-Z &/]{3,40})\b/);
        if (idx > 0 && subMatch) {
          needPage(60);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10);
          doc.setTextColor(C.sub[0], C.sub[1], C.sub[2]);
          var sh = subMatch[1].trim();
          doc.text(sh, M, y); y += 14;
          part = part.slice(subMatch[1].length);
        }
        // Render remaining text, honouring **bold** inline by stripping markers
        // (jsPDF can't easily mix weights mid-line, so we bold whole sentences
        // that are fully wrapped, else strip the ** markers cleanly).
        var clean2 = part.replace(/\*\*/g, "").replace(/^\s*[:.\-]\s*/, "").trim();
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
        doc.setTextColor(C.text[0], C.text[1], C.text[2]);
        var lines = doc.splitTextToSize(clean2, CW);
        lines.forEach(function (ln) { needPage(60); doc.text(ln, M, y); y += 15; });
        y += 8;
      });
    }

    (opts.sections || []).forEach(function (sec) {
      var heading = fixDates(clean(sec.heading));
      needPage(110);

      if (sec.isMDHeading) {
        y += 8;
        doc.setFillColor(245, 240, 228);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
        var hL = doc.splitTextToSize(heading, CW - 16);
        var bandH = 14 + hL.length * 15;
        doc.rect(M, y - 12, CW, bandH, "F");
        doc.setTextColor(C.goldDk[0], C.goldDk[1], C.goldDk[2]);
        doc.text(hL, M + 8, y + 2);
        y += bandH + 6;
      } else if (sec.isAD) {
        needPage(70);
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.setTextColor(C.navy[0], C.navy[1], C.navy[2]);
        var hL2 = doc.splitTextToSize(heading.trim(), CW);
        doc.text(hL2, M, y); y += hL2.length * 14 + 4;
      } else if (sec.isTimeline) {
        // Plain timeline list line
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        doc.setTextColor(C.text[0], C.text[1], C.text[2]);
        var tl = doc.splitTextToSize(heading, CW);
        tl.forEach(function (ln) { needPage(50); doc.text(ln, M, y); y += 13; });
        return;
      } else if (sec.isDomain) {
        // Domain block: gold title, then labelled lines.
        needPage(90);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
        doc.setTextColor(C.goldDk[0], C.goldDk[1], C.goldDk[2]);
        doc.text(heading, M, y); y += 16;
        var dbody = fixDates(clean(sec.body));
        dbody.split("\n").forEach(function (lineRaw) {
          var lr = lineRaw.trim(); if (!lr) return;
          var labelMatch = lr.match(/^(Strength|Key pattern|Indication|Best period|Confidence)\s*:\s*(.*)$/i);
          if (labelMatch) {
            needPage(50);
            doc.setFont("helvetica", "bold"); doc.setFontSize(10);
            doc.setTextColor(C.sub[0], C.sub[1], C.sub[2]);
            doc.text(labelMatch[1] + ":", M, y);
            var lblW = doc.getTextWidth(labelMatch[1] + ": ");
            doc.setFont("helvetica", "normal");
            doc.setTextColor(C.text[0], C.text[1], C.text[2]);
            var vlines = doc.splitTextToSize(labelMatch[2], CW - lblW - 4);
            doc.text(vlines[0] || "", M + lblW + 4, y); y += 14;
            for (var k = 1; k < vlines.length; k++) { needPage(40); doc.text(vlines[k], M, y); y += 13; }
          } else {
            doc.setFont("helvetica", "normal"); doc.setFontSize(10);
            doc.setTextColor(C.text[0], C.text[1], C.text[2]);
            var ol = doc.splitTextToSize(lr, CW);
            ol.forEach(function (x) { needPage(40); doc.text(x, M, y); y += 13; });
          }
        });
        y += 12;
        return;
      } else {
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.setTextColor(C.goldDk[0], C.goldDk[1], C.goldDk[2]);
        var hL3 = doc.splitTextToSize(heading, CW);
        doc.text(hL3, M, y); y += hL3.length * 15 + 4;
      }
      renderBody(sec.body);
      y += 6;
    });

    // Boxed legal disclaimer
    needPage(150); y += 8;
    var disc =
      "Disclaimer: This report is provided for educational and self-reflective purposes only and constitutes " +
      "indicative astrological insight, not professional advice or a guarantee of outcomes. It is not a substitute " +
      "for medical, psychological, legal, or financial counsel. The user assumes full responsibility for any decision " +
      "made in reliance on this report, and AstroIndicators disclaims all liability to the fullest extent permitted by " +
      "law. All payments are final and non-refundable once the report is generated.";
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    var dL = doc.splitTextToSize(disc, CW - 24);
    var boxH = 18 + dL.length * 11;
    doc.setFillColor(C.boxbg[0], C.boxbg[1], C.boxbg[2]);
    doc.setDrawColor(C.dim[0], C.dim[1], C.dim[2]); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, boxH, 4, 4, "FD");
    doc.setTextColor(C.dim[0], C.dim[1], C.dim[2]);
    doc.text(dL, M + 12, y + 14); y += boxH;

    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.setTextColor(C.dim[0], C.dim[1], C.dim[2]);
      doc.text("(c) 2026 AstroIndicators  .  astroindicators.com", M, H - 26);
      doc.text("Page " + i + " of " + pages, W - M, H - 26, { align: "right" });
    }

    var safe = (clean(opts.userName) || "report").replace(/[^a-z0-9]/gi, "_");
    doc.save("AstroIndicators_" + safe + ".pdf");
  };

})();
