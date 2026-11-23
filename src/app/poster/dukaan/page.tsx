"use client";
// "Dukaan" — the shop's own work in one place (owner, 23 Nov 2026: "ye main rehne wala hai… isme how to use, kaise start karna,
// sab detail"). Every module that is on gets a big card: open it, the first steps with ✓ for what is done, and how it is used day
// to day. A module that suits the business but is off shows what it does and how to get it switched on.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, ChevronDown, ChevronRight, LoaderCircle, MessageCircle, Store } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useShopModules } from "@/components/poster/advanced-features";
import { ADDONS, addonWaText } from "@/lib/addons";
import { waLink } from "@/lib/site-brand";
import type { JwSetup, RateBook } from "@/lib/jewellery";

type Step = { en: string; hi: string; dEn: string; dHi: string; href: string; done?: boolean; optional?: boolean };
type MsHome = { setup: { shopName: string; address: string; phone: string }; items: number; recent: unknown[] };
type JwHome = { setup: JwSetup; rate: RateBook | null; today: string; recent: unknown[]; stats: { ordersOpen?: number } };

/** Day-to-day use, in order — the "how to use" of each module. */
const JW_USE: [string, string, string, string][] = [
  ["Every morning: today's rate", "रोज़ सुबह: आज का रेट", "Type 24K and silver per 10 g; 22K / 18K are worked out. Share the rate poster on WhatsApp status.", "24K और चाँदी का 10 ग्राम रेट डालें; 22K / 18K अपने-आप। रेट पोस्टर WhatsApp status पर डालें।"],
  ["Sell: New bill", "बेचना: नया बिल", "Scan the tag (or pick item + purity + weight). Making, wastage, stones, 3% GST come by themselves. Save & WhatsApp.", "टैग scan करें (या item + purity + वज़न)। मेकिंग, वेस्टेज, नग, 3% GST अपने-आप। Save & WhatsApp।"],
  ["Old gold in exchange", "पुराना सोना बदले में", "On the same bill: gross, less, touch % — its value comes off the bill.", "उसी बिल में: कुल, घटाव, touch % — उसकी क़ीमत बिल से घटती है।"],
  ["Estimate first", "पहले estimate", "Give the price on WhatsApp; when the customer agrees, one tap makes it a bill.", "दाम WhatsApp पर भेजें; ग्राहक माने तो एक tap में बिल।"],
  ["Orders and repairs", "ऑर्डर और रिपेयर", "Book with advance (lock today's rate if asked), give to karigar, mark ready — the customer gets a WhatsApp; deliver with the bill.", "एडवांस लेकर बुक करें (चाहें तो रेट lock), कारीगर को दें, तैयार करें — ग्राहक को WhatsApp; बिल से दें।"],
  ["Karigar ledger", "कारीगर का खाता", "Gold given and work received in fine weight, wastage allowed, labour and money paid.", "दिया सोना और आया माल fine वज़न में, घटत, मज़दूरी और दिए पैसे।"],
  ["Stock and tags", "स्टॉक और टैग", "Add every piece — it gets a tag number and a barcode label to print. Selling the tag takes it out of stock.", "हर पीस चढ़ाएँ — टैग नंबर और बारकोड लेबल मिलेगा। बिकते ही स्टॉक से हटेगा।"],
  ["Your website sells too", "वेबसाइट भी बेचती है", "Every piece in stock shows on your website with its photo and a “from ₹” price at today's rate; customers ask about it on WhatsApp. Add a photo when you add stock.", "स्टॉक का हर पीस वेबसाइट पर फ़ोटो और आज के रेट से “₹… से शुरू” दाम के साथ; ग्राहक WhatsApp पर पूछते हैं। स्टॉक चढ़ाते समय फ़ोटो जोड़ें।"],
  ["Evening: day close", "शाम: डे क्लोज़", "Reports → Today: sale, GST, money by cash / UPI, old gold — send it to yourself on WhatsApp. Excel for the CA.", "रिपोर्ट → आज: बिक्री, GST, cash / UPI पैसे, पुराना सोना — खुद को WhatsApp करें। CA के लिए Excel।"],
];
const MS_USE: [string, string, string, string][] = [
  ["Sell: New bill", "बेचना: नया बिल", "Type the item or the phone it fits (cover redmi 13), or scan the barcode. Tap Cash / UPI. Save.", "item या किस फ़ोन का है लिखें (cover redmi 13), या barcode scan करें। Cash / UPI दबाएँ। Save।"],
  ["Udhaar", "उधार", "Pick “Part / udhaar” and type what came. The rest shows on the home screen; take it later from the bill.", "“कुछ / उधार” चुनकर जो मिला लिखें। बाकी home पर दिखता है; बाद में बिल से ले लें।"],
  ["New stock came", "नया माल आया", "Purchase: pick the item, how many, cost of one. The stock goes up.", "ख़रीद: item चुनें, कितने आए, एक की लागत। स्टॉक बढ़ जाता है।"],
  ["Phones (if you sell them)", "फ़ोन (अगर बेचते हैं)", "Add the model once as “Phone”. Scan IMEIs in Purchase; on the bill just scan the IMEI.", "model एक बार “फ़ोन” में जोड़ें। ख़रीद में IMEI scan करें; बिल पर बस IMEI scan करें।"],
  ["No internet?", "इंटरनेट नहीं?", "Bills still get made and are kept on the phone; they go up when the network is back.", "बिल फिर भी बनते हैं और फ़ोन में रखे जाते हैं; नेटवर्क आते ही चढ़ जाते हैं।"],
  ["Night: check the day", "रात को: दिन देखें", "Home shows today's sale, cash and UPI apart, profit and low stock.", "Home पर आज की बिक्री, cash और UPI अलग, मुनाफ़ा और कम स्टॉक।"],
];
const SILAI_USE: [string, string, string, string][] = [
  ["Book an order", "ऑर्डर बुक करें", "Customer, item (blouse, suit…), work, charge and date. Take the measurements once — they are kept for next time.", "ग्राहक, item (ब्लाउज़, सूट…), काम, चार्ज और तारीख़। नाप एक बार — अगली बार के लिए save।"],
  ["Give the work", "काम बाँटें", "Cutting → stitching → finishing: each step goes to the right person or karigar (karigar gets a WhatsApp).", "कटिंग → सिलाई → फ़िनिशिंग: हर step सही व्यक्ति या कारीगर को (कारीगर को WhatsApp)।"],
  ["Staff tap “done”", "Staff “हो गया” दबाए", "Each staff login sees only its own work and marks it done.", "हर staff को सिर्फ़ अपना काम दिखता है, “हो गया” दबाता है।"],
  ["Ready → WhatsApp", "तैयार → WhatsApp", "When the last step is done the customer gets a WhatsApp; take the balance and deliver.", "आख़िरी step होते ही ग्राहक को WhatsApp; बाकी पैसे लेकर दें।"],
];

