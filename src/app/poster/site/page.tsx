"use client";
// "Card & Website" (owner's call, 3 Oct 2026: one link, one page — computers get the website, phones the card, so
// one screen for both). Link, share, edit, what Premium adds (locked on the item, never on the page), photos
// needed, AI edits, domain and settings.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Globe, Smartphone, ExternalLink, Pencil, Check, RefreshCw, Paintbrush, Copy, Share2, Search, Tag } from "lucide-react";
import { PremiumCard, PremiumGate } from "@/components/poster/premium-lock";
import { CardLink } from "@/components/poster/card-sheet";
import { NoticeBox } from "@/components/poster/notice-box";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { SiteBuilderOptions } from "@/components/poster/site-builder-options";
import { PhotoNudge } from "@/components/poster/photo-nudge";
import { CardChatEdit } from "@/components/poster/card-chat-edit";
import { fetchMyCardsStrict } from "@/lib/cloud";
import type { Card } from "@/lib/types";
import { DomainConnect } from "@/components/domain-connect";
import { usePlan } from "@/lib/plan";

type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string };
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; customDomain: string; knowledge?: string; site: { enabled: boolean; hidden?: string[]; hideProfile?: boolean; logoUrl?: string; hero?: Hero; generatedAt?: string; templateKey?: string; style?: { palette?: string; font?: string }; reference?: { url: string } } | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string } };

