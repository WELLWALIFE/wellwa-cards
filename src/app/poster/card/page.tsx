"use client";
// "My V-Card" tab: share, QR and views of the owner's card. No real card yet → "Make your V-Card"
// (/poster/card/build), which makes it from the setup details. A failed load never counts as "no card".
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { LoaderCircle, ExternalLink, Pencil, Copy, Check, Share2, QrCode, Eye, Palette, Sparkles, Globe, RefreshCw, ChevronDown, CheckCircle2, Store } from "lucide-react";
import { SITE_URL } from "@/lib/site-url";
import { CardLink } from "@/components/poster/card-sheet";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import type { Card } from "@/lib/types";
import type { FactsResponse } from "@/lib/card-facts";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { DomainConnect } from "@/components/domain-connect";
import { isThinCard, loadOwnDetails } from "@/lib/card-personalize";
import { SHUBHORA_PAGE_SLUG, hasShubhoraPage, withShubhoraPage, withoutShubhoraPage, toBothFromShubhora } from "@/lib/shubhora-page";
import { isShubhoraCard } from "../../../../bridge/shubhora-kb.mjs";
import { CardChecklist } from "@/components/poster/card-checklist";
import { CardRenewBanner } from "@/components/poster/card-renew-banner";
import { PhotoNudge } from "@/components/poster/photo-nudge";
import { CardChatEdit } from "@/components/poster/card-chat-edit";
import { initials } from "@/lib/initials";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isShubhoraHost } from "@/lib/site-role";
const SITE = SITE_URL;

// eslint-disable-next-line @next/next/no-img-element
const Img = (p: { src: string; alt: string; className?: string }) => <img src={p.src} alt={p.alt} className={p.className} />;


