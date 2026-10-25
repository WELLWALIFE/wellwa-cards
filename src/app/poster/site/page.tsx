"use client";
// "Card & Website" (owner's call, 3 Oct 2026: one link, one page — computers get the website, phones the card). Rebuilt
// 6 Oct 2026 ("pura page bada confusing hai — Share ka option, Edit ka option; baaki sab Edit ke andar"): the link, two
// doors — Share and Edit — and everything else behind Edit, in three sections: Look & design, Words & photos, Settings.
// 23 Oct 2026 (owner: "card aur web site ke liye alag alag edit"): two Edit doors — Card and Website — each its own edit page
// (?edit=card / ?edit=site; ?edit=1 asks which), grouped by how often a thing is changed: often (offer, pop-up, products, photos),
// sometimes (banner, name, timings…), rarely (design, pages, settings). The banner is each one's own; everything else is shared,
// so a change made from either page shows on both.
import { FinishBar } from "@/components/poster/site-finish";
import { withView } from "@/lib/site-url";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Globe, Smartphone, Check, RefreshCw, Paintbrush, Copy, Share2, Search, Tag, Package, Camera, Settings, Type, Clock, Store, ListChecks, User, Wallet, LayoutList, FileText, Megaphone, X, Monitor, Sparkles } from "lucide-react";
import { PremiumCard, PremiumGate, PremiumSheet } from "@/components/poster/premium-lock";
import { CardLink, SiteLink } from "@/components/poster/card-sheet";
import { NoticeBox } from "@/components/poster/notice-box";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { PhotoNudge } from "@/components/poster/photo-nudge";
import { fetchMyCardsStrict } from "@/lib/cloud";
import type { Card } from "@/lib/types";
import { DomainConnect } from "@/components/domain-connect";
import { usePlan } from "@/lib/plan";
import { canGoBackInApp, goBack } from "@/lib/nav-back";
import { AdvancedEntry, ADVANCED_HREF } from "@/components/poster/advanced-entry";
import { editHref, lastEdit } from "@/lib/edit-nav";

type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string };
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; customDomain: string; knowledge?: string; site: { enabled: boolean; hidden?: string[]; hideProfile?: boolean; logoUrl?: string; hero?: Hero; generatedAt?: string; templateKey?: string; style?: { palette?: string; font?: string }; reference?: { url: string } } | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string } };

type Panel = "share" | "edit" | null;
/** Which edit page: the phone card's, the website's, or (?edit=1, an older link) the question which one. */
type Target = "card" | "site" | "pick";
const NO_NET = "No internet — tap to try again";

