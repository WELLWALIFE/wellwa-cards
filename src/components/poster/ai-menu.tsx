"use client";
// The numbered WhatsApp menu, made simple (owner, 20 Nov 2026: "isko thoda easy banao, redesign karo, jo easily samajh aaye"). One
// screen: a switch, the line on top, the options one under another — each with what happens when the customer sends its number, in
// three plain choices — and the message exactly as the customer sees it. Ready menus for the common kinds of business. Same data as
// CRM → Settings → Menu bot (/api/crm/flow): that editor stays for menus inside menus; a sub-menu made there is kept as it is here.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, X } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

type Act = "menu" | "text" | "ai" | "human" | "status" | "due" | "bill" | "book" | "address" | "offer" | "products" | "form";
type Opt = { label: string; action: Act; target?: string; reply?: string };
type Node = { id: string; title: string; text: string; options: Opt[] };
type Flow = { greetNew: boolean; triggers: string[]; nodes: Node[] };

const NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const MAX = 6;

/** Ready menus: a shop, a service / appointment business, food. */
function readyMenus(hi: boolean): { key: string; name: string; flow: Flow }[] {
  const H = (en: string, h: string) => (hi ? h : en);
  const top = H("Namaste 🙏 Welcome to {business}. What do you need?", "Namaste 🙏 {business} me aapka swagat hai. Aapko kya chahiye?");
  const mk = (options: Opt[]): Flow => ({ greetNew: true, triggers: [], nodes: [{ id: "main", title: "Main menu", text: top, options }] });
  return [
    { key: "shop", name: H("Shop", "दुकान"), flow: mk([
      { label: H("See products", "Products dekhne hain"), action: "text", reply: H("All our products with photos and prices: {card}", "Hamare saare products, photo aur daam ke saath: {card}") },
      { label: H("Prices and offers", "Daam aur offer"), action: "ai", reply: H("Sure — which item's price would you like?", "Ji, kis cheez ka daam jaanna hai?") },
      { label: H("Place an order", "Order karna hai"), action: "ai", reply: H("Great! What would you like, and how many?", "Zaroor! Kya chahiye aur kitna?") },
      { label: H("Address and timings", "Pata aur samay"), action: "ai" },
      { label: H("Talk to us", "Aapse baat karni hai"), action: "human" },
    ]) },
    // Shops that run their work in the app: the menu answers from the shop's own books (status, money due, bill).
    { key: "mobile", name: H("Mobile shop", "मोबाइल दुकान"), flow: mk([
      { label: H("Phones and accessories, with prices", "Phone aur accessories, daam ke saath"), action: "ai", reply: H("Sure — which phone or accessory are you looking for?", "Ji, kaun sa phone ya accessory chahiye?") },
      { label: H("Is my repair ready?", "Mera repair ban gaya?"), action: "status" },
      { label: H("My balance / pay by UPI", "Mera baaki paisa / UPI se dena hai"), action: "due" },
      { label: H("Send my bill", "Mera bill bhej do"), action: "bill" },
      { label: H("Address and timings", "Pata aur samay"), action: "address" },
      { label: H("Talk to the shopkeeper", "Dukaandaar se baat karni hai"), action: "human" },
    ]) },
    { key: "tailor", name: H("Tailor / boutique", "सिलाई / boutique"), flow: mk([
      { label: H("Is my order ready?", "Mera order taiyaar hai?"), action: "status" },
      { label: H("Stitching rates", "Silai ke rate"), action: "ai", reply: H("Sure — which garment?", "Ji, kaun sa kapda silwana hai?") },
      { label: H("Book a time for measurement", "Naap ke liye samay lena hai"), action: "book" },
      { label: H("Address and timings", "Pata aur samay"), action: "address" },
      { label: H("Talk to us", "Aapse baat karni hai"), action: "human" },
    ]) },
    { key: "jeweller", name: H("Jeweller", "ज्वेलर"), flow: mk([
      { label: H("Today's gold and silver rate", "Aaj ka sona-chaandi ka rate"), action: "ai" },
      { label: H("Is my order / repair ready?", "Mera order / repair taiyaar hai?"), action: "status" },
      { label: H("My balance", "Mera baaki paisa"), action: "due" },
      { label: H("Send my bill", "Mera bill bhej do"), action: "bill" },
      { label: H("Talk to us", "Aapse baat karni hai"), action: "human" },
    ]) },
    { key: "service", name: H("Service / appointment", "Service / appointment"), flow: mk([
      { label: H("Our services", "Hamari services"), action: "ai", reply: H("Which service are you looking for?", "Aapko kaun si service chahiye?") },
      { label: H("Charges", "Charges / fees"), action: "ai" },
      { label: H("Book an appointment", "Appointment book karni hai"), action: "book" },
      { label: H("Address and timings", "Pata aur samay"), action: "ai" },
      { label: H("Talk to us", "Aapse baat karni hai"), action: "human" },
    ]) },
    { key: "food", name: H("Food / restaurant", "Khana / restaurant"), flow: mk([
      { label: H("See the menu", "Menu dekhna hai"), action: "text", reply: H("Our full menu with prices: {card}", "Hamara poora menu, daam ke saath: {card}") },
      { label: H("Order for delivery", "Ghar par mangwana hai"), action: "ai", reply: H("Great! What would you like, and your address?", "Zaroor! Kya mangwana hai, aur aapka pata?") },
      { label: H("Book a table / party", "Table / party booking"), action: "ai", reply: H("For how many people, and which day and time?", "Kitne log, aur kaunsa din aur samay?") },
      { label: H("Timings", "Kab khula hai"), action: "ai" },
      { label: H("Talk to us", "Aapse baat karni hai"), action: "human" },
    ]) },
  ];
}

