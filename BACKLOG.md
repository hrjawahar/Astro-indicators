# AstroIndicators — Deferred items (pick up in the next build)

Small, non-urgent items parked by agreement. None block the current release.

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
