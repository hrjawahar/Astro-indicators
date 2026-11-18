# Engine root-cause audit — why the career disruption was missed, and what it reveals across all domains

**Question that triggered this audit (owner):** *"Why couldn't the engine predict the career
disruption — the 10th lord Venus running its antardasha while sitting in the 8th — and the
early signals from the previous Ketu antardasha sitting in the 7th (the partnership house)?
If these are classical rules, the engine should have produced them without my real-life
example. Find the root cause, apply the methodology to all domains."*

Every finding below is **validated against the live engine**, not reasoned from memory. The
test chart used throughout: **Capricorn Lagna → 10th = Libra (Venus) → Venus (10th lord) in
the 8th (Leo) → Ketu in the 7th (Cancer) → Moon (7th lord) in the 2nd.** The career break
runs in a **Venus antardasha inside a Moon Mahadasha**, with the **Ketu antardasha
immediately before it** (Ketu always precedes Venus in the Vimshottari order — the real
case's adjacency is structural, not coincidental).

---

## Executive summary

The engine *knew* the disruptor was there — it tagged Venus (10th lord in the 8th) as a
**significant** career disruptor. It still produced **zero windows**. The cause is not a
missing rule; it is a **gate that silences a correctly-detected rule**.

Four root-cause classes, in order of severity:

| # | Root cause | Scope | Status |
|---|------------|-------|--------|
| **RC1** | The bespoke career detector re-introduced an **MD-relevance gate** that the general engine had already identified and removed — so a 10th-lord antardasha inside an unrelated Mahadasha is dropped entirely | **Career only** (regression) | the headline bug |
| **RC2** | **Valence is computed but not propagated** — the engine knows a period is a *stressor* yet still labels it neutrally/positively; and the career grading mistakes "the Mahadasha *activates* career" for "the Mahadasha *stresses* career" (opposite effects) | **All domains** | systemic |
| **RC3** | **No derivative-house (bhāvat bhāvam) layer** — the 7th as the 10th-from-10th is invisible, so Ketu-in-7th is not a career signal at all; it was only ever caught by an over-fit patch | **All domains** | systemic |
| **RC4** | **Past-event recognition is limited to the current Mahadasha** — a major disruption in a *prior* Mahadasha is never surfaced for the reader to recognise | **All domains** | systemic |

The over-fit `findPrecursor` (the early-signal patch built from the real case) is a symptom
of RC3, and it is **fragile**: it only runs when a significant window already exists, which
RC1 had already suppressed — so for the real case it never fired anyway.

---

## Part 1 — The validated trace

Running the current engine on the test chart:

```
prone: true
disruptors: Venus (your 10th lord (career ruler), significant)   ← rule fired correctly
PAST windows: []          ← nothing
UPCOMING windows: []      ← nothing
```

Meanwhile the **general** timing engine, on the same chart, surfaces the exact period:

```
keyWindows: … "2020–2021 Moon/Venus" …   ← the Venus antardasha IS seen here
```

So the engine simultaneously (a) identifies Venus-in-8th as a significant disruptor and
(b) sees the 2020–2021 Venus period — yet the disruption report shows nothing, because the
two facts are computed in **two different subsystems that disagree**.

---

## Part 2 — Root causes, each validated

### RC1 — The MD-relevance gate (career regression)

`buildCareerDisruptions` (analyze.js ~L2674):

```js
const link = mdCareerLink(md.lord);
if (link === "none") continue;        // ← skips the ENTIRE Mahadasha
```

`mdCareerLink(Moon)` returns `"none"` because Moon is the 7th lord, is not in the 10th, and
does not aspect the 10th. So the whole Moon Mahadasha — which contains both the Venus break
and the Ketu precursor — is skipped before a single antardasha is read.

**This is a regression.** The *general* engine's own comment (analyze.js ~L3353) documents
that it hit this identical bug and removed it:

> *"Previously this also required the MD to be domain-relevant, which MISSED a critical AD
> like the 10th-lord's sub-period inside an unrelated MD. Now aligned …"*

The general engine now fires on `keyPlanets.has(ad.lord) || isStressor(ad.lord)` — the
**antardasha lord's** own relationship to the domain, with no Mahadasha gate. The bespoke
career detector, written later from the real example, reinstated the gate the general engine
had deliberately removed.

**Classical basis for the fix:** the dasha of a bhāva lord delivers that bhāva's results in
its *own* period. The 10th lord in the 8th, running its antardasha, *is* the career-upheaval
trigger — the activation is complete in the antardasha itself. The Mahadasha does not grant
or withhold the event; it colours its depth. Gating the event on the Mahadasha is not a
Vedic rule — it is an artefact.

### RC2 — Valence computed but not propagated; activation mistaken for stress

Two linked defects:

**(a) The general engine computes stress-valence but doesn't carry it through.**
`isStressor()` (analyze.js ~L3313) correctly flags a planet as a stressor when it is the
domain lord in a dusthāna, a 6/8/12 lord, debilitated, or a malefic in the domain house —
and it flags Venus-in-8th as a stressor. But that status only colours the *retrospective*
`pastWindows`, and only **within the current Mahadasha** (see RC4). For a window in any
other Mahadasha, the planet's stressor status is discarded and the window is labelled
neutrally — *"a concentrated window for this area"* — which reads as opportunity, not
upheaval. The engine has the valence and then throws it away.

**(b) The career grading mistakes activation for stress.**
`mdCareerLink` treats *"the Mahadasha lord is the 10th lord / sits in the 10th"* as the
amplifier that makes a window **significant**. But a *strong, benefic* 10th activation
classically **cushions** a disruption, it does not deepen it. The correct amplifier is the
Mahadasha lord's **stress** relationship to career — a malefic, a dusthāna lord, a
debilitated or maraka influence — not its mere *proximity* to the 10th. The engine is using
the wrong sign on the modulation: it can amplify a benefic period and under-weight a genuinely
malefic one.

**Classical basis:** a period's result = the activating planet's *nature × dignity × bhāva
relationship*. "Activates the 10th" and "harms the 10th" are different axes; the engine
collapsed them into one.

### RC3 — No derivative-house (bhāvat bhāvam) layer

The 7th house is the **10th-from-the-10th** — a classical secondary house of livelihood,
marketplace, and public dealing. A node there (Ketu = detachment, disillusionment) running
its antardasha is a textbook *early-warning* on professional life. The engine's career houses
are the 10th plus `{6, 11}` (`DOMAIN_TIMING_SUPPORT`). The 7th-as-career is **not represented
anywhere**, so Ketu-in-7th is simply not a career signal.

The only thing that ever caught it was `findPrecursor` — a hand-written patch that scans for a
node/malefic antardasha in houses `{7,8,12}` in the ~3 years before a significant window. That
patch is:
- **over-fit** — written to reproduce the real native's 2018-before-2019 signal, not derived
  from a general rule;
- **fragile** — it only runs *after* a significant window is found (L2730–2731), and RC1 had
  already suppressed that window, so for the real case it never fired;
- **a point-solution** to what is really a general need: the engine should understand that
  the 7th signifies the 10th-from-10th, the same way it should understand 5th-from-5th
  (grandchildren), 9th-from-9th (fortune of fortune), 2nd-from-7th (longevity of the
  marriage), and so on.

There is no function anywhere that computes an Nth-from-Nth signification. That is the gap.

### RC4 — Past recognition limited to the current Mahadasha

`pastWindows` (analyze.js ~L3368) is gated by `isCurrentMD &&`. A testing/disruption window is
only offered to the reader for recognition if it lies inside the Mahadasha they are in *now*.
A career break that happened in a prior Mahadasha — exactly the real case — is never surfaced
as *"you may recognise 2019–2020 as a hard stretch,"* even though the engine has the data.
This affects every domain's "Looking Back" section.

---

## Part 3 — The methodology applied to all domains

The lens: for every domain, ask four questions — (1) is any event gated on the Mahadasha
rather than read from the antardasha? (2) is stress-valence read and *carried through* to how
the window is described? (3) are the classically-required derivative houses present? (4) is
past recognition limited to the current Mahadasha?

| Domain | RC1 MD-gate | RC2 valence | RC3 derivative houses | RC4 past-recognition |
|--------|-------------|-------------|------------------------|----------------------|
| **Career** | **Yes — bespoke detector** | Yes (+ wrong-sign grading) | Missing **7th** (10th-from-10th) | current-MD only |
| Self | general engine — no gate | valence not carried | — (constitutional, less applicable) | current-MD only |
| Marriage | general engine — no gate | valence not carried | Missing **8th** (2nd-from-7th, longevity/māngalya), **4th** (fortune of spouse) | current-MD only |
| Children | general engine — no gate | valence not carried | has 9th (5th-from-5th); missing 11th-from-5th (gains through children) | current-MD only |
| Siblings | general engine — no gate | valence not carried | Missing **5th** (3rd-from-3rd) | current-MD only |
| Mother | general engine — no gate | valence not carried | Missing **7th** (4th-from-4th, mother's fortune/partner) | current-MD only |
| Health | general engine — no gate | partial (afflicted-planet triggers) | has 1/8/12; reasonable | current-MD only |

**Reading of the matrix:** RC1 is a *career-only regression* — the general engine is clean.
RC2, RC3 and RC4 are *systemic*, living in the shared timing engine, so fixing them once
improves every domain. The career case was simply the loudest symptom because career has an
extra, regressed subsystem layered on top.

A note on the other engine rules scanned with the same lens:
- **Business lean** — static placement read (3/7/11 + Mercury for commerce; Sun/Mars/10th-lord
  for autonomy). Classically grounded, no timing gate, no derivative-house dependence. Clean.
- **recoveryCapacity** — read from the 2nd/11th (dhana) lords. Classically grounded. Clean.
- **Fruition windows** — use the widened `domainActivators`; benefic-preferred; age-gated.
  Sound, but inherits RC3 (a derivative-house activator it doesn't know about can't fruit a
  window) — minor.

---

## Part 4 — Recommended remediation (purely Vedic, generalising away from the example)

The fix is mostly in the **shared** engine (helps all domains) plus removing the career-only
regressions. Nothing here is tuned to a known chart.

1. **Remove the Mahadasha gate from the career detector (RC1).** Detect a disruption window
   from the **antardasha lord's own disruptor status**, exactly as the general engine already
   does for key windows. Align the two subsystems — ideally, have the career detector *consume*
   the general engine's stressor-tagged windows rather than re-deriving them.

2. **Carry valence through, and grade by stress not activation (RC2).** When a window's
   activating planet is a stressor for the domain, describe it as a testing/disruption window
   wherever it appears (not only in the current-MD retrospective). Modulate severity by the
   Mahadasha lord's **stress** relationship to the domain (malefic / dusthāna lord /
   debilitated / maraka = deepen; benefic / strong / yogakāraka = cushion) — not by whether
   the Mahadasha "activates" the house.

3. **Add a derivative-house (bhāvat bhāvam) layer (RC3).** A small, general function that, for
   each domain, includes the classically-recognised Nth-from-Nth houses (career: 7th as
   10th-from-10th; marriage: 8th as 2nd-from-7th; siblings: 5th as 3rd-from-3rd; etc.). This
   **replaces** the over-fit `findPrecursor` with a rule: a node/malefic period in a
   derivative domain house is an early-signal/secondary window, derived — not hand-coded to a
   friend's timeline.

4. **Extend past recognition beyond the current Mahadasha (RC4).** Let "Looking Back" surface
   a genuine prior-Mahadasha testing/disruption window, age- and valence-gated, so the reader
   can recognise a real past event.

5. **Retire `findPrecursor` and the "owner's precision rule" wording.** Once 1–4 land, the
   early-signal is a derived consequence of the derivative-house + valence layers, and the
   writer prompt should cite the **dāśā–antardāśā** principle, not a personal rule.

**Net effect:** the engine would have produced the real case — Venus-in-8th antardasha as a
significant disruption, Ketu-in-7th antardasha as the derived early-signal — from classical
rules alone, with no example needed. That is the test of success.

---

## Part 5 — Validation plan (before and after any change)

- **Golden case:** the Capricorn/Venus-8th/Ketu-7th chart above must go from *zero windows*
  to *Venus-AD significant disruption + Ketu-AD derived early-signal*, under the non-career
  Moon Mahadasha, with no chart-specific code.
- **Non-regression:** the dig-bala guard (Sun/Saturn/Mars in the 10th ≠ disruption) must hold;
  steady charts must stay quiet.
- **Population checks (per earlier method):** random-chart invariants across all 7 domains —
  no window without a derivation, valence correctly signed, derivative houses only where
  classical, past-recognition age-gated.
- **Cross-subsystem consistency:** the career detector and the general timing engine must
  agree on which periods are surfaced for the same chart (the test that failed today).
