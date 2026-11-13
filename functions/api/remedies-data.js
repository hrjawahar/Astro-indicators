// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/remedies-data.js
//  The remedy knowledge base. Pure data (no request handler) — imported by
//  analyze.js, which decides WHICH planet(s) to remedy per chart + domain
//  (dasha-triggered + unfavourable placement), and the writer narrates it.
//
//  Three layers per planet, framed as OPTIONAL "alignment practices", never
//  mandatory/paid rituals:
//    1. behavioral  — a daily karma-alignment habit (universal). Each planet also has a
//                     `whenWeak` caution (what to AVOID) that the writer leads with when the
//                     planet is debilitated/afflicted — dignity-aware, per owner's direction.
//    2. daan        — charity: the planet's grain + weekday + a fitting cause (universal)
//    3. temple      — Tamil Parihara Sthalam: the well-known navagrahaTemple (baseline)
//                     + a RESEARCH-BASED second temple per domain (the FEATURED value —
//                     everyone knows the navagraha temple; the ailment/career-specific
//                     one is what the reader finds valuable).
//
//  Provenance: each planet's own navagraha temple is canonical and well-established.
//  The domain "second temple" is a researched suggestion (reputable, but not a fixed
//  classical list) — the writer presents it as a suggestion, never an overclaim.
//  Health remedies are traditional support ALONGSIDE medical care, never instead of it.
//
//  Sources cross-checked: OnlineJyotish, HinduTone (navagraha days/grains/temples),
//  IndiaGlitz (Tamil expert home remedies), GoodStars Jyotish (daan-first framing),
//  classical medical-astrology (Kalapurusha) planet→body mappings, and owner research.
// ─────────────────────────────────────────────────────────────────────────────

