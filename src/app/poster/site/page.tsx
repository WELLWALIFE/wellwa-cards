"use client";
// "Card & Website" (owner's call, 3 Oct 2026: one link, one page — computers get the website, phones the card). Rebuilt
// 6 Oct 2026 ("pura page bada confusing hai — Share ka option, Edit ka option; baaki sab Edit ke andar"): the link, two
// doors — Share and Edit — and everything else behind Edit, in three sections: Look & design, Words & photos, Settings.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, ChevronRight, Globe, Smartphone, Pencil, Check, RefreshCw, Paintbrush, Copy, Share2, Search, Tag, Package, Camera, Settings, Type, Clock, Store, Star, ListChecks, User, Wallet, LayoutList, FileText, Megaphone } from "lucide-react";
import { PremiumCard, PremiumGate, PremiumSheet } from "@/components/poster/premium-lock";
import { CardLink } from "@/components/poster/card-sheet";
import { NoticeBox } from "@/components/poster/notice-box";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { PhotoNudge } from "@/components/poster/photo-nudge";
import { fetchMyCardsStrict } from "@/lib/cloud";
import type { Card } from "@/lib/types";
import { DomainConnect } from "@/components/domain-connect";
import { usePlan } from "@/lib/plan";
import { canGoBackInApp, goBack } from "@/lib/nav-back";
import { AdvancedEntry } from "@/components/poster/advanced-entry";

type Hero = { headline?: string; sub?: string; ctaLabel?: string; imageUrl?: string };
type Status = { hasCard: false } | { hasCard: true; cards: { id: string; username: string; name: string }[]; cardId: string; username: string; url: string; customDomain: string; knowledge?: string; site: { enabled: boolean; hidden?: string[]; hideProfile?: boolean; logoUrl?: string; hero?: Hero; generatedAt?: string; templateKey?: string; style?: { palette?: string; font?: string }; reference?: { url: string } } | null; pages: { slug: string; label: string; blocks: number }[]; images: { label: string; url: string }[]; defaults: { headline: string; sub: string; jobTitle: string } };

type Panel = "share" | "edit" | null;
const NO_NET = "No internet — tap to try again";

