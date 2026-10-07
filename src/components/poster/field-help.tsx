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
  whatsapp: { t: "WhatsApp", th: "WhatsApp", en: "Untick only if your WhatsApp is on a different number. The card's WhatsApp button opens that number.", hi: "सिर्फ़ तब untick करें जब WhatsApp दूसरे number पर हो। Card का WhatsApp button उसी number पर खुलेगा।" },
  email: { t: "Email", th: "Email", en: "Customers can email you from your card. Leave it if you do not use email.", hi: "Customers card से आपको email कर सकेंगे। Email नहीं चलाते तो छोड़ दें।" },
  photo: { t: "Your photo", th: "आपकी photo", en: "A clear photo of your face. It shows on your card and daily posters. Optional, but people trust a face.", hi: "आपके चेहरे की साफ़ photo। Card और रोज़ के poster पर दिखेगी। Optional है, पर चेहरे पर भरोसा बढ़ता है।" },
  // ---- card for ----
  promote: { t: "What is the card for?", th: "Card किस काम के लिए?", en: "Both: your own business and a separate Shubhora page. Only my business: just your shop or work. Only Shubhora: you sell Shubhora as a partner.", hi: "दोनों: आपका business और एक अलग Shubhora page। सिर्फ़ मेरा business: बस आपकी दुकान या काम। सिर्फ़ Shubhora: आप partner बनकर Shubhora बेचते हैं।" },
  // ---- website ----
  site: { t: "Website", th: "Website", en: "Own website: we read your name, logo and products from it. Brand's website: only their products come, for a dealer. Reference website: any website of a business like yours, so the AI understands what you sell or do.", hi: "अपनी website: नाम, logo, products उसी से आ जाएँगे। Brand की website: dealer के लिए सिर्फ़ उनके products आएँगे। Reference website: आपके जैसे किसी business की website, जिससे AI समझे आप क्या बेचते / करते हैं।" },
  siteLink: { t: "Website link", th: "Website का link", en: "Paste the link, like sharmasweets.com. Or just type the name and we find it.", hi: "Link डालें, जैसे sharmasweets.com। या सिर्फ़ नाम लिखें, हम ढूँढ लेंगे।" },
  // ---- your business ----
  bizName: { t: "Business name", th: "Business का नाम", en: "The name on your board. It becomes the title of your website and card.", hi: "आपके board पर जो नाम है। यही website और card का title बनेगा।" },
  trade: { t: "What do you do?", th: "आप क्या काम करते हैं?", en: "Pick your line of work from the list. If it is not there, type it in your words. The website, card and posters are made for this work.", hi: "List से अपना काम चुनें। न हो तो अपने शब्दों में लिखें। Website, card और poster इसी काम के लिए बनेंगे।" },
  role: { t: "Card type", th: "Card का प्रकार", en: "Shop / Business: the business name leads. Professional: your own name leads, like a doctor or CA. Agent: your name with the company. Personal: no business.", hi: "दुकान / Business: business का नाम आगे। Professional: आपका नाम आगे, जैसे doctor या CA। Agent: आपका नाम company के साथ। Personal: कोई business नहीं।" },
  link: { t: "Card link", th: "Card का link", en: "The address of your card and website. Pick the business name or your own name. You can change it later.", hi: "आपके card और website का address। Business का नाम या अपना नाम चुनें। बाद में बदल सकते हैं।" },
  // ---- highlights ----
  special: { t: "What makes you special", th: "आपकी खासियत", en: "Tap 3 to 5 things that are true about you. They show as highlights on your website.", hi: "3 से 5 बातें दबाएँ जो आप पर सही हैं। यही website पर highlights बनकर दिखेंगी।" },
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
  about: { t: "About", th: "परिचय", en: "A few lines about your business. Write a little, then tap Write with AI and it writes it properly. The card, website and customer replies use this.", hi: "अपने business के बारे में कुछ लाइनें। थोड़ा लिखें, फिर AI से लिखवाएँ दबाएँ, वो ठीक से लिख देगा। Card, website और customer के जवाब इसी से बनते हैं।" },
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
  price: { t: "Price", th: "दाम", en: "What the customer pays. MRP is optional: when it is higher, the card shows it struck out with the discount.", hi: "Customer जो देता है। MRP optional है: ज़्यादा हो तो card पर कटा हुआ और discount दिखेगा।" },
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
