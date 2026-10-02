// What a trade is asked about ITSELF once it is chosen (owner's call, 2 Oct 2026: "category bahut saari ho sakti
// hain — school nursery to 10, nursery to 12, 8–12 … aur aage ki fields category ke according honi chahiye").
//
// Every trade gets two kinds of question here:
//   1. its own — a school: which classes, which board, which medium; a restaurant: cuisine, veg / non-veg; a
//      lawyer: practice areas; a garage: cars or bikes. Written below per trade, with a group fallback.
//   2. "what do you have / offer" — the trade's usual services from trade-data, as tick boxes, so the website
//      lists what THIS business really has and not every seed of the trade.
// Answers live in card facts (`tradeAnswers`), feed the AI brief, the trust pills and the services section.
//
// Isomorphic: no 'use client', no 'server-only'.
import { categoryOf } from "@/lib/poster-categories";
import { tradeDataFor } from "@/lib/site-recipes";

export type TradeOption = { en: string; hi: string };
export type TradeQuestion = {
  key: string;
  en: string; hi: string;
  /** one = pick one chip; many = tick several; text = a short line. */
  type: "one" | "many" | "text";
  options?: TradeOption[];
  /** The answer is shown as a trust pill on the card / website ("🏫 Nursery–12th", "🍽️ Pure veg"). */
  pill?: string;
  /** Example for a text answer. */
  eg?: string; egHi?: string;
};

/** "English|हिंदी, English|हिंदी" → options. A part without "|" uses the same word in both. */
const opts = (s: string): TradeOption[] => s.split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [en, hi] = x.split("|"); return { en: en.trim(), hi: (hi ?? en).trim() }; });
const one = (key: string, en: string, hi: string, o: string, pill?: string): TradeQuestion => ({ key, en, hi, type: "one", options: opts(o), ...(pill ? { pill } : {}) });
const many = (key: string, en: string, hi: string, o: string, pill?: string): TradeQuestion => ({ key, en, hi, type: "many", options: opts(o), ...(pill ? { pill } : {}) });
const text = (key: string, en: string, hi: string, eg: string, egHi: string, pill?: string): TradeQuestion => ({ key, en, hi, type: "text", eg, egHi, ...(pill ? { pill } : {}) });

const CLASSES = "Play school / Nursery–KG|प्ले स्कूल / नर्सरी–KG, Nursery–5th|नर्सरी–5वीं, Nursery–8th|नर्सरी–8वीं, Nursery–10th|नर्सरी–10वीं, Nursery–12th|नर्सरी–12वीं, 1st–8th|1–8वीं, 6th–12th|6–12वीं, 9th–12th|9–12वीं, 11th–12th|11–12वीं";
const BOARD = "CBSE, RBSE / State board|RBSE / राज्य बोर्ड, ICSE, Other|अन्य";
const BATCH = "Morning|सुबह, Evening|शाम, Both|दोनों, Online too|ऑनलाइन भी";
const FOR_WHOM = "Kids|बच्चे, Teens|किशोर, Adults|वयस्क, Ladies|महिलाएँ";

