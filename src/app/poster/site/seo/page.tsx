"use client";
// SEO — how the website shows on Google (owner, 14 Oct 2026: "SEO ko Card & Website page par niche ek tab banake, click kare
// to SEO page open ho"). The same panel the full editor carries, on a page of its own: the city, the areas, the search words
// and a live preview of the Google result; Save puts it on the live website.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, LoaderCircle } from "lucide-react";
import { isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";
import { UnlockDialog } from "@/lib/ai-access";
import { SeoPanel } from "@/components/editor/seo-panel";
import { SITE_HOST } from "@/lib/site-url";
import type { Card } from "@/lib/types";

export default function SiteSeoPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const { plan, loading } = usePlan();
  const [card, setCard] = useState<Card | null>(null);
  const [none, setNone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pay, setPay] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/site/seo"); return; }
      try {
        const cs = await fetchMyCardsStrict();
        // The card the hub showed (?card=), else the newest.
        const want = new URLSearchParams(window.location.search).get("card");
        const pick = cs.find((c) => c.id === want) ?? cs[0];
        if (pick) setCard(pick); else setNone(true);
      } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function save() {
    if (!card) return;
    setBusy(true); setErr(""); setMsg("");
    const r = await publishCard(card);
    setBusy(false);
    if (!r.ok) { setErr(r.error || T("Could not save. Please try again.", "Save नहीं हुआ। दोबारा try करें।")); return; }
    setMsg(T("Saved. It is on your website now.", "Save हो गया। Website पर आ गया है।"));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/poster/site"))} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-lg font-bold">{T("Show on Google", "Google पर दिखें")}</h1>
      </div>
      <p className="text-sm text-muted">{T("Tell Google where you are and what you do. Then people who search for your work in your city can find you.", "Google को बताइए आप कहाँ हैं और क्या काम करते हैं, ताकि आपके शहर में आपका काम खोजने वाले आपको ढूँढ सकें।")}</p>
      {!loading && plan === "free" && (
        <section className="space-y-2 rounded-2xl border-2 border-brand bg-brand-soft/50 p-4">
          <p className="font-bold">{T("Be found on Google — with a subscription", "Google पर लोग आपको ढूँढ पाएँगे — subscription के साथ")}</p>
          <ul className="space-y-1 text-sm">
            <li>✓ {T("Customers who search for your work in your city can find your website", "आपके शहर में आपका काम खोजने वाले ग्राहक आपकी website तक पहुँचें")}</li>
            <li>✓ {T("Your shop, timings, products and common questions show up on Google and Maps", "आपकी दुकान, timing, products और आम सवाल Google और Maps में दिखें")}</li>
            <li>✓ {T("Search words, page titles and a page for every product — all done for you", "खोज के शब्द, titles और हर product का अपना page — सब अपने आप")}</li>
          </ul>
          <p className="text-xs text-muted">{T("Fill this in now. From the day you subscribe, Google can start showing your website.", "अभी भर लीजिए। Subscribe करने के दिन से Google आपकी website दिखाना शुरू कर सकता है।")}</p>
          <button type="button" onClick={() => setPay(true)} className="w-full rounded-xl grad-brand py-3 text-sm font-semibold text-white">{T("Subscribe and show on Google", "Subscribe करें और Google पर दिखें")}</button>
        </section>
      )}
      {pay && <UnlockDialog subscriptionOnly onClose={() => setPay(false)} />}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {none ? (
        <section className="space-y-3 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted">{T("Make your website first.", "पहले अपनी website बनाएँ।")}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("Make my website →", "मेरी website बनाएँ →")}</Link>
        </section>
      ) : !card ? (
        <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
      ) : (
        <>
          <SeoPanel card={card} onChange={(p) => { setMsg(""); setCard((c) => (c ? { ...c, ...p } : c)); }} address={`${SITE_HOST}/c/${card.username}`} />
          {msg && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {msg}</p>}
          <button type="button" onClick={save} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T("Save", "Save करें")}
          </button>
        </>
      )}
    </div>
  );
}
