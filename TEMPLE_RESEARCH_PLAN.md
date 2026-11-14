# Temple remedies — future research & build plan (groundwork)

Goal: move from today's Tamil-Nadu-centric, mostly fixed temple list to a richer,
**pan-India, dignity- and dasha-aware** second-temple system — the right temple chosen
from the planet's placement, its dignity, the running dasha period, the domain, and the
user's region. Credible sources only; never fabricate a temple or a tradition.

## Where we are today
- `remedies-data.js`: each planet has one `navagrahaTemple` (TN navagraha sthalam) and
  `temples.{health,career}`; `DOMAIN_TEMPLES.marriage`; `GENERAL_TEMPLES`. All TN.
- Selection is coarse: domain → second temple, with a navagraha baseline.

## Target data model (proposed)
A temple is a record, not a string:
```
{ name, town, state, region, deity, forPlanet, condition, domains:[],
  tradition: "<one line on why it fits>", source: "<citation>" }
```
Organise as a matrix keyed by **planet × condition × region**, plus a domain layer:
```
TEMPLE_KB = {
  navagraha:  { <planet>: [ {record, region:"TN"|"Maharashtra"|"North"|...}, ... ] },  // gratitude / baseline
  remedial:   { <planet>: [ records flagged for WEAK placement (deb/combust/dusthana) ] },// dosha-nivarana
  domain:     { marriage:[...], children:[...], career:[...], health:[...], ... },        // researched per domain
}
```

## Selection logic (future engine)
1. Take each `remedyFacts.focus` planet + its dignity (already computed).
2. **Dignity-aware:** weak/afflicted (debilitated, combust, 6/8/12) → a `remedial`
   (dosha-nivarana) temple for that planet; strong → a `navagraha`/gratitude temple.
3. **Placement-aware:** the house/sign can refine the deity form (e.g. a 7th-house focus
   leans to the marriage-deity temple; an 8th/12th focus to a transformative/ascetic form).
4. **Dasha-aware:** surface it as "most potent to visit during your <planet> period"
   (we already know the active MD/AD).
5. **Region-aware:** prefer a temple near the user's birth region (we capture birth
   place); fall back to the famous TN sthalam, then a pan-India option.

## Pan-India candidates to VERIFY before adding (illustrative, not yet authoritative)
Each must be confirmed against a credible source (temple tradition / established text /
reliable reference) before it enters the KB:
- Saturn (Shani): Tirunallar (TN) · Shani Shingnapur (Maharashtra) · Tirupati-area Shani shrines.
- Rahu: Srikalahasti (AP, Rahu-Ketu dosha) · Thirunageswaram (TN).
- Ketu: Keezhaperumpallam (TN) · Srikalahasti (AP).
- Sun: Suryanar Kovil (TN) · Konark/Modhera (historic Sun temples) · Arasavalli (AP).
- Jupiter (Guru): Dakshinamurthy/Guru shrines · Alangudi (TN).
- Venus: Kanjanur (TN) · Sri Mahalakshmi temples (e.g. Kolhapur, Maharashtra).
- Mars (Chevvai): Vaitheeswaran Koil (TN) · Mangalnath (Ujjain, MP — the classical Mangal birthplace).
- Mercury: Thiruvenkadu (TN).
- Moon: Thingalur (TN) · Somnath (Gujarat).
Domain temples still needed (researched): **children, siblings, mother/home** (today
these correctly show navagraha + general only — no wrong temple, but no featured second
temple yet).

## Phasing
1. Expand the navagraha baseline to a few pan-India options per planet (region-tagged).
2. Add dignity-conditioned `remedial` temples (weak planet → dosha-nivarana temple).
3. Research + add domain second-temples for children / siblings / mother.
4. Region personalisation from birth place (TN default when unknown).

## Guardrails
- Every record carries a source; unverified candidates stay out of the KB.
- Keep the tone "optional alignment practice", never fear-based.
- No astrologer attribution in headings (existing rule).
