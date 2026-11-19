# Systematic gap-audit — action plan (check · identify · close)

## Why this plan exists (the reframe)

Every review so far (V3 on a Pisces chart, V4, V5 on a Leo chart) has found new gaps. Reacting
to each one cannot answer the real question — *how many remain?* This plan replaces reacting
with **auditing**: a fixed, named set of gap-classes, each with a programmatic CHECK, run
against a **diverse panel of charts plus our two real anchors**, producing a coverage report.
That converts "unknown unknowns" into a **finite, countable, regression-protected checklist**.
The point is not to promise zero gaps — it is to make the gap space *bounded and shrinking*,
and to find gaps **ourselves, before a reader does**. Finding V5's gaps on a brand-new chart is
exactly the mechanism we now automate.

Anchors (ground truth, never overfit — rules stay general):
- **Anchor A** — Pisces Lagna (the first review chart).
- **Anchor B** — Leo Lagna (the V5 chart): Saturn in 1st, Sun exalted 9th, Jupiter exalted 12th,
  Venus(10L)+Mars(9L,Yogakaraka)+Mercury(2/11L) in the 8th, Moon in Shravana (6th), D9 Gemini.

## The gap taxonomy (seven classes)

**Class 1 — Correctness bugs** (the engine states something factually wrong)
- Every "Nth lord" reference must NAME the actual ruling planet in the fact, so the writer can
  never substitute the house's *occupant* for its *lord*. *(V5 Error C: "7th lord Ketu" — Ketu
  merely sits in Aquarius; the lord is Saturn. V_LORD is correct, so the fix is to name the lord
  in the engine's why-line.)*
- House→sign labels must be correct in every divisional box. *(V5 Error A: D9 gold box said
  "Gemini, 3rd house" when the 3rd from Gemini is Leo.)*
- No raw debug / array / field strings in output. *(V5 Error B: "convergences entry: …" leaked;
  earlier: camelCase field leaks.)*
- Cross-chart convergence must compare the **same significator tracked across charts**, not the
  house-numbers of two *different* lords, and must never contradict a placement shown elsewhere.
  *(V5 Error B: "10th lord in 8th in BOTH D1 and D10" contradicted the D10 Venus-in-2nd printed
  two lines above.)*

**Class 2 — Missing yogas / combinations** (a real classical factor omitted)
- **Raja Yogas** from lord conjunctions/links — above all **Dharma-Karmadhipati** (9th+10th
  lords together). *(V5 Gap 1: Mars[9L,Yogakaraka] + Venus[10L] in the 8th was read only as
  "disruption", missing a classic Raja Yoga of breakthroughs/windfalls.)*
- **Neecha Bhanga** full condition set — add "the planet exalted in the debilitation sign is
  **conjunct** the debilitated planet" (not only "in a kendra"), and surface **NB-Raja-Yoga**
  when the cancellation links wealth/career/gain lords. *(V5 Gap 4: exalted Venus conjunct
  debilitated Mercury was missed.)*
- Pancha Mahapurusha, Dhana yogas, Vipareeta Raja Yoga — audit presence/absence.

**Class 3 — Functional role & Jaimini karaka integration**
- Functional benefic/malefic *by lagna*, and the **Amatyakaraka (career karaka)** role, must
  shape period framing. *(V5 Gap 2: Saturn's Mahadasha framed only as "dismantling", missing
  that Saturn is the Amatyakaraka in the 1st aspecting its own 7th — a strong self-employment
  launch window.)*

**Class 4 — Interpretation balance** (a factor read one-sidedly)
- The 8th read as transformation/research/audit/insurance/windfall, not only "disruption"; a
  hard period's constructive face named; debilitation always paired with its cancellation.

**Class 5 — Nakshatra attributes** (the deferred esoteric sub-pass, now needed)
- The Moon's and key planets' **nakshatra sector/temperament** feeding Sector-Fit —
  e.g. Shravana → listening, counseling, teaching, media, structured service. *(V5 Gap 3:
  Sector-Fit gave only generic Venus industries, missing Shravana-Moon-in-6th advisory/service.)*

