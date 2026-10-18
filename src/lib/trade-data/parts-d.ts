// Parts of five combined categories (see lib/trade-parts.ts and trade-data/parts.ts): IT, Sweets / bakery, Gifts / stationery,
// Furniture / decor, Mobile / electronics. Same rules as types.ts: plain Indian English, natural Hindi, no numbers, no prices,
// no guarantees. Used when the owner ticks only some of the parts.
import type { TradeLine } from "./types";
import type { TradePart } from "@/lib/trade-parts";

export const PARTS_D: Record<string, TradePart[]> = {
  it: [
    { key: "software", en: "Software & apps", hi: "सॉफ़्टवेयर और ऐप", label: "Software company", labelHi: "सॉफ़्टवेयर कंपनी" },
    { key: "marketing", en: "Digital marketing", hi: "डिजिटल मार्केटिंग", label: "Digital marketing agency", labelHi: "डिजिटल मार्केटिंग एजेंसी" },
  ],
  sweets: [
    { key: "sweets", en: "Sweets & namkeen", hi: "मिठाई और नमकीन", label: "Sweet shop", labelHi: "मिठाई की दुकान" },
    { key: "bakery", en: "Bakery & cakes", hi: "बेकरी और केक", label: "Bakery", labelHi: "बेकरी" },
  ],
  gift: [
    { key: "gifts", en: "Gifts", hi: "गिफ़्ट", label: "Gift shop", labelHi: "गिफ़्ट शॉप" },
    { key: "stationery", en: "Stationery", hi: "स्टेशनरी", label: "Stationery shop", labelHi: "स्टेशनरी की दुकान" },
  ],
  furniture: [
    { key: "furniture", en: "Furniture", hi: "फ़र्नीचर", label: "Furniture showroom", labelHi: "फ़र्नीचर शोरूम" },
    { key: "decor", en: "Home decor", hi: "होम डेकोर", label: "Home decor store", labelHi: "होम डेकोर स्टोर" },
  ],
  mobile: [
    { key: "mobile", en: "Mobile phones", hi: "मोबाइल फ़ोन", label: "Mobile shop", labelHi: "मोबाइल की दुकान" },
    { key: "electronics", en: "Electronics & accessories", hi: "इलेक्ट्रॉनिक्स और एक्सेसरीज़", label: "Electronics shop", labelHi: "इलेक्ट्रॉनिक्स की दुकान" },
  ],
};

/** category -> part key -> the English names of the "what you do / offer / sell" tick chips (exactly as in trade-questions.ts) that belong to that part. */
export const TICKS_D: Record<string, Record<string, string[]>> = {
  it: {
    software: ["Websites", "Mobile apps", "Software / ERP", "IT support / AMC", "Hosting / domains"],
    marketing: ["Websites", "Digital marketing", "SEO", "Social media"],
  },
  sweets: {
    sweets: ["Sweets", "Namkeen", "Dairy", "Catering orders", "Dry fruit sweets"],
    bakery: ["Bakery / cakes", "Catering orders"],
  },
  gift: {
    gifts: ["Gifts", "Toys", "Customised gifts", "Decor"],
    stationery: ["Stationery", "Books"],
  },
  furniture: {
    furniture: ["Sofa", "Beds", "Dining", "Office furniture", "Modular kitchen", "Mattresses"],
    decor: ["Home decor"],
  },
  mobile: {
    mobile: ["Mobiles", "Accessories", "Repair", "Recharge", "EMI"],
    electronics: ["Accessories", "Laptops / electronics", "Repair", "EMI"],
  },
};

const L = (en: string, hi: string, desc: string, descHi: string): TradeLine => ({ en, hi, desc, descHi });

