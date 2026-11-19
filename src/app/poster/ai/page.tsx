"use client";
// "AI Training" (owner, 14 Oct 2026: "brand ke niche ek tab banao AI Training, aur AI related sab is tab me dal do"): every
// setting that teaches or drives the AI, in one place and in the order a person thinks of it — what the AI bot knows and
// can send, changing the website by talking, the WhatsApp AI replies, and writing the whole website again. These used to
// sit on the Card & Website page, between the link and the edit tiles.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, ChevronRight, LoaderCircle, MessageCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import { BotSiteBox } from "@/components/poster/bot-site-box";
import { AiMessages } from "@/components/poster/ai-messages";
import { CardChat } from "@/components/card-chat";
import { publishCard } from "@/lib/cloud";
import type { Card } from "@/lib/types";

type Status = { hasCard: boolean; cardId?: string; url?: string; error?: string };

export default function AiTrainingPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [status, setStatus] = useState<Status | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await api<Status>("/api/site/status");
      if (!r.ok) { setErr(r.data?.error || T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); return; }
      setStatus(r.data);
      if (r.data.hasCard) { const cs = await fetchMyCardsStrict(); setCard(cs.find((c) => c.id === r.data.cardId) ?? cs[0] ?? null); }
    } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // replace, not push: Back from the login screen must not land here and bounce straight back to it.
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace("/login?next=/poster/ai"); return; } void load(); })(); }, [router, load]);

  const sec = (n: number, title: string, sub: string) => (
    <div className="mb-2"><h2 className="text-base font-bold">{n}. {title}</h2><p className="text-xs text-muted">{sub}</p></div>
  );
  const row = "flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left";

  if (!status) return err
    ? <div className="py-16 text-center space-y-3"><p className="font-semibold">{err}</p><button type="button" onClick={() => void load()} className="rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white">{T("Try again", "दोबारा try करें")}</button></div>
    : <div className="py-20 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold"><Bot className="h-5 w-5 text-brand" /> {T("AI Training", "AI Training")}</h1>
        <p className="mt-1 text-sm text-muted">{T("Teach your AI what it should know and what it can do for you.", "अपने AI को सिखाइए कि उसे क्या पता होना चाहिए और वह आपके लिए क्या करे।")}</p>
      </div>

      {!status.hasCard || !card ? (
        <section className="space-y-3 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted">{T("Make your card first — the AI learns from it.", "पहले अपना card बनाएँ — AI उसी से सीखता है।")}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("Make my card →", "मेरा card बनाएँ →")}</Link>
        </section>
      ) : (
        <>
          <section>
            {sec(1, T("What your AI knows and sends", "आपका AI क्या जानता और भेजता है"), T("Prices, details, common questions, brochures, a demo video.", "दाम, जानकारी, आम सवाल-जवाब, brochure, demo video।"))}
            <BotSiteBox card={card} trainOnly onChanged={(c) => { setCard(c); void load(); }} />
          </section>

          <section>
            {sec(2, T("Link WhatsApp", "WhatsApp जोड़ें"), T("Link your number once; the AI answers your customers there.", "अपना number एक बार जोड़िए; AI वहीं ग्राहकों को जवाब देगा।"))}
            <Link href="/poster/connect" className={row}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><MessageCircle className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm">{T("Link WhatsApp and turn on AI replies", "WhatsApp जोड़ें और AI जवाब चालू करें")}</b><span className="block text-xs text-muted">{T("Also Facebook, Instagram and Google live in Connections.", "Facebook, Instagram और Google भी Connections में हैं।")}</span></span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </section>

          <section>
            {sec(3, T("AI's messages, one after another", "AI के messages — एक के बाद एक"), T("The first message, then the next ones on the days you choose. All optional.", "पहला message, फिर अगले messages आपके चुने दिनों पर। सब ज़रूरी नहीं।"))}
            <AiMessages card={card} onSaved={setCard} />
          </section>

          <section>
            {sec(4, T("How your AI talks", "आपका AI कैसे बात करे"), T("Language and manner. Leave empty and it talks like a polite shop assistant.", "भाषा और अंदाज़। खाली छोड़ें तो AI एक विनम्र दुकान वाले की तरह बात करता है।"))}
            <AiTone card={card} onSaved={setCard} hi={hi} />
          </section>

          <section>
            {sec(5, T("Talk to your AI", "अपने AI से बात करके देखें"), T("Ask it something as a customer would — the chat button at the bottom right.", "Customer की तरह कुछ पूछिए — नीचे दाएँ कोने का chat button दबाइए।"))}
            {status.url && <a href={`${status.url}?view=site`} target="_blank" rel="noreferrer" className={row}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Bot className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm">{T("Open my website and chat with the AI", "मेरी website खोलकर AI से बात करें")}</b><span className="block text-xs text-muted">{T("The same AI answers on WhatsApp.", "WhatsApp पर भी यही AI जवाब देता है।")}</span></span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </a>}
            <CardChat username={card.username} name={card.name} theme={card.themeColor || "#2f5bf5"} />
          </section>
          <p className="text-[11px] text-muted">{T("Changing the website (by talking, or writing it again) is on Card & Website.", "Website बदलना (बोलकर, या दोबारा लिखवाना) Card & Website में है।")} <a href="/poster/site" className="font-semibold text-brand-ink underline">{T("Open", "खोलें")}</a></p>
        </>
      )}
    </div>
  );
}

/** The AI's manner (card.botPersona): a few taps, or the owner's own words. */
const TONES: [string, string, string][] = [
  ["hindi", "Always reply in simple Hindi (Devanagari).", "हमेशा आसान हिंदी"],
  ["mirror", "Reply in the customer's own language.", "Customer की भाषा में"],
  ["friendly", "Warm and friendly, like a family shop.", "दोस्ताना, घर की दुकान जैसा"],
  ["pro", "Polite and professional.", "विनम्र और professional"],
  ["short", "Keep replies short: two or three lines.", "छोटे जवाब — 2-3 line"],
];
function AiTone({ card, onSaved, hi }: { card: Card; onSaved: (c: Card) => void; hi: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [text, setText] = useState(card.botPersona ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const has = (line: string) => text.includes(line);
  const toggle = (line: string) => setText((t) => (t.includes(line) ? t.replace(line, "").replace(/\s{2,}/g, " ").trim() : `${t.trim()} ${line}`.trim()));
  async function save() {
    setBusy(true); setNote(null);
    const next = { ...card, botPersona: text.trim().slice(0, 600) || undefined };
    const r = await publishCard(next).catch(() => ({ ok: false } as { ok: false; error?: string }));
    setBusy(false);
    if (!r.ok) { setNote({ text: T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।"), bad: true }); return; }
    onSaved(next); setNote({ text: T("✅ Saved.", "✅ Save हो गया।") });
  }
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex flex-wrap gap-2">
        {TONES.map(([k, line, h]) => <button key={k} type="button" onClick={() => toggle(line)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${has(line) ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}>{has(line) ? "✓ " : ""}{hi ? h : line.replace(/\.$/, "")}</button>)}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600} placeholder={T("Or write it yourself, e.g. Call the customer “ji”, never argue about price, always offer free delivery above ₹999.", "या खुद लिखें, जैसे: Customer को “जी” कहकर बात करें, दाम पर बहस न करें, ₹999 से ऊपर free delivery ज़रूर बताएँ।")} className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || text.trim() === (card.botPersona ?? "").trim()} className="rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "…" : T("Save", "Save करें")}</button>
        {note && <span className={`text-xs font-semibold ${note.bad ? "text-danger" : "text-good"}`}>{note.text}</span>}
      </div>
    </div>
  );
}
