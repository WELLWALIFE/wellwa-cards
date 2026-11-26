"use client";
// AI Training: who the AI answers (personal WhatsApp numbers — owner, 20 Nov 2026: "zyadatar log apna personal WhatsApp connect
// karenge"), the "shop closed" line, the week's report and the customers the AI called the owner for.
import { useEffect, useState } from "react";
import { Help } from "@/components/poster/field-help";
import { Check, LoaderCircle, X } from "lucide-react";
import type { BotFollow, Card } from "@/lib/types";
import { publishCard } from "@/lib/cloud";
import { api } from "@/lib/poster-client";

type P = { card: Card; onSaved: (c: Card) => void; hi: boolean };
const sw = (on: boolean) => `relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-border"}`;
const knob = (on: boolean) => `absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`;

/** Saves one part of the plan, keeping the rest of it. */
async function savePlan(card: Card, patch: Partial<BotFollow>): Promise<Card | null> {
  const merged: BotFollow = { ...(card.botFollow ?? {}), ...patch };
  if (!merged.onlyNew) delete merged.onlyNew;
  if (!merged.away || (!merged.away.on && !merged.away.text.trim())) delete merged.away;
  const next: Card = { ...card, botFollow: Object.keys(merged).length ? merged : undefined };
  const r = await publishCard(next).catch(() => ({ ok: false }));
  return r.ok ? next : null;
}

/** Personal and customer apart: only new numbers, the personal-numbers list, and the honest advice. */
export function AiWho({ card, onSaved, hi }: P) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [nums, setNums] = useState<string[] | null>(null);
  const [add, setAdd] = useState("");
  const onlyNew = card.botFollow?.onlyNew === true;
  const load = async () => { const r = await api<{ numbers: string[] }>("/api/crm/block").catch(() => null); setNums(r?.ok ? r.data.numbers ?? [] : []); };
  useEffect(() => { void load(); }, []);
  async function toggle() {
    setBusy("new"); setErr("");
    const next = await savePlan(card, { onlyNew: !onlyNew });
    setBusy("");
    if (next) onSaved(next); else setErr(T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।"));
  }
  async function block() {
    const d = add.replace(/\D/g, "").slice(-10);
    if (d.length !== 10) { setErr(T("Enter a 10-digit mobile number.", "10 अंकों का mobile number डालें।")); return; }
    setBusy("add"); setErr("");
    const r = await api<{ error?: string }>("/api/crm/block", { method: "POST", json: { phone: d } }).catch(() => null);
    setBusy("");
    if (!r?.ok) { setErr(r?.data.error || T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।")); return; }
    setAdd(""); void load();
  }
  async function unblock(n: string) {
    setBusy(n); setErr("");
    const r = await api<{ error?: string }>(`/api/crm/block?phone=${encodeURIComponent(n)}`, { method: "DELETE" }).catch(() => null);
    setBusy("");
    if (!r?.ok) { setErr(T("Could not remove — try again.", "हटा नहीं — दोबारा try करें।")); return; }
    void load();
  }
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3.5">
      <p className="rounded-xl bg-brand-soft/50 px-3 py-2 text-xs text-ink">💡 {T("Best: keep a separate number for the business (a second SIM with the free WhatsApp Business app) and put that number on your card and ads. Then personal and customer chats never mix.", "सबसे अच्छा: business के लिए अलग number रखें (दूसरा SIM, उस पर free WhatsApp Business app) और वही number card और ads पर डालें। तब personal और customer की chat कभी नहीं मिलेगी।")}</p>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{T("Answer only new numbers", "सिर्फ़ नए number को जवाब दे")}<Help k="aiOnlyNew" /></p>
          <p className="text-[11px] text-muted">{T("People you already had a WhatsApp chat with when you linked your number (family, friends, old customers) get no AI reply — you answer them yourself. Someone who comes from an ad is always answered.", "जिनसे number जोड़ते समय पहले से WhatsApp chat थी (परिवार, दोस्त, पुराने customer), उन्हें AI जवाब नहीं देगा — आप खुद देंगे। Ad से आया हर व्यक्ति customer माना जाएगा।")}</p>
        </div>
        <button type="button" role="switch" aria-checked={onlyNew} disabled={busy === "new"} onClick={() => void toggle()} className={sw(onlyNew)} aria-label={T("On / off", "चालू / बंद")}><span className={knob(onlyNew)} /></button>
      </div>
      {!onlyNew && <p className="text-[11px] text-muted">{T("Off: the AI reads each message and stays silent when it looks personal (it can guess wrong sometimes).", "बंद: AI हर message पढ़कर personal लगे तो चुप रहता है (कभी-कभी अंदाज़ा ग़लत हो सकता है)।")}</p>}
      <div className="border-t border-border pt-3">
        <p className="text-sm font-bold">🚫 {T("Personal numbers — the AI never replies", "Personal numbers — AI कभी जवाब नहीं देगा")}<Help k="aiPersonal" /></p>
        <p className="text-[11px] text-muted">{T("Add family and friends once. They are kept out of your customer list too.", "परिवार और दोस्तों के number एक बार जोड़ दें। ये customer list में भी नहीं आएँगे।")}</p>
        <div className="mt-2 flex gap-2">
          <input value={add} onChange={(e) => setAdd(e.target.value)} inputMode="numeric" maxLength={14} placeholder={T("10-digit mobile number", "10 अंकों का mobile number")} className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
          <button type="button" onClick={() => void block()} disabled={busy === "add" || !add.trim()} className="rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "add" ? "…" : T("Add", "जोड़ें")}</button>
        </div>
        {nums === null ? <LoaderCircle className="mt-2 h-4 w-4 animate-spin text-muted" /> : nums.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {nums.map((n) => <li key={n} className="inline-flex items-center gap-1 rounded-full border border-border bg-bg py-1 pl-2.5 pr-1 text-xs">{n}<button type="button" onClick={() => void unblock(n)} disabled={busy === n} className="grid h-5 w-5 place-items-center rounded-full text-muted" aria-label={T("Remove", "हटाएँ")}><X className="h-3.5 w-3.5" /></button></li>)}
          </ul>
        )}
      </div>
      {err && <p className="text-xs font-semibold text-danger">{err}</p>}
    </div>
  );
}