export default function WebsitePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [cardId, setCardId] = useState<string>("");
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
  // The tiles that are only a switch or a box unfold below their group instead of opening a page.
  const [openTool, setOpenTool] = useState<"notice" | "mode" | "domain" | null>(null);
  // Arrived straight from the builder (?published=1): the greeting at the top; ?edit=1 / ?share=1 open that door.
  /** Back from a focused edit (?saved=…): one line says it is on the website, for a moment. */
  const [saved, setSaved] = useState(false);
  /** Edit and this page's first screen are two addresses of ONE component: the address decides which one shows, on arrival and
   *  on the browser's Back, and "Edit card & website" moves to the Edit address without a reload. */
  function fromAddress() {
    try {
      const q = new URLSearchParams(window.location.search);
      const edit = q.get("edit") === "1" && q.get("share") !== "1";
      setEditOnly(edit);
      setPanel(edit ? "edit" : q.get("share") === "1" ? "share" : q.get("edit") === "1" ? "edit" : null);
    } catch { /* ignore */ }
  }
  function onEditAddress() {
    try { const q = new URLSearchParams(window.location.search); return q.get("edit") === "1" && q.get("share") !== "1"; } catch { return false; }
  }
  /** "Edit card & website" moves to the Edit address without a reload. That entry is marked (`siteDoor`): this page's first screen is the
   *  entry right below it, so the browser's Back and the arrow are the same move (they never bounce between the two screens). */
  function openEdit() {
    window.history.pushState({ siteDoor: 1 }, "", "/poster/site?edit=1");
    fromAddress();
    try { window.scrollTo({ top: 0 }); } catch { /* ignore */ }
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
  /** Where a focused edit comes back to: this page, the Edit door open. */
  const BACK = encodeURIComponent("/poster/site?edit=1");
  const { plan, loading: planLoading } = usePlan();
  // Which paid tier (owner's call, 8 Oct 2026): the own domain is Growth's; Starter has the salesman, not the domain.
  const [tier, setTier] = useState<string | null>(null);
  useEffect(() => { api<{ tier?: string | null }>("/api/poster/plan").then((r) => { if (r.ok) setTier(r.data.tier ?? null); }).catch(() => undefined); }, []);
  const domainOk = tier === "growth" || tier === "pro";
  const paid = planLoading || plan !== "free";
  // The live card, for "change something" (card-chat-edit.tsx) and the notice.
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => { if (!cardId) return; fetchMyCardsStrict().then((cs) => setCard(cs.find((c) => c.id === cardId) ?? cs[0] ?? null)).catch(() => undefined); }, [cardId]);
  const [copied, setCopied] = useState(false);
  /** The one address shown, copied, shared and opened: the owner's own domain when connected, else the Shubhora link. */
  const link = s?.hasCard ? (s.customDomain ? `https://${s.customDomain}` : s.url) : "";
  async function copy(where: "top" | "share") { if (!s || !s.hasCard) return; setCopyFail(null); try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopyFail(where); } }
  function shareCard() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `नमस्ते! ये मेरा digital card है — contact, products और बाकी सब एक tap में: ${link}` : `Hello! Here is my digital card — contact, products and more in one tap: ${link}`)}`, "_blank", "noopener"); }
  function shareSite() { if (!s || !s.hasCard) return; window.open(`https://wa.me/?text=${encodeURIComponent(hi ? `हमारी website देखें — products, services और हमारे बारे में सब कुछ: ${link}?view=site` : `See our website — products, services and all about us: ${link}?view=site`)}`, "_blank", "noopener"); }

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
  function back() { if (editOnly) leaveEdit(); else goBack(router, "/poster/create"); }

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
          {/* ---- 1. the link ---- */}
          <section className="space-y-3 rounded-2xl border border-border p-3">
            <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2.5">
              <Globe className="h-4 w-4 shrink-0 text-brand" />
              <code className="min-w-0 flex-1 truncate text-sm font-semibold">{link.replace(/^https?:\/\//, "")}</code>
              <button type="button" onClick={() => void copy("top")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink" aria-label={T("Copy link", "Link copy करें")}>{copied ? <><Check className="h-4 w-4 text-good" /> {T("Copied", "Copy हुआ")}</> : <><Copy className="h-4 w-4" /> {T("Copy", "Copy")}</>}</button>
            </div>
            {copyFail === "top" && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{T("Could not copy. Press and hold the link above to copy it by hand.", "Copy नहीं हुआ। ऊपर का link दबाकर रखें और हाथ से copy करें।")}</p>}
            </div>
            {/* The one thing people got wrong here (owner, 7 Oct 2026: "Edit dabane par kya edit hoga, card ya website?"):
                one link, one set of details — the website and the card are the same thing in two shapes. Said once, here. */}
            <p className="rounded-xl bg-brand-soft/50 px-3 py-2 text-xs leading-relaxed text-ink">
              {s.site?.enabled
                ? <>{T("One link, one set of details. On a computer it opens as your website, on a phone as your card. Edit once — both change.", "एक link, एक ही जानकारी। Computer पर website खुलती है, phone पर card। एक बार edit करो — दोनों बदलेंगे।")}</>
                : noSite
                  ? <>{T("Your free plan is the digital card: this link opens your card everywhere. A website with its own pages comes with Standard (₹2,999 a month) or Premium.", "आपका free plan digital card है: ये link हर जगह आपका card खोलता है। अपने pages वाली website Standard plan (₹2,999 / महीना) या Premium में मिलती है।")} <button type="button" onClick={() => setPlanSheet(true)} className="font-semibold text-brand-ink underline">{T("See Standard", "Standard देखें")}</button></>
                  : <>{T("The website is off: this link opens the card everywhere. Turn it on under Edit → Show or hide pages.", "Website बंद है: ये link हर जगह card खोलता है। Edit → Pages दिखाएँ या छुपाएँ में जाकर चालू करें।")}</>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {noSite
                ? <button type="button" onClick={() => setPlanSheet(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><Globe className="h-4 w-4 text-brand" /> {T("Get a website", "Website पाएँ")}</button>
                : <a href={`${link}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><Globe className="h-4 w-4 text-brand" /> {T("Open website", "Website खोलें")}</a>}
              <CardLink href={link} title={T("My card", "मेरा card")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"><Smartphone className="h-4 w-4 text-brand" /> {T("Open card", "Card खोलें")}</CardLink>
            </div>
          </section>

          {/* ---- 2. two doors: Share, Edit ---- */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setCopyFail(null); setPanel(panel === "share" ? null : "share"); }} aria-expanded={panel === "share"} className={door("share")}><Share2 className="h-6 w-6" /> {T("Share", "Share करें")}<span className={doorSub}>{T("card or website", "card या website")}</span></button>
            <button type="button" onClick={openEdit} className={door("edit")}><Pencil className="h-6 w-6" /> {T("Edit card & website", "Card और website edit करें")}<span className={doorSub}>{T("both, together", "दोनों, एक साथ")}</span></button>
          </div>

          {/* SEO is its own door under Share and Edit (owner, 14 Oct 2026): how the website shows on Google. */}
          <Link href={`/poster/site/seo${cardId ? `?card=${cardId}` : ""}`} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3.5 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Search className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-base font-semibold">{T("Show on Google", "Google पर दिखें")}</span><span className="block text-[11px] leading-tight text-muted">{T("Your city, areas and search words. See how it looks on Google.", "आपका शहर, इलाक़े और search words। देखें Google पर कैसा दिखेगा।")}</span></span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
          </Link>

          {/* The Rs 5,999 advanced website (owner, 15-16 Oct 2026): its own door; once one exists it shows the state and the way back to the basic site. */}
          <AdvancedEntry key={cardId} cardId={cardId} fetchState />
          </>}

          {panel === "share" && !editOnly && (
            <section className="space-y-2 rounded-2xl border border-border p-3">
              <p className="text-sm font-semibold">{T("Share on WhatsApp", "WhatsApp पर share करें")}</p>
              <button type="button" onClick={shareCard} className="flex w-full items-center gap-3 rounded-xl bg-[#25D366] px-4 py-3.5 text-left text-white">
                <Smartphone className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><b className="block text-sm">{T("Share my card", "मेरा card share करें")}</b><span className="block text-xs opacity-90">{T("Contact, products and more — opens as the card on a phone", "Contact, products और बाकी — phone पर card खुलता है")}</span></span><ChevronRight className="h-4 w-4 shrink-0" />
              </button>
              {!noSite && <button type="button" onClick={shareSite} className="flex w-full items-center gap-3 rounded-xl border-2 border-[#25D366] px-4 py-3.5 text-left text-[#128C7E]">
                <Globe className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><b className="block text-sm">{T("Share my website", "मेरी website share करें")}</b><span className="block text-xs text-muted">{T("The full website — pages, products, about", "पूरी website — pages, products, परिचय")}</span></span><ChevronRight className="h-4 w-4 shrink-0" />
              </button>}
              <button type="button" onClick={() => void copy("share")} className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left">
                <Copy className="h-5 w-5 shrink-0 text-muted" /><span className="min-w-0 flex-1 text-sm font-semibold">{copied ? T("Link copied ✓", "Link copy हुआ ✓") : T("Copy the link", "Link copy करें")}</span>
              </button>
              {copyFail === "share" && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{T("Could not copy. Press and hold the link at the top of this page to copy it by hand.", "Copy नहीं हुआ। इस page के ऊपर वाला link दबाकर रखें और हाथ से copy करें।")}</p>}
              <Link href="/poster/share" className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left">
                <Share2 className="h-5 w-5 shrink-0 text-muted" /><span className="min-w-0 flex-1 text-sm font-semibold">{T("QR code and more ways to share", "QR code और share के और तरीके")}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </section>
          )}

          {panel === "edit" && (
            <div className="space-y-5">
              {/* Every part of the card and website is ONE tile, in the order a person thinks of it: the words and photos first,
                  then contact and place, then the look, then settings and Google (owner, 14 Oct 2026: "sabhi section ko alag
                  alag tab banao, systematically — pehale konsa fir konsa"). A tile opens one focused screen that saves straight
                  onto the live website; the few that are only a switch or a box unfold right below their group. */}
              {!editOnly && <p className="rounded-xl bg-brand-soft/50 px-3 py-2 text-sm font-semibold text-ink">{T("Card and website are one — change anything once, it changes on both.", "Card और website एक हैं — एक बार बदलें, दोनों में बदल जाएगा।")}</p>}
              <p className="text-base font-bold">{T("What do you want to change?", "क्या बदलना है?")}</p>
              {saved && <p className="rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good">✓ {T("Saved. It is on your website now.", "Save हो गया। Website पर आ गया है।")} <a href={`${link}?view=site`} target="_blank" rel="noreferrer" className="underline">{T("See it", "देखें")}</a></p>}
              <PhotoNudge />
              {(() => {
                type Tile = { k: string; I: typeof Camera; t: string; s: string; href?: string; tool?: "notice" | "mode" | "domain"; scope?: "both" | "site" };
                const groups: { k: string; title: string; tiles: Tile[] }[] = [
                  { k: "words", title: T("1 · Words & photos", "1 · शब्द और photos"), tiles: [
                    { k: "trade", I: Store, t: T("Business name & type", "Business का नाम और काम"), s: T("Your name, what you do, your link", "आपका नाम, आपका काम, आपका link"), href: `/poster/onboard?step=trade&back=${BACK}`, scope: "both" },
                    { k: "about", I: Type, t: T("About & logo", "परिचय और logo"), s: T("A few lines about you, your logo", "आपके बारे में कुछ लाइनें, आपका logo"), href: `/poster/onboard?step=about&back=${BACK}`, scope: "both" },
                    { k: "details", I: ListChecks, t: T("What you offer & why people choose you", "आप क्या देते हैं और लोग आपको क्यों चुनते हैं"), s: T("Tap what is true for you", "जो आप पर सही है वो दबाएँ"), href: `/poster/onboard?step=details&back=${BACK}`, scope: "both" },
                    { k: "products", I: Package, t: T("Products / services", "Products / services"), s: T("Add them, change prices, add photos", "जोड़ें, दाम बदलें, photo लगाएँ"), href: `/poster/products?back=${BACK}`, scope: "both" },
                    { k: "photo", I: Camera, t: T("Photos & banner", "Photos और banner"), s: T("Every picture on your website", "आपकी website की हर picture"), href: `/poster/onboard?step=extras&part=photos${cardId ? `&card=${cardId}` : ""}&back=${BACK}`, scope: "both" },
                  ] },
                  { k: "contact", title: T("2 · Contact & place", "2 · संपर्क और जगह"), tiles: [
                    { k: "where", I: Clock, t: T("Timings & address", "समय और पता"), s: T("City, address, map pin, opening hours", "शहर, पता, map pin, खुलने का समय"), href: `/poster/onboard?step=where&back=${BACK}`, scope: "both" },
                    { k: "you", I: User, t: T("My name, number & photo", "मेरा नाम, number और photo"), s: T("Changes on the card, website and posters", "card, website और poster सब पर बदल जाएगा"), href: `/poster/onboard?step=you&back=${BACK}`, scope: "both" },
                    { k: "links", I: Wallet, t: T("UPI & social media", "UPI और social media"), s: T("So people can pay you and follow you", "ताकि लोग आपको pay कर सकें और follow कर सकें"), href: `/poster/onboard?step=extras&part=links&back=${BACK}`, scope: "both" },
                  ] },
                  { k: "look", title: T("3 · Look & pages", "3 · Look और pages"), tiles: [
                    { k: "design", I: Paintbrush, t: T("Website design", "Website का design"), s: T("Pick one of six looks and your colours", "छह look में से चुनें, और रंग चुनें"), href: "/poster/card/build?improve=1", scope: "site" },
                    { k: "pages", I: LayoutList, t: T("Big line & sections", "ऊपर की लाइन और हिस्से"), s: T("Change the big line at the top and the order of the sections", "ऊपर की बड़ी लाइन और हिस्सों का क्रम बदलें"), href: "/poster/website/edit", scope: "site" },
                    { k: "editor", I: FileText, t: T("Full editor", "पूरा editor"), s: T("Change any word or photo by hand", "कोई भी शब्द या photo अपने हाथ से बदलें"), href: `/poster/d/editor?id=${s.cardId}&back=${BACK}`, scope: "both" },
                    { k: "cardlook", I: Smartphone, t: T("Phone card design", "Phone card का design"), s: T("How your card looks on a phone", "phone पर आपका card कैसा दिखे"), href: "/poster/card" },
                  ] },
                  { k: "settings", title: T("4 · Settings & Google", "4 · Settings और Google"), tiles: [
                    { k: "notice", I: Megaphone, t: T("Offer bar", "Offer की पट्टी"), s: T("One line on top, like “10% off this week”", "ऊपर एक लाइन, जैसे “इस हफ़्ते 10% छूट”"), tool: "notice" },
                    { k: "mode", I: Settings, t: T("Show or hide pages", "Pages दिखाएँ या छुपाएँ"), s: T("Choose what people can see", "चुनें कि लोग क्या देखें"), tool: "mode" },
                    { k: "domain", I: Globe, t: T("Your own web address", "आपका अपना web address"), s: T("Use www.yourshop.com for your site", "अपनी site के लिए www.yourshop.com लगाएँ"), tool: "domain" },
                  ] },
                ];
                const base = "block rounded-2xl border-2 bg-surface p-3 text-left";
                const tile = (x: Tile) => {
                  const on = x.tool && openTool === x.tool;
                  const inner = (
                    <>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><x.I className="h-5 w-5" /></span>
                      <span className="mt-2 block text-sm font-bold leading-tight">{x.t}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-muted">{x.s}</span>
                      {x.scope && <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.scope === "both" ? "bg-good/10 text-good" : "bg-surface2 text-muted"}`}>{x.scope === "both" ? T("Shows on card + website", "Card + website पर दिखेगा") : T("Website only", "सिर्फ़ website")}</span>}
                    </>
                  );
                  if (noSite && x.scope === "site") return <button key={x.k} type="button" onClick={() => setPlanSheet(true)} className={`${base} border-border`}>{inner}</button>;
                  return x.href
                    ? <Link key={x.k} href={x.href} className={`${base} border-border`}>{inner}</Link>
                    : <button key={x.k} type="button" onClick={() => { setRowErr(null); setOpenTool(on ? null : x.tool ?? null); }} aria-expanded={!!on} className={`${base} ${on ? "border-brand bg-brand-soft/40" : "border-border"}`}>{inner}</button>;
                };
                return (
                  <>
                    {groups.map((g) => (
                      <section key={g.k} className="space-y-2">
                        <h2 className="text-sm font-bold text-muted">{g.title}</h2>
                        <div className="grid grid-cols-2 gap-2">
                          {g.tiles.map(tile)}
                          {g.k === "settings" && (
                            <Link href={`/poster/site/seo${cardId ? `?card=${cardId}` : ""}`} className={`${base} border-border`}>
                              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Search className="h-5 w-5" /></span>
                              <span className="mt-2 block text-sm font-bold leading-tight">{T("Show on Google", "Google पर दिखें")}</span>
                              <span className="mt-0.5 block text-[11px] leading-tight text-muted">{T("Help people find you when they search", "लोग खोजें तो आप मिलें")}</span>
                            </Link>
                          )}
                        </div>
                        {g.k === "settings" && openTool === "notice" && card && <NoticeBox card={card} url={s.url} locked={!paid} onChanged={(c) => setCard(c)} />}
                        {g.k === "settings" && openTool === "mode" && (
                          <div className="space-y-3 rounded-2xl border border-border p-3">
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
                        )}
                        {g.k === "settings" && openTool === "domain" && (
                          <div className="rounded-2xl border border-border p-3">
                            {domainOk || s.customDomain
                              ? <DomainConnect cardId={s.cardId} username={s.username} initialDomain={s.customDomain || undefined} />
                              : <p className="text-sm text-muted">{T("Your own web address (www.yourshop.com) comes with Standard.", "अपना web address (www.yourshop.com) Standard के साथ आता है।")}</p>}
                          </div>
                        )}
                        {g.k === "settings" && !paid && (
                          <PremiumGate locked feature={T("Removing the Shubhora tag", "Shubhora tag हटाना")}>
                            <div className="rounded-xl border border-border bg-surface p-3 pr-20"><p className="flex items-center gap-1.5 text-sm font-semibold"><Tag className="h-4 w-4 text-brand" /> {T("Remove the Shubhora tag", "Shubhora tag हटाएँ")}</p></div>
                          </PremiumGate>
                        )}
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
