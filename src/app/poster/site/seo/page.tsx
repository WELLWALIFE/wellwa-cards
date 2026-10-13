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

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/site/seo"); return; }
      try { const cs = await fetchMyCardsStrict(); if (cs[0]) setCard(cs[0]); else setNone(true); } catch { setErr(T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।")); }
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
        <Link href="/poster/site" className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-lg font-bold">{T("SEO · show on Google", "SEO · Google पर दिखें")}</h1>
      </div>
      <p className="text-sm text-muted">{T("Tell Google where you are and what you do, so people searching “your trade in your city” find you.", "Google को बताइए आप कहाँ हैं और क्या करते हैं, ताकि “आपका काम + आपका शहर” खोजने वालों को आप मिलें।")}</p>
      {!loading && plan === "free" && <p className="rounded-xl bg-brand-soft/50 px-3 py-2 text-xs text-ink">{T("Google lists your website with Premium. You can fill this in now; it starts working when you upgrade.", "Google पर आपकी website Premium के साथ दिखती है। अभी भर सकते हैं; upgrade करते ही काम शुरू हो जाएगा।")}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {none ? (
        <section className="space-y-3 rounded-xl border border-border p-4 text-center">
          <p className="text-sm text-muted">{T("Build your website first.", "पहले अपनी website बनाएँ।")}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("Build my website →", "Website बनाएँ →")}</Link>
        </section>
      ) : !card ? (
        <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
      ) : (
        <>
          <SeoPanel card={card} onChange={(p) => setCard((c) => (c ? { ...c, ...p } : c))} address={`${SITE_HOST}/c/${card.username}`} />
          {msg && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {msg}</p>}
          <button type="button" onClick={save} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {T("Save", "Save करें")}
          </button>
        </>
      )}
    </div>
  );
}
