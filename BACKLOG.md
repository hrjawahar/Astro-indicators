# AstroIndicators — Deferred items (pick up in the next build)

Small, non-urgent items parked by agreement. None block the current release.

## Domain 6 Health — SOP pieces parked (need new engines / birth-time precision)
The Health & Well-Being build ships the classical core: auto Tri-Dosha (Prakriti),
sign-modality duration, the 1st-lord immune shield, D1->D9 maturation, D3 body-zone +
22nd Drekkana (8th lord), 64th Navamsha, and a light D12 family-pattern note. Three SOP
pieces were deliberately NOT built now because they need new machinery and, done in a
rush, would risk incorrect output (over-fit covenant: better omitted than shaky):
- **D30 (Trimshamsha) vulnerability filter.** Classical D30 is NOT an equal-division varga
  — it uses unequal Mars/Saturn/Jupiter/Mercury/Venus segments with odd/even-sign rules and
  maps to a *ruler*, not a clean sign. Needs its own mapping (not the VARGA_FN pattern) and
  careful validation before it can drive any "vulnerability" language.
- **Gulika / Mandi** sensitive point. Needs precise birth *time of day*, weekday, and
  sunrise/sunset to place the sub-segment — inputs we don't reliably have per chart yet.
- **Yogini Dasha** (36-year cycle) as the SOP's *secondary* overlay on the Vimshottari
  preventive windows. A whole second dasha engine; the Vimshottari windows already stand on
  their own, so this is an enhancement, not a blocker.
Revisit together when we add a birth-time/sunrise input path and a D30 ruler-mapper.

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
