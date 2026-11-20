"use client";
// AI Training → "Jaldi setup" and "Aur settings" (owner, 20 Nov 2026: any business, any purpose — the owner guides the AI in a few
// taps; nothing set = the AI already answers from the card). Saved as card.botRules (bridge/ai-rules.mjs), read by the WhatsApp
// assistant and by the website chat / official WhatsApp API / phone assistant alike.
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BotRules, Card } from "@/lib/types";
import { publishCard } from "@/lib/cloud";
import { api } from "@/lib/poster-client";

type P = { card: Card; onSaved: (c: Card) => void; hi: boolean };
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`;
const sw = (on: boolean) => `relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-border"}`;
const knob = (on: boolean) => `absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`;
const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";

/** Only what differs from the defaults is stored; nothing left = no field. */
function clean(r: BotRules): BotRules | undefined {
  const o: BotRules = {};
  if (r.lang && r.lang !== "hi") o.lang = r.lang;
  const t = r.tasks ?? {};
  if (t.order === false || t.booking === false || t.callback === false) o.tasks = { order: t.order !== false, booking: t.booking !== false, callback: t.callback !== false };
  if (r.price === "call") o.price = "call";
  if (r.name?.trim()) o.name = r.name.trim().slice(0, 30);
  if (r.ask?.length) o.ask = r.ask;
  if (r.askOwn?.trim()) o.askOwn = r.askOwn.trim().slice(0, 120);
  if (r.alertOn?.length) o.alertOn = r.alertOn;
  if (r.discount) o.discount = r.discount;
  if (r.pay?.length) o.pay = r.pay;
  if (r.never?.trim()) o.never = r.never.trim().slice(0, 400);
  if (r.night?.on || r.night?.text?.trim()) o.night = { on: !!r.night.on, text: (r.night.text ?? "").trim().slice(0, 400) };
  return Object.keys(o).length ? o : undefined;
}

