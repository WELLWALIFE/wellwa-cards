// Parts of five more combined categories (see lib/trade-parts.ts and trade-data/parts.ts): astro, event, courier, security, dance.
// Same rules as types.ts: plain Indian English, natural Hindi, no numbers, no prices, no guarantees, no predictions-as-fact.
import type { TradeLine } from "./types";
import type { TradePart } from "@/lib/trade-parts";

export const PARTS_B: Record<string, TradePart[]> = {
  astro: [
    { key: "astrology", en: "Astrology", hi: "ज्योतिष", label: "Astrologer", labelHi: "ज्योतिषी" },
    { key: "vastu", en: "Vastu", hi: "वास्तु", label: "Vastu consultant", labelHi: "वास्तु सलाहकार" },
    { key: "pandit", en: "Pandit & pooja", hi: "पंडित और पूजा", label: "Pandit", labelHi: "पंडित" },
  ],
  event: [
    { key: "planning", en: "Event planning", hi: "इवेंट प्लानिंग", label: "Event planner", labelHi: "इवेंट प्लानर" },
    { key: "decoration", en: "Decoration", hi: "डेकोरेशन", label: "Decorator", labelHi: "डेकोरेटर" },
    { key: "dj", en: "DJ & sound", hi: "DJ और साउंड", label: "DJ & sound service", labelHi: "DJ और साउंड सर्विस" },
  ],
  courier: [
    { key: "courier", en: "Courier", hi: "कूरियर", label: "Courier service", labelHi: "कूरियर सर्विस" },
    { key: "csc", en: "CSC / e-mitra services", hi: "CSC / ई-मित्र सेवाएँ", label: "CSC / e-mitra centre", labelHi: "CSC / ई-मित्र केंद्र" },
  ],
  security: [
    { key: "security", en: "Security guards", hi: "सुरक्षा गार्ड", label: "Security agency", labelHi: "सिक्योरिटी एजेंसी" },
    { key: "housekeeping", en: "Housekeeping", hi: "हाउसकीपिंग", label: "Housekeeping service", labelHi: "हाउसकीपिंग सर्विस" },
  ],
  dance: [
    { key: "dance", en: "Dance", hi: "डांस", label: "Dance class", labelHi: "डांस क्लास" },
    { key: "music", en: "Music", hi: "संगीत", label: "Music class", labelHi: "म्यूज़िक क्लास" },
    { key: "art", en: "Art & drawing", hi: "आर्ट और ड्रॉइंग", label: "Art class", labelHi: "आर्ट क्लास" },
  ],
};

/** category -> part key -> the English names of the "what you do / offer / sell" tick chips that belong to that part. */
export const TICKS_B: Record<string, Record<string, string[]>> = {
  astro: {
    astrology: ["Kundli", "Match-making", "Gemstones", "Numerology", "Tarot", "Muhurat"],
    vastu: ["Vastu", "Muhurat"],
    pandit: ["Pooja / anushthan", "Muhurat", "Match-making"],
  },
  event: {
    planning: ["Wedding planning", "Birthday parties", "Catering", "Tent house"],
    decoration: ["Decoration", "Lighting", "Flowers / mandap", "Birthday parties", "Tent house"],
    dj: ["DJ / sound", "Lighting", "Birthday parties"],
  },
  courier: {
    courier: ["Courier", "Photocopy / print"],
    csc: ["Money transfer", "Aadhaar / PAN", "Bill payment", "Bus / train tickets", "Photocopy / print", "Bank mitra", "Govt forms"],
  },
  security: {
    security: ["Security guards", "Bouncers", "CCTV", "Event security", "Facility management"],
    housekeeping: ["Housekeeping", "Facility management"],
  },
  dance: {
    dance: ["Classical dance", "Western / hip-hop", "Bollywood"],
    music: ["Singing", "Guitar / keyboard"],
    art: ["Drawing & painting"],
  },
};

