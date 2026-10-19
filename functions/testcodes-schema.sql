-- ─────────────────────────────────────────────────────────────────────────────
--  Test codes (payment bypass for selected users) — run ONCE in the D1 console
--  (Cloudflare → Workers & Pages → D1 → astro_paid → Console). Safe to re-run.
--
--  A code unlocks ONE report (the user's choice, excluding the domain bundle and
--  consultations) for ONE birth chart. It binds to that chart on first use; any
--  other birth details are sent to the normal payment gateway.
--  Codes are stored HASHED (SHA-256) — the plain code is shown only once, when
--  it is created on the owner page.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_codes (
  code_hash         TEXT PRIMARY KEY,          -- SHA-256 of the normalised code (+ pepper)
  code_hint         TEXT NOT NULL,             -- last 4 characters, for the owner list
  batch             TEXT NOT NULL DEFAULT '',  -- e.g. "Friends-Oct"
  note              TEXT NOT NULL DEFAULT '',  -- who you gave it to
  status            TEXT NOT NULL DEFAULT 'active',  -- active | revoked
  created_at        INTEGER NOT NULL,          -- ms since epoch
  expires_at        INTEGER NOT NULL,          -- ms since epoch (unused codes stop working)
  redeemed_chart_id TEXT,                      -- NULL until first use, then bound
  redeemed_item     TEXT,
  redeemed_at       INTEGER,
  redeemed_email    TEXT,
  redeemed_ip       TEXT
);
CREATE INDEX IF NOT EXISTS idx_test_codes_batch ON test_codes(batch);

-- Failed attempts, for rate limiting (5 failures / 15 min per IP).
CREATE TABLE IF NOT EXISTS test_code_attempts (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_code_attempts_ip ON test_code_attempts(ip, at);
