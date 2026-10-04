// Step 3 of the profile in the trade's own words (owner's call, 2 Oct 2026: "school ki site ke liye product ka
// kya kaam? category me kya-kya required hai wo poochhna chahiye"). A school lists classes and fees, a
// restaurant its menu, a clinic its treatments, an electrician its services — the same product rows feed the
// card, the website and the posters, so only the WORDS and the fields asked change here. Which word a trade
// uses comes from its site recipe (site-recipes.ts), so the form and the website always agree.
//
// Isomorphic: no 'use client', no 'server-only'.
import { recipeFor, tradeDataFor, type CatalogWord } from "@/lib/site-recipes";
import { categoryOf } from "@/lib/poster-categories";

export type CatalogCopy = {
  word: CatalogWord;
  /** Step title / tab label — "Classes & courses", "Menu", "Services". */
  title: string; titleHi: string;
  /** Short word for the step pill — "Courses". */
  short: string; shortHi: string;
  /** The "+ Add" button. */
  add: string; addHi: string;
  /** One item, lower case — "a class", "a dish". */
  one: string; oneHi: string;
  /** Name field placeholder. */
  name: string; nameHi: string;
  /** Price field label and example. */
  price: string; priceHi: string; priceEg: string; priceEgHi: string;
  /** Shops have an MRP and a brand; a school, a clinic or an electrician do not. */
  mrp: boolean; brand: boolean;
  /** Benefit lines placeholder. */
  lines: string; linesHi: string;
  /** The guide line on top of the step. */
  guide: string; guideHi: string;
  /** Empty state. */
  empty: string; emptyHi: string;
  /** The "What makes you special?" question, in the trade's words — "What makes your school special?". */
  specialQ: string; specialQHi: string;
  /** "What makes you special?" chips — true of a good business of this kind. */
  special: string[];
  /** The "Who buys from you?" question, in the trade's words — "Who studies with you?", "Who are your patients?". */
  customersQ: string; customersQHi: string;
  /** "Who buys from you?" chips. */
  customers: string[];
  /** The "your work in your words" question. */
  work: string; workHi: string; workEg: string; workEgHi: string;
  /** Short examples for the set-up's "About", the offer line and the "in your own words" special line. */
  aboutEg: string; aboutEgHi: string;
  offerEg: string; offerEgHi: string;
  specialEg: string; specialEgHi: string;
};

const PRODUCTS: CatalogCopy = {
  word: "products",
  title: "My products", titleHi: "मेरे प्रोडक्ट", short: "Products", shortHi: "Products", add: "Add product", addHi: "प्रोडक्ट जोड़ें", one: "a product", oneHi: "एक product",
  name: "Product name", nameHi: "प्रोडक्ट का नाम",
  price: "Offer price ₹", priceHi: "ऑफ़र दाम ₹", priceEg: "e.g. 900 per kg", priceEgHi: "जैसे 900 per kg",
  mrp: true, brand: true,
  lines: "Benefit / offer lines (a different one each day)", linesHi: "खूबियाँ / ऑफ़र लाइनें (हर लाइन अलग दिन)",
  guide: "Add a clear photo, name and price. It shows on your V-Card, website and daily posters.", guideHi: "साफ़ फ़ोटो, नाम और ₹ दाम डालें। यही आपके V-Card, website और रोज़ के poster पर दिखेगा।",
  empty: "No products yet. Add your first one — it shows on your V-Card, website and posters.", emptyHi: "अभी कोई product नहीं है। पहला जोड़ें — यह आपके V-Card, website और poster पर दिखेगा।",
  specialQ: "What makes you special?", specialQHi: "आपकी खास बात क्या है?",
  special: ["💰 Fair prices", "⭐ Best quality", "🚚 Fast delivery", "🧑‍🔧 Expert team", "✂️ Custom orders", "🤝 Trusted by many customers"],
  customersQ: "Who buys from you?", customersQHi: "आपसे कौन खरीदता है?",
  customers: ["👪 Families", "🏪 Shops", "🏢 Offices", "🎓 Students", "👵 Senior citizens", "🙋 Everyone"],
  work: "What do you sell, or what work do you do?", workHi: "आप क्या बेचते हैं, या क्या काम करते हैं?",
  workEg: "e.g. We make fresh sweets and namkeen every day, and take orders for weddings and parties.", workEgHi: "जैसे हम रोज़ ताज़ी मिठाई और नमकीन बनाते हैं, और शादी-party के order भी लेते हैं।",
  aboutEg: "sweets and namkeen, home delivery", aboutEgHi: "मिठाई और नमकीन, home delivery",
  offerEg: "Free delivery above ₹500", offerEgHi: "₹500 से ऊपर free delivery",
  specialEg: "pure desi ghee only", specialEgHi: "सिर्फ़ शुद्ध देसी घी",
};

