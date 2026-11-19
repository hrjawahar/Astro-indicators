# Engine depth upgrade — design foundations

**Status: DRAFT for owner review. No engine code changes until this is approved.**

This document sets the *foundations* of a deliberate depth upgrade to the AstroIndicators
prediction engine. It is written chart-agnostic on purpose: the validation case that
prompted it is only a **test**, never a template. No native's name, nativity, or
single-chart quirk is encoded anywhere. Every rule below is a general Vedic law with
stated formation conditions, validated against a randomised population — the same
discipline that retired the over-fit `findPrecursor`.

Companion records: `ENGINE_ROOTCAUSE_AUDIT.md` (first depth pass), `ENGINE_LOCK_VALIDATION.md`
(the freeze this upgrade deliberately reopens, then re-locks).

---

## 1. The one-line diagnosis → the one-line design

**Diagnosis.** The engine scores placements in *isolation* ("10th-lord in 4th = +2") and
reads each house from *one* angle. A seasoned practitioner reads *compound states* (a single
interaction can reverse a placement's base meaning) and reads each house from *several*
angles at once.

**Design.** Insert a **compound-state layer** and a **multi-angle house-reading layer**
*between* raw placements and domain scoring, so every later verdict consumes synthesised
states rather than raw sign/house facts.

This is not a rewrite. The engine already is the right pipeline — `analyze.js` computes
structured facts, `domain-report.js` renders them and is already barred from inventing
placements. We are deepening the middle, not replacing the ends.

---

## 2. The five design laws (these bind every rule we add)

1. **General law, not example.** Each rule is a condition over chart structure, stated
   abstractly. If a rule only makes sense for one chart, it is wrong. No native name, no
   single-chart reproduction, ever.
2. **Validated by population, not by anecdote.** A rule is accepted only after a randomised
   multi-hundred-chart run shows sane distributions (the signal fires at a believable rate,
   not on everyone and not on no one). The test chart may *confirm* a rule; it may never
   *define* one.
3. **Provenance on every state.** Every compound state carries its *why* — the classical
   rule plus the exact placements that triggered it — so it surfaces in a `» ` why-line and
   is auditable. A silent score is not allowed.
4. **Conservative on contested rules.** Where classical opinion genuinely differs (as with
   Manglik), we grade and show the method rather than issue a verdict — never overclaim.
5. **Change deliberately, then re-lock.** This upgrade *will* change some predictions, by
   design (that is the point). We make the depth changes, re-validate all seven domains,
   then re-freeze under a new lock record. The "predictions stay intact" covenant governs
   *presentation* churn after a lock — it does not forbid a sanctioned depth upgrade.

---

## 3. The layered architecture

```
Layer 0  Placements            sign · house · dignity · retrograde · degree         (exists)
            │
Layer 1  Compound-state pass   dignity modifiers · full aspects · yogas · nakshatra  (NEW)
            │                   → chart-wide, domain-agnostic derived states
Layer 2  Multi-angle house     each house read from occupants + lord + aspects +     (NEW/
            │                   karaka + derivative houses + divisional confirm        expand)
Layer 3  Domain synthesis      each domain consumes house-states + compound states    (expand)
            │                   → graded verdicts (business-lean, disruption, …)
Layer 4  Narrative             renders verified facts; compound-state provenance       (exists)
                                flows into the why-lines
```

### Layer 1 — Compound-state pass (the heart of the upgrade)

Chart-wide states computed once, before any domain scoring. Each is a flag **plus** a
strength delta **plus** provenance.

- **1a. Dignity modifiers.**
  - *Neecha Bhanga* (cancellation of debilitation): a debilitated planet whose classical
    cancellation conditions hold — e.g. its dispositor or the exaltation-lord of its sign is
    in a kendra from Lagna or Moon, or it occupies its own/exaltation sign in the navamsha —
    is reclassified from "weak" to **"resilient rise after early setback,"** not from any one
    chart but as the general rule. Exaltation and own-sign strength are scored on the same axis.
  - *Retrograde (Chesta Bala / Vakri) strength*: a retrograde planet gains motional strength;
    the house it owns and aspects is read as **protected/reinforced**, not neutral. (Today the
    engine notes "retrograde" as a flat flag and does nothing with it.)

- **1b. Full aspects (Graha Drishti) as a first-class input.** Every house evaluation ingests
  `occupants[] + aspectsReceived[] + lordPlacement{}`. The special aspects (Mars 4/8,
  Jupiter 5/9, Saturn 3/10, the nodes) are already in the `aspectsHouse` helper; this
  *elevates* them: an **empty house that receives its own lord's aspect is scored as
  strongly held, not vacant** — the general fix for "house unoccupied → treated as neutral."

- **1c. Named yogas (conjunction/combination).** A small, strictly-conditioned, extensible
  set of classical yogas, each with exact formation rules and provenance — e.g.
  *Budhaditya* (Sun + Mercury conjunct, graded by the house and by combustion), *Gaja Kesari*
  (Jupiter in a kendra from the Moon). We start with the few highest-signal, uncontested
  yogas and grow the set deliberately; a yoga fires only when its conditions are fully met.

- **1d. Nakshatra-dispositor layer (your called-out foundation).** Each planet sits in a
  nakshatra ruled by a lord. The classical precedence is: **a planet gives the results of
  its nakshatra-lord first, its house-occupancy second, its house-lordship third.** So this
  layer computes, for each domain-relevant planet, its nakshatra-lord and that lord's own
  placement/strength, and uses it to **refine the planet's effective nature** (a planet in a
  difficult sign but in the nakshatra of a strong, well-placed lord reads better than its
  sign alone suggests, and vice-versa). This is a *refinement dispositor chain*, computed
  conservatively. Esoteric per-nakshatra personality attributes are a **separate, sourced,
  later sub-pass** — the dispositor-chain mechanics come first because they are structural and
  uncontested.