function Steps({ steps, hi }: { steps: Step[]; hi: boolean }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <li key={s.href + i}>
          <Link href={s.href} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 hover:bg-surface2">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${s.done ? "bg-good text-white" : "bg-brand-soft text-brand-ink"}`}>{s.done ? <Check className="h-3 w-3" /> : i + 1}</span>
            <span className="min-w-0 flex-1"><span className={`block text-sm font-semibold ${s.done ? "text-muted line-through" : ""}`}>{hi ? s.hi : s.en}{s.optional ? <span className="ml-1 text-[10px] font-normal text-muted">{hi ? "(ज़रूरत हो तो)" : "(if you need it)"}</span> : null}</span><span className="block text-[11px] text-muted">{hi ? s.dHi : s.dEn}</span></span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function HowTo({ rows, hi, guide }: { rows: [string, string, string, string][]; hi: boolean; guide: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold"><span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-brand" /> {hi ? "रोज़ कैसे इस्तेमाल करें" : "How to use it every day"}</span><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button>
      {open && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          {rows.map(([en, h, dEn, dHi]) => <p key={en} className="text-[13px]"><b>{hi ? h : en}:</b> <span className="text-muted">{hi ? dHi : dEn}</span></p>)}
          <p className="text-[12px] text-muted">{hi ? "हर field के पास “?” दबाएँ — वहीं बताया है क्या भरना है।" : "Tap the “?” beside any field — it says what to type there."}</p>
          <Link href={guide} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{hi ? "पूरी जानकारी पढ़ें →" : "Read the full guide →"}</Link>
        </div>
      )}
    </div>
  );
}

