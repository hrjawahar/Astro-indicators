/* AstroIndicators — real .docx export (replaces the old HTML-renamed-to-.doc files).
 *
 * WHY: the old Word downloads were HTML pages saved as ".doc" (application/msword).
 * Desktop Word converts them silently, but phone viewers (WhatsApp preview,
 * Google Docs, WPS, Word mobile) read them as binary Word-97 files and decode the
 * UTF-8 text wrongly — Tamil arrives as garbled letters. Google Translate's
 * document upload also expects .docx, not .doc. A genuine Office Open XML .docx
 * fixes both.
 *
 * No libraries. Converts the simple HTML our report builders already produce
 * (h1–h4, p, div, b/strong, i/em, span colour, br, ul/ol/li, table, hr) into
 * WordprocessingML and zips it (STORE + CRC-32).
 *
 *   AI_DOCX.downloadHTML(html, "AstroIndicators_Name_TA.docx")
 *   AI_DOCX.translateUrl("TA")       -> Google Translate (Documents) link
 *   AI_DOCX.translateTipHTML("TA")   -> the 💡 tip with a clickable link
 */
(function (root) {
  "use strict";

  // ───────────────────────── ZIP (STORE) ─────────────────────────
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  var enc = new TextEncoder();
  function u16(v) { return [v & 255, (v >>> 8) & 255]; }
  function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  function zip(files) {
    var parts = [], cen = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f.name), d = enc.encode(f.data), c = crc32(d);
      var lh = new Uint8Array([].concat([80, 75, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(d.length), u32(d.length), u16(nm.length), u16(0)));
      parts.push(lh, nm, d);
      cen.push(new Uint8Array([].concat([80, 75, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(d.length), u32(d.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += lh.length + nm.length + d.length;
    });
    var cs = cen.reduce(function (s, x) { return s + x.length; }, 0);
    var all = parts.concat(cen, [new Uint8Array([].concat([80, 75, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length), u32(cs), u32(off), u16(0)))]);
    var out = new Uint8Array(all.reduce(function (s, x) { return s + x.length; }, 0)), p = 0;
    all.forEach(function (x) { out.set(x, p); p += x.length; });
    return out;
  }

  // ───────────────────────── XML helpers ─────────────────────────
  function x(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F﻿]/g, "");
  }
  function hex(c) {
    if (!c) return "";
    c = String(c).trim().toLowerCase();
    var m = c.match(/^#([0-9a-f]{6})$/); if (m) return m[1].toUpperCase();
    m = c.match(/^#([0-9a-f]{3})$/); if (m) return (m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2]).toUpperCase();
    m = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return [m[1], m[2], m[3]].map(function (v) { return ("0" + (+v).toString(16)).slice(-2); }).join("").toUpperCase();
    return "";
  }
  function css(el) {
    var o = {}, s = (el.getAttribute && el.getAttribute("style")) || "";
    s.split(";").forEach(function (d) { var i = d.indexOf(":"); if (i > 0) o[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); });
    return o;
  }
  function ptSize(v) { var m = /([\d.]+)\s*pt/.exec(v || ""); return m ? Math.round(parseFloat(m[1]) * 2) : 0; }

  function runXml(text, f) {
    if (!text) return "";
    var rp = (f.b ? "<w:b/><w:bCs/>" : "") + (f.i ? "<w:i/><w:iCs/>" : "") +
      (f.color ? "<w:color w:val=\"" + f.color + "\"/>" : "") +
      (f.sz ? "<w:sz w:val=\"" + f.sz + "\"/><w:szCs w:val=\"" + f.sz + "\"/>" : "");
    return "<w:r>" + (rp ? "<w:rPr>" + rp + "</w:rPr>" : "") + "<w:t xml:space=\"preserve\">" + x(text) + "</w:t></w:r>";
  }
  var BR = "<w:r><w:br/></w:r>";
  var BOX = ["top", "left", "bottom", "right"].map(function (s) { return "<w:" + s + " w:val=\"single\" w:sz=\"6\" w:space=\"6\" w:color=\"C9A84C\"/>"; }).join("");
  function pXml(runs, p) {
    var pp = "";
    if (p.border) pp += "<w:pBdr>" + p.border + "</w:pBdr>";
    if (p.shade) pp += "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"" + p.shade + "\"/>";
    pp += "<w:spacing w:before=\"" + (p.before || 0) + "\" w:after=\"" + (p.after == null ? 140 : p.after) + "\"/>";
    if (p.indent) pp += "<w:ind w:left=\"" + p.indent + "\"/>";
    if (p.center) pp += "<w:jc w:val=\"center\"/>";
    return "<w:p><w:pPr>" + pp + "</w:pPr>" + (p.pageBreak ? "<w:r><w:br w:type=\"page\"/></w:r>" : "") + runs + "</w:p>";
  }

  // ───────────────────────── HTML → WordprocessingML ─────────────────────────
  var HEAD = {
    H1: { b: 1, sz: 32, color: "1A2A4A", before: 240, after: 120 },
    H2: { b: 1, sz: 26, color: "5A3E00", before: 280, after: 100, rule: 1 },
    H3: { b: 1, sz: 24, color: "1A2A4A", before: 200, after: 80 },
    H4: { b: 1, sz: 22, color: "1A2A4A", before: 160, after: 60 },
  };
  var BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|TABLE|HR|SECTION|ARTICLE|HEADER|FOOTER|BLOCKQUOTE|CENTER)$/;
  var SKIP = /^(SCRIPT|STYLE|HEAD|TITLE|META|LINK|NOSCRIPT|BUTTON|SVG|IMG)$/;

  function inlineRuns(node, f) {
    var out = "";
    node.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { out += runXml(n.nodeValue.replace(/\s+/g, " "), f); return; }
      if (n.nodeType !== 1 || SKIP.test(n.tagName)) return;
      if (n.tagName === "BR") { out += BR; return; }
      var s = css(n), g = { b: f.b, i: f.i, color: f.color, sz: f.sz };
      if (/^(B|STRONG|TH)$/.test(n.tagName) || /bold|[6-9]00/.test(s["font-weight"] || "")) g.b = 1;
      if (/^(I|EM)$/.test(n.tagName) || s["font-style"] === "italic") g.i = 1;
      if (hex(s.color)) g.color = hex(s.color);
      if (ptSize(s["font-size"])) g.sz = ptSize(s["font-size"]);
      out += inlineRuns(n, g);
    });
    return out;
  }
  function hasBlockChild(el) {
    for (var i = 0; i < el.children.length; i++) if (BLOCK.test(el.children[i].tagName)) return true;
    return false;
  }
  function tableXml(t) {
    var rows = Array.prototype.filter.call(t.querySelectorAll("tr"), function (r) { return r.closest("table") === t; });
    if (!rows.length) return "";
    var cols = Math.max.apply(null, rows.map(function (r) { return r.children.length; })) || 1;
    var w = Math.floor(9600 / cols);
    var b = ["top", "left", "bottom", "right", "insideH", "insideV"].map(function (s) { return "<w:" + s + " w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D9CFB4\"/>"; }).join("");
    var xml = "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders>" + b + "</w:tblBorders>" +
      "<w:tblCellMar><w:left w:w=\"100\" w:type=\"dxa\"/><w:right w:w=\"100\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid>";
    for (var c = 0; c < cols; c++) xml += "<w:gridCol w:w=\"" + w + "\"/>";
    xml += "</w:tblGrid>";
    rows.forEach(function (r) {
      xml += "<w:tr>";
      var cells = Array.prototype.slice.call(r.children);
      for (var c = 0; c < cols; c++) {
        var cell = cells[c], th = cell && cell.tagName === "TH";
        var runs = cell ? inlineRuns(cell, { b: th ? 1 : 0 }) : "";
        xml += "<w:tc><w:tcPr><w:tcW w:w=\"" + w + "\" w:type=\"dxa\"/>" + (th ? "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F3EBD3\"/>" : "") +
          "</w:tcPr><w:p><w:pPr><w:spacing w:before=\"40\" w:after=\"40\"/></w:pPr>" + runs + "</w:p></w:tc>";
      }
      xml += "</w:tr>";
    });
    return xml + "</w:tbl>" + pXml("", { after: 120 });
  }
  function blocks(el, ctx) {
    var out = "", pending = null; // gathers loose inline content between blocks
    function flush() {
      if (!pending) return;
      var runs = inlineRuns(pending, { color: ctx.color });
      if (runs.replace(/<[^>]+>/g, "").trim() || runs.indexOf("<w:br/>") >= 0) out += pXml(runs, ctx.para({}));
      pending = null;
    }
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) { pending = pending || el.ownerDocument.createElement("span"); pending.appendChild(n.cloneNode()); } return; }
      if (n.nodeType !== 1 || SKIP.test(n.tagName)) return;
      if (!BLOCK.test(n.tagName)) { pending = pending || el.ownerDocument.createElement("span"); pending.appendChild(n.cloneNode(true)); return; }
      flush();
      var s = css(n), center = s["text-align"] === "center" || n.tagName === "CENTER" || ctx.center;
      var cls = " " + (n.getAttribute("class") || "") + " ";
      if (/ pb /.test(cls) || /always/.test(s["page-break-before"] || "")) { out += pXml("", { pageBreak: 1, after: 0 }); }
      if (n.tagName === "HR") { out += pXml("", { border: "<w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"C9A84C\"/>", after: 160 }); return; }
      if (n.tagName === "TABLE") { out += tableXml(n); return; }
      if (HEAD[n.tagName]) {
        var h = HEAD[n.tagName], col = hex(s.color) || h.color;
        out += pXml(inlineRuns(n, { b: 1, sz: ptSize(s["font-size"]) || h.sz, color: col }),
          { before: h.before, after: h.after, center: center, border: h.rule && !center ? "<w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"2\" w:color=\"C9A84C\"/>" : "" });
        return;
      }
      if (n.tagName === "UL" || n.tagName === "OL") {
        var k = 0;
        Array.prototype.forEach.call(n.children, function (li) {
          if (li.tagName !== "LI") return; k++;
          out += pXml(runXml(n.tagName === "OL" ? k + ". " : "• ", {}) + inlineRuns(li, {}), { indent: 360, after: 80 });
        });
        return;
      }
      var boxed = !!(s.border || s["background"] || s["background-color"]);
      var sub = {
        color: hex(s.color) || ctx.color, center: center,
        para: function (p) {
          p = ctx.para(p);
          if (boxed) { p.border = BOX; p.shade = hex(s["background"] || s["background-color"]) || "FDF6E3"; }
          if (center) p.center = 1;
          if (/padding-left/.test(n.getAttribute("style") || "")) p.indent = 360;
          return p;
        }
      };
      if (n.tagName === "DIV" || n.tagName === "SECTION" || n.tagName === "ARTICLE" || n.tagName === "HEADER" ||
          n.tagName === "FOOTER" || n.tagName === "BLOCKQUOTE" || n.tagName === "CENTER") {
        if (hasBlockChild(n)) { out += blocks(n, sub); return; }
      }
      var fmt = { color: sub.color, sz: ptSize(s["font-size"]) };
      if (/bold|[6-9]00/.test(s["font-weight"] || "")) fmt.b = 1;
      var runs = inlineRuns(n, fmt);
      if (runs) out += pXml(runs, sub.para({}));
    });
    flush();
    return out;
  }

  var TAG = { ta: "ta-IN", te: "te-IN", hi: "hi-IN", kn: "kn-IN", ml: "ml-IN" };
  function detectLang(text) {
    if (/[஀-௿]/.test(text)) return "ta";
    if (/[ఀ-౿]/.test(text)) return "te";
    if (/[ಀ-೿]/.test(text)) return "kn";
    if (/[ഀ-ൿ]/.test(text)) return "ml";
    if (/[ऀ-ॿ]/.test(text)) return "hi";
    return "";
  }
  function stylesXml(bidi) {
    // Indic scripts are "complex script" in Word: w:cs chooses their font.
    // Nirmala UI ships with Windows; phones fall back to their own Indic fonts.
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:docDefaults><w:rPrDefault><w:rPr>" +
      "<w:rFonts w:ascii=\"Nirmala UI\" w:hAnsi=\"Nirmala UI\" w:eastAsia=\"Nirmala UI\" w:cs=\"Nirmala UI\"/>" +
      "<w:sz w:val=\"22\"/><w:szCs w:val=\"22\"/><w:lang w:val=\"en-IN\"" + (bidi ? " w:bidi=\"" + bidi + "\"" : "") + "/>" +
      "</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line=\"336\" w:lineRule=\"auto\"/></w:pPr></w:pPrDefault></w:docDefaults>" +
      "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/></w:style></w:styles>";
  }
  var CT = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
    "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>" +
    "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/></Types>";
  var RELS = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>";
  var DOC_RELS = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>";

  function buildFromHTML(html, opt) {
    opt = opt || {};
    var P = opt.DOMParser || root.DOMParser;
    var doc = new P().parseFromString(String(html).replace(/^﻿/, ""), "text/html");
    var body = blocks(doc.body, { color: "", center: false, para: function (p) { return p; } }) || pXml("", {});
    var lang = (opt.lang || "").toLowerCase(); if (lang === "ka") lang = "kn";
    var bidi = TAG[lang] || TAG[detectLang(doc.body.textContent || "")] || "";
    var docXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>" + body +
      "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1134\" w:header=\"709\" w:footer=\"709\" w:gutter=\"0\"/></w:sectPr></w:body></w:document>";
    return zip([
      { name: "[Content_Types].xml", data: CT }, { name: "_rels/.rels", data: RELS },
      { name: "word/_rels/document.xml.rels", data: DOC_RELS },
      { name: "word/styles.xml", data: stylesXml(bidi) }, { name: "word/document.xml", data: docXml },
    ]);
  }

  var MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  function downloadHTML(html, fileName, opt) {
    var name = String(fileName || "AstroIndicators_report").replace(/\.docx?$/i, "").replace(/[^A-Za-z0-9_\-]+/g, "_") + ".docx"; // ASCII-only: survives WhatsApp
    var blob = new Blob([buildFromHTML(html, opt)], { type: MIME });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000); // late revoke: some phones read the blob after click()
    return name;
  }

  // ───────────────────────── Google Translate tip ─────────────────────────
  var GT = { TA: "ta", TE: "te", HI: "hi", KA: "kn", KN: "kn", ML: "ml" };
  function appLang() { try { return (localStorage.getItem("jyotish-lang") || window._currentLang || "EN").toUpperCase(); } catch (e) { return "EN"; } }
  function translateUrl(lang) { return "https://translate.google.co.in/?sl=en&tl=" + (GT[(lang || appLang()).toUpperCase()] || "ta") + "&op=docs"; }
  function translateTipHTML(lang) {
    return "💡 Tip: download as <b>Word</b>, then " +
      "<a href=\"" + translateUrl(lang) + "\" target=\"_blank\" rel=\"noopener\" class=\"gt-tip-link\" style=\"color:inherit;font-weight:700;text-decoration:underline\">open Google Translate&nbsp;↗</a>" +
      " → upload the file → <b>Download translation</b> to read it in your own language." +
      "<br><small style=\"opacity:.85\">On a phone? In Chrome tap ⋮ → <b>Desktop site</b> first — Google shows document upload only in desktop view.</small>";
  }

  var api = { buildFromHTML: buildFromHTML, downloadHTML: downloadHTML, translateUrl: translateUrl, translateTipHTML: translateTipHTML, MIME: MIME };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AI_DOCX = api;
})(typeof window !== "undefined" ? window : globalThis);