export const SEEDS_D: Record<string, { explain: string[]; services: TradeLine[]; avoid: string[] }> = {
  // ---------------------------------------------------------------- IT
  "it:software": {
    explain: [
      "what you build — websites, mobile apps, billing and business software, custom tools",
      "who it is for: small businesses, shops, clinics, professionals",
      "the process — requirement, design shown first, build, launch, support",
      "plain language, fixed quote and ownership of the work",
    ],
    services: [
      L("Website development", "वेबसाइट डेवलपमेंट", "Mobile-friendly websites for shops, clinics and professionals.", "दुकान, क्लिनिक और प्रोफ़ेशनल के लिए मोबाइल पर चलने वाली वेबसाइट।"),
      L("Mobile apps", "मोबाइल ऐप", "Android and iOS apps for your business or idea.", "आपके कारोबार या आइडिया के लिए Android और iOS ऐप।"),
      L("Billing & business software", "बिलिंग और बिज़नेस सॉफ़्टवेयर", "Billing, stock, accounts and customer records for daily work.", "रोज़ के काम के लिए बिलिंग, स्टॉक, हिसाब और ग्राहकों का रिकॉर्ड।"),
      L("Custom software", "कस्टम सॉफ़्टवेयर", "Software made around the way your business actually works.", "आपके काम करने के तरीक़े के हिसाब से बना सॉफ़्टवेयर।"),
      L("Web portals & dashboards", "वेब पोर्टल और डैशबोर्ड", "Login-based portals and simple dashboards for staff and customers.", "स्टाफ़ और ग्राहकों के लिए लॉगिन वाले पोर्टल और आसान डैशबोर्ड।"),
      L("Hosting & domains", "होस्टिंग और डोमेन", "Domain and hosting set up in your name and kept running.", "आपके नाम पर डोमेन और होस्टिंग, और उसे चालू रखना।"),
      L("Maintenance & support", "रखरखाव और सपोर्ट", "Updates, backups and fixes after the launch.", "लॉन्च के बाद अपडेट, बैकअप और सुधार।"),
    ],
    avoid: ["seo", "social media", "run ads", "ad spend", "google and social media ads", "google business", "reels", "digital marketing"],
  },
  "it:marketing": {
    explain: [
      "what you do — social media, Google and Meta ads, SEO, Google Business, content and reels",
      "who it is for: local shops, clinics, restaurants, coaching and professionals",
      "the process — understand the business, plan, run, report in plain words",
      "plain language, fixed fee and the ad budget kept separate and in the owner's hands",
    ],
    services: [
      L("Social media management", "सोशल मीडिया मैनेजमेंट", "Regular posts, reels and replies on Instagram and Facebook.", "Instagram और Facebook पर नियमित पोस्ट, रील और जवाब।"),
      L("Google & social media ads", "Google और सोशल मीडिया विज्ञापन", "Ads set up and watched to reach customers in your area.", "आपके इलाक़े के ग्राहकों तक पहुँचने के लिए विज्ञापन लगाना और उन पर नज़र रखना।"),
      L("SEO", "SEO", "Better ranking on Google when people search for what you offer.", "लोग जो आप देते हैं उसे खोजें तो Google पर बेहतर जगह।"),
      L("Google Business & listings", "Google Business और लिस्टिंग", "Your business on Google Maps and directories, set up properly.", "Google Maps और डायरेक्टरी पर आपका कारोबार, सही तरह से।"),
      L("Content, photos & reels", "कंटेंट, फ़ोटो और रील", "Posters, photos, short videos and captions for your page.", "आपके पेज के लिए पोस्टर, फ़ोटो, छोटे वीडियो और कैप्शन।"),
      L("Website & landing pages", "वेबसाइट और लैंडिंग पेज", "Simple pages made to collect enquiries and calls.", "पूछताछ और कॉल पाने के लिए बने आसान पेज।"),
      L("WhatsApp & email campaigns", "WhatsApp और ईमेल कैंपेन", "Offers and updates sent to your own customer list.", "आपके अपने ग्राहकों की सूची को ऑफ़र और जानकारी भेजना।"),
    ],
    avoid: ["mobile app", "billing software", "erp", "crm", "custom software", "hosting", "software development", "backup"],
  },

  // ---------------------------------------------------------------- SWEETS
  "sweets:sweets": {
    explain: [
      "what is made and sold (sweets, namkeen, dry fruit sweets, gift boxes) and the house specialities",
      "freshness — made in small batches with pure ghee and clean ingredients",
      "orders for weddings, festivals, pooja and corporate gifting, and bulk orders",
      "how to order: walk in, WhatsApp, delivery",
    ],
    services: [
      L("Fresh sweets daily", "रोज़ ताज़ी मिठाई", "Traditional sweets made fresh every day, sold by weight or in boxes.", "रोज़ ताज़ी बनी पारंपरिक मिठाइयाँ, तौल पर या डिब्बों में।"),
      L("Namkeen & snacks", "नमकीन और स्नैक्स", "Crisp namkeen, bhujia and savouries for home and travel.", "घर और सफ़र के लिए कुरकुरी नमकीन, भुजिया और चटपटे स्नैक्स।"),
      L("Festival & gift boxes", "त्योहार और गिफ़्ट बॉक्स", "Assorted boxes and hampers for Diwali, Holi, Rakhi and weddings.", "दिवाली, होली, राखी और शादी के लिए तरह-तरह के डिब्बे और हैम्पर।"),
      L("Bulk & wedding orders", "शादी और थोक ऑर्डर", "Large orders for weddings, pooja and events, packed as you want.", "शादी, पूजा और आयोजनों के लिए बड़े ऑर्डर, आपके मन की पैकिंग में।"),
      L("Dry fruit & sugar-free sweets", "ड्राई फ़्रूट और शुगर-फ़्री मिठाई", "Dry fruit sweets, and sugar-free ones made on request.", "ड्राई फ़्रूट की मिठाई, और माँगने पर शुगर-फ़्री भी।"),
      L("Home delivery", "होम डिलीवरी", "Order on WhatsApp and get it delivered in the city.", "WhatsApp पर ऑर्डर करें, शहर में घर तक डिलीवरी।"),
      L("Corporate gifting", "कॉर्पोरेट गिफ़्टिंग", "Plain or branded gift packs for offices and clients.", "ऑफ़िस और क्लाइंट के लिए सादे या ब्रांड वाले गिफ़्ट पैक।"),
    ],
    avoid: ["cake", "bakery", "eggless", "pastry", "bread", "cookies", "brownie", "cupcake", "oven"],
  },
  "sweets:bakery": {
    explain: [
      "what is baked and sold (cakes, pastries, bread, cookies, snacks) and the house specialities",
      "freshness — baked fresh daily, clean ingredients, eggless options",
      "custom cakes for birthdays, anniversaries and parties, and bulk orders",
      "how to order: walk in, WhatsApp, delivery",
    ],
    services: [
      L("Fresh cakes & pastries", "ताज़े केक और पेस्ट्री", "Cakes and pastries baked fresh every day, by the piece or by weight.", "रोज़ ताज़े बने केक और पेस्ट्री, पीस में या तौल पर।"),
      L("Custom & birthday cakes", "कस्टम और बर्थडे केक", "Cakes made to your flavour, design and message for the occasion.", "मौक़े के हिसाब से आपके फ़्लेवर, डिज़ाइन और संदेश वाला केक।"),
      L("Eggless cakes", "एगलेस केक", "Eggless options in the popular flavours; tell us when you order.", "पसंदीदा फ़्लेवर में एगलेस विकल्प; ऑर्डर के समय बता दें।"),
      L("Bread, buns & cookies", "ब्रेड, बन और कुकीज़", "Fresh bread, buns, rusks and cookies for the daily table.", "रोज़ के लिए ताज़ी ब्रेड, बन, रस्क और कुकीज़।"),
      L("Savoury snacks", "नमकीन स्नैक्स", "Puffs, patties, sandwiches and pizza base for tea time.", "चाय के साथ पफ़, पैटीज़, सैंडविच और पिज़्ज़ा बेस।"),
      L("Party & bulk orders", "पार्टी और थोक ऑर्डर", "Cakes, cupcakes and snack boxes for parties and offices.", "पार्टी और ऑफ़िस के लिए केक, कपकेक और स्नैक बॉक्स।"),
      L("Home delivery", "होम डिलीवरी", "Order on WhatsApp and get it delivered in the city.", "WhatsApp पर ऑर्डर करें, शहर में घर तक डिलीवरी।"),
    ],
    avoid: ["mithai", "barfi", "ladoo", "namkeen", "pure ghee", "milk sweets", "dry sweets", "ghewar", "rasgulla", "pooja", "sugar-free"],
  },

  // ---------------------------------------------------------------- GIFT
  "gift:gifts": {
    explain: [
      "what you sell (gifts for every occasion, toys, greeting cards, party items, home and decor gifts)",
      "gift wrapping, hampers and personalised gifts (mugs, frames, printed names)",
      "bulk orders for return gifts, offices and corporate gifting",
      "festival and season stock; how to order on WhatsApp",
    ],
    services: [
      L("Gifts for every occasion", "हर मौक़े के गिफ़्ट", "Birthdays, anniversaries, Rakhi, Diwali — gifts for all budgets.", "जन्मदिन, सालगिरह, राखी, दिवाली — हर बजट के गिफ़्ट।"),
      L("Gift wrapping & hampers", "गिफ़्ट पैकिंग और हैम्पर", "Wrapped and ready to give; hampers put together as you like.", "पैक करके देने के लिए तैयार; हैम्पर आपकी पसंद से सजाए जाते हैं।"),
      L("Personalised gifts", "पर्सनलाइज़्ड गिफ़्ट", "Mugs, frames, cushions and keychains with a name or photo.", "नाम या फ़ोटो के साथ मग, फ़्रेम, कुशन और कीचेन।"),
      L("Return gifts & bulk", "रिटर्न गिफ़्ट और थोक", "Return gifts for parties and functions, in the quantity you need.", "पार्टी और फ़ंक्शन के लिए रिटर्न गिफ़्ट, जितनी ज़रूरत हो उतने।"),
      L("Corporate gifting", "कॉर्पोरेट गिफ़्टिंग", "Gift sets for staff and clients, plain or with a logo.", "स्टाफ़ और क्लाइंट के लिए गिफ़्ट सेट, सादे या लोगो के साथ।"),
      L("Toys & games", "खिलौने और गेम", "Toys, puzzles and board games for kids of all ages.", "हर उम्र के बच्चों के लिए खिलौने, पज़ल और बोर्ड गेम।"),
      L("Party supplies", "पार्टी का सामान", "Balloons, candles, decorations and cards for celebrations.", "जश्न के लिए गुब्बारे, मोमबत्ती, सजावट और कार्ड।"),
    ],
    avoid: ["stationery", "notebook", "school", "pens", "office supplies", "art supplies", "files and", "exercise book"],
  },
  "gift:stationery": {
    explain: [
      "what you sell (notebooks, pens, art and craft supplies, files, school and office supplies, books)",
      "school-season stock — books, copies, geometry boxes and bags — and office essentials",
      "bulk orders with a bill for schools, offices and institutions",
      "how to order: walk in with the list or send it on WhatsApp",
    ],
    services: [
      L("Notebooks & writing", "कॉपी और लिखने का सामान", "Notebooks, registers, pens, pencils and geometry boxes.", "कॉपी, रजिस्टर, पेन, पेंसिल और ज्योमेट्री बॉक्स।"),
      L("School supplies", "स्कूल का सामान", "Everything on the school list, ready before the term starts.", "स्कूल की लिस्ट का पूरा सामान, नया सत्र शुरू होने से पहले तैयार।"),
      L("Office stationery", "ऑफ़िस स्टेशनरी", "Files, paper, folders, staplers and daily office essentials.", "फ़ाइल, काग़ज़, फ़ोल्डर, स्टेपलर और ऑफ़िस की रोज़ की चीज़ें।"),
      L("Art & craft supplies", "आर्ट और क्राफ़्ट का सामान", "Colours, brushes, sheets and project material for kids and hobbyists.", "बच्चों और शौक़ीनों के लिए रंग, ब्रश, शीट और प्रोजेक्ट का सामान।"),
      L("Books & guides", "किताबें और गाइड", "Textbooks, guides and story books; any title can be arranged.", "पाठ्यपुस्तकें, गाइड और कहानी की किताबें; कोई भी किताब मँगवा देते हैं।"),
      L("Bulk orders for schools & offices", "स्कूल और ऑफ़िस के थोक ऑर्डर", "Supplies delivered in bulk with a proper bill.", "थोक में सामान, सही बिल के साथ पहुँचाया जाता है।"),
      L("Photocopy & printing", "फ़ोटोकॉपी और प्रिंटिंग", "Photocopy, print-outs and lamination while you wait.", "फ़ोटोकॉपी, प्रिंट-आउट और लैमिनेशन हाथों-हाथ।"),
    ],
    avoid: ["toys", "hamper", "personalised", "return gift", "party", "balloon", "greeting", "mug", "frame", "wrapping", "photo or name", "anniversar"],
  },

  // ---------------------------------------------------------------- FURNITURE
  "furniture:furniture": {
    explain: [
      "what you make and sell (sofas, beds, dining, wardrobes, office furniture, mattresses) and the materials (teak, sheesham, engineered wood, steel)",
      "custom sizes and designs, made to order; modular kitchen and wardrobes if any",
      "home delivery, installation and after-sale repair or polish",
      "how to start: visit the showroom or share room photos on WhatsApp",
    ],
    services: [
      L("Sofas & living room", "सोफ़ा और लिविंग रूम", "Sofa sets, recliners, centre tables and TV units.", "सोफ़ा सेट, रिक्लाइनर, सेंटर टेबल और TV यूनिट।"),
      L("Beds & wardrobes", "बेड और अलमारी", "Beds, storage beds and wardrobes for bedrooms.", "बेडरूम के लिए बेड, स्टोरेज बेड और अलमारी।"),
      L("Dining sets", "डाइनिंग सेट", "Dining tables and chairs in wood, glass and metal.", "लकड़ी, काँच और धातु के डाइनिंग टेबल और कुर्सियाँ।"),
      L("Office furniture", "ऑफ़िस फ़र्नीचर", "Desks, chairs, storage and reception furniture.", "डेस्क, कुर्सियाँ, स्टोरेज और रिसेप्शन का फ़र्नीचर।"),
      L("Custom & made to order", "कस्टम और ऑर्डर पर", "Your size, wood and finish — made for your room.", "आपका साइज़, लकड़ी और फ़िनिश — आपके कमरे के लिए बना।"),
      L("Delivery & installation", "डिलीवरी और इंस्टॉलेशन", "Delivered to your home and assembled in place by our team.", "घर तक डिलीवरी और हमारी टीम द्वारा वहीं फ़िटिंग।"),
      L("Repair & polish", "रिपेयर और पॉलिश", "Old furniture repaired, re-polished or re-upholstered.", "पुराना फ़र्नीचर रिपेयर, दोबारा पॉलिश या नया कपड़ा।"),
    ],
    avoid: ["decor", "curtain", "lamp", "cushion", "wall art", "showpiece", "vase", "artificial plant"],
  },
  "furniture:decor": {
    explain: [
      "what you sell (wall art, mirrors, lamps, curtains, cushions, vases, showpieces, rugs)",
      "styling advice — colours and pieces that suit the room",
      "gifting pieces and festival decor; home delivery",
      "how to start: visit the store or share room photos on WhatsApp",
    ],
    services: [
      L("Wall art & mirrors", "वॉल आर्ट और शीशे", "Paintings, frames, wall hangings and mirrors for every room.", "हर कमरे के लिए पेंटिंग, फ़्रेम, वॉल हैंगिंग और शीशे।"),
      L("Lamps & lighting", "लैंप और लाइटिंग", "Table lamps, hanging lights and decorative lights.", "टेबल लैंप, लटकने वाली और सजावटी लाइटें।"),
      L("Curtains, cushions & rugs", "पर्दे, कुशन और कालीन", "Soft furnishings to change the look of a room.", "कमरे का रूप बदलने वाले पर्दे, कुशन और कालीन।"),
      L("Showpieces & vases", "शोपीस और फूलदान", "Decorative pieces for shelves, tables and entrances.", "शेल्फ़, मेज़ और प्रवेश द्वार के लिए सजावटी चीज़ें।"),
      L("Festival & gifting decor", "त्योहार और गिफ़्ट डेकोर", "Decor for Diwali and other festivals, and pieces that make good gifts.", "दिवाली और दूसरे त्योहारों की सजावट, और गिफ़्ट देने लायक़ चीज़ें।"),
      L("Styling advice", "सजावट की सलाह", "Help choosing colours and pieces that suit your room.", "आपके कमरे के हिसाब से रंग और चीज़ें चुनने में मदद।"),
      L("Home delivery", "होम डिलीवरी", "Delivered to your home, carefully packed.", "संभालकर पैक करके घर तक डिलीवरी।"),
    ],
    avoid: ["sofa", "wardrobe", "dining", "sheesham", "teak", "assemble", "mattress", "polish", "custom size", "office furniture", "modular"],
  },

  // ---------------------------------------------------------------- MOBILE
  "mobile:mobile": {
    explain: [
      "what you sell (smartphones, feature phones, accessories) and the brands",
      "repair and service: screen, battery, software, data transfer",
      "exchange of old phones, EMI and finance help, bill and warranty",
      "how to buy: walk in or ask on WhatsApp",
    ],
    services: [
      L("Smartphones & feature phones", "स्मार्टफ़ोन और कीपैड फ़ोन", "All popular brands with company bill and warranty.", "सभी लोकप्रिय ब्रांड, कंपनी बिल और वारंटी के साथ।"),
      L("Accessories", "एक्सेसरीज़", "Covers, screen guards, chargers, earphones and power banks.", "कवर, स्क्रीन गार्ड, चार्जर, ईयरफ़ोन और पावर बैंक।"),
      L("Repair & service", "रिपेयर और सर्विस", "Screen, battery, charging port and software issues fixed here.", "स्क्रीन, बैटरी, चार्जिंग पोर्ट और सॉफ़्टवेयर की दिक़्क़त यहीं ठीक।"),
      L("Old phone exchange", "पुराना फ़ोन एक्सचेंज", "Exchange your old phone and pay the difference on a new one.", "पुराना फ़ोन देकर नए का अंतर चुकाएँ।"),
      L("EMI & finance help", "EMI और फ़ाइनेंस में मदद", "Buy on easy EMI with a card or finance company; we do the paperwork.", "कार्ड या फ़ाइनेंस कंपनी से आसान EMI पर खरीदें; काग़ज़ी काम हम करते हैं।"),
      L("Setup & data transfer", "सेटअप और डेटा ट्रांसफ़र", "New phone set up, contacts and photos moved, screen guard fitted.", "नया फ़ोन सेट, कॉन्टैक्ट और फ़ोटो ट्रांसफ़र, स्क्रीन गार्ड लगा हुआ।"),
      L("SIM & recharge", "सिम और रिचार्ज", "Mobile recharge and new SIM help for all networks.", "सभी नेटवर्क के लिए मोबाइल रिचार्ज और नया सिम लेने में मदद।"),
    ],
    avoid: ["laptop", "speaker", "appliance", "television", "smartwatch", "home theatre", "air cooler"],
  },
  "mobile:electronics": {
    explain: [
      "what you sell (TV, speakers, laptops, smartwatches, small appliances, accessories) and the brands",
      "advice on choosing the right product, company bill and warranty",
      "installation and demo, repair help, EMI and finance",
      "how to buy: walk in or ask on WhatsApp",
    ],
    services: [
      L("TVs & home audio", "TV और होम ऑडियो", "Smart TVs, soundbars and speakers from trusted brands.", "जाने-माने ब्रांड के स्मार्ट TV, साउंडबार और स्पीकर।"),
      L("Laptops & computer accessories", "लैपटॉप और कंप्यूटर एक्सेसरीज़", "Laptops, keyboards, mice, pen drives and printers.", "लैपटॉप, कीबोर्ड, माउस, पेन ड्राइव और प्रिंटर।"),
      L("Smartwatches & earphones", "स्मार्टवॉच और ईयरफ़ोन", "Smartwatches, earbuds, headphones and fitness bands.", "स्मार्टवॉच, ईयरबड, हेडफ़ोन और फ़िटनेस बैंड।"),
      L("Small appliances", "छोटे अप्लायंसेज़", "Fans, irons, mixers, heaters and other daily-use appliances.", "पंखे, प्रेस, मिक्सर, हीटर और रोज़ के काम के दूसरे अप्लायंसेज़।"),
      L("Chargers, cables & power banks", "चार्जर, केबल और पावर बैंक", "Chargers, cables, adapters and power banks for every device.", "हर डिवाइस के लिए चार्जर, केबल, एडॉप्टर और पावर बैंक।"),
      L("Demo & installation help", "डेमो और इंस्टॉलेशन में मदद", "We show how it works and help set it up at home.", "कैसे चलता है दिखाते हैं और घर पर लगाने में मदद करते हैं।"),
      L("EMI & finance help", "EMI और फ़ाइनेंस में मदद", "Buy bigger items on EMI with a card or finance company.", "बड़ा सामान कार्ड या फ़ाइनेंस कंपनी से EMI पर खरीदें।"),
    ],
    avoid: ["smartphone", "feature phone", "screen guard", "old phone", "data transfer", "phone exchange", "recharge", "sim card"],
  },
};
