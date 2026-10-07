"use client";
// "Card & Website" (owner's call, 3 Oct 2026: one link, one page — computers get the website, phones the card). Rebuilt
// 6 Oct 2026 ("pura page bada confusing hai — Share ka option, Edit ka option; baaki sab Edit ke andar"): the link, two
// doors — Share and Edit — and everything else behind Edit, in three sections: Look & design, Words & photos, Settings.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, ChevronRight, Globe, Smartphone, Pencil, Check, RefreshCw, Paintbrush, Copy, Share2, Search, Tag, Sparkles, Package, Camera, Settings, Type, Mic, Clock } from "lucide-react";
import { PremiumCard, PremiumGate } from "@/components/poster/premium-lock";
import { CardLink } from "@/components/poster/card-sheet";
import { NoticeBox } from "@/components/poster/notice-box";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
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
  /** Back from a focused edit (?saved=…): one line says it is on the website, for a moment. */
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("edit") === "1") setPanel("edit"); if (q.get("share") === "1") setPanel("share");
      if (q.has("saved")) { setSaved(true); setTimeout(() => setSaved(false), 8000); }
      // The one-time flags leave the address, so a reload or Back does not replay them.
      if (q.has("saved") || q.has("published")) { q.delete("saved"); q.delete("published"); window.history.replaceState(null, "", `${window.location.pathname}${q.toString() ? `?${q}` : ""}`); }
    } catch { /* ignore */ }
  }, []);
  /** Where a focused edit comes back to: this page, the Edit door open. */
  const BACK = encodeURIComponent("/poster/site?edit=1");
  const { plan, loading: planLoading } = usePlan();
  const paid = planLoading || plan !== "free";
  // The live card, for "change something" (card-chat-edit.tsx) and the notice.
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => { if (!cardId) return; fetchMyCardsStrict().then((cs) => setCard(cs.find((c) => c.id === cardId) ?? cs[0] ?? null)).catch(() => undefined); }, [cardId]);
  const [copied, setCopied] = useState(false);
  /** The one address shown, copied, shared and opened: the owner's own domain when connected, else the Shubhora link. */
  const link = s?.hasCard ? (s.customDomain ? `https://${s.customDomain}` : s.url) : "";
  async function copy() { if (!s || !s.hasCard) return; try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  function shareCard() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `नमस्ते! ये मेरा digital card है — contact, products और बाकी सब एक tap में: ${link}` : `Hello! Here is my digital card — contact, products and more in one tap: ${link}`)}`, "_blank", "noopener"); }
  function shareSite() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `हमारी website देखें — products, services और हमारे बारे में सब कुछ: ${link}?view=site` : `See our website — products, services and all about us: ${link}?view=site`)}`, "_blank", "noopener"); }

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
  /** Back = the Create tab this page hangs off — always, so it never loops back into a form just saved. */
  function back() { router.push("/poster/create"); }

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
  const door = (k: Exclude<Panel, null>) => `flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3.5 text-base font-semibold ${panel === k ? "border-brand bg-brand-soft/60 text-brand-ink" : "border-border bg-surface"}`;
  const doorSub = "block text-[11px] font-normal leading-tight text-muted";
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
          {s.cards.length > 1 && (
            <select value={cardId} onChange={(e) => load(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
            </select>
          )}

          {/* ---- 1. the link ---- */}
          <section className="space-y-3 rounded-2xl border border-border p-3">
            <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2.5">
              <Globe className="h-4 w-4 shrink-0 text-brand" />
              <code className="min-w-0 flex-1 truncate text-sm font-semibold">{link.replace(/^https?:\/\//, "")}</code>
              <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink" aria-label={T("Copy link", "Link copy करें")}>{copied ? <><Check className="h-4 w-4 text-good" /> {T("Copied", "Copy हुआ")}</> : <><Copy className="h-4 w-4" /> {T("Copy", "Copy")}</>}</button>
            </div>
            {/* The one thing people got wrong here (owner, 7 Oct 2026: "Edit dabane par kya edit hoga, card ya website?"):
                one link, one set of details — the website and the card are the same thing in two shapes. Said once, here. */}
            <p className="rounded-xl bg-brand-soft/50 px-3 py-2 text-xs leading-relaxed text-ink">
              {s.site?.enabled
                ? <>{T("One link, one set of details. On a computer it opens as your website, on a phone as your card. Edit once — both change.", "एक link, एक ही जानकारी। Computer पर website खुलती है, phone पर card। एक बार edit करो — दोनों बदलेंगे।")}</>
                : <>{T("Website mode is off: this link opens the card everywhere. Turn it on under Edit → Advanced.", "Website mode बंद है: ये link हर जगह card खोलता है। Edit → Advanced से चालू करें।")}</>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a href={`${link}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><Globe className="h-4 w-4 text-brand" /> {T("Open website", "Website खोलें")}</a>
              <CardLink href={link} title={T("My card", "मेरा card")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><Smartphone className="h-4 w-4 text-brand" /> {T("Open card", "Card खोलें")}</CardLink>
            </div>
          </section>

          {/* ---- 2. two doors: Share, Edit ---- */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPanel(panel === "share" ? null : "share")} aria-expanded={panel === "share"} className={door("share")}><Share2 className="h-6 w-6" /> {T("Share", "Share करें")}<span className={doorSub}>{T("card or website", "card या website")}</span></button>
            <button type="button" onClick={() => setPanel(panel === "edit" ? null : "edit")} aria-expanded={panel === "edit"} className={door("edit")}><Pencil className="h-6 w-6" /> {T("Edit card & website", "Card और website edit करें")}<span className={doorSub}>{T("both, together", "दोनों, एक साथ")}</span></button>
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
              {/* One question, six tiles (owner's call, 7 Oct 2026: "edit ko aur easy banao"): each tile is one thing an
                  owner wants to change, in plain words, and opens one focused screen that saves straight onto the
                  live website. Everything else (editor, pages, settings) waits under Advanced. */}
              {/* Said loud, right where Edit opens (owner, 7 Oct 2026: "pata nahi chal raha kis ko edit kar rahe hain"):
                  the card and the website are ONE thing — the same details, the same link — so every edit is of both. */}
              <div className="rounded-2xl border-2 border-brand/40 bg-brand-soft/40 p-3.5">
                <p className="text-base font-bold">{T("You are editing BOTH: your card and your website.", "आप दोनों edit कर रहे हैं: अपना card और अपनी website।")}</p>
                <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-xs">
                  <span className="rounded-xl bg-surface px-2 py-2"><Smartphone className="mx-auto mb-1 h-5 w-5 text-brand" /><b className="block">{T("Card", "Card")}</b><span className="text-muted">{T("on phones", "phone पर")}</span></span>
                  <span className="text-lg font-bold text-brand">=</span>
                  <span className="rounded-xl bg-surface px-2 py-2"><Globe className="mx-auto mb-1 h-5 w-5 text-brand" /><b className="block">{T("Website", "Website")}</b><span className="text-muted">{T("on computers", "computer पर")}</span></span>
                </div>
                <p className="mt-2.5 text-sm">{T("Same details, same link. Change anything below once — it shows on both.", "एक ही जानकारी, एक ही link। नीचे कुछ भी एक बार बदलें — दोनों पर दिखेगा।")}</p>
              </div>
              <p className="text-base font-bold">{T("What do you want to change?", "क्या बदलना है?")}</p>
              {saved && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {T("Saved. It is on your website now.", "Save हो गया। Website पर आ गया है।")} <a href={`${link}?view=site`} target="_blank" rel="noreferrer" className="ml-1 font-semibold underline">{T("Open website", "Website खोलें")}</a></p>}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { k: "ai", I: Mic, t: T("Tell the AI", "AI को बताओ"), s: T("Say or type what to change", "बोलो या लिखो क्या बदलना है"), onClick: () => { document.getElementById("ai-edit-box")?.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => document.getElementById("ai-edit-box")?.focus(), 350); }, premium: !paid, scope: "both" },
                  { k: "photo", I: Camera, t: T("Photo & banner", "Photo और banner"), s: T("Your own pictures", "आपकी अपनी photos"), href: `/poster/onboard?step=extras&back=${BACK}`, scope: "both" },
                  { k: "about", I: Type, t: T("About & logo", "परिचय और logo"), s: T("The few lines about you", "आपके बारे में कुछ लाइनें"), href: `/poster/onboard?step=about&back=${BACK}`, scope: "both" },
                  { k: "products", I: Package, t: T("Products / services", "Products / services"), s: T("Add, change, prices", "जोड़ें, बदलें, दाम"), href: `/poster/products?back=${BACK}`, scope: "again" },
                  { k: "where", I: Clock, t: T("Timings & address", "समय और पता"), s: T("City, map, open hours", "शहर, map, समय"), href: `/poster/onboard?step=where&back=${BACK}`, scope: "both" },
                  // The three designs are the WEBSITE's; the phone card's own look lives under Advanced → Card look & settings.
                  { k: "design", I: Paintbrush, t: T("Website design", "Website का design"), s: T("The three designs, colours", "तीन design, रंग"), href: "/poster/card/build?improve=1", scope: "site" },
                ] as { k: string; I: typeof Mic; t: string; s: string; href?: string; onClick?: () => void; premium?: boolean; scope: "both" | "site" | "again" }[]).map((x) => {
                  const inner = (
                    <>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><x.I className="h-5 w-5" /></span>
                      <span className="mt-2 block text-sm font-bold leading-tight">{x.t}{x.premium && <span className="ml-1.5 inline-flex items-center rounded-full bg-[#12144a] px-1.5 py-0.5 align-middle text-[9px] font-bold text-[#ffd54a]">Premium</span>}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-muted">{x.s}</span>
                      <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.scope === "both" ? "bg-good/10 text-good" : "bg-surface2 text-muted"}`}>{x.scope === "both" ? T("Shows on card + website", "Card + website पर दिखेगा") : x.scope === "again" ? T("Card now · website after Write again", "Card अभी · website Write again के बाद") : T("Website only", "सिर्फ़ website")}</span>
                    </>
                  );
                  const cls = "block rounded-2xl border-2 border-border bg-surface p-3 text-left";
                  return x.href ? <Link key={x.k} href={x.href} className={cls}>{inner}</Link> : <button key={x.k} type="button" onClick={x.onClick} disabled={!card} className={`${cls} border-brand/40 bg-brand-soft/30 disabled:opacity-60`}>{inner}</button>;
                })}
              </div>
              {card && <CardChatEdit card={card} locked={!paid} url={s.url} onChanged={(c) => { setCard(c); load(cardId); }} />}
              <PhotoNudge />
              {/* Advanced: everything the six tiles do not cover. */}
              <details className="rounded-2xl border border-border bg-surface">
                <summary className="flex cursor-pointer items-center gap-3 px-3.5 py-3"><Settings className="h-5 w-5 shrink-0 text-brand" />{rowText(T("Advanced", "Advanced"), T("Name & number, full editor, pages, news, settings, your own domain", "नाम और number, पूरा editor, pages, news, settings, अपना domain"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></summary>
                <div className="divide-y divide-border border-t border-border">
                  <Link href={`/poster/onboard?step=you&back=${BACK}`} className={row}><Pencil className="h-5 w-5 shrink-0 text-muted" />{rowText(T("My name, number & photo", "मेरा नाम, number और photo"), T("Changes everywhere at once", "एक साथ हर जगह बदलेगा"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href="/poster/card/build?improve=1&ask=1" className={row}><Sparkles className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Write again with AI", "AI से दोबारा लिखवाएँ"), T("New words, look or pictures — a credit each", "नए शब्द, look या तस्वीरें — हर एक पर credit"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href={`/poster/d/editor?id=${s.cardId}`} className={row}><Type className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Edit text & photos yourself", "शब्द और photos खुद बदलें"), T("The full editor — every page, every section", "पूरा editor — हर page, हर section"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                  <Link href="/poster/website/edit" className={row}><Globe className="h-5 w-5 shrink-0 text-muted" />{rowText(T("Website pages", "Website के pages"), T("Headline, sections, which pages show", "Headline, sections, कौन से pages दिखें"))}<ChevronRight className="h-4 w-4 shrink-0 text-muted" /></Link>
                </div>
                <div className="space-y-4 border-t border-border p-3">
                  {card && <NoticeBox card={card} url={s.url} locked={!paid} onChanged={(c) => setCard(c)} />}
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
                  <Link href="/poster/card" className="flex items-center gap-2 text-sm font-medium text-brand-ink"><Smartphone className="h-4 w-4" /> {T("Card look & settings (the phone card's own design, Shubhora partner page)", "Card का look और settings (phone card का अपना design, Shubhora partner page)")}</Link>
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
