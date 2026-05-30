// ─────────────────────────────────────────────────────────────────────────────
//  FILE: samples-data.js
//  AstroIndicators — Realistic sample reports for the "View Sample Report" popup.
//  Designed to build curiosity: a full, real-feeling example with the final
//  high-value section LOCKED, so the user wants to pay to see their own.
//
//  Translatable: each sample has text per language (EN master; others follow).
//  If a language is missing, English is shown.
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLES = {

  // The sample uses a fixed example chart so it feels real and specific.
  charts: {
    EN: {
      title: "Sample · Horoscope Chart (D1 & D9)",
      example: "Example chart · born 14 May 1990, 07:42, Chennai",
      blocks: [
        ["Ascendant (Lagna)", "Gemini rising, ruled by Mercury placed in the 11th house. This gives a quick, communicative, networking-oriented personality. The mind is restless and curious; the person thinks in possibilities rather than certainties."],
        ["Moon", "Moon in Taurus in the 12th house — exalted, a deep emotional reservoir, but placed in the house of solitude and the inner world. Emotional strength is real but often private. This person processes feelings inwardly before showing them."],
        ["Sun & Career signature", "Sun in Aries in the 11th — exalted, strong ambition channelled through groups, networks, and large goals. Leadership comes naturally but is expressed through community rather than solo command."],
        ["D9 (Navamsha) confirmation", "In the D9, Jupiter strengthens and aspects the Lagna — indicating that early scattered energy matures into genuine wisdom and teaching ability in the second half of life. The promise of D1 is confirmed, not contradicted, by D9."],
      ],
      locked: {
        label: "🔒 Your full report unlocks:",
        teaser: "The exact strength score of all 9 planets in your chart · your three strongest and three most challenged life areas · the specific yogas (planetary combinations) present in your chart and what each one means for you · the single most important planet in your chart and how to work with it.",
      },
    },
    TA: {
      title: "மாதிரி · ஜாதக கட்டம் (D1 & D9)",
      example: "உதாரண ஜாதகம் · 14 மே 1990, 07:42, சென்னை",
      blocks: [
        ["லக்னம்", "மிதுன லக்னம், புதன் 11ஆம் வீட்டில். விரைவான, தொடர்பு கொள்ளும், வலைப்பின்னல் ஆளுமை. மனம் ஆர்வமுள்ளது."],
        ["சந்திரன்", "ரிஷபத்தில் சந்திரன் 12ஆம் வீட்டில் — உச்சம். ஆழமான உணர்ச்சி வலிமை, ஆனால் தனிமையின் வீட்டில். உணர்வுகளை உள்ளுக்குள் செயலாக்குகிறார்."],
        ["சூரியன் & தொழில்", "மேஷத்தில் சூரியன் 11ஆம் வீட்டில் — உச்சம். குழுக்கள் மற்றும் பெரிய இலக்குகள் வழியாக வலுவான லட்சியம்."],
        ["D9 உறுதிப்படுத்தல்", "D9-ல் குரு வலுப்பெற்று லக்னத்தைப் பார்க்கிறார் — ஆரம்ப ஆற்றல் உண்மையான ஞானமாக முதிர்கிறது."],
      ],
      locked: {
        label: "🔒 உங்கள் முழு அறிக்கை திறக்கும்:",
        teaser: "9 கிரகங்களின் சரியான வலிமை மதிப்பெண் · உங்கள் வலுவான மற்றும் சவாலான வாழ்க்கைப் பகுதிகள் · உங்கள் ஜாதகத்தில் உள்ள யோகங்கள் · உங்கள் மிக முக்கியமான கிரகம்.",
      },
    },
    HI: {
      title: "नमूना · कुंडली चार्ट (D1 & D9)",
      example: "उदाहरण कुंडली · 14 मई 1990, 07:42, चेन्नई",
      blocks: [
        ["लग्न", "मिथुन लग्न, बुध 11वें भाव में। तेज़, संवाद-कुशल, नेटवर्किंग व्यक्तित्व। मन जिज्ञासु रहता है।"],
        ["चंद्रमा", "वृषभ में चंद्रमा 12वें भाव में — उच्च का। गहरी भावनात्मक शक्ति, पर एकांत के भाव में। भावनाओं को भीतर ही संसाधित करता है।"],
        ["सूर्य व करियर", "मेष में सूर्य 11वें भाव में — उच्च का। समूहों और बड़े लक्ष्यों के माध्यम से प्रबल महत्वाकांक्षा।"],
        ["D9 पुष्टि", "D9 में बृहस्पति मज़बूत होकर लग्न को देखता है — प्रारंभिक बिखरी ऊर्जा सच्चे ज्ञान में परिपक्व होती है।"],
      ],
      locked: {
        label: "🔒 आपकी पूरी रिपोर्ट खोलती है:",
        teaser: "सभी 9 ग्रहों का सटीक शक्ति स्कोर · आपके सबसे मज़बूत और चुनौतीपूर्ण जीवन क्षेत्र · आपकी कुंडली के योग · आपका सबसे महत्वपूर्ण ग्रह।",
      },
    },
  },

  dasha: {
    EN: {
      title: "Sample · Dasa Bhukti Periods",
      example: "Example · currently running Jupiter Mahadasha",
      blocks: [
        ["Where you are now", "Jupiter Mahadasha / Saturn Antardasha (Mar 2024 – Sep 2026). Jupiter the great benefic sets an expansive, opportunity-rich climate; Saturn within it demands that the opportunities be built on real foundations, not shortcuts."],
        ["What this period tends to bring", "This is one of the most productive combinations in the entire Vimshottari system — wisdom meeting discipline. Career milestones built to last, often the most meaningful work of a person's life. Recognition arrives, but only for what was genuinely earned."],
        ["The watch-points", "Saturn's sub-period slows things down and tests patience. Delays are redirections, not denials. Health of bones, joints, and teeth deserves attention. Relationships deepen into commitment or reveal their unsustainability."],
        ["The shift ahead", "From Sep 2026, Jupiter / Mercury begins — communication, learning, writing, and analytical work come sharply into focus. A lighter, faster, more intellectually active window after the Saturn discipline."],
      ],
      locked: {
        label: "🔒 Your full Dasa report unlocks:",
        teaser: "Your exact current Mahadasha and Antardasha with precise dates · a month-by-month reading of what to expect now · the previous period you just completed and what it was building · the next major period and how to prepare for it · personalised remedies for your current planetary climate.",
      },
    },
    TA: {
      title: "மாதிரி · தசா புக்தி காலம்",
      example: "உதாரணம் · தற்போது குரு மகாதசை",
      blocks: [
        ["நீங்கள் இப்போது எங்கே", "குரு மகாதசை / சனி அந்தர்தசை (மார் 2024 – செப் 2026). குரு விரிவான வாய்ப்புகளை அமைக்கிறார்; சனி அவற்றை உண்மையான அடித்தளத்தில் கட்ட கோருகிறார்."],
        ["இந்தக் காலம் தரும் பலன்", "விம்சோத்தரி அமைப்பில் மிகவும் பயனுள்ள கலவை — ஞானம் மற்றும் ஒழுக்கம். நீடித்த தொழில் சாதனைகள்."],
        ["கவனிக்க வேண்டியவை", "சனியின் காலம் பொறுமையை சோதிக்கிறது. தாமதங்கள் மறுவழிப்படுத்தல்கள். எலும்புகள், மூட்டுகளின் ஆரோக்கியம் கவனம் தேவை."],
        ["வரவிருக்கும் மாற்றம்", "செப் 2026 முதல், குரு / புதன் தொடங்குகிறது — தொடர்பு, கற்றல், எழுத்து கூர்மையாக கவனம் பெறுகிறது."],
      ],
      locked: {
        label: "🔒 உங்கள் முழு தசா அறிக்கை திறக்கும்:",
        teaser: "துல்லியமான தேதிகளுடன் உங்கள் தற்போதைய மகாதசை & அந்தர்தசை · மாதந்தோறும் என்ன எதிர்பார்க்கலாம் · முந்தைய காலம் · அடுத்த பெரிய காலம் · தனிப்பயன் பரிகாரங்கள்.",
      },
    },
    HI: {
      title: "नमूना · दशा भुक्ति काल",
      example: "उदाहरण · वर्तमान में बृहस्पति महादशा",
      blocks: [
        ["आप अभी कहाँ हैं", "बृहस्पति महादशा / शनि अंतर्दशा (मार्च 2024 – सित 2026)। बृहस्पति विस्तृत अवसर देता है; शनि माँग करता है कि वे ठोस नींव पर बनें।"],
        ["यह काल क्या लाता है", "विम्शोत्तरी प्रणाली का सबसे उपयोगी संयोग — ज्ञान और अनुशासन। टिकाऊ करियर उपलब्धियाँ।"],
        ["सावधानियाँ", "शनि का काल धैर्य की परीक्षा लेता है। देरी पुनर्निर्देशन है। हड्डियों, जोड़ों का स्वास्थ्य ध्यान माँगता है।"],
        ["आगे का बदलाव", "सित 2026 से बृहस्पति / बुध शुरू — संवाद, अध्ययन, लेखन तीव्रता से केंद्र में आते हैं।"],
      ],
      locked: {
        label: "🔒 आपकी पूरी दशा रिपोर्ट खोलती है:",
        teaser: "सटीक तिथियों के साथ आपकी वर्तमान महादशा व अंतर्दशा · माह-दर-माह क्या अपेक्षा करें · पिछला काल · अगला बड़ा काल · व्यक्तिगत उपाय।",
      },
    },
  },

  domains: {
    EN: {
      title: "Sample · Life Domains Indicators",
      example: "Example chart · Gemini ascendant",
      blocks: [
        ["Career & Profession — Strong", "The 10th lord (career) is well placed and supported by Jupiter's aspect. Indicates steady professional growth, recognition earned through competence, and a likely leadership role in the second half of life. Best suited to communication, teaching, or advisory work."],
        ["Wealth & Finances — Developing", "The 2nd and 11th houses show gains that build gradually rather than suddenly. Wealth accumulates through consistent effort. A caution against speculation — gains are real but slow, and shortcuts tend to backfire in this chart."],
        ["Relationships & Marriage — Mixed", "Venus is supported but under examination during the current transit. Partnership is favoured but tested — early relationships may teach hard lessons before a stable, mature bond forms. Commitment deepens after age 30."],
        ["Health & Vitality — Stable", "The ascendant lord is unafflicted, indicating a fundamentally robust constitution. Watch points are the digestive system and stress-related tension. Regular routine and moderate exercise keep this chart well."],
      ],
      locked: {
        label: "🔒 Your full Life Domains report unlocks:",
        teaser: "All 12 life areas scored from your specific chart · your three strongest domains to lean into · your three most challenged domains and how to strengthen them · the specific planetary reasons behind each score · timing guidance for major life decisions.",
      },
    },
    TA: {
      title: "மாதிரி · வாழ்க்கைத் துறை அறிகுறிகள்",
      example: "உதாரண ஜாதகம் · மிதுன லக்னம்",
      blocks: [
        ["தொழில் — வலுவானது", "10ஆம் அதிபதி நன்கு அமைந்து குருவின் பார்வை பெறுகிறார். நிலையான தொழில் வளர்ச்சி, தகுதியால் அங்கீகாரம்."],
        ["செல்வம் — வளர்ச்சியடைகிறது", "2 மற்றும் 11ஆம் வீடுகள் படிப்படியாக வளரும் ஆதாயங்களைக் காட்டுகின்றன. ஊகவணிக எச்சரிக்கை."],
        ["உறவுகள் — கலவையானது", "சுக்கிரன் ஆதரவு பெறுகிறார் ஆனால் சோதிக்கப்படுகிறார். 30 வயதுக்குப் பிறகு உறுதி ஆழமாகிறது."],
        ["ஆரோக்கியம் — நிலையானது", "லக்னாதிபதி பாதிப்பில்லாமல் உள்ளார். செரிமான அமைப்பு கவனம் தேவை."],
      ],
      locked: {
        label: "🔒 உங்கள் முழு அறிக்கை திறக்கும்:",
        teaser: "12 வாழ்க்கைப் பகுதிகளும் மதிப்பிடப்படும் · வலுவான 3 பகுதிகள் · சவாலான 3 பகுதிகள் · ஒவ்வொரு மதிப்பெண்ணுக்கான காரணம் · முக்கிய முடிவுகளுக்கான நேர வழிகாட்டுதல்.",
      },
    },
    HI: {
      title: "नमूना · जीवन क्षेत्र संकेतक",
      example: "उदाहरण कुंडली · मिथुन लग्न",
      blocks: [
        ["करियर — मज़बूत", "10वें भाव का स्वामी अच्छी स्थिति में, बृहस्पति की दृष्टि से समर्थित। स्थिर वृद्धि, योग्यता से मान्यता।"],
        ["धन — विकासशील", "2रे और 11वें भाव क्रमिक लाभ दिखाते हैं। सट्टे से सावधानी।"],
        ["संबंध — मिश्रित", "शुक्र समर्थित पर परीक्षित। 30 वर्ष के बाद प्रतिबद्धता गहरी होती है।"],
        ["स्वास्थ्य — स्थिर", "लग्नेश अनाहत है। पाचन तंत्र पर ध्यान दें।"],
      ],
      locked: {
        label: "🔒 आपकी पूरी रिपोर्ट खोलती है:",
        teaser: "सभी 12 जीवन क्षेत्रों का स्कोर · 3 सबसे मज़बूत क्षेत्र · 3 सबसे चुनौतीपूर्ण क्षेत्र · हर स्कोर का कारण · बड़े निर्णयों के लिए समय मार्गदर्शन।",
      },
    },
  },

};

if (typeof window !== "undefined") window.SAMPLES = SAMPLES;