const BY_WORD: Record<CatalogWord, CatalogCopy> = {
  products: PRODUCTS,
  menu: {
    ...PRODUCTS, word: "menu",
    aboutEg: "North Indian thali, family seating, home delivery", aboutEgHi: "नॉर्थ इंडियन थाली, family seating, home delivery", offerEg: "20% off on family dinner this month", offerEgHi: "इस महीने family dinner पर 20% off", specialEg: "everything cooked fresh in pure ghee", specialEgHi: "सब कुछ ताज़ा, शुद्ध घी में",
    specialQ: "What makes your food special?", specialQHi: "आपके खाने की खास बात क्या है?", customersQ: "Who eats with you?", customersQHi: "आपके यहाँ कौन खाता है?",
    title: "My menu", titleHi: "मेरा मेन्यू", short: "Menu", shortHi: "मेन्यू", add: "Add dish", addHi: "डिश जोड़ें", one: "a dish", oneHi: "एक डिश",
    name: "Dish / item name — e.g. Paneer Butter Masala, Thali, Chai", nameHi: "डिश का नाम — जैसे पनीर बटर मसाला, थाली, चाय",
    price: "Price ₹", priceHi: "दाम ₹", priceEg: "e.g. 180 per plate", priceEgHi: "जैसे 180 per plate",
    mrp: false, brand: false,
    lines: "What is special about it (one line each) — e.g. made in pure ghee", linesHi: "इसकी खास बात (हर लाइन अलग) — जैसे शुद्ध घी में बना",
    guide: "Add your popular dishes with a photo and price. They go on your card, website and daily posters.", guideHi: "अपनी popular डिश फ़ोटो और दाम के साथ डालें। यही card, website और रोज़ के poster पर जाएँगी।",
    empty: "No dishes yet. Add your popular ones — they show on your card, website and posters.", emptyHi: "अभी कोई डिश नहीं है। popular डिश जोड़ें — यही card, website और poster पर दिखेंगी।",
    special: ["🍽️ Fresh & hygienic", "🌿 Pure veg", "🏠 Home delivery", "👨‍🍳 Experienced cooks", "💰 Fair prices", "🎉 Party & bulk orders"],
    work: "What do you serve, and for whom?", workHi: "आप क्या खिलाते हैं, और किसके लिए?",
    workEg: "e.g. North Indian food and thalis, family seating, home delivery and party orders.", workEgHi: "जैसे नॉर्थ इंडियन खाना और थाली, family seating, home delivery और party order।",
  },
  services: {
    ...PRODUCTS, word: "services",
    aboutEg: "AC repair and wiring, same-day visit in Delhi", aboutEgHi: "AC repair और wiring, Delhi में same-day visit", offerEg: "10% off on your first service", offerEgHi: "पहली service पर 10% off", specialEg: "same-day visit, fixed rates told first", specialEgHi: "same-day visit, दाम पहले बताते हैं",
    specialQ: "What makes your service special?", specialQHi: "आपकी सेवा की खास बात क्या है?", customersQ: "Who are your customers?", customersQHi: "आपके ग्राहक कौन हैं?",
    title: "My services", titleHi: "मेरी सेवाएँ", short: "Services", shortHi: "सेवाएँ", add: "Add service", addHi: "सेवा जोड़ें", one: "a service", oneHi: "एक सेवा",
    name: "Service name — e.g. AC repair, GST filing, Wedding photography", nameHi: "सेवा का नाम — जैसे AC repair, GST filing, Wedding photography",
    price: "Charges ₹ (optional)", priceHi: "चार्ज ₹ (optional)", priceEg: "e.g. 500 per visit, or leave blank", priceEgHi: "जैसे 500 per visit, या खाली छोड़ें",
    mrp: false, brand: false,
    lines: "What the customer gets (one line each) — e.g. same-day service", linesHi: "ग्राहक को क्या मिलता है (हर लाइन अलग) — जैसे same-day service",
    guide: "List the services you do, with a photo of the work where you have one. They show on your card, website and posters.", guideHi: "जो सेवाएँ आप देते हैं वो लिखें, काम की फ़ोटो हो तो डालें। यही card, website और poster पर दिखेंगी।",
    empty: "No services yet. Add the ones you do most — they show on your card, website and posters.", emptyHi: "अभी कोई सेवा नहीं है। जो सबसे ज़्यादा करते हैं वो जोड़ें — card, website और poster पर दिखेंगी।",
    special: ["⏱️ On-time service", "🧑‍🔧 Expert team", "💰 Fair, fixed rates", "🏠 Service at your doorstep", "✅ Guaranteed work", "🤝 Trusted by many customers"],
    work: "What work do you do, and for whom?", workHi: "आप क्या काम करते हैं, और किसके लिए?",
    workEg: "e.g. All electrical work for homes and shops — wiring, fans, AC installation; same-day visits in the city.", workEgHi: "जैसे घर और दुकान का सारा electrical काम — wiring, fan, AC installation; शहर में same-day visit।",
  },
  treatments: {
    ...PRODUCTS, word: "treatments",
    aboutEg: "general physician, evening clinic, lab tests on site", aboutEgHi: "general physician, शाम का clinic, lab test यहीं", offerEg: "Free first consultation this month", offerEgHi: "इस महीने पहली consultation free", specialEg: "painless treatment, same-day appointment", specialEgHi: "दर्द-रहित इलाज, same-day appointment",
    specialQ: "What makes your clinic special?", specialQHi: "आपके clinic की खास बात क्या है?", customersQ: "Who are your patients?", customersQHi: "आपके मरीज़ कौन हैं?",
    title: "My treatments & services", titleHi: "मेरे उपचार और सेवाएँ", short: "Treatments", shortHi: "उपचार", add: "Add treatment", addHi: "उपचार जोड़ें", one: "a treatment", oneHi: "एक उपचार",
    name: "Treatment / service — e.g. Root canal, Full body check-up, Hair spa", nameHi: "उपचार / सेवा — जैसे Root canal, Full body check-up, Hair spa",
    price: "Fee ₹ (optional)", priceHi: "फ़ीस ₹ (optional)", priceEg: "e.g. 300 consultation, or leave blank", priceEgHi: "जैसे 300 consultation, या खाली छोड़ें",
    mrp: false, brand: false,
    lines: "What it covers (one line each) — e.g. painless, single sitting", linesHi: "इसमें क्या शामिल है (हर लाइन अलग) — जैसे दर्द-रहित, एक sitting",
    guide: "List what you treat or offer. Fees are optional. It shows on your card, website and posters.", guideHi: "आप क्या-क्या उपचार / सेवा देते हैं लिखें। फ़ीस optional है। यही card, website और poster पर दिखेगा।",
    empty: "Nothing listed yet. Add your main treatments or services — they show on your card and website.", emptyHi: "अभी कुछ नहीं है। मुख्य उपचार / सेवाएँ जोड़ें — card और website पर दिखेंगी।",
    special: ["🩺 Experienced & qualified", "🧼 Hygienic, modern set-up", "⏰ On-time appointments", "💬 Honest advice", "💰 Fair fees", "🤝 Trusted by families"],
    customers: ["👪 Families", "👶 Children", "👵 Senior citizens", "🧑‍💼 Working people", "👩 Women", "🙋 Everyone"],
    work: "What do you treat or offer, and for whom?", workHi: "आप क्या उपचार / सेवा देते हैं, और किसके लिए?",
    workEg: "e.g. General physician for the whole family — fever, BP, diabetes; evening clinic, lab tests on site.", workEgHi: "जैसे पूरे परिवार के लिए general physician — बुखार, BP, diabetes; शाम का clinic, lab test यहीं।",
  },
  courses: {
    ...PRODUCTS, word: "courses",
    aboutEg: "nursery to class 12, CBSE, smart classes, school bus", aboutEgHi: "नर्सरी से 12वीं, CBSE, smart class, school bus", offerEg: "Admission open — no admission fee this month", offerEgHi: "Admission open — इस महीने admission fee नहीं", specialEg: "small classes, attention to every child", specialEgHi: "छोटी class, हर बच्चे पर ध्यान",
    specialQ: "What makes your institution special?", specialQHi: "आपके संस्थान की खास बात क्या है?", customersQ: "Who studies with you?", customersQHi: "आपके यहाँ कौन पढ़ता है?",
    title: "Classes & courses", titleHi: "कक्षाएँ और कोर्स", short: "Courses", shortHi: "कोर्स", add: "Add class / course", addHi: "कक्षा / कोर्स जोड़ें", one: "a class or course", oneHi: "एक कक्षा / कोर्स",
    name: "Class / course — e.g. Nursery to UKG, Class 1–8, Class 11–12 Science, Spoken English", nameHi: "कक्षा / कोर्स — जैसे Nursery से UKG, कक्षा 1–8, 11–12 Science, Spoken English",
    price: "Fee ₹ (optional)", priceHi: "फ़ीस ₹ (optional)", priceEg: "e.g. 1,500 per month, or leave blank", priceEgHi: "जैसे 1,500 per month, या खाली छोड़ें",
    mrp: false, brand: false,
    lines: "What is included (one line each) — e.g. books & smart class, transport, weekly tests", linesHi: "क्या शामिल है (हर लाइन अलग) — जैसे किताबें और smart class, transport, weekly test",
    guide: "Add the classes or courses you offer, with the fee if you share it. Parents see these on your card and website.", guideHi: "जो कक्षाएँ / कोर्स आप चलाते हैं वो डालें, फ़ीस बताते हों तो वो भी। अभिभावक इन्हें card और website पर देखेंगे।",
    empty: "No classes added yet. Add the classes or courses you offer — they show on your card, website and posters.", emptyHi: "अभी कोई कक्षा नहीं है। जो कक्षाएँ / कोर्स चलाते हैं वो जोड़ें — card, website और poster पर दिखेंगे।",
    special: ["🧑‍🏫 Experienced teachers", "🏫 Safe, clean campus", "💻 Smart classes", "🚌 Transport", "🏅 Good results", "👧 Attention to every child"],
    customers: ["👶 Small children", "🎒 School students", "🎓 College students", "🧑‍💼 Working people", "👪 Parents", "🙋 Everyone"],
    work: "What do you teach, and for whom?", workHi: "आप क्या पढ़ाते हैं, और किसके लिए?",
    workEg: "e.g. English-medium school from nursery to class 12, CBSE board; sports, smart classes and bus on fixed routes.", workEgHi: "जैसे नर्सरी से 12वीं तक English-medium स्कूल, CBSE; खेल, smart class और तय रूट पर bus।",
  },
  projects: {
    ...PRODUCTS, word: "projects",
    aboutEg: "home interiors, modular kitchens, 10 years in Delhi", aboutEgHi: "home interior, modular kitchen, Delhi में 10 साल", offerEg: "Free site visit and quotation", offerEgHi: "Free site visit और quotation", specialEg: "designs to your taste, on-time delivery", specialEgHi: "आपकी पसंद के design, समय पर delivery",
    specialQ: "What makes your work special?", specialQHi: "आपके काम की खास बात क्या है?", customersQ: "Who are your clients?", customersQHi: "आपके client कौन हैं?",
    title: "My work & projects", titleHi: "मेरा काम और प्रोजेक्ट", short: "Work", shortHi: "काम", add: "Add work", addHi: "काम जोड़ें", one: "a project", oneHi: "एक प्रोजेक्ट",
    name: "Project / work — e.g. 3BHK interior, Wedding shoot, Shop front", nameHi: "प्रोजेक्ट / काम — जैसे 3BHK interior, Wedding shoot, Shop front",
    price: "Starting price ₹ (optional)", priceHi: "शुरुआती दाम ₹ (optional)", priceEg: "e.g. 25,000 onwards, or leave blank", priceEgHi: "जैसे 25,000 से, या खाली छोड़ें",
    mrp: false, brand: false,
    lines: "What was done / what is included (one line each)", linesHi: "क्या किया / क्या शामिल है (हर लाइन अलग)",
    guide: "Add photos of your best work with a name. Customers judge you by these on your card and website.", guideHi: "अपने सबसे अच्छे काम की फ़ोटो नाम के साथ डालें। ग्राहक card और website पर इन्हीं से आपको आँकते हैं।",
    empty: "No work added yet. Add your best projects with photos — they show on your card, website and posters.", emptyHi: "अभी कोई काम नहीं है। अपने सबसे अच्छे प्रोजेक्ट फ़ोटो के साथ जोड़ें — card, website और poster पर दिखेंगे।",
    special: ["🎯 Designs to your taste", "⏱️ On-time delivery", "💰 Clear quotation", "🧑‍🔧 Skilled team", "📐 Quality material & finish", "🤝 Trusted by many clients"],
    work: "What work do you do, and for whom?", workHi: "आप क्या काम करते हैं, और किसके लिए?",
    workEg: "e.g. Complete home interiors — modular kitchens, wardrobes, false ceilings — for flats and villas in the city.", workEgHi: "जैसे पूरा home interior — modular kitchen, wardrobe, false ceiling — शहर के flat और villa के लिए।",
  },
  plans: {
    ...PRODUCTS, word: "plans",
    aboutEg: "term and child plans, claims help, 12 years", aboutEgHi: "term और child plan, claim में मदद, 12 साल", offerEg: "Free policy review this month", offerEgHi: "इस महीने free policy review", specialEg: "help with every claim, honest advice", specialEgHi: "हर claim में मदद, सही सलाह",
    specialQ: "What makes your plans special?", specialQHi: "आपके प्लान की खास बात क्या है?", customersQ: "Who takes your plans?", customersQHi: "आपके प्लान कौन लेता है?",
    title: "My plans & packages", titleHi: "मेरे प्लान और पैकेज", short: "Plans", shortHi: "प्लान", add: "Add plan", addHi: "प्लान जोड़ें", one: "a plan", oneHi: "एक प्लान",
    name: "Plan / package — e.g. Term plan, Monthly gym, Goa 4N/5D", nameHi: "प्लान / पैकेज — जैसे Term plan, Monthly gym, Goa 4N/5D",
    price: "Price ₹", priceHi: "दाम ₹", priceEg: "e.g. 1,200 per month", priceEgHi: "जैसे 1,200 per month",
    mrp: true, brand: true,
    lines: "What is included (one line each)", linesHi: "क्या शामिल है (हर लाइन अलग)",
    guide: "Add the plans or packages you offer with the price. They show on your card, website and daily posters.", guideHi: "जो प्लान / पैकेज आप देते हैं वो दाम के साथ डालें। यही card, website और रोज़ के poster पर दिखेंगे।",
    empty: "No plans yet. Add the ones you offer — they show on your card, website and posters.", emptyHi: "अभी कोई प्लान नहीं है। जो देते हैं वो जोड़ें — card, website और poster पर दिखेंगे।",
    special: ["💰 Best value", "📞 Help after the sale", "✅ Trusted company", "📄 Clear terms, no surprises", "⏱️ Quick processing", "🤝 Trusted by many customers"],
    work: "What do you offer, and for whom?", workHi: "आप क्या देते हैं, और किसके लिए?",
    workEg: "e.g. LIC advisor for 12 years — term, child and pension plans for families; claims help included.", workEgHi: "जैसे 12 साल से LIC advisor — परिवारों के लिए term, child और pension plan; claim में मदद भी।",
  },
  work: {
    ...PRODUCTS, word: "work",
    aboutEg: "health camps, education for children, 10 years in Delhi", aboutEgHi: "स्वास्थ्य शिविर, बच्चों की शिक्षा, Delhi में 10 साल", offerEg: "Free health camp on Sunday", offerEgHi: "रविवार को free health camp", specialEg: "always available, work for the community", specialEgHi: "हमेशा उपलब्ध, समाज के लिए काम",
    specialQ: "What makes you special?", specialQHi: "आपकी खास बात क्या है?", customersQ: "Who do you work for?", customersQHi: "आप किनके लिए काम करते हैं?",
    title: "What I do", titleHi: "मेरा काम", short: "Work", shortHi: "काम", add: "Add", addHi: "जोड़ें", one: "an item", oneHi: "एक चीज़",
    name: "Name — e.g. Blood donation camp, Annual function, Photo album", nameHi: "नाम — जैसे रक्तदान शिविर, वार्षिक उत्सव, फ़ोटो एल्बम",
    price: "Price ₹ (optional)", priceHi: "दाम ₹ (optional)", priceEg: "leave blank if not for sale", priceEgHi: "बिकता न हो तो खाली छोड़ें",
    mrp: false, brand: false,
    lines: "A line or two about it", linesHi: "इसके बारे में एक-दो लाइन",
    guide: "Add photos of your work, events or activities with a name. They show on your card and website.", guideHi: "अपने काम, कार्यक्रम या गतिविधियों की फ़ोटो नाम के साथ डालें। card और website पर दिखेंगी।",
    empty: "Nothing added yet. Add photos of your work or events — they show on your card and website.", emptyHi: "अभी कुछ नहीं है। अपने काम या कार्यक्रम की फ़ोटो जोड़ें — card और website पर दिखेंगी।",
    special: ["🤝 Always available", "❤️ Work for the community", "📣 Clear, honest communication", "🏅 Years of experience", "👥 Strong team", "🙏 Trusted by people"],
    work: "What do you do, and for whom?", workHi: "आप क्या करते हैं, और किसके लिए?",
    workEg: "e.g. Social work in the city for 10 years — health camps, education for children, help in emergencies.", workEgHi: "जैसे शहर में 10 साल से समाजसेवा — स्वास्थ्य शिविर, बच्चों की शिक्षा, आपदा में मदद।",
  },
};

