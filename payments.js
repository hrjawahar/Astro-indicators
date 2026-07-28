// ─────────────────────────────────────────────────────────────────────────────
//  FILE: payments.js
//  AstroIndicators — Razorpay payment flow (frontend).
//  Opens checkout, creates the order via our secure backend, verifies the result,
//  then unlocks the paid report or confirms the consultation booking.
//
//  Works with config.js (prices) and the backend functions order.js + verify.js.
//
//  REFERRAL & REWARD (added):
//  • The Referral ID and Mobile typed on the birth form (referral-ui.js) are
//    picked up automatically — existing callers of startPayment() need NO
//    changes. opts.referralCode / opts.mobile override if a caller passes them.
//  • Mobile from the form prefills Razorpay checkout (like email already does).
//  • On success the Promise resolves with { paymentId, item, clientCode } and,
//    if referral-ui.js is present, shows the activation message:
//    "✓ Your Client ID AI-XXXX-XXXX is now active for referrals — share it!"
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // Tracks which paid items the user has unlocked this session.
  const unlocked = {};
  if (typeof window !== "undefined") window.AI_unlocked = unlocked;

  // Read a value from opts first, then from the referral UI module if loaded.
  function fromRefUI(optVal, getterName) {
    if (optVal) return optVal;
    if (window.AIref && typeof window.AIref[getterName] === "function") {
      try { return window.AIref[getterName]() || ""; } catch (e) { return ""; }
    }
    return "";
  }

  // Main entry: start a payment. Returns a Promise that resolves on success.
  //   opts = { item, amount, label, booking?, chartId?, email?, referralCode?, mobile? }
  window.startPayment = function (opts) {
    return new Promise(function (resolve, reject) {
      const cfg = window.APP_CONFIG;
      if (!cfg) { reject("config missing"); return; }
      if (typeof Razorpay === "undefined") { reject("Razorpay not loaded"); return; }

      // window.AI_chartId is a FUNCTION in this codebase — resolve either form.
      let chartId = opts.chartId || window.AI_chartId || null;
      if (typeof chartId === "function") { try { chartId = chartId(); } catch (e) { chartId = null; } }
      chartId = chartId ? String(chartId) : null;
      const referralCode = fromRefUI(opts.referralCode, "getReferralCode");
      const mobile       = fromRefUI(opts.mobile, "getMobile");

      // 1. Ask our backend to create an order (secret stays server-side).
      //    referralCode + chartId ride along so order.js can validate the
      //    referral authoritatively and stamp it into the order notes.
      fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: opts.amount,
          item: opts.item,
          chartId: chartId,
          referralCode: referralCode,
        }),
      })
      .then(function (r) { return r.json(); })
      .then(function (order) {
        if (!order.orderId) { reject(order.error || "order failed"); return; }

        // 2. Open Razorpay checkout. Mobile from the birth form pre-populates
        //    the contact field, exactly like email — the buyer just confirms.
        const rzp = new Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || "INR",
          name: cfg.razorpay.businessName,
          description: opts.label || opts.item,
          order_id: order.orderId,
          prefill: { email: opts.email || "", contact: mobile || "" },
          theme: { color: cfg.razorpay.themeColor },
          handler: function (response) {
            // 3. Verify the payment on our backend before trusting it.
            fetch("/api/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                booking: opts.booking || null,
                chartId: chartId,                 // pay-once key for the paid-report DB record
                item:    opts.item || null,
                email:   opts.email || null,      // for the customers (invoicing) table
                mobile:  mobile || null,          // form value; verify.js falls back to
                                                  // the checkout-typed contact if blank
              }),
            })
            .then(function (r) { return r.json(); })
            .then(function (v) {
              if (v.verified) {
                if (opts.item) unlocked[opts.item] = true;
                // Referral activation message (no-op if referral-ui.js absent).
                if (v.clientCode && window.AIref && window.AIref.showActivation) {
                  try { window.AIref.showActivation(v.clientCode); } catch (e) {}
                }
                resolve({ paymentId: v.paymentId, item: opts.item, clientCode: v.clientCode || null });
              } else {
                reject(v.error || "verification failed");
              }
            })
            .catch(reject);
          },
          modal: { ondismiss: function () { reject("dismissed"); } },
        });
        rzp.open();
      })
      .catch(reject);
    });
  };

})();
