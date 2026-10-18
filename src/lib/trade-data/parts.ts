// The seeds of ONE part of a combined category (see lib/trade-parts.ts), keyed "category:part". Same rules as types.ts: plain Indian
// English, natural Hindi, no numbers, no prices, no guarantees. Used when the owner ticks only that part.
import type { TradeData } from "./types";

export const PART_DATA: Record<string, TradeData> = {
  "cleaning:pest": {
    explain: [
      "pest control — cockroach, ant, termite, bed bug, mosquito, rodent",
      "homes, offices, shops, restaurants and godowns; AMC for regular service",
      "approved chemicals used carefully, team trained, place left clean",
      "inspection first, then a quote and the visit at your time",
    ],
    services: [
      { en: "Cockroach & ant control", hi: "कॉकरोच और चींटी नियंत्रण", desc: "Gel and spray treatment for the kitchen and the whole house.", descHi: "किचन और पूरे घर के लिए जेल और स्प्रे ट्रीटमेंट।" },
      { en: "Termite treatment", hi: "दीमक का इलाज", desc: "Treatment of an existing building, with a follow-up visit.", descHi: "बने हुए घर या दुकान का ट्रीटमेंट, साथ में दोबारा विज़िट।" },
      { en: "Pre-construction anti-termite", hi: "निर्माण से पहले दीमक-रोधी", desc: "Soil and foundation treatment before the floor is laid.", descHi: "फ़र्श डालने से पहले मिट्टी और नींव का ट्रीटमेंट।" },
      { en: "Bed bug control", hi: "खटमल नियंत्रण", desc: "Treatment of beds, sofas and rooms.", descHi: "बिस्तर, सोफ़ा और कमरों का ट्रीटमेंट।" },
      { en: "Mosquito & fly control", hi: "मच्छर और मक्खी नियंत्रण", desc: "Fogging and spraying for homes, gardens and shops.", descHi: "घर, बगीचे और दुकान के लिए फ़ॉगिंग और स्प्रे।" },
      { en: "Rodent control", hi: "चूहा नियंत्रण", desc: "Baiting and sealing of entry points for homes and godowns.", descHi: "घर और गोदाम के लिए बेटिंग और चूहों के रास्ते बंद करना।" },
      { en: "Pest control contracts (AMC)", hi: "पेस्ट कंट्रोल कॉन्ट्रैक्ट (AMC)", desc: "Regular visits for offices, restaurants and godowns on a yearly plan.", descHi: "ऑफ़िस, रेस्टोरेंट और गोदाम के लिए सालाना प्लान में नियमित विज़िट।" },
    ],
    whyUs: [
      { en: "Approved chemicals, used carefully", hi: "मान्य केमिकल, सावधानी से" },
      { en: "Trained team in uniform", hi: "वर्दी में प्रशिक्षित टीम" },
      { en: "Inspection before treatment", hi: "ट्रीटमेंट से पहले जाँच" },
      { en: "Visit at your time", hi: "आपके समय पर विज़िट" },
      { en: "Follow-up visit if needed", hi: "ज़रूरत हो तो दोबारा विज़िट" },
      { en: "Home and office both", hi: "घर और ऑफ़िस दोनों" },
      { en: "Book on WhatsApp", hi: "WhatsApp पर बुकिंग" },
    ],
    steps: [
      { en: "Message the problem", hi: "समस्या मैसेज करें", desc: "Which pest, the size of the place and your area.", descHi: "कौन सा कीड़ा, जगह का साइज़ और आपका इलाक़ा।" },
      { en: "Inspection and quote", hi: "जाँच और कोटेशन", desc: "We check or ask a few questions and tell you the charge.", descHi: "हम देखते हैं या कुछ सवाल पूछकर चार्ज बताते हैं।" },
      { en: "Treatment", hi: "ट्रीटमेंट", desc: "The team comes at the fixed time and does the treatment.", descHi: "तय समय पर टीम आती है और ट्रीटमेंट करती है।" },
      { en: "Follow-up", hi: "फ़ॉलो-अप", desc: "Instructions for after the treatment; a revisit if required.", descHi: "ट्रीटमेंट के बाद के निर्देश; ज़रूरत हो तो दोबारा विज़िट।" },
    ],
    faq: [
      { q: "Is the treatment safe for children and pets?", qHi: "बच्चों और पालतू जानवरों के लिए सुरक्षित है?", a: "We use approved products and tell you the precautions, like keeping food covered and the room closed for a while.", aHi: "हम मान्य प्रोडक्ट इस्तेमाल करते हैं और सावधानियाँ बताते हैं, जैसे खाना ढककर रखना और कुछ देर कमरा बंद रखना।" },
      { q: "Do I need to leave the house?", qHi: "घर छोड़ना पड़ेगा?", a: "For most treatments, no; for some, a short time away is advised. We tell you in advance.", aHi: "ज़्यादातर ट्रीटमेंट में नहीं; कुछ में थोड़ी देर बाहर रहने को कहा जाता है। हम पहले बता देते हैं।" },
      { q: "How long does the effect last?", qHi: "असर कितने दिन रहता है?", a: "It depends on the pest and the place; we explain this and suggest a service schedule.", aHi: "कीड़े और जगह पर निर्भर है; हम समझाते हैं और सर्विस का शेड्यूल बताते हैं।" },
      { q: "Do you do termite treatment for a new house?", qHi: "नए घर में दीमक का ट्रीटमेंट करते हैं?", a: "Yes, before construction and for an existing building; message us the stage.", aHi: "हाँ, निर्माण से पहले भी और बने हुए घर में भी; काम किस स्टेज पर है, मैसेज करें।" },
      { q: "Is AMC available for offices and restaurants?", qHi: "ऑफ़िस और रेस्टोरेंट के लिए AMC है?", a: "Yes, regular visits on a yearly contract; ask us for a plan.", aHi: "हाँ, सालाना कॉन्ट्रैक्ट में नियमित विज़िट; प्लान के लिए पूछें।" },
      { q: "Which areas do you cover?", qHi: "किन इलाक़ों में आते हैं?", a: "The city and nearby areas; send your location on WhatsApp and we confirm the visit.", aHi: "शहर और आसपास के इलाक़े; WhatsApp पर लोकेशन भेजें, हम विज़िट पक्की करेंगे।" },
      { q: "How do I pay?", qHi: "भुगतान कैसे करें?", a: "Cash or UPI after the treatment; monthly invoice for AMC.", aHi: "ट्रीटमेंट के बाद नक़द या UPI; AMC में महीने का बिल।" },
    ],
    generic: ["connect with us", "explore options", "pest free home", "trusted name", "quality service", "customer satisfaction"],
  },

  "cleaning:cleaning": {
    explain: [
      "cleaning — home deep cleaning, kitchen and bathroom, sofa, carpet, mattress, water tank",
      "homes, offices, shops and restaurants; regular cleaning on a monthly plan",
      "trained team with proper machines and safe products, place left spotless",
      "a few questions or a look first, then a quote and the visit at your time",
    ],
    services: [
      { en: "Home deep cleaning", hi: "घर की डीप क्लीनिंग", desc: "Kitchen, bathrooms, floors, windows and fans, top to bottom.", descHi: "किचन, बाथरूम, फ़र्श, खिड़कियाँ और पंखे, ऊपर से नीचे तक।" },
      { en: "Kitchen & bathroom cleaning", hi: "किचन और बाथरूम की सफ़ाई", desc: "Grease, stains and hard-water marks removed.", descHi: "चिकनाई, दाग और कठोर पानी के निशान साफ़।" },
      { en: "Sofa, carpet & mattress", hi: "सोफ़ा, कालीन और गद्दा", desc: "Shampoo and vacuum cleaning at your home.", descHi: "आपके घर पर शैम्पू और वैक्यूम सफ़ाई।" },
      { en: "Water tank cleaning", hi: "पानी की टंकी की सफ़ाई", desc: "Overhead and underground tanks cleaned and disinfected.", descHi: "छत और ज़मीन की टंकी की सफ़ाई और सैनिटाइज़ेशन।" },
      { en: "Office & shop cleaning", hi: "ऑफ़िस और दुकान की सफ़ाई", desc: "One-time or regular cleaning of offices, shops and showrooms.", descHi: "ऑफ़िस, दुकान और शोरूम की एक बार या नियमित सफ़ाई।" },
      { en: "Move-in & move-out cleaning", hi: "शिफ़्टिंग से पहले-बाद की सफ़ाई", desc: "A fresh start for a new home or a clean handover of the old one.", descHi: "नए घर के लिए नई शुरुआत, पुराने घर की साफ़-सुथरी हैंडओवर।" },
      { en: "After-construction cleaning", hi: "निर्माण के बाद की सफ़ाई", desc: "Dust, paint and cement marks cleared from a new or renovated place.", descHi: "नए या रिनोवेट हुए घर से धूल, पेंट और सीमेंट के निशान साफ़।" },
    ],
    whyUs: [
      { en: "Trained team with proper machines", hi: "प्रशिक्षित टीम, सही मशीनें" },
      { en: "Safe, approved cleaning products", hi: "सुरक्षित, मान्य क्लीनिंग प्रोडक्ट" },
      { en: "Visit at your time", hi: "आपके समय पर विज़िट" },
      { en: "Place left spotless", hi: "जगह साफ़-सुथरी छोड़ते हैं" },
      { en: "Home and office both", hi: "घर और ऑफ़िस दोनों" },
      { en: "Regular plans available", hi: "नियमित प्लान उपलब्ध" },
      { en: "Book on WhatsApp", hi: "WhatsApp पर बुकिंग" },
    ],
    steps: [
      { en: "Message the need", hi: "ज़रूरत मैसेज करें", desc: "What needs cleaning, the size of the place and your area.", descHi: "क्या साफ़ कराना है, जगह का साइज़ और आपका इलाक़ा।" },
      { en: "Look and quote", hi: "जाँच और कोटेशन", desc: "We check or ask a few questions and tell you the charge.", descHi: "हम देखते हैं या कुछ सवाल पूछकर चार्ज बताते हैं।" },
      { en: "Cleaning", hi: "सफ़ाई", desc: "The team comes at the fixed time with its own machines and products.", descHi: "तय समय पर टीम अपनी मशीनों और प्रोडक्ट के साथ आती है।" },
      { en: "Check and feedback", hi: "जाँच और फ़ीडबैक", desc: "You look it over; anything missed is cleaned again.", descHi: "आप देख लें; कुछ छूटा हो तो दोबारा साफ़ करते हैं।" },
    ],
    faq: [
      { q: "Do you bring your own machines and products?", qHi: "मशीनें और प्रोडक्ट आप लाते हैं?", a: "Yes, the team brings everything; you only need to give water and power access.", aHi: "हाँ, टीम सब कुछ साथ लाती है; आपको सिर्फ़ पानी और बिजली देनी होती है।" },
      { q: "Is it safe for floors and furniture?", qHi: "फ़र्श और फ़र्नीचर के लिए सुरक्षित है?", a: "We choose the product to suit the surface and tell you if something should not be cleaned a certain way.", aHi: "हम सतह के हिसाब से प्रोडक्ट चुनते हैं और कुछ ठीक न हो तो पहले बता देते हैं।" },
      { q: "How long does a deep cleaning take?", qHi: "डीप क्लीनिंग में कितना समय लगता है?", a: "It depends on the size of the home; we tell you the time when we give the quote.", aHi: "घर के साइज़ पर निर्भर है; कोटेशन के साथ समय भी बताते हैं।" },
      { q: "Do I need to be at home?", qHi: "क्या घर पर रहना ज़रूरी है?", a: "It helps at the start and at the end; in between the team can work on its own.", aHi: "शुरू और आख़िर में रहना अच्छा रहता है; बीच में टीम अपने आप काम कर लेती है।" },
      { q: "Are regular plans available?", qHi: "नियमित प्लान मिलते हैं?", a: "Yes, weekly or monthly cleaning for homes, offices and shops; ask us for a plan.", aHi: "हाँ, घर, ऑफ़िस और दुकान के लिए साप्ताहिक या मासिक सफ़ाई; प्लान के लिए पूछें।" },
      { q: "Which areas do you cover?", qHi: "किन इलाक़ों में आते हैं?", a: "The city and nearby areas; send your location on WhatsApp and we confirm the visit.", aHi: "शहर और आसपास के इलाक़े; WhatsApp पर लोकेशन भेजें, हम विज़िट पक्की करेंगे।" },
      { q: "How do I pay?", qHi: "भुगतान कैसे करें?", a: "Cash or UPI after the cleaning; monthly invoice for regular plans.", aHi: "सफ़ाई के बाद नक़द या UPI; नियमित प्लान में महीने का बिल।" },
    ],
    generic: ["connect with us", "explore options", "spotless homes", "trusted name", "quality service", "customer satisfaction"],
  },
  "cleanprod:make": {
    explain: [
      "the range the factory makes — floor and surface cleaners, phenyl and disinfectant, toilet cleaner, detergent, dishwash, hand wash, sanitiser",
      "made to a fixed formula, each batch checked before it is packed",
      "retail bottles, bulk cans and drums; private label and custom packing as told",
      "supply to dealers, shops, hotels, offices and institutions; orders on WhatsApp",
    ],
    services: [
      { en: "Our own brand range", hi: "हमारी अपनी ब्रांड रेंज", desc: "Floor, toilet, dishwash and hand wash products made in our own plant.", descHi: "फ़र्श, टॉयलेट, डिशवॉश और हैंड वॉश प्रोडक्ट, हमारे अपने प्लांट में बने।" },
      { en: "Phenyl & disinfectants", hi: "फिनायल और डिसइंफ़ेक्टेंट", desc: "Phenyl and disinfectant liquids made in bulk for dealers and institutions.", descHi: "डीलर और संस्थाओं के लिए बड़ी मात्रा में बना फिनायल और डिसइंफ़ेक्टेंट।" },
      { en: "Detergent powder & liquid", hi: "डिटर्जेंट पाउडर और लिक्विड", desc: "Washing powder and liquid made in retail and bulk packs.", descHi: "रिटेल और बल्क पैक में बना वॉशिंग पाउडर और लिक्विड।" },
      { en: "Private label & custom packing", hi: "प्राइवेट लेबल और ख़ास पैकिंग", desc: "Your brand name and your pack, made to your formula or ours.", descHi: "आपका ब्रांड नाम और आपका पैक, आपके या हमारे फ़ॉर्मूले से।" },
      { en: "Custom fragrance & strength", hi: "ख़ास ख़ुशबू और स्ट्रेंथ", desc: "Fragrance and strength set to what your buyers like.", descHi: "आपके ग्राहकों को जो पसंद हो, वैसी ख़ुशबू और स्ट्रेंथ।" },
      { en: "Bulk cans & drums", hi: "बल्क कैन और ड्रम", desc: "Large packs for hotels, hospitals, schools and housekeeping companies.", descHi: "होटल, अस्पताल, स्कूल और हाउसकीपिंग कंपनियों के लिए बड़े पैक।" },
      { en: "Dealer & distributor supply", hi: "डीलर और डिस्ट्रीब्यूटर सप्लाई", desc: "Regular stock to shops and dealers at factory rates.", descHi: "दुकानों और डीलरों को फ़ैक्टरी रेट पर नियमित स्टॉक।" },
      { en: "Sample batches", hi: "सैंपल बैच", desc: "A sample of any product before you place a bulk order.", descHi: "बल्क ऑर्डर से पहले किसी भी प्रोडक्ट का सैंपल।" },
    ],
    whyUs: [
      { en: "Made to a fixed formula", hi: "तय फ़ॉर्मूले से बना" },
      { en: "Each batch checked", hi: "हर बैच की जाँच" },
      { en: "Factory rates", hi: "फ़ैक्टरी रेट" },
      { en: "Private label possible", hi: "प्राइवेट लेबल संभव" },
      { en: "Retail to bulk packs", hi: "रिटेल से बल्क पैक तक" },
      { en: "Samples on request", hi: "माँगने पर सैंपल" },
      { en: "GST bill, quick dispatch", hi: "GST बिल, जल्दी डिस्पैच" },
    ],
    steps: [
      { en: "Share your need", hi: "ज़रूरत बताएँ", desc: "Which products, how much, in which pack and where it has to go.", descHi: "कौन से प्रोडक्ट, कितना, किस पैक में और कहाँ भेजना है।" },
      { en: "Rates and sample", hi: "रेट और सैंपल", desc: "We send factory rates, and a sample batch if you want to check first.", descHi: "हम फ़ैक्टरी रेट भेजते हैं, और पहले जाँचना हो तो सैंपल बैच भी।" },
      { en: "Production and packing", hi: "तैयारी और पैकिंग", desc: "Made to the agreed formula and packed in your chosen pack.", descHi: "तय फ़ॉर्मूले से बनता है और आपके चुने पैक में पैक होता है।" },
      { en: "Dispatch", hi: "डिस्पैच", desc: "Sent by transport or courier with the GST bill.", descHi: "GST बिल के साथ ट्रांसपोर्ट या कूरियर से भेजा जाता है।" },
    ],
    faq: [
      { q: "Do you make the products yourselves?", qHi: "क्या प्रोडक्ट आप ख़ुद बनाते हैं?", a: "Yes, we make them in our own plant, to a fixed formula, and check each batch before packing.", aHi: "हाँ, हम अपने प्लांट में तय फ़ॉर्मूले से बनाते हैं और पैकिंग से पहले हर बैच जाँचते हैं।" },
      { q: "Can you make under my own brand?", qHi: "क्या मेरे अपने ब्रांड से बना सकते हैं?", a: "Yes, private label and custom packing; message us the product and the pack you want.", aHi: "हाँ, प्राइवेट लेबल और ख़ास पैकिंग; प्रोडक्ट और पैक बताकर मैसेज करें।" },
      { q: "Do you give samples?", qHi: "सैंपल मिलता है?", a: "Yes, a sample batch on request, so you can check before a bulk order.", aHi: "हाँ, माँगने पर सैंपल बैच; बल्क ऑर्डर से पहले जाँच सकते हैं।" },
      { q: "What is the smallest order?", qHi: "सबसे छोटा ऑर्डर कितना?", a: "It depends on the product and pack; tell us what you need and we confirm.", aHi: "प्रोडक्ट और पैक पर निर्भर है; क्या चाहिए बताएँ, हम बता देंगे।" },
      { q: "Can the fragrance or strength be changed?", qHi: "क्या ख़ुशबू या स्ट्रेंथ बदल सकते हैं?", a: "Yes, for orders of a fair size; we agree it with you first.", aHi: "हाँ, ठीक-ठाक मात्रा के ऑर्डर में; पहले आपसे तय करते हैं।" },
      { q: "Is a GST bill given?", qHi: "GST बिल मिलता है?", a: "Yes, a proper GST bill with every order.", aHi: "हाँ, हर ऑर्डर के साथ पक्का GST बिल।" },
      { q: "How is the order sent?", qHi: "ऑर्डर कैसे भेजते हैं?", a: "By transport or courier to your place; nearby we can deliver ourselves.", aHi: "ट्रांसपोर्ट या कूरियर से आपके यहाँ; पास में हम ख़ुद भी पहुँचा सकते हैं।" },
    ],
    generic: ["connect with us", "explore options", "clean and fresh", "trusted name", "quality products", "customer satisfaction"],
  },

  "cleanprod:supply": {
    explain: [
      "the brands and products stocked — floor and surface cleaners, phenyl and disinfectant, toilet cleaner, detergent, dishwash, hand wash, sanitiser, cleaning tools",
      "who is supplied — shops, hotels and restaurants, offices, schools, hospitals and housekeeping companies",
      "retail packs and bulk cans; regular supply and schemes as told",
      "orders on WhatsApp, a GST bill and delivery as told",
    ],
    services: [
      { en: "Floor & surface cleaners", hi: "फ़र्श और सतह क्लीनर", desc: "Floor, tile and glass cleaners from trusted brands, in stock.", descHi: "जाने-माने ब्रांड के फ़र्श, टाइल और काँच के क्लीनर, स्टॉक में।" },
      { en: "Phenyl & disinfectants", hi: "फिनायल और डिसइंफ़ेक्टेंट", desc: "Phenyl and disinfectants for homes, shops and institutions.", descHi: "घर, दुकान और संस्थाओं के लिए फिनायल और डिसइंफ़ेक्टेंट।" },
      { en: "Toilet & bathroom cleaners", hi: "टॉयलेट और बाथरूम क्लीनर", desc: "Toilet and bathroom cleaners in all the usual brands and packs.", descHi: "सभी जाने-माने ब्रांड और पैक में टॉयलेट और बाथरूम क्लीनर।" },
      { en: "Detergent, dishwash & hand wash", hi: "डिटर्जेंट, डिशवॉश और हैंड वॉश", desc: "Everyday washing and hand-care products, retail and bulk.", descHi: "रोज़ के धोने और हाथ की सफ़ाई के प्रोडक्ट, रिटेल और बल्क।" },
      { en: "Mops, brooms & tools", hi: "पोंछा, झाड़ू और टूल", desc: "Mops, brooms, wipers and buckets for homes and housekeeping.", descHi: "घर और हाउसकीपिंग के लिए पोंछा, झाड़ू, वाइपर और बाल्टी।" },
      { en: "Bulk & institutional packs", hi: "बल्क और इंस्टीट्यूशनल पैक", desc: "Large cans for hotels, hospitals, schools and offices.", descHi: "होटल, अस्पताल, स्कूल और ऑफ़िस के लिए बड़े कैन।" },
      { en: "Supply to shops & dealers", hi: "दुकानों और डीलरों को सप्लाई", desc: "Regular stock and schemes for kirana, general and departmental stores.", descHi: "किराना, जनरल और डिपार्टमेंटल स्टोर को नियमित स्टॉक और स्कीम।" },
      { en: "Housekeeping supply", hi: "हाउसकीपिंग सप्लाई", desc: "Everything a housekeeping team needs, on a regular schedule.", descHi: "हाउसकीपिंग टीम को जो भी चाहिए, तय शेड्यूल पर।" },
    ],
    whyUs: [
      { en: "Trusted brands in stock", hi: "जाने-माने ब्रांड स्टॉक में" },
      { en: "Retail and bulk packs", hi: "रिटेल और बल्क पैक" },
      { en: "Clear rates, GST bill", hi: "साफ़ रेट, GST बिल" },
      { en: "Regular supply, schemes", hi: "नियमित सप्लाई, स्कीम" },
      { en: "Quick delivery", hi: "जल्दी डिलीवरी" },
      { en: "Samples on request", hi: "माँगने पर सैंपल" },
      { en: "Order on WhatsApp", hi: "WhatsApp पर ऑर्डर" },
    ],
    steps: [
      { en: "Send your list", hi: "अपनी लिस्ट भेजें", desc: "The products and quantity you need, and where to send them.", descHi: "कौन से प्रोडक्ट और कितना, और कहाँ भेजना है।" },
      { en: "Rates", hi: "रेट", desc: "We send the rates and any scheme running.", descHi: "हम रेट और चल रही स्कीम भेजते हैं।" },
      { en: "Order and payment", hi: "ऑर्डर और भुगतान", desc: "Confirm on WhatsApp and pay as agreed.", descHi: "WhatsApp पर पक्का करें और तय तरीक़े से भुगतान करें।" },
      { en: "Delivery", hi: "डिलीवरी", desc: "Delivered to your shop or site with the GST bill.", descHi: "आपकी दुकान या साइट पर GST बिल के साथ पहुँचाया जाता है।" },
    ],
    faq: [
      { q: "Which brands do you stock?", qHi: "कौन से ब्रांड रखते हैं?", a: "The usual trusted brands in each product; ask us on WhatsApp for what you need.", aHi: "हर प्रोडक्ट में जाने-माने ब्रांड; जो चाहिए, WhatsApp पर पूछें।" },
      { q: "Do you supply shops and dealers?", qHi: "दुकानों और डीलरों को सप्लाई करते हैं?", a: "Yes, regular stock to kirana, general and departmental stores, with schemes when running.", aHi: "हाँ, किराना, जनरल और डिपार्टमेंटल स्टोर को नियमित स्टॉक, स्कीम चलने पर उसके साथ।" },
      { q: "Do you supply hotels and institutions?", qHi: "होटल और संस्थाओं को सप्लाई करते हैं?", a: "Yes, regular supply to hotels, restaurants, offices, schools and hospitals.", aHi: "हाँ, होटल, रेस्टोरेंट, ऑफ़िस, स्कूल और अस्पताल को नियमित सप्लाई।" },
      { q: "Are bulk packs available?", qHi: "बल्क पैक मिलते हैं?", a: "Yes, large cans as well as retail packs; send the quantity for a rate.", aHi: "हाँ, बड़े कैन भी और रिटेल पैक भी; भाव के लिए मात्रा भेजें।" },
      { q: "Is a GST bill given?", qHi: "GST बिल मिलता है?", a: "Yes, a proper GST bill with every order.", aHi: "हाँ, हर ऑर्डर के साथ पक्का GST बिल।" },
      { q: "Do you deliver?", qHi: "डिलीवरी करते हैं?", a: "Yes, nearby delivery; for other places by transport or courier.", aHi: "हाँ, आस-पास डिलीवरी; दूसरी जगह ट्रांसपोर्ट या कूरियर से।" },
      { q: "How do I pay?", qHi: "भुगतान कैसे करें?", a: "UPI, bank transfer or cash as agreed; terms for regular buyers on request.", aHi: "UPI, बैंक ट्रांसफ़र या तय तरीक़े से नक़द; नियमित ख़रीदारों के लिए शर्तें माँगने पर।" },
    ],
    generic: ["connect with us", "explore options", "clean and fresh", "trusted name", "quality products", "customer satisfaction"],
  },
};

/** The seeds for the owner's chosen parts of a category: one part → its data; several (not all) → the parts joined. */
export function partData(categoryKey: string, partKeys: string[]): TradeData | null {
  const got = partKeys.map((k) => PART_DATA[`${categoryKey}:${k}`]).filter((d): d is TradeData => !!d);
  if (!got.length) return null;
  if (got.length === 1) return got[0];
  const uniq = <T,>(xs: T[], key: (x: T) => string, max: number) => { const seen = new Set<string>(); return xs.filter((x) => { const k = key(x).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, max); };
  return {
    explain: uniq(got.flatMap((d) => d.explain), (s) => s, 4),
    services: uniq(got.flatMap((d) => d.services), (s) => s.en, 8),
    whyUs: uniq(got.flatMap((d) => d.whyUs), (s) => s.en, 8),
    steps: got[0].steps,
    faq: uniq(got.flatMap((d) => d.faq), (s) => s.q, 8),
    generic: got[0].generic,
  };
}