### Layer 2 — Multi-angle house reading

A single `HouseState` object per relevant house, aggregating **all** angles the practitioner
uses, each with its own weight and provenance:

1. occupants (with their Layer-1 compound states),
2. the house-lord's placement and strength (with compound states),
3. aspects received — benefic/malefic, and especially the house's **own lord aspecting it**,
4. the **karaka** for that house (natural karaka + the Jaimini chara-karaka where relevant),
5. the **derivative (Bhavat Bhavam) houses** already mapped per domain (10th-from-10th, etc.),
6. **divisional confirmation** (D9/D10/D7/D3/D4 as the domain dictates).

The house's graded verdict is the *synthesis* of these angles, never one of them alone. This
is the general engine behind "read a house from multiple angles."

### Layer 3 — Domain synthesis (broaden the existing matrices)

Each domain's existing builders become consumers of the richer substrate. The generalised
rule corrections (stated as laws, not examples):

- **Commerce / trade signature** now includes, besides the 3rd/7th/11th + Mercury it already
  weighs: a **strong lord of the 8th (own/exalted) read as bulk/commodity/stored-value trade**,
  **a node in the 7th read as marketplace volume** (and as the 10th-from-10th), and the
  **Amatyakaraka's** disposition as a career/wealth driver. These are general signatures of a
  merchant/independent-trade chart, not a transcription of any one native.
- **Autonomy axis corrected.** Self-effort/independence is credited from its *proper*
  significators (a strong 3rd *house* and its genuine activation, Sun/Mars/10th-lord drive) —
  **not** from a lord that is strong for an unrelated reason. A planet's strength is credited
  to the axis it actually serves, with provenance that names *why*. (This removes the class of
  bug where a strong planet is miscredited to an axis it does not belong to.)
- The same multi-angle treatment extends to **every** domain — marriage, health, wealth,
  children, siblings, mother — not just career.

### Layer 4 — Narrative

Unchanged in contract; it simply now has richer, truthful provenance to render — e.g. a
why-line that reads "debilitated in the birth chart but cancelled in the navamsha → a
resilient rise after an early setback," which is both more accurate and more reassuring than
"under pressure."

---

## 4. Deliberately deferred (sequenced later, with guardrails)

- **Context / life-stage mode translation.** Optionally ask a few intake questions
  (employment mode, relationship status, life phase) and **translate a fixed structural fact
  into the person's real-world context** — the *same* structural signature named in the
  reader's own terms. Hard guardrail: mode **translates** a prediction, it never **fabricates**
  a different one; the underlying graded verdict is identical with or without mode. This keeps
  faith with both the compass and the predictions-intact covenant. **Open decision — see §6.**
