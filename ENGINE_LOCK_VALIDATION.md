# Engine lock — validation record

This records the state at which the AstroIndicators **prediction engine is locked**. From
here, the predictions are the frozen source of truth: all later presentation work (writing
voice, planetary-mix, headings, structure, the Quick-Answers box, moving the D1–D9 table,
etc.) must **render these facts faithfully and never change what the chart says**.

> **The compass.** As Indian foreign policy orients to national interest, AstroIndicators
> orients to the single reader's interest — facts and directions specific to *that one
> individual's* chart, never generic. Every rule below is validated by that test.

Companion documents: `ENGINE_ROOTCAUSE_AUDIT.md` (why the engine missed the real case and the
root-cause classes), and the commit history on `feat/marriage-upgrade` for each fix.

## What was remediated (root-cause, purely Vedic — no example-specific code)

| Root cause | Fix |
|---|---|
| **RC1** — an MD-relevance gate dropped a genuine disruptor sub-period when the Mahadasha was not "career-linked" | Surface-don't-drop: a disruptor antardasha is always surfaced, then graded |
| **RC2** — "does the Mahadasha activate the 10th" (wrong axis) | Grade by dasha–antardasha **stress-valence**: amplify / neutral / cushion; plus the classical rule that the 10th lord in a loss house running its own sub-period is pronounced on its own |
| **RC2 (Rahu)** — a blanket "any Rahu period = overindulgence / new contacts" | Rahu amplifies the **house it occupies or aspects**, so the caution fires only when Rahu touches the domain (house / lord / karaka), naming that area's themes |
| **RC3** — no derivative-house (bhāvat bhāvam) layer | Derivative houses added: career 7th (10th-from-10th, early-signal), marriage 8th (2nd-from-7th, māngalya), siblings 5th (3rd-from-3rd), mother 7th (4th-from-4th); children's 9th (5th-from-5th) already present. A malefic in any derivative house is a domain stressor |
| **RC4** — "Looking Back" recognised testing periods only in the current Mahadasha | Any adult-age prior-Mahadasha stressor sub-period now surfaces, nearest-to-now first |
| over-fits | `findPrecursor` (built to reproduce one native's timeline) and the blanket Rahu trigger are **retired** |

Forward-window valence was already handled by `buildFutureCompass` (themes bands supportive /
testing / mixed) and is confirmed in place.

## Golden case — the real chart, reproduced from rules alone

Native: **Leo lagna**, Venus (10th lord) exalted in the **8th** (Pisces), **Ketu in the 7th**
(Aquarius), Moon in Capricorn (6th); the career break ran in the **Venus antardasha under the
Jupiter Mahadasha** (Jupiter = the **8th lord** for Leo lagna — a loss-axis chapter).

Engine output, with no code specific to this chart:

```
EARLY SIGNAL  2017–2018  Jupiter-MD / Ketu-AD   (Ketu in the 7th = 10th-from-10th)
BREAK         2018–2020  Jupiter-MD / Venus-AD → significant [amplify]
                         (10th-lord-in-8th sub-period, amplified by the 8th-lord Mahadasha)
```

This is the lived sequence — the 2018 whisper and the 2019 break — derived for *this* chart.
Before the remediation the engine produced **zero** windows here.

## Population validation

- **2,450 runs across all 7 domains** — every structural invariant holds (no window without a
  derivation; valence correctly enumerated; no orphan windows; business grades consistent;
  no cross-domain contamination).
- **400 random career charts** — all career invariants hold.
- **Signal rates stable, not alarmist**: strong-tier 2–8% per domain; career disruption-prone
  ~37%, of which ~26% carry a significant window (steady charts stay quiet; the dig-bala guard
  — Sun/Saturn/Mars in the 10th are not disruptors — holds).

## Locked. What comes next (renders the engine, never rewrites it)

1. **Presentation layer** (the customer-feedback improvements): direct/accountable precautions
   grounded in planetary factors only; the planetary-detail-woven-with-plain-meaning voice;
   per-chart relatability; dosha/Manglik and other explicit checkpoints; the Quick-Answers
   box; structure reorder; moving the D1–D9 table to an appendix; PDF fidelity (italics,
   fused words, internal field-name leaks); compress the "How to read" box.
2. **Nakshatra workstream** (its own validated pass): each planet's nakshatra and nakshatra-
   lord as a sub-dispositor angle; esoteric nakshatra attributes added cautiously, sourced.

Remedies remain **parked** as a separate project; precautions stay grounded in planetary
factors, not spiritual-remedy prescriptions.