const BY_KEY: Record<string, TradeQuestion[]> = {
  // education
  school: [
    one("classes", "Which classes?", "कौन सी कक्षाएँ?", CLASSES, "🏫"),
    one("board", "Board", "बोर्ड", BOARD, "📘"),
    one("medium", "Medium", "माध्यम", "English medium|English medium, Hindi medium|हिंदी माध्यम, Both|दोनों"),
    one("stay", "Day / boarding", "डे / बोर्डिंग", "Day school|डे स्कूल, Day boarding|डे बोर्डिंग, Hostel available|हॉस्टल उपलब्ध"),
  ],
  playschool: [
    many("programmes", "Programmes", "प्रोग्राम", "Play group|प्ले ग्रुप, Nursery|नर्सरी, LKG, UKG, Daycare|डेकेयर", "🧸"),
    one("timing", "Timings", "समय", "Half day|आधा दिन, Full day|पूरा दिन, Both|दोनों"),
    one("approach", "Approach", "तरीक़ा", "Play-way|खेल-खेल में, Montessori|मोंटेसरी, Mixed|मिला-जुला"),
  ],
  coaching: [
    many("classes", "Classes taught", "कौन सी कक्षाएँ", "Class 1–5|कक्षा 1–5, Class 6–8|कक्षा 6–8, Class 9–10|कक्षा 9–10, Class 11–12|कक्षा 11–12, Competitive exams|प्रतियोगी परीक्षा, Spoken English, Computer|कंप्यूटर", "📚"),
    many("exams", "Exams prepared for", "किन परीक्षाओं की तैयारी", "Board exams|बोर्ड परीक्षा, IIT-JEE, NEET, Bank / SSC|बैंक / SSC, REET / CTET, Defence / NDA|डिफ़ेंस / NDA, CA / CS, Railway / Police|रेलवे / पुलिस"),
    one("batch", "Batches", "बैच", BATCH),
    text("subjects", "Main subjects", "मुख्य विषय", "e.g. Maths, Science, English", "जैसे गणित, विज्ञान, अंग्रेज़ी"),
  ],
  college: [
    one("type", "Type", "प्रकार", "Degree college|डिग्री कॉलेज, Engineering|इंजीनियरिंग, Pharmacy|फ़ार्मेसी, Nursing|नर्सिंग, Management|मैनेजमेंट, Polytechnic|पॉलिटेक्निक, University|यूनिवर्सिटी, ITI", "🎓"),
    many("courses", "Courses", "कोर्स", "B.A., B.Sc., B.Com., B.Tech, BBA, BCA, M.A. / M.Sc., B.Ed., Diploma|डिप्लोमा, Ph.D."),
    one("hostel", "Hostel", "हॉस्टल", "Hostel available|हॉस्टल उपलब्ध, No hostel|हॉस्टल नहीं"),
  ],
  computer: [
    many("courses", "Courses", "कोर्स", "Basic computer|बेसिक कंप्यूटर, Tally, MS Office / Excel, DCA / PGDCA, Graphic design|ग्राफ़िक डिज़ाइन, Web design|वेब डिज़ाइन, Coding / programming|कोडिंग, Typing|टाइपिंग, Digital marketing|डिजिटल मार्केटिंग", "💻"),
    one("certificate", "Certificate", "सर्टिफ़िकेट", "Govt-recognised|सरकारी मान्यता, Own certificate|अपना सर्टिफ़िकेट"),
  ],
  teacher: [
    many("subjects", "Subjects", "विषय", "Maths|गणित, Science|विज्ञान, English|अंग्रेज़ी, Hindi|हिंदी, Commerce|कॉमर्स, Computer|कंप्यूटर, Competitive exams|प्रतियोगी परीक्षा, Music / art|संगीत / कला", "📖"),
    many("classes", "Classes", "कक्षाएँ", "Class 1–5|कक्षा 1–5, Class 6–8|कक्षा 6–8, Class 9–10|कक्षा 9–10, Class 11–12|कक्षा 11–12, College|कॉलेज, Adults|वयस्क"),
    one("mode", "Where", "कहाँ", "Home tuition|होम ट्यूशन, At my place|मेरे यहाँ, Online|ऑनलाइन, All|सभी"),
  ],
  dance: [
    many("classes", "Classes", "क्लास", "Classical dance|शास्त्रीय नृत्य, Western / hip-hop|वेस्टर्न, Bollywood|बॉलीवुड, Singing|गायन, Guitar / keyboard|गिटार / कीबोर्ड, Drawing & painting|ड्रॉइंग-पेंटिंग, Yoga|योग", "🎵"),
    many("for", "For whom", "किसके लिए", FOR_WHOM),
    one("batch", "Batches", "बैच", BATCH),
  ],
  student: [text("study", "Class / course and institute", "कक्षा / कोर्स और संस्थान", "e.g. Class 12, Science — ABC School", "जैसे कक्षा 12, साइंस — ABC स्कूल")],
  // health
  doctor: [
    one("specialty", "Speciality", "विशेषज्ञता", "General physician|जनरल फ़िज़िशियन, Child specialist|बाल रोग, Gynaecologist|स्त्री रोग, Orthopaedic|हड्डी रोग, ENT|नाक-कान-गला, Skin|त्वचा, Eye|नेत्र, Heart|हृदय, Psychiatrist|मनोचिकित्सक, Surgeon|सर्जन, Dental|दंत, Other|अन्य", "🩺"),
    many("facilities", "Facilities", "सुविधाएँ", "Lab tests|लैब टेस्ट, Pharmacy|दवाइयाँ, Online consult|ऑनलाइन परामर्श, 24×7 emergency|24×7 आपातकाल, Home visit|घर पर विज़िट, ECG / X-ray / Ultrasound"),
  ],
  dentist: [one("type", "Type", "प्रकार", "General dentist|जनरल डेंटिस्ट, Orthodontist (braces)|ऑर्थोडॉन्टिस्ट, Implant specialist|इम्प्लांट, Kids' dentist|बच्चों के डेंटिस्ट", "🦷")],
  hospital: [
    one("type", "Type", "प्रकार", "Multi-speciality|मल्टी-स्पेशियलिटी, Maternity|प्रसूति, Eye|नेत्र, Ortho|हड्डी, Children's|बच्चों का, Nursing home|नर्सिंग होम, Cancer|कैंसर", "🏥"),
    one("beds", "Beds", "बेड", "Up to 10|10 तक, 10–30, 30–100, 100+"),
    many("facilities", "Facilities", "सुविधाएँ", "24×7 emergency|24×7 आपातकाल, ICU, Ambulance|एम्बुलेंस, OT, Lab|लैब, Pharmacy|दवाइयाँ, Cashless insurance|कैशलेस बीमा"),
  ],
  ayurveda: [
    one("system", "System", "पद्धति", "Ayurveda|आयुर्वेद, Homeopathy|होम्योपैथी, Unani|यूनानी, Naturopathy|प्राकृतिक चिकित्सा, Panchakarma|पंचकर्म", "🌿"),
    many("treats", "Treats", "इलाज", "Joint pain|जोड़ों का दर्द, Skin|त्वचा, Digestion|पाचन, Hair|बाल, Diabetes|मधुमेह, Stress|तनाव, Weight|वज़न, Women's health|महिला स्वास्थ्य"),
  ],
  pharma: [one("role", "You are", "आप हैं", "Medical representative|मेडिकल रिप्रेज़ेंटेटिव, Distributor|डिस्ट्रीब्यूटर, Manufacturer|निर्माता"), text("products", "Products / company", "प्रोडक्ट / कंपनी", "e.g. Cipla — antibiotics, vitamins", "जैसे Cipla — एंटीबायोटिक, विटामिन")],
  gym: [many("type", "What you have", "क्या है", "Gym|जिम, Yoga|योग, Zumba / aerobics|ज़ुम्बा / एरोबिक्स, CrossFit, Personal training|पर्सनल ट्रेनिंग, Ladies' batch|लेडीज़ बैच, Steam / sauna", "💪"), one("timing", "Timings", "समय", "Morning|सुबह, Evening|शाम, Both|दोनों, 24 hours|24 घंटे")],
  salon: [one("for", "For", "किसके लिए", "Ladies|महिलाएँ, Gents|पुरुष, Unisex|यूनिसेक्स", "💇"), many("special", "Special in", "ख़ास", "Bridal makeup|ब्राइडल मेकअप, Hair colour|हेयर कलर, Facial|फ़ेशियल, Keratin / smoothening, Nail art|नेल आर्ट")],
  spa: [many("type", "Type", "प्रकार", "Body massage|बॉडी मसाज, Thai / Kerala, Facial|फ़ेशियल, Steam / sauna, Couple spa", "🧖")],
  water: [text("brand", "Brand", "ब्रांड", "e.g. Kangen, Tyent", "जैसे Kangen, Tyent"), many("products", "Products", "प्रोडक्ट", "Water ionizer|वॉटर आयोनाइज़र, RO purifier|RO प्यूरीफ़ायर, Alkaline water|अल्कलाइन पानी, Filters / service|फ़िल्टर / सर्विस")],
  wellness: [text("brand", "Brand / company", "ब्रांड / कंपनी", "e.g. Herbalife, Vestige", "जैसे Herbalife, Vestige"), many("products", "Products", "प्रोडक्ट", "Nutrition|न्यूट्रिशन, Weight management|वज़न, Skin care|स्किन केयर, Ayurvedic|आयुर्वेदिक, Immunity|इम्युनिटी")],
  // retail
  kirana: [one("type", "Type", "प्रकार", "General store|जनरल स्टोर, Supermarket|सुपरमार्केट, Provision store|किराना, Dry fruits|ड्राई फ़्रूट्स", "🛒"), many("how", "Sell", "बेचते हैं", "Retail|रिटेल, Wholesale|होलसेल, Home delivery|होम डिलीवरी, Monthly ration|महीने का राशन")],
  garments: [many("for", "For", "किसके लिए", "Men|पुरुष, Women|महिलाएँ, Kids|बच्चे, Ethnic / sarees|एथनिक / साड़ी, Western|वेस्टर्न, School uniforms|स्कूल यूनिफ़ॉर्म", "👗"), one("range", "Price range", "दाम", "Budget|किफ़ायती, Mid-range|मध्यम, Premium|प्रीमियम")],
  jewellery: [many("metal", "Jewellery", "ज्वेलरी", "Gold|सोना, Silver|चाँदी, Diamond|हीरा, Artificial|आर्टिफ़िशियल, Platinum|प्लैटिनम", "💍"), many("services", "Also", "साथ में", "BIS hallmark|BIS हॉलमार्क, Old gold exchange|पुराना सोना एक्सचेंज, Made to order|ऑर्डर पर, EMI / gold scheme|EMI / गोल्ड स्कीम")],
  mobile: [many("sell", "You sell", "क्या बेचते हैं", "Mobiles|मोबाइल, Accessories|एक्सेसरीज़, Repair|रिपेयर, Recharge|रिचार्ज, Laptops / electronics|लैपटॉप / इलेक्ट्रॉनिक्स, EMI|EMI", "📱"), text("brands", "Brands", "ब्रांड", "e.g. Samsung, Vivo, Apple", "जैसे Samsung, Vivo, Apple")],
  furniture: [many("sell", "You sell", "क्या बेचते हैं", "Sofa|सोफ़ा, Beds|बेड, Dining|डाइनिंग, Office furniture|ऑफ़िस फ़र्नीचर, Modular kitchen|मॉड्यूलर किचन, Mattresses|गद्दे, Home decor|होम डेकोर", "🛋️"), one("custom", "Custom made", "ऑर्डर पर", "Yes, made to order|हाँ ऑर्डर पर, Ready stock only|सिर्फ़ रेडी स्टॉक")],
  hardware: [many("sell", "You sell", "क्या बेचते हैं", "Paint|पेंट, Sanitary|सैनिटरी, Pipes & fittings|पाइप-फ़िटिंग, Tools|औज़ार, Tiles|टाइल्स, Electrical|इलेक्ट्रिकल, Cement / steel|सीमेंट / सरिया, Plywood|प्लाईवुड", "🔧")],
  medical: [many("has", "You have", "क्या है", "Allopathic|एलोपैथिक, Ayurvedic|आयुर्वेदिक, Surgical items|सर्जिकल, Baby care|बेबी केयर, Home delivery|होम डिलीवरी, 24 hours|24 घंटे, Generic medicines|जेनेरिक दवाइयाँ", "💊")],
  sweets: [many("make", "You make", "क्या बनाते हैं", "Sweets|मिठाई, Namkeen|नमकीन, Bakery / cakes|बेकरी / केक, Dairy|डेयरी, Catering orders|कैटरिंग ऑर्डर, Dry fruit sweets|ड्राई फ़्रूट मिठाई", "🍬"), text("special", "Famous for", "ख़ास", "e.g. Ghewar, Rasgulla", "जैसे घेवर, रसगुल्ला")],
  "grocery-online": [many("sell", "You sell", "क्या बेचते हैं", "Grocery|किराना, Fashion|फ़ैशन, Electronics|इलेक्ट्रॉनिक्स, Handmade|हैंडमेड, Food|खाना, Other|अन्य", "🛍️"), one("ship", "Delivery", "डिलीवरी", "Own city|अपना शहर, All India|पूरा भारत, Worldwide|विदेश भी")],
  gift: [many("sell", "You sell", "क्या बेचते हैं", "Gifts|गिफ़्ट, Stationery|स्टेशनरी, Toys|खिलौने, Books|किताबें, Customised gifts|कस्टम गिफ़्ट, Decor|डेकोर", "🎁")],
  optical: [many("has", "You have", "क्या है", "Spectacles|चश्मे, Contact lenses|कॉन्टैक्ट लेंस, Sunglasses|धूप के चश्मे, Free eye test|फ़्री आँख जाँच, Kids' frames|बच्चों के फ़्रेम, Branded frames|ब्रांडेड फ़्रेम", "👓")],
  footwear: [many("for", "For", "किसके लिए", "Men|पुरुष, Women|महिलाएँ, Kids|बच्चे, Sports|स्पोर्ट्स, School shoes|स्कूल शूज़, Formal|फ़ॉर्मल, Branded|ब्रांडेड", "👟")],
  // food
  restaurant: [
    many("cuisine", "Cuisine", "खाना", "North Indian|नॉर्थ इंडियन, South Indian|साउथ इंडियन, Chinese|चाइनीज़, Fast food|फ़ास्ट फ़ूड, Thali / Rajasthani|थाली / राजस्थानी, Multi-cuisine|मल्टी-कुज़ीन, Street food|स्ट्रीट फ़ूड, Mughlai|मुग़लई", "🍽️"),
    one("veg", "Veg / non-veg", "वेज / नॉन-वेज", "Pure veg|शुद्ध शाकाहारी, Veg & non-veg|वेज और नॉन-वेज, Jain available|जैन उपलब्ध", "🌿"),
    many("has", "You have", "क्या है", "Dine-in|बैठकर खाना, Home delivery|होम डिलीवरी, Takeaway|पैक, Party / bulk orders|पार्टी / थोक ऑर्डर, Family seating|फ़ैमिली सीटिंग, AC|AC, Rooftop|रूफ़टॉप"),
  ],
  cafe: [many("serve", "You serve", "क्या मिलता है", "Tea / coffee|चाय / कॉफ़ी, Snacks|स्नैक्स, Bakery|बेकरी, Shakes|शेक, Fast food|फ़ास्ट फ़ूड, Breakfast|नाश्ता", "☕"), one("seat", "Seating", "बैठने की जगह", "Sit-in|बैठकर, Takeaway only|सिर्फ़ पैक, Both|दोनों")],
  tiffin: [many("type", "Food", "खाना", "Veg|वेज, Non-veg|नॉन-वेज, Diet / healthy|डाइट, Monthly plan|महीने का प्लान, Office lunch|ऑफ़िस लंच", "🍱")],
  catering: [many("events", "Events", "कार्यक्रम", "Weddings|शादी, Birthdays|जन्मदिन, Corporate|कॉर्पोरेट, Pooja / religious|पूजा / धार्मिक, Office lunch|ऑफ़िस लंच, Small parties|छोटी पार्टी", "🍛"), one("capacity", "Capacity", "क्षमता", "Up to 100|100 तक, 100–500, 500–2000, 2000+"), one("veg", "Food", "खाना", "Pure veg|शुद्ध शाकाहारी, Veg & non-veg|वेज और नॉन-वेज")],
  hotel: [one("type", "Type", "प्रकार", "Hotel|होटल, Resort|रिसॉर्ट, Lodge / guest house|लॉज / गेस्ट हाउस, Banquet|बैंक्वेट, Dharamshala|धर्मशाला, Homestay|होमस्टे", "🏨"), one("rooms", "Rooms", "कमरे", "Up to 10|10 तक, 10–30, 30–100, 100+"), many("facilities", "Facilities", "सुविधाएँ", "AC rooms|AC कमरे, Restaurant|रेस्टोरेंट, Banquet hall|बैंक्वेट हॉल, Parking|पार्किंग, Wi-Fi, Swimming pool|स्विमिंग पूल, Family rooms|फ़ैमिली रूम")],
  // services
  ca: [many("services", "Services", "सेवाएँ", "GST, Income tax / ITR|आयकर / ITR, Audit|ऑडिट, Company registration|कंपनी रजिस्ट्रेशन, Accounting|अकाउंटिंग, TDS, Project reports / loans|प्रोजेक्ट रिपोर्ट / लोन", "🧾"), many("for", "For", "किसके लिए", "Individuals|व्यक्ति, Businesses|व्यवसाय, Startups|स्टार्टअप, NGOs / trusts|NGO / ट्रस्ट")],
  lawyer: [many("practice", "Practice areas", "किस तरह के केस", "Civil|सिविल, Criminal|क्रिमिनल, Family / divorce|पारिवारिक / तलाक, Property|संपत्ति, Consumer|उपभोक्ता, Corporate|कॉर्पोरेट, Cheque bounce|चेक बाउंस, Labour|श्रम, High Court|हाईकोर्ट", "⚖️"), text("court", "Courts", "अदालत", "e.g. District court Jaipur, Rajasthan High Court", "जैसे ज़िला अदालत जयपुर, राजस्थान हाईकोर्ट")],
  insurance: [one("company", "Company", "कंपनी", "LIC, Private life insurance|निजी जीवन बीमा, Health insurance|स्वास्थ्य बीमा, Motor / general|मोटर / जनरल, All kinds|सभी तरह", "🛡️"), many("plans", "Plans", "प्लान", "Term|टर्म, Child|बच्चों का, Pension|पेंशन, Health|स्वास्थ्य, Motor|मोटर, Investment|निवेश")],
  finance: [many("offer", "You offer", "क्या देते हैं", "Home loan|होम लोन, Personal loan|पर्सनल लोन, Business loan|बिज़नेस लोन, Vehicle loan|वाहन लोन, Mutual funds|म्यूचुअल फ़ंड, Insurance|बीमा, Credit cards|क्रेडिट कार्ड, Gold loan|गोल्ड लोन", "💰")],
  realestate: [many("deals", "Deals in", "काम", "Plots|प्लॉट, Flats|फ़्लैट, Houses / villas|मकान / विला, Commercial|कमर्शियल, Rentals|किराया, Farmhouse / agri land|फ़ार्महाउस / खेत, PG / hostel|PG / हॉस्टल", "🏠")],
  builder: [many("work", "Work", "काम", "Houses|मकान, Flats / apartments|फ़्लैट, Commercial|कमर्शियल, Renovation|रेनोवेशन, Govt contracts|सरकारी ठेके, Turnkey projects|टर्नकी, Roads / civil|सड़क / सिविल", "🏗️")],
  interior: [many("work", "Work", "काम", "Home interiors|होम इंटीरियर, Modular kitchen|मॉड्यूलर किचन, Office interiors|ऑफ़िस इंटीरियर, Architecture / plans|आर्किटेक्चर / नक़्शा, Vastu|वास्तु, 3D design|3D डिज़ाइन, False ceiling|फ़ॉल्स सीलिंग", "🛋️")],
  travel: [many("offer", "You offer", "क्या देते हैं", "Tour packages|टूर पैकेज, Flight / train tickets|फ़्लाइट / ट्रेन टिकट, Taxi / car rental|टैक्सी / कार किराया, Hotel booking|होटल बुकिंग, Visa / passport|वीज़ा / पासपोर्ट, Pilgrimage tours|तीर्थ यात्रा, Bus booking|बस बुकिंग, International|विदेश", "✈️")],
  transport: [many("offer", "You offer", "क्या देते हैं", "Full truck load|फ़ुल ट्रक, Part load|पार्ट लोड, Packers & movers|पैकर्स-मूवर्स, Local tempo|लोकल टेम्पो, All India|पूरा भारत, Cold storage|कोल्ड स्टोरेज", "🚚")],
  auto: [one("type", "Type", "प्रकार", "Car garage|कार गैराज, Bike garage|बाइक गैराज, Showroom|शोरूम, Spare parts|स्पेयर पार्ट्स, Tyres / battery|टायर / बैटरी, Car wash / detailing|कार वॉश, Denting-painting|डेंटिंग-पेंटिंग", "🚗"), text("brands", "Brands", "ब्रांड", "e.g. Maruti, Hyundai, all brands", "जैसे Maruti, Hyundai, सभी ब्रांड")],
  electrician: [many("work", "Work", "काम", "Electrician|इलेक्ट्रीशियन, Plumber|प्लंबर, AC repair|AC रिपेयर, RO repair|RO रिपेयर, Carpenter|बढ़ई, Painter|पेंटर, Appliance repair|अप्लायंस रिपेयर, CCTV|CCTV, Solar|सोलर", "🔌")],
  photography: [many("work", "Work", "काम", "Wedding|शादी, Pre-wedding|प्री-वेडिंग, Baby / maternity|बेबी / मैटरनिटी, Product|प्रोडक्ट, Drone|ड्रोन, Video / cinematic|वीडियो, Studio portraits|स्टूडियो पोर्ट्रेट, Passport photos|पासपोर्ट फ़ोटो", "📸")],
  event: [many("offer", "You offer", "क्या देते हैं", "Tent house|टेंट हाउस, Decoration|डेकोरेशन, DJ / sound|DJ / साउंड, Catering|कैटरिंग, Wedding planning|वेडिंग प्लानिंग, Lighting|लाइटिंग, Birthday parties|जन्मदिन, Flowers / mandap|फूल / मंडप", "🎉")],
  printing: [many("do", "You do", "क्या करते हैं", "Flex / banners|फ़्लेक्स / बैनर, Visiting cards|विज़िटिंग कार्ड, Wedding cards|शादी के कार्ड, Offset printing|ऑफ़सेट, T-shirt / mug printing|टी-शर्ट / मग, Stickers / labels|स्टिकर, Design|डिज़ाइन, Books / bill books|किताबें / बिल बुक", "🖨️")],
  it: [many("do", "You do", "क्या करते हैं", "Websites|वेबसाइट, Mobile apps|मोबाइल ऐप, Software / ERP|सॉफ़्टवेयर / ERP, Digital marketing|डिजिटल मार्केटिंग, SEO, Social media|सोशल मीडिया, IT support / AMC|IT सपोर्ट, Hosting / domains|होस्टिंग", "💻")],
  security: [many("offer", "You offer", "क्या देते हैं", "Security guards|सुरक्षा गार्ड, Housekeeping|हाउसकीपिंग, Bouncers|बाउंसर, CCTV|CCTV, Facility management|फ़ैसिलिटी मैनेजमेंट, Event security|इवेंट सुरक्षा", "🛡️")],
  cleaning: [many("do", "You do", "क्या करते हैं", "Pest control|पेस्ट कंट्रोल, Termite|दीमक, Deep cleaning|डीप क्लीनिंग, Sofa / carpet|सोफ़ा / कारपेट, Water tank|पानी की टंकी, Sanitization|सैनिटाइज़ेशन, Office cleaning|ऑफ़िस सफ़ाई", "🧹")],
  tailor: [many("stitch", "You stitch", "क्या सिलते हैं", "Ladies' suits|लेडीज़ सूट, Blouses|ब्लाउज़, Gents' shirts & pants|जेंट्स शर्ट-पैंट, Bridal / lehenga|ब्राइडल / लहंगा, Alterations|अल्टरेशन, Uniforms|यूनिफ़ॉर्म, Designer wear|डिज़ाइनर", "🧵")],
  mehndi: [many("do", "You do", "क्या करते हैं", "Bridal mehndi|ब्राइडल मेहंदी, Party mehndi|पार्टी मेहंदी, Bridal makeup|ब्राइडल मेकअप, Party makeup|पार्टी मेकअप, Hair styling|हेयर स्टाइल, Nail art|नेल आर्ट, Saree draping|साड़ी ड्रेपिंग", "💅")],
  astro: [many("do", "You do", "क्या करते हैं", "Kundli|कुंडली, Match-making|कुंडली मिलान, Vastu|वास्तु, Pooja / anushthan|पूजा / अनुष्ठान, Gemstones|रत्न, Numerology|अंक ज्योतिष, Tarot|टैरो, Muhurat|मुहूर्त", "🔮")],
  courier: [many("do", "You do", "क्या करते हैं", "Courier|कूरियर, Money transfer|मनी ट्रांसफ़र, Aadhaar / PAN|आधार / PAN, Bill payment|बिल भुगतान, Bus / train tickets|बस / ट्रेन टिकट, Photocopy / print|फ़ोटोकॉपी / प्रिंट, Bank mitra|बैंक मित्र, Govt forms|सरकारी फ़ॉर्म", "📦")],
  // sales
  mlm: [text("company", "Company", "कंपनी", "e.g. Vestige, Amway", "जैसे Vestige, Amway", "🤝"), many("products", "Products", "प्रोडक्ट", "Health / nutrition|हेल्थ / न्यूट्रिशन, Personal care|पर्सनल केयर, Home care|होम केयर, Agriculture|कृषि, Finance / insurance|फ़ाइनेंस / बीमा")],
  distributor: [one("type", "You are", "आप हैं", "Distributor|डिस्ट्रीब्यूटर, Dealer|डीलर, Agency|एजेंसी, Super stockist|सुपर स्टॉकिस्ट, C&F agent|C&F एजेंट", "🏷️"), text("brands", "Brands / products", "ब्रांड / प्रोडक्ट", "e.g. Amul, Parle, Havells", "जैसे Amul, Parle, Havells")],
  sales: [text("industry", "Industry / products", "इंडस्ट्री / प्रोडक्ट", "e.g. Pharma, FMCG, Real estate", "जैसे फ़ार्मा, FMCG, रियल एस्टेट")],
  agent: [text("of", "Agent of what", "किसके एजेंट", "e.g. Property, LIC, Mandi commission", "जैसे प्रॉपर्टी, LIC, मंडी")],
  // industry
  agri: [many("sell", "You sell", "क्या बेचते हैं", "Seeds|बीज, Fertilizer|खाद, Pesticides|कीटनाशक, Farm tools|कृषि औज़ार, Irrigation / pipes|सिंचाई / पाइप, Nursery plants|पौधे, Animal feed|पशु आहार, Tractors / machinery|ट्रैक्टर / मशीनरी", "🌾")],
  dairy: [many("sell", "You sell", "क्या बेचते हैं", "Milk|दूध, Paneer|पनीर, Ghee|घी, Curd / buttermilk|दही / छाछ, Sweets|मिठाई, Home delivery|होम डिलीवरी, Cattle feed|पशु आहार", "🥛")],
  manufacturer: [text("makes", "You make", "क्या बनाते हैं", "e.g. Steel furniture, Plastic containers", "जैसे स्टील फ़र्नीचर, प्लास्टिक डिब्बे", "🏭"), many("supply", "Supply to", "किसे देते हैं", "Retailers|रिटेलर, Wholesalers|होलसेलर, Companies|कंपनियाँ, Export|एक्सपोर्ट, Govt|सरकारी")],
  wholesale: [text("trades", "You trade in", "किसका व्यापार", "e.g. Grocery, Garments, Hardware", "जैसे किराना, कपड़े, हार्डवेयर", "📦"), many("sell", "Sell to", "किसे बेचते हैं", "Retailers|रिटेलर, Businesses|व्यवसाय, Also retail|रिटेल भी, All India|पूरा भारत")],
  textile: [many("sell", "You sell", "क्या बेचते हैं", "Sarees|साड़ी, Suits / dress material|सूट / ड्रेस मटीरियल, Lehengas|लहंगा, Fabric by metre|मीटर कपड़ा, Bedsheets / curtains|चादर / पर्दे, Wholesale|होलसेल, Readymade|रेडीमेड", "🧵")],
  // community
  political: [text("post", "Post / role", "पद", "e.g. Mandal President, Karyakarta", "जैसे मंडल अध्यक्ष, कार्यकर्ता", "🏛️"), text("party", "Party / organisation", "पार्टी / संगठन", "e.g. BJP, Congress", "जैसे भाजपा, कांग्रेस")],
  mla: [text("post", "Post", "पद", "e.g. MLA, Sarpanch, Ward councillor", "जैसे विधायक, सरपंच, पार्षद", "🏛️"), text("area", "Constituency / ward", "क्षेत्र / वार्ड", "e.g. Bharatpur, Ward 12", "जैसे भरतपुर, वार्ड 12")],
  ngo: [many("work", "Work", "काम", "Education|शिक्षा, Health|स्वास्थ्य, Women|महिलाएँ, Environment|पर्यावरण, Animals|पशु, Food / relief|भोजन / राहत, Elderly|बुज़ुर्ग, Skill training|कौशल", "🤲")],
  samaj: [text("org", "Samaj / samiti", "समाज / समिति", "e.g. Agrawal Samaj, Jain Samiti", "जैसे अग्रवाल समाज, जैन समिति", "🏛️"), text("post", "Post", "पद", "e.g. President, Secretary", "जैसे अध्यक्ष, सचिव")],
  temple: [text("deity", "Temple of", "किसका मंदिर", "e.g. Shri Hanuman Ji", "जैसे श्री हनुमान जी", "🛕"), many("has", "Has", "क्या है", "Daily aarti|रोज़ आरती, Bhandara|भंडारा, Dharamshala|धर्मशाला, Gaushala|गौशाला, Annual fair|वार्षिक मेला")],
  club: [text("club", "Club", "क्लब", "e.g. Lions Club Jaipur", "जैसे लायंस क्लब जयपुर", "🤝"), text("post", "Post", "पद", "e.g. President 2026-27", "जैसे अध्यक्ष 2026-27")],
  union: [text("org", "Union / association", "यूनियन / एसोसिएशन", "e.g. Vyapar Mandal", "जैसे व्यापार मंडल", "🤝"), text("post", "Post", "पद", "e.g. General Secretary", "जैसे महासचिव")],
  housing: [text("society", "Society", "सोसाइटी", "e.g. Green Park RWA", "जैसे ग्रीन पार्क RWA", "🏘️"), text("post", "Post", "पद", "e.g. Secretary", "जैसे सचिव")],
  // personal
  employee: [text("company", "Company", "कंपनी", "e.g. Tata Motors", "जैसे Tata Motors", "💼"), text("post", "Post", "पद", "e.g. Sales Manager", "जैसे सेल्स मैनेजर")],
  govt: [text("dept", "Department", "विभाग", "e.g. Education Dept, Rajasthan", "जैसे शिक्षा विभाग, राजस्थान", "🏛️"), text("post", "Post", "पद", "e.g. Block Development Officer", "जैसे खंड विकास अधिकारी")],
  army: [one("service", "Service", "सेवा", "Army|सेना, Navy|नौसेना, Air Force|वायुसेना, Police|पुलिस, CRPF / BSF / paramilitary|अर्धसैनिक, Retired|सेवानिवृत्त", "🎖️"), text("rank", "Rank", "रैंक", "e.g. Subedar (Retd.)", "जैसे सूबेदार (सेवानिवृत्त)")],
  influencer: [many("platform", "Platforms", "प्लेटफ़ॉर्म", "Instagram, YouTube, Facebook, Other|अन्य", "📣"), text("niche", "About what", "किस बारे में", "e.g. Food, Travel, Comedy", "जैसे खाना, घूमना, कॉमेडी")],
};