export function AiMenuSheet({ onClose }: { onClose: () => void }) {
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [on, setOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [base, setBase] = useState("");
  const [reset, setReset] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await api<{ enabled?: boolean; data?: Flow | null }>("/api/crm/flow").catch(() => null);
      const f = r?.ok && r.data.data && r.data.data.nodes?.length ? r.data.data : null;
      setFlow(f); setOn(!!(r?.ok && r.data.enabled)); setBase(JSON.stringify([!!(r?.ok && r.data.enabled), f])); setLoaded(true);
    })();
  }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const main = flow?.nodes[0];
  const setMain = (n: Node) => setFlow((f) => f && { ...f, nodes: [n, ...f.nodes.slice(1)] });
  const setOpt = (i: number, p: Partial<Opt>) => main && setMain({ ...main, options: main.options.map((o, j) => (j === i ? { ...o, ...p } : o)) });
  const move = (i: number, d: -1 | 1) => { if (!main) return; const o = main.options.slice(); const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setMain({ ...main, options: o }); };
  const dirty = JSON.stringify([on, flow]) !== base;
  const preview = main ? `${main.text}\n\n${main.options.filter((o) => o.label.trim()).map((o, i) => `${NUM[i]} ${o.label}`).join("\n")}\n\n${T("_Reply with a number_", "_Number likhkar bhejiye_")}` : "";

  async function save() {
    if (!flow || !main) return;
    if (!main.options.some((o) => o.label.trim())) { setNote({ text: T("Add at least one option.", "कम से कम एक option जोड़ें।"), bad: true }); return; }
    setBusy(true); setNote(null);
    const clean: Flow = { ...flow, nodes: [{ ...main, options: main.options.filter((o) => o.label.trim()) }, ...flow.nodes.slice(1)] };
    const r = await api<{ ok?: boolean; error?: string; enabled?: boolean }>("/api/crm/flow", { method: "PUT", json: { enabled: on, data: clean } }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setNote({ text: r?.data.error || T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।"), bad: true }); return; }
    setFlow(clean); setBase(JSON.stringify([on, clean]));
    setNote({ text: on ? T("✅ Saved. New customers get this menu within a minute.", "✅ Save हो गया। एक मिनट में नए customers को यही menu जाएगा।") : T("✅ Saved. The menu is off.", "✅ Save हो गया। Menu बंद है।") });
  }

  const actChip = (i: number, a: Act, en: string, h: string) => (
    <button type="button" onClick={() => setOpt(i, { action: a })} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${main?.options[i].action === a ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>{T(en, h)}</button>
  );

  const body = (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={T("Numbered menu", "Number वाला menu")}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-float sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1"><p className="text-base font-bold">{T("Numbered menu", "Number वाला menu")}</p><p className="text-[11px] text-muted">{T("A new customer gets this; they reply with a number.", "नए customer को यह जाता है; वह number लिखकर जवाब देता है।")}</p></div>
          <button type="button" onClick={onClose} aria-label={T("Close", "बंद करें")} className="rounded-full border border-border p-1.5 text-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* What the customer sees — fixed at the top (owner, 20 Nov 2026: "ye view window top me dikhao, jo bhi change karein wo live isme
            dikhe; window move nahi honi chahiye, neeche ka change karne wala move kar sakte hain"). Only the part below scrolls. */}
        {flow && main && (
          <div className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-2">
            <p className="text-xs font-bold text-muted">{T("What the customer sees", "Customer को ऐसा दिखेगा")}</p>
            <div className="mt-1.5 max-h-[34vh] overflow-y-auto rounded-2xl bg-[#e5ddd5] p-3 dark:bg-[#1f2c34]">
              <pre className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3 py-2 font-sans text-[13px] leading-relaxed text-[#111] shadow-sm dark:bg-[#005c4b] dark:text-white">{preview.replace(/\{business\}/g, T("your business", "आपका business"))}</pre>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!loaded ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted" /> : !flow || !main ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{T("Start from a ready menu", "तैयार menu से शुरू करें")}</p>
              {readyMenus(hi).map((m) => (
                <button key={m.key} type="button" onClick={() => { setFlow(m.flow); setOn(true); }} className="w-full rounded-2xl border border-border p-3 text-left">
                  <b className="block text-sm">{m.name}</b>
                  <span className="mt-0.5 block text-xs text-muted">{m.flow.nodes[0].options.map((o, i) => `${i + 1}. ${o.label}`).join(" · ")}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* 1 — on / off */}
              <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? "bg-good" : "bg-faint"}`} />
                <span className="flex-1 text-sm"><b>{on ? T("Menu is ON", "Menu चालू है") : T("Menu is OFF", "Menu बंद है")}</b><span className="block text-[11px] text-muted">{on ? T("Every new customer gets it first.", "हर नए customer को सबसे पहले यही जाएगा।") : T("Turn it on, then press Save.", "चालू करें, फिर Save दबाएँ।")}</span></span>
                <button type="button" role="switch" aria-checked={on} onClick={() => setOn((v) => !v)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-border"}`} aria-label={T("On / off", "चालू / बंद")}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></button>
              </div>

              {/* 2 — the line on top */}
              <label className="block">
                <span className="text-sm font-bold">{T("Line on top", "सबसे ऊपर की line")}</span>
                <textarea value={main.text} onChange={(e) => setMain({ ...main, text: e.target.value })} rows={2} maxLength={500} className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand" />
                <span className="text-[11px] text-muted">{T("{business} becomes your business name; {naam} the customer's first name.", "{business} की जगह आपके business का नाम आएगा।")}</span>
              </label>

              {/* 3 — the options */}
              <div className="space-y-2">
                <p className="text-sm font-bold">{T("Options", "Options")} <span className="font-normal text-muted">({main.options.length}/{MAX})</span></p>
                {main.options.map((o, i) => (
                  <div key={i} className="rounded-2xl border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                      <input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value.slice(0, 40) })} placeholder={T("What the customer sees, e.g. See products", "Customer को क्या दिखे, जैसे: Products dekhne hain")} className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-muted disabled:opacity-30" aria-label={T("Up", "ऊपर")}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === main.options.length - 1} className="p-1 text-muted disabled:opacity-30" aria-label={T("Down", "नीचे")}><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setMain({ ...main, options: main.options.filter((_, j) => j !== i) })} className="p-1 text-muted" aria-label={T("Remove", "हटाएँ")}><X className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-2 pl-9">
                      <p className="text-[11px] font-semibold text-muted">{T(`When they send ${i + 1}:`, `${i + 1} भेजने पर:`)}</p>
                      {o.action === "menu" ? (
                        <p className="mt-1 text-[11px] text-muted">{T("Opens another menu (made in CRM → Settings → Menu bot). Change it there, or pick:", "दूसरा menu खुलता है (CRM → Settings → Menu bot में बना)। वहीं बदलें, या चुनें:")}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {actChip(i, "ai", "The AI answers", "AI जवाब दे")}
                        {actChip(i, "text", "Send my reply", "मेरा जवाब भेजे")}
                        {actChip(i, "human", "Call me", "मुझे बुलाए")}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-muted">{T("Or answer from your shop's own records:", "या आपकी दुकान के अपने हिसाब से जवाब:")}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {actChip(i, "status", "Repair / order status", "रिपेयर / order का हाल")}
                        {actChip(i, "due", "What they owe", "उनका बाकी पैसा")}
                        {actChip(i, "bill", "Send their bill", "उनका बिल भेजे")}
                        {actChip(i, "book", "Book an appointment", "Appointment बुक करे")}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-muted">{T("Or answer from your card / website:", "या आपके card / website से जवाब:")}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {actChip(i, "products", "Products with prices", "Products दाम सहित")}
                        {actChip(i, "address", "Address, map, timings", "पता, map, समय")}
                        {actChip(i, "offer", "Today's offer", "आज का offer")}
                        {actChip(i, "form", "Ask enquiry questions", "Enquiry के सवाल पूछे")}
                      </div>
                      {o.action === "products" && <p className="mt-1.5 text-[11px] text-muted">{T("Sends the products on your card with their prices, up to 3 photos and your website link. No products on the card: the AI answers.", "आपके card के products दाम के साथ, 3 photo तक और website का link भेजता है। Card पर products न हों तो AI जवाब देता है।")}</p>}
                      {o.action === "address" && <p className="mt-1.5 text-[11px] text-muted">{T("Sends the address, Google Maps link, timings and phone from your card. Nothing on the card: the AI answers.", "आपके card से पता, Google Maps का link, समय और फ़ोन भेजता है। Card पर न हो तो AI जवाब देता है।")}</p>}
                      {o.action === "offer" && <p className="mt-1.5 text-[11px] text-muted">{T("Sends the notice and offers on your card (only while their date has not passed). None: the AI answers.", "आपके card का notice और offer भेजता है (जब तक उनकी तारीख़ न निकली हो)। न हो तो AI जवाब देता है।")}</p>}
                      {o.action === "form" && <p className="mt-1.5 text-[11px] text-muted">{T("Asks the questions you chose in AI Training → More settings → “Find out from a new customer”, one at a time. The answers go onto the customer in your CRM and you get a WhatsApp alert.", "AI Training → और settings → “नए customer से पूछे” में चुने सवाल एक-एक करके पूछता है। जवाब CRM में customer पर चढ़ जाते हैं और आपको WhatsApp पर alert आता है।")}</p>}
                      {o.action === "status" && <p className="mt-1.5 text-[11px] text-muted">{T("The customer is told where their repair, tailoring job or jewellery order stands — found by the number they write from, or by the job number they type.", "Customer को बताया जाता है कि उनका रिपेयर, सिलाई का काम या ज्वेलरी order कहाँ तक पहुँचा — जिस नंबर से लिख रहे हैं उससे, या उनके लिखे job नंबर से।")}</p>}
                      {o.action === "due" && <p className="mt-1.5 text-[11px] text-muted">{T("The customer gets their total udhaar, bill by bill, with the bill link (it has your UPI QR). Only their own number's bills.", "Customer को उनका कुल उधार मिलता है, बिल-दर-बिल, बिल के link के साथ (उस पर आपका UPI QR है)। सिर्फ़ उनके अपने नंबर के बिल।")}</p>}
                      {o.action === "bill" && <p className="mt-1.5 text-[11px] text-muted">{T("The customer gets the link of their latest bill.", "Customer को उनके सबसे नए बिल का link मिलता है।")}</p>}
                      {o.action === "book" && <p className="mt-1.5 text-[11px] text-muted">{T("The customer picks a day, then a free hour inside your message hours. It lands in your Bookings, you get a WhatsApp alert, and the reminders go by themselves.", "Customer दिन चुनता है, फिर आपके message के समय के अंदर खाली घंटा। ये आपकी Bookings में आ जाता है, आपको WhatsApp पर alert जाता है, और reminder अपने-आप जाते हैं।")}</p>}
                      {o.action === "text" && <textarea value={o.reply ?? ""} onChange={(e) => setOpt(i, { reply: e.target.value })} rows={2} maxLength={800} placeholder={T("Your reply, e.g. All our products: {card}", "आपका जवाब, जैसे: Hamare saare products: {card}")} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />}
                      {o.action === "ai" && <input value={o.reply ?? ""} onChange={(e) => setOpt(i, { reply: e.target.value })} maxLength={300} placeholder={T("First line before the AI (optional), e.g. Which item?", "AI से पहले की line (ज़रूरी नहीं), जैसे: Kis cheez ka?")} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />}
                      {o.action === "human" && <p className="mt-1.5 text-[11px] text-muted">{T("The customer is told you will talk to them; you get a WhatsApp alert and the AI stays quiet for 15 minutes.", "Customer को बताया जाता है कि आप खुद बात करेंगे; आपको WhatsApp पर alert जाता है और AI 15 मिनट चुप रहता है।")}</p>}
                      {o.action === "text" && <p className="mt-1 text-[11px] text-muted">{T("{card} becomes your website link.", "{card} की जगह आपकी website का link आएगा।")}</p>}
                    </div>
                  </div>
                ))}
                {main.options.length < MAX && <button type="button" onClick={() => setMain({ ...main, options: [...main.options, { label: "", action: "ai" }] })} className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-brand/50 py-2.5 text-sm font-semibold text-brand-ink"><Plus className="h-4 w-4" />{T("Add an option", "Option जोड़ें")}</button>}
                <p className="text-[11px] text-muted">{T("Anything the customer types that is not a number, the AI answers. Typing 0 shows the menu again.", "Number के अलावा customer जो भी लिखे, उसका जवाब AI देता है। 0 लिखने पर menu फिर से आता है।")}</p>
              </div>

              {reset ? (
                <span className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted">{T("Your changes here will be dropped.", "यहाँ के बदलाव हट जाएँगे।")}</span><button type="button" onClick={() => { setFlow(null); setReset(false); }} className="rounded-full border border-danger px-2.5 py-1 font-semibold text-danger">{T("Yes, start again", "हाँ, फिर शुरू करें")}</button><button type="button" onClick={() => setReset(false)} className="font-semibold text-muted underline">{T("No", "नहीं")}</button></span>
              ) : <button type="button" onClick={() => setReset(true)} className="text-xs font-semibold text-muted underline">{T("Start again from a ready menu", "तैयार menu से फिर शुरू करें")}</button>}
            </>
          )}
        </div>

        {flow && main && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <button type="button" onClick={() => void save()} disabled={busy || !dirty} className="rounded-xl grad-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : dirty ? T("Save", "Save करें") : T("Saved ✓", "Saved ✓")}</button>
            {note && <span className={`text-xs font-semibold ${note.bad ? "text-danger" : "text-good"}`}>{note.text}</span>}
          </div>
        )}
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}
