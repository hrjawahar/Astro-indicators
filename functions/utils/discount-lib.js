// Shared helpers for discount codes (discount.js + order.js + verify.js).
// Lives in functions/utils/ (no onRequest exports → no route).
//
// A discount code reduces the server-side price of a REPORT purchase (it still
// goes through Razorpay — unlike a test code, which bypasses payment entirely).
// The owner sets each code's discount (percent OR fixed rupees) when creating it.

// Reports a discount code may apply to: LAMP + the 7 Domain reports + the bundle.
// NOT eligible: consultations, dasha, the old "domains"/"domain" items.
export const DISCOUNT_ELIGIBLE_ITEMS = new Set([
  "lifeIndicators",
  "domain_self", "domain_career", "domain_siblings", "domain_mother",
  "domain_children", "domain_health", "domain_marriage",
  "domain_all",
  "transit_report",
]);

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I

// Strip spaces/hyphens/case so "ai-save-7kq9m-2xpab" == "AI-SAVE-7KQ9M-2XPAB".
export function normalise(code) {
  return String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export async function hashCode(code, pepper) {
  const data = new TextEncoder().encode((pepper || "") + "|" + normalise(code));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// AI-SAVE-XXXXX-XXXXX : 10 random symbols from 32 → 50 bits of entropy.
export function newCode() {
  const r = new Uint8Array(10);
  crypto.getRandomValues(r);
  const s = [...r].map(b => ALPHABET[b & 31]).join("");
  return "AI-SAVE-" + s.slice(0, 5) + "-" + s.slice(5);
}

export function hint(code) { return normalise(code).slice(-4); }

// Constant-time string compare (for the admin key).
export function safeEqual(a, b) {
  a = String(a || ""); b = String(b || "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// Apply a discount to a base price (whole rupees in, whole rupees out).
// kind "percent" → value is a percentage (e.g. 20 = 20% off).
// kind "fixed"   → value is rupees off (e.g. 200 = ₹200 off).
// Never returns below ₹1 (Razorpay's minimum chargeable amount), never above base.
export function applyDiscount(baseRupees, kind, value) {
  const base = Math.round(Number(baseRupees) || 0);
  const v = Number(value) || 0;
  let charged;
  if (kind === "percent") {
    const pct = Math.min(Math.max(v, 0), 100);
    charged = base * (1 - pct / 100);
  } else { // fixed
    charged = base - Math.max(v, 0);
  }
  charged = Math.round(charged);
  if (charged < 1) charged = 1;        // Razorpay minimum
  if (charged > base) charged = base;  // never charge more than list price
  return charged;
}

// Short human label for a code's discount, e.g. "20% off" or "₹200 off".
export function discountLabel(kind, value) {
  const v = Number(value) || 0;
  return kind === "percent" ? (v + "% off") : ("₹" + v + " off");
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
