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
            {sec(1, T("What your AI knows and sends", "आपका AI क्या जानता और भेजता है"), T("Prices, specifications, your business plan, brochures, a demo video.", "Price, specification, business plan, brochure, demo video।"))}
            <BotSiteBox card={card} trainOnly onChanged={(c) => { setCard(c); void load(); }} />
          </section>

          <section>
            {sec(2, T("WhatsApp AI replies", "WhatsApp पर AI के जवाब"), T("Link your number once; the AI answers your customers there.", "अपना number एक बार जोड़िए; AI वहीं ग्राहकों को जवाब देगा।"))}
            <Link href="/poster/connect" className={row}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><MessageCircle className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm">{T("Link WhatsApp and turn on AI replies", "WhatsApp जोड़ें और AI जवाब चालू करें")}</b><span className="block text-xs text-muted">{T("Also Facebook, Instagram and Google live in Connections.", "Facebook, Instagram और Google भी Connections में हैं।")}</span></span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </section>
          <p className="text-[11px] text-muted">{T("Changing the website (by talking, or writing it again) is on Card & Website.", "Website बदलना (बोलकर, या दोबारा लिखवाना) Card & Website में है।")} <a href="/poster/site" className="font-semibold text-brand-ink underline">{T("Open", "खोलें")}</a></p>
        </>
      )}
    </div>
  );
}