- **Double-Transit (Jupiter + Saturn) event-timing** and deeper Gochar cross-checks: sound and
  classical, but heavier; a later phase after the natal depth is validated and re-locked.

---

## 4a. Career pilot — depth scope (owner-added, general laws)

The career pilot proves Layers 1–3 and must carry three depth capabilities, each built as a
general law with provenance and population validation — never tuned to one chart.

- **Disruption as a graded PROBABILITY, not a binary.** Each disruption window's *likelihood*
  is the convergence of independent angles, counted and shown: the planet is a genuine
  disruptor (node on the 10th / 10th-lord in a dusthana / a weak 10th-lord); the window is
  that disruptor's own sub-period (dasha–antardasha double-activation); the Mahadasha itself
  stresses career (amplify); supporting afflictions (malefic aspects on the 10th, a 6/8/12
  lord, debilitation *without* cancellation); low recovery capacity. More convergent angles →
  higher likelihood. **The Layer-1 compound states feed in as MITIGATORS**: a disruptor that
  is cancelled (Neecha Bhanga) or protected (own-lord/benefic aspect, retrograde strength)
  *lowers* the probability. Expressed as plain graded likelihood — **elevated / moderate /
  lower** — never a false-precision percentage, and always with the converging/mitigating
  factors named in a `» ` why-line. This is the honest, multi-angle version of the disruption
  read.
- **Early signals — strengthened and generalised.** An early signal is a *precursor*
  sub-period that stirs the career marketplace *before* a harder primary window (a node
  touching the career axis — the 7th as 10th-from-10th, or the 10th itself; or a short
  sub-period of the disruptor ahead of its major one). It is the chart's cue to read the
  ground and prepare. An early signal *followed by* an amplified window raises confidence that
  the pattern is real. Rendered only when genuinely present; never invented.
