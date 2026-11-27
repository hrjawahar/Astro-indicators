# AstroIndicators — Deferred items (pick up in the next build)

Small, non-urgent items parked by agreement. None block the current release.

## RADAR — Major planetary transit (Gochar) / Jupiter–Saturn Double Transit (parked by agreement)
**Status:** deliberately OFF. The machinery is fully built and dormant — reuse it, do not rebuild.
- What exists: `functions/api/ephemeris.js` (`transitSignsAt`, `planetSignAspects`, `nthSign`),
  `functions/api/marriage-timing.js` `doubleTransitAt(y, m, targets)` (generic — "both Jupiter AND
  Saturn occupy/aspect the target signs"; takes any targets, not marriage-specific), and `chart.js`
  `computeSaturnTransit` / `computeGochara` (Sade Sati + future sign-ingress projection). Wired only
  into the marriage PD-precision layer, gated by `ENABLE_PD_TIMING = false`.
- Why parked: validated against 6 real marriage dates and found UNRELIABLE for sub-year pinpointing
  (slow planets keep "both active" true for long stretches, so it blurs the peak rather than
  sharpening it). The conflict is intrinsic: the *precise* use (narrow within a dasha window) is the
  discredited one; the *reliable* use (broad agreement) is corroboration, not precision — it cannot
  satisfy "improve precision" without reviving the noise. Dasha windows already carry the timing.
- **Safeguards required before any future reintroduction** (all of them):
  1. BROAD seasonal confirmation ONLY — never a dated "peak" or sub-year pinpoint.
  2. Surface it ONLY when it AGREES with the active dasha window; never let a double-transit "season"
     sit next to a contradicting dasha verdict (that contradiction is what felt wrong in
     marriage/career and got it removed).
  3. Switch-gated + reversible, like every SOP-depth module; clean revert verified.
  4. Its OWN validation pass against real dated events (several per domain) before enabling — reuse
     the 6-date methodology; do not enable on classical-completeness grounds alone.
  5. Framed in the writer as corroboration layered on the dasha, never as the primary timing.
- Cheap compliance-only fallback (no math, no risk): a writer-only general line that slow-planet
  cycles broadly reinforce the dasha windows — closes the SOP checkbox without the unreliable
  computation. Add only if the checkbox matters; otherwise leave the timing as-is.

## Domain 6 Health — SOP pieces (ALL NOW BUILT ✓)
The earlier note parked D30, Gulika/Mandi and Yogini dasha. On review, birth time + place ARE
captured (chart.js uses them to cast the chart), so all three were built:
- **D30 (Trimshamsha) vulnerability filter** — added as a VARGA_FN.D30 ruler-mapper (Parashara
  unequal segments → ruler's own sign, Jagannatha-Hora convention); drives a conservative
  ergonomic/defensive preventive note from malefic clustering in D30 1/6/8.
- **Gulika / Mandi** — computed in chart.js from a new NOAA sunrise/sunset routine + the ascendant
  at the start of Saturn's eighth-part; forwarded through the /api/analyze payload; placed by house
  as a Saturn-like localized stress spot.
- **Yogini Dasha** (36-year cycle) — built from the Moon's nakshatra; runs as the SOP's secondary
  overlay on the Vimshottari preventive windows (watch-yogini = stronger audit window; benefic =
  strong recovery responsiveness). Clock-driven, auto-advances.
Minor refinements still open (non-blocking): Gulika's pre-sunrise Vedic-day handling is in but the
night-sequence start-lord convention has textual variants (we use "5th weekday-lord"); D30 rashi
assignment follows the common JHora convention (some texts differ). Both kept deliberately
conservative in their report influence.

## Domain 10 — Foreign Settlement & Global Life (NEW standalone domain, parked)
- The Mother & Home SOP doc also contained a full SOP for a **new** Domain 10
  "Foreign Settlement & Global Life" (D1 -> D4 -> D9 -> D10 -> D12): the 4-9-12
  relocation triangle, a 4-tier trajectory classification (permanent PR / study-then-
  return / global-career-from-home / domestic roots), D12 parental-duty lens, and
  visa/relocation timing.
- **Decision deferred by the user:** new domains are to be deliberated after all SOPs
  land, and foreign settlement inside the **career** domain stays as-is for now. So
  Domain 10 is NOT built. Revisit when the user decides to add it as its own card.

## Owner-view control-value scrub
- **What:** In the OWNER edition, the internal steering word `'rises'` (and, by
  extension, `'shifts'` / `'protect-peak'` — `flags.maturationDirection`) still shows
  through inside a couple of "Why this reading" boxes, e.g. *"'rises' confirmed by this
  transition"* and *"the 'rises' direction"*.
- **Why deferred:** Harmless for the astrologer's eyes (owner edition shows mechanics);
  the client edition is already clean.
- **Fix when we build next:** extend the quoted-token case in the leak scrub
  (`functions/api/domain-report.js`, `scrubArtifacts` / `_DROP_RE`) to also strip the
  bare words `rises` / `shifts` / `protect-peak` when they appear quoted mid-sentence,
  and/or tighten the "control signals are never printed" writer rule so the owner edition
  translates the direction into plain words instead of echoing the token.
- **Guard:** do NOT strip the ordinary English verb "rises/shifts" in real prose — only
  the quoted control token (e.g. wrapped in straight or curly quotes, or immediately
  followed by "direction"/"confirmed").

## Earlier parked ideas (classical depth — only if/when SOPs call for them)
- Pravrajya yoga / principled singlehood read.
- Pushkara Navamsha and 64th Navamsha (Khara) refinements.
- Darakaraka tie-handling (equal-degree edge case).
