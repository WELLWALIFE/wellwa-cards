"use client";
// The Mobile Shop guide inside the app (owner, 23 Nov 2026: "guide add kar do kaise use karna hai"): every job of the shop as a
// few plain steps, in the app's language, each with a button that opens the right screen. Tap a heading to open it.
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";

type Sec = { icon: string; en: string; hi: string; href?: string; openEn?: string; openHi?: string; steps: [string, string][] };
const GUIDE: Sec[] = [
  { icon: "🚀", en: "First day: set up in 10 minutes", hi: "पहला दिन: 10 मिनट में शुरू", href: "/poster/mobile/settings", openEn: "Open Settings", openHi: "Settings खोलें", steps: [
    ["Settings: type the shop name, address and phone — they print on every bill.", "Settings: दुकान का नाम, पता और फ़ोन लिखें — हर बिल पर छपते हैं।"],
    ["Paper: pick your printer — 58 mm or 80 mm thermal roll, or A5 / A4.", "Paper: अपना printer चुनें — 58 mm या 80 mm थर्मल roll, या A5 / A4।"],
    ["GST: switch it on only if you have a GSTIN. Without it a plain bill is made.", "GST: तभी चालू करें जब GSTIN हो। न हो तो सादा बिल बनता है।"],
    ["Then add your items (next section). Start with the 20 that sell the most.", "फिर अपने items जोड़ें (अगला हिस्सा)। पहले सबसे ज़्यादा बिकने वाले 20 से शुरू करें।"],
  ] },
  { icon: "📦", en: "Add what you sell (Items)", hi: "जो बेचते हैं वो जोड़ें (Items)", href: "/poster/mobile/items", openEn: "Open Items", openHi: "Items खोलें", steps: [
    ["Tap Add item. Pick what it is: Accessory, Phone (IMEI), Spare part or Service.", "Add item दबाएँ। चुनें ये क्या है: Accessory, फ़ोन (IMEI), Spare part या Service।"],
    ["Type the name and the selling price. Type how many you have now.", "नाम और बेचने का दाम लिखें। अभी कितने हैं वो लिखें।"],
    ["“Fits which phones?” — type the models (Redmi 13, Vivo Y28). Then on the bill, typing “cover redmi 13” finds it.", "“किस फ़ोन का है?” — model लिखें (Redmi 13, Vivo Y28)। फिर बिल पर “cover redmi 13” लिखते ही मिल जाएगा।"],
    ["Cost is what one cost you. Only you see it; profit is worked out from it.", "लागत = एक पीस आपको कितने में पड़ा। ये सिर्फ़ आपको दिखता है; मुनाफ़ा इसी से निकलता है।"],
    ["“Low stock at” — when this many are left, the item shows in the Low stock list on the home screen.", "“कम स्टॉक” — इतने बचने पर item home की 'कम स्टॉक' सूची में दिखता है।"],
  ] },
  { icon: "🧾", en: "Make a bill", hi: "बिल बनाना", href: "/poster/mobile/bill", openEn: "New bill", openHi: "नया बिल", steps: [
    ["Tap New bill. Type the item's name or the phone model, or scan its barcode — tap the item to add it.", "नया बिल दबाएँ। item का नाम या फ़ोन model लिखें, या barcode scan करें — item दबाकर जोड़ें।"],
    ["Change the count, price or discount on the line if you need to.", "ज़रूरत हो तो line पर गिनती, दाम या छूट बदलें।"],
    ["Something not in Items (like a fitting charge)? Use “Custom line”.", "कुछ Items में नहीं है (जैसे fitting charge)? “Custom line” से जोड़ें।"],
    ["Pick Cash / UPI / Card. Then Save, or Save & WhatsApp to send the bill to the customer.", "Cash / UPI / Card चुनें। फिर Save, या Save & WhatsApp से बिल ग्राहक को भेजें।"],
    ["On the next screen: Print, or start the Next bill.", "अगली screen पर: Print, या अगला बिल शुरू करें।"],
  ] },
  { icon: "📒", en: "Udhaar (money left)", hi: "उधार (बाकी पैसे)", href: "/poster/mobile/bills?view=due", openEn: "See udhaar", openHi: "उधार देखें", steps: [
    ["On the bill pick “Part / udhaar” and type what the customer paid now. The customer's mobile is needed.", "बिल पर “कुछ / उधार” चुनें और ग्राहक ने अभी जो दिया वो लिखें। ग्राहक का मोबाइल ज़रूरी है।"],
    ["The home screen shows the total udhaar. Tap it to see every udhaar bill.", "Home पर कुल उधार दिखता है। उसे दबाकर हर उधार वाला बिल देखें।"],
    ["When the money comes: open the bill → type the amount → Take payment.", "पैसा आने पर: बिल खोलें → रक़म लिखें → Take payment।"],
  ] },
  { icon: "🚚", en: "New stock came (Purchase)", hi: "नया माल आया (ख़रीद)", href: "/poster/mobile/purchase", openEn: "Open Purchase", openHi: "ख़रीद खोलें", steps: [
    ["Type the supplier's name (optional). Search each item that came and tap it.", "सप्लायर का नाम लिखें (optional)। जो-जो item आया उसे खोजकर दबाएँ।"],
    ["Type how many came and the cost of one. Save — the stock goes up.", "कितने आए और एक की लागत लिखें। Save — स्टॉक बढ़ जाता है।"],
    ["“Paid to supplier” — what you paid now. The rest shows as “To pay suppliers”; note later payments on the same purchase.", "“सप्लायर को दिया” — अभी जो दिया। बाकी “सप्लायर को देना बाकी” में दिखता है; बाद का पैसा उसी ख़रीद पर दर्ज करें।"],
  ] },
  { icon: "📱", en: "Selling phones (IMEI)", hi: "फ़ोन बेचना (IMEI)", href: "/poster/mobile/items", openEn: "Open Items", openHi: "Items खोलें", steps: [
    ["Add the model once in Items as “Phone (IMEI)”.", "model एक बार Items में “फ़ोन (IMEI)” चुनकर जोड़ें।"],
    ["When phones come: Purchase → pick the model → scan each IMEI, one per line.", "फ़ोन आने पर: ख़रीद → model चुनें → हर IMEI scan करें, एक line में एक।"],
    ["To sell: on New bill just scan the IMEI — that phone is added, with its warranty.", "बेचने के लिए: नया बिल पर बस IMEI scan करें — वही फ़ोन वारंटी के साथ जुड़ जाता है।"],
    ["One IMEI can never be sold twice — the app stops it.", "एक IMEI दो बार नहीं बिक सकता — app रोक देता है।"],
  ] },
  { icon: "🔧", en: "Repair job", hi: "रिपेयर job", href: "/poster/mobile/repair", openEn: "New repair job", openHi: "नया रिपेयर job", steps: [
    ["New repair job: customer's mobile, phone model, what is wrong, how the phone looks now (scratches, SIM inside…).", "नया रिपेयर job: ग्राहक का मोबाइल, फ़ोन model, क्या ख़राबी है, फ़ोन अभी कैसा है (खरोंच, SIM अंदर…)।"],
    ["Type the estimate and the advance, if any. Save & WhatsApp, then print the slip for the customer.", "अंदाज़न ख़र्च और advance लिखें, हो तो। Save & WhatsApp, फिर ग्राहक के लिए पर्ची print करें।"],
    ["While working: tap the step (Being repaired / Waiting for part). Add the parts you used — the stock reduces at once. Type your repair charge.", "काम के दौरान: step दबाएँ (काम चालू / पार्ट का इंतज़ार)। लगे parts जोड़ें — स्टॉक तुरंत घटता है। अपना repair charge लिखें।"],
    ["Tap Ready — the customer gets a WhatsApp with the amount to pay.", "तैयार दबाएँ — ग्राहक को WhatsApp जाता है, देने वाली रक़म के साथ।"],
    ["“Give the phone back & make the bill” — the advance comes off by itself.", "“फ़ोन दें और बिल बनाएँ” — advance अपने-आप घट जाता है।"],
    ["Customer said no? “Return unrepaired” — the parts go back to stock; give the advance back and tap “Advance returned”.", "ग्राहक ने मना किया? “बिना बने वापस” — parts स्टॉक में लौटते हैं; advance लौटाकर “Advance लौटा दिया” दबाएँ।"],
  ] },
  { icon: "↩️", en: "Customer returns something", hi: "ग्राहक कुछ वापस लाया", href: "/poster/mobile/bills", openEn: "Open Bills", openHi: "बिल खोलें", steps: [
    ["Open the bill (Bills → search by name, mobile or bill number).", "बिल खोलें (बिल → नाम, मोबाइल या बिल नंबर से खोजें)।"],
    ["Tap “Return items”. Type how many pieces of each came back.", "“सामान वापसी” दबाएँ। हर item के कितने पीस वापस आए लिखें।"],
    ["The stock goes back. If the bill had udhaar, it is reduced first; the rest you give back to the customer.", "स्टॉक वापस चढ़ता है। बिल पर उधार था तो पहले वो घटता है; बाकी ग्राहक को लौटाना है।"],
    ["Whole bill was a mistake? Use “Cancel” with a reason instead.", "पूरा बिल ही गलत था? वजह लिखकर “रद्द करें” इस्तेमाल करें।"],
  ] },
  { icon: "🔁", en: "Old phone in exchange, and EMI", hi: "पुराना फ़ोन exchange, और EMI", href: "/poster/mobile/bill", openEn: "New bill", openHi: "नया बिल", steps: [
    ["Exchange: on the bill tap “Old phone in exchange” — type its model, IMEI and value. The value comes off what the customer pays.", "Exchange: बिल पर “पुराना फ़ोन exchange में” दबाएँ — model, IMEI और क़ीमत लिखें। क़ीमत ग्राहक के देने वाले पैसों से घटती है।"],
    ["The old phone comes into your stock as “Used <model>”. Sell it later like any phone.", "पुराना फ़ोन “Used <model>” नाम से आपके स्टॉक में आ जाता है। बाद में किसी भी फ़ोन की तरह बेचें।"],
    ["EMI: pick “EMI” in payment and type the finance company. It shows apart from cash and UPI in the day's money.", "EMI: पेमेंट में “EMI” चुनें और finance कंपनी लिखें। दिन के पैसों में ये cash और UPI से अलग दिखता है।"],
  ] },
  { icon: "🏷️", en: "Barcode labels", hi: "Barcode label", href: "/poster/mobile/labels", openEn: "Open Labels", openHi: "Label खोलें", steps: [
    ["Search the item, tap it, type how many stickers.", "item खोजें, दबाएँ, कितने sticker चाहिए लिखें।"],
    ["No barcode on it? Tap “Give them a barcode”.", "उस पर barcode नहीं? “इन्हें barcode दें” दबाएँ।"],
    ["Print (50×25 mm stickers). On the bill, scanning the sticker adds the item.", "Print करें (50×25 mm sticker)। बिल पर sticker scan करते ही item जुड़ जाता है।"],
  ] },
  { icon: "🔢", en: "Count the stock (milaan)", hi: "स्टॉक मिलान", href: "/poster/mobile/stocktake", openEn: "Count the stock", openHi: "स्टॉक गिनें", steps: [
    ["Scan every piece on the shelf (one scan = one piece), or tap an item and type its count. Phones: scan each IMEI.", "shelf का हर पीस scan करें (एक scan = एक पीस), या item दबाकर गिनती लिखें। फ़ोन: हर IMEI scan करें।"],
    ["You can stop and come back — the count stays on this phone.", "रुककर बाद में आ सकते हैं — गिनती इसी फ़ोन में रहती है।"],
    ["See the differences, download the list, then “Set stock to my count”. Items you did not count are not changed.", "फ़र्क़ देखें, list डाउनलोड करें, फिर “स्टॉक मेरी गिनती जितना करें”। जो item नहीं गिने वो नहीं बदलते।"],
  ] },
  { icon: "📊", en: "Day close, reports, Excel and Tally", hi: "दिन का हिसाब, रिपोर्ट, Excel और Tally", href: "/poster/mobile/reports", openEn: "Open Reports", openHi: "रिपोर्ट खोलें", steps: [
    ["Home shows today: sale, cash and UPI apart, profit, udhaar, low stock.", "Home पर आज का: बिक्री, cash और UPI अलग, मुनाफ़ा, उधार, कम स्टॉक।"],
    ["Reports: pick today, this month or your own dates. Send the summary on WhatsApp.", "रिपोर्ट: आज, ये महीना या अपनी तारीख़ें चुनें। सार WhatsApp पर भेजें।"],
    ["Download for Excel: sales register, HSN summary, item-wise sale, stock list — give them to your CA.", "Excel के लिए डाउनलोड: बिक्री रजिस्टर, HSN सार, item-वार बिक्री, स्टॉक list — अपने CA को दें।"],
    ["Tally: two files — ledgers (once), then the period's vouchers. Have your accountant try it on a test company first.", "Tally: दो फ़ाइल — ledgers (एक बार), फिर उस अवधि के vouchers। पहले अकाउंटेंट से test company में आज़मवाएँ।"],
  ] },
  { icon: "📴", en: "No internet", hi: "इंटरनेट नहीं है", steps: [
    ["Open New bill once with internet on this phone. After that it opens without internet too.", "इस फ़ोन पर एक बार इंटरनेट के साथ नया बिल खोलें। उसके बाद ये बिना इंटरनेट भी खुलता है।"],
    ["Bills made without internet are kept on the phone (they print as OFFLINE) and go up by themselves when the network is back — keep the app open then.", "बिना इंटरनेट बने बिल फ़ोन में रहते हैं (OFFLINE छपता है) और नेटवर्क आते ही अपने-आप चढ़ जाते हैं — तब app खुला रखें।"],
    ["Need the network: WhatsApp, finding a phone by IMEI scan, purchase, repair jobs, old bills.", "इनके लिए नेटवर्क चाहिए: WhatsApp, IMEI scan से फ़ोन खोजना, ख़रीद, रिपेयर job, पुराने बिल।"],
  ] },
  { icon: "👥", en: "Staff and their rights", hi: "Staff और उनके हक़", href: "/poster/mobile/settings", openEn: "Open Settings", openHi: "Settings खोलें", steps: [
    ["Add each staff login in Customers → Settings → Team.", "हर staff का login Customers → Settings → Team में जोड़ें।"],
    ["Mobile shop → Settings → Staff rights: tick what each may do — bills, stock, repair, discount, cancel, see cost and profit, reports.", "मोबाइल दुकान → Settings → Staff के हक़: हर एक क्या कर सकता है tick करें — बिल, स्टॉक, रिपेयर, छूट, रद्द, लागत और मुनाफ़ा देखना, रिपोर्ट।"],
    ["“Staff discount limit %” is the most discount staff can give by themselves.", "“Staff की छूट limit %” = staff खुद से ज़्यादा-से-ज़्यादा इतनी छूट दे सकता है।"],
    ["A bill is never deleted — it is only cancelled with a reason, and the name of who did it is kept.", "बिल कभी delete नहीं होता — सिर्फ़ वजह लिखकर रद्द होता है, और किसने किया वो नाम रहता है।"],
  ] },
];

