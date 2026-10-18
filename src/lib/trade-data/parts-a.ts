// Parts of combined categories, batch A: electrician, hardware, gym, tailor, mehndi. Same rules as types.ts: plain Indian English,
// natural Hindi, no numbers, no prices, no guarantees. See lib/trade-parts.ts for how parts are used.
import type { TradeLine } from "./types";
import type { TradePart } from "@/lib/trade-parts";

export const PARTS_A: Record<string, TradePart[]> = {
  electrician: [
    { key: "electrician", en: "Electrician", hi: "इलेक्ट्रीशियन" },
    { key: "plumber", en: "Plumber", hi: "प्लंबर" },
    { key: "ac", en: "AC repair & service", hi: "AC रिपेयर और सर्विस", label: "AC technician", labelHi: "AC टेक्नीशियन" },
  ],
  hardware: [
    { key: "hardware", en: "Hardware & tools", hi: "हार्डवेयर और औज़ार", label: "Hardware shop", labelHi: "हार्डवेयर की दुकान" },
    { key: "paint", en: "Paint", hi: "पेंट", label: "Paint shop", labelHi: "पेंट की दुकान" },
    { key: "sanitary", en: "Sanitary & fittings", hi: "सैनिटरी और फ़िटिंग", label: "Sanitary shop", labelHi: "सैनिटरी की दुकान" },
  ],
  gym: [
    { key: "gym", en: "Gym", hi: "जिम" },
    { key: "fitness", en: "Personal training", hi: "पर्सनल ट्रेनिंग", label: "Fitness trainer", labelHi: "फ़िटनेस ट्रेनर" },
    { key: "yoga", en: "Yoga", hi: "योग", label: "Yoga centre", labelHi: "योग केंद्र" },
  ],
  tailor: [
    { key: "tailor", en: "Tailoring", hi: "सिलाई", label: "Tailor", labelHi: "टेलर" },
    { key: "boutique", en: "Boutique & designer wear", hi: "बुटीक और डिज़ाइनर वियर", label: "Boutique", labelHi: "बुटीक" },
  ],
  mehndi: [
    { key: "mehndi", en: "Mehndi", hi: "मेहंदी", label: "Mehndi artist", labelHi: "मेहंदी आर्टिस्ट" },
    { key: "makeup", en: "Makeup", hi: "मेकअप", label: "Makeup artist", labelHi: "मेकअप आर्टिस्ट" },
  ],
};

/** category -> part key -> the "what you do / offer / sell" tick chips (exact English names from trade-questions.ts) of that part. */
export const TICKS_A: Record<string, Record<string, string[]>> = {
  electrician: {
    electrician: ["Electrician", "CCTV", "Solar", "Appliance repair"],
    plumber: ["Plumber", "RO repair"],
    ac: ["AC repair", "Appliance repair"],
  },
  hardware: {
    hardware: ["Pipes & fittings", "Tools", "Electrical", "Cement / steel", "Plywood"],
    paint: ["Paint"],
    sanitary: ["Sanitary", "Pipes & fittings", "Tiles"],
  },
  gym: {
    gym: ["Gym", "Zumba / aerobics", "CrossFit", "Personal training", "Ladies' batch", "Steam / sauna"],
    fitness: ["Personal training", "CrossFit"],
    yoga: ["Yoga", "Ladies' batch"],
  },
  tailor: {
    tailor: ["Ladies' suits", "Blouses", "Gents' shirts & pants", "Bridal / lehenga", "Alterations", "Uniforms"],
    boutique: ["Ladies' suits", "Blouses", "Bridal / lehenga", "Designer wear"],
  },
  mehndi: {
    mehndi: ["Bridal mehndi", "Party mehndi"],
    makeup: ["Bridal makeup", "Party makeup", "Hair styling", "Nail art", "Saree draping"],
  },
};

