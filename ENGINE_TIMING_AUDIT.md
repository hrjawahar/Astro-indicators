# Engine timing audit — bug classes & surgical check

A record of the recurring bug *classes* found while hardening the domain reports, the
surgical check done against them, and the one limitation that is inherent (not a bug).

## Bug classes discovered (and fixed)

1. **Past window presented as current/actionable.** A window was selected without
   checking whether it is current/upcoming.
   - Remedy picker matched a focus planet to *any* keyWindow incl. past (the 7th-lord
     Sun prescribed off a 2004–2007 window). → gated to current/upcoming + active MD.
   - `watchOutFor` enriched with `keyWindows[0]` (chronological ⇒ usually **past**).
     → now points at the nearest `upcoming` window, or carries no date.
2. **Over-reliance on domain-karaka windows (collapses for older natives).** The future
   compass read only domain-karaka sub-periods; once those are spent, it went vague.
   → compass now reads the full forward-AD pool (current MD onward).
3. **Single-house timing scope (missed real events).** Timing fired only on the primary
   house-lord + karaka + occupants. Real events run on the supporting houses too
   (marriage 2–5–11, career 6–11, children 5–9, …). → `DOMAIN_TIMING_SUPPORT` table folds
   each domain's supporting-house lords/occupants + natural karakas into `keyPlanets`.
   NOTE: single-house use in `convergences` / `d9LordCaution` is **by design** — that is
   the primary-house *narrative* anchor, not event detection.
4. **Testing window mislabelled as a positive/fruition event.** The "when it formalised"
   window picked the latest activator even if it was a flagged testing period (2023–24).
   → fruition excludes anything already in `pastWindows`, and prefers an event-age-band
   window.

## Surgical check performed

- Scanned every `keyWindows / adWindows / pastWindows / forwardADs` selection for the
  "past-as-current" pattern → fixed `watchOutFor`; confirmed compass + remedy are
  forward/active-gated.
- Confirmed the multi-house widening covers all 7 domains via `DOMAIN_TIMING_SUPPORT`.
- Stress-tested the fruition picker on 6 varied random charts: every window came out
  past, adult-age, and never coincident with a flagged testing window; empty when
  nothing qualified (no fabrication).

## Inherent limitation (NOT a bug) — read before "fixing" timing again

Vimshottari **dasha alone cannot pin an exact event year.** Widening + age-banding +
excluding testing windows gets the engine *close* for the common case, but the window
that a reader attaches to a specific year (e.g. the actual marriage year) is set by the
**transit trigger** — Jupiter/Saturn gochara to the 7th/2nd from Lagna or Moon — checked
against the running dasha. The slow-transit timeline exists in `chart.js` but is **not yet
fed into the domain timing engine.** That overlay is the real lever for exact-year
precision; until it is built, report language stays "most likely window", never a dated
certainty. Do not chase exact years by over-tuning the dasha heuristics (it over-fits).