/** key "category:part". */
export const SEEDS_B: Record<string, { explain: string[]; services: TradeLine[]; avoid: string[] }> = {
  "astro:astrology": {
    explain: [
      "astrology — kundli reading, kundli matching, muhurat, numerology, tarot, gemstone guidance",
      "consultation in person, on phone or video; what to share (birth date, time, place)",
      "guidance given with patience, explained simply, and kept private",
      "how to book a consultation on WhatsApp",
    ],
    services: [
      { en: "Kundli & horoscope reading", hi: "कुंडली और जन्मपत्री", desc: "Birth chart prepared and explained in simple words, for guidance on career, family and decisions.", descHi: "जन्मकुंडली बनाकर सरल शब्दों में समझाना, करियर, परिवार और फ़ैसलों के मार्गदर्शन के लिए।" },
      { en: "Kundli matching", hi: "कुंडली मिलान", desc: "Matching for marriage, explained clearly and honestly.", descHi: "विवाह के लिए मिलान, साफ़ और सच्ची व्याख्या के साथ।" },
      { en: "Muhurat", hi: "मुहूर्त", desc: "Auspicious dates for marriage, a new home, a new business and travel, as per the panchang.", descHi: "पंचांग के अनुसार विवाह, नए घर, नए काम और यात्रा के शुभ मुहूर्त।" },
      { en: "Numerology & tarot", hi: "अंक ज्योतिष और टैरो", desc: "Name and number guidance, and tarot readings for those who like them.", descHi: "नाम और अंकों का मार्गदर्शन, और जिन्हें पसंद हो उनके लिए टैरो रीडिंग।" },
      { en: "Gemstone guidance", hi: "रत्न परामर्श", desc: "Advice on which stone may suit you, based on your chart.", descHi: "आपकी कुंडली देखकर बताना कि कौन सा रत्न आपके लिए ठीक रहेगा।" },
      { en: "Phone / video consultation", hi: "फ़ोन / वीडियो परामर्श", desc: "Consult from anywhere; share birth details on WhatsApp.", descHi: "कहीं से भी परामर्श; जन्म विवरण WhatsApp पर भेजें।" },
      { en: "Yearly guidance", hi: "सालाना मार्गदर्शन", desc: "A look at the year ahead from your chart, with simple suggestions.", descHi: "आपकी कुंडली से आने वाले साल पर एक नज़र, सरल सुझावों के साथ।" },
    ],
    avoid: ["vastu", "pooja", "havan", "pandit", "griha pravesh", "satyanarayan", "anushthan", "ritual", "temple"],
  },

  "astro:vastu": {
    explain: [
      "vastu — home, flat, shop, office and factory; plot and layout",
      "visit to the site or a plan check over WhatsApp; what to share (plan, direction, photos)",
      "practical suggestions that avoid breaking walls where possible",
      "how to book a visit",
    ],
    services: [
      { en: "Home & flat vastu", hi: "घर और फ़्लैट का वास्तु", desc: "Rooms, kitchen, entrance and bedrooms checked, with practical suggestions.", descHi: "कमरे, किचन, मुख्य द्वार और बेडरूम देखकर व्यावहारिक सुझाव।" },
      { en: "Shop & office vastu", hi: "दुकान और ऑफ़िस का वास्तु", desc: "Seating, cash counter, entrance and storage arranged as per vastu.", descHi: "बैठने की जगह, गल्ला, मुख्य द्वार और स्टोर की व्यवस्था वास्तु के अनुसार।" },
      { en: "Plot & layout check", hi: "प्लॉट और नक़्शे की जाँच", desc: "Plot direction and the building plan checked before construction starts.", descHi: "निर्माण शुरू होने से पहले प्लॉट की दिशा और नक़्शे की जाँच।" },
      { en: "Factory & godown vastu", hi: "फ़ैक्टरी और गोदाम का वास्तु", desc: "Machines, stores and entry points placed with vastu in mind.", descHi: "मशीन, स्टोर और प्रवेश द्वार की जगह वास्तु का ध्यान रखकर।" },
      { en: "Corrections without breaking", hi: "बिना तोड़-फोड़ के सुधार", desc: "Simple changes in placement and colour wherever the building cannot be altered.", descHi: "जहाँ निर्माण बदला नहीं जा सकता, वहाँ चीज़ों की जगह और रंग में सरल बदलाव।" },
      { en: "Online plan review", hi: "ऑनलाइन नक़्शा समीक्षा", desc: "Send the plan and photos on WhatsApp and get suggestions without a visit.", descHi: "नक़्शा और फ़ोटो WhatsApp पर भेजें, बिना विज़िट के सुझाव पाएँ।" },
      { en: "Muhurat for the new place", hi: "नई जगह का मुहूर्त", desc: "A suitable date for griha pravesh or opening a shop.", descHi: "गृह प्रवेश या दुकान खोलने के लिए उचित तारीख़।" },
    ],
    avoid: ["kundli", "horoscope", "pooja", "havan", "pandit", "birth chart", "birth date", "birth details", "gemstone", "tarot", "numerology", "matching", "janam"],
  },

  "astro:pandit": {
    explain: [
      "pooja and rituals — satyanarayan, griha pravesh, navgrah, havan, mundan, namkaran and other samskars",
      "pooja at your home, shop or a temple; samagri arranged if asked",
      "rites done properly in the traditional way, explained as they go",
      "how to book a date and muhurat",
    ],
    services: [
      { en: "Satyanarayan katha", hi: "सत्यनारायण कथा", desc: "Katha and pooja at home on the day you choose.", descHi: "आपके चुने हुए दिन घर पर कथा और पूजा।" },
      { en: "Griha pravesh & vastu shanti", hi: "गृह प्रवेश और वास्तु शांति", desc: "Pooja and havan for a new home or shop.", descHi: "नए घर या दुकान के लिए पूजा और हवन।" },
      { en: "Navgrah & shanti pooja", hi: "नवग्रह और शांति पूजा", desc: "Navgrah and other shanti poojas, done as per the vidhi.", descHi: "नवग्रह और दूसरी शांति पूजा, विधि के अनुसार।" },
      { en: "Havan & anushthan", hi: "हवन और अनुष्ठान", desc: "Havan, path and anushthan at home or at a temple.", descHi: "घर या मंदिर में हवन, पाठ और अनुष्ठान।" },
      { en: "Samskars", hi: "संस्कार", desc: "Mundan, namkaran, janeu and other samskars, done with the rites explained.", descHi: "मुंडन, नामकरण, जनेऊ और दूसरे संस्कार, विधि समझाते हुए।" },
      { en: "Wedding rites", hi: "विवाह के संस्कार", desc: "Pheras and wedding poojas for the whole family.", descHi: "पूरे परिवार के लिए फेरे और विवाह की पूजा।" },
      { en: "Pooja samagri", hi: "पूजा सामग्री", desc: "All the samagri needed, arranged on request.", descHi: "ज़रूरी पूरी सामग्री, कहने पर इंतज़ाम।" },
    ],
    avoid: ["kundli", "horoscope", "vastu consultation", "birth chart", "birth date", "birth details", "gemstone", "tarot", "numerology", "phone consultation", "video consultation"],
  },

  "event:planning": {
    explain: [
      "event planning — weddings, engagements, birthdays, anniversaries, corporate events",
      "venue, caterer and vendors arranged, with a plan and a schedule for the day",
      "budget and theme discussed with the family first",
      "someone from the team on the spot on the day",
    ],
    services: [
      { en: "Wedding planning", hi: "शादी की प्लानिंग", desc: "From the first meeting to the last rasam, the whole function planned with the family.", descHi: "पहली मीटिंग से आख़िरी रस्म तक, पूरे फ़ंक्शन की परिवार के साथ प्लानिंग।" },
      { en: "Engagement, sangeet & mehendi", hi: "सगाई, संगीत और मेहंदी", desc: "Smaller functions planned with their own schedule and flow.", descHi: "छोटे फ़ंक्शन की अपनी अलग योजना और कार्यक्रम के साथ प्लानिंग।" },
      { en: "Birthday & anniversary parties", hi: "जन्मदिन और सालगिरह पार्टी", desc: "Theme, venue and the day's programme sorted for you.", descHi: "थीम, जगह और दिन का कार्यक्रम, सब हम सँभालते हैं।" },
      { en: "Corporate events", hi: "कॉर्पोरेट इवेंट", desc: "Conferences, product launches, team meets and office celebrations.", descHi: "कॉन्फ़्रेंस, प्रोडक्ट लॉन्च, टीम मीट और ऑफ़िस के जश्न।" },
      { en: "Venue & vendor coordination", hi: "वेन्यू और वेंडर तालमेल", desc: "Venue, caterer, photographer and other vendors found and managed.", descHi: "वेन्यू, कैटरर, फ़ोटोग्राफ़र और दूसरे वेंडर ढूँढना और सँभालना।" },
      { en: "On-the-day management", hi: "दिन का पूरा संचालन", desc: "A team on the spot so the family can enjoy the function.", descHi: "टीम मौक़े पर रहती है ताकि परिवार फ़ंक्शन का आनंद ले सके।" },
      { en: "Guest handling", hi: "मेहमानों की देखभाल", desc: "Invitations, welcome, seating and stay arrangements for guests.", descHi: "निमंत्रण, स्वागत, बैठने और ठहरने का इंतज़ाम।" },
    ],
    avoid: ["sound system", "dj & sound", "dj and sound", "dj / sound", "mandap", "flower work", "balloon decor", "tent house", "lighting rig"],
  },

  "event:decoration": {
    explain: [
      "decoration — wedding stage, mandap, entrance, flowers, balloons, lights, themes",
      "birthdays, weddings, receptions, baby showers, housewarming and shop openings",
      "design and theme shown first; setup ready before guests arrive",
      "venue types you work at — home, hall, lawn, banquet",
    ],
    services: [
      { en: "Wedding stage & mandap", hi: "शादी का स्टेज और मंडप", desc: "Stage, mandap and backdrop made to your theme.", descHi: "आपकी थीम के अनुसार स्टेज, मंडप और बैकड्रॉप।" },
      { en: "Entrance & hall decor", hi: "एंट्री और हॉल की सजावट", desc: "Gate, pathway, tables and seating decorated to match.", descHi: "गेट, रास्ता, टेबल और बैठने की जगह की मेल खाती सजावट।" },
      { en: "Flower decoration", hi: "फूलों की सजावट", desc: "Fresh and artificial flowers for stage, car and haldi-mehendi.", descHi: "स्टेज, गाड़ी और हल्दी-मेहंदी के लिए ताज़े और आर्टिफ़िशियल फूल।" },
      { en: "Balloon & birthday decor", hi: "बैलून और जन्मदिन की सजावट", desc: "Balloon arches, theme setups and photo corners at home or a hall.", descHi: "घर या हॉल में बैलून आर्क, थीम सेटअप और फ़ोटो कॉर्नर।" },
      { en: "Lighting decor", hi: "लाइटिंग से सजावट", desc: "Fairy lights, focus lights and decorative lighting for the venue.", descHi: "वेन्यू के लिए फ़ेयरी लाइट, फ़ोकस लाइट और सजावटी रोशनी।" },
      { en: "Theme decor", hi: "थीम डेकोर", desc: "Baby shower, anniversary, haldi, mehendi and cocktail themes.", descHi: "बेबी शावर, सालगिरह, हल्दी, मेहंदी और कॉकटेल की थीम।" },
      { en: "Shop & housewarming decor", hi: "दुकान और गृह प्रवेश की सजावट", desc: "Opening day and housewarming decoration, neat and quick.", descHi: "उद्घाटन और गृह प्रवेश की साफ़-सुथरी, जल्दी की सजावट।" },
    ],
    avoid: ["sound system", "dj & sound", "dj and sound", "dj / sound", "catering", "wedding planning", "event planning", "full event management", "corporate event", "microphone"],
  },

  "event:dj": {
    explain: [
      "DJ and sound — sangeet, wedding, baraat, birthday and club-style parties",
      "sound system, mic, speakers and DJ lights for homes, halls and open lawns",
      "songs and playlist planned with the family; volume kept sensible",
      "setup and sound check before the guests arrive",
    ],
    services: [
      { en: "Wedding & sangeet DJ", hi: "शादी और संगीत का DJ", desc: "DJ for sangeet, cocktail and the wedding night, with the songs you choose.", descHi: "संगीत, कॉकटेल और शादी की रात के लिए DJ, आपके चुने गानों के साथ।" },
      { en: "Baraat sound", hi: "बारात का साउंड", desc: "DJ vehicle, dhol and sound for the baraat.", descHi: "बारात के लिए DJ गाड़ी, ढोल और साउंड।" },
      { en: "Birthday & party DJ", hi: "जन्मदिन और पार्टी DJ", desc: "Music, lights and an emcee for birthdays and house parties.", descHi: "जन्मदिन और घर की पार्टी के लिए म्यूज़िक, लाइट और एंकर।" },
      { en: "Sound system on hire", hi: "किराये पर साउंड सिस्टम", desc: "Speakers, mixers and mics for functions, puja, meetings and programmes.", descHi: "फ़ंक्शन, पूजा, मीटिंग और कार्यक्रमों के लिए स्पीकर, मिक्सर और माइक।" },
      { en: "DJ lights & effects", hi: "DJ लाइट और इफ़ेक्ट", desc: "Moving lights, laser and smoke effects for the dance floor.", descHi: "डांस फ़्लोर के लिए मूविंग लाइट, लेज़र और स्मोक इफ़ेक्ट।" },
      { en: "Anchor & emcee", hi: "एंकर और संचालन", desc: "A host to run the programme and keep the guests engaged.", descHi: "कार्यक्रम चलाने और मेहमानों को जोड़े रखने के लिए एंकर।" },
      { en: "Playlist planning", hi: "प्लेलिस्ट की तैयारी", desc: "Your favourite songs lined up in advance for each function.", descHi: "हर फ़ंक्शन के लिए आपके पसंदीदा गाने पहले से तैयार।" },
    ],
    avoid: ["decoration", "decor", "mandap", "flower", "balloon", "catering", "wedding planning", "tent", "full event management", "stage setup", "event planning"],
  },

  "courier:courier": {
    explain: [
      "courier and parcels — documents, parcels and cargo within the city, across India and abroad",
      "pickup from home or shop, packing done properly",
      "tracking shared on WhatsApp until delivery",
      "what to share to book: pickup address, destination, weight and kind of goods",
    ],
    services: [
      { en: "Document courier", hi: "दस्तावेज़ कूरियर", desc: "Letters, certificates and files sent quickly and safely.", descHi: "चिट्ठी, प्रमाणपत्र और फ़ाइलें जल्दी और सुरक्षित भेजना।" },
      { en: "Parcel delivery across India", hi: "पूरे भारत में पार्सल", desc: "Boxes and parcels sent to any town, with tracking.", descHi: "किसी भी शहर तक डिब्बे और पार्सल, ट्रैकिंग के साथ।" },
      { en: "International courier", hi: "अंतरराष्ट्रीय कूरियर", desc: "Documents and gifts sent abroad, with the paperwork guided.", descHi: "विदेश में दस्तावेज़ और तोहफ़े भेजना, काग़ज़ी काम में मदद के साथ।" },
      { en: "Pickup from home or shop", hi: "घर या दुकान से पिकअप", desc: "We collect the parcel from your door.", descHi: "पार्सल हम आपके दरवाज़े से ले जाते हैं।" },
      { en: "Packing service", hi: "पैकिंग सर्विस", desc: "Boxes, bubble wrap and careful packing for fragile items.", descHi: "नाज़ुक सामान के लिए डिब्बे, बबल रैप और ध्यान से पैकिंग।" },
      { en: "Business & bulk courier", hi: "कारोबार और बल्क कूरियर", desc: "Regular dispatch for shops, online sellers and offices.", descHi: "दुकान, ऑनलाइन विक्रेता और ऑफ़िस के लिए नियमित डिस्पैच।" },
      { en: "Tracking on WhatsApp", hi: "WhatsApp पर ट्रैकिंग", desc: "The tracking number and updates shared until it is delivered.", descHi: "डिलीवरी तक ट्रैकिंग नंबर और अपडेट साझा करना।" },
    ],
    avoid: ["aadhaar", "pan card", "bill payment", "money transfer", "recharge", "xerox", "e-mitra", "csc", "government form", "govt form", "scholarship", "train ticket", "bank mitra"],
  },

  "courier:csc": {
    explain: [
      "CSC / e-mitra services — Aadhaar, PAN, certificates, government schemes, online forms",
      "bill payment, money transfer, bank mitra, tickets",
      "xerox, print, scan and lamination",
      "forms filled for people who need help; what documents to bring",
    ],
    services: [
      { en: "Aadhaar & PAN services", hi: "आधार और PAN सेवाएँ", desc: "New applications, corrections and printouts.", descHi: "नया आवेदन, सुधार और प्रिंटआउट।" },
      { en: "Certificates & govt schemes", hi: "प्रमाणपत्र और सरकारी योजनाएँ", desc: "Income, caste and domicile certificates and scheme applications.", descHi: "आय, जाति और निवास प्रमाणपत्र और योजनाओं के आवेदन।" },
      { en: "Online forms", hi: "ऑनलाइन फ़ॉर्म", desc: "Scholarships, exam forms, job applications and results.", descHi: "छात्रवृत्ति, परीक्षा फ़ॉर्म, नौकरी के आवेदन और रिज़ल्ट।" },
      { en: "Bill payment & recharge", hi: "बिल भुगतान और रिचार्ज", desc: "Electricity, water, gas and phone bills paid at the counter.", descHi: "बिजली, पानी, गैस और फ़ोन के बिल काउंटर पर भरें।" },
      { en: "Money transfer & bank mitra", hi: "मनी ट्रांसफ़र और बैंक मित्र", desc: "Send money, deposit and withdraw cash through the bank mitra.", descHi: "पैसे भेजें, बैंक मित्र के ज़रिए नक़द जमा और निकासी।" },
      { en: "Train & bus tickets", hi: "ट्रेन और बस टिकट", desc: "Tickets booked for you without the online hassle.", descHi: "ऑनलाइन की झंझट के बिना आपके लिए टिकट बुकिंग।" },
      { en: "Xerox, print & scan", hi: "ज़ेरॉक्स, प्रिंट और स्कैन", desc: "Photocopies, colour prints, lamination and scanning.", descHi: "फ़ोटोकॉपी, रंगीन प्रिंट, लैमिनेशन और स्कैनिंग।" },
    ],
    avoid: ["courier", "parcel", "tracking", "dispatch", "consignment", "cargo", "pickup from", "international shipping", "packing for"],
  },

  "security:security": {
    explain: [
      "security guards — for societies, offices, factories, shops, schools, banks and events",
      "trained guards in uniform, ID-checked, with supervisor visits",
      "day and night shifts, and event or bouncer staff as needed",
      "how a requirement is understood, a guard sent and the arrangement supervised",
    ],
    services: [
      { en: "Security guards", hi: "सुरक्षा गार्ड", desc: "Trained, uniformed guards for gates, buildings and premises.", descHi: "गेट, इमारत और परिसर के लिए प्रशिक्षित, वर्दीधारी गार्ड।" },
      { en: "Society & apartment security", hi: "सोसाइटी और अपार्टमेंट सुरक्षा", desc: "Gate, visitor register and patrol for residential complexes.", descHi: "रिहायशी परिसर के लिए गेट, विज़िटर रजिस्टर और गश्त।" },
      { en: "Office & factory guards", hi: "ऑफ़िस और फ़ैक्टरी गार्ड", desc: "Entry control and watch for offices, factories and godowns.", descHi: "ऑफ़िस, फ़ैक्टरी और गोदाम के लिए प्रवेश नियंत्रण और निगरानी।" },
      { en: "Event security & bouncers", hi: "इवेंट सुरक्षा और बाउंसर", desc: "Crowd handling for weddings, parties, functions and shows.", descHi: "शादी, पार्टी, फ़ंक्शन और शो में भीड़ सँभालना।" },
      { en: "Night patrol & watchman", hi: "रात की गश्त और चौकीदार", desc: "Watchmen and patrol for shops, sites and colonies.", descHi: "दुकान, साइट और कॉलोनी के लिए चौकीदार और गश्त।" },
      { en: "CCTV & supervision", hi: "CCTV और निगरानी", desc: "CCTV watch and supervisor checks along with the guards.", descHi: "गार्ड के साथ CCTV की निगरानी और सुपरवाइज़र की जाँच।" },
      { en: "Female guards", hi: "महिला गार्ड", desc: "Women guards for schools, hostels, malls and offices where needed.", descHi: "जहाँ ज़रूरत हो, स्कूल, हॉस्टल, मॉल और ऑफ़िस के लिए महिला गार्ड।" },
    ],
    avoid: ["housekeeping", "cleaning", "sweeper", "janitor", "pantry", "washroom", "mopping", "cleaner", "garbage"],
  },

  "security:housekeeping": {
    explain: [
      "housekeeping — cleaning staff for offices, hospitals, schools, malls, societies and factories",
      "sweeping, mopping, washrooms, pantry and garbage handling, with machines if needed",
      "trained staff in uniform, with a supervisor, cleaning material supplied",
      "how a requirement is understood, staff sent and the work supervised",
    ],
    services: [
      { en: "Office housekeeping", hi: "ऑफ़िस हाउसकीपिंग", desc: "Daily cleaning of desks, floors, washrooms and common areas.", descHi: "डेस्क, फ़र्श, वॉशरूम और साझा जगहों की रोज़ की सफ़ाई।" },
      { en: "Society & complex cleaning", hi: "सोसाइटी और परिसर की सफ़ाई", desc: "Lobbies, stairs, lifts and compound kept clean every day.", descHi: "लॉबी, सीढ़ियाँ, लिफ़्ट और कंपाउंड रोज़ साफ़।" },
      { en: "Hospital & school housekeeping", hi: "अस्पताल और स्कूल हाउसकीपिंग", desc: "Careful cleaning of wards, classrooms and washrooms.", descHi: "वार्ड, क्लासरूम और वॉशरूम की ध्यान से सफ़ाई।" },
      { en: "Washroom & pantry care", hi: "वॉशरूम और पैंट्री की देखभाल", desc: "Regular cleaning and refilling of washroom and pantry items.", descHi: "वॉशरूम और पैंट्री की नियमित सफ़ाई और सामान की भराई।" },
      { en: "Machine cleaning", hi: "मशीन से सफ़ाई", desc: "Floor scrubbing and vacuum cleaning for large spaces.", descHi: "बड़ी जगहों के लिए फ़र्श स्क्रबिंग और वैक्यूम सफ़ाई।" },
      { en: "Housekeeping staff supply", hi: "हाउसकीपिंग स्टाफ़ सप्लाई", desc: "Trained cleaners, supervisors and helpers sent to your site.", descHi: "प्रशिक्षित सफ़ाईकर्मी, सुपरवाइज़र और हेल्पर आपकी साइट पर।" },
      { en: "Garbage & waste handling", hi: "कचरा प्रबंधन", desc: "Daily collection and neat disposal of waste from the premises.", descHi: "परिसर से कचरे का रोज़ उठाव और सलीक़े से निपटान।" },
    ],
    avoid: ["security", "guard", "bouncer", "cctv", "patrol", "watchman", "access control", "gate duty", "crowd"],
  },

  "dance:dance": {
    explain: [
      "dance styles taught — classical, Bollywood, western, hip-hop, folk; for which ages",
      "batches for kids and adults, beginners to advanced; hobby and stage",
      "annual shows, competitions and wedding or sangeet choreography",
      "how to join: trial class, message on WhatsApp",
    ],
    services: [
      { en: "Classical dance", hi: "शास्त्रीय नृत्य", desc: "Kathak, Bharatanatyam and other classical styles, step by step.", descHi: "कथक, भरतनाट्यम और दूसरी शास्त्रीय शैलियाँ, धीरे-धीरे सिखाई जाती हैं।" },
      { en: "Bollywood dance", hi: "बॉलीवुड डांस", desc: "Filmi songs and steps for kids, teens and adults.", descHi: "बच्चों, किशोरों और बड़ों के लिए फ़िल्मी गानों पर डांस।" },
      { en: "Western & hip-hop", hi: "वेस्टर्न और हिप-हॉप", desc: "Hip-hop, freestyle and contemporary for beginners and above.", descHi: "शुरुआत से आगे के लिए हिप-हॉप, फ़्रीस्टाइल और कंटेम्परेरी।" },
      { en: "Kids' batches", hi: "बच्चों के बैच", desc: "Age-wise groups with fun, step-by-step learning.", descHi: "उम्र के हिसाब से ग्रुप, मज़े के साथ धीरे-धीरे सीखना।" },
      { en: "Wedding & sangeet choreography", hi: "शादी और संगीत कोरियोग्राफ़ी", desc: "Dances for families and couples, taught in a few sessions.", descHi: "परिवार और जोड़ों के लिए डांस, कुछ सेशन में तैयार।" },
      { en: "Stage shows & competitions", hi: "स्टेज शो और प्रतियोगिताएँ", desc: "Annual shows and a chance to perform on stage.", descHi: "सालाना शो और स्टेज पर प्रस्तुति का मौक़ा।" },
      { en: "Fitness dance", hi: "फ़िटनेस डांस", desc: "Zumba-style classes for those who want to stay active.", descHi: "सक्रिय रहने के इच्छुक लोगों के लिए ज़ुम्बा जैसी क्लास।" },
    ],
    avoid: ["singing", "vocal", "harmonium", "guitar", "keyboard", "tabla", "drawing", "painting", "sketch", "craft", "instrument", "art class", "art & craft", "art and craft", "music exam"],
  },

  "dance:music": {
    explain: [
      "music taught — vocal, harmonium, keyboard, guitar, tabla and other instruments; for which ages",
      "batches for kids and adults, beginners to advanced; hobby and exams",
      "recitals, annual programmes and stage performance",
      "how to join: trial class, message on WhatsApp",
    ],
    services: [
      { en: "Vocal music", hi: "गायन", desc: "Classical, light and film singing, with voice and rhythm basics.", descHi: "शास्त्रीय, सुगम और फ़िल्मी गायन, आवाज़ और ताल की बुनियाद के साथ।" },
      { en: "Harmonium & keyboard", hi: "हारमोनियम और कीबोर्ड", desc: "Playing from the first notes to full songs.", descHi: "पहले सुरों से पूरे गाने बजाने तक।" },
      { en: "Guitar", hi: "गिटार", desc: "Chords, strumming and songs for kids and adults.", descHi: "बच्चों और बड़ों के लिए कॉर्ड, स्ट्रमिंग और गाने।" },
      { en: "Tabla & percussion", hi: "तबला और ताल वाद्य", desc: "Taal, theka and playing along with songs.", descHi: "ताल, ठेका और गानों के साथ बजाना।" },
      { en: "Kids' batches", hi: "बच्चों के बैच", desc: "Age-wise groups with fun, step-by-step learning.", descHi: "उम्र के हिसाब से ग्रुप, मज़े के साथ धीरे-धीरे सीखना।" },
      { en: "Exams & certification", hi: "परीक्षा और सर्टिफ़िकेट", desc: "Preparation for recognised music examinations.", descHi: "मान्यता प्राप्त संगीत परीक्षाओं की तैयारी।" },
      { en: "Recitals & annual programme", hi: "प्रस्तुति और सालाना कार्यक्रम", desc: "A chance for students to perform in front of family and friends.", descHi: "विद्यार्थियों को परिवार और दोस्तों के सामने प्रस्तुति का मौक़ा।" },
    ],
    avoid: ["dance", "choreograph", "drawing", "painting", "sketch", "craft", "zumba", "kathak", "bharatanatyam", "hip-hop", "art class", "art & craft", "art and craft"],
  },

  "dance:art": {
    explain: [
      "art taught — drawing, sketching, painting, colouring and craft; for which ages",
      "batches for kids and adults, beginners to advanced; hobby and school exams",
      "mediums used — pencil, colour, water colour, poster colour, canvas",
      "how to join: trial class, message on WhatsApp",
    ],
    services: [
      { en: "Drawing & sketching", hi: "ड्रॉइंग और स्केचिंग", desc: "Pencil and shading basics, from simple shapes to full sketches.", descHi: "पेंसिल और शेडिंग की बुनियाद, सरल आकारों से पूरे स्केच तक।" },
      { en: "Painting", hi: "पेंटिंग", desc: "Water colour, poster colour and acrylic on paper and canvas.", descHi: "काग़ज़ और कैनवास पर वॉटर कलर, पोस्टर कलर और एक्रिलिक।" },
      { en: "Kids' art batches", hi: "बच्चों के आर्ट बैच", desc: "Colouring, drawing and fun projects, age-wise.", descHi: "उम्र के हिसाब से रंग भरना, ड्रॉइंग और मज़ेदार प्रोजेक्ट।" },
      { en: "Craft", hi: "क्राफ़्ट", desc: "Paper craft, clay work and decorative items made by hand.", descHi: "पेपर क्राफ़्ट, मिट्टी का काम और हाथ से बनी सजावटी चीज़ें।" },
      { en: "School art help", hi: "स्कूल आर्ट में मदद", desc: "Help with school drawing work, projects and art exams.", descHi: "स्कूल के ड्रॉइंग काम, प्रोजेक्ट और आर्ट परीक्षा में मदद।" },
      { en: "Adult hobby classes", hi: "बड़ों की हॉबी क्लास", desc: "Relaxed batches for adults who want to learn painting for pleasure.", descHi: "शौक़ से पेंटिंग सीखने वाले बड़ों के लिए आराम से चलने वाले बैच।" },
    ],
    avoid: ["dance", "choreograph", "singing", "vocal", "harmonium", "guitar", "keyboard", "tabla", "instrument", "music", "zumba"],
  },
};
