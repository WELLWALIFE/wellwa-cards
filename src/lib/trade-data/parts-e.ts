// Parts of combined categories, batch E: the clothing trades (owner, 13 Nov 2026: "main ke baad sub — lehenga saree centre main hai,
// boutique / tailor additional"). garments and textile; tailor is in parts-a. Same rules as types.ts: plain Indian English, natural Hindi,
// no numbers, no prices, no guarantees. See lib/trade-parts.ts for how parts are used.
import type { TradeLine } from "./types";
import type { TradePart } from "@/lib/trade-parts";

export const PARTS_E: Record<string, TradePart[]> = {
  textile: [
    { key: "saree", en: "Sarees", hi: "साड़ियाँ", label: "Saree centre", labelHi: "साड़ी सेंटर" },
    { key: "lehenga", en: "Lehenga & bridal wear", hi: "लहंगा और ब्राइडल वियर" },
    { key: "suits", en: "Suits & dress material", hi: "सूट और ड्रेस मटीरियल" },
    { key: "boutique", en: "Boutique & stitching", hi: "बुटीक और सिलाई", label: "Boutique", labelHi: "बुटीक" },
    { key: "wholesale", en: "Wholesale / manufacturing", hi: "होलसेल / मैन्युफ़ैक्चरिंग", label: "Textile wholesaler", labelHi: "टेक्सटाइल होलसेलर" },
  ],
  garments: [
    { key: "ladies", en: "Ladies' wear", hi: "लेडीज़ वियर" },
    { key: "mens", en: "Men's wear", hi: "जेंट्स वियर" },
    { key: "kids", en: "Kids' wear", hi: "बच्चों के कपड़े" },
    { key: "ethnic", en: "Lehenga, sarees & wedding wear", hi: "लहंगा, साड़ी और शादी के कपड़े", label: "Lehenga & wedding wear", labelHi: "लहंगा और शादी के कपड़े" },
    { key: "boutique", en: "Boutique & stitching", hi: "बुटीक और सिलाई", label: "Boutique", labelHi: "बुटीक" },
    { key: "uniform", en: "School & office uniforms", hi: "स्कूल और ऑफ़िस यूनिफ़ॉर्म", label: "Uniform shop", labelHi: "यूनिफ़ॉर्म की दुकान" },
  ],
};

/** category -> part key -> the tick chips (exact English names from trade-questions.ts) of that part. */
export const TICKS_E: Record<string, Record<string, string[]>> = {
  textile: {
    saree: ["Sarees"],
    lehenga: ["Lehengas"],
    suits: ["Suits / dress material", "Fabric by metre"],
    boutique: ["Blouse stitching", "Fall-pico", "Designer work"],
    wholesale: ["Wholesale", "Fabric by metre"],
  },
  garments: {
    ladies: ["Women", "Ethnic / sarees", "Western"],
    mens: ["Men", "Western"],
    kids: ["Kids", "School uniforms"],
    ethnic: ["Women", "Ethnic / sarees"],
    boutique: ["Women", "Ethnic / sarees"],
    uniform: ["School uniforms"],
  },
};

const L = (en: string, hi: string, desc: string, descHi: string): TradeLine => ({ en, hi, desc, descHi });

