// ─────────────────────────────────────────────────────────────────────────────
//  FILE: payments.js
//  AstroIndicators — Razorpay payment flow (frontend).
//  Opens checkout, creates the order via our secure backend, verifies the result,
//  then unlocks the paid report or confirms the consultation booking.
//
//  Works with config.js (prices) and the backend functions order.js + verify.js.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // Tracks which paid items the user has unlocked this session.
  const unlocked = {};
  if (typeof window !== "undefined") window.AI_unlocked = unlocked;

  // Main entry: start a payment. Returns a Promise that resolves on success.
  //   opts = { item, amount, label, booking? }
  window.startPayment = function (opts) {
    return new Promise(function (resolve, reject) {
      const cfg = window.APP_CONFIG;
      if (!cfg) { reject("config missing"); return; }
      if (typeof Razorpay === "undefined") { reject("Razorpay not loaded"); return; }

      // 1. Ask our backend to create an order (secret stays server-side).
      fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: opts.amount, item: opts.item }),
      })
      .then(function (r) { return r.json(); })
      .then(function (order) {
        if (!order.orderId) { reject(order.error || "order failed"); return; }

        // 2. Open Razorpay checkout.
        const rzp = new Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || "INR",
          name: cfg.razorpay.businessName,
          description: opts.label || opts.item,
          order_id: order.orderId,
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
              }),
            })
            .then(function (r) { return r.json(); })
            .then(function (v) {
              if (v.verified) {
                if (opts.item) unlocked[opts.item] = true;
                resolve({ paymentId: v.paymentId, item: opts.item });
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