/** key "category:part". */
export const SEEDS_A: Record<string, { explain: string[]; services: TradeLine[]; avoid: string[] }> = {
  // ---------------------------------------------------------------- electrician
  "electrician:electrician": {
    explain: [
      "electrician — house wiring, switches, fans, lights, MCB and fuse, inverter, earthing",
      "fault finding for power cuts, sparking, tripping and short circuits at homes, shops and offices",
      "new fittings and repairs, neat work with proper wire and fittings, site cleaned after the job",
      "visit at your time, charge told after seeing the work",
    ],
    services: [
      { en: "House wiring", hi: "घर की वायरिंग", desc: "New wiring and rewiring for homes, shops and offices.", descHi: "घर, दुकान और ऑफ़िस की नई वायरिंग और दोबारा वायरिंग।" },
      { en: "Fault finding & repair", hi: "फ़ॉल्ट ढूँढना और ठीक करना", desc: "Short circuit, tripping, sparking and power-cut problems traced and fixed.", descHi: "शॉर्ट सर्किट, ट्रिपिंग, चिंगारी और बिजली गुल की समस्या ढूँढकर ठीक।" },
      { en: "Switches, sockets & lights", hi: "स्विच, सॉकेट और लाइट", desc: "Fitting and replacement of switches, sockets, tube lights and decorative lights.", descHi: "स्विच, सॉकेट, ट्यूबलाइट और सजावटी लाइट लगाना और बदलना।" },
      { en: "Fan & appliance fitting", hi: "पंखा और उपकरण फ़िटिंग", desc: "Ceiling fans, exhaust fans, geysers and other appliances fitted safely.", descHi: "सीलिंग फ़ैन, एग्ज़ॉस्ट फ़ैन, गीज़र और दूसरे उपकरण सुरक्षित तरीके से लगाना।" },
      { en: "MCB, meter & earthing", hi: "MCB, मीटर और अर्थिंग", desc: "Distribution board, MCB changes and proper earthing for safety.", descHi: "डिस्ट्रीब्यूशन बोर्ड, MCB बदलना और सुरक्षा के लिए सही अर्थिंग।" },
      { en: "Inverter & battery connection", hi: "इन्वर्टर और बैटरी कनेक्शन", desc: "Inverter and battery fitting with a separate backup line.", descHi: "इन्वर्टर और बैटरी की फ़िटिंग, बैकअप के लिए अलग लाइन के साथ।" },
      { en: "CCTV & solar fitting", hi: "CCTV और सोलर फ़िटिंग", desc: "Camera cabling and basic solar connections where needed.", descHi: "कैमरे की केबलिंग और ज़रूरत हो तो सोलर का बेसिक कनेक्शन।" },
    ],
    avoid: ["plumb", "pipe", "tap water", "taps", "geyser", "air condition", "ac ", "ac,", "drain", "compressor", "gas filling", "water leak"],
  },
  "electrician:plumber": {
    explain: [
      "plumber — tap and pipe leaks, bathroom and kitchen fittings, water tank and motor, drain blockage",
      "new pipeline and repair work at homes, shops and offices, neat work with proper fittings",
      "geyser and RO water line fitting, site cleaned after the job",
      "visit at your time, charge told after seeing the work",
    ],
    services: [
      { en: "Tap & pipe leakage repair", hi: "नल और पाइप की लीकेज ठीक करना", desc: "Dripping taps, leaking pipes and joints found and fixed.", descHi: "टपकते नल, रिसते पाइप और जोड़ ढूँढकर ठीक करना।" },
      { en: "Bathroom fittings", hi: "बाथरूम फ़िटिंग", desc: "Basin, commode, shower, flush tank and taps fitted or replaced.", descHi: "बेसिन, कमोड, शावर, फ़्लश टैंक और नल लगाना या बदलना।" },
      { en: "Drain & sewer blockage", hi: "ड्रेन और सीवर की रुकावट", desc: "Blocked kitchen sinks, bathroom drains and sewer lines opened.", descHi: "किचन सिंक, बाथरूम ड्रेन और सीवर लाइन की रुकावट खोलना।" },
      { en: "New pipeline work", hi: "नई पाइपलाइन का काम", desc: "Water supply and drainage pipes for new homes and extensions.", descHi: "नए घर और बढ़ाए हुए हिस्से में पानी और निकासी की पाइपलाइन।" },
      { en: "Water tank & motor", hi: "पानी की टंकी और मोटर", desc: "Tank connections, float valve and water pump fitting and repair.", descHi: "टंकी का कनेक्शन, फ़्लोट वाल्व और पानी की मोटर की फ़िटिंग और मरम्मत।" },
      { en: "Geyser & RO line fitting", hi: "गीज़र और RO लाइन फ़िटिंग", desc: "Geyser and water purifier connections done neatly.", descHi: "गीज़र और वॉटर प्यूरीफ़ायर के कनेक्शन सफ़ाई से।" },
    ],
    avoid: ["electrician", "wiring", "switch", "socket", "mcb", "short circuit", "inverter", "earthing", "air condition", "ac ", "ac,", "cctv", "solar", "tube light"],
  },
  "electrician:ac": {
    explain: [
      "AC technician — split and window AC service, gas filling, repair, installation and uninstallation",
      "cooling problem, water dripping, noise and not-starting faults found and fixed",
      "servicing with proper tools, check before and after, site left clean",
      "visit at your time, charge told after checking the AC",
    ],
    services: [
      { en: "AC service & cleaning", hi: "AC सर्विस और सफ़ाई", desc: "Filter, coil and outdoor unit cleaned for better cooling.", descHi: "बेहतर ठंडक के लिए फ़िल्टर, कॉइल और आउटडोर यूनिट की सफ़ाई।" },
      { en: "Gas filling & leak check", hi: "गैस भरना और लीकेज जाँच", desc: "Gas level checked, leaks found and gas filled where needed.", descHi: "गैस का स्तर जाँचना, लीकेज ढूँढना और ज़रूरत हो तो गैस भरना।" },
      { en: "AC repair", hi: "AC रिपेयर", desc: "Not cooling, noise, water dripping and not-starting faults repaired.", descHi: "ठंडा न करना, आवाज़, पानी टपकना और चालू न होने की ख़राबी ठीक।" },
      { en: "AC installation", hi: "AC इंस्टॉलेशन", desc: "Split and window AC fitted with proper stand, pipe and wiring.", descHi: "स्प्लिट और विंडो AC की सही स्टैंड, पाइप और वायरिंग के साथ फ़िटिंग।" },
      { en: "Uninstall & shifting", hi: "AC निकालना और शिफ़्टिंग", desc: "AC taken down carefully and refitted at the new place.", descHi: "AC सावधानी से निकालकर नई जगह दोबारा लगाना।" },
      { en: "Compressor & PCB repair", hi: "कंप्रेसर और PCB रिपेयर", desc: "Major parts checked and repaired or replaced after your approval.", descHi: "बड़े पार्ट की जाँच और आपकी मंज़ूरी के बाद रिपेयर या बदलना।" },
      { en: "AC annual care (AMC)", hi: "AC की सालाना देखभाल (AMC)", desc: "Regular service visits for homes, shops and offices on a yearly plan.", descHi: "घर, दुकान और ऑफ़िस के लिए सालाना प्लान में नियमित सर्विस विज़िट।" },
    ],
    avoid: ["plumb", "tap water", "taps", "bathroom", "commode", "drain", "water tank", "geyser", "wiring", "switchboard", "mcb", "electrician", "cctv", "solar"],
  },

  // ---------------------------------------------------------------- hardware
  "hardware:hardware": {
    explain: [
      "hardware shop — tools, nuts and bolts, locks, hinges, pipes and fittings, electrical items, cement and steel",
      "for homes, contractors, carpenters and workshops; ready stock of daily-need items",
      "good brands and plain advice on which item suits the job",
      "pick up at the shop or delivery for bigger orders",
    ],
    services: [
      { en: "Hand & power tools", hi: "हाथ और बिजली के औज़ार", desc: "Drills, hammers, spanners, cutters and other tools for home and work.", descHi: "ड्रिल, हथौड़ा, पाना, कटर और घर व काम के दूसरे औज़ार।" },
      { en: "Nuts, bolts & screws", hi: "नट, बोल्ट और स्क्रू", desc: "Fasteners of many types and sizes, sold loose or in packs.", descHi: "कई तरह और साइज़ के फ़ास्टनर, खुले या पैक में।" },
      { en: "Locks, hinges & handles", hi: "ताले, कब्ज़े और हैंडल", desc: "Door and cupboard fittings for homes and shops.", descHi: "घर और दुकान के दरवाज़े व अलमारी की फ़िटिंग।" },
      { en: "Pipes & fittings", hi: "पाइप और फ़िटिंग", desc: "Pipes, elbows, valves and joints for water and drainage work.", descHi: "पानी और निकासी के काम के लिए पाइप, एल्बो, वाल्व और जोड़।" },
      { en: "Electrical items", hi: "इलेक्ट्रिकल सामान", desc: "Wires, switches, holders and basic electrical fittings.", descHi: "तार, स्विच, होल्डर और बेसिक इलेक्ट्रिकल फ़िटिंग।" },
      { en: "Cement, steel & plywood", hi: "सीमेंट, सरिया और प्लाईवुड", desc: "Building and carpentry material for small and large jobs.", descHi: "छोटे और बड़े काम के लिए निर्माण और बढ़ईगीरी का सामान।" },
      { en: "Bulk orders & delivery", hi: "थोक ऑर्डर और डिलीवरी", desc: "Contractors and workshops supplied on order, delivered to site.", descHi: "ठेकेदार और वर्कशॉप को ऑर्डर पर सप्लाई, साइट तक डिलीवरी।" },
    ],
    avoid: ["paint", "primer", "shade card", "colour mixing", "sanitary", "commode", "basin", "bathroom set", "wash basin", "tiles"],
  },
  "hardware:paint": {
    explain: [
      "paint shop — interior and exterior wall paint, enamel, primer, putty, wood polish, waterproofing",
      "shade card and computer colour matching, brushes and rollers",
      "good brands and plain advice on how much paint and which type suits the wall",
      "pick up at the shop or delivery to the site",
    ],
    services: [
      { en: "Interior wall paint", hi: "अंदर की दीवारों का पेंट", desc: "Emulsion and distemper for rooms, in many finishes.", descHi: "कमरों के लिए इमल्शन और डिस्टेंपर, कई तरह की फ़िनिश में।" },
      { en: "Exterior & weatherproof paint", hi: "बाहर की दीवारों का पेंट", desc: "Paint made for sun and rain on outer walls.", descHi: "बाहरी दीवारों के लिए धूप और बारिश सहने वाला पेंट।" },
      { en: "Enamel & wood polish", hi: "एनामल और वुड पॉलिश", desc: "For doors, grills, furniture and metal surfaces.", descHi: "दरवाज़े, ग्रिल, फ़र्नीचर और लोहे की चीज़ों के लिए।" },
      { en: "Primer, putty & waterproofing", hi: "प्राइमर, पुट्टी और वॉटरप्रूफ़िंग", desc: "The base coats that make the paint last on the wall.", descHi: "वो बेस कोट जिनसे दीवार पर पेंट टिकता है।" },
      { en: "Colour matching", hi: "कलर मैचिंग", desc: "Your chosen shade mixed on the machine from the shade card.", descHi: "शेड कार्ड से आपका पसंद का शेड मशीन पर तैयार।" },
      { en: "Brushes, rollers & tools", hi: "ब्रश, रोलर और औज़ार", desc: "Everything needed to apply the paint.", descHi: "पेंट लगाने के लिए ज़रूरी सारा सामान।" },
      { en: "Paint advice & delivery", hi: "पेंट की सलाह और डिलीवरी", desc: "Help in choosing type and quantity, and delivery to your site.", descHi: "किस्म और मात्रा चुनने में मदद और साइट तक डिलीवरी।" },
    ],
    avoid: ["pipe", "tools", "drill", "nuts", "bolts", "hinge", "lock", "cement", "steel", "plywood", "sanitary", "commode", "basin", "tiles", "electrical"],
  },
  "hardware:sanitary": {
    explain: [
      "sanitary shop — taps, basins, commodes, showers, bathroom sets, pipes and fittings, tiles",
      "for new homes, renovation and replacement; many designs and brands on display",
      "plain advice on what fits your bathroom and budget, plumber contacts on request",
      "pick up at the shop or delivery to the site",
    ],
    services: [
      { en: "Taps & showers", hi: "नल और शावर", desc: "Wall mixers, taps and showers in many designs.", descHi: "वॉल मिक्सर, नल और शावर कई डिज़ाइन में।" },
      { en: "Wash basins & commodes", hi: "वॉश बेसिन और कमोड", desc: "Wall-hung, table-top and floor-mounted models.", descHi: "दीवार पर, टेबल-टॉप और फ़र्श पर लगने वाले मॉडल।" },
      { en: "Bathroom sets & accessories", hi: "बाथरूम सेट और एक्सेसरी", desc: "Towel rods, soap dishes, mirrors and other fittings.", descHi: "तौलिया रॉड, साबुन दानी, शीशे और दूसरी फ़िटिंग।" },
      { en: "Pipes & fittings", hi: "पाइप और फ़िटिंग", desc: "Pipes, valves and joints for water and drainage.", descHi: "पानी और निकासी के लिए पाइप, वाल्व और जोड़।" },
      { en: "Water tanks & geysers", hi: "पानी की टंकी और गीज़र", desc: "Storage tanks and water heaters for homes and buildings.", descHi: "घर और इमारतों के लिए पानी की टंकी और वॉटर हीटर।" },
      { en: "Tiles & flooring", hi: "टाइल्स और फ़्लोरिंग", desc: "Wall and floor tiles to match the bathroom.", descHi: "बाथरूम से मेल खाती दीवार और फ़र्श की टाइल्स।" },
      { en: "Choosing help & delivery", hi: "चुनने में मदद और डिलीवरी", desc: "Advice on what suits your space, delivery to site, plumber contact if needed.", descHi: "आपकी जगह के हिसाब से सलाह, साइट तक डिलीवरी और ज़रूरत हो तो प्लंबर का संपर्क।" },
    ],
    avoid: ["paint", "primer", "shade card", "drill", "nuts", "bolts", "hinge", "lock", "cement", "steel", "plywood", "tools", "electrical"],
  },

  // ---------------------------------------------------------------- gym
  "gym:gym": {
    explain: [
      "gym — cardio and weight machines, free weights, group classes, trainers on the floor",
      "morning and evening batches, men and women, beginners to regular members",
      "clean hall, working equipment, trainer guidance on form and routine",
      "membership by month or longer, come for a free trial visit",
    ],
    services: [
      { en: "Cardio & weight training", hi: "कार्डियो और वेट ट्रेनिंग", desc: "Treadmills, cycles, machines and free weights on the floor.", descHi: "फ़्लोर पर ट्रेडमिल, साइकिल, मशीनें और फ़्री वेट।" },
      { en: "Trainer guidance", hi: "ट्रेनर की गाइडेंस", desc: "A trainer shows the right form and sets a routine for beginners.", descHi: "ट्रेनर सही तरीक़ा दिखाते हैं और शुरुआत करने वालों का रूटीन बनाते हैं।" },
      { en: "Zumba & aerobics batches", hi: "ज़ुम्बा और एरोबिक्स बैच", desc: "Group classes with music for fun and stamina.", descHi: "मज़े और स्टैमिना के लिए संगीत के साथ ग्रुप क्लास।" },
      { en: "Ladies' batch", hi: "लेडीज़ बैच", desc: "A separate comfortable time for women.", descHi: "महिलाओं के लिए अलग और आरामदेह समय।" },
      { en: "Strength & CrossFit training", hi: "स्ट्रेंथ और क्रॉसफ़िट ट्रेनिंग", desc: "Functional and strength workouts in a group or on your own.", descHi: "ग्रुप में या अकेले फ़ंक्शनल और स्ट्रेंथ वर्कआउट।" },
      { en: "Steam & sauna", hi: "स्टीम और सौना", desc: "Relaxation facility for members, where available.", descHi: "जहाँ उपलब्ध हो, सदस्यों के लिए आराम की सुविधा।" },
      { en: "Memberships & free trial", hi: "मेंबरशिप और फ़्री ट्रायल", desc: "Monthly and longer plans; come and try before you join.", descHi: "महीने और लंबी अवधि के प्लान; जुड़ने से पहले आकर देखें।" },
    ],
    avoid: ["yoga", "asana", "pranayama", "meditation", "home visit", "at your home", "online session", "one-to-one"],
  },
  "gym:fitness": {
    explain: [
      "personal fitness trainer — one-to-one training, weight loss and muscle-gain plans, diet guidance",
      "training at a gym, at your home or online, as per your goal and routine",
      "a plan made for your body and schedule, form corrected in every session",
      "first a talk about your goal, then a trial session",
    ],
    services: [
      { en: "One-to-one personal training", hi: "वन-टू-वन पर्सनल ट्रेनिंग", desc: "A trainer works with you alone, session by session.", descHi: "ट्रेनर सिर्फ़ आपके साथ, हर सेशन में।" },
      { en: "Weight loss programme", hi: "वज़न घटाने का प्रोग्राम", desc: "Workout and eating plan made around your daily routine.", descHi: "आपकी दिनचर्या के हिसाब से वर्कआउट और खान-पान की योजना।" },
      { en: "Muscle gain & strength plan", hi: "मसल गेन और स्ट्रेंथ प्लान", desc: "Step-by-step strength training with proper form.", descHi: "सही तरीक़े से कदम-दर-कदम स्ट्रेंथ ट्रेनिंग।" },
      { en: "Home & online sessions", hi: "घर पर और ऑनलाइन सेशन", desc: "Train at your home or on a video call, with simple equipment.", descHi: "सादे सामान के साथ आपके घर पर या वीडियो कॉल पर ट्रेनिंग।" },
      { en: "Diet guidance", hi: "डाइट गाइडेंस", desc: "Simple, home-food based eating advice to go with your training.", descHi: "ट्रेनिंग के साथ घर के खाने पर आधारित आसान खान-पान की सलाह।" },
      { en: "Beginner & senior training", hi: "शुरुआती और बुज़ुर्गों की ट्रेनिंग", desc: "A gentle start for people new to exercise or returning after a break.", descHi: "कसरत में नए या लंबे ब्रेक के बाद लौटने वालों के लिए हल्की शुरुआत।" },
    ],
    avoid: ["yoga", "asana", "pranayama", "meditation", "steam", "sauna", "membership", "zumba", "cardio floor", "hall", "machines"],
  },
  "gym:yoga": {
    explain: [
      "yoga centre — asana, pranayama, meditation, classes for all ages",
      "morning and evening batches, group and one-to-one, beginners welcome",
      "trained teacher, calm clean hall, each person guided at their own level",
      "join a trial class, then choose a batch",
    ],
    services: [
      { en: "Yoga classes", hi: "योग क्लास", desc: "Asanas taught step by step, for beginners and regular practitioners.", descHi: "शुरुआती और नियमित अभ्यास करने वालों के लिए आसन कदम-दर-कदम।" },
      { en: "Pranayama & breathing", hi: "प्राणायाम और श्वास अभ्यास", desc: "Breathing practices taught with care and patience.", descHi: "श्वास के अभ्यास ध्यान और धैर्य से सिखाए जाते हैं।" },
      { en: "Meditation", hi: "ध्यान", desc: "Guided sessions for a calm mind.", descHi: "मन की शांति के लिए गाइडेड सेशन।" },
      { en: "Ladies' batch", hi: "लेडीज़ बैच", desc: "A separate comfortable time for women.", descHi: "महिलाओं के लिए अलग और आरामदेह समय।" },
      { en: "Personal yoga sessions", hi: "पर्सनल योग सेशन", desc: "One-to-one attention at the centre or at your home.", descHi: "सेंटर पर या आपके घर पर अलग से ध्यान।" },
      { en: "Morning & evening batches", hi: "सुबह और शाम के बैच", desc: "Pick the time that suits your day.", descHi: "अपनी दिनचर्या के हिसाब से समय चुनें।" },
      { en: "Corporate & group sessions", hi: "ऑफ़िस और ग्रुप सेशन", desc: "Yoga for offices, societies and families.", descHi: "ऑफ़िस, सोसाइटी और परिवारों के लिए योग।" },
    ],
    avoid: ["gym", "weight", "machine", "treadmill", "dumbbell", "crossfit", "steam", "sauna", "protein", "personal training", "bodybuilding", "muscle", "zumba"],
  },

  // ---------------------------------------------------------------- tailor
  "tailor:tailor": {
    explain: [
      "tailor — stitching of ladies' suits, blouses, gents' shirts and pants, alterations, uniforms",
      "careful measurement, neat finish and delivery on the promised date",
      "your own cloth stitched to your fit; alterations of old clothes",
      "bring the cloth, take measurements, trial, then collect",
    ],
    services: [
      { en: "Ladies' suits & blouses", hi: "लेडीज़ सूट और ब्लाउज़", desc: "Stitched to your measurement, with the pattern and neckline you choose.", descHi: "आपके नाप से, आपकी पसंद के पैटर्न और गले के साथ सिला हुआ।" },
      { en: "Gents' shirts & pants", hi: "जेंट्स शर्ट और पैंट", desc: "Shirts, trousers and kurtas with a proper fit.", descHi: "सही फ़िटिंग वाली शर्ट, पैंट और कुर्ते।" },
      { en: "Bridal blouse & lehenga stitching", hi: "ब्राइडल ब्लाउज़ और लहंगा सिलाई", desc: "Careful stitching for weddings, with fittings before the final finish.", descHi: "शादी के लिए ध्यान से सिलाई, फ़ाइनल से पहले ट्रायल के साथ।" },
      { en: "Alterations", hi: "अल्टरेशन", desc: "Length, size and fit changes on clothes you already have.", descHi: "आपके पुराने कपड़ों की लंबाई, साइज़ और फ़िटिंग में बदलाव।" },
      { en: "Uniforms", hi: "यूनिफ़ॉर्म", desc: "School, office and shop uniforms stitched in quantity.", descHi: "स्कूल, ऑफ़िस और दुकान की यूनिफ़ॉर्म ज़्यादा संख्या में।" },
      { en: "Kids' clothes", hi: "बच्चों के कपड़े", desc: "Comfortable stitching for children's festival and daily wear.", descHi: "बच्चों के त्योहार और रोज़ के कपड़ों की आरामदेह सिलाई।" },
      { en: "Fall, piping & finishing", hi: "फ़ॉल, पाइपिंग और फ़िनिशिंग", desc: "Saree fall, lace, piping and other finishing work.", descHi: "साड़ी की फ़ॉल, लेस, पाइपिंग और दूसरा फ़िनिशिंग का काम।" },
    ],
    avoid: ["boutique", "designer", "ready-made", "readymade", "collection", "showroom", "couture", "lookbook", "fashion show", "custom design"],
  },
  "tailor:boutique": {
    explain: [
      "boutique — designer blouses, suits, lehenga and gowns, custom design, embroidery and handwork",
      "your idea or reference picture made into a design, fabric and trims chosen with you",
      "bridal and festive wear, fittings before the final finish",
      "talk about the occasion, design and fabric, then measurements and trials",
    ],
    services: [
      { en: "Designer blouses", hi: "डिज़ाइनर ब्लाउज़", desc: "Back designs, sleeves and handwork made to your idea.", descHi: "आपके आइडिया के हिसाब से बैक डिज़ाइन, बाजू और हैंडवर्क।" },
      { en: "Custom suits & gowns", hi: "कस्टम सूट और गाउन", desc: "Made-to-measure outfits for parties and functions.", descHi: "पार्टी और फ़ंक्शन के लिए नाप के हिसाब से बने कपड़े।" },
      { en: "Bridal lehenga", hi: "ब्राइडल लहंगा", desc: "Wedding wear designed with you and fitted before delivery.", descHi: "आपके साथ मिलकर बनाया शादी का जोड़ा, डिलीवरी से पहले ट्रायल।" },
      { en: "Embroidery & handwork", hi: "कढ़ाई और हैंडवर्क", desc: "Zari, beads, sequins and thread work on your outfit.", descHi: "आपके कपड़ों पर ज़री, मोती, सितारे और धागे का काम।" },
      { en: "Fabric & trims selection", hi: "कपड़ा और लेस का चुनाव", desc: "Help in choosing cloth, lace and buttons that go together.", descHi: "साथ जँचने वाला कपड़ा, लेस और बटन चुनने में मदद।" },
      { en: "Ready designer pieces", hi: "तैयार डिज़ाइनर कपड़े", desc: "A small collection to see and try in the shop.", descHi: "दुकान में देखने और पहनकर देखने के लिए छोटा कलेक्शन।" },
      { en: "Festive & occasion wear", hi: "त्योहार और मौक़े के कपड़े", desc: "Outfits for weddings, festivals and family functions.", descHi: "शादी, त्योहार और घर के फ़ंक्शन के कपड़े।" },
    ],
    avoid: ["alteration", "uniform", "school", "gents", "shirt", "trouser", "pants", "men's wear", "repair clothes"],
  },

  // ---------------------------------------------------------------- mehndi
  "mehndi:mehndi": {
    explain: [
      "mehndi artist — bridal, party and festival mehndi, Arabic, Rajasthani and simple designs",
      "natural henna cones, fine detailed work, designs chosen from pictures or your idea",
      "at your home or venue for weddings and functions, group bookings",
      "book the date early, share the design, get the stain care tips",
    ],
    services: [
      { en: "Bridal mehndi", hi: "ब्राइडल मेहंदी", desc: "Full hands and feet with fine detailed designs for the bride.", descHi: "दुल्हन के लिए पूरे हाथ-पैर पर बारीक डिज़ाइन।" },
      { en: "Party & festival mehndi", hi: "पार्टी और त्योहार की मेहंदी", desc: "Quick, pretty designs for Karwa Chauth, Teej, Eid and functions.", descHi: "करवा चौथ, तीज, ईद और फ़ंक्शन के लिए जल्दी बनने वाले सुंदर डिज़ाइन।" },
      { en: "Arabic & Rajasthani designs", hi: "अरबी और राजस्थानी डिज़ाइन", desc: "Choose from many styles, or bring your own picture.", descHi: "कई स्टाइल में से चुनें या अपनी तस्वीर लाएँ।" },
      { en: "Simple & kids' mehndi", hi: "सादी और बच्चों की मेहंदी", desc: "Small designs for children and for everyday wear.", descHi: "बच्चों और रोज़ के लिए छोटे डिज़ाइन।" },
      { en: "Group & wedding bookings", hi: "ग्रुप और शादी की बुकिंग", desc: "A team for sangeet and mehndi functions with many guests.", descHi: "संगीत और मेहंदी फ़ंक्शन में बहुत मेहमानों के लिए टीम।" },
      { en: "At your home or venue", hi: "आपके घर या वेन्यू पर", desc: "We come to you with everything needed.", descHi: "ज़रूरी सारा सामान लेकर हम आपके पास आते हैं।" },
    ],
    avoid: ["makeup", "make-up", "hair", "nail", "draping", "facial", "foundation", "lipstick", "eye look", "bridal look", "hairstyl"],
  },
  "mehndi:makeup": {
    explain: [
      "makeup artist — bridal, party and engagement makeup, hair styling, saree draping, nail art",
      "skin tone and outfit based look, good quality products, clean brushes and tools",
      "at your home or venue for weddings and functions, trial before the big day",
      "talk about the occasion and look, trial, then the final day",
    ],
    services: [
      { en: "Bridal makeup", hi: "ब्राइडल मेकअप", desc: "A look planned with you for the wedding day, with a trial before.", descHi: "शादी के दिन के लिए आपके साथ तय किया लुक, पहले ट्रायल के साथ।" },
      { en: "Party & engagement makeup", hi: "पार्टी और सगाई का मेकअप", desc: "Fresh looks for functions, engagements and receptions.", descHi: "फ़ंक्शन, सगाई और रिसेप्शन के लिए ताज़ा लुक।" },
      { en: "Hair styling", hi: "हेयर स्टाइलिंग", desc: "Buns, curls, braids and set styles to match the outfit.", descHi: "आउटफ़िट से मेल खाते जूड़े, कर्ल, चोटी और सेट स्टाइल।" },
      { en: "Saree draping", hi: "साड़ी ड्रेपिंग", desc: "Neat pleats and pinning in the style you like.", descHi: "आपकी पसंद के स्टाइल में सफ़ाई से प्लेट्स और पिनिंग।" },
      { en: "Nail art", hi: "नेल आर्ट", desc: "Nail colour and simple designs to go with your look.", descHi: "आपके लुक के साथ जँचता नेल कलर और सादे डिज़ाइन।" },
      { en: "Makeup trial", hi: "मेकअप ट्रायल", desc: "Try the look before the day and change what you want.", descHi: "दिन से पहले लुक आज़माएँ और जो चाहें बदलवाएँ।" },
      { en: "At your home or venue", hi: "आपके घर या वेन्यू पर", desc: "We reach on time with products and tools.", descHi: "प्रोडक्ट और औज़ार के साथ समय पर पहुँचते हैं।" },
    ],
    avoid: ["mehndi", "henna", "cone", "stain", "tattoo", "arabic design", "rajasthani", "hand design"],
  },
};
