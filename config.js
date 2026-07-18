// ─────────────────────────────────────────────────────────────────────────────
//  FILE: config.js
//  AstroIndicators — Central configuration.
//  THIS IS THE ONE FILE YOU EDIT to change prices, GST, or business details.
//  No other code needs to change. Edit a number, commit, done.
// ─────────────────────────────────────────────────────────────────────────────

const APP_CONFIG = {

  // ── PRICES (in rupees, GST-INCLUSIVE) ──────────────────────────────────────
  // The number here is exactly what the customer pays. The 18% GST is calculated
  // OUT of this amount automatically for the invoice. Change any number freely.
  prices: {
    dasha:        499,   // Dasa report (Previous + Current + Next MD) — single tier
    lifeDomains:  299,   // Life Domains Indicators report
    consult30:    500,   // 30-minute consultation
    consult60:    999,   // 60-minute consultation
    lifeIndicators: 999, // Life Indicators Report (flipbook) — full engine build
    icc:          499,   // Instant Clarity Command — 3 of 10 questions
  },

  // ── GST ────────────────────────────────────────────────────────────────────
  gst: {
    rate:   18,                    // percent. Prices above are GST-INCLUSIVE.
    gstin:  "33AGRPJ4285D1ZB",     // your GST number (appears on invoices)
    state:  "Tamil Nadu",          // your registered state (code 33)
    legalName: "AstroIndicators",  // business name on the invoice
  },

  // ── RAZORPAY ─────────────────────────────────────────────────────────────────
  // Only the PUBLIC Key ID goes here. The SECRET never goes in code — it lives in
  // Cloudflare environment variables. Swap test → live key when you go live.
  razorpay: {
    keyId: "rzp_test_REPLACE_WITH_YOUR_TEST_KEY_ID",   // public key (test for now)
    businessName: "AstroIndicators",                   // shown at checkout
    themeColor: "#0B0E1A",                             // checkout accent (navy)
  },

  // ── CURRENCY ─────────────────────────────────────────────────────────────────
  currency: "INR",
  currencySymbol: "₹",
};

// Helper: split a GST-inclusive amount into taxable value + GST (for the invoice).
// Example: 399 inclusive at 18% → { taxable: 338.14, gst: 60.86, total: 399 }
function gstBreakup(inclusiveAmount, ratePercent) {
  const rate = (ratePercent != null ? ratePercent : APP_CONFIG.gst.rate) / 100;
  const taxable = inclusiveAmount / (1 + rate);
  const gst = inclusiveAmount - taxable;
  return {
    taxable: Math.round(taxable * 100) / 100,
    gst:     Math.round(gst * 100) / 100,
    total:   inclusiveAmount,
  };
}

if (typeof window !== "undefined") {
  window.APP_CONFIG = APP_CONFIG;
  window.gstBreakup = gstBreakup;
}