/** Step 3's words for a trade. Nothing chosen yet → a shop's words. */
export function catalogCopyFor(categoryKey: string | null | undefined): CatalogCopy {
  const word = categoryKey ? recipeFor(categoryKey).catalog : "products";
  return BY_WORD[word] ?? PRODUCTS;
}

/** The 2-4 things a website of this trade must say (from the trade data) — the step's "what to add" list,
 *  so a school is asked about classes, board and admission and a sweet shop about freshness and bulk orders. */
export function tradeNeeds(categoryKey: string | null | undefined): { trade: string; tradeHi: string; items: string[] } | null {
  if (!categoryKey) return null;
  const c = categoryOf(categoryKey);
  const d = tradeDataFor(categoryKey);
  if (!c || !d?.explain?.length) return null;
  // "classes offered (play school / nursery to which class), the board and the medium of instruction" → first letter up
  const items = d.explain.slice(0, 4).map((s) => s.trim().replace(/^./, (ch) => ch.toUpperCase()));
  return { trade: c.en, tradeHi: c.hi, items };
}

/** The noun for the place or body behind the card, in the trade's own words — "school", "clinic", "restaurant",
 *  "company" — so a form never asks a school for its "company details" (owner's call, 4 Oct 2026). */
export type OrgWord = { en: string; hi: string; /** Capitalised, for a label's start: "School". */ En: string };
const ORG_BY_KEY: Record<string, [string, string]> = {
  school: ["school", "स्कूल"], playschool: ["play school", "प्ले स्कूल"], college: ["college", "कॉलेज"], coaching: ["institute", "इंस्टीट्यूट"], computer: ["institute", "इंस्टीट्यूट"],
  doctor: ["clinic", "clinic"], dentist: ["clinic", "clinic"], hospital: ["hospital", "अस्पताल"], physio: ["clinic", "clinic"], ayurveda: ["clinic", "clinic"], vet: ["clinic", "clinic"], lab: ["lab", "lab"],
  restaurant: ["restaurant", "रेस्टोरेंट"], hotel: ["hotel", "होटल"], sweets: ["shop", "दुकान"], kirana: ["shop", "दुकान"], medical: ["store", "store"], garments: ["showroom", "शोरूम"], furniture: ["showroom", "शोरूम"], jewellery: ["showroom", "शोरूम"], mobile: ["shop", "दुकान"], hardware: ["shop", "दुकान"], footwear: ["shop", "दुकान"], optical: ["shop", "दुकान"], gift: ["shop", "दुकान"], textile: ["shop", "दुकान"],
  salon: ["salon", "सैलून"], gym: ["gym", "जिम"], tiffin: ["kitchen", "किचन"], catering: ["kitchen", "किचन"], bakery: ["bakery", "बेकरी"],
  ngo: ["organisation", "संस्था"], temple: ["temple", "मंदिर"], society: ["society", "सोसायटी"], community: ["organisation", "संस्था"],
  builder: ["company", "company"], realestate: ["office", "office"], ca: ["office", "office"], lawyer: ["office", "office"], insurance: ["office", "office"], finance: ["office", "office"],
  manufacturer: ["factory", "फ़ैक्टरी"], wholesale: ["firm", "firm"], transport: ["company", "company"], courier: ["company", "company"],
};
export function orgWordFor(categoryKey: string | null | undefined): OrgWord {
  const hit = categoryKey ? ORG_BY_KEY[categoryKey] : undefined;
  let en = hit?.[0], hi = hit?.[1];
  if (!en) {
    const word = categoryKey ? recipeFor(categoryKey).catalog : "products";
    [en, hi] = word === "courses" ? ["institute", "इंस्टीट्यूट"] : word === "treatments" ? ["clinic", "clinic"] : word === "menu" ? ["restaurant", "रेस्टोरेंट"] : word === "products" ? ["business", "business"] : ["business", "business"];
  }
  return { en, hi: hi ?? en, En: en.replace(/^./, (c) => c.toUpperCase()) };
}