export default function WebsitePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [cardId, setCardId] = useState<string>("");
  // ?made=shubhora: the partner's Shubhora card and website were just published by the set-up (onboard → promoteShubhora).
  const [justMade, setJustMade] = useState(false);
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("made") === "shubhora") { setJustMade(true); window.history.replaceState(null, "", "/poster/site"); } } catch { /* ignore */ } }, []);
  const [err, setErr] = useState("");
  /** A save that failed in "Show or hide pages": shown under the very switch that was tapped (key "enabled" or "page:<slug>"). */
  const [rowErr, setRowErr] = useState<{ key: string; text: string } | null>(null);
  /** A copy that the phone refused: shown under the Copy button that was tapped (the link row at the top, or the Share panel). */
  const [copyFail, setCopyFail] = useState<"top" | "share" | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  /** The Standard sheet, opened wherever a free account (digital card only) taps something that is the website's. */
  const [planSheet, setPlanSheet] = useState(false);
  // Opened with Edit (?edit=1): only the edit tiles, starting at "What do you want to change?" — no link, share or open buttons
  // above them (owner, 14 Oct 2026).
  const [editOnly, setEditOnly] = useState(false);
  const [target, setTarget] = useState<Target>("pick");
  // The tiles that are only a switch or a box unfold below their group instead of opening a page.
  const [openTool, setOpenTool] = useState<"notice" | "mode" | "domain" | null>(null);
  /** Website: everything is on one page now (Website edit); the separate tiles open only on a tap (owner, 25 Oct 2026). */
  const [allTiles, setAllTiles] = useState(false);
  // Arrived straight from the builder (?published=1): the greeting at the top; ?edit=1 / ?share=1 open that door.
  /** Back from a focused edit (?saved=…): one line says it is on the website, for a moment. */
  const [saved, setSaved] = useState(false);
  /** Edit and this page's first screen are two addresses of ONE component: the address decides which one shows, on arrival and
   *  on the browser's Back, and "Edit card & website" moves to the Edit address without a reload. */
  function fromAddress() {
    try {
      const q = new URLSearchParams(window.location.search);
      const e = q.get("edit");
      const edit = !!e && q.get("share") !== "1";
      setEditOnly(edit);
      setTarget(e === "card" ? "card" : e === "site" ? "site" : "pick");
      setPanel(edit ? "edit" : q.get("share") === "1" ? "share" : e ? "edit" : null);
    } catch { /* ignore */ }
  }
  function onEditAddress() {
    try { const q = new URLSearchParams(window.location.search); return !!q.get("edit") && q.get("share") !== "1"; } catch { return false; }
  }
  const viaDoor = () => { try { return !!(window.history.state as { siteDoor?: number } | null)?.siteDoor; } catch { return false; } };
  /** Arrived from a focused edit's Save (…?edit=1&saved=1): the entry just below this one is the Edit that edit was opened from. */
  const savedArrival = useRef(false);
  const skipEdit = useRef(false);
  /** Back from the Edit address = the screen the owner was just on (R1). Opened by this page's own Edit button, that is the first screen.
   *  Otherwise the app's own Back; after a focused edit's Save that lands on the very same Edit (the edit page replaced itself), so it
   *  goes one step further. With no earlier screen at all (a link opened fresh) the first screen takes the Edit's place — replaced, not
   *  pushed, so Back from there cannot return to the Edit. */
  function leaveEdit() {
    if (viaDoor()) { window.history.back(); return; }
    if (canGoBackInApp()) {
      skipEdit.current = savedArrival.current; savedArrival.current = false;
      if (skipEdit.current) setTimeout(() => { skipEdit.current = false; }, 1500);
      router.back();
      return;
    }
    window.history.replaceState(null, "", "/poster/site");
    fromAddress();
    try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
  }
  useEffect(() => {
    const onPop = () => {
      fromAddress();
      if (skipEdit.current) { skipEdit.current = false; if (onEditAddress()) leaveEdit(); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      fromAddress();
      if (q.has("saved")) { setSaved(true); savedArrival.current = true; setTimeout(() => setSaved(false), 8000); }
      // The one-time flags leave the address, so a reload or Back does not replay them.
      if (q.has("saved") || q.has("published")) { q.delete("saved"); q.delete("published"); window.history.replaceState(null, "", `${window.location.pathname}${q.toString() ? `?${q}` : ""}`); }
    } catch { /* ignore */ }
  }, []);
  /** Moving between the Card and Website edit pages (the switch at their top): the same history entry, only the address changes. */
  function switchTarget(which: Exclude<Target, "pick">) {
    try { window.history.replaceState(window.history.state, "", `/poster/site?edit=${which}`); } catch { /* ignore */ }
    setTarget(which); setOpenTool(null);
    try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
  }
  /** Where a focused edit comes back to: this page, the same Edit page open. */
  const BACK = encodeURIComponent(`/poster/site?edit=${target === "pick" ? "1" : target}`);
  const { plan, loading: planLoading } = usePlan();
  // Which paid tier (owner's call, 8 Oct 2026): the own domain is Growth's; Starter has the salesman, not the domain.
  const [tier, setTier] = useState<string | null>(null);
  useEffect(() => { api<{ tier?: string | null }>("/api/poster/plan").then((r) => { if (r.ok) setTier(r.data.tier ?? null); }).catch(() => undefined); }, []);
  const domainOk = tier === "growth" || tier === "pro";
  const paid = planLoading || plan !== "free";
  // One "Edit" (owner, 26 Oct 2026: "extra steps hatao, no confusion"): the Edit address no longer shows a screen of its own with a second
  // Edit button — it opens the editor straight away (card or website, the last one used; the editor has the Card | Website switch).
  useEffect(() => {
    if (panel !== "edit" || !s || planLoading) return;
    const siteOn = s.hasCard && !!s.site?.enabled;
    const noSiteNow = !paid && s.hasCard && !siteOn;
    const at = noSiteNow || target === "card" ? "card" : target === "site" ? "site" : lastEdit() ?? (siteOn ? "site" : "card");
    router.replace(editHref(at));
  }, [panel, s, target, paid, planLoading, router]);
  // The live card, for "change something" (card-chat-edit.tsx) and the notice.
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => { if (!cardId) return; fetchMyCardsStrict().then((cs) => setCard(cs.find((c) => c.id === cardId) ?? cs[0] ?? null)).catch(() => undefined); }, [cardId]);
  const [copied, setCopied] = useState(false);
  /** The one address shown, copied, shared and opened: the owner's own domain when connected, else the Shubhora link. */
  const link = s?.hasCard ? (s.customDomain ? `https://${s.customDomain}` : s.url) : "";
  /** The website link: on the owner's own domain the plain address IS the website (proxy.ts); the Shubhora link needs ?view=site. */
  const siteLink = s?.hasCard && s.customDomain ? link : withView(link, "site");
  async function copy(where: "top" | "share") { if (!s || !s.hasCard) return; setCopyFail(null); try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopyFail(where); } }
  function shareCard() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `नमस्ते! ये मेरा digital card है — contact, products और बाकी सब एक tap में: ${withView(link, "card")}` : `Hello! Here is my digital card — contact, products and more in one tap: ${withView(link, "card")}`)}`, "_blank", "noopener"); }
  function shareSite() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `हमारी website देखें — products, services और हमारे बारे में सब कुछ: ${siteLink}` : `See our website — products, services and all about us: ${siteLink}`)}`, "_blank", "noopener"); }

  // api() resolves on ANY status, so a 401 (expired login) or a server error must be caught here — without
  // this check the screen keeps spinning for ever with nothing to tap.
  const load = useCallback(async (id?: string, quiet?: boolean): Promise<boolean> => {
    if (!quiet) setErr("");
    try {
      const r = await api<Status & { error?: string }>(`/api/site/status${id ? `?card=${id}` : ""}`);
      if (!r.ok) { if (!quiet) setErr(r.data?.error || NO_NET); return false; }
      setS(r.data);
      if (r.data.hasCard) setCardId(r.data.cardId);
      return true;
    } catch {
      if (!quiet) setErr(NO_NET);
      return false;
    }
  }, []);
  // Replace, not push: Back from the login page must not land here again and bounce straight back to it. The address (Edit / Share) comes back as it was.
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/site${window.location.search}`)}`); return; } load(); })(); }, [router, load]);

  /** `key` says which switch was tapped, so a failure shows right under that switch (not at the top of the page). */
  async function patch(p: { enabled?: boolean; hidden?: string[] }, key: string) {
    setRowErr(null);
    const bad = (why?: string) => setRowErr({ key, text: why || (hi ? "Save नहीं हुआ — internet देखकर दोबारा try करें।" : "Could not save. Check the internet and try again.") });
    try {
      const r = await api<{ error?: string; plan?: boolean }>("/api/site/status", { method: "PATCH", json: { ...p, card_id: cardId } });
      if (!r.ok) { if (r.data?.plan) setPlanSheet(true); bad(r.data?.error); return; }
    } catch { bad(); return; }
    if (!(await load(cardId, true))) bad();
  }
  /** Back = the screen the owner was just on (lib/nav-back); only when there is none, the Create tab this page hangs off. The Edit address is
   *  the first screen's child: its Back is leaveEdit. A focused edit's Save replaces its own form, so Back never lands on a finished one. */
  // Just made by the set-up: Back is Home, not the set-up question behind this page (owner, 19 Oct 2026: it landed on "About you").
  function back() { if (editOnly) leaveEdit(); else if (justMade) router.replace("/poster"); else goBack(router, "/poster/create"); }

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
  // The free plan is the digital card only (owner, 16 Oct 2026): a free account whose website is not on is offered Standard, not a website.
  // A free account that already has its website on is left exactly as it was.
  const noSite = !paid && s.hasCard && !s.site?.enabled;
  const door = (k: Exclude<Panel, null>) => `flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3.5 text-base font-semibold ${panel === k ? "border-brand bg-brand-soft/60 text-brand-ink" : "border-border bg-surface"}`;
  const doorSub = "block text-[11px] font-normal leading-tight text-muted";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={back} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold flex-1">{T("Card & Website", "Card & Website")}</h1>
      </div>

      {justMade && s.hasCard && (
        <section className="rounded-2xl border border-good/40 bg-good/10 p-4">
          <p className="flex items-center gap-2 text-base font-bold"><Check className="h-5 w-5 text-good" /> {T("Your Shubhora card and website are ready", "आपका Shubhora card और website तैयार है")}</p>
          <p className="mt-1 text-sm text-muted">{T("One link: on a phone it opens as your card, on a computer as your website. Share it below, or tap Edit to put your own photo and words on it.", "एक link: phone पर card खुलता है, computer पर website। नीचे से share करें, या Edit दबाकर अपनी photo और बातें डालें।")}</p>
        </section>
      )}
      {!s.hasCard ? (
        <section className="rounded-xl border border-border p-4 text-center space-y-3">
          <p className="text-sm text-muted">{!paid ? T("Make your digital card. It is free.", "अपना digital card बनाएँ। ये free है।") : T("Make your website first. Your card is made from it.", "पहले अपनी website बनाएँ। card उसी से बन जाता है।")}</p>
          <Link href="/poster/card/build" className="inline-block rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">{!paid ? T("Make my card →", "मेरा card बनाएँ →") : T("Make my website →", "मेरी website बनाएँ →")}</Link>
        </section>
      ) : (
        <>
          {s.cards.length > 1 && (
            <div className="space-y-1.5">
              <select value={cardId} onChange={(e) => { setRowErr(null); void load(e.target.value); }} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
                {s.cards.map((c) => <option key={c.id} value={c.id}>{c.name} — /c/{c.username}</option>)}
              </select>
              {err && <p className="text-xs font-semibold text-danger">{err === NO_NET ? T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।") : err}</p>}
            </div>
          )}

          {!editOnly && <>
          {/* The guided finish on top: progress and the one next step (owner, 24 Oct 2026). */}
          <FinishBar hi={hi} />
          {/* Redesigned 24 Oct 2026 (owner: "3 alag box, achhe se — design bahut important hai"): three clear boxes — Share, Edit, Grow —
              each with a coloured head, one short line, and big icon tiles. */}
          {(() => {
            const tile = "flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3.5 text-center transition active:scale-[.97]";
            const icon = (bg: string, fg: string, I: typeof Globe) => <span className={`grid h-11 w-11 place-items-center rounded-full ${bg}`}><I className={`h-5 w-5 ${fg}`} /></span>;
            const head = (n: number, title: string, sub: string, cls: string) => (
              <div className={`flex items-center gap-3 px-4 pt-3.5 pb-3 ${cls}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-extrabold text-white">{n}</span>
                <span className="min-w-0"><span className="block text-base font-extrabold text-white">{title}</span><span className="block text-[12px] text-white/85">{sub}</span></span>
              </div>
            );
            return (
              <div className="space-y-4">
                {/* 1 · Share */}
                <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
                  {head(1, T("Share", "Share करें"), T("Send to customers on WhatsApp", "ग्राहकों को WhatsApp पर भेजें"), "bg-gradient-to-r from-[#1fb956] to-[#25D366]")}
                  <div className="space-y-3 p-3">
                    <div className={`grid gap-2.5 ${noSite ? "grid-cols-2" : "grid-cols-3"}`}>
                      <button type="button" onClick={shareCard} className={`${tile} bg-[#25D366]/10 ring-1 ring-[#25D366]/30`}>{icon("bg-[#25D366]", "text-white", Smartphone)}<span className="text-sm font-bold">{T("Card", "Card")}</span></button>
                      {!noSite && <button type="button" onClick={shareSite} className={`${tile} bg-[#25D366]/10 ring-1 ring-[#25D366]/30`}>{icon("bg-[#25D366]", "text-white", Globe)}<span className="text-sm font-bold">{T("Website", "Website")}</span></button>}
                      <Link href="/poster/share" className={`${tile} bg-surface2 ring-1 ring-border`}>{icon("bg-white", "text-ink", Share2)}<span className="text-sm font-bold">{T("QR code", "QR code")}</span></Link>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-surface2 py-1.5 pl-3 pr-1.5">
                      <Globe className="h-4 w-4 shrink-0 text-brand" />
                      <code className="min-w-0 flex-1 truncate text-[13px] font-semibold">{link.replace(/^https?:\/\//, "")}</code>
                      <button type="button" onClick={() => void copy("top")} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-surface px-3 py-2 text-xs font-bold text-brand-ink shadow-sm" aria-label={T("Copy link", "Link copy करें")}>{copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />} {copied ? T("Copied", "Copy हुआ") : "Copy"}</button>
                    </div>
                    {copyFail === "top" && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">{T("Could not copy. Press and hold the link to copy it.", "Copy नहीं हुआ। link को दबाकर रखें और copy करें।")}</p>}
                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                      <CardLink href={withView(link, "card")} title={T("My card", "मेरा card")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2"><Smartphone className="h-4 w-4 text-brand" /> {T("See card", "Card देखें")}</CardLink>
                      {noSite
                        ? <button type="button" onClick={() => setPlanSheet(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2"><Monitor className="h-4 w-4 text-brand" /> {T("Get a website", "Website पाएँ")}</button>
                        : <SiteLink href={siteLink} appHref={s.hasCard ? `/c/${s.username}?view=site` : undefined} title={T("Website", "Website")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2"><Monitor className="h-4 w-4 text-brand" /> {T("See website", "Website देखें")}</SiteLink>}
                    </div>
                  </div>
                </section>

                {/* 2 · Edit */}
                <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
                  {head(2, T("Edit", "Edit करें"), T("Change details, photos and offers", "जानकारी, photo और offer बदलें"), "bg-gradient-to-r from-[#2f5bf5] to-[#5b7cff]")}
                  <div className="p-3">
                    <Link href={editHref(noSite ? "card" : lastEdit() ?? (s.site?.enabled ? "site" : "card"))} className="flex items-center gap-3 rounded-2xl bg-brand-soft/50 p-3.5 ring-1 ring-brand/20 transition active:scale-[.98]">
                      {icon("bg-brand", "text-white", Paintbrush)}
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold">{T("Edit card & website", "Card और website edit करें")}</span>
                        <span className="block text-xs text-muted">{T("One place for both — see each change live", "दोनों एक ही जगह — हर बदलाव तुरंत दिखता है")}</span>
                      </span>
                      <ChevronLeft className="h-5 w-5 shrink-0 rotate-180 text-muted" />
                    </Link>
                  </div>
                </section>

                {/* 3 · Grow: Google SEO, and the Premium website (Rs 5,999; every card, partner cards too — owner, 23 Oct 2026) */}
                <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
                  {head(3, T("Grow", "आगे बढ़ें"), T("Get found on Google, look premium", "Google पर दिखें, premium दिखें"), "bg-gradient-to-r from-[#8b3dff] to-[#c04ee8]")}
                  <div className="grid grid-cols-2 gap-2.5 p-3">
                    <Link href={`/poster/site/seo${cardId ? `?card=${cardId}` : ""}`} className={`${tile} bg-surface2 ring-1 ring-border`}>{icon("bg-white", "text-brand", Search)}<span className="text-sm font-bold">{T("Google SEO", "Google SEO")}</span><span className="text-[11px] text-muted">{T("show up in search", "search में आएँ")}</span></Link>
                    <Link href={`${ADVANCED_HREF}${cardId ? `?card=${encodeURIComponent(cardId)}` : ""}`} className={`${tile} bg-ai-soft/50 ring-1 ring-ai/30`}>{icon("bg-ai", "text-white", Sparkles)}<span className="text-sm font-bold text-ai">{T("Premium website", "Premium website")}</span><span className="text-[11px] text-muted">{T("made by AI for you", "AI से खास design")}</span></Link>
                  </div>
                </section>
              </div>
            );
          })()}
          </>}

          {panel === "edit" && target === "pick" && (
            <div className="space-y-3">
              <p className="text-base font-bold">{T("What do you want to edit?", "क्या edit करना है?")}</p>
              {saved && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {T("Saved.", "Save हो गया।")}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => switchTarget("card")} className={door("edit")}><Smartphone className="h-6 w-6" /> {T("Card", "Card")}<span className={doorSub}>{T("opens on a phone", "phone पर खुलता है")}</span></button>
                <button type="button" onClick={() => (noSite ? setPlanSheet(true) : switchTarget("site"))} className={door("edit")}><Globe className="h-6 w-6" /> {T("Website", "Website")}<span className={doorSub}>{T("opens on a computer", "computer पर खुलती है")}</span></button>
              </div>
            </div>
          )}

          {panel === "edit" && target !== "pick" && (
            <div className="space-y-5">
              {/* Card or Website: one switch on top, so the owner always sees which one is being changed and can hop to the other. */}
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface2 p-1" role="tablist">
                {(["card", "site"] as const).map((w) => (
                  <button key={w} type="button" role="tab" aria-selected={target === w} onClick={() => (w === "site" && noSite ? setPlanSheet(true) : switchTarget(w))}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold ${target === w ? "bg-surface text-brand-ink shadow-card" : "text-muted"}`}>
                    {w === "card" ? <Smartphone className="h-4 w-4" /> : <Globe className="h-4 w-4" />} {w === "card" ? T("Card", "Card") : T("Website", "Website")}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-base font-bold">{target === "card" ? T("Edit your card", "अपना card edit करें") : T("Edit your website", "अपनी website edit करें")}</p>
                {target === "card"
                  ? <CardLink href={withView(link, "card")} title={T("My card", "मेरा card")} className="shrink-0 text-xs font-semibold text-brand-ink underline">{T("See card", "Card देखें")}</CardLink>
                  : <SiteLink href={`${siteLink}`} appHref={s.hasCard ? `/c/${s.username}?view=site` : undefined} title={T("Website", "Website")} className="shrink-0 text-xs font-semibold text-brand-ink underline">{T("See website", "Website देखें")}</SiteLink>}
              </div>
              <p className="rounded-xl bg-brand-soft/50 px-3 py-2 text-xs leading-relaxed text-ink">
                {T("Green tag = changes on both.", "हरा tag = दोनों में बदलेगा।")}
              </p>
              {saved && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {T("Saved. It is live now.", "Save हो गया। अब live है।")} {target === "card" ? <CardLink href={withView(link, "card")} title={T("My card", "मेरा card")} className="underline">{T("See it", "देखें")}</CardLink> : <SiteLink href={`${siteLink}`} appHref={s.hasCard ? `/c/${s.username}?view=site` : undefined} title={T("Website", "Website")} className="underline">{T("See it", "देखें")}</SiteLink>}</p>}
              <PhotoNudge />
              {(() => {
                const isCard = target === "card";
                type Tool = "notice" | "mode" | "domain";
                type Tile = { k: string; I: typeof Camera; t: string; s: string; href?: string; tool?: Tool; scope: "both" | "card" | "site" };
                const photos = (part: string) => `/poster/onboard?step=extras&part=${part}&for=${target}${cardId ? `&card=${cardId}` : ""}&back=${BACK}`;
                // Grouped by how often a person changes it (owner, 23 Oct 2026): often first, then sometimes, then the rarely-touched look and settings.
                const groups: { k: string; title: string; note: string; tiles: Tile[] }[] = [
                  { k: "often", title: T("⚡ Change often", "⚡ बार-बार बदलने वाले"), note: T("Offers, prices and new photos", "Offer, दाम और नई photos"), tiles: [
                    { k: "notice", I: Megaphone, t: T("Offer / pop-up", "Offer / pop-up"), s: T("A line on top or a pop-up: “Diwali 20% off”, holiday, news", "ऊपर पट्टी या pop-up: “Diwali 20% छूट”, छुट्टी, ख़बर"), tool: "notice", scope: "both" },
                    { k: "products", I: Package, t: T("Products & prices", "Products और दाम"), s: T("Add, change prices, add photos", "जोड़ें, दाम बदलें, photo लगाएँ"), href: `/poster/products?back=${BACK}`, scope: "both" },
                    { k: "photo", I: Camera, t: T("Photos & gallery", "Photos और gallery"), s: T("New work photos, events, albums", "काम की नई photos, event, albums"), href: photos("photos"), scope: "both" },
                    ...(isCard ? [] : [{ k: "pages", I: LayoutList, t: T("Website text & layout", "Website का text और layout"), s: T("Top heading, banners' words, order of sections", "ऊपर की heading, banners के शब्द, हिस्सों का क्रम"), href: "/poster/website/edit", scope: "site" as const }]),
                  ] },
                  { k: "sometimes", title: T("🗓️ Change sometimes", "🗓️ कभी-कभी बदलने वाले"), note: T("Banner, your details, timings", "Banner, आपकी जानकारी, समय"), tiles: [
                    { k: "banner", I: isCard ? Smartphone : Globe, t: isCard ? T("Card banner", "Card का banner") : T("Website banner", "Website का banner"), s: isCard ? T("The big picture on top of your card", "card के ऊपर की बड़ी picture") : T("The big picture on top of your website", "website के ऊपर की बड़ी picture"), href: photos("photos"), scope: isCard ? "card" : "site" },
                    { k: "you", I: User, t: T("My name, number & photo", "मेरा नाम, number और photo"), s: T("Also on your posters", "poster पर भी बदलेगा"), href: `/poster/onboard?step=you&back=${BACK}`, scope: "both" },
                    { k: "where", I: Clock, t: T("Timings & address", "समय और पता"), s: T("City, address, map pin, opening hours", "शहर, पता, map pin, खुलने का समय"), href: `/poster/onboard?step=where&back=${BACK}`, scope: "both" },
                    { k: "links", I: Wallet, t: T("UPI & social media", "UPI और social media"), s: T("So people can pay you and follow you", "ताकि लोग pay और follow कर सकें"), href: `/poster/onboard?step=extras&part=links&back=${BACK}`, scope: "both" },
                    { k: "about", I: Type, t: T("About & logo", "परिचय और logo"), s: T("A few lines about you, your logo", "आपके बारे में कुछ लाइनें, logo"), href: `/poster/onboard?step=about&back=${BACK}`, scope: "both" },
                    { k: "details", I: ListChecks, t: T("What you offer", "आप क्या देते हैं"), s: T("And why people choose you", "और लोग आपको क्यों चुनते हैं"), href: `/poster/onboard?step=details&back=${BACK}`, scope: "both" },
                    { k: "trade", I: Store, t: T("Business name & type", "Business का नाम और काम"), s: T("Your name, what you do", "आपका नाम, आपका काम"), href: `/poster/onboard?step=trade&back=${BACK}`, scope: "both" },
                  ] },
                  { k: "rarely", title: isCard ? T("🎨 Look (rarely)", "🎨 Look (कभी-कभार)") : T("🎨 Look & settings (rarely)", "🎨 Look और settings (कभी-कभार)"), note: isCard ? T("Usually set once", "अक्सर एक ही बार") : T("Design, pages, web address, Google", "Design, pages, web address, Google"), tiles: isCard ? [
                    { k: "cardlook", I: Paintbrush, t: T("Card design", "Card का design"), s: T("Colours and look of your phone card", "phone card का रंग और look"), href: "/poster/card", scope: "card" },
                    { k: "editor", I: FileText, t: T("Full editor", "पूरा editor"), s: T("Change any word or photo by hand", "कोई भी शब्द या photo हाथ से बदलें"), href: `/poster/d/editor?id=${s.cardId}&back=${BACK}`, scope: "both" },
                  ] : [
                    { k: "design", I: Paintbrush, t: T("Website design", "Website का design"), s: T("Pick one of six looks and your colours", "छह look में से चुनें, और रंग"), href: "/poster/card/build?improve=1", scope: "site" },
                    { k: "mode", I: Settings, t: T("Show or hide pages", "Pages दिखाएँ या छुपाएँ"), s: T("Choose what people can see", "चुनें कि लोग क्या देखें"), tool: "mode", scope: "site" },
                    { k: "domain", I: Globe, t: T("Your own web address", "अपना web address"), s: T("www.yourshop.com", "www.yourshop.com"), tool: "domain", scope: "site" },
                    { k: "seo", I: Search, t: T("Google SEO", "Google SEO"), s: T("Be found on Google", "Google पर मिलें"), href: `/poster/site/seo${cardId ? `?card=${cardId}` : ""}`, scope: "site" },
                    { k: "editor", I: FileText, t: T("Full editor", "पूरा editor"), s: T("Change any word or photo by hand", "कोई भी शब्द या photo हाथ से बदलें"), href: `/poster/d/editor?id=${s.cardId}&back=${BACK}`, scope: "both" },
                  ] },
                ];
                const base = "block rounded-2xl border bg-surface p-3 text-left shadow-sm transition active:scale-[.98]";
                const badge = (sc: Tile["scope"]) => (
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${sc === "both" ? "bg-good/10 text-good" : "bg-brand-soft text-brand-ink"}`}>
                    {sc === "both" ? T("Both", "दोनों") : sc === "card" ? T("Card only", "सिर्फ़ card") : T("Website only", "सिर्फ़ website")}
                  </span>
                );
                const tile = (x: Tile) => {
                  const on = x.tool && openTool === x.tool;
                  const inner = (
                    <>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><x.I className="h-5 w-5" /></span>
                      <span className="mt-2 block text-sm font-bold leading-tight">{x.t}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-muted">{x.s}</span>
                      {badge(x.scope)}
                    </>
                  );
                  return x.href
                    ? <Link key={x.k} href={x.href} className={`${base} border-border`}>{inner}</Link>
                    : <button key={x.k} type="button" onClick={() => { setRowErr(null); setOpenTool(on ? null : x.tool ?? null); }} aria-expanded={!!on} className={`${base} ${on ? "border-brand bg-brand-soft/40" : "border-border"}`}>{inner}</button>;
                };
                // Each group a box with its own coloured head, like the Card & Website first screen (owner, 24 Oct 2026: professional look).
                const groupHead: Record<string, string> = { often: "bg-gradient-to-r from-[#f59e0b] to-[#f97316]", sometimes: "bg-gradient-to-r from-[#2f5bf5] to-[#5b7cff]", rarely: "bg-gradient-to-r from-[#8b3dff] to-[#c04ee8]" };
                const has = (g: { tiles: Tile[] }, t: Tool) => g.tiles.some((x) => x.tool === t);
                return (
                  <>
                    {!isCard && <FinishBar hi={hi} />}
                    {(
                      <Link href={isCard ? "/poster/card/edit" : "/poster/website/edit"} className="relative block overflow-hidden rounded-3xl bg-gradient-to-br from-[#2f5bf5] to-[#7b5cff] p-5 text-white shadow-float transition active:scale-[.99]">
                        <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
                        <span className="relative flex items-center gap-3">
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20"><Paintbrush className="h-6 w-6" /></span>
                          <span className="min-w-0 flex-1"><span className="block text-lg font-extrabold leading-tight">{isCard ? T("Edit card", "Card edit करें") : T("Edit website", "Website edit करें")}</span>
                            <span className="block text-xs text-white/85">{T("Everything in one place — design, photos, products, contact, settings. See each change live.", "सब कुछ एक जगह — design, photos, products, संपर्क, settings। हर बदलाव live दिखेगा।")}</span></span>
                          <ChevronLeft className="h-5 w-5 shrink-0 rotate-180" />
                        </span>
                      </Link>
                    )}
                    {!allTiles && (
                      <button type="button" onClick={() => setAllTiles(true)} className="w-full rounded-2xl border border-border py-2.5 text-xs font-semibold text-muted">{T("Open one thing at a time ▾", "एक-एक करके खोलें ▾")}</button>
                    )}
                    {allTiles && groups.map((g) => (
                      <section key={g.k} className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
                        <div className={`px-4 py-3 text-white ${groupHead[g.k] ?? groupHead.sometimes}`}>
                          <h2 className="text-base font-bold leading-tight">{g.title}</h2>
                          <p className="text-[11px] text-white/85">{g.note}</p>
                        </div>
                        <div className="space-y-2 p-3">
                        {/* The Premium website (Rs 5,999) next to the six designs, so it is found where the look is chosen. */}
                        {g.k === "rarely" && !isCard && <AdvancedEntry key={`adv-${cardId}`} cardId={cardId} fetchState />}
                        <div className="grid grid-cols-2 gap-2">{g.tiles.map(tile)}</div>
                        {has(g, "notice") && openTool === "notice" && (
                          <ToolSheet title={T("Offer / pop-up", "Offer / pop-up")} onClose={() => setOpenTool(null)} closeLabel={T("Close", "बंद करें")}>
                            {card ? <NoticeBox card={card} url={s.url} locked={!paid} onChanged={(c) => setCard(c)} /> : <div className="grid place-items-center py-10"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
                          </ToolSheet>
                        )}
                        {has(g, "mode") && openTool === "mode" && (
                          <ToolSheet title={T("Show or hide pages", "Pages दिखाएँ या छुपाएँ")} onClose={() => setOpenTool(null)} closeLabel={T("Close", "बंद करें")}>
                          <div className="space-y-3">
                            <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
                              <span><span className="block text-sm font-medium">{T("Website on computers", "Computer पर website")}</span><span className="text-[11px] text-muted">{s.site?.enabled ? T("ON — website on computers, card on phones", "ON — computer पर website, phone पर card") : T("OFF — the card shows everywhere", "OFF — हर जगह card दिखता है")}</span></span>
                              <input type="checkbox" className="h-5 w-5" checked={!!s.site?.enabled} onChange={(e) => patch({ enabled: e.target.checked }, "enabled")} />
                            </label>
                            {rowErr?.key === "enabled" && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{rowErr.text}</p>}
                            <p className="text-sm font-semibold">{T("Pages shown on the website", "Website पर कौन से pages दिखें")}</p>
                            {s.pages.map((p) => (
                              <div key={p.slug} className="space-y-1.5">
                                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                                  <span className="text-sm">{p.label} <span className="text-[11px] text-muted">· {p.blocks} {T("sections", "हिस्से")}</span></span>
                                  <input type="checkbox" className="h-5 w-5" checked={!hidden.has(p.slug)} onChange={(e) => { const h = new Set(hidden); if (e.target.checked) h.delete(p.slug); else h.add(p.slug); patch({ hidden: [...h] }, `page:${p.slug}`); }} />
                                </label>
                                {rowErr?.key === `page:${p.slug}` && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{rowErr.text}</p>}
                              </div>
                            ))}
                          </div>
                          </ToolSheet>
                        )}
                        {has(g, "domain") && openTool === "domain" && (
                          <ToolSheet title={T("Your own web address", "अपना web address")} onClose={() => setOpenTool(null)} closeLabel={T("Close", "बंद करें")}>
                          <div>
                            {domainOk || s.customDomain
                              ? <DomainConnect cardId={s.cardId} username={s.username} initialDomain={s.customDomain || undefined} />
                              : <p className="text-sm text-muted">{T("Your own web address (www.yourshop.com) comes with Standard.", "अपना web address (www.yourshop.com) Standard के साथ आता है।")}</p>}
                          </div>
                          </ToolSheet>
                        )}
                        {g.k === "rarely" && !paid && (
                          <PremiumGate locked feature={T("Removing the Shubhora tag", "Shubhora tag हटाना")}>
                            <div className="rounded-xl border border-border bg-surface p-3 pr-20"><p className="flex items-center gap-1.5 text-sm font-semibold"><Tag className="h-4 w-4 text-brand" /> {T("Remove the Shubhora tag", "Shubhora tag हटाएँ")}</p></div>
                          </PremiumGate>
                        )}
                        </div>
                      </section>
                    ))}
                  </>
                );
              })()}
            </div>
          )}

          {!paid && <PremiumCard compact />}
        </>
      )}
      {planSheet && <PremiumSheet feature={T("A website", "Website")} onClose={() => setPlanSheet(false)} />}
    </div>
  );
}

/** A tile's editor opened as a pop-up over the page (owner, 23 Oct 2026: "Offer / pop-up dabane par pop khulna chahiye"): a sheet from the bottom
 *  on a phone, a centred box on a wide screen. Closes with ✕, a tap outside, or the Escape key; the page under it does not scroll. */
function ToolSheet({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  // On <body>, so no parent's transform or overflow can trap or clip it.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <p className="min-w-0 flex-1 text-base font-bold">{title}</p>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
