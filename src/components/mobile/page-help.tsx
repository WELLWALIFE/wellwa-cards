"use client";
// "How to use this page" on every Mobile Shop screen — the same idea as Jewellery's (components/jewellery/page-help.tsx).
import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

type Help = { en: string; hi: string; steps: [string, string][] };
const HELP: Record<string, Help> = {
  home: { en: "Your mobile shop", hi: "आपकी मोबाइल दुकान", steps: [
    ["Selling? Tap New bill — search the item or scan it.", "बेच रहे हैं? नया बिल दबाएँ — item खोजें या scan करें।"],
    ["A phone came for repair? Tap New repair job.", "फ़ोन रिपेयर के लिए आया? नया रिपेयर job दबाएँ।"],
    ["New stock came? Tap Purchase and add what came.", "नया माल आया? ख़रीद दबाकर चढ़ाएँ।"],
    ["Items: add everything you sell once, with price.", "Items: जो भी बेचते हैं एक बार दाम के साथ जोड़ें।"],
    ["The top shows today's sale, cash and UPI apart, and udhaar.", "ऊपर आज की बिक्री, cash और UPI अलग, और उधार।"],
  ] },
  bill: { en: "New bill", hi: "नया बिल", steps: [
    ["Type the item's name, or the phone it fits (e.g. 'cover redmi 13'), or scan its barcode.", "item का नाम लिखें, या किस फ़ोन का है (जैसे 'cover redmi 13'), या barcode scan करें।"],
    ["Tap the item to add it. Change qty or price if needed.", "item दबाकर जोड़ें। ज़रूरत हो तो गिनती या दाम बदलें।"],
    ["A phone: scan its IMEI — it is added by itself.", "फ़ोन: IMEI scan करें — अपने-आप जुड़ जाएगा।"],
    ["Pick Cash / UPI / Card. Money left? Pick 'Part / udhaar' and type what came.", "Cash / UPI / Card चुनें। पैसा बाकी? 'कुछ / उधार' चुनकर जो मिला लिखें।"],
    ["Save & WhatsApp sends the bill to the customer's mobile.", "Save & WhatsApp से बिल ग्राहक के मोबाइल पर जाता है।"],
  ] },
  billView: { en: "The bill", hi: "बिल", steps: [
    ["Print: thermal slip or paper (set in Settings).", "Print: थर्मल पर्ची या काग़ज़ (Settings में तय)।"],
    ["Send on WhatsApp / Copy link for the customer.", "WhatsApp पर भेजें / ग्राहक के लिए लिंक कॉपी।"],
    ["Money left? Take payment when it comes.", "पैसा बाकी? आने पर Take payment।"],
    ["Mistake? Cancel with a reason — the stock comes back.", "गलती? वजह लिखकर रद्द करें — स्टॉक वापस आ जाएगा।"],
    ["Customer brought something back? Return items — type how many; the stock goes back and the bill stays as it was.", "ग्राहक कुछ वापस लाया? सामान वापसी — कितने पीस लिखें; स्टॉक वापस चढ़ता है और बिल जैसा था वैसा रहता है।"],
  ] },
  items: { en: "Items and stock", hi: "Items और स्टॉक", steps: [
    ["Add item: name, category, selling price. 'Fits' = the phones it is for.", "Item जोड़ें: नाम, category, बेचने का दाम। 'किस फ़ोन का' = जिन फ़ोन में लगता है।"],
    ["Opening stock: how many you have now.", "शुरुआती स्टॉक: अभी कितने हैं।"],
    ["Low stock at: the count at which it shows in the low list.", "कम स्टॉक: कितने बचने पर सूची में दिखे।"],
    ["A phone is sold by IMEI — add its IMEIs with Purchase.", "फ़ोन IMEI से बिकता है — IMEI ख़रीद से चढ़ाएँ।"],
  ] },
  purchase: { en: "Purchase (stock in)", hi: "ख़रीद (माल आया)", steps: [
    ["Supplier and their bill number (optional).", "सप्लायर और उनका बिल नंबर (optional)।"],
    ["Pick each item, type how many came and the cost of one.", "हर item चुनें, कितने आए और एक की लागत लिखें।"],
    ["Phones: scan every IMEI, one per line.", "फ़ोन: हर IMEI scan करें, एक line में एक।"],
    ["Save — the stock goes up.", "Save — स्टॉक बढ़ जाएगा।"],
  ] },
  repairNew: { en: "New repair job", hi: "नया रिपेयर job", steps: [
    ["Type the customer's mobile and the phone's model.", "ग्राहक का मोबाइल और फ़ोन का model लिखें।"],
    ["Tap what is wrong, and how the phone looks now (scratches, SIM inside…).", "क्या ख़राबी है और फ़ोन अभी कैसा है (खरोंच, SIM अंदर…) दबाएँ।"],
    ["Estimate and advance, if any. Pick the day it will be ready.", "अंदाज़न ख़र्च और advance, हो तो। कब तक तैयार होगा वो दिन चुनें।"],
    ["Save & WhatsApp: the customer gets the job number and a link to follow it. Then print the slip.", "Save & WhatsApp: ग्राहक को job नंबर और देखने का लिंक जाता है। फिर पर्ची print करें।"],
  ] },
  repairView: { en: "The repair job", hi: "रिपेयर job", steps: [
    ["Tap the step the phone is at: Being repaired → Waiting for part → Ready.", "फ़ोन जिस step पर है वो दबाएँ: काम चालू → पार्ट का इंतज़ार → तैयार।"],
    ["Parts used: search your items and tap — the stock reduces at once.", "लगे parts: अपने items खोजकर दबाएँ — स्टॉक तुरंत घटता है।"],
    ["Repair charge: your labour, apart from the parts.", "Repair charge: आपकी मज़दूरी, parts के अलावा।"],
    ["Ready: the customer gets a WhatsApp with the amount to pay.", "तैयार: ग्राहक को WhatsApp जाता है, देने वाली रक़म के साथ।"],
    ["Give the phone back & make the bill: the advance comes off by itself.", "फ़ोन दें और बिल बनाएँ: advance अपने-आप घट जाता है।"],
    ["Customer said no? Return unrepaired — the parts go back to stock.", "ग्राहक ने मना किया? बिना बने वापस — parts स्टॉक में लौट आते हैं।"],
  ] },
  repairs: { en: "Repair jobs", hi: "रिपेयर jobs", steps: [
    ["In the shop: every phone you have now. Ready: done but not collected. Late: past the promised day.", "दुकान में: अभी जो फ़ोन आपके पास हैं। तैयार: बन गए पर ले नहीं गए। देर: वादे का दिन निकल गया।"],
    ["Search by name, mobile, job number, model or IMEI.", "नाम, मोबाइल, job नंबर, model या IMEI से खोजें।"],
    ["Tap a job to open it.", "job खोलने के लिए उसे दबाएँ।"],
  ] },
  reports: { en: "Reports", hi: "रिपोर्ट", steps: [
    ["Pick the period: today, this month, or your own dates.", "अवधि चुनें: आज, ये महीना, या अपनी तारीख़ें।"],
    ["Sale is after returns. Money in is what really came — cash, UPI, card and EMI apart.", "बिक्री वापसी घटाकर है। आए पैसे = जो सच में आया — cash, UPI, card और EMI अलग।"],
    ["Send the summary to yourself or your partner on WhatsApp.", "सार खुद को या partner को WhatsApp पर भेजें।"],
    ["Download: files open in Excel. Give the sales register and HSN summary to your CA.", "डाउनलोड: फ़ाइलें Excel में खुलती हैं। बिक्री रजिस्टर और HSN सार अपने CA को दें।"],
  ] },
  stocktake: { en: "Count the stock", hi: "स्टॉक मिलान", steps: [
    ["Scan each piece on the shelf (one scan = one piece), or tap an item and type its count.", "shelf का हर पीस scan करें (एक scan = एक पीस), या item दबाकर गिनती लिखें।"],
    ["Phones: scan each IMEI. At the end you see which IMEIs were not found.", "फ़ोन: हर IMEI scan करें। आख़िर में दिखेगा कौन-से IMEI नहीं मिले।"],
    ["Your count stays on this phone until you finish — you can stop and come back.", "आपकी गिनती इसी फ़ोन में रहती है जब तक पूरा न करें — रुककर बाद में आ सकते हैं।"],
    ["Check the differences, download the list, then 'Set stock to my count'. Items you did not count are not changed.", "फ़र्क़ देखें, list डाउनलोड करें, फिर 'स्टॉक मेरी गिनती जितना करें'। जो item नहीं गिने वो नहीं बदलते।"],
  ] },
  labels: { en: "Barcode labels", hi: "Barcode label", steps: [
    ["Search an item and tap it. Type how many stickers you want.", "item खोजकर दबाएँ। कितने sticker चाहिए लिखें।"],
    ["No barcode on the item? Tap 'Give them a barcode' — we make one.", "item पर barcode नहीं? 'इन्हें barcode दें' दबाएँ — हम बना देते हैं।"],
    ["Print: 50×25 mm stickers. On the bill, scan the sticker and the item is added.", "Print: 50×25 mm sticker। बिल पर sticker scan करते ही item जुड़ जाता है।"],
  ] },
  settings: { en: "Settings", hi: "Settings", steps: [
    ["Shop name, address, phone — printed on every bill.", "दुकान का नाम, पता, फ़ोन — हर बिल पर छपते हैं।"],
    ["GST: switch on only if you have a GSTIN.", "GST: तभी चालू करें जब आपके पास GSTIN हो।"],
    ["Paper: your printer's size.", "Paper: आपके printer का साइज़।"],
  ] },
};

export function MsHelp({ k }: { k: string }) {
  const { lang } = useT(); const hi = lang !== "en";
  const [open, setOpen] = useState(false);
  const h = HELP[k];
  if (!h) return null;
  return (
    <div className="print:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink"><HelpCircle className="h-3.5 w-3.5" /> {hi ? "इस page को कैसे चलाएँ" : "How to use this page"}</button>
      {open && (
        <div className="mt-2 rounded-2xl border border-brand/30 bg-surface p-3 shadow-card">
          <div className="mb-1.5 flex items-center justify-between"><p className="text-sm font-bold">{hi ? h.hi : h.en}</p><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted"><X className="h-4 w-4" /></button></div>
          <ol className="space-y-1.5">{h.steps.map(([en, hh], i) => <li key={en} className="flex gap-2 text-[13px]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">{i + 1}</span><span>{hi ? hh : en}</span></li>)}</ol>
        </div>
      )}
    </div>
  );
}
