// ─────────────────────────────────────────────────────────────────────────────
//  FILE: sample-flipbook.js
//  AstroIndicators — SAMPLE flipbook for the home page ("How to use this site").
//  Shows the STRUCTURE of the paid Life Indicators report — cover, contents,
//  section dividers, and the topic HEADING on each page — with NO report content.
//  Purpose: let visitors preview what the paid report covers before they buy.
//
//  Self-contained. Injects into a host element; touches nothing in paid-products.js.
//  Wiring (1 line in index.html, after the "How to use" section):
//    <div id="sampleFlipbook"></div>
//    Add: script tag pointing to sample-flipbook.js (see INTEGRATION notes)
//  (or call AISampleBook.mount('#sampleFlipbook') yourself)
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";

  // The real report's structure (mirrors BOOK_ORDER + categories in paid-products.js).
  var SECTIONS = [
    { cat: "Career & Wealth", topics: [
      "Business vs Employment", "Career Stability", "Career Advancement",
      "Wealth Accumulation", "Property & Inheritance" ] },
    { cat: "Marriage & Relationship", topics: [
      "Love or Arranged", "Married Life", "Relationship Resilience", "Parenthood & Children" ] },
    { cat: "Mobility & Fortune", topics: [
      "Foreign Settlement", "Rise in Fortune", "Spiritual Inclination" ] },
    { cat: "Crisis, Debt & Legal", topics: [
      "Litigation & Disputes", "Debt & Repayment", "Rivals & Obstacles" ] },
    { cat: "Health & Wellbeing", topics: [
      "Vitality & Longevity", "Mind & Emotions" ] },
  ];

  // Build the ordered page list: cover → note → contents → [divider → topics…] → close.
  function buildPages() {
    var P = [];
    P.push({ type: "cover", eyebrow: "Life Indicators Report", title: "LAMP", sub: "Life Analysis &amp; Mapping Profile",
             note: "Your personalized blueprint for conscious self-reflection" });
    P.push({ type: "kick", kick: "A Note Before You Begin",
             body: "Your report opens with a personal letter — why it was built, and the two "
                 + "questions it helps you answer: <em>Why am I going through this?</em> and "
                 + "<em>How does the road ahead look?</em>" });
    P.push({ type: "kick", kick: "Birth Details &amp; Charts",
             body: "Your exact D1 (Rasi) and D9 (Navamsa) charts, planetary strengths, and life axis — "
                 + "calculated with Swiss Ephemeris &amp; Lahiri Ayanamsa." });
    P.push({ type: "kick", kick: "How D1 Deepens Into D9",
             body: "D1 shows your outer life — how the world sees you. D9 reveals the inner reality "
                 + "beneath it. Your report traces how each life area <em>strengthens or softens</em> "
                 + "from the outer chart to the inner — where surface promise is matched by real depth, "
                 + "and where it isn't." });
    // Contents page listing all categories
    var contents = SECTIONS.map(function (s) {
      return '<li><b>' + s.cat + '</b><span>' + s.topics.length + ' topics</span></li>';
    }).join("");
    P.push({ type: "contents", kick: "Contents", list: contents });
    // Each category: a divider page, then one page per topic heading
    SECTIONS.forEach(function (s, i) {
      P.push({ type: "divider", n: "0" + (i + 1), cat: s.cat, count: s.topics.length });
      s.topics.forEach(function (t) {
        P.push({ type: "topic", cat: s.cat, topic: t });
      });
    });
    P.push({ type: "kick", kick: "What To Actually Do With This",
             body: "The report closes with the few specific choices that change the most for you — "
                 + "and a closing note on awareness and acceptance." });
    P.push({ type: "close", title: "Unlock your full report",
             note: "Every topic above, written for your exact chart." });
    return P;
  }

  function pageHTML(p) {
    if (p.type === "cover")
      return '<div class="sfb-pg sfb-cover"><div class="sfb-frame"></div><div class="sfb-in">'
           + '<div class="sfb-logo">◈</div>'
           + '<div class="sfb-eyebrow">' + p.eyebrow + '</div>'
           + '<div class="sfb-title">' + p.title + '</div>'
           + '<div class="sfb-sub">' + p.sub + '</div><div class="sfb-note">' + p.note + '</div>'
           + '<div class="sfb-tag">Sample — structure only</div></div></div>';
    if (p.type === "close")
      return '<div class="sfb-pg sfb-cover sfb-closepg"><div class="sfb-frame"></div><div class="sfb-in">'
           + '<div class="sfb-logo">◈</div><div class="sfb-title2">' + p.title + '</div>'
           + '<div class="sfb-note">' + p.note + '</div>'
           + '<a class="sfb-cta" href="#birthForm" onclick="try{document.getElementById(\'birthForm\')?.scrollIntoView({behavior:\'smooth\'});}catch(e){}">Generate your chart →</a>'
           + '<div class="sfb-ctasub">then get your <b>Life Indicators Report</b></div>'
           + '</div></div>';
    if (p.type === "contents")
      return '<div class="sfb-pg"><div class="sfb-kick">' + p.kick + '</div><div class="sfb-rule"></div>'
           + '<ul class="sfb-contents">' + p.list + '</ul>'
           + '<div class="sfb-foot">Full report • 5 life areas • 17 topics</div></div>';
    if (p.type === "divider")
      return '<div class="sfb-pg sfb-divider"><div class="sfb-in">'
           + '<div class="sfb-dn">' + p.n + '</div><div class="sfb-dcat">' + p.cat + '</div>'
           + '<div class="sfb-dcount">' + p.count + ' topics</div></div></div>';
    if (p.type === "topic")
      return '<div class="sfb-pg"><div class="sfb-kick">' + p.cat + '</div><div class="sfb-rule"></div>'
           + '<div class="sfb-topic">' + p.topic + '</div>'
           + '<div class="sfb-lock">🔒 Written for your chart in the full report</div>'
           + '<div class="sfb-lines"><span></span><span></span><span></span><span></span></div></div>';
    // kick (generic heading page)
    return '<div class="sfb-pg"><div class="sfb-kick">' + p.kick + '</div><div class="sfb-rule"></div>'
         + '<div class="sfb-body">' + p.body + '</div></div>';
  }

  var CSS =
    '.sfb-wrap{--gold:#C9A44C;--ink:#0b0c1a;--paper:#0f1024;--edge:rgba(201,164,76,.35);'
    + 'max-width:440px;margin:22px auto;font-family:Georgia,"Times New Roman",serif;color:#e8e4d8}'
    + '.sfb-head{text-align:center;margin-bottom:10px}'
    + '.sfb-head h4{margin:0;font-size:15px;letter-spacing:.02em;color:var(--gold)}'
    + '.sfb-head p{margin:3px 0 0;font-size:12px;opacity:.7}'
    + '.sfb-stage{perspective:1600px;position:relative}'
    + '.sfb-book{position:relative;width:100%;aspect-ratio:3/4;transform-style:preserve-3d}'
    + '.sfb-pg{position:absolute;inset:0;background:linear-gradient(145deg,var(--paper),var(--ink));'
    + 'border:1px solid var(--edge);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.45);'
    + 'padding:26px 24px;box-sizing:border-box;overflow:hidden;backface-visibility:hidden}'
    + '.sfb-leaf{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:left center;'
    + 'transition:transform .62s cubic-bezier(.4,.0,.2,1)}'
    + '.sfb-leaf .sfb-face{position:absolute;inset:0;backface-visibility:hidden}'
    + '.sfb-leaf .sfb-back{transform:rotateY(180deg)}'
    + '.sfb-kick{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);opacity:.9}'
    + '.sfb-rule{height:1px;background:linear-gradient(90deg,var(--gold),transparent);margin:8px 0 16px}'
    + '.sfb-topic{font-size:24px;line-height:1.25;margin-top:8px}'
    + '.sfb-lock{margin-top:14px;font-size:11.5px;color:var(--gold);opacity:.85;font-style:italic}'
    + '.sfb-lines{margin-top:18px;display:flex;flex-direction:column;gap:9px}'
    + '.sfb-lines span{height:7px;border-radius:4px;background:rgba(232,228,216,.08)}'
    + '.sfb-lines span:nth-child(1){width:92%}.sfb-lines span:nth-child(2){width:98%}'
    + '.sfb-lines span:nth-child(3){width:85%}.sfb-lines span:nth-child(4){width:70%}'
    + '.sfb-body{font-size:14px;line-height:1.65;opacity:.85;margin-top:4px}'
    + '.sfb-contents{list-style:none;padding:0;margin:6px 0 0}'
    + '.sfb-contents li{display:flex;justify-content:space-between;align-items:baseline;'
    + 'padding:11px 0;border-bottom:1px dashed rgba(201,164,76,.2);font-size:15px}'
    + '.sfb-contents li span{font-size:11px;opacity:.6;letter-spacing:.04em}'
    + '.sfb-foot{position:absolute;bottom:20px;left:24px;right:24px;text-align:center;font-size:11px;opacity:.55}'
    + '.sfb-cover{display:flex;align-items:center;justify-content:center;text-align:center;'
    + 'background:radial-gradient(120% 90% at 50% 20%,#171834,#0a0b17)}'
    + '.sfb-frame{position:absolute;inset:12px;border:1px solid var(--edge);border-radius:5px;pointer-events:none}'
    + '.sfb-in{position:relative}'
    + '.sfb-logo{font-size:34px;color:var(--gold);margin-bottom:12px}'
    + '.sfb-title{font-size:40px;letter-spacing:.16em;color:var(--gold);font-weight:600}'
    + '.sfb-eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#e8e4d8;opacity:.75;margin-bottom:14px}'
    + '.sfb-ctasub{margin-top:12px;font-size:12.5px;opacity:.75;font-style:italic}'
    + '.sfb-title2{font-size:26px;color:var(--gold);margin-bottom:8px}'
    + '.sfb-sub{font-size:12.5px;letter-spacing:.05em;opacity:.85;margin-top:6px}'
    + '.sfb-note{font-size:12px;opacity:.65;margin-top:14px;font-style:italic;line-height:1.5}'
    + '.sfb-tag{margin-top:18px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.5}'
    + '.sfb-divider{display:flex;align-items:center;justify-content:center;text-align:center;'
    + 'background:radial-gradient(120% 90% at 50% 30%,#15162e,#0b0c1a)}'
    + '.sfb-dn{font-size:34px;color:var(--gold);opacity:.5;font-weight:600}'
    + '.sfb-dcat{font-size:23px;margin-top:6px;letter-spacing:.02em}'
    + '.sfb-dcount{font-size:12px;opacity:.6;margin-top:8px;letter-spacing:.05em}'
    + '.sfb-cta{display:inline-block;margin-top:18px;padding:11px 22px;background:var(--gold);color:#111;'
    + 'text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;font-family:system-ui,sans-serif}'
    + '.sfb-controls{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:14px}'
    + '.sfb-nav{width:40px;height:40px;border-radius:50%;border:1px solid var(--edge);background:transparent;'
    + 'color:var(--gold);font-size:20px;cursor:pointer;line-height:1}'
    + '.sfb-nav:disabled{opacity:.3;cursor:default}'
    + '.sfb-dots{display:flex;gap:5px;flex-wrap:wrap;max-width:60%;justify-content:center}'
    + '.sfb-dot{width:6px;height:6px;border-radius:50%;background:rgba(201,164,76,.3);cursor:pointer}'
    + '.sfb-dot.on{background:var(--gold)}'
    + '.sfb-hint{text-align:center;font-size:11px;opacity:.5;margin-top:8px;font-family:system-ui,sans-serif}';

  var pages, idx = 0, animating = false, host;

  function mount(sel) {
    host = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!host) return;
    if (!document.getElementById("sfb-css")) {
      var st = document.createElement("style"); st.id = "sfb-css"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    pages = buildPages(); idx = 0;
    host.classList.add("sfb-wrap");
    host.innerHTML =
      '<div class="sfb-head"><h4>Preview: what your report covers</h4>'
      + '<p>A sample of the paid Life Indicators report — topics only, no readings.</p></div>'
      + '<div class="sfb-stage"><div class="sfb-book" id="sfbBook">'
      + '<div class="sfb-pg" id="sfbStatic"></div>'
      + '<div class="sfb-leaf" id="sfbLeaf"><div class="sfb-face" id="sfbFront"></div>'
      + '<div class="sfb-face sfb-back" id="sfbBack"></div></div></div></div>'
      + '<div class="sfb-controls"><button class="sfb-nav" id="sfbPrev">‹</button>'
      + '<div class="sfb-dots" id="sfbDots"></div>'
      + '<button class="sfb-nav" id="sfbNext">›</button></div>'
      + '<div class="sfb-hint">Tap the arrows or dots to flip through</div>';
    document.getElementById("sfbPrev").onclick = prev;
    document.getElementById("sfbNext").onclick = next;
    // swipe
    var sx = 0, book = document.getElementById("sfbBook");
    book.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    book.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    });
    render();
  }

  function render() {
    document.getElementById("sfbStatic").innerHTML = pageHTML(pages[idx]);
    var dots = pages.map(function (_, i) {
      return '<span class="sfb-dot ' + (i === idx ? "on" : "") + '" data-i="' + i + '"></span>';
    }).join("");
    var dc = document.getElementById("sfbDots");
    dc.innerHTML = dots;
    Array.prototype.forEach.call(dc.children, function (d) {
      d.onclick = function () { var t = +d.dataset.i; if (t !== idx) jump(t); };
    });
    document.getElementById("sfbPrev").disabled = idx === 0;
    document.getElementById("sfbNext").disabled = idx === pages.length - 1;
  }

  function next() { if (!animating && idx < pages.length - 1) flip(idx + 1, true); }
  function prev() { if (!animating && idx > 0) flip(idx - 1, false); }
  function jump(t) { if (!animating) flip(t, t > idx); }

  function flip(target, fwd) {
    animating = true;
    var leaf = document.getElementById("sfbLeaf");
    var front = document.getElementById("sfbFront");
    var back = document.getElementById("sfbBack");
    var stat = document.getElementById("sfbStatic");
    if (fwd) {
      front.innerHTML = pageHTML(pages[idx]);
      back.innerHTML = pageHTML(pages[target]);
      stat.innerHTML = pageHTML(pages[target]);
      leaf.style.transition = "none"; leaf.style.transform = "rotateY(0deg)";
      leaf.style.display = "block";
      requestAnimationFrame(function () {
        leaf.style.transition = ""; leaf.style.transform = "rotateY(-180deg)";
      });
    } else {
      front.innerHTML = pageHTML(pages[target]);
      back.innerHTML = pageHTML(pages[idx]);
      stat.innerHTML = pageHTML(pages[idx]);
      leaf.style.transition = "none"; leaf.style.transform = "rotateY(-180deg)";
      leaf.style.display = "block";
      requestAnimationFrame(function () {
        leaf.style.transition = ""; leaf.style.transform = "rotateY(0deg)";
      });
    }
    setTimeout(function () {
      idx = target; leaf.style.display = "none"; animating = false; render();
    }, 640);
  }

  window.AISampleBook = { mount: mount };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { var h = document.getElementById("sampleFlipbook"); if (h) mount(h); });
  else { var h = document.getElementById("sampleFlipbook"); if (h) mount(h); }
})();