export default function CardTab() {
  const router = useRouter();
  const { t, lang } = useT();
  const [card, setCard] = useState<Card | null>(null);
  const [domain, setDomain] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState("");
  const [shBusy, setShBusy] = useState("");
  const [shCopied, setShCopied] = useState(false);
  // Connections → "Own domain" opens this page at #domain: the domain box opens by itself and scrolls into view.
  const [domainOpen, setDomainOpen] = useState(false);
  useEffect(() => {
    if (!card) return;
    try { if (window.location.hash === "#domain") { setDomainOpen(true); setTimeout(() => document.getElementById("domain")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); } } catch { /* ignore */ }
  }, [card]);

  // Fills the empty parts of the existing card (longer about, promise, how it works, FAQ, services, designed
  // banner) — never replaces a word the owner wrote. Same AI build as "Make my V-Card", merged in.
  async function refreshContent() {
    if (!card || refreshing) return;
    setRefreshing(true); setNote("");
    const r = await api<{ ok?: boolean; card?: Card; error?: string }>("/api/card/build", { method: "POST", json: { refresh: true, current: card } });
    if (!r.ok || !r.data.card) { setRefreshing(false); setNote(r.data.error || "Could not refresh right now. Please try again."); return; }
    const merged = { ...r.data.card, id: card.id, username: card.username } as Card;
    const p = await publishCard(merged);
    setRefreshing(false);
    if (!p.ok) { setNote(p.error || "Could not save."); return; }
    setCard(merged);
    setNote("Done — new sections added. Open the card to see it; edit anything in the editor.");
  }

  const load = useCallback(async () => {
    setFailed(false);
    try {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/card"); return; }
      const cards = await fetchMyCardsStrict();
      api<{ hasCard: boolean; customDomain?: string }>("/api/site/status").then((r) => { if (r.ok && r.data.hasCard) setDomain(r.data.customDomain || ""); }).catch(() => {});
      // With several cards, the one made on "Make your V-Card" is the owner's own (the others may be for clients).
      let primaryId = "";
      if (cards.length > 1) {
        const fr = await api<Partial<FactsResponse>>("/api/card/facts").catch(() => null);
        primaryId = fr?.ok ? fr.data.facts?.primaryCardId ?? "" : "";
      }
      const mine = cards.find((c) => c.id === primaryId) ?? cards[0];
      // No V-Card yet, or an empty one: "Make your V-Card" (it opens the saved draft when there is one).
      if (!mine || isThinCard(mine)) { router.replace("/poster/card/build"); return; }
      setCard(mine);
    } catch {
      setFailed(true); // no internet: never treat this as "no card"
    }
  }, [router]);

  useEffect(() => {
    try { setPublished(new URLSearchParams(window.location.search).get("published") === "1"); } catch { /* ignore */ }
    load();
  }, [load]);

  const url = card ? `${SITE}/c/${card.username}` : "";
  useEffect(() => { if (url) QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: "#0b1220", light: "#ffffff" } }).then(setQr).catch(() => setQr("")); }, [url]);

  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  function shareWa() { window.open(`https://wa.me/?text=${encodeURIComponent(t.shareText(card?.company || card?.name || "", url))}`, "_blank"); }
  // The website: the same link with ?view=site opens the full website on a phone too (owner's call, 2 Oct 2026).
  const siteUrl = url ? `${url}?view=site` : "";
  function shareSite() { window.open(`https://wa.me/?text=${encodeURIComponent(lang === "hi" ? `हमारी website देखें — products, services और हमारे बारे में सब कुछ: ${siteUrl}` : `Visit our website — products, services and everything about us: ${siteUrl}`)}`, "_blank"); }

  // The Shubhora side of a card whose owner also runs their own business: a second link off the same card.
  const shUrl = card ? `${url}/${SHUBHORA_PAGE_SLUG}` : "";
  async function copySh() { try { await navigator.clipboard.writeText(shUrl); setShCopied(true); setTimeout(() => setShCopied(false), 2000); } catch { /* ignore */ } }

  /** A partner whose WHOLE card is Shubhora, who also wants their own business on it. Their Shubhora
   *  content moves to its own page and link (nothing is lost), the seller template's identity comes off,
   *  and they go straight to the business form and the AI builder to make their own card. */
  async function addOwnBusiness() {
    if (!card || shBusy) return;
    setShBusy("migrate"); setNote("");
    try {
      const own = await loadOwnDetails().catch(() => null);
      const next = toBothFromShubhora(card, { photo: own?.photo });
      const p = await publishCard(next);
      if (!p.ok) { setShBusy(""); setNote(p.error || "Could not save. Please try again."); return; }
      // The seller set-up wrote https://shubhora.com as this account's website; their own business must not
      // start with our site as its own. Then the set-up's website step, so their real site (if any) is asked.
      try {
        const sb = getBrowserSupabase();
        const md = ((await sb?.auth.getUser())?.data.user?.user_metadata ?? {}) as { business?: Record<string, unknown> };
        if (isShubhoraHost(String(md.business?.website ?? ""))) await sb?.auth.updateUser({ data: { business: { ...md.business, website: "" } } });
      } catch { /* the build route ignores a shubhora.com website anyway */ }
      router.push("/poster/onboard?step=site&next=/poster/card/build");
    } catch {
      setShBusy(""); setNote(lang === "hi" ? "Internet की दिक्कत — फिर से कोशिश करें।" : "Network issue — please try again.");
    }
  }

  /** Add or take away the Shubhora page. The owner's own pages, identity, link, domain and posters are never
   *  touched either way — only this one page is added to or removed from the card. */
  async function setShubhoraPage(on: boolean) {
    if (!card || shBusy) return;
    setShBusy(on ? "add" : "remove"); setNote("");
    const next = (on ? withShubhoraPage(card) : withoutShubhoraPage(card)) as Card;
    const p = await publishCard(next);
    setShBusy("");
    if (!p.ok) { setNote(p.error || "Could not save."); return; }
    setCard(next);
    setNote(on
      ? (lang === "hi" ? "Shubhora page जुड़ गया — नीचे उसका अलग link है। आपके अपने card पर ये नहीं दिखेगा।" : "Shubhora page added — its own link is below. It will not show on your own card.")
      : (lang === "hi" ? "Shubhora page हटा दिया।" : "Shubhora page removed."));
  }

  if (failed) return (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">No internet — tap to try again</p>
      <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">
        <RefreshCw className="h-5 w-5" /> Try again
      </button>
    </div>
  );

  if (!card) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4 py-2">
      {published && (
        <div className="rounded-2xl border-2 border-good/40 bg-good/10 p-4 space-y-3">
          <p className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-6 w-6 text-good" /> {lang === "hi" ? "आपका digital card live है" : "Your digital card is live"}</p>
          <p className="text-sm text-muted">Share the link anywhere. Want the same link to open as a full website on computers? That comes with Growth.</p>
          <Link href="/poster/website" className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-base font-semibold">
            <Globe className="h-5 w-5" /> See your website preview
          </Link>
          <Link href="/poster" className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-base font-semibold text-white">
            Next: your daily poster →
          </Link>
        </div>
      )}
      <CardRenewBanner />
      <h1 className="text-lg font-bold">{t.cardTitle}</h1>
      <PhotoNudge />
      <CardChatEdit card={card} onChanged={() => load()} />
      <Guide hi="ये link हर जगह share करें — bio, WhatsApp, visiting card पर QR। जो भी खोलेगा, उसकी lead आपको मिलेगी।" en="Share this link everywhere — bio, WhatsApp, QR on your visiting card. Whoever opens it becomes your lead." />
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="grad-brand p-4 text-white flex items-center gap-3">
          {card.avatarUrl ? <Img src={card.avatarUrl} alt="" className={`h-14 w-14 border-2 border-white/60 ${card.avatarShape === "square" ? "rounded-xl bg-white object-contain" : "rounded-full object-cover"}`} /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/25 text-lg font-bold">{initials(card.lead === "business" && card.company ? card.company : card.name)}</div>}
          <div className="min-w-0">
            <p className="font-bold truncate">{card.lead === "business" && card.company ? card.company : card.name}</p>
            <p className="text-xs opacity-90 truncate">{card.lead === "business" && card.company ? card.jobTitle : `${card.jobTitle}${card.company ? ` · ${card.company}` : ""}`}</p>
            <p className="text-[11px] opacity-80 mt-0.5 flex items-center gap-1"><Eye className="h-3 w-3" /> {t.cardViews(card.views ?? 0)}</p>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
            <code className="text-xs flex-1 truncate">{url.replace("https://", "")}</code>
            <button type="button" onClick={copy} className="text-muted" aria-label="Copy link">{copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}</button>
          </div>
          {/* Three things up front (owner's call, 25 Sep 2026 — seven buttons in a row was too much): share it,
              change it, see it. Everything else waits under "More options". */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={shareWa} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-3 text-base font-semibold text-white"><Share2 className="h-5 w-5" /> {lang === "hi" ? "Card share करें" : "Share card"}</button>
            <button type="button" onClick={shareSite} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] px-3 py-3 text-base font-semibold text-[#128C7E]"><Share2 className="h-5 w-5" /> {lang === "hi" ? "Website share करें" : "Share website"}</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/poster/d/editor?id=${card.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-3 text-base font-semibold text-white"><Pencil className="h-4 w-4" /> {lang === "hi" ? "Card edit करें" : "Edit card"}</Link>
            <CardLink href={url} title={lang === "hi" ? "मेरा कार्ड" : "My card"} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-base font-medium"><ExternalLink className="h-4 w-4" /> {lang === "hi" ? "Card देखें" : "See card"}</CardLink>
          </div>
          <details className="group rounded-xl border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold text-muted [&::-webkit-details-marker]:hidden">
              {lang === "hi" ? "और options" : "More options"} <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-border p-2">
              <Link href="/poster/card/looks" className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand/40 bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand-ink"><Palette className="h-4 w-4" /> {lang === "hi" ? "12 अलग look में देखें" : "See your card in 12 looks"}</Link>
              <button type="button" onClick={refreshContent} disabled={refreshing} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium disabled:opacity-60">
                {refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-brand" />} {refreshing ? (lang === "hi" ? "AI लिख रहा है… (30 second)" : "Writing new sections… (about 30 seconds)") : (lang === "hi" ? "AI से और text और हिस्से जोड़ें" : "Add more text & sections with AI")}
              </button>
              {note && <p className="text-xs text-muted px-1">{note}</p>}
              {/* again=1: this asks for a NEW card, so any saved preview from an earlier visit is dropped first. */}
              <Link href="/poster/card/build?again=1" className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"><Sparkles className="h-4 w-4 text-brand" /> {lang === "hi" ? "AI से पूरा card फिर से बनाएँ" : "Make my V-Card again with AI"}</Link>
              {/* Doing BOTH — their own business and Shubhora: the Shubhora page is ADDED on its own separate
                  link and nothing of theirs is touched. Shown only while the page is not already there. */}
              {!hasShubhoraPage(card) && (
                <button type="button" onClick={() => setShubhoraPage(true)} disabled={!!shBusy}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2f5bf5]/40 bg-[#2f5bf5]/10 px-3 py-2.5 text-sm font-semibold text-[#12144a] disabled:opacity-60">
                  {shBusy === "add" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <span>📇</span>} {lang === "hi" ? "Shubhora page जोड़ें (अलग link, आपका card वैसा ही रहेगा)" : "Add a Shubhora page (its own link; your card stays as it is)"}
                </button>
              )}
              {/* Selling ONLY Shubhora: the ready-made seller card replaces this card's pages on the SAME link. */}
              <Link href={`/poster/d/editor?id=${card.id}&template=vcard-reseller`} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-muted">{lang === "hi" ? "सिर्फ़ Shubhora बेचना है? पूरा card seller card बना दें (आपका business हट जाएगा)" : "Only selling Shubhora? Replace the whole card with the seller card (your own business comes off)"}</Link>
            </div>
          </details>
        </div>
      </div>
      {/* Already a Shubhora partner, whole card and all: the way to add their own business without losing
          any of it. Shown only on a card that is entirely Shubhora's. */}
      {isShubhoraCard(card) && !hasShubhoraPage(card) && (
        <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-bold"><Store className="h-4 w-4 text-brand" /> {lang === "hi" ? "अपना business भी जोड़ें?" : "Add your own business too?"}</p>
          <p className="text-xs text-muted">
            {lang === "hi"
              ? "अभी ये पूरा card Shubhora का है। अपना business भी करते हैं तो card आपके business का बन जाएगा, और Shubhora अपने अलग link पर चला जाएगा — कुछ भी खोएगा नहीं। आपका link, number और photo वही रहेंगे।"
              : "Right now this whole card is Shubhora's. If you also run your own business, the card becomes your business and Shubhora moves to its own separate link — nothing is lost. Your link, number and photo stay the same."}
          </p>
          <button type="button" onClick={addOwnBusiness} disabled={!!shBusy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {shBusy === "migrate" ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {lang === "hi" ? "तैयार कर रहे हैं…" : "Setting it up…"}</> : <>{lang === "hi" ? "अपना business जोड़ें" : "Add my business"} →</>}
          </button>
          <p className="text-[11px] text-muted">{lang === "hi" ? "अगली screen पर अपने business की जानकारी भरनी होगी, फिर AI आपका card बना देगा।" : "The next screen asks about your business, then the AI builds your card."}</p>
        </div>
      )}

      {/* Two audiences, two links, never mixed: this page is not on the owner's own card, and their business
          is not on this page. */}
      {hasShubhoraPage(card) && (
        <div className="rounded-2xl border border-[#2f5bf5]/40 bg-[#2f5bf5]/5 p-4 space-y-2.5">
          <p className="flex items-center gap-2 text-sm font-bold text-[#12144a]">
            <Img src="/art/brand/shubhora-logo.png" alt="" className="h-5 w-5 rounded bg-white object-contain p-0.5" />
            {lang === "hi" ? "आपका Shubhora page" : "Your Shubhora page"}
          </p>
          <p className="text-xs text-muted">
            {lang === "hi"
              ? "ये दूसरा link सिर्फ़ उन्हें भेजें जिनसे आप Shubhora की बात कर रहे हैं। आपके card पर ये page नहीं दिखता, और इस link पर आपका business नहीं दिखता — दोनों अलग रहते हैं।"
              : "Share this second link only with people you are talking to about Shubhora. The page is not on your own card, and your business is not on this page — the two stay apart."}
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
            <code className="text-xs flex-1 truncate">{shUrl.replace("https://", "")}</code>
            <button type="button" onClick={copySh} className="text-muted" aria-label="Copy Shubhora link">{shCopied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shUrl)}`, "_blank")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> {lang === "hi" ? "Share करें" : "Share"}</button>
            <CardLink href={shUrl} title={lang === "hi" ? "Shubhora page" : "Shubhora page"} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"><ExternalLink className="h-4 w-4" /> {lang === "hi" ? "देखें" : "See it"}</CardLink>
          </div>
          <button type="button" onClick={() => setShubhoraPage(false)} disabled={!!shBusy}
            className="text-xs font-semibold text-muted underline disabled:opacity-60">
            {shBusy === "remove" ? (lang === "hi" ? "हट रहा है…" : "Removing…") : (lang === "hi" ? "Shubhora page हटाएँ" : "Remove the Shubhora page")}
          </button>
        </div>
      )}
      {note && <p className="px-1 text-xs text-muted">{note}</p>}
      <CardChecklist card={card} hi={lang === "hi"} />
      {qr && (
        <div className="rounded-2xl border border-border p-4 text-center">
          <p className="text-sm font-semibold mb-2 inline-flex items-center gap-1.5"><QrCode className="h-4 w-4" /> {t.showQr}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR" className="mx-auto w-48 h-48 rounded-lg" />
          <p className="text-[11px] text-muted mt-2">{url.replace("https://", "")}</p>
        </div>
      )}
      {/* Own domain — free for the card too (yourbusiness.com opens this card). */}
      <details className="rounded-2xl border border-border p-4" open={domainOpen} onToggle={(e) => setDomainOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-sm font-semibold inline-flex items-center gap-1.5"><Globe className="h-4 w-4 text-brand" /> {domain ? `Your domain: ${domain}` : (lang === "hi" ? "अपना domain जोड़ें (yourbusiness.com)" : "Use your own domain (yourbusiness.com)")}</summary>
        <div id="domain" className="pt-3 scroll-mt-20"><DomainConnect cardId={card.id} username={card.username} initialDomain={domain || undefined} onChange={setDomain} /></div>
      </details>
    </div>
  );
}