export const PLANET_REMEDIES = {
  Sun: {
    signify: "vitality, confidence, authority, the father, government",
    behavioral: "Lead without needing to dominate; give others credit and let go of the need to be right. Rise early and start the day with intent.",
    whenWeak: "guard against ego-clashes, arrogance, or tying your whole sense of worth to status and recognition",
    daan: { item: "wheat, jaggery, or copper", day: "Sunday", cause: "elders, a father-figure, or education" },
    anchor: "Offer water to the rising sun (Surya Arghya) on Sundays; Om Suryaya Namah",
    navagrahaTemple: "Suryanar Kovil, near Kumbakonam",
    bodyAreas: "heart, eyes, bones, vitality and immunity, blood pressure",
    careerFields: "government, administration, leadership, politics, authority roles",
    temples: {
      health:  "Keela Surya Moolai / Surya Koteeswarar — prayed at for eye and heart ailments and a troubling Sun",
      career:  "Adi Kumbeswarar, Kumbakonam — for professional life that has stalled or hit a standstill",
    },
  },
  Moon: {
    signify: "the mind, emotions, the mother, peace, nurturing",
    behavioral: "Protect your emotional rest and a steady daily routine; nurture the bond with your mother or a maternal figure; keep evenings calm.",
    whenWeak: "guard against emotional volatility and clinging; don't let passing moods drive lasting decisions",
    daan: { item: "rice, milk, or white cloth", day: "Monday", cause: "mothers, children, or the emotionally vulnerable" },
    anchor: "Spend quiet time near water or moonlight; Om Chandraya Namah",
    navagrahaTemple: "Kailasanathar, Thingalur",
    bodyAreas: "mind and emotions, lungs and chest, stomach, body fluids; anxiety and low mood",
    careerFields: "hospitality, food, nursing, caregiving, counselling, public-facing work",
    temples: {
      health:  "Gunaseelam Prasanna Venkatachalapathy — 'Gunam' means cure; long associated with mental-health care (a Government-of-Tamil-Nadu-licensed rehabilitation centre with a visiting psychiatrist operates there), a rare blend of faith and modern treatment",
      career:  "Thenkudi Thittai, then Thingalur the same day — for unstable income and frequent job changes (invokes Guru-Chandra yoga)",
    },
  },
  Mars: {
    signify: "energy, courage, drive, siblings, land and property",
    behavioral: "Channel restlessness into daily physical exercise; pause before reacting; keep sharp words out of disagreements.",
    whenWeak: "guard against impulsive anger, aggression, and reckless haste; don't let frustration spill into conflict",
    daan: { item: "toor dal (red lentils), red cloth, or jaggery", day: "Tuesday", cause: "siblings, soldiers, or physical-labour workers" },
    anchor: "Om Angarakaya Namah or the Hanuman Chalisa on Tuesdays",
    navagrahaTemple: "Vaitheeswaran Koil, near Sirkazhi (Vaitheeswaran = 'God of healing')",
    bodyAreas: "blood and blood pressure, accidents, surgery, burns and inflammation, muscles",
    careerFields: "real estate, land, engineering, defence and police, surgery, sports",
    temples: {
      health:  "Chennimalai Murugan — Murugan equated to Sevvai/Mars; tradition of dissolving jaggery in the waters for skin ailments",
      career:  "Runa Vimochana Lingeswarar, Thirucherai — 'Runa Vimochana' = relief from debt; for disputes with superiors and property/financial trouble",
    },
  },
  Mercury: {
    signify: "communication, intellect, the nerves, commerce and trade",
    behavioral: "Speak with care and finish what you start; protect your nervous system with real rest and less screen time.",
    whenWeak: "guard against scattered focus and overthinking, and against careless or cutting speech",
    daan: { item: "green gram (moong) or green cloth", day: "Wednesday", cause: "students, education, or the differently-abled" },
    anchor: "Om Budhaya Namah or a Vishnu chant on Wednesdays",
    navagrahaTemple: "Swetharanyeswarar, Thiruvenkadu (near Sirkazhi)",
    bodyAreas: "nerves, skin, speech, breathing/respiratory, mental balance",
    careerFields: "trade and commerce, accounts and finance, IT and software, writing, media, analysis",
    temples: {
      health:  "Guruvayur Sri Krishna Temple — a traditional resort of those with nervous disorders and rheumatic complaints",
      career:  "Parthasarathy, Triplicane — for a better job and career growth (the Thirumanjanam ritual)",
    },
  },
  Jupiter: {
    signify: "wisdom, growth, teachers, children, faith, finance",
    behavioral: "Seek and honour mentors, and give your own guidance generously; act with ethics and faith; keep learning.",
    whenWeak: "guard against overconfidence, excess, and dogmatism; don't over-promise or over-extend on faith alone",
    daan: { item: "chana (Bengal gram), turmeric, or yellow cloth", day: "Thursday", cause: "teachers, temples, or education" },
    anchor: "Om Gurave Namah on Thursdays; offer or wear yellow",
    navagrahaTemple: "Apatsahayeswarar, Alangudi (the popular Guru Parihara Sthalam)",
    bodyAreas: "liver, diabetes, obesity, cholesterol, fat metabolism",
    careerFields: "teaching, banking, finance, law, advisory, spiritual and counselling work",
    marriageRole: "the husband-significator for a woman",
    temples: {
      health:  "Vasishteswarar, Thenkudi Thittai — for Guru dosha generally (liver/metabolic support alongside medical care)",
      career:  "Jambukeswarar, Thiruvanaikaval — an 'Upadesa Sthalam', noted for landing a job or a transfer",
    },
  },
  Venus: {
    signify: "love, marriage and the spouse, pleasure, the arts, comfort",
    behavioral: "Invest in simple, unhurried, phone-free affection; make room for beauty and art; ease off excess and indulgence.",
    whenWeak: "guard against overindulgence in pleasure, luxury, or comfort, and against seeking validation through relationships",
    daan: { item: "white beans (mochai), sugar, or white cloth", day: "Friday", cause: "women's welfare or the arts" },
    anchor: "Keep fresh flowers at home; Om Shukraya Namah or a Lakshmi chant on Fridays",
    navagrahaTemple: "Agneeswarar, Kanjanur",
    bodyAreas: "reproductive system, kidneys, hormones, throat",
    careerFields: "arts, film, fashion, luxury goods, hospitality, design, beauty",
    marriageRole: "the primary marriage & spouse significator (Kalathira karaka)",
    temples: {
      marriage: "Kanjanur Agneeswarar — the Venus Navagraha temple, prayed at to ease a difficult Venus, the planet of marriage and partnership (traditionally sought for Kalathra-dosha / spouse-related concerns)",
      health:   "Garbharakshambigai, Thirukarugavur — associated with reproductive health and safe childbirth",
      career:   "Mahalakshmeeswarar, Thirunindriyur — for prosperity and regaining position",
    },
  },
  Saturn: {
    signify: "discipline, time, commitment, karma, service, delay",
    behavioral: "Be patient and consistent; honour your commitments and your elders; serve the under-served; avoid shortcuts.",
    whenWeak: "guard against cutting corners, chronic pessimism, and withdrawing into isolation under pressure",
    daan: { item: "black sesame, gingelly/mustard oil, or black cloth", day: "Saturday", cause: "the poor, the elderly, labourers, or the disabled" },
    anchor: "Light a sesame-oil lamp on Saturdays; Om Namah Shivaya or Om Shanaischaraya Namah",
    navagrahaTemple: "Dharbaranyeswarar, Thirunallar (Karaikal)",
    bodyAreas: "bones, joints, teeth and knees, chronic and long-term illness, arthritis",
    careerFields: "service and employment, labour, manufacturing, construction, law, long-haul roles",
    temples: {
      health:  "Pongu Saneeswarar, Thirukollikadu — visited after Thirunallar for relief in a hard Saturn period",
      career:  "Thirukollikadu — the Nala legend of losing and regaining everything; for recovery after job loss",
    },
    order: "the traditional order is Thirunallar first (to reduce the dasha's effect), then Thirukollikadu (for blessings)",
  },
  Rahu: {
    signify: "ambition, obsession, the foreign and unconventional, overthinking, technology",
    behavioral: "Keep your home and life clutter-free and grounded; avoid impulsive, irreversible decisions when you feel overwhelmed; limit intoxicants and endless screens.",
    whenWeak: "guard against obsession, impulsive grabs, and chasing shortcuts or illusions that promise too much too fast",
    daan: { item: "urad (black gram) or a blanket", day: "Saturday (Rahu Kalam)", cause: "the marginalised or strangers in need" },
    anchor: "Ten minutes of silent breathwork before difficult conversations; Om Rahave Namah or Durga worship",
    navagrahaTemple: "Naganathaswamy, Thirunageswaram",
    bodyAreas: "undiagnosed or mysterious illness, poisoning and allergies, phobias, viral fevers",
    careerFields: "technology, foreign trade, aviation, cinema, politics, research, speculation",
    temples: {
      health:  "Srikalahasti — the Rahu-Ketu Sarpa Dosha Nivarana puja, for unexplained or persistent illness",
      career:  "Thirunageswaram — for job loss, debt, and repeated setbacks in career or business",
    },
  },
  Ketu: {
    signify: "detachment, spirituality, past karma, intuition, sudden breaks",
    behavioral: "Make room for solitude and a spiritual practice; release what is already complete; take care not to over-isolate.",
    whenWeak: "guard against escapism and excessive detachment; don't withdraw from the people and duties that still need you",
    daan: { item: "horse gram (kollu) or multicoloured cloth", day: "Tuesday or Saturday", cause: "spiritual causes, strays, or the sick" },
    anchor: "Meditation or prayer; Om Ketave Namah, and Ganesha worship (Ketu's presiding deity)",
    navagrahaTemple: "Naganathaswamy, Keezhaperumpallam (Poompuhar)",
    bodyAreas: "wounds, viral infections, psychosomatic or undiagnosed complaints",
    careerFields: "research, healing, spiritual and behind-the-scenes work, forensics",
    temples: {
      health:  "Thirupampuram / Keezhaperumpallam — for undiagnosed illness and spiritual obstacles",
      career:  "Karpaga Vinayagar, Pillaiyarpatti — Ganesha, to clear the sudden, causeless obstacles of an afflicted Ketu",
    },
  },
};

// General temples — used when the chart is unclear or several planets are weak.
// Temples that help whatever the chart shows; the planet temples above are used once
// we know which dasha is causing the trouble. (Presented in the report as traditional
// general temples — not attributed to any named astrologer.)
export const GENERAL_TEMPLES = {
  obstacle: "Karpaga Vinayagar, Pillaiyarpatti — Ganesha, to clear obstacles of any kind (start here if the cause is unclear)",
  career:   "Sri Ranganathaswamy, Srirangam — for job and career progress",
  business: "Sree Padmanabhaswamy, Thiruvananthapuram — for business and prosperity",
};

// A planet's dasha tends to hurt a domain when the planet is unfavourably placed.
// Used by analyze.js to decide WHETHER to raise a remedy for an active-dasha planet.
export const UNFAVOURABLE = {
  houses: [6, 8, 12],            // dusthana placement
  notes: "debilitated, combust (close to the Sun), or conjoined with Sun/Mars/Saturn; " +
         "8th = sudden disruption, 12th = loss of position/income; " +
         "for business, the 7th house combined with the 8th or 12th.",
};
