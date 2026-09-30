"use client";
// "My V-Card" tab: share, QR and views of the owner's card. No real card yet → "Make your V-Card"
// (/poster/card/build), which makes it from the setup details. A failed load never counts as "no card".
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { LoaderCircle, ExternalLink, Pencil, Copy, Check, Share2, QrCode, Eye, Palette, Sparkles, Globe, RefreshCw, ChevronDown, CheckCircle2 } from "lucide-react";
import { SITE_URL } from "@/lib/site-url";
import { CardLink } from "@/components/poster/card-sheet";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import type { Card } from "@/lib/types";
import type { FactsResponse } from "@/lib/card-facts";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { DomainConnect } from "@/components/domain-connect";
import { isThinCard } from "@/lib/card-personalize";
import { CardChecklist } from "@/components/poster/card-checklist";
import { CardRenewBanner } from "@/components/poster/card-renew-banner";
import { initials } from "@/lib/initials";
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
          <button type="button" onClick={shareWa} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-base font-semibold text-white"><Share2 className="h-5 w-5" /> {t.shareCard}</button>
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
              {/* Selling Shubhora itself: the ready-made seller card replaces this card's pages on the SAME link. */}
              <Link href={`/poster/d/editor?id=${card.id}&template=vcard-reseller`} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2f5bf5]/40 bg-[#2f5bf5]/10 px-3 py-2.5 text-sm font-semibold text-[#12144a]">📇 {lang === "hi" ? "Shubhora seller card में बदलें" : "Turn this into the Shubhora seller card"}</Link>
            </div>
          </details>
        </div>
      </div>
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