export default function MobileGuide() {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [open, setOpen] = useState<number | null>(0);
  const withAs = (href: string) => (ws.q ? `${href}${href.includes("?") ? "&" : "?"}${ws.q}` : href);
  return (
    <div className="space-y-3">
      <Link href={withAs("/poster/mobile")} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <header className="rounded-3xl grad-brand p-4 text-white shadow-card">
        <h1 className="text-lg font-extrabold">📖 {T("How to use Mobile shop", "मोबाइल दुकान कैसे चलाएँ")}</h1>
        <p className="mt-1 text-sm opacity-95">{T("Tap any heading. Each has a few steps and a button that opens that screen. On every screen, the small “?” beside a field tells what to type there.", "कोई भी heading दबाएँ। हर एक में कुछ steps हैं और वो screen खोलने का बटन। हर screen पर field के पास का छोटा “?” बताता है वहाँ क्या लिखना है।")}</p>
      </header>
      {GUIDE.map((s, i) => (
        <section key={s.en} className="rounded-2xl border border-border bg-surface">
          <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"><span className="text-sm font-bold">{s.icon} {hi ? s.hi : s.en}</span><ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open === i ? "rotate-180" : ""}`} /></button>
          {open === i && (
            <div className="space-y-2 border-t border-border px-3 py-3">
              <ol className="space-y-1.5">{s.steps.map(([en, h], n) => <li key={en} className="flex gap-2 text-[13px]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">{n + 1}</span><span>{hi ? h : en}</span></li>)}</ol>
              {s.href && <Link href={withAs(s.href)} className="inline-flex items-center gap-1 rounded-xl grad-brand px-3 py-2 text-xs font-semibold text-white">{hi ? s.openHi : s.openEn} <ChevronRight className="h-3.5 w-3.5" /></Link>}
            </div>
          )}
        </section>
      ))}
      <p className="text-center text-[12px] text-muted">{T("Stuck? Tap the round “?” button at the bottom of the screen to ask for help.", "कहीं अटक गए? मदद के लिए screen के नीचे वाला गोल “?” बटन दबाएँ।")}</p>
    </div>
  );
}
