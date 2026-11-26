"use client";
// "How to start" for the Mobile shop (owner, 26 Nov 2026: "Step 1, Step 2, Step 3… aur jaisa layout silai wale me banaya tha"): the
// same checklist as Orders · Silai on the shop's home — each line opens its screen, lines tick by themselves where the app can
// tell (shop details, items, a bill, a repair job), the rest the owner ticks. Hidden once all are done ("How to start" brings it
// back). The in-app guide shows the same steps.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronUp, ListChecks } from "lucide-react";

/** "How to start" (owner, 26 Nov 2026: "Step 1, Step 2, Step 3… rahe to zyada better hai"): the order a new shop goes in, from the
 *  first setting to the things that then run by themselves. Each step opens its screen. */
export const MS_START: { en: string; hi: string; whyEn: string; whyHi: string; href: string; btnEn: string; btnHi: string }[] = [
  { en: "Shop details and printer", hi: "दुकान की जानकारी और printer", whyEn: "Name, address, phone, GST (only if you have a GSTIN) and your paper size — they print on every bill.", whyHi: "नाम, पता, फ़ोन, GST (सिर्फ़ GSTIN हो तो) और paper का size — ये हर बिल पर छपते हैं।", href: "/poster/mobile/settings", btnEn: "Open Settings", btnHi: "Settings खोलें" },
  { en: "Add what you sell", hi: "जो बेचते हैं वो जोड़ें", whyEn: "Start with the 20 items that sell the most: name, price, how many you have. Phones with their IMEI.", whyHi: "सबसे ज़्यादा बिकने वाले 20 items से शुरू करें: नाम, दाम, कितने हैं। फ़ोन उनके IMEI के साथ।", href: "/poster/mobile/items", btnEn: "Open Items", btnHi: "Items खोलें" },
  { en: "Make your first bill", hi: "पहला बिल बनाएँ", whyEn: "Search or scan the item, pick Cash / UPI, then Save & WhatsApp — the customer gets the bill on WhatsApp.", whyHi: "item खोजें या scan करें, Cash / UPI चुनें, फिर Save & WhatsApp — ग्राहक को बिल WhatsApp पर मिल जाता है।", href: "/poster/mobile/bill", btnEn: "New bill", btnHi: "नया बिल" },
  { en: "Take a repair job", hi: "रिपेयर job लें", whyEn: "Customer, phone, problem and advance. When it is ready the customer is told on WhatsApp; on hand-over the bill is made.", whyHi: "ग्राहक, फ़ोन, खराबी और advance। तैयार होने पर ग्राहक को WhatsApp पर बताया जाता है; वापस देने पर बिल बनता है।", href: "/poster/mobile/repair", btnEn: "New repair job", btnHi: "नया रिपेयर job" },
  { en: "Link your WhatsApp — messages go by themselves", hi: "अपना WhatsApp जोड़ें — message अपने-आप जाएँगे", whyEn: "Bills, “repair ready” and the thank-you with a Google review link go from your own number, without typing.", whyHi: "बिल, “रिपेयर तैयार” और धन्यवाद के साथ Google review link — आपके अपने नंबर से, बिना टाइप किए।", href: "/poster/connect", btnEn: "Open Connections", btnHi: "Connections खोलें" },
  { en: "Get found on Google, post every day", hi: "Google पर दिखें, रोज़ post", whyEn: "Connect your Google profile: reviews are answered, today's poster goes up every morning, and a weekly check tells you what to fix.", whyHi: "Google profile जोड़ें: reviews के जवाब, रोज़ सुबह आज का poster, और हर हफ़्ते की जाँच कि क्या ठीक करना है।", href: "/poster/social?tab=google", btnEn: "Open Google", btnHi: "Google खोलें" },
  { en: "Close the day", hi: "दिन का हिसाब", whyEn: "Every evening: today's sale, cash and UPI, udhaar and profit — on one screen.", whyHi: "हर शाम: आज की बिक्री, cash और UPI, उधार और मुनाफ़ा — एक screen पर।", href: "/poster/mobile/reports", btnEn: "Open Reports", btnHi: "Reports खोलें" },
];

const KEY = "shubhora.mobile-start";
type Ticks = Record<string, boolean>;
const read = (): Ticks => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Ticks; } catch { return {}; } };

/** `auto`: what the home screen already knows, per step (true = done). */
export function MobileStartList({ hi, auto, q }: { hi: boolean; auto: boolean[]; q: string }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [ticks, setTicks] = useState<Ticks>({});
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => { setTicks(read()); }, []);
  const tick = (k: string, v: boolean) => { const n = { ...ticks, [k]: v }; setTicks(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private window */ } };
  const done = MS_START.map((s, i) => !!auto[i] || !!ticks[s.en]);
  const doneN = done.filter(Boolean).length;
  const shown = open ?? doneN < MS_START.length;
  const withQ = (href: string) => (q ? `${href}${href.includes("?") ? "&" : "?"}${q}` : href);

  if (!shown) return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink underline underline-offset-2">
      <ListChecks className="h-3.5 w-3.5" /> {T("How to start", "शुरुआत कैसे करें")} ({doneN}/{MS_START.length})
    </button>
  );
  return (
    <section className="space-y-3 rounded-3xl border-2 border-brand/30 bg-brand-soft/30 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl grad-brand text-white"><ListChecks className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight">{T("How to start — step by step", "शुरुआत कैसे करें — एक-एक step")}</p>
          <p className="text-xs text-muted">{T(`${doneN} of ${MS_START.length} done. Tap a step to go there; tick it when it is done.`, `${MS_START.length} में से ${doneN} हो गए। Step दबाएँ, वहाँ पहुँचें; हो जाए तो tick करें।`)}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label={T("Close", "बंद करें")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted"><ChevronUp className="h-4 w-4" /></button>
      </div>
      <ol className="space-y-2">
        {MS_START.map((s, i) => (
          <li key={s.en} className={`flex items-start gap-3 rounded-2xl border bg-surface p-3 ${done[i] ? "border-good/40" : "border-border"}`}>
            <button type="button" onClick={() => !auto[i] && tick(s.en, !ticks[s.en])} disabled={!!auto[i]} aria-pressed={done[i]} aria-label={T("Done", "हो गया")}
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${done[i] ? "border-good bg-good text-white" : "border-border bg-surface"}`}>
              {done[i] && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <Link href={withQ(s.href)} className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-brand-ink">Step {i + 1}</span>
              <span className="block text-sm font-semibold">{hi ? s.hi : s.en}</span>
              <span className="block text-xs text-muted">{hi ? s.whyHi : s.whyEn}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-muted">{T("Steps 1 to 3 are enough to start billing today. Steps 5 and 6 make the messages and posts run by themselves.", "बिल बनाना आज ही शुरू करने के लिए Step 1 से 3 काफ़ी हैं। Step 5 और 6 के बाद message और post अपने-आप चलते हैं।")}</p>
    </section>
  );
}