/** Shop closed / on leave: one line of the owner's, the enquiry saved, the AI waits. */
export function AiAway({ card, onSaved, hi }: P) {
  const T = (en: string, h: string) => (hi ? h : en);
  const cur = card.botFollow?.away;
  const [on, setOn] = useState(cur?.on === true);
  const [text, setText] = useState(cur?.text ?? "");
  const [until, setUntil] = useState(cur?.until ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const dirty = on !== (cur?.on === true) || text.trim() !== (cur?.text ?? "").trim() || until !== (cur?.until ?? "");
  async function save() {
    if (on && !text.trim()) { setNote({ text: T("Write the line the customer should get.", "वह line लिखें जो customer को जानी है।"), bad: true }); return; }
    setBusy(true); setNote(null);
    const next = await savePlan(card, { away: { on, text: text.trim().slice(0, 500), ...(until ? { until } : {}) } });
    setBusy(false);
    if (!next) { setNote({ text: T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।"), bad: true }); return; }
    onSaved(next);
    setNote({ text: on ? T("✅ On. Customers get this line; their enquiry is saved for you.", "✅ चालू। Customer को यही line जाएगी; उनकी enquiry आपके लिए save रहेगी।") : T("✅ Off. The AI answers as usual.", "✅ बंद। AI पहले की तरह जवाब देगा।") });
  }
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{T("We are closed / on leave", "दुकान बंद / छुट्टी पर")}</p>
          <p className="text-[11px] text-muted">{T("While it is on, each customer gets your line once (not again for 12 hours), their enquiry is saved, and the AI sends nothing else.", "चालू रहने तक हर customer को आपकी line एक बार जाती है (12 घंटे तक दोबारा नहीं), enquiry save होती है, और AI कुछ और नहीं भेजता।")}</p>
        </div>
        <button type="button" role="switch" aria-checked={on} onClick={() => setOn((v) => !v)} className={sw(on)} aria-label={T("On / off", "चालू / बंद")}><span className={knob(on)} /></button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={500} placeholder={T("e.g. Namaste {naam} 🙏 We are closed for Diwali till 12 Nov. Your message is with us — we will reply on the 13th.", "जैसे: नमस्ते {naam} 🙏 दिवाली पर 12 Nov तक दुकान बंद है। आपका message हमारे पास है — 13 को जवाब देंगे।")} className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand" />
      <label className="flex flex-wrap items-center gap-2 text-xs text-muted">{T("Turn off by itself after (optional):", "इस तारीख़ के बाद अपने-आप बंद (ज़रूरी नहीं):")} <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-ink" /></label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || !dirty} className="rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : T("Save", "Save करें")}</button>
        {note && <span className={`text-xs font-semibold ${note.bad ? "text-danger" : "text-good"}`}>{note.text}</span>}
      </div>
    </div>
  );
}

type Stats = { total: { in: number; replies: number; followups: number; alerts: number; desk?: number; stock?: number; orders?: number; bookings?: number; forms?: number; ratings?: number }; today: { in: number; replies: number }; picks?: { label: string; n: number }[] };
type Ask = { at: number; name: string; why: string; text: string };

/** The week on WhatsApp in four numbers, and the messages where the AI called the owner — each can become a taught answer. */
export function AiReport({ card, onSaved, hi }: P) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [st, setSt] = useState<Stats | null | "off">(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [open, setOpen] = useState(0);
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      const s = await api<Stats>("/api/wa/stats").catch(() => null);
      const a = await api<{ asks: Ask[] }>("/api/wa/asks").catch(() => null);
      if (!live) return;
      setSt(s?.ok && s.data.total ? s.data : "off");
      setAsks(a?.ok && Array.isArray(a.data.asks) ? a.data.asks : []);
    })();
    return () => { live = false; };
  }, []);
  const done = async (at: number) => { await api("/api/wa/asks/done", { method: "POST", json: { at } }).catch(() => null); setAsks((l) => l.filter((x) => x.at !== at)); setOpen(0); setAns(""); };
  async function teach(a: Ask) {
    if (!ans.trim()) return;
    setBusy(true); setErr("");
    const next: Card = { ...card, botKnowledge: `${(card.botKnowledge ?? "").trim()}${(card.botKnowledge ?? "").trim() ? "\n\n" : ""}Q: ${a.text.trim()}\nA: ${ans.trim()}`.slice(0, 40000) };
    const r = await publishCard(next).catch(() => ({ ok: false }));
    setBusy(false);
    if (!r.ok) { setErr(T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।")); return; }
    onSaved(next); void done(a.at);
  }
  const box = (n: number, label: string) => <div className="rounded-xl bg-surface2 px-2 py-2.5 text-center"><b className="block text-lg leading-none">{n}</b><span className="mt-1 block text-[10px] font-semibold text-muted">{label}</span></div>;
  if (st === null) return <LoaderCircle className="h-5 w-5 animate-spin text-muted" />;
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-3.5">
      {st === "off"
        ? <p className="text-xs text-muted">{T("The report starts once WhatsApp is linked.", "WhatsApp जुड़ते ही report शुरू हो जाएगी।")}</p>
        : (
          <>
            <p className="text-xs font-semibold text-muted">{T("Last 7 days on WhatsApp", "WhatsApp पर पिछले 7 दिन")} · {T(`today ${st.today.in} in, ${st.today.replies} answered`, `आज ${st.today.in} आए, ${st.today.replies} जवाब`)}</p>
            <div className="grid grid-cols-4 gap-2">
              {box(st.total.in, T("messages in", "message आए"))}{box(st.total.replies, T("AI replies", "AI के जवाब"))}{box(st.total.followups, T("follow-ups", "follow-up"))}{box(st.total.alerts, T("called you", "आपको बुलाया"))}
            </div>
            <p className="text-[11px] font-semibold text-muted">{T("Done by the bot on its own", "Bot ने खुद किया")}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {box(st.total.desk ?? 0, T("answers from your books", "आपके हिसाब से जवाब"))}{box(st.total.stock ?? 0, T("stock answers", "stock के जवाब"))}{box(st.total.orders ?? 0, T("orders taken", "order लिए"))}{box(st.total.bookings ?? 0, T("appointments", "appointment"))}{box(st.total.forms ?? 0, T("enquiry forms", "enquiry form"))}{box(st.total.ratings ?? 0, T("ratings", "rating"))}
            </div>
            {!!st.picks?.length && (
              <div>
                <p className="text-[11px] font-semibold text-muted">{T("Menu options pressed the most", "Menu में सबसे ज़्यादा दबाए गए option")}</p>
                <ul className="mt-1 space-y-1">
                  {st.picks.map((p) => <li key={p.label} className="flex items-center justify-between gap-2 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs"><span className="min-w-0 truncate">{p.label}</span><b>{p.n}</b></li>)}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-muted">{T("Counted from today on; earlier days show 0. Counted for the WhatsApp linked by QR.", "गिनती आज से शुरू हुई है; पहले के दिन 0 दिखेंगे। QR से जुड़े WhatsApp की गिनती।")}</p>
          </>
        )}
      <div className="border-t border-border pt-3">
        <p className="text-sm font-bold">{T("Where the AI called you", "जहाँ AI ने आपको बुलाया")}</p>
        <p className="text-[11px] text-muted">{T("The customer wanted you, or asked something the AI was not sure of. Write the answer once and the AI knows it next time.", "Customer को आप चाहिए थे, या उसने ऐसा कुछ पूछा जो AI को पक्का नहीं पता था। जवाब एक बार लिख दें, अगली बार AI खुद बता देगा।")}</p>
        {asks.length === 0
          ? <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Check className="h-3.5 w-3.5 text-good" />{T("Nothing waiting.", "कुछ बाक़ी नहीं।")}</p>
          : (
            <ul className="mt-2 space-y-2">
              {asks.slice(0, 12).map((a) => (
                <li key={a.at} className="rounded-xl border border-border p-2.5">
                  <p className="text-sm">“{a.text}”</p>
                  <p className="text-[11px] text-muted">{a.name || T("Customer", "Customer")} · {new Date(a.at).toLocaleString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}{a.why ? ` · ${a.why}` : ""}</p>
                  {open === a.at ? (
                    <div className="mt-2 space-y-2">
                      <textarea value={ans} onChange={(e) => setAns(e.target.value)} rows={2} maxLength={500} placeholder={T("The answer the AI should give next time", "अगली बार AI क्या जवाब दे")} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void teach(a)} disabled={busy || !ans.trim()} className="rounded-xl grad-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "…" : T("Teach the AI", "AI को सिखाएँ")}</button>
                        <button type="button" onClick={() => { setOpen(0); setAns(""); }} className="text-xs font-semibold text-muted">{T("Cancel", "रहने दें")}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex gap-3">
                      <button type="button" onClick={() => { setOpen(a.at); setAns(""); }} className="text-xs font-semibold text-brand-ink">{T("Write the answer", "जवाब लिखें")}</button>
                      <button type="button" onClick={() => void done(a.at)} className="text-xs font-semibold text-muted">{T("Not needed", "ज़रूरत नहीं")}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        {err && <p className="mt-2 text-xs font-semibold text-danger">{err}</p>}
      </div>
    </div>
  );
}
