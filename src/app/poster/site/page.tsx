"use client";
// "Card & Website" (owner's call, 3 Oct 2026: one link, one page — computers get the website, phones the card). Rebuilt
// 6 Oct 2026 ("pura page bada confusing hai — Share ka option, Edit ka option; baaki sab Edit ke andar"): the link, two
// doors — Share and Edit — and everything else behind Edit, in three sections: Look & design, Words & photos, Settings.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, ChevronRight, Globe, Smartphone, Pencil, Check, RefreshCw, Paintbrush, Copy, Share2, Search, Tag, Sparkles, Package, Camera, LayoutTemplate, Settings, Type, MessageCircle } from "lucide-react";
import { PremiumCard, PremiumGate } from "@/components/poster/premium-lock";
import { CardLink } from "@/components/poster/card-sheet";
import { NoticeBox } from "@/components/poster/notice-box";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { SiteBuilderOptions } from "@/components/poster/site-builder-options";
import { PhotoNudge } from "@/components/poster/photo-nudge";
import { CardChatEdit } from "@/components/poster/card-chat-edit";
import { fetchMyCardsStrict } from "@/lib/cloud";
import type { Card } from "@/lib/types";
import { DomainConnect } from "@/components/domain-connect";
import { usePlan } from "@/lib/plan";

type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string };
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; customDomain: string; knowledge?: string; site: { enabled: boolean; hidden?: string[]; hideProfile?: boolean; logoUrl?: string; hero?: Hero; generatedAt?: string; templateKey?: string; style?: { palette?: string; font?: string }; reference?: { url: string } } | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string } };

type Panel = "share" | "edit" | null;

