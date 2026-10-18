// Parts data, batch C: ayurveda, finance, interior, auto, printing (see lib/trade-parts.ts and trade-data/parts.ts for the mechanism).
// Same rules as types.ts: plain Indian English, natural Hindi, no numbers, no prices, no guarantees, no cure / return / approval claims.
import type { TradeLine } from "./types";
import type { TradePart } from "@/lib/trade-parts";

export const PARTS_C: Record<string, TradePart[]> = {
  ayurveda: [
    { key: "ayurveda", en: "Ayurveda", hi: "आयुर्वेद", label: "Ayurveda clinic", labelHi: "आयुर्वेद क्लिनिक" },
    { key: "homeopathy", en: "Homeopathy", hi: "होम्योपैथी", label: "Homeopathy clinic", labelHi: "होम्योपैथी क्लिनिक" },
  ],
  finance: [
    { key: "loans", en: "Loans", hi: "लोन", label: "Loan advisor", labelHi: "लोन सलाहकार" },
    { key: "invest", en: "Mutual funds & investments", hi: "म्यूचुअल फ़ंड और निवेश", label: "Investment advisor", labelHi: "निवेश सलाहकार" },
  ],
  interior: [
    { key: "interior", en: "Interior design", hi: "इंटीरियर डिज़ाइन", label: "Interior designer", labelHi: "इंटीरियर डिज़ाइनर" },
    { key: "architect", en: "Architecture & planning", hi: "आर्किटेक्चर और प्लानिंग", label: "Architect", labelHi: "आर्किटेक्ट" },
  ],
  auto: [
    { key: "garage", en: "Garage & service", hi: "गैराज और सर्विस", label: "Garage", labelHi: "गैराज" },
    { key: "showroom", en: "Showroom & sales", hi: "शोरूम और बिक्री", label: "Vehicle showroom", labelHi: "वाहन शोरूम" },
  ],
  printing: [
    { key: "printing", en: "Printing", hi: "प्रिंटिंग", label: "Printing press", labelHi: "प्रिंटिंग प्रेस" },
    { key: "design", en: "Graphic design", hi: "ग्राफ़िक डिज़ाइन", label: "Design studio", labelHi: "डिज़ाइन स्टूडियो" },
  ],
};

/** category -> part key -> the English names of the "what you do / offer / sell" tick chips that belong to that part. */
export const TICKS_C: Record<string, Record<string, string[]>> = {
  ayurveda: {
    ayurveda: ["Ayurveda", "Unani", "Naturopathy", "Panchakarma"],
    homeopathy: ["Homeopathy"],
  },
  finance: {
    loans: ["Home loan", "Personal loan", "Business loan", "Vehicle loan", "Gold loan", "Credit cards"],
    invest: ["Mutual funds"],
  },
  interior: {
    interior: ["Home interiors", "Modular kitchen", "Office interiors", "False ceiling", "Vastu", "3D design"],
    architect: ["Architecture / plans", "Vastu", "3D design"],
  },
  auto: {
    garage: ["Car garage", "Bike garage", "Spare parts", "Tyres / battery", "Car wash / detailing", "Denting-painting"],
    showroom: ["Showroom", "Spare parts"],
  },
  printing: {
    printing: ["Flex / banners", "Visiting cards", "Wedding cards", "Offset printing", "T-shirt / mug printing", "Stickers / labels", "Books / bill books"],
    design: ["Design", "Flex / banners", "Visiting cards", "Wedding cards", "Stickers / labels"],
  },
};

