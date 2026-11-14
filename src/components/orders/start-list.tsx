"use client";
// "Before you start" (owner, 14 Nov 2026: "start karne se pehle user kahan kya add kare, step wise — app me note ho"): the owner's
// one-time setup of Orders · Silai as a checklist on the Orders page, each line a tap away from where it is done. Lines tick by
// themselves where the app can tell (staff, karigars, a changed flow / item list, the first order); the rest the owner ticks.
// Hidden once the first real order is booked and every line is done (a "Setup list" link brings it back).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { DEFAULT_SETUP, type JobSetup } from "@/lib/jobs";

type Props = {
  hi: boolean; setup: JobSetup | undefined; staffCount: number; karigarCount: number; orderCount: number;
  /** "New order" — the last line opens it. */
  onNewOrder: () => void;
};
const KEY = "shubhora.orders-start";
type Ticks = Record<string, boolean>;
const read = (): Ticks => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Ticks; } catch { return {}; } };

export function StartList({ hi, setup, staffCount, karigarCount, orderCount, onNewOrder }: Props) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [ticks, setTicks] = useState<Ticks>({});
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => { setTicks(read()); }, []);
  const tick = (k: string, v: boolean) => { const n = { ...ticks, [k]: v }; setTicks(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private window */ } };

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const flowChanged = !!setup && (!same(setup.steps.map((s) => s.name), DEFAULT_SETUP.steps.map((s) => s.name)) || setup.steps.some((s) => !!s.who));
  const itemsChanged = !!setup && !same(setup.items, DEFAULT_SETUP.items);
  const worksChanged = !!setup && (!same(setup.works, DEFAULT_SETUP.works) || setup.unit !== DEFAULT_SETUP.unit);

  const lines = [
    { k: "staff", auto: staffCount > 0, optional: true, href: "/poster/orders/staff",
      t: T("Add your staff", "अपना staff जोड़ें"), s: T("Staff & logins → name, mobile, role → Add staff → Invite on WhatsApp. Working alone? Skip it.", "Staff · login → नाम, mobile, role → Add staff → WhatsApp पर invite। अकेले काम करते हैं? छोड़ दें।") },
    { k: "karigars", auto: karigarCount > 0, optional: true, href: "/poster/orders/karigars",
      t: T("Add your karigars", "अपने कारीगर जोड़ें"), s: T("Karigars → name, mobile, their work (fall-pico, embroidery). They get work on WhatsApp, no app needed.", "कारीगर → नाम, mobile, काम (fall-pico, कढ़ाई)। उन्हें काम WhatsApp पर मिलता है, app की ज़रूरत नहीं।") },
    { k: "flow", auto: flowChanged, href: "/poster/orders/setup",
      t: T("Set the steps of your work", "अपने काम के step बनाएँ"), s: T("Setup & flow → 1 · The flow: keep the steps your shop uses, and under each one pick whose work it is. Set the usual delivery days.", "Setup · Flow → 1 · The flow: दुकान के step रखें, हर step के नीचे किसका काम चुनें। आम delivery के दिन भरें।") },
    { k: "items", auto: itemsChanged, href: "/poster/orders/setup",
      t: T("Set your items and measurements", "अपने item और नाप सेट करें"), s: T("Setup & flow → 2 · Items: open each item (blouse, suit, lehenga…) — its usual work, its steps, its measurements. Remove what you do not make.", "Setup · Flow → 2 · Items: हर item खोलें — आम काम, step, नाप। जो नहीं बनाते उसे हटा दें।") },
    { k: "works", auto: worksChanged, href: "/poster/orders/setup",
      t: T("Kinds of work and inch / cm, then Save setup", "काम की list और inch / cm, फिर Save setup"), s: T("Setup & flow → 3 · Kinds of work: add or remove work, pick inch or cm. Then tap Save setup at the bottom.", "Setup · Flow → 3: काम जोड़ें या हटाएँ, inch या cm चुनें। फिर नीचे Save setup दबाएँ।") },
    { k: "whatsapp", auto: false, optional: true, href: "/poster/connect",
      t: T("Connect the shop's WhatsApp", "दुकान का WhatsApp जोड़ें"), s: T("Connect apps → WhatsApp. Without it staff and karigars still get the app notification, but not the WhatsApp message.", "Connect apps → WhatsApp। इसके बिना staff को app का notification तो जाता है, WhatsApp message नहीं।") },
    { k: "test", auto: orderCount > 0, action: onNewOrder,
      t: T("Book one test order", "एक test order बुक करें"), s: T("+ New order with your own mobile number: see the job number, the message to the first step and the slip on WhatsApp. Then cancel it.", "+ New order अपने ही mobile से: job number, पहले step वाले को message और WhatsApp slip देखें। फिर cancel कर दें।") },
  ];
  const isDone = (l: (typeof lines)[number]) => l.auto || !!ticks[l.k];
  const doneN = lines.filter(isDone).length;
  const allDone = doneN === lines.length || (orderCount > 0 && lines.filter((l) => !l.optional).every(isDone));
  const shown = open ?? !allDone;

  if (!shown) return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-ink underline underline-offset-2">
      <ListChecks className="h-3.5 w-3.5" /> {T("Setup list", "Setup की list")} ({doneN}/{lines.length})
    </button>
  );
  return (
    <section className="space-y-3 rounded-3xl border-2 border-brand/30 bg-brand-soft/30 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl grad-brand text-white"><ListChecks className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight">{T("Before you start — one time", "शुरू करने से पहले — सिर्फ़ एक बार")}</p>
          <p className="text-xs text-muted">{T(`${doneN} of ${lines.length} done. Tap a line to go there; tick it when it is done.`, `${lines.length} में से ${doneN} हो गए। Line दबाएँ, वहाँ पहुँचेंगे; हो जाए तो ✓ करें।`)}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label={T("Close", "बंद करें")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted">{shown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      </div>
      <ol className="space-y-2">
        {lines.map((l, i) => {
          const d = isDone(l);
          const body = (
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{i + 1}. {l.t}{l.optional && <span className="ml-1.5 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{T("if needed", "ज़रूरत हो तो")}</span>}</span>
              <span className="block text-xs text-muted">{l.s}</span>
            </span>
          );
          return (
            <li key={l.k} className={`flex items-start gap-3 rounded-2xl border bg-surface p-3 ${d ? "border-good/40" : "border-border"}`}>
              <button type="button" onClick={() => !l.auto && tick(l.k, !ticks[l.k])} disabled={l.auto} aria-pressed={d} aria-label={T("Done", "हो गया")}
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${d ? "border-good bg-good text-white" : "border-border bg-surface"}`}>
                {d && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              {l.action ? <button type="button" onClick={l.action} className="min-w-0 flex-1 text-left">{body}</button>
                : <Link href={l.href!} className="min-w-0 flex-1">{body}</Link>}
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-muted">{T("In a hurry? Lines 3, 4 and 5 are enough to start taking orders; add staff and karigars later.", "जल्दी है? Line 3, 4 और 5 काफ़ी हैं, order लेना शुरू कर सकते हैं; staff और कारीगर बाद में जोड़ें।")}</p>
    </section>
  );
}