export default function Dukaan() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const shop = useShopModules();
  const [jw, setJw] = useState<JwHome | null>(null);
  const [ms, setMs] = useState<MsHome | null>(null);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); })(); }, [router]);
  useEffect(() => { if (shop.jewellery) void api<JwHome>("/api/jewellery").then((r) => { if (r.ok) setJw(r.data); }); }, [shop.jewellery]);

  useEffect(() => { if (shop.mobile) void api<MsHome>("/api/mobile").then((r) => { if (r.ok) setMs(r.data); }).catch(() => undefined); }, [shop.mobile]);

  if (!shop.loaded) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const jwSteps: Step[] = [
    { en: "Your shop on the bill", hi: "बिल पर आपकी दुकान", dEn: "Shop name, address, GSTIN, BIS, bank / UPI, purities you sell, making of each item.", dHi: "दुकान का नाम, पता, GSTIN, BIS, बैंक / UPI, कौन-सी purity बेचते हैं, हर item की मेकिंग।", href: "/poster/jewellery/settings", done: !!(jw && (jw.setup.gstin || jw.setup.address)) },
    { en: "Today's rate", hi: "आज का रेट", dEn: "24K and silver per 10 g — every bill uses it.", dHi: "24K और चाँदी का 10 ग्राम रेट — हर बिल इसी से।", href: "/poster/jewellery/rate", done: !!(jw?.rate && jw.rate.day === jw.today) },
    { en: "Make the first bill", hi: "पहला बिल बनाएँ", dEn: "Try it on a test name; cancel it after if you like.", dHi: "किसी टेस्ट नाम से बनाकर देखें; बाद में रद्द कर सकते हैं।", href: "/poster/jewellery/bill", done: !!(jw && jw.recent.length > 0) },
    { en: "Add stock and print tags", hi: "स्टॉक चढ़ाएँ, टैग छापें", dEn: "Each piece gets a barcode tag; billing scans it.", dHi: "हर पीस को बारकोड टैग; बिल में scan करें।", href: "/poster/jewellery/stock/new", optional: true },
    { en: "Staff logins", hi: "Staff के login", dEn: "Add your counter staff in Customers → Settings → Team, then give rights in Jewellery settings.", dHi: "Customers → Settings → Team में staff जोड़ें, फिर Jewellery settings में अधिकार दें।", href: "/poster/crm?s=settings", optional: true },
  ];
  const msSteps: Step[] = [
    { en: "Your shop on the bill", hi: "बिल पर आपकी दुकान", dEn: "Shop name, address, phone, printer paper size. GST only if you have a GSTIN.", dHi: "दुकान का नाम, पता, फ़ोन, printer का paper साइज़। GST तभी जब GSTIN हो।", href: "/poster/mobile/settings", done: !!(ms && (ms.setup.address || ms.setup.phone)) },
    { en: "Add your items", hi: "अपने items जोड़ें", dEn: "What you sell, with price and how many you have. Start with the 20 that sell most.", dHi: "जो बेचते हैं, दाम और गिनती के साथ। पहले सबसे ज़्यादा बिकने वाले 20 से शुरू करें।", href: "/poster/mobile/items", done: !!(ms && ms.items > 0) },
    { en: "Make the first bill", hi: "पहला बिल बनाएँ", dEn: "Try it on a test name; cancel it after if you like.", dHi: "किसी टेस्ट नाम से बनाकर देखें; बाद में रद्द कर सकते हैं।", href: "/poster/mobile/bill", done: !!(ms && ms.recent.length > 0) },
    { en: "Staff logins", hi: "Staff के login", dEn: "Add staff in Customers → Settings → Team, then give rights in Mobile shop settings.", dHi: "Customers → Settings → Team में staff जोड़ें, फिर Mobile shop settings में हक़ दें।", href: "/poster/crm?s=settings", optional: true },
  ];
  const silaiSteps: Step[] = [
    { en: "Set up items and steps", hi: "Item और steps सेट करें", dEn: "Items you make, the measurements of each, and the steps (cutting, stitching…).", dHi: "जो item बनाते हैं, हर item का नाप, और steps (कटिंग, सिलाई…)।", href: "/poster/orders/setup" },
    { en: "Add staff and karigars", hi: "Staff और कारीगर जोड़ें", dEn: "Logins for the master and tailors; karigars get work on WhatsApp.", dHi: "मास्टर और टेलर के login; कारीगर को काम WhatsApp पर।", href: "/poster/orders/staff" },
    { en: "Book the first order", hi: "पहला ऑर्डर बुक करें", dEn: "Customer, item, measurements, charge, date.", dHi: "ग्राहक, item, नाप, चार्ज, तारीख़।", href: "/poster/orders" },
  ];
  const off = shop.suits.map((s) => ADDONS.find((a) => a.key === s.key)).filter((a): a is (typeof ADDONS)[number] => !!a);
  const none = !shop.jewellery && !shop.orders && !shop.mobile;

  return (
    <div className="space-y-4">
      <header className="rounded-3xl grad-brand p-5 text-white shadow-card">
        <p className="flex items-center gap-2 text-xl font-extrabold"><Store className="h-6 w-6" /> {T("My Shop", "दुकान")}</p>
        <p className="mt-1 text-sm opacity-95">{T("Your shop's daily work in one place — bills, stock, orders, karigar, accounts. Start with the steps below; each field has a “?” that tells what to fill.", "आपकी दुकान का रोज़ का काम एक जगह — बिल, स्टॉक, ऑर्डर, कारीगर, हिसाब। नीचे के steps से शुरू करें; हर field के पास “?” बताता है क्या भरना है।")}</p>
      </header>

      {shop.jewellery && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface2/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">💍 {T("Jewellery", "ज्वेलरी")}</h2>
            <Link href="/poster/jewellery" className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-bold text-white">{T("Open", "खोलें")} <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <p className="text-xs font-semibold text-muted">{T("Start here", "यहाँ से शुरू करें")} · {jwSteps.filter((s) => s.done).length}/{jwSteps.filter((s) => !s.optional).length} {T("done", "पूरे")}</p>
          <Steps steps={jwSteps} hi={hi} />
          <HowTo rows={JW_USE} hi={hi} guide="/help/jewellery" />
        </section>
      )}

      {shop.mobile && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface2/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">📱 {T("Mobile shop", "मोबाइल दुकान")}</h2>
            <Link href="/poster/mobile" className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-bold text-white">{T("Open", "खोलें")} <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <p className="text-xs font-semibold text-muted">{T("Start here", "यहाँ से शुरू करें")} · {msSteps.filter((s) => s.done).length}/{msSteps.filter((s) => !s.optional).length} {T("done", "पूरे")}</p>
          <Steps steps={msSteps} hi={hi} />
          <HowTo rows={MS_USE} hi={hi} guide="/help/mobile" />
        </section>
      )}

      {shop.orders && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface2/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">🧵 {T("Orders · Silai", "ऑर्डर · सिलाई")}</h2>
            <Link href="/poster/orders" className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-bold text-white">{T("Open", "खोलें")} <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <Steps steps={silaiSteps} hi={hi} />
          <HowTo rows={SILAI_USE} hi={hi} guide="/help/orders" />
        </section>
      )}

      {off.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">{none ? T("Made for your business", "आपके business के लिए") : T("More for your business", "आपके business के लिए और")}</h2>
          {off.map((a) => (
            <div key={a.key} className="space-y-2 rounded-2xl border border-dashed border-brand/40 bg-surface p-3">
              <p className="text-sm font-bold">{a.emoji} {hi ? a.hi : a.en}</p>
              <p className="text-xs text-muted">{hi ? a.descHi : a.descEn}</p>
              <ul className="space-y-0.5 text-xs">{a.points.map(([en, h]) => <li key={en} className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" /> {hi ? h : en}</li>)}</ul>
              <div className="flex flex-wrap gap-2">
                <a href={waLink(addonWaText(a, true))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-3 py-2 text-xs font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" /> {T("Switch it on for my shop", "मेरी दुकान के लिए चालू कराएँ")}</a>
                <Link href={a.guide} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><BookOpen className="h-3.5 w-3.5" /> {T("How it works", "कैसे चलता है")}</Link>
              </div>
            </div>
          ))}
        </section>
      )}

      {none && off.length === 0 && <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">{T("No shop module for your business yet. Tell us what you sell on WhatsApp — we build it.", "आपके business का module अभी नहीं है। WhatsApp पर बताइए क्या बेचते हैं — हम बनाएँगे।")}</p>}
    </div>
  );
}
