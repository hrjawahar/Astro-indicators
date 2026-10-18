// Shared helpers for test codes (redeem.js + testcode.js).
// Lives in functions/utils/ (no onRequest exports → no route).

// Reports a test code may unlock. NOT allowed: "domain_all" (bundle), "consult_*".
export const ELIGIBLE_ITEMS = new Set([
  "lifeIndicators", "icc", "dasha", "lifeDomains",
  "domain_self", "domain_career", "domain_siblings", "domain_mother",
  "domain_children", "domain_health", "domain_marriage",
]);

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I

// Strip spaces/hyphens/case so "ai-test-7kq9m-2xpab" == "AI-TEST-7KQ9M-2XPAB".
export function normalise(code) {
  return String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export async function hashCode(code, pepper) {
  const data = new TextEncoder().encode((pepper || "") + "|" + normalise(code));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// AI-TEST-XXXXX-XXXXX : 10 random symbols from 32 → 50 bits of entropy.
export function newCode() {
  const r = new Uint8Array(10);
  crypto.getRandomValues(r);
  const s = [...r].map(b => ALPHABET[b & 31]).join("");
  return "AI-TEST-" + s.slice(0, 5) + "-" + s.slice(5);
}

export function hint(code) { return normalise(code).slice(-4); }

// Raw chart ids look like "cddffa19a_28" (see ui-v4.js chartId()).
export function isRawChartId(id) { return /^c[0-9a-f]{1,8}_\d{1,3}$/.test(String(id || "")); }

// Constant-time string compare (for the admin key).
export function safeEqual(a, b) {
  a = String(a || ""); b = String(b || "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