export default function WebsitePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [cardId, setCardId] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  // Arrived straight from the builder (?published=1): the greeting at the top.
  const [published, setPublished] = useState(false);
  useEffect(() => { try { setPublished(new URLSearchParams(window.location.search).get("published") === "1"); } catch { /* ignore */ } }, []);
  const { plan, loading: planLoading } = usePlan();
  const paid = planLoading || plan !== "free";
  // The live card, for "change something" (card-chat-edit.tsx).
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => { if (!cardId) return; fetchMyCardsStrict().then((cs) => setCard(cs.find((c) => c.id === cardId) ?? cs[0] ?? null)).catch(() => undefined); }, [cardId]);
  const [copied, setCopied] = useState(false);
  const siteUrl = s && s.hasCard ? `${s.url}?view=site` : "";
  async function copy() { if (!s || !s.hasCard) return; try { await navigator.clipboard.writeText(s.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  function shareCard() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `नमस्ते! ये मेरा digital card है — contact, products और बाकी सब एक tap में: ${s.url}` : `Hi! Here is my digital card — contact, products and more in one tap: ${s.url}`)}`, "_blank"); }
  function shareSite() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `हमारी website देखें — products, services और हमारे बारे में सब कुछ: ${siteUrl}` : `Visit our website — products, services and everything about us: ${siteUrl}`)}`, "_blank"); }

  // api() resolves on ANY status, so a 401 (expired login) or a server error must be caught here — without
  // this check the screen keeps spinning for ever with nothing to tap.
  const load = useCallback(async (id?: string) => {
    setErr("");
    try {
      const r = await api<Status & { error?: string }>(`/api/site/status${id ? `?card=${id}` : ""}`);
      if (!r.ok) { setErr(r.data?.error || "No internet — tap to try again"); return; }
      setS(r.data);
      if (r.data.hasCard) setCardId(r.data.cardId);
    } catch {
      setErr("No internet — tap to try again");
    }
  }, []);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.push("/login?next=/poster/site"); return; } load(); })(); }, [router, load]);

  async function patch(p: { enabled?: boolean; hidden?: string[] }) {
    try { await api("/api/site/status", { method: "PATCH", json: { ...p, card_id: cardId } }); } catch { setMsg("No internet — please try again."); return; }
    load(cardId);
  }

  if (!s) return err ? (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">{err}</p>
      <button type="button" onClick={() => load(cardId || undefined)} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white">
        <RefreshCw className="h-5 w-5" /> Try again
      </button>
    </div>
  ) : <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const hidden = new Set(s.hasCard ? s.site?.hidden ?? [] : []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/setup" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">{hi ? "Card & Website" : "Card & Website"}</h1>
      </div>
      <Guide hi="एक ही link: computer पर website, phone पर digital card। यहाँ से share करें, बदलें, और Premium देखें।" en="One link: the website on computers, the digital card on phones. Share it, change it and see Premium from here." />
      {msg && <p className="text-sm rounded-lg bg-surface2 px-3 py-2">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {!s.hasCard ? (
        <section className="rounded-xl border border-border p-4 text-center space-y-3">
          <p className="text-sm text-muted">{hi ? "Pehle apni website banayein — card usi se ban jaata hai." : "Build your website first — your card comes from it."}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{hi ? "Website banayein →" : "Build my website →"}</Link>
        </section>
      ) : (
        <>
          {/* Owner's call, 1 Oct 2026: the website is what people build first now; the card is what the same
              link becomes on a phone. So a fresh build lands here, sees it, edits it, and is told the card is
              ready too — instead of landing on the card and finding the website later. */}
          {published && (
            <section className="rounded-2xl border-2 border-good/40 bg-good/10 p-4 space-y-3">
              <p className="flex items-center gap-2 text-lg font-bold"><Check className="h-6 w-6 text-good" /> {hi ? "आपकी website और card live हैं" : "Your website and card are live"}</p>
              <p className="text-sm text-muted">{hi ? "Computer par yeh link poori website kholta hai; phone par yahi aapka card ban jaata hai — ek link, ek data." : "On a computer this link opens as your website; on a phone the same link is your card — one link, one set of data."}</p>
              <div className="grid grid-cols-2 gap-2">
                <a href={`${s.url}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-semibold"><Globe className="h-4 w-4" /> {hi ? "Website dekhein" : "See the website"}</a>
                <Link href="/poster/website/edit" className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-3 text-sm font-semibold text-white"><Pencil className="h-4 w-4" /> {hi ? "Website edit karein" : "Edit the website"}</Link>
              </div>
              <a href={`${s.url}?view=card`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold">
                <span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand" /> {hi ? "Card देखें (phone वाला look)" : "See the card (the phone look)"}</span>
                <span className="text-muted">→</span>
              </a>
            </section>
          )}
          <PhotoNudge />
          {card && <NoticeBox card={card} url={s.url} locked={!paid} onChanged={(c) => setCard(c)} />}
          {card && <CardChatEdit card={card} locked={!paid} onChanged={(c) => { setCard(c); load(cardId); }} />}
          {s.cards.length > 1 && (
            <select value={cardId} onChange={(e) => load(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
            </select>
          )}
          {/* The link: copy, share as card or website, open, edit. */}
          <section className="rounded-2xl border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
              <code className="text-xs flex-1 truncate">{(s.customDomain || s.url).replace(/^https?:\/\//, "")}</code>
              <button type="button" onClick={() => void copy()} className="text-muted" aria-label="Copy link">{copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={shareCard} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-3 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> {hi ? "Card share करें" : "Share card"}</button>
              <button type="button" onClick={shareSite} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] px-3 py-3 text-sm font-semibold text-[#128C7E]"><Globe className="h-4 w-4" /> {hi ? "Website share करें" : "Share website"}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Globe className="h-4 w-4 text-brand" /> {hi ? "Website खोलें" : "Open website"} <ExternalLink className="h-3.5 w-3.5 text-muted" /></a>
              <CardLink href={s.url} title={hi ? "मेरा card" : "My card"} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Smartphone className="h-4 w-4 text-brand" /> {hi ? "Card खोलें" : "Open card"}</CardLink>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/poster/d/editor?id=${s.cardId}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-3 text-sm font-semibold text-white"><Pencil className="h-4 w-4" /> {hi ? "Card edit करें" : "Edit card"}</Link>
              <Link href="/poster/website/edit" className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-3 text-sm font-semibold text-white"><Paintbrush className="h-4 w-4" /> {hi ? "Website edit करें" : "Edit website"}</Link>
            </div>
          </section>
          {!paid && <PremiumCard />}
          {/* Premium, shown where it lives: Google and the Shubhora tag (owner's call, 3 Oct 2026). */}
          {!paid && (
            <div className="grid grid-cols-2 gap-2">
              <PremiumGate locked feature={hi ? "Google पर website" : "Website on Google"}>
                <div className="rounded-xl border border-border bg-surface p-3 pr-20"><p className="flex items-center gap-1.5 text-sm font-semibold"><Search className="h-4 w-4 text-brand" /> {hi ? "Google पर दिखे" : "Show on Google"}</p><p className="text-[11px] text-muted">{hi ? "search में आपकी website" : "your website in search"}</p></div>
              </PremiumGate>
              <PremiumGate locked feature={hi ? "Shubhora tag हटाना" : "Removing the Shubhora tag"}>
                <div className="rounded-xl border border-border bg-surface p-3 pr-20"><p className="flex items-center gap-1.5 text-sm font-semibold"><Tag className="h-4 w-4 text-brand" /> {hi ? "Shubhora tag हटाएँ" : "Remove Shubhora tag"}</p><p className="text-[11px] text-muted">{hi ? "ऊपर और नीचे की FREE पट्टी" : "the FREE strips top and bottom"}</p></div>
              </PremiumGate>
            </div>
          )}
          <section className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-brand" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{s.customDomain || s.url.replace(/^https?:\/\//, "")}</p>
                <p className="text-[11px] text-muted">{s.site?.enabled ? ("Website mode ON — website on computers, card on phones") : ("Website mode OFF — the card shows everywhere")}{s.site?.generatedAt ? ` · AI: ${new Date(s.site.generatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}</p>
              </div>
              {s.site?.enabled && <Check className="h-4 w-4 text-good" />}
            </div>
            <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
              <span><span className="text-sm font-medium block">{hi ? "Website mode" : "Website mode"}</span><span className="text-[11px] text-muted">{"Your current pages stay as they are — they just render as a website on computers."}</span></span>
              <input type="checkbox" className="h-5 w-5" checked={!!s.site?.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <a href={`${s.url}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Globe className="h-4 w-4" /> {hi ? "Website preview" : "Website preview"} <ExternalLink className="h-3.5 w-3.5 text-muted" /></a>
              <a href={`${s.url}?view=card`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><Smartphone className="h-4 w-4" /> {hi ? "Card preview" : "Card preview"} <ExternalLink className="h-3.5 w-3.5 text-muted" /></a>
            </div>
            <button type="button" onClick={() => router.push("/poster")} className="w-full rounded-2xl grad-brand px-4 py-4 text-base font-semibold text-white">Looks good ✓</button>
          </section>

          <SiteBuilderOptions cardId={s.cardId} knowledge={s.knowledge} templateKey={s.site?.templateKey} generatedAt={s.site?.generatedAt} onDone={(m) => { setMsg(m); load(s.cardId); }} />

          <details className="rounded-xl border border-border bg-surface/70">
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">More settings</summary>
            <div className="space-y-4 border-t border-border p-3">
          <section className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-sm font-semibold">{hi ? "Website par kaunse pages dikhein" : "Pages shown on the website"}</p>
            {s.pages.map((p) => (
              <label key={p.slug} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{p.label} <span className="text-[11px] text-muted">· {p.blocks} {hi ? "sections" : "sections"}</span></span>
                <input type="checkbox" className="h-5 w-5" checked={!hidden.has(p.slug)} onChange={(e) => { const h = new Set(hidden); if (e.target.checked) h.delete(p.slug); else h.add(p.slug); patch({ hidden: [...h] }); }} />
              </label>
            ))}
          </section>
          <section className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-sm font-semibold">🌍 Put it on your own domain</p>
            <DomainConnect cardId={s.cardId} username={s.username} initialDomain={s.customDomain || undefined} />
          </section>
            </div>
          </details>
          <section className="rounded-xl border border-border p-3 space-y-2 text-sm">
            <Link href="/poster/card" className="flex items-center gap-2 text-brand-ink font-medium"><Smartphone className="h-4 w-4" /> {hi ? "Card की और settings (looks, Shubhora partner, दोबारा लिखवाना)" : "More card settings (looks, Shubhora partner, write again)"}</Link>
            <Link href={`/poster/d/editor?id=${s.cardId}`} className="flex items-center gap-2 text-brand-ink font-medium"><Pencil className="h-4 w-4" /> {hi ? "Text/photo khud badlein (full editor)" : "Edit text/photos yourself (full editor)"} →</Link>

          </section>
        </>
      )}
    </div>
  );
}
