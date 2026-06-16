// ─────────────────────────────────────────────────────────────────────────────
//  LANGUAGE TOGGLE WIRING.  Independent block.
//  i18n.js has a complete translation dictionary + applyLanguage(), but the
//  toggle buttons weren't calling it — so the UI stayed English. This wires BOTH
//  button sets (data-setlang and data-lang) to call applyLanguage on click, and
//  applies the saved language on load. EN + TA are the live languages.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  function codeOf(el) {
    return (el.getAttribute("data-setlang") || el.getAttribute("data-lang") || "").toUpperCase();
  }
  function apply(code) {
    if (!code) return;
    if (typeof window.applyLanguage === "function") {
      window.applyLanguage(code);
    }
    try { localStorage.setItem("jyotish-lang", code); } catch (e) {}
  }
  function wire() {
    try {
      document.querySelectorAll("[data-setlang],[data-lang]").forEach(function (el) {
        if (el.dataset.langWired) return;
        var code = codeOf(el);
        if (code !== "EN" && code !== "TA") return;   // only EN + TA are live
        el.dataset.langWired = "1";
        el.addEventListener("click", function (e) {
          // Let the engine's own handler (if any) run too; we just ensure apply.
          apply(code);
          // Re-apply shortly after, in case the engine re-rendered after click.
          setTimeout(function () { apply(code); }, 60);
        });
      });
    } catch (e) {}
  }
  // Apply the saved language on load (so a returning Tamil user sees Tamil).
  function applySaved() {
    var saved = "EN";
    try { saved = localStorage.getItem("jyotish-lang") || "EN"; } catch (e) {}
    if (saved === "TA" && typeof window.applyLanguage === "function") {
      window.applyLanguage("TA");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { wire(); applySaved(); });
  } else { wire(); applySaved(); }
  setInterval(wire, 1000);   // re-wire if the toggle re-renders
})();