/** When a trade has no questions of its own: one line about what it mainly does. */
const BY_GROUP: Record<string, TradeQuestion[]> = {
  Retail: [text("main", "You sell mainly", "मुख्य रूप से क्या बेचते हैं", "e.g. Toys and gifts", "जैसे खिलौने और गिफ़्ट")],
  Food: [one("veg", "Food", "खाना", "Pure veg|शुद्ध शाकाहारी, Veg & non-veg|वेज और नॉन-वेज", "🌿")],
  Health: [text("main", "Main treatments / services", "मुख्य उपचार / सेवाएँ", "e.g. Physiotherapy, back pain", "जैसे फ़िज़ियोथेरेपी, कमर दर्द")],
  Services: [text("main", "Main services", "मुख्य सेवाएँ", "e.g. AC repair and installation", "जैसे AC रिपेयर और इंस्टॉलेशन")],
  Education: [text("main", "What you teach", "क्या सिखाते हैं", "e.g. Spoken English for adults", "जैसे वयस्कों के लिए Spoken English")],
  Sales: [text("main", "What you sell / represent", "क्या बेचते / प्रतिनिधित्व", "e.g. Amul products in Alwar", "जैसे अलवर में Amul प्रोडक्ट")],
  Industry: [text("main", "You make / trade in", "क्या बनाते / व्यापार", "e.g. Plastic containers", "जैसे प्लास्टिक डिब्बे")],
  Community: [text("post", "Post / role", "पद", "e.g. President", "जैसे अध्यक्ष")],
  Personal: [],
};