/** An example name for the name box, in the trade's own kind — never a real brand (owner's call, 4 Oct 2026):
 *  "Sunrise Public School", "City Care Clinic", "Sharma Sweets". Unknown trade → "Sunrise <org>". */
const EXAMPLE_NAME: Record<string, string> = {
  school: "Sunrise Public School", playschool: "Little Stars Play School", college: "City Degree College", coaching: "Bright Minds Coaching", computer: "Digital Computer Institute",
  doctor: "City Care Clinic", dentist: "Smile Dental Clinic", hospital: "City Care Hospital", physio: "Active Physio Clinic", ayurveda: "Arogya Ayurveda Clinic", vet: "Pet Care Clinic", lab: "City Diagnostic Lab", medical: "City Medical Store",
  restaurant: "Spice Garden Restaurant", hotel: "Hotel Green View", sweets: "Sharma Sweets", bakery: "Golden Crust Bakery", catering: "Annapurna Caterers", tiffin: "Ghar Ka Khana Tiffin", dairy: "Fresh Dairy",
  kirana: "Gupta General Store", garments: "Fashion Point", textile: "Saree Palace", jewellery: "Shree Jewellers", mobile: "Mobile Point", furniture: "Home Style Furniture", hardware: "Verma Hardware", footwear: "Step In Footwear", optical: "Clear Vision Opticals", gift: "Gift Gallery",
  salon: "Glamour Beauty Salon", gym: "Fit Zone Gym", wellness: "Wellness Hub", water: "Pure Water Solutions",
  electrician: "Raj Electricals", auto: "City Motors", tailor: "Perfect Fit Tailors", printing: "Quick Print", cleaning: "Spark Cleaning Services", photography: "Pixel Studio", event: "Royal Events", travel: "Sky Tours & Travels", transport: "Fast Track Transport", courier: "Speed Courier",
  realestate: "Prime Properties", builder: "Shree Builders", interior: "Dream Interiors", it: "Tech Solutions", ca: "Sharma & Associates", lawyer: "Verma Law Chambers", insurance: "Secure Life Advisor", finance: "Smart Finance",
  manufacturer: "Shree Industries", wholesale: "Gupta Traders", agri: "Kisan Agro Centre", ngo: "Seva Foundation", astro: "Jyotish Kendra",
};
export function exampleNameFor(categoryKey: string | null | undefined): string {
  if (categoryKey && EXAMPLE_NAME[categoryKey]) return EXAMPLE_NAME[categoryKey];
  const org = orgWordFor(categoryKey);
  return org.en === "business" ? "Sharma Sweets" : `Sunrise ${org.En}`;
}
/** The same name as a website address: "sunrisepublicschool.com". */
export function exampleSiteFor(categoryKey: string | null | undefined): string {
  return `${exampleNameFor(categoryKey).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "")}.com`;
}
