"use client";
// "AI Training" (owner, 14 Oct 2026: "brand ke niche ek tab banao AI Training, aur AI related sab is tab me dal do"): every
// setting that teaches or drives the AI, in one place and in the order a person thinks of it — what the AI bot knows and
// can send, changing the website by talking, the WhatsApp AI replies, and writing the whole website again. These used to
// sit on the Card & Website page, between the link and the edit tiles.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, ChevronRight, LoaderCircle, MessageCircle, Mic, Sparkles } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";
import { BotSiteBox } from "@/components/poster/bot-site-box";
import { CardChatEdit } from "@/components/poster/card-chat-edit";
import type { Card } from "@/lib/types";

type Status = { hasCard: boolean; cardId?: string; url?: string; error?: string };

export default function AiTrainingPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const { plan, loading: planLoading } = usePlan();
  const paid = planLoading || plan !== "free";
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
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.push("/login?next=/poster/ai"); return; } void load(); })(); }, [router, load]);

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
          <p className="text-sm text-muted">{T("Make your website first — the AI learns from it.", "पहले अपनी website बनाएँ — AI उसी से सीखता है।")}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("Make my website →", "मेरी website बनाएँ →")}</Link>
        </section>
      ) : (
        <>
          <section>
            {sec(1, T("What your AI bot knows and sends", "आपका AI bot क्या जानता और भेजता है"), T("Your own website, brochures, price lists, a demo video.", "आपकी अपनी website, brochure, price list, demo video।"))}
            <BotSiteBox card={card} onChanged={(c) => { setCard(c); void load(); }} />
          </section>

          <section>
            {sec(2, T("Change your website by talking", "बोलकर website बदलें"), T("Say what you want to change, in your own words. You see the changes before they go on your website.", "अपने शब्दों में बताइए क्या बदलना है। Website पर लगने से पहले आपको बदलाव दिखते हैं।"))}
            <CardChatEdit card={card} locked={!paid} url={status.url ?? ""} onChanged={(c) => { setCard(c); void load(); }} />
          </section>

          <section>
            {sec(3, T("WhatsApp AI replies", "WhatsApp पर AI के जवाब"), T("Link your number once; the AI answers your customers there.", "अपना number एक बार जोड़िए; AI वहीं ग्राहकों को जवाब देगा।"))}
            <Link href="/poster/connect" className={row}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><MessageCircle className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm">{T("Link WhatsApp and turn on AI replies", "WhatsApp जोड़ें और AI जवाब चालू करें")}</b><span className="block text-xs text-muted">{T("Also Facebook, Instagram and Google live in Connections.", "Facebook, Instagram और Google भी Connections में हैं।")}</span></span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </section>

          <section>
            {sec(4, T("Write the whole website again", "पूरी website दोबारा लिखवाएँ"), T("New words and a new look from your latest details.", "आपकी ताज़ा जानकारी से नए शब्द और नया look।"))}
            <Link href="/poster/card/build?improve=1&ask=1" className={row}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Sparkles className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm">{T("Write again with AI", "AI से दोबारा लिखवाएँ")}</b><span className="block text-xs text-muted">{T("Premium: new words, a new look, new photos if you want.", "Premium: नए शब्द, नया look, चाहें तो नई photos।")}</span></span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
          </section>
          <p className="flex items-center gap-1.5 text-[11px] text-muted"><Mic className="h-3.5 w-3.5" /> {T("Tip: the mic in step 2 types what you say.", "टिप: दूसरे हिस्से का mic आपकी बोली हुई बात लिख देता है।")}</p>
        </>
      )}
    </div>
  );
}