/** The trade's own questions (without the "what you offer" tick list). */
export function tradeOwnQuestions(categoryKey: string): TradeQuestion[] {
  const c = categoryOf(categoryKey);
  if (!c) return [];
  return BY_KEY[categoryKey] ?? BY_GROUP[c.group] ?? [];
}

/** "What do you have / offer?" — the trade's usual services from trade-data as tick boxes. */
export function offeringsQuestion(categoryKey: string): TradeQuestion | null {
  const c = categoryOf(categoryKey);
  const d = tradeDataFor(categoryKey);
  if (!c || !d?.services?.length || c.persona === "personal" || c.persona === "student") return null;
  return { key: "offerings", en: "What do you have / offer? Tick all that apply.", hi: "आपके यहाँ क्या-क्या है? जो हो उसे दबाएँ।", type: "many", options: d.services.map((s) => ({ en: s.en, hi: s.hi })) };
}

/** Everything a trade is asked, in order: its own questions, then what it offers. */
export function tradeQuestionsFor(categoryKey: string): TradeQuestion[] {
  const own = tradeOwnQuestions(categoryKey);
  const off = offeringsQuestion(categoryKey);
  return off ? [...own, off] : own;
}

export type TradeAnswers = Record<string, string[]>;

const labelOf = (q: TradeQuestion, v: string, hi: boolean) => (hi ? q.options?.find((o) => o.en === v)?.hi ?? v : v);

