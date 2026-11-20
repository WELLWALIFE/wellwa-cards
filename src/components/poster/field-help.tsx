"use client";
// The small "?" beside a field (owner's call, 7 Oct 2026: "help wala ? sabhi field par laga do, click karne se pop up
// khule jisme us field ke baare me likha ho"). One tap opens a short sheet: what the field is, where the answer
// shows, what to write. Plain words, two or three lines, in the app's language. The texts live in HELP below so a
// field's help reads the same on every screen that asks it (set-up, My products, the build form).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleQuestionMark, X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

type Entry = { t: string; th: string; en: string; hi: string };

export const HELP = {
  // ---- about you ----
  name: { t: "Your name", th: "आपका नाम", en: "Your own name, as customers know you. It goes on your card, website and posters.", hi: "आपका अपना नाम, जैसे customers जानते हैं। यही card, website और poster पर जाएगा।" },
  phone: { t: "Mobile number", th: "Mobile number", en: "Customers call this number from your card and website. Write the 10 digits only.", hi: "Customers card और website से इसी number पर call करेंगे। सिर्फ़ 10 अंक लिखें।" },
  phone2: { t: "One more number", th: "एक और number", en: "A second number, like the shop's landline or a partner's mobile. It shows on your card as one more Call button. Leave it if you have only one.", hi: "दूसरा number, जैसे दुकान का landline या partner का mobile। Card पर एक और Call button बनकर दिखेगा। एक ही number है तो छोड़ दें।" },
  whatsapp: { t: "WhatsApp", th: "WhatsApp", en: "Untick only if your WhatsApp is on a different number. The card's WhatsApp button opens that number.", hi: "सिर्फ़ तब untick करें जब WhatsApp दूसरे number पर हो। Card का WhatsApp button उसी number पर खुलेगा।" },
  email: { t: "Email", th: "Email", en: "Customers can email you from your card. Leave it if you do not use email.", hi: "Customers card से आपको email कर सकेंगे। Email नहीं चलाते तो छोड़ दें।" },
  photo: { t: "Your photo", th: "आपकी photo", en: "A clear photo of your face. It shows on your card and daily posters. Optional, but people trust a face.", hi: "आपके चेहरे की साफ़ photo। Card और रोज़ के poster पर दिखेगी। Optional है, पर चेहरे पर भरोसा बढ़ता है।" },
  // ---- card for ----
  promote: { t: "What is the card for?", th: "Card किस काम के लिए?", en: "Both: your own business and a separate Shubhora page. Only my business: just your shop or work. Only Shubhora: you sell Shubhora as a partner.", hi: "दोनों: आपका business और एक अलग Shubhora page। सिर्फ़ मेरा business: बस आपकी दुकान या काम। सिर्फ़ Shubhora: आप partner बनकर Shubhora बेचते हैं।" },
  // ---- website ----
  site: { t: "Website", th: "Website", en: "Own website: we take your name, logo and products from it. Brand's website: for a dealer, only that brand's products come. Example website: a website you like. Your website follows its look, colours and style, and your line of work is guessed from it. Its products, photos and words are never copied: yours are used.", hi: "अपनी website: नाम, logo, products उसी से आ जाएँगे। Brand की website: dealer के लिए सिर्फ़ उसी brand के products आएँगे। Example website: कोई website जो आपको पसंद है। आपकी website उसका look, रंग और style अपनाती है, और आपका काम उसी से अंदाज़ा होता है। उसके products, photos और शब्द कभी copy नहीं होते: आपके अपने लगते हैं।" },
  siteLink: { t: "Website link", th: "Website का link", en: "Paste the link, like sharmasweets.com. Or just type the name and we find it.", hi: "Link डालें, जैसे sharmasweets.com। या सिर्फ़ नाम लिखें, हम ढूँढ लेंगे।" },
  // ---- your business ----
  bizName: { t: "Business name", th: "Business का नाम", en: "The name on your board. For a shop it is the title of your website and card. For a professional or agent your own name leads and this shows under it.", hi: "आपके board पर जो नाम है। दुकान के लिए यही website और card का title है। Professional या agent के लिए आपका नाम आगे रहता है, ये उसके नीचे दिखता है।" },
  trade: { t: "What do you do?", th: "आप क्या काम करते हैं?", en: "Pick your line of work from the list. If it is not there, type it in your words. The website, card and posters are made for this work.", hi: "List से अपना काम चुनें। न हो तो अपने शब्दों में लिखें। Website, card और poster इसी काम के लिए बनेंगे।" },
  subTrade: { t: "Sub-category", th: "Sub-category", en: "What exactly you do inside your line of work. Tick one or more. The services, words and pictures of your website are made for only what you tick.", hi: "अपने काम के अंदर आप ठीक-ठीक क्या करते हैं। एक या ज़्यादा दबाएँ। Website की services, शब्द और pictures सिर्फ़ उसी के लिए बनते हैं जो आप दबाते हैं।" },
  tradeQ: { t: "About your work", th: "आपके काम के बारे में", en: "Tap what is true for you. Not in the list? Use Write your own. These go on your website as what you offer. Skip what does not apply.", hi: "जो आप पर सही है वो दबाएँ। List में नहीं है? Write your own से लिखें। यही website पर आपकी सेवाएँ बनकर दिखता है। जो लागू नहीं, छोड़ दें।" },
  work: { t: "Your work", th: "आपका काम", en: "Two or three lines in your own words about what you do. The AI writes your website from this.", hi: "अपने काम के बारे में अपने शब्दों में 2-3 लाइन। AI इसी से आपकी website लिखता है।" },
  role: { t: "Card type", th: "Card का प्रकार", en: "Shop / Business: the business name leads. Professional: your own name leads, like a doctor or CA. Agent: your name with the company. Personal: no business.", hi: "दुकान / Business: business का नाम आगे। Professional: आपका नाम आगे, जैसे doctor या CA। Agent: आपका नाम company के साथ। Personal: कोई business नहीं।" },
  link: { t: "Card link", th: "Card का link", en: "The address of your card and website. Pick the business name or your own name. You can change it later.", hi: "आपके card और website का address। Business का नाम या अपना नाम चुनें। बाद में बदल सकते हैं।" },
  // ---- highlights ----
  special: { t: "What makes you special", th: "आपकी खासियत", en: "Tap 3 to 5 things that are true about you. They show as key points on your website.", hi: "3 से 5 बातें दबाएँ जो आप पर सही हैं। यही website पर ख़ास बातें बनकर दिखेंगी।" },
  customers: { t: "Your customers", th: "आपके customers", en: "Who buys from you. The website speaks to them.", hi: "आपसे कौन खरीदता है। Website उन्हीं से बात करेगी।" },
  offer: { t: "Offer", th: "Offer", en: "Any discount or deal running now. It shows on the card and website. Leave empty if none.", hi: "अभी कोई discount या deal चल रही हो तो लिखें। Card और website पर दिखेगी। नहीं है तो खाली छोड़ें।" },
  // ---- where & when ----
  city: { t: "City", th: "शहर", en: "The city where your shop or office is. Customers search by city, so it is needed.", hi: "जिस शहर में आपकी दुकान या office है। Customers शहर से खोजते हैं, इसलिए ज़रूरी है।" },
  address: { t: "Address", th: "पता", en: "Shop number, street and area. It shows on your card so customers can reach you.", hi: "दुकान नंबर, गली और इलाका। Card पर दिखेगा ताकि customers पहुँच सकें।" },
  map: { t: "Map pin", th: "Map pin", en: "Tap while standing at your shop. Your phone's location becomes the map pin on your card. Customers tap it to get directions.", hi: "दुकान पर खड़े होकर दबाएँ। Phone की location card पर map pin बन जाएगी। Customers उसे दबाकर रास्ता देखेंगे।" },
  reach: { t: "Where you serve", th: "आप कहाँ तक service देते हैं", en: "Local: your city and nearby. All India: you send by courier or work anywhere. Online: your work is on the internet.", hi: "Local: आपका शहर और आस-पास। पूरा भारत: courier से भेजते हैं या कहीं भी काम करते हैं। Online: काम internet पर है।" },
  hours: { t: "Timings", th: "समय", en: "When you are open. The website shows Open now or Closed from this.", hi: "आप कब खुले रहते हैं। Website इसी से Open now या Closed दिखाती है।" },
  delivery: { t: "Delivery / home visit", th: "Delivery / घर पर service", en: "Yes if you deliver or go to the customer's place. The website says so.", hi: "अगर आप delivery करते हैं या customer के यहाँ जाते हैं तो हाँ। Website पर यही लिखा जाएगा।" },
  // ---- about & logo ----
  about: { t: "About", th: "परिचय", en: "A few lines about your business. Write a little, then tap the AI button and it writes it properly. The card, website and customer replies use this.", hi: "अपने business के बारे में कुछ लाइनें। थोड़ा लिखें, फिर AI वाला button दबाएँ, वो ठीक से लिख देगा। Card, website और customer के जवाब इसी से बनते हैं।" },
  logo: { t: "Logo", th: "Logo", en: "Your logo, if you have one. It shows on the card, website and posters. No logo? Skip it, your name is used.", hi: "आपका logo, अगर है तो। Card, website और poster पर दिखेगा। नहीं है? छोड़ दें, नाम से काम चलेगा।" },
  designation: { t: "Your role", th: "आपका पद", en: "Owner, Doctor, Director and so on. It shows under your name.", hi: "Owner, Doctor, Director वगैरह। आपके नाम के नीचे दिखेगा।" },
  since: { t: "Since when", th: "कब से", en: "The year you started. Experience fills by itself from it. Team is how many people work with you.", hi: "जिस साल शुरू किया। Experience उससे अपने आप भर जाएगा। Team में बताएँ कितने लोग काम करते हैं।" },
  qualification: { t: "Degree / registration", th: "Degree / registration", en: "Your degree or registration number, like MBBS or Reg. no. It builds trust on the card.", hi: "आपकी degree या registration number, जैसे MBBS या Reg. no.। Card पर भरोसा बढ़ाता है।" },
  gst: { t: "GST number", th: "GST number", en: "15 characters, like 07ABCDE1234F1Z5. Only if you have one. It shows on the website for business customers.", hi: "15 अक्षर, जैसे 07ABCDE1234F1Z5। सिर्फ़ अगर है तो। Business customers के लिए website पर दिखेगा।" },
  // ---- photos & more ----
  photos: { t: "Banner and photos", th: "Banner और photos", en: "The banner is the wide picture on top of your website. The photos make the gallery. No photos? Ready pictures of your trade are used, and you can change them any time.", hi: "Banner website के ऊपर की चौड़ी photo है। बाकी photos से gallery बनती है। Photos नहीं हैं? आपके काम की तैयार pictures लगेंगी, कभी भी बदल सकते हैं।" },
  payments: { t: "Payments", th: "Payment", en: "How customers can pay you. With UPI, your UPI ID makes a Pay button on the card. No bank details are asked.", hi: "Customers आपको कैसे pay कर सकते हैं। UPI चुनने पर UPI ID से card पर Pay button बनता है। Bank details नहीं पूछी जातीं।" },
  social: { t: "Social media", th: "Social media", en: "Paste the links you have. They become Follow buttons on the card and website.", hi: "जो links हैं, paste करें। Card और website पर Follow button बन जाएँगे।" },
  // ---- products ----
  product: { t: "Product / service", th: "Product / service", en: "One thing you sell or do, with a photo, name and price. Each one shows on your card, website and daily posters.", hi: "एक चीज़ जो आप बेचते या करते हैं, photo, नाम और दाम के साथ। हर एक card, website और रोज़ के poster पर दिखेगी।" },
  productPhoto: { t: "Product photo", th: "Product की photo", en: "A clear photo of this item. It shows on the card, website and posters.", hi: "इस चीज़ की साफ़ photo। Card, website और poster पर दिखेगी।" },
  price: { t: "Price", th: "दाम", en: "What the customer pays. MRP is optional: when it is higher, the card shows it struck out with the discount.", hi: "Customer जो देता है। MRP optional है: ज़्यादा हो तो card पर कटा हुआ और discount दिखेगा।" },
  // ---- AI Training (20 Nov 2026: a "?" on every setting — what it is and how to set it) ----
  aiQuick: { t: "Quick setup", th: "जल्दी setup", en: "The five things most owners set: AI on/off, language, what the AI may do, and prices. You can skip it — the AI already answers from your card. Tap a choice, then press Save.", hi: "ज़्यादातर लोग यही पाँच चीज़ें set करते हैं: AI चालू/बंद, भाषा, AI क्या-क्या करे, और दाम। छोड़ भी सकते हैं — AI आपके card से पहले ही जवाब देता है। Choice पर tap करें, फिर Save दबाएँ।" },
  aiOnOff: { t: "AI on / off", th: "AI चालू / बंद", en: "On: the AI answers your customers on WhatsApp. Off: nothing is sent, but every message is still saved in Customers. Needs WhatsApp linked (section 3).", hi: "चालू: AI WhatsApp पर customers को जवाब देता है। बंद: कुछ नहीं जाता, पर हर message Customers में save होता रहता है। इसके लिए WhatsApp जुड़ा होना चाहिए (section 3)।" },
  aiLang: { t: "Language", th: "भाषा", en: "The language the AI answers in. Hindi for everyone is the default. If a customer asks for another language (\"English mein batao\"), the AI switches for them anyway.", hi: "AI किस भाषा में जवाब दे। Default: सबसे हिंदी में। Customer कोई और भाषा माँगे (\"English mein batao\"), तो AI उसके लिए वही भाषा बोलेगा।" },
  aiTasks: { t: "What the AI may do", th: "AI क्या-क्या करे", en: "On: the AI takes orders, bookings (day and time) and call-back requests itself, and each goes to your Customers list. Off: when a customer wants that, the AI gives your number and says you will handle it.", hi: "चालू: AI खुद order, booking (दिन और समय के साथ) और call-back ले लेता है, और हर एक आपकी Customers list में जाता है। बंद: customer ऐसा चाहे, तो AI आपका number देकर कहता है कि आप खुद देखेंगे।" },
  aiPrice: { t: "Prices", th: "दाम", en: "Tell: the AI says the price written on your card. Never tell: it gives no price, asks for the requirement and says you will quote. Use it when your prices change often.", hi: "बताए: AI card पर लिखा दाम बताता है। न बताए: AI दाम नहीं बताता, customer की ज़रूरत पूछकर कहता है कि आप खुद दाम बताएँगे। दाम बार-बार बदलते हों तो यह चुनें।" },
  aiKnows: { t: "What your AI knows", th: "AI क्या जानता है", en: "The AI already knows everything on your card and website: products, prices, timings, address. Here you add more in your own words, common questions, and files it can send.", hi: "AI को आपके card और website की सारी बातें पहले से पता हैं: products, दाम, समय, पता। यहाँ आप अपने शब्दों में और जानकारी, आम सवाल-जवाब, और भेजने वाली files जोड़ते हैं।" },
  aiQA: { t: "Questions and answers", th: "सवाल-जवाब", en: "Tap a ready question (or write your own), write its answer, tap \"Add it above\", then press Save. Next time a customer asks, the AI gives your answer.", hi: "कोई तैयार सवाल tap करें (या अपना लिखें), उसका जवाब लिखें, \"ऊपर जोड़ें\" दबाएँ, फिर Save दबाएँ। अगली बार customer पूछेगा तो AI आपका जवाब देगा।" },
  aiWhatsapp: { t: "Link WhatsApp", th: "WhatsApp जोड़ें", en: "Link the number your customers message. Open it, scan the QR from WhatsApp → Linked devices (like WhatsApp Web). Your phone keeps working as before.", hi: "वह number जोड़ें जिस पर customers message करते हैं। खोलें, और WhatsApp → Linked devices से QR scan करें (WhatsApp Web की तरह)। आपका phone पहले जैसा चलता रहेगा।" },
  aiWho: { t: "Who the AI answers", th: "AI किसे जवाब दे", en: "On a personal number, keep family and friends away from the AI. Best: a separate business number. Otherwise use \"only new numbers\" and the personal list.", hi: "Personal number पर परिवार और दोस्तों को AI से दूर रखें। सबसे अच्छा: business का अलग number। नहीं तो \"सिर्फ़ नए number\" और personal list इस्तेमाल करें।" },
  aiOnlyNew: { t: "Only new numbers", th: "सिर्फ़ नए number", en: "On: anyone you already chatted with before linking WhatsApp gets no AI reply — you answer them. New people and anyone from an ad are answered. Off: the AI guesses from each message.", hi: "चालू: WhatsApp जोड़ने से पहले जिनसे chat थी, उन्हें AI जवाब नहीं देगा — आप देंगे। नए लोगों और ad से आए लोगों को जवाब मिलेगा। बंद: AI हर message देखकर अंदाज़ा लगाता है।" },
  aiPersonal: { t: "Personal numbers", th: "Personal numbers", en: "Type a 10-digit number and tap Add. The AI never replies to it and it never shows in Customers. Tap × to take it off.", hi: "10 अंकों का number लिखकर जोड़ें दबाएँ। AI उसे कभी जवाब नहीं देगा और वह Customers में नहीं दिखेगा। हटाने के लिए × दबाएँ।" },
  aiMessages: { t: "AI's messages", th: "AI के messages", en: "What a new customer gets on WhatsApp, one after another: the first message, then up to three more on the days you pick if they do not reply, then a small weekly one. All optional — press Save after a change.", hi: "नए customer को WhatsApp पर एक के बाद एक क्या जाए: पहला message, फिर जवाब न आए तो आपके चुने दिनों पर तीन और, फिर हफ़्ते में एक छोटा। सब ज़रूरी नहीं — बदलने के बाद Save दबाएँ।" },
  aiFirst: { t: "First message", th: "पहला message", en: "AI writes it: a greeting and the answer. My own message: your words go first, then the AI answers the question. Numbered menu: the customer gets 1, 2, 3… and replies with a number. {naam} becomes the customer's name.", hi: "AI खुद लिखे: नमस्ते और जवाब। मेरा message: पहले आपके शब्द, फिर AI सवाल का जवाब देगा। Number वाला menu: customer को 1, 2, 3… जाता है, वह number लिखकर जवाब देता है। {naam} की जगह customer का नाम आ जाता है।" },
  aiFollow: { t: "The next messages", th: "अगले messages", en: "Each one goes only if the customer has not replied. Pick the days, let the AI write it or write your own, add a photo if you like. Switch one off to skip it. \"Test on my WhatsApp\" sends it to you only.", hi: "हर message तभी जाता है जब customer ने जवाब न दिया हो। दिन चुनें, AI को लिखने दें या खुद लिखें, चाहें तो photo लगाएँ। बंद करें तो वह नहीं जाएगा। \"मेरे WhatsApp पर test\" सिर्फ़ आपको भेजता है।" },
  aiHours: { t: "Rules and timings", th: "नियम और समय", en: "Messages from the AI (follow-ups) go only between these hours. A customer who writes \"stop\" gets nothing more; one who replies starts the line again.", hi: "AI के follow-up messages सिर्फ़ इसी समय के बीच जाते हैं। जो customer \"stop\" लिखे, उसे आगे कुछ नहीं जाता; जो जवाब दे, उसकी line फिर से शुरू होती है।" },
  aiTone: { t: "How your AI talks", th: "AI कैसे बात करे", en: "Tap the ways you want (friendly, short replies…) or write in your own words, e.g. \"call every customer ji\". Press Save.", hi: "जैसे बात करवानी हो, वो tap करें (दोस्ताना, छोटे जवाब…) या अपने शब्दों में लिखें, जैसे \"हर customer को जी कहकर बात करो\"। Save दबाएँ।" },
  aiMore: { t: "More settings", th: "और settings", en: "Optional rules: the AI's name, what to ask a new customer, when to call you, discount on bargaining, payment ways, what never to say, and a night line. Set what you need, press Save.", hi: "ज़रूरी नहीं वाले नियम: AI का नाम, नए customer से क्या पूछे, कब आपको बुलाए, मोल-भाव पर छूट, payment के तरीक़े, क्या कभी न कहे, और रात की line। जो चाहिए वो set करें, Save दबाएँ।" },
  aiAsk: { t: "Find out from a customer", th: "Customer से पूछे", en: "Tick what the AI should learn (name, city, budget, when). It asks one at a time, when it fits — never all at once. The answers go into Customers.", hi: "Tick करें कि AI क्या जाने (नाम, शहर, budget, कब)। AI एक-एक करके, सही मौक़े पर पूछता है — सब एक साथ नहीं। जवाब Customers में जाते हैं।" },
  aiAlert: { t: "When to call you", th: "AI आपको कब बुलाए", en: "The AI always sends you a WhatsApp alert when a customer wants to buy now, books, complains or asks for you. Tick to also get one for big orders or every new enquiry.", hi: "AI आपको हमेशा WhatsApp पर alert भेजता है जब customer अभी ख़रीदना चाहे, booking करे, शिकायत करे या आपसे बात करना चाहे। बड़े order या हर नई enquiry पर भी चाहिए तो tick करें।" },
  aiDiscount: { t: "Discount", th: "छूट", en: "Never: the AI promises no discount that is not on your card. Up to X%: if a customer bargains, it may offer up to that — starting lower, never unasked.", hi: "कभी नहीं: card पर न लिखी छूट का AI वादा नहीं करता। X% तक: customer मोल-भाव करे, तो AI उतनी तक छूट दे सकता है — कम से शुरू करके, बिना माँगे नहीं।" },
  aiNever: { t: "Never say", th: "कभी न कहे", en: "Write anything the AI must never say or promise, e.g. \"no same-day delivery promise\".", hi: "जो बात AI कभी न कहे या वादा न करे, वो लिखें, जैसे \"उसी दिन delivery का वादा नहीं\"।" },
  aiNight: { t: "At night", th: "रात को", en: "On: outside your message hours, customers get this one line and the AI waits till morning. Off: the AI answers day and night.", hi: "चालू: आपके message के समय के बाहर customer को यही एक line जाती है और AI सुबह तक रुकता है। बंद: AI दिन-रात जवाब देता है।" },
  aiAway: { t: "Shop closed / on leave", th: "दुकान बंद / छुट्टी", en: "Switch on, write your line, press Save. Each customer gets it once (not again for 12 hours), the enquiry is saved, the AI waits. Pick a date and it turns off by itself.", hi: "चालू करें, अपनी line लिखें, Save दबाएँ। हर customer को एक बार जाती है (12 घंटे तक दोबारा नहीं), enquiry save होती है, AI रुका रहता है। तारीख़ चुनें तो उसके बाद अपने-आप बंद।" },
  aiReport: { t: "Report", th: "Report", en: "The last 7 days on WhatsApp: messages in, AI replies, follow-ups, and how often it called you. Below: the chats where the AI called you — write an answer once and the AI knows it next time.", hi: "WhatsApp पर पिछले 7 दिन: कितने message आए, AI के जवाब, follow-up, और कितनी बार आपको बुलाया। नीचे: वे chat जहाँ AI ने आपको बुलाया — जवाब एक बार लिखें, अगली बार AI खुद बताएगा।" },
  aiChat: { t: "Talk to your AI", th: "AI से बात करके देखें", en: "Ask a question as a customer would — the chat button at the bottom right. It is the same AI that answers on WhatsApp, with your settings.", hi: "Customer की तरह सवाल पूछें — नीचे दाएँ कोने का chat button। यह वही AI है जो WhatsApp पर जवाब देता है, आपकी settings के साथ।" },
} satisfies Record<string, Entry>;
export type HelpKey = keyof typeof HELP;

/** The "?" beside a label. `k` is a HELP key. */
export function Help({ k, className = "" }: { k: HelpKey; className?: string }) {
  const { lang } = useT();
  const hi = lang !== "en";
  const [open, setOpen] = useState(false);
  const e: Entry = HELP[k];
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!e) return null;
  return (
    <>
      <button type="button" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setOpen(true); }} aria-label={hi ? `${e.th} — मदद` : `${e.t} — help`}
        className={`ml-1.5 inline-grid h-5 w-5 shrink-0 translate-y-[1px] place-items-center rounded-full border border-brand/40 bg-brand-soft/60 align-middle text-brand-ink ${className}`}>
        <CircleQuestionMark className="h-3.5 w-3.5" />
      </button>
      {/* Through a portal: the "?" sits inside labels and <p>s, where a sheet's <div> may not live. */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-surface p-4 shadow-float" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-bold">{hi ? e.th : e.t}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={hi ? "बंद करें" : "Close"} className="rounded-full border border-border p-1 text-muted"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">{hi ? e.hi : e.en}</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-xl grad-brand py-3 text-sm font-semibold text-white">{hi ? "समझ गया" : "Got it"}</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