export const SEEDS_C: Record<string, { explain: string[]; services: TradeLine[]; avoid: string[] }> = {
  "ayurveda:ayurveda": {
    explain: [
      "Ayurveda — understanding the person's constitution first, then medicine, diet and daily routine together",
      "the problems people commonly come for (digestion, skin, joints, stress, lifestyle) without any promise of cure",
      "classical and prepared medicines, panchakarma and therapies as advised by the vaidya",
      "consultation timings, appointment on WhatsApp, follow-up for outstation patients",
    ],
    services: [
      { en: "Consultation", hi: "परामर्श", desc: "Detailed history and examination before any medicine is given.", descHi: "दवा देने से पहले पूरी बात और जाँच।" },
      { en: "Diet & daily routine advice", hi: "आहार और दिनचर्या की सलाह", desc: "What to eat, what to avoid and a routine that suits your constitution.", descHi: "क्या खाएँ, क्या नहीं, और आपकी प्रकृति के हिसाब से दिनचर्या।" },
      { en: "Ayurvedic medicines", hi: "आयुर्वेदिक दवाइयाँ", desc: "Classical and prepared medicines dispensed at the clinic.", descHi: "क्लासिकल और तैयार दवाइयाँ क्लिनिक पर ही।" },
      { en: "Panchakarma & therapies", hi: "पंचकर्म और थेरेपी", desc: "Oil massage, steam and detox therapies as advised by the vaidya.", descHi: "वैद्य की सलाह पर तेल मालिश, भाप और डिटॉक्स थेरेपी।" },
      { en: "Long-standing & lifestyle problems", hi: "पुरानी और लाइफ़स्टाइल समस्याएँ", desc: "Long-standing complaints looked after with medicine, diet and routine together.", descHi: "पुरानी तकलीफ़ों में दवा, आहार और दिनचर्या साथ-साथ।" },
      { en: "Children & elderly care", hi: "बच्चों और बुज़ुर्गों की देखभाल", desc: "Gentle treatment suited to age and constitution.", descHi: "उम्र और प्रकृति के हिसाब से सौम्य इलाज।" },
      { en: "Follow-up & online advice", hi: "फ़ॉलो-अप और ऑनलाइन सलाह", desc: "Review visits, and WhatsApp follow-up for outstation patients.", descHi: "रिव्यू विज़िट, और बाहर के मरीज़ों के लिए WhatsApp फ़ॉलो-अप।" },
    ],
    avoid: ["homeopath", "homoeopath", "globule", "potency", "sugar pill", "mother tincture", "constitutional remedy", "similia"],
  },
  "ayurveda:homeopathy": {
    explain: [
      "homeopathy — a detailed case history of the person, then a medicine chosen for that person",
      "the problems people commonly come for (allergy, skin, children's complaints, long-standing troubles) without any promise of cure",
      "medicines dispensed at the clinic, with clear instructions on how to take them",
      "consultation timings, appointment on WhatsApp, follow-up for outstation patients",
    ],
    services: [
      { en: "Consultation & case history", hi: "परामर्श और पूरी केस हिस्ट्री", desc: "A detailed talk about your symptoms, habits and history before any medicine.", descHi: "दवा से पहले आपके लक्षण, आदतें और पुरानी बातों पर पूरी बातचीत।" },
      { en: "Homeopathic medicines", hi: "होम्योपैथिक दवाइयाँ", desc: "Medicines chosen for you and dispensed at the clinic with clear instructions.", descHi: "आपके लिए चुनी गई दवाइयाँ, क्लिनिक पर ही और साफ़ निर्देश के साथ।" },
      { en: "Children's care", hi: "बच्चों की देखभाल", desc: "Gentle, easy-to-take medicines for common childhood complaints.", descHi: "बच्चों की आम तकलीफ़ों के लिए हल्की और आसानी से ली जाने वाली दवाइयाँ।" },
      { en: "Skin & allergy complaints", hi: "त्वचा और एलर्जी की समस्याएँ", desc: "Skin and seasonal allergy complaints looked into with patience.", descHi: "त्वचा और मौसमी एलर्जी की तकलीफ़ों पर धैर्य से ध्यान।" },
      { en: "Long-standing complaints", hi: "पुरानी तकलीफ़ें", desc: "Regular review of old complaints, with the medicine adjusted as needed.", descHi: "पुरानी तकलीफ़ों का नियमित रिव्यू, ज़रूरत हो तो दवा में बदलाव।" },
      { en: "Women's health consultation", hi: "महिलाओं के स्वास्थ्य की सलाह", desc: "A private, unhurried consultation for women's health concerns.", descHi: "महिलाओं की सेहत की बातों पर निजी और बिना जल्दबाज़ी की सलाह।" },
      { en: "Follow-up & online advice", hi: "फ़ॉलो-अप और ऑनलाइन सलाह", desc: "Review visits, and WhatsApp follow-up for outstation patients.", descHi: "रिव्यू विज़िट, और बाहर के मरीज़ों के लिए WhatsApp फ़ॉलो-अप।" },
    ],
    avoid: ["ayurved", "panchakarma", "vaidya", "herbal", "kadha", "churna", "abhyanga", "dosha", "prakriti", "classical medicine", "oil massage"],
  },

  "finance:loans": {
    explain: [
      "the loans you arrange — home, business, personal, vehicle, gold, loan against property",
      "tie-ups with banks and NBFCs; eligibility and documents checked before applying",
      "the process from application to disbursal, and balance transfer of an existing loan",
      "honest advice: approval and terms depend on the lender, never promised in advance",
    ],
    services: [
      { en: "Home loan", hi: "होम लोन", desc: "For buying, building or renovating a house; balance transfer too.", descHi: "घर ख़रीदने, बनाने या मरम्मत के लिए; बैलेंस ट्रांसफ़र भी।" },
      { en: "Business & MSME loan", hi: "बिज़नेस और MSME लोन", desc: "Working capital, machinery and shop loans for small businesses.", descHi: "छोटे कारोबार के लिए वर्किंग कैपिटल, मशीन और दुकान का लोन।" },
      { en: "Personal loan", hi: "पर्सनल लोन", desc: "For marriage, medical, travel or any personal need.", descHi: "शादी, इलाज, सफ़र या किसी भी निजी ज़रूरत के लिए।" },
      { en: "Vehicle loan", hi: "गाड़ी का लोन", desc: "Car, bike and commercial vehicle finance, new or used.", descHi: "कार, बाइक और कमर्शियल गाड़ी का फ़ाइनेंस, नई या पुरानी।" },
      { en: "Loan against property", hi: "प्रॉपर्टी पर लोन", desc: "Larger amounts against your house, shop or land.", descHi: "मकान, दुकान या ज़मीन के बदले बड़ी रक़म।" },
      { en: "Gold loan", hi: "गोल्ड लोन", desc: "A quick loan against gold with a clear process.", descHi: "सोने के बदले साफ़ प्रक्रिया के साथ जल्दी लोन।" },
      { en: "Balance transfer", hi: "बैलेंस ट्रांसफ़र", desc: "Move an existing loan to a lender with better terms.", descHi: "मौजूदा लोन बेहतर शर्तों वाले बैंक में शिफ़्ट।" },
    ],
    avoid: ["mutual fund", "sip", "invest", "portfolio", "market risk", "market-linked", "fund house", "nav of", "equity", "wealth", "redemption"],
  },
  "finance:invest": {
    explain: [
      "mutual funds and SIP — goal-based investing started simply and reviewed with the client",
      "understanding the goal, the time period and how much risk the client is comfortable with",
      "help with KYC, paperwork and regular reviews",
      "honest advice: investments carry market risk and returns are never promised",
    ],
    services: [
      { en: "Mutual fund investing", hi: "म्यूचुअल फ़ंड में निवेश", desc: "Funds chosen to match your goal and how much risk you are comfortable with.", descHi: "आपके लक्ष्य और जोखिम उठाने की क्षमता के हिसाब से चुने गए फ़ंड।" },
      { en: "SIP (monthly investing)", hi: "SIP (हर महीने निवेश)", desc: "Start small and invest regularly, with the amount changed when you wish.", descHi: "छोटी शुरुआत और नियमित निवेश, रक़म आप जब चाहें बदल सकते हैं।" },
      { en: "Goal-based planning", hi: "लक्ष्य के हिसाब से प्लानिंग", desc: "Planning for a child's education, a house, retirement or any goal.", descHi: "बच्चों की पढ़ाई, घर, रिटायरमेंट या किसी भी लक्ष्य की प्लानिंग।" },
      { en: "KYC & account opening", hi: "KYC और खाता खुलवाना", desc: "Help with the forms and documents to get started.", descHi: "शुरू करने के लिए फ़ॉर्म और काग़ज़ात में मदद।" },
      { en: "Portfolio review", hi: "पोर्टफ़ोलियो की समीक्षा", desc: "A look at your existing investments and whether they still fit your goal.", descHi: "आपके मौजूदा निवेश कैसे हैं और अब भी लक्ष्य के हिसाब से ठीक हैं या नहीं।" },
      { en: "Insurance guidance", hi: "बीमा की सलाह", desc: "Help in understanding life and health cover alongside your investments.", descHi: "निवेश के साथ जीवन और स्वास्थ्य बीमा समझने में मदद।" },
      { en: "Investor education", hi: "निवेश की जानकारी", desc: "Simple explanation of how funds work and what the risks are.", descHi: "फ़ंड कैसे काम करते हैं और जोखिम क्या हैं, सीधी भाषा में समझाना।" },
    ],
    avoid: ["loan", "emi", "lender", "nbfc", "disburs", "cibil", "credit score", "balance transfer", "collateral", "processing fee", "eligibility"],
  },

  "interior:interior": {
    explain: [
      "what you design — homes, kitchens, wardrobes, offices and shops, inside the walls",
      "the process — understanding the need, layout and 3D design, materials, then the work done on site",
      "carpentry, false ceiling, lighting, painting and finishing handled by your own team",
      "site visits, free discussion on WhatsApp, handover with the space ready to use",
    ],
    services: [
      { en: "Full home interiors", hi: "पूरे घर का इंटीरियर", desc: "Living room, bedrooms, kitchen and bathrooms designed to work together.", descHi: "लिविंग रूम, बेडरूम, किचन और बाथरूम, सब एक साथ मेल खाते डिज़ाइन में।" },
      { en: "Modular kitchen", hi: "मॉड्यूलर किचन", desc: "A kitchen planned around how you cook, with proper storage.", descHi: "आपके खाना बनाने के तरीक़े के हिसाब से बनी किचन, सही स्टोरेज के साथ।" },
      { en: "Wardrobes & furniture", hi: "वार्डरोब और फ़र्नीचर", desc: "Made-to-measure wardrobes, beds, TV units and storage.", descHi: "नाप के हिसाब से वार्डरोब, बेड, टीवी यूनिट और स्टोरेज।" },
      { en: "False ceiling & lighting", hi: "फ़ॉल्स सीलिंग और लाइटिंग", desc: "Ceiling design and lighting that suits each room.", descHi: "हर कमरे के हिसाब से सीलिंग डिज़ाइन और लाइटिंग।" },
      { en: "Office & shop interiors", hi: "ऑफ़िस और दुकान का इंटीरियर", desc: "Workspaces and shops planned for the way you work and sell.", descHi: "आपके काम और बिक्री के तरीक़े के हिसाब से बने ऑफ़िस और दुकान।" },
      { en: "3D design & layout", hi: "3D डिज़ाइन और लेआउट", desc: "See how the space will look before the work begins.", descHi: "काम शुरू होने से पहले देखें कि जगह कैसी दिखेगी।" },
      { en: "Painting, curtains & decor", hi: "पेंटिंग, पर्दे और सजावट", desc: "The finishing touches that make the space feel like yours.", descHi: "आख़िरी सजावट, जिससे जगह अपनी-सी लगे।" },
    ],
    avoid: ["architect", "structural", "building plan", "sanction", "municipal", "elevation", "construction supervision", "town planning", "plot", "foundation"],
  },
  "interior:architect": {
    explain: [
      "what you plan — houses, apartments, shops and buildings, from plot to finished design",
      "the process — understanding the need and plot, concept, drawings, approvals, then guidance during construction",
      "building plans, 3D elevations and working drawings, including vastu where wanted",
      "site visits, discussion on WhatsApp, and support with the paperwork for approval",
    ],
    services: [
      { en: "House & building planning", hi: "घर और इमारत की प्लानिंग", desc: "Floor plans made around your plot, family and the way you live.", descHi: "आपके प्लॉट, परिवार और रहने के तरीक़े के हिसाब से बना नक़्शा।" },
      { en: "3D elevation", hi: "3D एलिवेशन", desc: "See the outside of your building before it is built.", descHi: "इमारत बनने से पहले उसका बाहरी रूप देखें।" },
      { en: "Working drawings", hi: "वर्किंग ड्रॉइंग", desc: "Detailed drawings your builder and contractor can follow on site.", descHi: "बिल्डर और ठेकेदार के लिए साइट पर काम आने वाली पूरी ड्रॉइंग।" },
      { en: "Approvals & paperwork", hi: "नक़्शा पास कराना और काग़ज़ात", desc: "Drawings and documents prepared for submission to the local authority.", descHi: "स्थानीय विभाग में देने के लिए ड्रॉइंग और काग़ज़ात तैयार करना।" },
      { en: "Vastu-friendly planning", hi: "वास्तु के अनुसार प्लानिंग", desc: "Layouts that follow vastu where you want it.", descHi: "जहाँ आप चाहें, वहाँ वास्तु के अनुसार नक़्शा।" },
      { en: "Commercial planning", hi: "कमर्शियल प्लानिंग", desc: "Shops, offices, showrooms and small commercial buildings.", descHi: "दुकान, ऑफ़िस, शोरूम और छोटी कमर्शियल इमारतें।" },
      { en: "Site visits & supervision", hi: "साइट विज़िट और निगरानी", desc: "Visits during construction to see that the work follows the drawing.", descHi: "निर्माण के दौरान देखना कि काम ड्रॉइंग के हिसाब से हो रहा है।" },
    ],
    avoid: ["modular", "wardrobe", "false ceiling", "furniture", "carpent", "curtain", "furnishing", "decor", "woodwork", "paneling", "upholster"],
  },

  "auto:garage": {
    explain: [
      "what the garage looks after — periodic service, repairs, tyres and battery, denting-painting, wash and detailing",
      "which vehicles — cars, bikes or both, and the brands handled",
      "genuine or good-quality spare parts, with the problem explained before the work starts",
      "appointment on WhatsApp, pickup and drop if offered, and a job card for every vehicle",
    ],
    services: [
      { en: "Periodic service", hi: "पीरियॉडिक सर्विस", desc: "Regular servicing with oil, filters and a full check-up.", descHi: "तेल, फ़िल्टर और पूरी जाँच के साथ नियमित सर्विस।" },
      { en: "Repairs & diagnosis", hi: "रिपेयर और जाँच", desc: "The fault found and explained before any work is done.", descHi: "काम से पहले ख़राबी ढूँढकर समझाना।" },
      { en: "Tyres, battery & alignment", hi: "टायर, बैटरी और अलाइनमेंट", desc: "Tyre change, wheel alignment, balancing and battery replacement.", descHi: "टायर बदलना, व्हील अलाइनमेंट, बैलेंसिंग और बैटरी बदलना।" },
      { en: "Denting & painting", hi: "डेंटिंग और पेंटिंग", desc: "Body repair and paint work for scratches, dents and accident damage.", descHi: "खरोंच, डेंट और एक्सीडेंट के नुक़सान की बॉडी रिपेयर और पेंट।" },
      { en: "Car wash & detailing", hi: "कार वॉश और डिटेलिंग", desc: "Interior and exterior cleaning, polish and protective coating.", descHi: "अंदर-बाहर की सफ़ाई, पॉलिश और प्रोटेक्टिव कोटिंग।" },
      { en: "Spare parts", hi: "स्पेयर पार्ट्स", desc: "Genuine and good-quality parts fitted with a bill.", descHi: "असली और अच्छी क्वालिटी के पार्ट्स, बिल के साथ फ़िट।" },
      { en: "AC & electrical work", hi: "AC और इलेक्ट्रिकल काम", desc: "AC servicing, wiring and light repairs.", descHi: "AC सर्विस, वायरिंग और लाइट की मरम्मत।" },
    ],
    avoid: ["showroom", "test drive", "new car", "new bike", "new vehicle", "on-road", "exchange offer", "variant", "dealership", "vehicle finance"],
  },
  "auto:showroom": {
    explain: [
      "the vehicles on sale — which brands and models, new and, if any, certified used",
      "what the buyer is helped with — test drive, finance, exchange of the old vehicle, insurance and registration",
      "honest guidance on choosing the right model for the buyer's need and budget",
      "booking and delivery, and the service and spare parts support after purchase",
    ],
    services: [
      { en: "New vehicle sales", hi: "नई गाड़ियों की बिक्री", desc: "A range of models to see and compare in one place.", descHi: "एक ही जगह कई मॉडल देखने और तुलना करने के लिए।" },
      { en: "Test drive", hi: "टेस्ट ड्राइव", desc: "Drive the vehicle before you decide.", descHi: "फ़ैसला करने से पहले गाड़ी चलाकर देखें।" },
      { en: "Finance help", hi: "फ़ाइनेंस में मदद", desc: "Help arranging vehicle finance with the lender of your choice.", descHi: "आपकी पसंद के बैंक से गाड़ी का फ़ाइनेंस कराने में मदद।" },
      { en: "Exchange of old vehicle", hi: "पुरानी गाड़ी का एक्सचेंज", desc: "Your old vehicle valued and exchanged against the new one.", descHi: "पुरानी गाड़ी की क़ीमत लगाकर नई के बदले एक्सचेंज।" },
      { en: "Insurance & registration", hi: "बीमा और रजिस्ट्रेशन", desc: "Insurance and registration papers handled for you.", descHi: "बीमा और रजिस्ट्रेशन के काग़ज़ात हम संभालते हैं।" },
      { en: "Booking & delivery", hi: "बुकिंग और डिलीवरी", desc: "Book your choice of model and colour and take delivery with all papers.", descHi: "अपना मॉडल और रंग बुक करें और सारे काग़ज़ात के साथ डिलीवरी लें।" },
      { en: "Accessories & after-sales support", hi: "एक्सेसरीज़ और बिक्री के बाद सहयोग", desc: "Accessories fitted, with service and parts support after purchase.", descHi: "एक्सेसरीज़ लगवाना, और ख़रीद के बाद सर्विस व पार्ट्स का सहयोग।" },
    ],
    avoid: ["garage", "workshop", "denting", "wheel alignment", "puncture", "oil change", "car wash", "detailing", "mechanic", "breakdown"],
  },

  "printing:printing": {
    explain: [
      "what you print — visiting cards, wedding cards, flex and banners, brochures, bill books, stickers, mugs and t-shirts",
      "the process — file or design received, proof shown, paper and finish chosen, then printed and delivered",
      "small runs and bulk orders, offset and digital printing, finishing like lamination and binding",
      "order on WhatsApp, proof before the final print, delivery or pickup on the promised day",
    ],
    services: [
      { en: "Visiting cards & stationery", hi: "विज़िटिंग कार्ड और स्टेशनरी", desc: "Cards, letterheads, envelopes and bill books for your business.", descHi: "आपके कारोबार के लिए कार्ड, लेटरहेड, लिफ़ाफ़े और बिल बुक।" },
      { en: "Wedding & invitation cards", hi: "शादी और निमंत्रण कार्ड", desc: "Cards for weddings and functions in many papers and finishes.", descHi: "शादी और समारोहों के कार्ड, कई तरह के काग़ज़ और फ़िनिश में।" },
      { en: "Flex, banners & posters", hi: "फ़्लेक्स, बैनर और पोस्टर", desc: "Big-format printing for shops, events and promotions.", descHi: "दुकान, कार्यक्रम और प्रचार के लिए बड़े साइज़ की छपाई।" },
      { en: "Brochures & catalogues", hi: "ब्रोशर और कैटलॉग", desc: "Folded and bound printed material for your products and services.", descHi: "आपके प्रोडक्ट और सेवाओं के लिए मुड़े हुए और बाइंड किए छपे पन्ने।" },
      { en: "Stickers & labels", hi: "स्टिकर और लेबल", desc: "Stickers and product labels in the shape and size you need.", descHi: "आपके चाहे आकार और साइज़ के स्टिकर और प्रोडक्ट लेबल।" },
      { en: "T-shirt & mug printing", hi: "टी-शर्ट और मग प्रिंटिंग", desc: "Your design or logo on t-shirts, mugs and gifts.", descHi: "टी-शर्ट, मग और गिफ़्ट पर आपका डिज़ाइन या लोगो।" },
      { en: "Lamination & binding", hi: "लैमिनेशन और बाइंडिंग", desc: "Finishing that makes printed work last and look neat.", descHi: "छपाई को टिकाऊ और साफ़-सुथरा बनाने वाली फ़िनिशिंग।" },
    ],
    avoid: ["logo design", "brand identity", "graphic design", "creative concept", "social media creative", "brand guideline", "illustration", "ui design", "design studio", "design revision"],
  },
  "printing:design": {
    explain: [
      "what you design — logos, visiting cards, brochures, flex and social media creatives, packaging and labels",
      "the process — understanding the brand and the need, first concepts, changes with the client, then final files",
      "designs ready for print or for digital use, in the formats the client needs",
      "brief on WhatsApp, drafts shown for feedback, final files handed over",
    ],
    services: [
      { en: "Logo & brand identity", hi: "लोगो और ब्रांड पहचान", desc: "A logo and a simple look for your brand that you can use everywhere.", descHi: "आपके ब्रांड के लिए लोगो और एक सादा लुक, जो हर जगह इस्तेमाल हो सके।" },
      { en: "Visiting card & stationery design", hi: "विज़िटिंग कार्ड और स्टेशनरी डिज़ाइन", desc: "Cards, letterheads and bills designed to match your brand.", descHi: "आपके ब्रांड से मेल खाते कार्ड, लेटरहेड और बिल के डिज़ाइन।" },
      { en: "Brochure & catalogue design", hi: "ब्रोशर और कैटलॉग डिज़ाइन", desc: "Clean layouts that present your products and services clearly.", descHi: "आपके प्रोडक्ट और सेवाओं को साफ़ दिखाने वाला सुंदर लेआउट।" },
      { en: "Flex, poster & ad design", hi: "फ़्लेक्स, पोस्टर और विज्ञापन डिज़ाइन", desc: "Eye-catching designs for shops, events and offers.", descHi: "दुकान, कार्यक्रम और ऑफ़र के लिए ध्यान खींचने वाले डिज़ाइन।" },
      { en: "Social media creatives", hi: "सोशल मीडिया क्रिएटिव", desc: "Posts, banners and stories designed for your pages.", descHi: "आपके पेज के लिए पोस्ट, बैनर और स्टोरी के डिज़ाइन।" },
      { en: "Packaging & label design", hi: "पैकेजिंग और लेबल डिज़ाइन", desc: "Product labels and boxes that look good on the shelf.", descHi: "शेल्फ़ पर अच्छे दिखने वाले प्रोडक्ट लेबल और डिब्बे।" },
      { en: "Invitation card design", hi: "निमंत्रण कार्ड डिज़ाइन", desc: "Wedding and function cards designed to your taste.", descHi: "शादी और समारोह के कार्ड, आपकी पसंद के डिज़ाइन में।" },
    ],
    avoid: ["offset", "printing press", "print run", "gsm", "lamination", "binding", "flex printing", "digital printing", "screen printing", "t-shirt printing", "bill book"],
  },
};
