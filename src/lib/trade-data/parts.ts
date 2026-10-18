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
