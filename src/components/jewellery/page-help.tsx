"use client";
// "Is page ko kaise chalayein" — the "?" at the top of every Jewellery screen (owner, 23 Nov 2026: "har jagah ? ke icon par support
// likho simple words me"). One tap opens the few steps of that screen in plain words; the field "?" (jw-tip.tsx) covers each box.
import { useState } from "react";
import Link from "next/link";
import { HelpCircle, X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

type Help = { en: string; hi: string; steps: [string, string][] };
const HELP: Record<string, Help> = {
  home: { en: "Your jewellery shop", hi: "आपकी ज्वेलरी दुकान", steps: [
    ["Every morning set today's rate (the yellow box).", "हर सुबह आज का रेट डालें (पीला डिब्बा)।"],
    ["Selling? Tap New bill. Only giving a price? Tap Estimate.", "बेच रहे हैं? नया बिल दबाएँ। सिर्फ़ दाम बताना है? Estimate दबाएँ।"],
    ["Orders, karigar, stock, reports — each tile opens its screen.", "ऑर्डर, कारीगर, स्टॉक, रिपोर्ट — हर डिब्बा अपनी screen खोलता है।"],
    ["First time? Open Settings and fill your shop details.", "पहली बार? Settings खोलकर दुकान की जानकारी भरें।"],
  ] },
  rate: { en: "Today's rate", hi: "आज का रेट", steps: [
    ["Type the 24K rate for 10 grams, and silver.", "24K और चाँदी का 10 ग्राम का रेट लिखें।"],
    ["Leave 22K / 18K empty — they are worked out. Type them only if your rate is different.", "22K / 18K खाली छोड़ें — अपने-आप बनेंगे। आपका रेट अलग हो तभी लिखें।"],
    ["Tap Save. Every new bill uses this rate.", "Save दबाएँ। हर नया बिल इसी रेट से बनेगा।"],
    ["Rate poster: a picture for WhatsApp status. Share on WhatsApp: the rate as a message.", "रेट पोस्टर: WhatsApp status के लिए फ़ोटो। WhatsApp पर भेजें: रेट message में।"],
  ] },
  bill: { en: "New bill", hi: "नया बिल", steps: [
    ["Type the customer's name and mobile (the bill goes to this WhatsApp).", "ग्राहक का नाम और मोबाइल लिखें (बिल इसी WhatsApp पर जाएगा)।"],
    ["Piece has a tag? Scan or type it — everything fills. Else pick item, purity and type the weight.", "पीस पर टैग है? scan करें या लिखें — सब भर जाएगा। नहीं तो item, purity चुनें और वज़न लिखें।"],
    ["Customer gave old gold? Old gold → Add, type its weight and touch.", "ग्राहक ने पुराना सोना दिया? Old gold → Add, वज़न और touch लिखें।"],
    ["Type the money received (cash / UPI…). Left money becomes udhaar.", "मिला पैसा लिखें (cash / UPI…)। बचा पैसा उधार बनेगा।"],
    ["Check the total at the bottom, then Save & WhatsApp.", "नीचे कुल देखें, फिर Save & WhatsApp दबाएँ।"],
  ] },
  billView: { en: "The bill", hi: "बिल", steps: [
    ["Send on WhatsApp: the customer gets the bill link.", "WhatsApp पर भेजें: ग्राहक को बिल का लिंक जाएगा।"],
    ["Copy link: send it yourself anywhere.", "लिंक कॉपी: कहीं भी खुद भेजें।"],
    ["Print / PDF: print it or save as PDF.", "Print / PDF: छापें या PDF में save करें।"],
    ["Money left? Type it in Take payment when it comes.", "पैसा बाकी? जब आए, Take payment में लिखें।"],
    ["Mistake? Cancel with a reason — a bill is never deleted.", "गलती? वजह लिखकर रद्द करें — बिल कभी delete नहीं होता।"],
  ] },
  bills: { en: "All bills", hi: "सारे बिल", steps: [
    ["Search by name, mobile or bill number.", "नाम, मोबाइल या बिल नंबर से खोजें।"],
    ["Estimates: prices given; open one to make it a bill.", "Estimates: दिए दाम; खोलकर बिल बनाएँ।"],
    ["Money due: who owes you, and how much.", "Money due: किस पर कितना बाकी।"],
  ] },
  orders: { en: "Orders & repairs", hi: "ऑर्डर और रिपेयर", steps: [
    ["New order: a piece to be made. New repair: the customer's piece to be mended.", "नया ऑर्डर: बनवाना है। नया रिपेयर: ग्राहक का पीस ठीक करना है।"],
    ["In the shop / Late / Ready / Delivered — tap a tab to see those.", "दुकान में / देर / तैयार / दिए — tab दबाकर देखें।"],
    ["Open an order to give it to a karigar, mark ready, or deliver.", "ऑर्डर खोलकर कारीगर को दें, तैयार करें या दें।"],
  ] },
  orderNew: { en: "Book an order / repair", hi: "ऑर्डर / रिपेयर बुक करें", steps: [
    ["Customer's name and mobile.", "ग्राहक का नाम और मोबाइल।"],
    ["Item, purity, approx weight, size, design (repair: the work to do).", "Item, purity, अंदाज़ वज़न, साइज़, डिज़ाइन (रिपेयर: क्या काम करना है)।"],
    ["Estimate, delivery date, advance. Tick 'Lock today's rate' if promised.", "अनुमान, देने की तारीख़, एडवांस। रेट का वादा किया हो तो 'Lock today's rate' दबाएँ।"],
    ["Save & WhatsApp: the customer gets the receipt.", "Save & WhatsApp: ग्राहक को रसीद जाएगी।"],
  ] },
  orderView: { en: "One order", hi: "एक ऑर्डर", steps: [
    ["Pick the karigar and Save when you hand it over.", "कारीगर को देते समय उसे चुनकर Save करें।"],
    ["Mark ready — tick WhatsApp to tell the customer.", "तैयार करें — ग्राहक को बताने के लिए WhatsApp tick रखें।"],
    ["Order: 'Make the bill and deliver' (advance is counted). Repair: take the charge and Delivered.", "ऑर्डर: 'बिल बनाएँ और दें' (एडवांस घटेगा)। रिपेयर: चार्ज लेकर Delivered।"],
  ] },
  karigars: { en: "Karigars", hi: "कारीगर", steps: [
    ["Add each karigar once (name, mobile, work).", "हर कारीगर एक बार जोड़ें (नाम, मोबाइल, काम)।"],
    ["Tap a karigar to write gold given, work received, labour and money paid.", "कारीगर दबाकर सोना दिया, माल आया, मज़दूरी और पैसे दिए लिखें।"],
    ["The top shows fine gold with karigars and labour to pay.", "ऊपर दिखता है कारीगरों के पास कितना fine सोना और कितनी मज़दूरी बाकी।"],
  ] },
  karigar: { en: "Karigar's ledger", hi: "कारीगर का खाता", steps: [
    ["Gold given: weight and touch — fine weight is worked out.", "सोना दिया: वज़न और touch — fine वज़न अपने-आप।"],
    ["Work received: weight, touch, and wastage you allow.", "माल आया: वज़न, touch, और जितना घटत मानते हैं।"],
    ["Labour (majdoori) and Money paid: rupees.", "मज़दूरी और पैसे दिए: रुपये में।"],
    ["Wrong entry? Tap 'wrong?' and write why — it is struck off, never deleted.", "गलत एंट्री? 'wrong?' दबाकर वजह लिखें — कट जाएगी, delete नहीं।"],
  ] },
  stock: { en: "Stock", hi: "स्टॉक", steps: [
    ["Add stock: every piece gets a tag number.", "स्टॉक चढ़ाएँ: हर पीस को टैग नंबर मिलेगा।"],
    ["Tick pieces and Print labels to print their barcode tags.", "पीस tick करके लेबल छापें — बारकोड टैग छपेंगे।"],
    ["Search by tag or HUID. Tabs show in stock / on approval / sold.", "टैग या HUID से खोजें। tab में स्टॉक / पसंद पर / बिके।"],
    ["A piece sold on a bill leaves stock by itself.", "बिल में बिका पीस अपने-आप स्टॉक से हटता है।"],
  ] },
  stockNew: { en: "Add stock", hi: "स्टॉक चढ़ाएँ", steps: [
    ["Pick the item and purity, type gross and stone weight.", "item और purity चुनें, कुल और नग का वज़न लिखें।"],
    ["HUID from the hallmark, size if any. Add a photo for the website.", "हॉलमार्क से HUID, साइज़ हो तो। वेबसाइट के लिए फ़ोटो जोड़ें।"],
    ["Save and add the next — item and purity stay, weights clear.", "Save करें और अगला — item और purity वही रहते हैं, वज़न खाली।"],
    ["Print their labels from the list below.", "नीचे की सूची से इनके लेबल छापें।"],
  ] },
  stockPiece: { en: "One piece", hi: "एक पीस", steps: [
    ["Print label: its barcode tag again.", "लेबल छापें: इसका बारकोड टैग दोबारा।"],
    ["Edit: change weight, HUID, photo (not after it is sold).", "बदलें: वज़न, HUID, फ़ोटो (बिकने के बाद नहीं)।"],
    ["Move: on approval (write to whom), melted, returned — or back in stock.", "पसंद पर दिया (किसे, लिखें), गलाया, वापस — या फिर से स्टॉक में।"],
  ] },
  labels: { en: "Print labels", hi: "लेबल छापें", steps: [
    ["Pick the size: jewellery tag (95 × 12 mm) or sticker (50 × 25 mm).", "साइज़ चुनें: ज्वेलरी टैग (95 × 12 mm) या स्टिकर (50 × 25 mm)।"],
    ["Tap Print. In the print box choose your label printer and scale 100%.", "Print दबाएँ। print box में label printer चुनें, scale 100%।"],
    ["Try one label first, then print all.", "पहले एक लेबल छापकर देखें, फिर सब।"],
  ] },
  reports: { en: "Reports", hi: "रिपोर्ट", steps: [
    ["Pick the days: today, yesterday, month, or your dates.", "दिन चुनें: आज, कल, महीना, या अपनी तारीख़।"],
    ["Day close: sale, GST, money by cash / UPI — send it to yourself on WhatsApp every evening.", "डे क्लोज़: बिक्री, GST, cash / UPI पैसे — हर शाम खुद को WhatsApp करें।"],
    ["Download the sales register / HSN for your CA (opens in Excel).", "CA के लिए बिक्री रजिस्टर / HSN डाउनलोड करें (Excel में खुलता है)।"],
  ] },
  settings: { en: "Settings", hi: "Settings", steps: [
    ["Fill your shop name, address, phone, GSTIN — they print on every bill.", "दुकान का नाम, पता, फ़ोन, GSTIN भरें — हर बिल पर छपते हैं।"],
    ["Purities you sell, and the making / wastage of each item.", "कौन-सी purity बेचते हैं, और हर item की मेकिंग / वेस्टेज।"],
    ["Staff rights: what each staff login may do.", "Staff के अधिकार: हर staff login क्या कर सकता है।"],
    ["Tap Save settings at the bottom.", "नीचे Save settings दबाएँ।"],
  ] },
  schemes: { en: "Gold scheme", hi: "गोल्ड स्कीम", steps: [
    ["New member: pick the plan, name, mobile, first instalment.", "नया मेंबर: प्लान, नाम, मोबाइल, पहली किस्त।"],
    ["Running / Used on bill / Closed — tabs show each.", "चालू / बिल में लगी / बंद — tab में देखें।"],
    ["Red 'behind' = instalments not paid on time.", "लाल 'बाकी' = समय पर किस्त नहीं आई।"],
  ] },
  scheme: { en: "One member", hi: "एक मेंबर", steps: [
    ["Take an instalment every month; tick WhatsApp to send the passbook.", "हर महीने किस्त लें; पासबुक भेजने को WhatsApp tick रखें।"],
    ["All paid and matured: Use on a bill — deposits and bonus come off.", "सब जमा और समय पूरा: बिल में लगाएँ — जमा और बोनस घटेंगे।"],
    ["Close early only with a note of how the money was settled.", "बीच में बंद सिर्फ़ इस नोट के साथ कि पैसा कैसे निपटाया।"],
  ] },
  girvi: { en: "Girvi", hi: "गिरवी", steps: [
    ["New loan: borrower, pieces with weight and touch, valuation, loan.", "नया लोन: ग्राहक, सामान का वज़न और touch, क़ीमत, लोन।"],
    ["Open loans show what is due today; overdue ones come first.", "चालू लोन में आज का बकाया; तारीख़ निकले वाले पहले।"],
  ] },
  girviNew: { en: "New girvi loan", hi: "नया गिरवी लोन", steps: [
    ["Name, mobile, address; the ID you saw and only its last 4 digits.", "नाम, मोबाइल, पता; देखा गया पहचान पत्र और सिर्फ़ आख़िरी 4 अंक।"],
    ["Each piece: weight and touch (fine weight is worked out).", "हर सामान: वज़न और touch (fine वज़न अपने-आप)।"],
    ["Valuation (empty = today's rate), loan up to the limit shown, due date.", "क़ीमत (खाली = आज का रेट), दिखाई सीमा तक लोन, आख़िरी तारीख़।"],
    ["Give the loan — print the receipt and get it signed.", "लोन दें — रसीद छापकर साइन कराएँ।"],
  ] },
  girviView: { en: "One loan", hi: "एक लोन", steps: [
    ["Take a payment: interest is cut first, then principal.", "पैसे लें: पहले ब्याज कटेगा, फिर मूल।"],
    ["Nothing due? Release the pieces.", "कुछ बाकी नहीं? सामान लौटाएँ।"],
    ["Send reminder anytime; notice only after the due date.", "याद कभी भी; नोटिस तारीख़ निकलने के बाद।"],
    ["Auction only after the notice time and your state's rules.", "नीलामी नोटिस के समय और राज्य के नियम के बाद ही।"],
  ] },
};

export function PageHelp({ k }: { k: keyof typeof HELP | string }) {
  const { lang } = useT(); const hi = lang !== "en";
  const [open, setOpen] = useState(false);
  const h = HELP[k];
  if (!h) return null;
  return (
    <div className="print:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
        <HelpCircle className="h-3.5 w-3.5" /> {hi ? "इस page को कैसे चलाएँ" : "How to use this page"}
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-brand/30 bg-surface p-3 shadow-card">
          <div className="mb-1.5 flex items-center justify-between"><p className="text-sm font-bold">{hi ? h.hi : h.en}</p><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted"><X className="h-4 w-4" /></button></div>
          <ol className="space-y-1.5">{h.steps.map(([en, hh], i) => <li key={en} className="flex gap-2 text-[13px]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">{i + 1}</span><span>{hi ? hh : en}</span></li>)}</ol>
          <p className="mt-2 text-[11px] text-muted">{hi ? "हर डिब्बे के पास छोटा “?” दबाएँ — वहाँ क्या भरना है, लिखा है।" : "Tap the small “?” beside any box — it says what to fill."} <Link href="/help/jewellery" className="font-semibold text-brand-ink">{hi ? "पूरी गाइड →" : "Full guide →"}</Link></p>
        </div>
      )}
    </div>
  );
}
