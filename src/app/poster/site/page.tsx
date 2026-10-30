"use client";
// "Card & Website" (owner's call, 3 Oct 2026: one link, one page — computers get the website, phones the card). Rebuilt
// 6 Oct 2026 ("pura page bada confusing hai — Share ka option, Edit ka option; baaki sab Edit ke andar"): the link, two
// doors — Share and Edit — and everything else behind Edit, in three sections: Look & design, Words & photos, Settings.
// 23 Oct 2026 (owner: "card aur web site ke liye alag alag edit"): two Edit doors — Card and Website — each its own edit page
// (?edit=card / ?edit=site; ?edit=1 asks which), grouped by how often a thing is changed: often (offer, pop-up, products, photos),
// sometimes (banner, name, timings…), rarely (design, pages, settings). The banner is each one's own; everything else is shared,
// so a change made from either page shows on both.
import { FinishBar } from "@/components/poster/site-finish";
import { OwnSiteByCard } from "@/components/poster/bot-site-box";
import { AdvancedFeatures } from "@/components/poster/advanced-features";
import { ChatEditByCard } from "@/components/poster/card-chat-edit";
import { withView } from "@/lib/site-url";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Globe, Smartphone, Check, RefreshCw, Copy, Share2, Search, Monitor, Sparkles } from "lucide-react";
import { PremiumCard, PremiumSheet } from "@/components/poster/premium-lock";
import { CardLink, SiteLink } from "@/components/poster/card-sheet";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";
import { canGoBackInApp, goBack } from "@/lib/nav-back";
import { ADVANCED_HREF } from "@/components/poster/advanced-entry";
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
  /** A copy that the phone refused: shown under the Copy button that was tapped (the link row at the top, or the Share panel). */
  const [copyFail, setCopyFail] = useState<"top" | "share" | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  /** The Standard sheet, opened wherever a free account (digital card only) taps something that is the website's. */
  const [planSheet, setPlanSheet] = useState(false);
  // Opened with Edit (?edit=1): only the edit tiles, starting at "What do you want to change?" — no link, share or open buttons
  // above them (owner, 14 Oct 2026).
  const [editOnly, setEditOnly] = useState(false);
  const [target, setTarget] = useState<Target>("pick");
  // Arrived straight from the builder (?published=1): the greeting at the top; ?edit=1 / ?share=1 open that door.
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
      if (q.has("saved")) savedArrival.current = true;
      // The one-time flags leave the address, so a reload or Back does not replay them.
      if (q.has("saved") || q.has("published")) { q.delete("saved"); q.delete("published"); window.history.replaceState(null, "", `${window.location.pathname}${q.toString() ? `?${q}` : ""}`); }
    } catch { /* ignore */ }
  }, []);
  const { plan, loading: planLoading } = usePlan();
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
  const [copied, setCopied] = useState(false);
  /** Their OWN website (the "I already have my own website" box): Share → Website and "See website" use it (owner, 28 Oct 2026). */
  const [ownSite, setOwnSite] = useState("");
  const [siteCopied, setSiteCopied] = useState(false);
  /** The one address shown, copied, shared and opened: the owner's own domain when connected, else the Shubhora link. */
  const link = s?.hasCard ? (s.customDomain ? `https://${s.customDomain}` : s.url) : "";
  /** The website link: on the owner's own domain the plain address IS the website (proxy.ts); the Shubhora link needs ?view=site. */
  const siteLink = ownSite || (s?.hasCard && s.customDomain ? link : withView(link, "site"));
  async function copySite() { setCopyFail(null); try { await navigator.clipboard.writeText(ownSite); setSiteCopied(true); setTimeout(() => setSiteCopied(false), 2000); } catch { setCopyFail("top"); } }
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
  const T = (en: string, h: string) => (hi ? h : en);
  // The free plan is the digital card only (owner, 16 Oct 2026): a free account whose website is not on is offered Standard, not a website.
  // A free account that already has its website on is left exactly as it was.
  const noSite = !paid && s.hasCard && !s.site?.enabled;

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
              <select value={cardId} onChange={(e) => { void load(e.target.value); }} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
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
                    <div className={`grid gap-2.5 ${noSite && !ownSite ? "grid-cols-2" : "grid-cols-3"}`}>
                      <button type="button" onClick={shareCard} className={`${tile} bg-[#25D366]/10 ring-1 ring-[#25D366]/30`}>{icon("bg-[#25D366]", "text-white", Smartphone)}<span className="text-sm font-bold">{T("Card", "Card")}</span></button>
                      {(!noSite || !!ownSite) && <button type="button" onClick={shareSite} className={`${tile} bg-[#25D366]/10 ring-1 ring-[#25D366]/30`}>{icon("bg-[#25D366]", "text-white", Globe)}<span className="text-sm font-bold">{T("Website", "Website")}</span></button>}
                      <Link href="/poster/share" className={`${tile} bg-surface2 ring-1 ring-border`}>{icon("bg-white", "text-ink", Share2)}<span className="text-sm font-bold">{T("QR code", "QR code")}</span></Link>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-surface2 py-1.5 pl-3 pr-1.5">
                      {ownSite ? <Smartphone className="h-4 w-4 shrink-0 text-brand" /> : <Globe className="h-4 w-4 shrink-0 text-brand" />}
                      <code className="min-w-0 flex-1 truncate text-[13px] font-semibold">{link.replace(/^https?:\/\//, "")}</code>
                      <button type="button" onClick={() => void copy("top")} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-surface px-3 py-2 text-xs font-bold text-brand-ink shadow-sm" aria-label={T("Copy link", "Link copy करें")}>{copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />} {copied ? T("Copied", "Copy हुआ") : "Copy"}</button>
                    </div>
                    {ownSite && (
                      <div className="flex items-center gap-2 rounded-2xl bg-surface2 py-1.5 pl-3 pr-1.5">
                        <Globe className="h-4 w-4 shrink-0 text-brand" />
                        <code className="min-w-0 flex-1 truncate text-[13px] font-semibold">{ownSite.replace(/^https?:\/\//, "").replace(/\/$/, "")}</code>
                        <button type="button" onClick={() => void copySite()} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-surface px-3 py-2 text-xs font-bold text-brand-ink shadow-sm" aria-label={T("Copy website link", "Website link copy करें")}>{siteCopied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />} {siteCopied ? T("Copied", "Copy हुआ") : "Copy"}</button>
                      </div>
                    )}
                    {ownSite && <p className="px-1 text-[11px] text-muted">{T("Top: your card's link. Below: your own website — the Website button and the AI use it.", "ऊपर: आपके card का link। नीचे: आपकी अपनी website — Website button और AI यही देते हैं।")}</p>}
                    {copyFail === "top" && <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">{T("Could not copy. Press and hold the link to copy it.", "Copy नहीं हुआ। link को दबाकर रखें और copy करें।")}</p>}
                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                      <CardLink href={withView(link, "card")} title={T("My card", "मेरा card")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2"><Smartphone className="h-4 w-4 text-brand" /> {T("See card", "Card देखें")}</CardLink>
                      {ownSite
                        ? <a href={ownSite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2"><Monitor className="h-4 w-4 text-brand" /> {T("See website", "Website देखें")}</a>
                        : noSite
                        ? <button type="button" onClick={() => setPlanSheet(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2"><Monitor className="h-4 w-4 text-brand" /> {T("Get a website", "Website पाएँ")}</button>
                        : <SiteLink href={siteLink} appHref={s.hasCard ? `/c/${s.username}?view=site` : undefined} title={T("Website", "Website")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2"><Monitor className="h-4 w-4 text-brand" /> {T("See website", "Website देखें")}</SiteLink>}
                    </div>
                  </div>
                </section>

                {/* 2 · Edit */}
                <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
                  {head(2, T("Edit", "Edit करें"), T("Change details, photos and offers", "जानकारी, photo और offer बदलें"), "bg-gradient-to-r from-[#2f5bf5] to-[#5b7cff]")}
                  {/* Two doors, straight into the editor (owner, 26 Oct 2026); inside, the Card | Website switch moves between them. */}
                  <div className="grid grid-cols-2 gap-2.5 p-3">
                    <Link href={editHref("card")} className={`${tile} bg-brand-soft/50 ring-1 ring-brand/20`}>{icon("bg-brand", "text-white", Smartphone)}<span className="text-sm font-bold">{T("Edit card", "Card edit करें")}</span><span className="text-[11px] leading-tight text-muted">{T("Your phone card", "आपका phone card")}</span></Link>
                    {noSite
                      ? <button type="button" onClick={() => setPlanSheet(true)} className={`${tile} bg-brand-soft/50 ring-1 ring-brand/20`}>{icon("bg-brand", "text-white", Monitor)}<span className="text-sm font-bold">{T("Edit website", "Website edit करें")}</span><span className="text-[11px] leading-tight text-muted">{T("Get a website", "Website पाएँ")}</span></button>
                      : <Link href={editHref("site")} className={`${tile} bg-brand-soft/50 ring-1 ring-brand/20`}>{icon("bg-brand", "text-white", Monitor)}<span className="text-sm font-bold">{T("Edit website", "Website edit करें")}</span><span className="text-[11px] leading-tight text-muted">{T("Your website", "आपकी website")}</span></Link>}
                  </div>
                </section>

                {/* Moved here from AI Training (owner, 28 Oct 2026: "ye to website edit option hai"): change the website by talking, or write it again. */}
                <section className="space-y-2.5 rounded-3xl border border-border bg-surface p-3 shadow-card">
                  <ChatEditByCard cardId={cardId} locked={!paid} url={link} />
                  <Link href="/poster/card/build?improve=1&ask=1" className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Sparkles className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><b className="block text-sm">{T("Write the whole website again with AI", "पूरी website AI से दोबारा लिखवाएँ")}</b><span className="block text-xs text-muted">{T("New words and a new look from your latest details.", "आपकी ताज़ा जानकारी से नए शब्द और नया look।")}</span></span>
                  </Link>
                </section>

                {/* 3 · Grow: Google SEO, and the Premium website (Rs 5,999; every card, partner cards too — owner, 23 Oct 2026) */}
                <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
                  {head(3, T("Grow", "आगे बढ़ें"), T("Get found on Google, look premium", "Google पर दिखें, premium दिखें"), "bg-gradient-to-r from-[#8b3dff] to-[#c04ee8]")}
                  <div className="grid grid-cols-2 gap-2.5 p-3">
                    <Link href={`/poster/site/seo${cardId ? `?card=${cardId}` : ""}`} className={`${tile} bg-surface2 ring-1 ring-border`}>{icon("bg-white", "text-brand", Search)}<span className="text-sm font-bold">{T("Google SEO", "Google SEO")}</span><span className="text-[11px] text-muted">{T("show up in search", "search में आएँ")}</span></Link>
                    <Link href={`${ADVANCED_HREF}${cardId ? `?card=${encodeURIComponent(cardId)}` : ""}`} className={`${tile} bg-ai-soft/50 ring-1 ring-ai/30`}>{icon("bg-ai", "text-white", Sparkles)}<span className="text-sm font-bold text-ai">{T("Premium website", "Premium website")}</span><span className="text-[11px] text-muted">{T("made by AI for you", "AI से खास design")}</span></Link>
                  </div>
                </section>

                {/* 4 · Advanced features (owner, 30 Oct 2026): after the website, only on Premium and only for the kinds of business they suit. */}
                <AdvancedFeatures hi={hi} />

                {/* Already has a website and wants only the package (owner, 28 Oct 2026): their site on the card and in the AI's replies. */}
                <OwnSiteByCard cardId={cardId} onSite={setOwnSite} />
              </div>
            );
          })()}
          </>}

          {/* The Edit address opens the editor itself (effect above); the old tile screen is gone (26 Oct 2026). */}
          {!paid && <PremiumCard compact />}
        </>
      )}
      {planSheet && <PremiumSheet feature={T("A website", "Website")} onClose={() => setPlanSheet(false)} />}
    </div>
  );
}