- **Study the career track record (chart-derived recognition, no intake needed).** Derive the
  likely career *arc and history* from the chart alone — the first-half character, the past
  fruition windows (first major step / launch), and the past testing/disruption windows —
  with enough specificity that the reader recognises their own trajectory. Cross-check the
  past-window reading against the Layer-2 house-states and Layer-1 compound states so it is a
  synthesised arc, not a list of dates. The confidence this builds ("the chart matched my
  actual history") is what makes the forward guidance credible. Always offered as "you may
  recognise," never asserted as certain fact about their past. Because it is derived purely
  from the chart, it honours the deferral of the mode/intake layer.

- **Foreign-land career (earning abroad vs. settling with permanency).** A graded reading of
  whether the chart supports a livelihood/career away from the homeland, and how settled it
  tends to be — read from multiple angles as a general law: the **12th** (distant lands,
  residence abroad) and its lord; the **9th** (long journeys, fortune far away); the **7th**
  (away from birthplace, trade across borders); the **4th** as the *pull from home* (an
  afflicted 4th or a 4th-lord carried into the 12th loosens roots and favours settling away);
  **Rahu** as the foreign karaka (and the Moon's inclination). Earning-abroad vs. merely
  travelling is decided by whether the **earning/career houses (2nd, 10th, 11th) connect to
  these foreign houses**; **permanency of settling** is decided by the **4th–12th relationship**
  (4th-lord in the 12th, a strong 12th-lord in a kendra, or a 4th/12th exchange) and its
  confirmation in the career divisional (D10). Graded (strong / moderate / mild / not
  indicated), dasha-timed (when the foreign window opens), with every placement in a `» `
  why-line. Conservative: a real tendency, never a certainty, and never a promise of a visa
  or a country.

## 4b. CONTENT NON-NEGOTIABLE — "Name, Reconcile, Translate" (all domains)

The single most important content rule, owner-locked. Every reading must let the reader
**connect while reading** — recognise their own chart in the verdict. Three obligations on
every meaningful claim:

1. **NAME the placement.** Never "a planet is strongly placed" / "sits in a powerful or
   supportive position". Always *which planet, in which house (and sign)* — e.g. "Venus in
   your 8th house", "Ketu in your 1st house". If the prose says strong/supportive/powerful, it
   must say *where*.
2. **TRANSLATE with an example.** Never bare jargon. "An earth sign" → name it and show it
   ("an earth sign like Capricorn — practical, material, built to last") and *what the chart
   therefore leans toward*. Same for air/fire/water signs, for dignities, for every house.
   Name → example → what it means → what it leans toward.
3. **RECONCILE several factors into ONE sharp verdict**, each factor named so the reader
   self-connects. The locked exemplar (shape, not content): *"Reconciling 8th-house Venus
   (bulk trade, stored value, finance) with Ketu in the 1st (institutional independence) and
   Rahu in the 7th (marketplace dealing) gives a sharp verdict: strong enterprise potential in
   advisory, finance or commodity/wholesale trade."* The reader thinks: "I have Ketu in my
   1st — that's why independence; Rahu in my 7th — that's why the marketplace."

This REFINES the earlier "keep jargon out of the prose, put placements only in why-lines"
rule: placements are now NAMED in the reading itself, but *always immediately translated*, so
naming never overwhelms. Why-lines still carry the fuller technical derivation. Never name
without translating; never claim without naming.

## 4c. Life-stage weighting (chart-derived, no intake)

The report must foreground the phase the reader is actually in. Derived from birth data (age)
+ the dasha timeline — no intake question, so it honours the deferral. A 48-year-old in an
enterprise/second-half phase wants the *current business* angle foregrounded, with the past
corporate arc compressed to a brief recognition anchor; the same chart read at 28 would
foreground the corporate/establishment angle. Weighting changes EMPHASIS and ORDER only — the
underlying predictions are unchanged (consistent with the lock principle).

## 4d. V5 career-report patch plan (from the V4 practitioner review)

Gaps to close (career pilot first, then all domains):
1. **Execution gap** — a long "hold steady" window must come with a concrete "what to actively
   build before it" checklist (liquidity reserve, low-capital pilots, formalise partnerships),
   not just "wait".
2. **Money & income blind spot (NEW engine capability)** — a "Money & Income Pattern"
   reading: the 2nd (accumulated wealth) and 11th (gains/income) houses and their lords, read
   through the house-states; names how income flows best (steady retainers / structured
   margins vs. speculation), grounded in the chart (e.g. a debilitated 2nd-lord → speculation
   fails, disciplined cash-flow mandatory).
3. **Over-repetition** — each section gets a DISTINCT JOB (identity / workplace behaviour /
   timing & decisions / closing encouragement); the closing never repeats the timing warning
   verbatim.
4. **12th-house / debilitated-lord translation** — turn "behind the scenes" into tangible
   direction: cross-border or remote/out-of-state clients, B2B backend advisory, and strict
   invoicing/payment discipline (don't undercharge). Ties into the foreign-career layer.
5. **Remedies/temple ranking** — DEFERRED: remedies are parked; precautions stay planetary-
   only. Revisit under the remedies project.

## 5. Build order (once the design is approved)

1. Compound-state pass (Layer 1a–1c): dignity modifiers, retrograde strength, full-aspect
   house-holding, the first named-yoga set. Validate on a random population.
2. `HouseState` multi-angle object (Layer 2) + wire the existing domain builders to it.
3. Broaden the domain matrices (Layer 3), career first as the worked pilot, then the other six.
4. Nakshatra-dispositor refinement (Layer 1d) as its own validated pass.
5. Re-validate all seven domains end-to-end; write the new lock record; re-freeze.
6. (Later phases) nakshatra attributes, mode translation, double-transit.

Each step is validated the moment it lands (population run + invariant checks), not at the end.

---

## 6. Open decisions for the owner

- **D1 — Mode/intake layer (§4):** build it into this upgrade, or keep the engine chart-only
  now and treat mode-translation as a clearly-separated later phase? (Default proposal: later
  phase — prove the natal depth first.)
- **D2 — Pilot vs breadth:** prove the whole Layer-1→3 approach end-to-end on the **career**
  domain first as a single worked pilot you can review, *then* roll to the other six — or build
  the compound-state pass across all domains together? (Default proposal: career pilot first.)
- **D3 — First named-yoga set:** start minimal (Budhaditya, Gaja Kesari, a couple more
  high-signal, uncontested yogas) and grow deliberately — confirm this is the right posture
  (versus a larger yoga library up front).
