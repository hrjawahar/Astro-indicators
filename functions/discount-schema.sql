-- ─────────────────────────────────────────────────────────────────────────────
--  Discount codes (price reduction for selected users) — run ONCE in the D1
--  console (Cloudflare → Workers & Pages → D1 → astro_paid → Console). Safe to
--  re-run (CREATE TABLE IF NOT EXISTS).
--
--  A discount code lowers the price of a REPORT purchase (LAMP, any of the 7
--  Domain reports, or the All-Seven bundle) and still goes through Razorpay.
--  The owner sets each code's discount (percent OR fixed rupees) and expiry when
--  creating it on the owner page. Codes are stored HASHED (SHA-256 + pepper);
--  the plain code is shown only once, at creation.
--
--  Unlike a test code (one free report on one chart), a discount code applies to
--  ALL eligible reports and can be used up to `max_uses` times (NULL = unlimited
--  until it expires). Each successful, paid redemption increments uses_count and
--  is logged in discount_redemptions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_codes (
  code_hash   TEXT PRIMARY KEY,               -- SHA-256 of the normalised code (+ pepper)
  code_hint   TEXT NOT NULL,                  -- last 4 characters, for the owner list
  kind        TEXT NOT NULL DEFAULT 'percent',-- 'percent' | 'fixed'
  value       REAL NOT NULL,                  -- 20 (percent) or 200 (fixed rupees)
  batch       TEXT NOT NULL DEFAULT '',       -- e.g. "Diwali-Friends"
  note        TEXT NOT NULL DEFAULT '',       -- who you gave it to
  status      TEXT NOT NULL DEFAULT 'active',  -- active | revoked
  max_uses    INTEGER,                        -- NULL = unlimited (until expiry)
  uses_count  INTEGER NOT NULL DEFAULT 0,     -- how many paid redemptions so far
  created_at  INTEGER NOT NULL,               -- ms since epoch
  expires_at  INTEGER NOT NULL,               -- ms since epoch (code stops working after)
  last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_discount_codes_batch ON discount_codes(batch);

-- Audit log: one row per paid redemption (written by verify.js on real payment).
CREATE TABLE IF NOT EXISTS discount_redemptions (
  code_hash  TEXT NOT NULL,
  chart_id   TEXT,
  item       TEXT,
  base       REAL,     -- list price (rupees)
  charged    REAL,     -- what they actually paid (rupees)
  payment_id TEXT,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON discount_redemptions(code_hash);
