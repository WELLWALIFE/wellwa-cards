// Business categories for the daily poster: each sets a sensible persona,
// default style, accent colour and a tagline hint so a new user gets a
// professional look in one tap. Grouped for the picker.
import type { Persona } from "@/lib/poster-client";

export type Category = { key: string; hi: string; en: string; group: string; persona: Persona; style: string; accent: string; hint: string };
const c = (key: string, hi: string, en: string, group: string, persona: Persona, style: string, accent: string, hint: string): Category => ({ key, hi, en, group, persona, style, accent, hint });

export const CATEGORIES: Category[] = [
  // retail
  c("kirana", "किराना / जनरल स्टोर", "Kirana / general store", "Retail", "business", "bold", "#f59e0b", "दुकान का नाम"),
  c("garments", "कपड़े / गारमेंट्स", "Clothing / garments", "Retail", "business", "clean", "#db2777", "शोरूम का नाम"),
  c("jewellery", "ज्वेलरी / सुनार", "Jewellery", "Retail", "business", "festive", "#d4af37", "ज्वेलर्स का नाम"),
  c("mobile", "मोबाइल / इलेक्ट्रॉनिक्स", "Mobile / electronics", "Retail", "business", "bold", "#2563eb", "शॉप का नाम"),
  c("furniture", "फ़र्नीचर / होम डेकोर", "Furniture / home decor", "Retail", "business", "minimal", "#92400e", "शोरूम का नाम"),
  c("hardware", "हार्डवेयर / पेंट / सैनिटरी", "Hardware / paint / sanitary", "Retail", "business", "bold", "#dc2626", "दुकान का नाम"),
  c("medical", "मेडिकल स्टोर", "Medical store", "Retail", "business", "clean", "#0e9e90", "मेडिकल का नाम"),
  c("sweets", "मिठाई / बेकरी", "Sweets / bakery", "Retail", "business", "festive", "#ea580c", "दुकान का नाम"),
  c("grocery-online", "ऑनलाइन स्टोर / ई-कॉमर्स", "Online store", "Retail", "business", "clean", "#7c3aed", "स्टोर का नाम"),
  c("gift", "गिफ्ट / स्टेशनरी", "Gift / stationery", "Retail", "business", "festive", "#db2777", "दुकान का नाम"),
  c("optical", "ऑप्टिकल / चश्मा", "Optical", "Retail", "business", "clean", "#0369a1", "ऑप्टिकल्स का नाम"),
  c("footwear", "फुटवियर", "Footwear", "Retail", "business", "bold", "#1f2937", "शॉप का नाम"),
  // food & hospitality
  c("restaurant", "रेस्टोरेंट / ढाबा", "Restaurant / dhaba", "Food", "business", "festive", "#b91c1c", "रेस्टोरेंट का नाम"),
  c("cafe", "कैफ़े / चाय", "Cafe / tea stall", "Food", "business", "minimal", "#78350f", "कैफ़े का नाम"),
  c("tiffin", "टिफ़िन / होम फ़ूड", "Tiffin / home food", "Food", "home", "clean", "#f59e0b", "जैसे: रीना का किचन"),
  c("catering", "कैटरिंग / हलवाई", "Catering", "Food", "business", "festive", "#c2410c", "कैटरर्स का नाम"),
  c("hotel", "होटल / लॉज / रिसॉर्ट", "Hotel / resort", "Food", "business", "minimal", "#0f766e", "होटल का नाम"),
  // health & beauty
  c("doctor", "डॉक्टर / क्लिनिक", "Doctor / clinic", "Health", "professional", "clean", "#0369a1", "जैसे: MBBS, MD — शर्मा क्लिनिक"),
  c("hospital", "हॉस्पिटल / नर्सिंग होम", "Hospital", "Health", "business", "clean", "#0e9e90", "हॉस्पिटल का नाम"),
  c("dentist", "डेंटिस्ट", "Dentist", "Health", "professional", "clean", "#0891b2", "क्लिनिक का नाम"),
  c("ayurveda", "आयुर्वेद / होम्योपैथी", "Ayurveda / homeopathy", "Health", "professional", "traditional", "#166534", "क्लिनिक / वैद्य"),
  c("pharma", "फ़ार्मा / मेडिकल रिप्रेज़ेंटेटिव", "Pharma", "Health", "professional", "clean", "#0e9e90", "कंपनी का नाम"),
  c("gym", "जिम / फ़िटनेस / योग", "Gym / fitness / yoga", "Health", "business", "bold", "#dc2626", "जिम का नाम"),
  c("salon", "सैलून / ब्यूटी पार्लर", "Salon / beauty parlour", "Health", "home", "minimal", "#db2777", "पार्लर का नाम"),
  c("spa", "स्पा / मसाज", "Spa", "Health", "business", "minimal", "#7c3aed", "स्पा का नाम"),
  c("water", "वॉटर आयोनाइज़र / प्यूरीफ़ायर", "Water ionizer / purifier", "Health", "business", "clean", "#0e9e90", "Authorised Distributor"),
  c("wellness", "वेलनेस / हेल्थ प्रोडक्ट्स", "Wellness products", "Health", "business", "clean", "#16a34a", "कंपनी / डिस्ट्रीब्यूटर"),
  // services
  c("ca", "CA / अकाउंटेंट / टैक्स", "CA / accountant / tax", "Services", "professional", "clean", "#1e3a8a", "जैसे: CA राजेश शर्मा"),
  c("lawyer", "वकील / एडवोकेट", "Lawyer / advocate", "Services", "professional", "traditional", "#111827", "Advocate, हाईकोर्ट"),
  c("insurance", "इंश्योरेंस / LIC एजेंट", "Insurance / LIC agent", "Services", "professional", "clean", "#1d4ed8", "LIC Advisor"),
  c("finance", "लोन / फ़ाइनेंस / म्यूचुअल फ़ंड", "Loans / finance / MF", "Services", "professional", "clean", "#0f766e", "Financial Advisor"),
  c("realestate", "रियल एस्टेट / प्रॉपर्टी", "Real estate / property", "Services", "business", "bold", "#b45309", "प्रॉपर्टी डीलर"),
  c("builder", "बिल्डर / कंस्ट्रक्शन", "Builder / construction", "Services", "business", "bold", "#374151", "कंपनी का नाम"),
  c("interior", "इंटीरियर / आर्किटेक्ट", "Interior / architect", "Services", "professional", "minimal", "#0f172a", "स्टूडियो का नाम"),
  c("travel", "ट्रैवल / टूर / टिकट", "Travel / tours", "Services", "business", "festive", "#0284c7", "ट्रैवल्स का नाम"),
  c("transport", "ट्रांसपोर्ट / लॉजिस्टिक्स", "Transport / logistics", "Services", "business", "bold", "#1f2937", "कंपनी का नाम"),
  c("auto", "ऑटो / गैराज / शोरूम", "Auto / garage / showroom", "Services", "business", "bold", "#dc2626", "गैराज का नाम"),
  c("electrician", "इलेक्ट्रीशियन / प्लंबर / AC", "Electrician / plumber / AC", "Services", "home", "bold", "#2563eb", "सर्विस का नाम"),
  c("photography", "फ़ोटोग्राफ़ी / स्टूडियो", "Photography / studio", "Services", "professional", "minimal", "#111827", "स्टूडियो का नाम"),
  c("event", "इवेंट / डेकोरेशन / DJ", "Events / decoration / DJ", "Services", "business", "festive", "#7c3aed", "इवेंट्स का नाम"),
  c("printing", "प्रिंटिंग / फ़्लेक्स / डिज़ाइन", "Printing / design", "Services", "business", "bold", "#db2777", "प्रेस का नाम"),
  c("it", "IT / सॉफ़्टवेयर / डिजिटल मार्केटिंग", "IT / software / digital", "Services", "business", "clean", "#4f46e5", "कंपनी का नाम"),
  c("security", "सिक्योरिटी / हाउसकीपिंग", "Security / housekeeping", "Services", "business", "clean", "#1f2937", "एजेंसी का नाम"),
  c("cleaning", "पेस्ट कंट्रोल / क्लीनिंग", "Pest control / cleaning", "Services", "business", "clean", "#16a34a", "सर्विस का नाम"),
  c("tailor", "टेलर / बुटीक", "Tailor / boutique", "Services", "home", "festive", "#db2777", "बुटीक का नाम"),
  c("mehndi", "मेहंदी / मेकअप आर्टिस्ट", "Mehndi / makeup artist", "Services", "home", "festive", "#b91c1c", "आर्टिस्ट का नाम"),
  c("astro", "ज्योतिष / वास्तु / पंडित", "Astrology / vastu / pandit", "Services", "professional", "traditional", "#ff9933", "पं. / आचार्य"),
  c("courier", "कूरियर / मनी ट्रांसफ़र / CSC", "Courier / CSC / e-mitra", "Services", "business", "clean", "#0369a1", "सेंटर का नाम"),
  // education
  c("school", "स्कूल / प्ले स्कूल", "School / play school", "Education", "business", "clean", "#2563eb", "स्कूल का नाम"),
  c("coaching", "कोचिंग / ट्यूशन", "Coaching / tuition", "Education", "home", "bold", "#7c3aed", "इंस्टीट्यूट का नाम"),
  c("college", "कॉलेज / यूनिवर्सिटी", "College", "Education", "business", "clean", "#1e3a8a", "कॉलेज का नाम"),
  c("computer", "कंप्यूटर / स्किल सेंटर", "Computer / skill centre", "Education", "business", "clean", "#0891b2", "सेंटर का नाम"),
  c("teacher", "टीचर / ट्रेनर", "Teacher / trainer", "Education", "professional", "clean", "#0e9e90", "विषय, स्कूल"),
  c("dance", "डांस / म्यूज़िक / आर्ट क्लास", "Dance / music / art class", "Education", "home", "festive", "#db2777", "एकेडमी का नाम"),
  c("student", "छात्र / बच्चे", "Student", "Education", "student", "festive", "#f59e0b", "स्कूल / कक्षा"),
  // network & sales
  c("mlm", "नेटवर्क मार्केटिंग / डायरेक्ट सेलिंग", "Network marketing", "Sales", "business", "clean", "#0e9e90", "Independent Distributor"),
  c("distributor", "डिस्ट्रीब्यूटर / डीलर / एजेंसी", "Distributor / dealer", "Sales", "business", "bold", "#2563eb", "Authorised Dealer"),
  c("sales", "सेल्स / मार्केटिंग एग्ज़ीक्यूटिव", "Sales executive", "Sales", "professional", "clean", "#1d4ed8", "पद, कंपनी"),
  c("agent", "एजेंट / कमीशन एजेंट", "Agent", "Sales", "professional", "clean", "#b45309", "किसका एजेंट"),
  // agriculture & industry
  c("agri", "कृषि / खाद-बीज / कृषि केंद्र", "Agriculture / seeds", "Industry", "business", "traditional", "#16a34a", "कृषि केंद्र का नाम"),
  c("dairy", "डेयरी / दूध", "Dairy", "Industry", "business", "clean", "#0369a1", "डेयरी का नाम"),
  c("manufacturer", "मैन्युफ़ैक्चरर / फ़ैक्टरी", "Manufacturer", "Industry", "business", "bold", "#374151", "कंपनी का नाम"),
  c("wholesale", "होलसेल / ट्रेडिंग", "Wholesale / trading", "Industry", "business", "bold", "#b45309", "फ़र्म का नाम"),
  c("textile", "टेक्सटाइल / साड़ी", "Textile / sarees", "Industry", "business", "festive", "#db2777", "फ़र्म का नाम"),
  // community & political
  c("political", "राजनीति / नेता / कार्यकर्ता", "Politics / leader / karyakarta", "Community", "community", "bold", "#ff9933", "पद और पार्टी"),
  c("mla", "MLA / MP / पार्षद / सरपंच", "MLA / MP / councillor / sarpanch", "Community", "community", "bold", "#ff9933", "पद और क्षेत्र"),
  c("ngo", "NGO / समाजसेवी", "NGO / social worker", "Community", "community", "clean", "#16a34a", "संस्था का नाम"),
  c("samaj", "समाज / जाति संगठन / समिति", "Samaj / samiti", "Community", "community", "traditional", "#b91c1c", "पद और समिति"),
  c("temple", "मंदिर / धार्मिक ट्रस्ट", "Temple / religious trust", "Community", "community", "traditional", "#ff9933", "ट्रस्ट का नाम"),
  c("club", "क्लब / लायंस / रोटरी", "Club / Lions / Rotary", "Community", "community", "clean", "#1e3a8a", "पद और क्लब"),
  c("union", "यूनियन / एसोसिएशन", "Union / association", "Community", "community", "bold", "#dc2626", "पद और एसोसिएशन"),
  c("housing", "हाउसिंग सोसाइटी / RWA", "Housing society / RWA", "Community", "community", "clean", "#0f766e", "पद और सोसाइटी"),
  // personal
  c("personal", "व्यक्तिगत / परिवार", "Personal / family", "Personal", "personal", "festive", "#f59e0b", "जैसे: सपरिवार"),
  c("employee", "नौकरी / कर्मचारी", "Employee", "Personal", "professional", "clean", "#1d4ed8", "पद और कंपनी"),
  c("govt", "सरकारी अधिकारी / कर्मचारी", "Government officer", "Personal", "professional", "traditional", "#1e3a8a", "पद और विभाग"),
  c("army", "सेना / पुलिस / रिटायर्ड", "Army / police / retired", "Personal", "professional", "bold", "#166534", "पद / रैंक"),
  c("influencer", "इन्फ़्लुएंसर / क्रिएटर", "Influencer / creator", "Personal", "professional", "minimal", "#db2777", "आपका handle"),
  c("other", "अन्य", "Other", "Personal", "business", "classic", "#0e9e90", "नाम / पद"),
];
export const CATEGORY_GROUPS = [...new Set(CATEGORIES.map((c) => c.group))];
export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? null;

export const STYLE_LIST: { key: string; hi: string; en: string; emoji: string }[] = [
  // Signature (30 Sep 2026): the default look of paid profiles — a real photo of the trade, the day's hook line,
  // the owner's five highlights and a WhatsApp button; "Classic Gold" is its serif / gold twin. The six below are the originals.
  { key: "signature", hi: "सिग्नेचर", en: "Signature", emoji: "🎨" },
  { key: "signature-classic", hi: "क्लासिक गोल्ड", en: "Classic Gold", emoji: "🥇" },
  { key: "classic", hi: "क्लासिक", en: "Classic", emoji: "🌙" },
  { key: "bold", hi: "बोल्ड", en: "Bold", emoji: "🔥" },
  { key: "clean", hi: "क्लीन", en: "Clean", emoji: "🤍" },
  { key: "festive", hi: "फ़ेस्टिव", en: "Festive", emoji: "✨" },
  { key: "minimal", hi: "मिनिमल", en: "Minimal", emoji: "◽" },
  { key: "traditional", hi: "पारंपरिक", en: "Traditional", emoji: "🪔" },
];