/** `keys` = the fields this box owns: a save keeps every other field as the card has it now (the other box may have saved since). */
function useRules({ card, onSaved, hi }: P, keys: (keyof BotRules)[]) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [r, setR] = useState<BotRules>(() => card.botRules ?? {});
  const own = (x: BotRules) => JSON.stringify(keys.map((k) => (clean({ [k]: x[k] } as BotRules) ?? {})[k] ?? null));
  const [base, setBase] = useState(() => own(card.botRules ?? {}));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const dirty = own(r) !== base;
  async function save() {
    setBusy(true); setNote(null);
    const merged: BotRules = { ...(card.botRules ?? {}) };
    for (const k of keys) (merged as Record<string, unknown>)[k] = r[k];
    const rules = clean(merged);
    const next: Card = { ...card, botRules: rules };
    const res = await publishCard(next).catch(() => ({ ok: false }));
    setBusy(false);
    if (!res.ok) { setNote({ text: T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।"), bad: true }); return; }
    setBase(own(r)); onSaved(next);
    setNote({ text: T("✅ Saved. The website chat follows it now, WhatsApp within 5 minutes.", "✅ Save हो गया। Website chat में अभी से, WhatsApp पर 5 मिनट में।") });
  }
  return { r, setR, dirty, busy, note, save, T };
}

function SaveBar({ dirty, busy, note, save, T }: { dirty: boolean; busy: boolean; note: { text: string; bad?: boolean } | null; save: () => void; T: (en: string, h: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={save} disabled={!dirty || busy} className="rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : dirty ? T("Save", "Save करें") : T("Saved ✓", "Saved ✓")}</button>
      {note && <span className={`text-xs font-semibold ${note.bad ? "text-danger" : "text-good"}`}>{note.text}</span>}
    </div>
  );
}

/** The five things most owners want to set, one tap each. */
export function AiQuickSetup(props: P) {
  const { r, setR, dirty, busy, note, save, T } = useRules(props, ["lang", "tasks", "price"]);
  const [on, setOn] = useState<boolean | null>(null);
  const [swBusy, setSwBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void api<{ enabled?: boolean }>("/api/wa/config").then((x) => { if (live) setOn(x.ok ? x.data.enabled !== false : null); }).catch(() => { if (live) setOn(null); });
    return () => { live = false; };
  }, []);
  async function master() {
    if (on === null) return;
    setSwBusy(true);
    const x = await api<{ enabled?: boolean }>("/api/wa/config", { method: "POST", json: { enabled: !on } }).catch(() => null);
    setSwBusy(false);
    if (x?.ok) setOn(x.data.enabled !== false);
  }
  const t = r.tasks ?? {};
  const setTask = (k: "order" | "booking" | "callback") => setR({ ...r, tasks: { ...t, [k]: t[k] === false } });
  const LANGS: [NonNullable<BotRules["lang"]>, string, string][] = [
    ["hi", "Hindi for everyone", "सबसे हिंदी में"], ["mirror", "The customer's language", "Customer की भाषा में"],
    ["en", "English", "English"], ["hinglish", "Hinglish (Roman letters)", "Hinglish (Roman में)"],
  ];
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{T("AI replies on WhatsApp", "WhatsApp पर AI जवाब")}</p>
          <p className="text-[11px] text-muted">{on === null ? T("Link WhatsApp first (section 3).", "पहले WhatsApp जोड़ें (section 3)।") : on ? T("On — the AI answers your customers.", "चालू — AI आपके customers को जवाब दे रहा है।") : T("Off — nothing is sent; messages are still saved as enquiries.", "बंद — कुछ नहीं जाता; messages enquiry में save होते रहते हैं।")}</p>
        </div>
        <button type="button" role="switch" aria-checked={!!on} disabled={on === null || swBusy} onClick={() => void master()} className={`${sw(!!on)} disabled:opacity-40`} aria-label={T("On / off", "चालू / बंद")}><span className={knob(!!on)} /></button>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-sm font-bold">{T("Language", "भाषा")}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">{LANGS.map(([k, en, h]) => <button key={k} type="button" onClick={() => setR({ ...r, lang: k })} className={chip((r.lang ?? "hi") === k)}>{T(en, h)}</button>)}</div>
        <p className="mt-1 text-[11px] text-muted">{T("If a customer asks for another language, the AI switches for them.", "Customer कोई और भाषा माँगे, तो AI उसी में बात करेगा।")}</p>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-sm font-bold">{T("What the AI may do", "AI क्या-क्या करे")}</p>
        <div className="mt-1.5 space-y-2">
          {([["order", "Take orders", "Order ले"], ["booking", "Book appointments", "Appointment / booking ले"], ["callback", "Take call-back requests", "Call-back के लिए number ले"]] as const).map(([k, en, h]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{T(en, h)}</span>
              <button type="button" role="switch" aria-checked={t[k] !== false} onClick={() => setTask(k)} className={sw(t[k] !== false)} aria-label={T(en, h)}><span className={knob(t[k] !== false)} /></button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted">{T("Each one taken goes to your Customers list. Turned off: the AI gives your number instead.", "हर order / booking आपकी Customers list में जाता है। बंद हो, तो AI आपका number दे देता है।")}</p>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-sm font-bold">{T("Prices", "दाम")}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setR({ ...r, price: "tell" })} className={chip(r.price !== "call")}>{T("Tell the prices on my card", "Card पर लिखे दाम बताए")}</button>
          <button type="button" onClick={() => setR({ ...r, price: "call" })} className={chip(r.price === "call")}>{T("Never tell — I will quote", "दाम न बताए — मैं खुद बताऊँगा")}</button>
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} note={note} save={() => void save()} T={T} />
    </div>
  );
}

/** Everything else, folded away until wanted. */
export function AiMoreSettings(props: P) {
  const { r, setR, dirty, busy, note, save, T } = useRules(props, ["name", "ask", "askOwn", "alertOn", "discount", "pay", "never", "night"]);
  const [open, setOpen] = useState(false);
  const toggle = <K extends "ask" | "alertOn" | "pay">(k: K, v: NonNullable<BotRules[K]>[number]) => {
    const cur = (r[k] ?? []) as string[];
    setR({ ...r, [k]: cur.includes(v as string) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const has = (k: "ask" | "alertOn" | "pay", v: string) => ((r[k] ?? []) as string[]).includes(v);
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 p-3.5 text-left">
        <ChevronDown className={`h-4 w-4 text-brand transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="flex-1"><b className="block text-sm">{T("More settings", "और settings")}</b><span className="block text-[11px] text-muted">{T("AI's name, what to ask, when to call you, discount, payment, never say, night", "AI का नाम, क्या पूछे, कब बुलाए, छूट, payment, क्या न कहे, रात")}</span></span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-3.5">
          <label className="block"><span className="text-sm font-bold">{T("AI's name (optional)", "AI का नाम (ज़रूरी नहीं)")}</span>
            <input value={r.name ?? ""} onChange={(e) => setR({ ...r, name: e.target.value })} maxLength={30} placeholder={T("e.g. Priya", "जैसे: Priya")} className={`${field} mt-1`} />
            <span className="mt-1 block text-[11px] text-muted">{T("Empty: the AI calls itself your assistant.", "खाली: AI खुद को आपका assistant बताता है।")}</span></label>

          <div><p className="text-sm font-bold">{T("Find out from a new customer", "नए customer से पूछे")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{([["name", "Name", "नाम"], ["city", "City / area", "शहर / इलाक़ा"], ["budget", "Budget", "Budget"], ["when", "When they need it", "कब चाहिए"]] as const).map(([k, en, h]) => <button key={k} type="button" onClick={() => toggle("ask", k)} className={chip(has("ask", k))}>{has("ask", k) ? "✓ " : ""}{T(en, h)}</button>)}</div>
            <input value={r.askOwn ?? ""} onChange={(e) => setR({ ...r, askOwn: e.target.value })} maxLength={120} placeholder={T("One more question of yours, e.g. Which size do you need?", "आपका एक और सवाल, जैसे: कौन सा size चाहिए?")} className={`${field} mt-2`} />
            <p className="mt-1 text-[11px] text-muted">{T("The AI asks one at a time, when it fits — never all at once.", "AI एक-एक करके, सही मौक़े पर पूछता है — सब एक साथ नहीं।")}</p></div>

          <div><p className="text-sm font-bold">{T("When to call you", "AI आपको कब बुलाए")}</p>
            <p className="text-[11px] text-muted">{T("Always: when a customer wants to buy now, books, complains or asks for you.", "हमेशा: जब customer अभी ख़रीदना चाहे, booking करे, शिकायत करे या आपसे बात करना चाहे।")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{([["big", "Also for a big order", "बड़े order पर भी"], ["every", "Also for every new enquiry", "हर नई enquiry पर भी"]] as const).map(([k, en, h]) => <button key={k} type="button" onClick={() => toggle("alertOn", k)} className={chip(has("alertOn", k))}>{has("alertOn", k) ? "✓ " : ""}{T(en, h)}</button>)}</div></div>

          <div><p className="text-sm font-bold">{T("Discount when a customer bargains", "मोल-भाव पर छूट")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{[0, 5, 10, 15, 20].map((d) => <button key={d} type="button" onClick={() => setR({ ...r, discount: d })} className={chip((r.discount ?? 0) === d)}>{d === 0 ? T("Never", "कभी नहीं") : T(`Up to ${d}%`, `${d}% तक`)}</button>)}</div></div>

          <div><p className="text-sm font-bold">{T("How customers can pay", "Customer कैसे pay करे")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">{([["upi", "UPI", "UPI"], ["cod", "Cash on delivery", "Cash on delivery"], ["shop", "At the shop", "दुकान पर"], ["card", "Card", "Card"]] as const).map(([k, en, h]) => <button key={k} type="button" onClick={() => toggle("pay", k)} className={chip(has("pay", k))}>{has("pay", k) ? "✓ " : ""}{T(en, h)}</button>)}</div></div>

          <label className="block"><span className="text-sm font-bold">{T("The AI must never say", "AI यह कभी न कहे")}</span>
            <textarea value={r.never ?? ""} onChange={(e) => setR({ ...r, never: e.target.value })} rows={2} maxLength={400} placeholder={T("e.g. Never promise same-day delivery. Never talk about other shops.", "जैसे: उसी दिन delivery का वादा न करे। दूसरी दुकानों की बात न करे।")} className={`${field} mt-1`} /></label>

          <div><div className="flex items-start gap-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-bold">{T("At night", "रात को")}</p><p className="text-[11px] text-muted">{T("Off: the AI answers day and night. On: outside your message hours (section 5) customers get this line once, and the AI waits for morning.", "बंद: AI दिन-रात जवाब देता है। चालू: आपके message के समय (section 5) के बाहर customer को यह line एक बार जाती है, और AI सुबह तक रुकता है।")}</p></div>
              <button type="button" role="switch" aria-checked={!!r.night?.on} onClick={() => setR({ ...r, night: { text: r.night?.text ?? "", on: !r.night?.on } })} className={sw(!!r.night?.on)} aria-label={T("On / off", "चालू / बंद")}><span className={knob(!!r.night?.on)} /></button>
            </div>
            {r.night?.on && <textarea value={r.night.text} onChange={(e) => setR({ ...r, night: { on: true, text: e.target.value } })} rows={2} maxLength={400} placeholder={T("e.g. Thank you {naam} 🙏 We will reply in the morning after 10.", "जैसे: धन्यवाद {naam} 🙏 हम सुबह 10 बजे के बाद जवाब देंगे।")} className={`${field} mt-2`} />}</div>

          <SaveBar dirty={dirty} busy={busy} note={note} save={() => void save()} T={T} />
        </div>
      )}
    </div>
  );
}

/** Ready questions for this kind of business: one tap puts the question in the box, the owner writes only the answer. */
export function readyQuestions(card: Card, hi: boolean): string[] {
  const k = `${card.seo?.categoryKey ?? ""} ${card.seo?.category ?? ""} ${card.jobTitle ?? ""}`.toLowerCase();
  const H = (en: string, h: string) => (hi ? h : en);
  if (/restaurant|cafe|dhaba|sweet|bakery|tiffin|cater|food|kitchen|mithai/.test(k)) return [H("Do you deliver at home?", "क्या home delivery है?"), H("What is the minimum order?", "Minimum order कितना है?"), H("Can I book a table / a party?", "Table या party booking हो सकती है?"), H("Is everything pure veg?", "क्या सब pure veg है?"), H("What are your timings?", "आपका समय क्या है?")];
  if (/clinic|doctor|dental|hospital|salon|spa|parlour|parlor|beauty|gym|yoga|physio|skin|hair/.test(k)) return [H("How do I book an appointment?", "Appointment कैसे book करें?"), H("What are the charges / fees?", "Charges / fees कितनी है?"), H("What are your timings?", "आपका समय क्या है?"), H("Do you come home?", "क्या आप घर आकर सेवा देते हैं?"), H("Is parking available?", "Parking है?")];
  if (/coach|school|tuition|class|academy|institute|training|teacher/.test(k)) return [H("What are the fees?", "Fees कितनी है?"), H("What are the batch timings?", "Batch का समय क्या है?"), H("Is there a free demo class?", "Free demo class है?"), H("Online or offline?", "Online है या offline?"), H("How many students in a batch?", "एक batch में कितने बच्चे?")];
  if (/repair|electric|plumb|clean|ac |pest|travel|tour|event|photo|carpent|paint|interior|service|mechanic|courier/.test(k)) return [H("What is the visit charge?", "Visit charge कितना है?"), H("How soon can you come?", "कितनी जल्दी आ सकते हैं?"), H("Is there a guarantee on the work?", "काम पर guarantee है?"), H("Which areas do you serve?", "किन इलाक़ों में सेवा देते हैं?"), H("How can I pay?", "Payment कैसे करें?")];
  return [H("How many days for delivery?", "Delivery कितने दिन में?"), H("Is cash on delivery available?", "Cash on delivery है?"), H("Can I return or exchange?", "Return या exchange हो सकता है?"), H("Do you give a wholesale / bulk rate?", "Wholesale / bulk rate मिलता है?"), H("Is there a warranty?", "Warranty है?")];
}