**Class 6 — Conditional-trigger / template audit** (sections shown or suppressed wrongly)
- Every section's show/suppress threshold checked against the panel. *(V5 main: "Working abroad?"
  hard-suppressed when the 10th lord lacks a 9th/12th link — but an **exalted/strong planet in
  the 12th** should trigger a Moderate/Remote-Only template: foreign clients, export, cross-border
  consulting from a home base, not relocation.)* Rule: when the engine checks a section and finds
  it genuinely absent, prefer a 1-line "checked, it's domestic/clear" note over silence.

**Class 7 — Content-writing standard** (the V5 build — verify it holds)
- Name-Reconcile-Translate adherence; no repetition; specificity; life-stage weighting.

## The method: CHECK → PANEL → IDENTIFY → CLOSE

1. **CHECK** — build an **audit harness**: one programmatic probe per gap-class per domain where
   automatable (lord-name present in every lord-fact; no `[a-z]+[A-Z]`/"entry:"/"undefined" in
   rendered strings; convergence re-verified against the named varga placement; each yoga detector
   fires on a seeded positive chart and stays quiet on a negative). Interpretive classes (4,5,7)
   get a structured rubric scored on sample facts.
2. **PANEL** — a generated panel of diverse charts (all twelve lagnas; charts seeded to contain
   each dignity, affliction and target yoga) plus Anchors A and B as ground truth.
3. **IDENTIFY** — the harness emits a **GAP REGISTER** per domain: each class marked
   covered / partial / missing, with example charts and the offending fact.
4. **CLOSE** — fix in priority order (Class 1 bugs first, then Class 2 high-value yogas, then
   3–6), re-run to green. The harness is kept as the **permanent regression gate** run before
   every re-lock, so a closed gap cannot silently reopen.

## Sequence

- **Phase 0 (done — this document):** careful study; taxonomy fixed from all reviews.
- **Phase 1 — Career deep audit:** build the harness for career, run against panel + anchors,
  produce the career gap register (the V5 findings below are its seed entries), close in priority
  order, re-run to green.
- **Phase 2 — Extend to all domains:** generalise the harness per domain (each domain's houses,
  karakas and relevant yogas), run, produce per-domain registers, close.
- **Phase 3 — Re-validate & re-lock:** full panel green; write the new lock record; the harness
  becomes the standing regression gate.

## Seed gap register — career (from the V5 review)

| # | Class | Finding | Fix |
|---|---|---|---|
| C-1 | 1 | "7th lord Ketu" — occupant named as lord | Engine names the real lord (Saturn) in every lord-fact |
| C-2 | 1 | D9 gold box sign-name wrong ("Gemini" for the 3rd) | Correct house→sign labelling in divisional boxes |
| C-3 | 1 | "convergences entry:" debug text leaked | Scrub raw array/debug strings from output |
| C-4 | 1 | "10th lord in 8th in BOTH D1 & D10" contradicts shown D10 | Convergence must track the same planet and not contradict shown facts |
| C-5 | 2 | Dharma-Karmadhipati Raja Yoga (9L+10L) missed | Add Raja-Yoga detector (lord conjunctions/links) |
| C-6 | 2 | NB via exalted-planet-conjunct missed; NB-Raja-Yoga not surfaced | Extend Neecha-Bhanga conditions + flag NB-Raja-Yoga |
| C-7 | 3 | Saturn-MD framed only as dismantling | Integrate functional role + Amatyakaraka into period framing |
| C-8 | 4 | 8th read only as disruption | Balance 8th: transformation/research/windfall |
| C-9 | 5 | Sector-Fit missed Shravana-Moon service/advisory | Nakshatra sector attributes into Sector-Fit |
| C-10 | 6 | "Working abroad?" hard-suppressed despite exalted 12th Jupiter | Remote-Only template trigger when 12th holds an exalted/strong planet |