export default function WebsitePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [cardId, setCardId] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  // Arrived straight from the builder (?published=1): the greeting at the top; ?edit=1 / ?share=1 open that door.
  const [published, setPublished] = useState(false);
  useEffect(() => { try { const q = new URLSearchParams(window.location.search); setPublished(q.get("published") === "1"); if (q.get("edit") === "1") setPanel("edit"); if (q.get("share") === "1") setPanel("share"); } catch { /* ignore */ } }, []);
  const { plan, loading: planLoading } = usePlan();
  const paid = planLoading || plan !== "free";
  // The live card, for "change something" (card-chat-edit.tsx) and the notice.
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => { if (!cardId) return; fetchMyCardsStrict().then((cs) => setCard(cs.find((c) => c.id === cardId) ?? cs[0] ?? null)).catch(() => undefined); }, [cardId]);
  const [copied, setCopied] = useState(false);
  async function copy() { if (!s || !s.hasCard) return; try { await navigator.clipboard.writeText(s.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  function shareCard() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `नमस्ते! ये मेरा digital card है — contact, products और बाकी सब एक tap में: ${s.url}` : `Hello! Here is my digital card — contact, products and more in one tap: ${s.url}`)}`, "_blank", "noopener"); }
  function shareSite() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `हमारी website देखें — products, services और हमारे बारे में सब कुछ: ${s.url}?view=site` : `See our website — products, services and all about us: ${s.url}?view=site`)}`, "_blank", "noopener"); }

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
  /** Back = the screen before this one inside the app, else the Create tab it hangs off. */
  function back() {
    let inApp = false;
    try { inApp = window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { /* no referrer */ }
    if (inApp) router.back(); else router.push("/poster/create");
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
  const T = (en: string, h: string) => (hi ? h : en);
  const door = (k: Exclude<Panel, null>) => `flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-base font-semibold ${panel === k ? "border-brand bg-brand-soft/60 text-brand-ink" : "border-border bg-surface"}`;
  const row = "flex w-full items-center gap-3 px-3.5 py-3 text-left";
  const rowText = (title: string, sub: string) => <span className="min-w-0 flex-1"><b className="block text-sm">{title}</b><span className="block text-xs text-muted">{sub}</span></span>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={back} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold flex-1">{T("Card & Website", "Card & Website")}</h1>
      </div>
      {msg && <p className="text-sm rounded-lg bg-surface2 px-3 py-2">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {!s.hasCard ? (
        <section className="rounded-xl border border-border p-4 text-center space-y-3">
          <p className="text-sm text-muted">{T("Build your website first — your card comes from it.", "पहले अपनी website बनाएँ — card उसी से बन जाता है।")}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{T("Build my website →", "Website बनाएँ →")}</Link>
        </section>
      ) : (
        <>
          {published && (
            <p className="flex items-center gap-2 rounded-2xl border-2 border-good/40 bg-good/10 px-4 py-3 text-sm font-semibold"><Check className="h-5 w-5 shrink-0 text-good" /> {T("Your website and card are live.", "आपकी website और card live हैं।")}</p>
          )}
          {s.cards.length > 1 && (
            <select value={cardId} onChange={(e) => load(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
            </select>
          )}

          {/* ---- 1. the link ---- */}
          <section className="space-y-3 rounded-2xl border border-border p-3">
            <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2.5">
              <Globe className="h-4 w-4 shrink-0 text-brand" />
              <code className="min-w-0 flex-1 truncate text-sm font-semibold">{(s.customDomain || s.url).replace(/^https?:\/\//, "")}</code>
              <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink" aria-label={T("Copy link", "Link copy करें")}>{copied ? <><Check className="h-4 w-4 text-good" /> {T("Copied", "Copy हुआ")}</> : <><Copy className="h-4 w-4" /> {T("Copy", "Copy")}</>}</button>
            </div>
            <p className="text-xs text-muted">{T("One link: the website on a computer, your card on a phone.", "एक ही link: computer पर website, phone पर card।")}</p>
            <div className="grid grid-cols-2 gap-2">
              <a href={`${s.url}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><Globe className="h-4 w-4 text-brand" /> {T("Open website", "Website खोलें")}</a>
              <CardLink href={s.url} title={T("My card", "मेरा card")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><Smartphone className="h-4 w-4 text-brand" /> {T("Open card", "Card खोलें")}</CardLink>
            </div>
          </section>

          {/* ---- 2. two doors: Share, Edit ---- */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPanel(panel === "share" ? null : "share")} aria-expanded={panel === "share"} className={door("share")}><Share2 className="h-6 w-6" /> {T("Share", "Share करें")}</button>
            <button type="button" onClick={() => setPanel(panel === "edit" ? null : "edit")} aria-expanded={panel === "edit"} className={door("edit")}><Pencil className="h-6 w-6" /> {T("Edit", "Edit करें")}</button>
          </div>

          {panel === "share" && (
            <section className="space-y-2 rounded-2xl border border-border p-3">
              <p className="text-sm font-semibold">{T("Share on WhatsApp", "WhatsApp पर share करें")}</p>
              <button type="button" onClick={shareCard} className="flex w-full items-center gap-3 rounded-xl bg-[#25D366] px-4 py-3.5 text-left text-white">
                <Smartphone className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><b className="block text-sm">{T("Share my card", "मेरा card share करें")}</b><span className="block text-xs opacity-90">{T("Contact, products and more — opens as the card on a phone", "Contact, products और बाकी — phone पर card खुलता है")}</span></span><ChevronRight className="h-4 w-4 shrink-0" />
              </button>
              <button type="button" onClick={shareSite} className="flex w-full items-center gap-3 rounded-xl border-2 border-[#25D366] px-4 py-3.5 text-left text-[#128C7E]">
                <Globe className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><b className="block text-sm">{T("Share my website", "मेरी website share करें")}</b><span className="block text-xs text-muted">{T("The full website — pages, products, about", "पूरी website — pages, products, परिचय")}</span></span><ChevronRight className="h-4 w-4 shrink-0" />
              </button>
              <button type="button" onClick={() => void copy()} className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left">
                <Copy className="h-5 w-5 shrink-0 text-muted" /><span className="min-w-0 flex-1 text-sm font-semibold">{copied ? T("Link copied ✓", "Link copy हुआ ✓") : T("Copy the link", "Link copy करें")}</span>
              </button>
              <Link href="/poster/share" className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left">
                <Share2 className="h-5 w-5 shrink-0 text-muted" /><span className="min-w-0 flex-1 text-sm font-semibold">{T("QR code and more ways to share", "QR code और share के और तरीके")}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </section>
          )}

          {panel === "edit" && (
            <div className="space-y-3">
              {/* a. the look */}
              <details open className="rounded-2xl border border-border bg-surface">
                <summary className="flex cursor-pointer items-center gap-3 px-3.5 py-3"><Paintbrush className="h-5 w-5 shrink-0 text-brand" />{rowText(T("Look & design", "Look और design"), T("The three designs, tiles, colours, dark or light", "तीन design, tiles, रंग, dark या light"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></summary>
                <div className="divide-y divide-border border-t border-border">
                  <Link href="/poster/card/build?improve=1" className={row}><LayoutTemplate className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Change the design", "Design बदलें"), T("View the three designs and pick one — nothing is spent", "तीनों design देखें और एक चुनें — कुछ खर्च नहीं"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href="/poster/card/build?improve=1&ask=1" className={row}><Sparkles className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Write again with AI", "AI से दोबारा लिखवाएँ"), T("Say what should change — words, look, pictures", "बताएँ क्या बदले — शब्द, look, तस्वीरें"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                </div>
              </details>
              {/* b. words and photos */}
              <details className="rounded-2xl border border-border bg-surface">
                <summary className="flex cursor-pointer items-center gap-3 px-3.5 py-3"><Type className="h-5 w-5 shrink-0 text-brand" />{rowText(T("Words & photos", "शब्द और photos"), T("Your details, products, photos, the full editor", "आपकी जानकारी, products, photos, पूरा editor"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></summary>
                <div className="divide-y divide-border border-t border-border">
                  <Link href="/poster/onboard?step=trade" className={row}><Pencil className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Edit my details", "मेरी जानकारी बदलें"), T("Name, trade, about, timings, address", "नाम, काम, परिचय, समय, पता"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href="/poster/products" className={row}><Package className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Products & services", "Products और services"), T("Add, change, photos and prices", "जोड़ें, बदलें, photos और दाम"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href="/poster/onboard?step=extras" className={row}><Camera className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Banner & photos", "Banner और photos"), T("Your own photos on the website", "Website पर आपकी अपनी photos"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href={`/poster/d/editor?id=${s.cardId}`} className={row}><Type className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Edit text & photos yourself", "शब्द और photos खुद बदलें"), T("The full editor — every page, every section", "पूरा editor — हर page, हर section"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href="/poster/website/edit" className={row}><Globe className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Website pages", "Website के pages"), T("Headline, sections, which pages show", "Headline, sections, कौन से pages दिखें"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                </div>
                <div className="space-y-3 border-t border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-brand" /> {T("Tell the AI what to change", "AI को बताएँ क्या बदलना है")}</p>
                  {card && <CardChatEdit card={card} locked={!paid} onChanged={(c) => { setCard(c); load(cardId); }} />}
                  {card && <NoticeBox card={card} url={s.url} locked={!paid} onChanged={(c) => setCard(c)} />}
                  <PhotoNudge />
                </div>
              </details>
              {/* c. settings */}
              <details className="rounded-2xl border border-border bg-surface">
                <summary className="flex cursor-pointer items-center gap-3 px-3.5 py-3"><Settings className="h-5 w-5 shrink-0 text-brand" />{rowText(T("Settings", "Settings"), T("Website mode, pages, your own domain, Premium", "Website mode, pages, अपना domain, Premium"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></summary>
                <div className="space-y-4 border-t border-border p-3">
                  <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
                    <span><span className="block text-sm font-medium">{T("Website mode", "Website mode")}</span><span className="text-[11px] text-muted">{s.site?.enabled ? T("ON — website on computers, card on phones", "ON — computer पर website, phone पर card") : T("OFF — the card shows everywhere", "OFF — हर जगह card दिखता है")}</span></span>
                    <input type="checkbox" className="h-5 w-5" checked={!!s.site?.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                  </label>
                  <section className="space-y-2">
                    <p className="text-sm font-semibold">{T("Pages shown on the website", "Website पर कौन से pages दिखें")}</p>
                    {s.pages.map((p) => (
                      <label key={p.slug} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <span className="text-sm">{p.label} <span className="text-[11px] text-muted">· {p.blocks} {T("sections", "sections")}</span></span>
                        <input type="checkbox" className="h-5 w-5" checked={!hidden.has(p.slug)} onChange={(e) => { const h = new Set(hidden); if (e.target.checked) h.delete(p.slug); else h.add(p.slug); patch({ hidden: [...h] }); }} />
                      </label>
                    ))}
                  </section>
                  {!paid && (
                    <div className="grid grid-cols-2 gap-2">
                      <PremiumGate locked feature={T("Website on Google", "Google पर website")}>
                        <div className="rounded-xl border border-border bg-surface p-3 pr-20"><p className="flex items-center gap-1.5 text-sm font-semibold"><Search className="h-4 w-4 text-brand" /> {T("Show on Google", "Google पर दिखे")}</p></div>
                      </PremiumGate>
                      <PremiumGate locked feature={T("Removing the Shubhora tag", "Shubhora tag हटाना")}>
                        <div className="rounded-xl border border-border bg-surface p-3 pr-20"><p className="flex items-center gap-1.5 text-sm font-semibold"><Tag className="h-4 w-4 text-brand" /> {T("Remove the Shubhora tag", "Shubhora tag हटाएँ")}</p></div>
                      </PremiumGate>
                    </div>
                  )}
                  <section className="space-y-2">
                    <p className="text-sm font-semibold">🌍 {T("Put it on your own domain", "अपने domain पर लगाएँ")}</p>
                    <DomainConnect cardId={s.cardId} username={s.username} initialDomain={s.customDomain || undefined} />
                  </section>
                  <SiteBuilderOptions cardId={s.cardId} knowledge={s.knowledge} templateKey={s.site?.templateKey} generatedAt={s.site?.generatedAt} onDone={(m) => { setMsg(m); load(s.cardId); }} />
                  <Link href="/poster/card" className="flex items-center gap-2 text-sm font-medium text-brand-ink"><Smartphone className="h-4 w-4" /> {T("More card settings (looks, Shubhora partner page)", "Card की और settings (looks, Shubhora partner page)")}</Link>
                </div>
              </details>
            </div>
          )}

          {!paid && <PremiumCard compact />}
        </>
      )}
    </div>
  );
}