/** key "category:part". */
export const SEEDS_E: Record<string, { explain: string[]; services: TradeLine[]; avoid: string[] }> = {
  // ---------------------------------------------------------------- textile
  "textile:saree": {
    explain: [
      "saree centre — silk, cotton, printed, party and bridal sarees to see and buy",
      "daily wear and occasion wear; a wedding and festive collection",
      "new arrivals shown on WhatsApp; matching blouse piece and fall-pico if offered",
      "visit the shop or ask for pictures in your colour and budget",
    ],
    services: [
      L("Silk sarees", "सिल्क साड़ियाँ", "Banarasi, Kanjivaram-style and other silk sarees for weddings and functions.", "शादी और फ़ंक्शन के लिए बनारसी और दूसरी सिल्क साड़ियाँ।"),
      L("Daily wear sarees", "रोज़ की साड़ियाँ", "Cotton, printed and light sarees that are easy to wear every day.", "रोज़ पहनने में आसान कॉटन, प्रिंटेड और हल्की साड़ियाँ।"),
      L("Party & designer sarees", "पार्टी और डिज़ाइनर साड़ियाँ", "Work sarees for parties, receptions and festivals.", "पार्टी, रिसेप्शन और त्योहार के लिए काम वाली साड़ियाँ।"),
      L("Bridal sarees", "ब्राइडल साड़ियाँ", "Heavy sarees for the bride and the close family.", "दुल्हन और क़रीबी परिवार के लिए भारी साड़ियाँ।"),
      L("Fall-pico & blouse piece", "फ़ॉल-पीको और ब्लाउज़ पीस", "Fall, pico and a matching blouse piece arranged with your saree.", "साड़ी के साथ फ़ॉल, पीको और मैचिंग ब्लाउज़ पीस का इंतज़ाम।"),
      L("New arrivals on WhatsApp", "WhatsApp पर नया माल", "Pictures of new sarees sent to your phone.", "नई साड़ियों की फ़ोटो आपके फ़ोन पर।"),
    ],
    avoid: ["wholesale", "bulk", "retailers", "by the metre", "unstitched"],
  },
  "textile:lehenga": {
    explain: [
      "lehenga and bridal wear — bridal lehengas, party lehengas, gowns and wedding outfits to see, try and buy",
      "for the bride and the family: wedding, engagement, sangeet, mehndi and reception",
      "trial at the shop; fitting set on the piece you choose",
      "visit the shop or ask for pictures of the collection on WhatsApp",
    ],
    services: [
      L("Bridal lehengas", "ब्राइडल लहंगे", "Wedding lehengas in heavy and light work, ready to try at the shop.", "भारी और हल्के काम के शादी के लहंगे, दुकान पर पहनकर देखें।"),
      L("Party & festive lehengas", "पार्टी और त्योहार के लहंगे", "Lehengas for sangeet, engagement, mehndi and family functions.", "संगीत, सगाई, मेहंदी और घर के फ़ंक्शन के लहंगे।"),
      L("Gowns & Indo-western", "गाउन और इंडो-वेस्टर्न", "Gowns and Indo-western outfits for receptions and parties.", "रिसेप्शन और पार्टी के लिए गाउन और इंडो-वेस्टर्न कपड़े।"),
      L("Wedding wear for the family", "परिवार के लिए शादी के कपड़े", "Outfits for the bride's sisters, mother and the close family.", "दुल्हन की बहनों, माँ और क़रीबी परिवार के कपड़े।"),
      L("Trial & fitting", "ट्रायल और फ़िटिंग", "Try the piece at the shop; the fitting is set on the one you choose.", "दुकान पर पहनकर देखें; चुने हुए कपड़े की फ़िटिंग ठीक की जाती है।"),
      L("Dupattas & matching pieces", "दुपट्टे और मैचिंग", "Dupattas, blouses and matching pieces to complete the look.", "लुक पूरा करने के लिए दुपट्टे, ब्लाउज़ और मैचिंग।"),
    ],
    avoid: ["wholesale", "bulk", "retailers", "by the metre", "unstitched"],
  },
  "textile:suits": {
    explain: [
      "suits and dress material — unstitched suits, dupattas, kurti fabric and cloth by the metre",
      "cotton, silk and synthetic; daily wear and occasion wear",
      "new designs shown on WhatsApp; stitching arranged if offered",
      "visit the shop or ask for pictures in your colour and budget",
    ],
    services: [
      L("Unstitched suits", "अनस्टिच्ड सूट", "Suit pieces with dupatta, in cotton, silk and party fabrics.", "दुपट्टे के साथ सूट पीस — कॉटन, सिल्क और पार्टी के कपड़ों में।"),
      L("Dress material", "ड्रेस मटीरियल", "Material for suits, kurtis and blouses in many prints and colours.", "सूट, कुर्ती और ब्लाउज़ का मटीरियल, कई प्रिंट और रंगों में।"),
      L("Fabric by the metre", "मीटर से कपड़ा", "Cloth cut to the length you need.", "जितना चाहिए उतना कपड़ा नाप कर।"),
      L("Dupattas & stoles", "दुपट्टे और स्टोल", "Plain, printed and work dupattas to match your suit.", "आपके सूट से मैच करते सादे, प्रिंटेड और काम वाले दुपट्टे।"),
      L("Party wear suits", "पार्टी वियर सूट", "Heavy work suits for weddings and festivals.", "शादी और त्योहार के लिए भारी काम वाले सूट।"),
      L("New designs on WhatsApp", "WhatsApp पर नए डिज़ाइन", "Pictures of new arrivals sent to your phone.", "नए माल की फ़ोटो आपके फ़ोन पर।"),
    ],
    avoid: ["wholesale", "bulk", "retailers", "bridal lehenga"],
  },
  "textile:boutique": {
    explain: [
      "boutique — designer blouses, suits and lehenga stitched to measure, with embroidery and handwork",
      "your idea or reference picture made into a design; fabric chosen with you",
      "fall-pico, blouse stitching and fitting for what you buy",
      "talk about the occasion and the design, then measurements and a trial",
    ],
    services: [
      L("Designer blouses", "डिज़ाइनर ब्लाउज़", "Back designs, sleeves and handwork made to your idea.", "आपके आइडिया के हिसाब से बैक डिज़ाइन, बाजू और हैंडवर्क।"),
      L("Suit & lehenga stitching", "सूट और लहंगा सिलाई", "Stitched to your measurement, with a trial before the final finish.", "आपके नाप से सिलाई, फ़ाइनल से पहले ट्रायल के साथ।"),
      L("Embroidery & handwork", "कढ़ाई और हैंडवर्क", "Zari, beads, sequins and thread work on your outfit.", "आपके कपड़ों पर ज़री, मोती, सितारे और धागे का काम।"),
      L("Fall, pico & finishing", "फ़ॉल, पीको और फ़िनिशिंग", "Saree fall, pico, lace and other finishing work.", "साड़ी की फ़ॉल, पीको, लेस और दूसरा फ़िनिशिंग का काम।"),
      L("Fitting & alteration", "फ़िटिंग और अल्टरेशन", "The fit set right on the outfit you buy or bring.", "ख़रीदे या लाए हुए कपड़े की फ़िटिंग ठीक।"),
      L("Custom designs", "कस्टम डिज़ाइन", "An outfit designed for your occasion from a picture or an idea.", "फ़ोटो या आइडिया से आपके मौक़े के लिए डिज़ाइन किया कपड़ा।"),
    ],
    avoid: ["wholesale", "bulk", "retailers"],
  },
  "textile:wholesale": {
    explain: [
      "textile wholesale / manufacturing — sarees, suits, dress material and fabric supplied to shops and boutiques",
      "catalogue and new designs on WhatsApp; bulk rates for retailers",
      "orders packed and sent by transport or courier across India",
      "ask for the catalogue, choose designs, confirm the quantity",
    ],
    services: [
      L("Wholesale to shops", "दुकानों को थोक", "Catalogue and bulk rates for retailers and boutiques.", "दुकानदारों और बुटीक के लिए कैटलॉग और थोक रेट।"),
      L("Sarees in bulk", "थोक में साड़ियाँ", "Sets and catalogues of sarees for shops.", "दुकानों के लिए साड़ियों के सेट और कैटलॉग।"),
      L("Suits & dress material in bulk", "थोक में सूट और ड्रेस मटीरियल", "Suit catalogues and dress material by the set.", "सूट के कैटलॉग और सेट में ड्रेस मटीरियल।"),
      L("Fabric by the than", "थान से कपड़ा", "Running fabric supplied by the roll.", "थान के हिसाब से कपड़ा।"),
      L("Catalogue on WhatsApp", "WhatsApp पर कैटलॉग", "New designs and stock sent to your phone.", "नए डिज़ाइन और स्टॉक आपके फ़ोन पर।"),
      L("Transport & courier across India", "पूरे भारत में ट्रांसपोर्ट और कूरियर", "Orders packed and sent to your shop.", "ऑर्डर पैक करके आपकी दुकान तक।"),
    ],
    avoid: ["trial", "fall-pico", "blouse stitching", "for the bride"],
  },

  // ---------------------------------------------------------------- garments
  "garments:ladies": {
    explain: [
      "ladies' wear — kurtis, suits, tops, jeans, dresses, nightwear and party wear",
      "daily, office and occasion wear in all sizes; trial at the shop",
      "new stock for festivals and the wedding season",
      "walk in, or ask for pictures of new arrivals on WhatsApp",
    ],
    services: [
      L("Kurtis & suits", "कुर्ती और सूट", "Readymade kurtis, suits and sets for daily and office wear.", "रोज़ और ऑफ़िस के लिए रेडीमेड कुर्ती, सूट और सेट।"),
      L("Western wear", "वेस्टर्न वियर", "Tops, jeans, dresses and co-ord sets.", "टॉप, जींस, ड्रेस और को-ऑर्ड सेट।"),
      L("Party wear", "पार्टी वियर", "Gowns, shararas and heavy suits for functions.", "फ़ंक्शन के लिए गाउन, शरारा और भारी सूट।"),
      L("Nightwear & daily basics", "नाइटवियर और रोज़ के कपड़े", "Comfortable night suits, leggings and daily basics.", "आरामदेह नाइट सूट, लेगिंग और रोज़ के कपड़े।"),
      L("Trial & easy exchange", "ट्रायल और आसान एक्सचेंज", "Try at the shop; exchange with the bill and tags intact.", "दुकान पर पहनकर देखें; बिल और टैग के साथ एक्सचेंज।"),
      L("New arrivals on WhatsApp", "WhatsApp पर नया माल", "Ask for photos of new stock and reserve your piece.", "नए माल की फ़ोटो मँगाएँ और अपना पीस रखवाएँ।"),
    ],
    avoid: ["uniform", "school", "sherwani", "men's", "gents"],
  },
  "garments:mens": {
    explain: [
      "men's wear — shirts, trousers, jeans, t-shirts, kurta-pyjama, suits and blazers",
      "daily, office and occasion wear in all sizes; trial at the shop",
      "wedding and festival range: kurtas, sherwani, Indo-western if offered",
      "walk in, or ask for pictures of new arrivals on WhatsApp",
    ],
    services: [
      L("Shirts & trousers", "शर्ट और पैंट", "Formal and casual shirts and trousers in all sizes.", "हर साइज़ में फ़ॉर्मल और कैज़ुअल शर्ट और पैंट।"),
      L("Jeans & t-shirts", "जींस और टी-शर्ट", "Everyday casual wear.", "रोज़ के कैज़ुअल कपड़े।"),
      L("Kurta-pyjama & ethnic", "कुर्ता-पायजामा और एथनिक", "Kurtas, Nehru jackets and festive wear.", "कुर्ते, नेहरू जैकेट और त्योहार के कपड़े।"),
      L("Suits & blazers", "सूट और ब्लेज़र", "Suits and blazers for the office and functions.", "ऑफ़िस और फ़ंक्शन के लिए सूट और ब्लेज़र।"),
      L("Alteration & fitting", "ऑल्टरेशन और फ़िटिंग", "Length and waist adjusted so it fits right.", "लंबाई और कमर ठीक, ताकि फ़िटिंग सही आए।"),
      L("Easy exchange", "आसान एक्सचेंज", "Wrong size or colour? Exchange with the bill and tags intact.", "साइज़ या रंग ग़लत? बिल और टैग के साथ एक्सचेंज।"),
    ],
    avoid: ["saree", "lehenga", "kurtis", "women's", "ladies", "uniform", "school"],
  },
  "garments:kids": {
    explain: [
      "kids' wear — clothes for babies, boys and girls: daily wear, party wear and winter wear",
      "soft fabrics and all sizes; birthday and festival outfits",
      "new stock for festivals and the school season",
      "walk in, or ask for pictures on WhatsApp",
    ],
    services: [
      L("Boys' wear", "लड़कों के कपड़े", "T-shirts, shirts, jeans, shorts and ethnic sets.", "टी-शर्ट, शर्ट, जींस, शॉर्ट्स और एथनिक सेट।"),
      L("Girls' wear", "लड़कियों के कपड़े", "Frocks, tops, leggings and lehenga-choli sets.", "फ़्रॉक, टॉप, लेगिंग और लहंगा-चोली सेट।"),
      L("Baby wear", "छोटे बच्चों के कपड़े", "Soft clothes and sets for newborns and toddlers.", "नवजात और छोटे बच्चों के लिए नरम कपड़े और सेट।"),
      L("Party & birthday wear", "पार्टी और बर्थडे के कपड़े", "Dressy outfits for birthdays, weddings and festivals.", "बर्थडे, शादी और त्योहार के लिए ख़ास कपड़े।"),
      L("Winter wear", "सर्दी के कपड़े", "Sweaters, jackets and thermals in season.", "सीज़न में स्वेटर, जैकेट और थर्मल।"),
      L("Easy exchange", "आसान एक्सचेंज", "Wrong size? Exchange with the bill and tags intact.", "साइज़ ग़लत? बिल और टैग के साथ एक्सचेंज।"),
    ],
    avoid: ["sherwani", "office wear", "blazers", "bridal"],
  },
  "garments:ethnic": {
    explain: [
      "lehenga, sarees and wedding wear — bridal and party lehengas, sarees, gowns, sherwani and outfits for the family",
      "for weddings, engagement, sangeet and festivals; trial at the shop",
      "fitting set on the piece you choose",
      "visit the shop or ask for pictures of the collection on WhatsApp",
    ],
    services: [
      L("Bridal lehengas", "ब्राइडल लहंगे", "Wedding lehengas in heavy and light work, ready to try at the shop.", "भारी और हल्के काम के शादी के लहंगे, दुकान पर पहनकर देखें।"),
      L("Sarees", "साड़ियाँ", "Silk, designer and party sarees for functions.", "फ़ंक्शन के लिए सिल्क, डिज़ाइनर और पार्टी साड़ियाँ।"),
      L("Party lehengas & gowns", "पार्टी लहंगे और गाउन", "Outfits for sangeet, engagement and reception.", "संगीत, सगाई और रिसेप्शन के कपड़े।"),
      L("Sherwani & groom wear", "शेरवानी और दूल्हे के कपड़े", "Sherwani, Indo-western and kurta sets for the groom and family.", "दूल्हे और परिवार के लिए शेरवानी, इंडो-वेस्टर्न और कुर्ता सेट।"),
      L("Trial & fitting", "ट्रायल और फ़िटिंग", "Try at the shop; the fitting is set on the piece you choose.", "दुकान पर पहनकर देखें; चुने हुए कपड़े की फ़िटिंग ठीक की जाती है।"),
      L("Collection on WhatsApp", "WhatsApp पर कलेक्शन", "Ask for pictures in your colour and budget.", "अपने रंग और बजट की फ़ोटो मँगाएँ।"),
    ],
    avoid: ["uniform", "school", "office wear", "jeans"],
  },
  "garments:boutique": {
    explain: [
      "boutique — designer blouses, suits and lehenga stitched to measure, with embroidery and handwork",
      "your idea or reference picture made into a design; fabric chosen with you",
      "a small ready collection to see and try, if offered",
      "talk about the occasion and the design, then measurements and a trial",
    ],
    services: [
      L("Designer blouses", "डिज़ाइनर ब्लाउज़", "Back designs, sleeves and handwork made to your idea.", "आपके आइडिया के हिसाब से बैक डिज़ाइन, बाजू और हैंडवर्क।"),
      L("Suit & lehenga stitching", "सूट और लहंगा सिलाई", "Stitched to your measurement, with a trial before the final finish.", "आपके नाप से सिलाई, फ़ाइनल से पहले ट्रायल के साथ।"),
      L("Embroidery & handwork", "कढ़ाई और हैंडवर्क", "Zari, beads, sequins and thread work on your outfit.", "आपके कपड़ों पर ज़री, मोती, सितारे और धागे का काम।"),
      L("Custom designs", "कस्टम डिज़ाइन", "An outfit designed for your occasion from a picture or an idea.", "फ़ोटो या आइडिया से आपके मौक़े के लिए डिज़ाइन किया कपड़ा।"),
      L("Fitting & alteration", "फ़िटिंग और अल्टरेशन", "The fit set right on the outfit you buy or bring.", "ख़रीदे या लाए हुए कपड़े की फ़िटिंग ठीक।"),
      L("Ready designer pieces", "तैयार डिज़ाइनर कपड़े", "A small collection to see and try in the shop.", "दुकान में देखने और पहनकर देखने के लिए छोटा कलेक्शन।"),
    ],
    avoid: ["uniform", "school", "office wear", "jeans", "men's"],
  },
  "garments:uniform": {
    explain: [
      "uniform shop — school uniforms, and office, shop and staff uniforms",
      "all sizes in stock; bulk orders for schools and companies",
      "ties, belts, socks and other uniform items if offered",
      "walk in with the school name, or send the requirement on WhatsApp",
    ],
    services: [
      L("School uniforms", "स्कूल यूनिफ़ॉर्म", "Uniforms of local schools in all sizes.", "आस-पास के स्कूलों की यूनिफ़ॉर्म, हर साइज़ में।"),
      L("Office & staff uniforms", "ऑफ़िस और स्टाफ़ यूनिफ़ॉर्म", "Uniforms for offices, shops, hotels and hospitals.", "ऑफ़िस, दुकान, होटल और अस्पताल की यूनिफ़ॉर्म।"),
      L("Bulk orders", "बड़े ऑर्डर", "Orders for a whole school or company, made to the sizes given.", "पूरे स्कूल या कंपनी के ऑर्डर, दिए गए साइज़ के हिसाब से।"),
      L("Ties, belts & socks", "टाई, बेल्ट और मोज़े", "The small uniform items in one place.", "यूनिफ़ॉर्म का छोटा सामान एक ही जगह।"),
      L("Winter uniform", "सर्दी की यूनिफ़ॉर्म", "Sweaters, blazers and track suits in season.", "सीज़न में स्वेटर, ब्लेज़र और ट्रैक सूट।"),
      L("Alteration & fitting", "ऑल्टरेशन और फ़िटिंग", "Length and waist adjusted so it fits right.", "लंबाई और कमर ठीक, ताकि फ़िटिंग सही आए।"),
    ],
    avoid: ["saree", "lehenga", "bridal", "wedding", "sherwani", "festival collection"],
  },
};
