# AstroIndicators — Deploy Checklist & Project State
_Last updated: 2026-07-17 · after the integration build (engine → narrator → paid products)_

Keep this file in the repo root. It is the session-proof record of where the
project stands and what remains. If a new Claude session starts cold, upload
this file first, then the engine + site files.

---

## 1. What is DONE and validated

**Engine (19 modules, 5 categories)** — recovered, compiled, schema-valid.
- Regression suite passes on jawa + case-2 (bands identical to the original
  build: case-2 INDEPENDENT/WEAK/MODEST; jawa OBSTRUCTED property, HIGH
  separation, MANAGEABLE debt, CONTESTED enemies).
- `debt-exit.ts` and `enemies.ts` are rebuilt, marked provisional in
  CALIBRATION_DEBT, audited for guardrail language, regression-matched.

**Server chain (new/rewritten Cloudflare Pages Functions)**
- `functions/api/facts.js` — runs the engine on a `/api/chart` response +
  gender; returns validated facts; owner-only modules are structurally
  excluded from HTTP (no flag can expose them).
- `functions/api/engine-bundle.js` — generated ESM bundle (504 KB, under the
  1 MB function limit). Rebuild with `./build-engine.sh` after ANY engine edit.
  Never edit the bundle by hand.
- `functions/api/indicate.js` — v2 HARDENED. Rejects raw prompts (400).
  Accepts only `{ kind: "report_section"|"icc_answer", facts, name }`.
  Prompts are assembled server-side; Honest-Alert law + health/visa/legal/child
  registers live in the system prompt. Verified by test: raw prompt → 400,
  bad kind → 400, owner-only fact → 400, >3 ICC facts → 400.

**Frontend**
- `paid-products.js` — both paid products: Life Indicators flipbook
  (cache-first via `/api/report`, one narrator build, gold/navy page-turner)
  and ICC (10 questions → pick 3 → answer cards with confidence bars).
  Hook & Blur free layer on both tabs. Payment mirrors uiv4: session unlock →
  server paid-status → owner token bypass → `startPayment` with `chartId`.
- `index.html` — gender dropdown (birth form), two paid tabs, three internal
  tabs (Dasa/Domains/Summary) hidden behind `body.ai-owner`, gold/navy CSS
  (`--ai-navy #0B0E1A`, `--ai-gold #C9A44C`), `paid-products.js` include.
- `app.js` — `gender` added to `getForm()`.
- `config.js` — added `lifeIndicators: 999`, `icc: 499` (edit prices here only).

---

## 2. Deploy steps (this release)

1. Copy from `integration/` into the repo, preserving paths:
   - `paid-products.js`, `index.html`, `app.js`, `config.js` → site root
   - `functions/api/facts.js`, `functions/api/engine-bundle.js`,
     `functions/api/indicate.js` → `functions/api/`
   - Keep `adapter.ts`, `run-all.ts`, `build-engine.sh` + the whole `engine/`
     folder in the repo too (source of the bundle).
2. `git add -A && git commit -m "engine integration: facts API, hardened narrator, paid products"`
3. Cloudflare env vars (Pages → Settings → Environment variables):
   - `ANTHROPIC_API_KEY` (already set)
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys for now)
4. Verify `/api/report` (report.js) accepts `item` values
   `"lifeIndicators"` and `"icc"` for status/fetch/store. If it whitelists
   items, add both. If D1 `paid_reports` has an item CHECK constraint, extend it.
5. i18n: add Tamil strings for `nav_life_ind`, `nav_icc`, `form_gender`,
   `form_gender_hint`, `form_gender_male`, `form_gender_female`,
   `form_gender_unspec` — or accept English fallback (paid products are
   English-only by design, so fallback is acceptable at launch).

## 3. Preview test script (run on the Cloudflare preview URL, test key)

- [ ] Generate a chart (use a known birth). Gender dropdown present; pick Male.
- [ ] Open Life Indicators tab → teaser cards show real bands; timing/action
      blurred; hook line visible on the blur.
- [ ] Pay with Razorpay test card → book builds (watch one `/api/facts` call,
      one `/api/indicate` call) → pages turn; cover, category dividers,
      per-module pages with band + confidence + window.
- [ ] Reload the page, regenerate the same chart, reopen the tab → book loads
      from cache with NO new `/api/indicate` call and NO second charge.
- [ ] ICC tab → 10 questions listed with teaser hints; 4th checkbox refuses;
      pay → 3 answer cards with confidence bars.
- [ ] Sanity: `curl -X POST <preview>/api/indicate -d '{"prompt":"hi"}'`
      → 400 "Raw prompts are not accepted".
- [ ] Owner mode: set the `ai_owner` token in console → Dasa/Domains/Summary
      tabs reappear; paid products unlock without payment.
- [ ] Health/child/legal sections read correctly: no diagnosis, no promised
      outcomes, no fear tone (spot-check Health, Progeny, Litigation pages).

## 4. Known-remaining work (in order)

1. **Legacy dasa-report migration.** app.js (~lines 298/422) and
   dasa-report.js still send raw prompts to `/api/indicate` — the hardened
   endpoint now 400s them. The tabs are customer-hidden so nothing is broken
   for customers, but owner mode's Dasa report is dead until migrated to a
   structured `kind`. Do NOT weaken indicate.js to fix this.
2. **Calibration pass** (per CALIBRATION_DEBT.md). Blocked on re-supplying
   birth data for: case-1, case-4, case-5, case-6, aqu-9°, sco-19°, sag-19°,
   Neethu, Rekha, Daya, Dhanasekar, Jack. ACTION: create `engine/test_charts.json`
   with every calibration chart's birth data + known outcome and COMMIT IT —
   this is the file whose absence cost us this recovery.
3. **Flipbook page-turn animation.** Current renderer is a clean page-swap;
   the POC's 3D leaf-turn can be ported onto it as polish.
4. **PDF download of the paid book** (report-pdf.js exists for dasa; extend).
5. **Go-live:** swap `rzp_test_` → `rzp_live_` in config.js; set live
   `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in Cloudflare; re-run the full
   test script once with a real ₹1 test if desired; then update prices if
   final pricing differs (config.js only).

## 5. Standing laws (do not regress)

- Bands come from classical rules with fixed thresholds; never demoted for
  missing outcomes. Confidence = convergence, not threshold proximity.
- Timing = Vimshottari dasha; D9 = durability, never relocation of a window.
- Owner-only modules (Fidelity, Second-Marriage) never cross HTTP.
- Narrator never computes astrology; guardrail registers are server-side.
- No remedy prescriptions anywhere (schema-enforced).
- Production charts come from the app's own chart.js longitudes (Principle 11).
