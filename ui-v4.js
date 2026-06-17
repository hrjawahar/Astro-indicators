// ─────────────────────────────────────────────────────────────────────────────
//  LANGUAGE TOGGLE WIRING.  Independent block.
//  i18n.js has a complete translation dictionary + applyLanguage(), but the
//  toggle buttons weren't calling it — so the UI stayed English. We listen at the
//  DOCUMENT level in capture phase, so the click is caught before anything can
//  swallow it, no matter which toggle set (data-setlang or data-lang) or nesting.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  function apply(code) {
    if (!code) return;
    code = code.toUpperCase();
    if (code !== "EN" && code !== "TA") return;   // only EN + TA are live
    if (typeof window.applyLanguage === "function") window.applyLanguage(code);
    try { localStorage.setItem("jyotish-lang", code); } catch (e) {}
    // Re-apply shortly after in case the engine re-renders on click.
    setTimeout(function () {
      if (typeof window.applyLanguage === "function") window.applyLanguage(code);
    }, 80);
  }

  // Single capture-phase listener: catches any click on/inside a language button.
  document.addEventListener("click", function (e) {
    var el = e.target;
    var holder = el.closest && el.closest("[data-setlang],[data-lang]");
    if (!holder) return;
    var code = holder.getAttribute("data-setlang") || holder.getAttribute("data-lang");
    if (code) apply(code);
  }, true);  // capture = true → fires before the engine's own handlers

  // Apply the saved language on load (returning Tamil user sees Tamil).
  function applySaved() {
    var saved = "EN";
    try { saved = localStorage.getItem("jyotish-lang") || "EN"; } catch (e) {}
    if (saved === "TA" && typeof window.applyLanguage === "function") window.applyLanguage("TA");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applySaved);
  } else { applySaved(); }
})();