/** The answers as facts lines for the AI and the assistant: "Classes: Nursery–12th", "Board: CBSE", … (English —
 *  the AI writes the card's language). The offerings tick list becomes "We have: …". */
export function tradeAnswerLines(categoryKey: string, answers: TradeAnswers | undefined): string[] {
  if (!answers) return [];
  const out: string[] = [];
  for (const q of tradeQuestionsFor(categoryKey)) {
    const v = (answers[q.key] ?? []).filter(Boolean);
    if (!v.length) continue;
    out.push(q.key === "offerings" ? `We have / offer: ${v.join(", ")}` : `${q.en.replace(/\?$/, "")}: ${v.join(", ")}`);
  }
  return out;
}

/** The answers that go on the card as trust pills ("🏫 Nursery–12th", "📘 CBSE", "🍽️ Pure veg"), card language. */
export function tradeAnswerPills(categoryKey: string, answers: TradeAnswers | undefined, lang: "en" | "hi" | "hinglish"): string[] {
  if (!answers) return [];
  const hi = lang === "hi";
  const out: string[] = [];
  for (const q of tradeOwnQuestions(categoryKey)) {
    if (!q.pill) continue;
    const v = (answers[q.key] ?? []).filter(Boolean);
    if (!v.length) continue;
    const shown = v.slice(0, 2).map((x) => labelOf(q, x, hi));
    const more = v.length > 2 ? ` +${v.length - 2}` : "";
    const line = `${q.pill} ${shown.join(" · ")}${more}`;
    if (line.length <= 48) out.push(line);
  }
  return out.slice(0, 3);
}

/** The services the owner ticked (English names from trade-data), or null when the question was not answered. */
export function pickedOfferings(categoryKey: string, answers: TradeAnswers | undefined): Set<string> | null {
  const v = answers?.offerings?.filter(Boolean) ?? [];
  if (!v.length || !offeringsQuestion(categoryKey)) return null;
  return new Set(v);
}
