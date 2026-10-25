"use client";
// Card edit — the same one-page pattern as Website edit (owner, 25 Oct 2026: "card edit ka bhi same pattern bana do"): the phone card
// live on top, four groups under it (Design / Content / Contact / Settings), each part opening right here. Look and colour save with
// the Save bar; the other parts are their own screens shown inside (components/poster/embed-pane.tsx) and save by themselves.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MousePointerClick, BookUser, Camera, Check, Clock, ExternalLink, FileText, ListChecks, LoaderCircle, Megaphone, Package, Paintbrush, Palette, Phone, RefreshCw, Settings, Star, Store, User, Wallet } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict, publishCard } from "@/lib/cloud";
import { isThinCard } from "@/lib/card-personalize";
import type { FactsResponse } from "@/lib/card-facts";
import type { Card } from "@/lib/types";
import { LOOKS } from "@/lib/looks";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { cardHome, withView } from "@/lib/site-url";
import { usePlan } from "@/lib/plan";
import { CardLink } from "@/components/poster/card-sheet";
import { LiveWindow } from "@/components/poster/live-window";
import { EditFocus } from "@/components/poster/edit-focus";
import { seeCls } from "@/components/poster/save-overlay";
import { partFor, partState } from "@/lib/edit-status";
import { editHref, partParam, rememberEdit } from "@/lib/edit-nav";
import { EmbedPane, type EmbedLive } from "@/components/poster/embed-pane";
import { EditMenu, PartHead, type Scope } from "@/components/poster/edit-parts";
import { SitePhotos } from "@/components/poster/site-photos";
import { NoticeBox } from "@/components/poster/notice-box";

type Tab = "look" | "text" | "buttons" | "photos" | "products" | "about" | "details" | "reviews" | "you" | "where" | "links" | "offer" | "trade";
type Group = "design" | "content" | "contact" | "settings";
const DONE = "/poster/embed-done";
const EMBED: Partial<Record<Tab, string>> = {
  products: `/poster/products?back=${DONE}`,
  about: `/poster/onboard?step=about&for=card&back=${DONE}`,
  details: `/poster/onboard?step=details&for=card&back=${DONE}`,
  reviews: `/poster/testimonials?back=${DONE}`,
  you: `/poster/onboard?step=you&for=card&back=${DONE}`,
  where: `/poster/onboard?step=where&for=card&back=${DONE}`,
  links: `/poster/onboard?step=extras&part=links&for=card&back=${DONE}`,
  trade: `/poster/onboard?step=trade&for=card&back=${DONE}`,
};
/** Which group each part sits in (GROUPS below), for a part opened from the address. */
const CARD_GROUP: Partial<Record<Tab, Group>> = {
  look: "design", text: "content", photos: "content", products: "content", about: "content", details: "content", reviews: "content",
  you: "contact", where: "contact", links: "contact", buttons: "contact", offer: "settings", trade: "settings",
};
const SWATCHES = ["#2f5bf5", "#0e9e90", "#6d5cf5", "#d24b4b", "#e5673b", "#f2a33c", "#1e3a8a", "#b86a3a", "#0d9488", "#111827"];

export default function CardEditPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [card, setCard] = useState<Card | null>(null);
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState<Group>("design");
  const [tab, setTab] = useState<Tab>("look");
  /** The list of parts (false) or one part open (true). */
  const [open, setOpen] = useState(false);
  /** Text & pages opened from a ✏️ on one section: the editor starts right at it. */
  const [atBlock, setAtBlock] = useState("");
  // Opened from the Website editor's switch with a part open (?part=): that part opens here too.
  const partDone = useRef(false);
  useEffect(() => {
    if (!card || partDone.current) return;
    partDone.current = true; rememberEdit("card");
    const p = partParam() as Tab;
    if (p && CARD_GROUP[p]) { setGroup(CARD_GROUP[p]); setTab(p); setOpen(true); }
  }, [card]);
  /** The look and colour before the last Save, for 10 seconds after it ("Undo"). */
  const [undo, setUndo] = useState<{ template: Card["template"]; color: string } | null>(null);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 10000); return () => clearTimeout(t); }, [undo]);
  const [look, setLook] = useState<Card["template"] | "">("");
  const [color, setColor] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [embedView, setEmbedView] = useState<EmbedLive | null>(null);
  const [savedTab, setSavedTab] = useState("");
  /** The full editor ("Text & pages") has unsaved changes: the Save bar saves them; a look change waits for it, then goes on top. */
  const [embedDirty, setEmbedDirty] = useState(false);
  const [saveTick, setSaveTick] = useState(0);
  const ownAfter = useRef(false);
  const { plan, loading: planLoading } = usePlan();
  const paid = planLoading || plan !== "free";

  /** The owner's own card (with several, the main one), fresh from the server. */
  const fetchMine = useCallback(async (): Promise<Card | null | "thin"> => {
    const cards = await fetchMyCardsStrict();
    let primaryId = "";
    if (cards.length > 1) { const fr = await api<Partial<FactsResponse>>("/api/card/facts").catch(() => null); primaryId = fr?.ok ? fr.data.facts?.primaryCardId ?? "" : ""; }
    const mine = cards.find((c) => c.id === primaryId) ?? cards[0];
    return !mine || isThinCard(mine) ? "thin" : mine;
  }, []);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      if (!(await isLoggedIn())) { router.replace("/login?next=/poster/card/edit"); return; }
      const m = await fetchMine();
      if (m === "thin" || !m) { router.replace("/poster/card/build"); return; }
      setCard(m); setLook(m.template); setColor(m.themeColor);
    } catch { setFailed(true); }
  }, [fetchMine, router]);
  useEffect(() => { void load(); }, [load]);
  /** A part saved inside a tab: the card again, the look and colour picked here (not saved yet) kept. */
  const refresh = useCallback(async () => { try { const m = await fetchMine(); if (m && m !== "thin") setCard(m); } catch { /* offline */ } }, [fetchMine]);

  if (!card) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        {failed
          ? <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white"><RefreshCw className="h-5 w-5" /> {T("No internet — try again", "Internet नहीं है — दोबारा try करें")}</button>
          : <LoaderCircle className="h-6 w-6 animate-spin text-muted" />}
      </div>
    );
  }

  const dirty = look !== card.template || color !== card.themeColor;
  const base = embedView?.card ?? card;
  const shown: Card = { ...base, template: (look || base.template) as Card["template"], themeColor: color || base.themeColor, avatarColor: color || base.avatarColor };
  const link = cardHome(card.username, card.customDomain);

  async function save(back?: { template: Card["template"]; color: string }) {
    if (!card) return;
    setBusy(true); setNote(null); setUndo(null);
    try {
      const m = await fetchMine().catch(() => null);   // the latest card: a tab may have saved something since this page opened
      const latest = m && m !== "thin" ? m : card;
      const t = back?.template ?? ((look || latest.template) as Card["template"]), c = back?.color ?? color;
      const next: Card = { ...latest, template: t, themeColor: c, avatarColor: c };
      const r = await publishCard(next);
      if (!r.ok) { setNote({ text: r.error || T("Could not save. Try again.", "Save नहीं हुआ। दोबारा try करें।"), bad: true }); return; }
      setCard(next); setLook(t); setColor(c);
      setNote({ text: back ? T("↩️ Put back as it was.", "↩️ पहले जैसा कर दिया।") : T("✅ Card saved — it is live on your link.", "✅ Card save हो गया — आपके link पर live है।"), bad: false });
      if (!back && (latest.template !== t || latest.themeColor !== c)) setUndo({ template: latest.template, color: latest.themeColor });
    } catch { setNote({ text: T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।"), bad: true }); }
    finally { setBusy(false); }
  }

  // Each part says what it changes and where it shows (owner, 25 Oct 2026: card + website, or the card only).
  type TabDef = { key: Tab; label: string; Icon: typeof Palette; sub: string; scope: Scope };
  const GROUPS: { key: Group; label: string; Icon: typeof Palette; tabs: TabDef[] }[] = [
    { key: "design", label: T("Design", "डिज़ाइन"), Icon: Paintbrush, tabs: [
      { key: "look", label: T("Look & colour", "Look और रंग"), Icon: Palette, sub: T("12 looks and your colour — the website keeps its own", "12 look और आपका रंग — website का अपना अलग रहता है"), scope: "card" },
    ] },
    { key: "content", label: T("Content", "सामग्री"), Icon: Camera, tabs: [
      { key: "text", label: T("Text & pages", "Text और pages"), Icon: FileText, sub: T("Change any page's words, add a new page", "किसी भी page के शब्द बदलें, नया page जोड़ें"), scope: "both" },
      { key: "photos", label: T("Photos & banner", "Photos और banner"), Icon: Camera, sub: T("The card's top picture and the photo gallery", "Card के ऊपर की picture और photo gallery"), scope: "both" },
      { key: "products", label: T("Products & prices", "Products और दाम"), Icon: Package, sub: T("Add products, change prices, add photos", "Products जोड़ें, दाम बदलें, photo लगाएँ"), scope: "both" },
      { key: "about", label: T("About & logo", "परिचय और logo"), Icon: BookUser, sub: T("A few lines about you, your logo", "आपके बारे में कुछ लाइनें, logo"), scope: "both" },
      { key: "details", label: T("What you offer", "आप क्या देते हैं"), Icon: ListChecks, sub: T("Your work and why people choose you", "आपका काम और लोग आपको क्यों चुनते हैं"), scope: "both" },
      { key: "reviews", label: T("Reviews", "Reviews"), Icon: Star, sub: T("Customer reviews and the Google review link", "ग्राहकों के reviews और Google review link"), scope: "both" },
    ] },
    { key: "contact", label: T("Contact", "संपर्क"), Icon: Phone, tabs: [
      { key: "you", label: T("Name, number, photo", "नाम, number, photo"), Icon: User, sub: T("Also changes on your posters", "Poster पर भी बदलेगा"), scope: "both" },
      { key: "where", label: T("Timings & address", "समय और पता"), Icon: Clock, sub: T("City, address, map pin, opening hours", "शहर, पता, map pin, खुलने का समय"), scope: "both" },
      { key: "links", label: T("UPI & social", "UPI और social"), Icon: Wallet, sub: T("So people can pay you and follow you", "ताकि लोग pay और follow कर सकें"), scope: "both" },
      { key: "buttons", label: T("Buttons (add / remove)", "Buttons (जोड़ें / हटाएँ)"), Icon: MousePointerClick, sub: T("Call, WhatsApp, Email, Map … add, remove, reorder", "Call, WhatsApp, Email, Map … जोड़ें, हटाएँ, क्रम बदलें"), scope: "both" },
    ] },
    { key: "settings", label: T("Settings", "Settings"), Icon: Settings, tabs: [
      { key: "offer", label: T("Offer / pop-up", "Offer / pop-up"), Icon: Megaphone, sub: T("A line on top or a pop-up: “Diwali 20% off”", "ऊपर पट्टी या pop-up: “Diwali 20% छूट”"), scope: "both" },
      { key: "trade", label: T("Business name & type", "Business का नाम और काम"), Icon: Store, sub: T("Your business name and what you do", "आपके business का नाम और काम"), scope: "both" },
    ] },
  ];
  const TABS = GROUPS.find((g) => g.key === group)!.tabs;
  const pick = (t: Tab) => { setEmbedView(null); setTab(t); };
  const embedSrc = tab === "text" || tab === "buttons" ? `/poster/d/editor?id=${encodeURIComponent(card.id)}${tab === "buttons" ? "&focus=links" : ""}${tab === "text" && atBlock ? `&block=${encodeURIComponent(atBlock)}` : ""}&back=${DONE}` : EMBED[tab];
  const cur = LOOKS.find((l) => l.key === look) ?? LOOKS[0];

  /** Back to the list of parts (asks first when the open part has a change not saved). */
  /** Open one part (from the list or a ✏️ in the preview). */
  const openPart = (key: string, blockId = "") => {
    const g = GROUPS.find((x) => x.tabs.some((t) => t.key === key));
    if (!g) return;
    if (embedDirty && key !== tab && !window.confirm(T("Your change is not saved. Leave it?", "बदलाव save नहीं हुआ। छोड़ दें?"))) return;
    setEmbedDirty(false); setAtBlock(blockId); setGroup(g.key); pick(key as Tab); setOpen(true); window.scrollTo({ top: 0 });
  };
  const toList = () => {
    if (embedDirty && !window.confirm(T("Your change is not saved. Go back without saving?", "बदलाव save नहीं हुआ। बिना save किए वापस जाएँ?"))) return;
    setEmbedDirty(false); setEmbedView(null); setOpen(false); window.scrollTo({ top: 0 });
  };
  return (
    <div className="space-y-3 pb-4">
      <EditFocus />

      <LiveWindow card={shown} k="card-edit-live" view="card" onEditTarget={(t) => { const p = partFor(shown, t, false); openPart(p.key, p.blockId); }} focus={embedView?.focus ?? (tab === "look" ? { body: true } : { top: true })} hi={hi}
        bar={{ onBack: () => (open ? toList() : goBack(router, "/poster/site")),
          see: <CardLink href={withView(link, "card")} title={T("My card", "मेरा card")} className={seeCls} aria-label={T("See card", "Card देखें")}><ExternalLink className="h-4 w-4" /></CardLink>,
          switcher: { at: "card", site: !!card.site?.enabled, onSwitch: (to) => {
            if ((dirty || embedDirty) && !window.confirm(T("Your change is not saved. Leave it?", "बदलाव save नहीं हुआ। छोड़ दें?"))) return;
            rememberEdit(to); router.replace(editHref(to, open ? tab : ""));
          } },
          save: { show: (open && tab === "look") || dirty || embedDirty, dirty: dirty || embedDirty, busy: busy, note: note, onSave: () => { if (embedDirty) { setNote(null); ownAfter.current = dirty; setSaveTick((n) => n + 1); } else void save(); }, undo: undo ? () => void save(undo) : undefined } }} />


      {!open
        ? <EditMenu groups={GROUPS} hi={hi} what="card" state={(k) => partState(card, k)} onPick={(_g, k) => openPart(k)} />
        : (() => { const d = TABS.find((x) => x.key === tab); return d ? <PartHead part={d} group={group} hi={hi} onBack={toList} /> : null; })()}
      {open && (<>
      {savedTab && savedTab === tab && <p role="status" className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good"><Check className="h-4 w-4" /> {T("Saved — it is live on your card", "Save हो गया — card पर live है")}</p>}

      {tab === "look" && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card">
          <div className="space-y-2">
            <p className="text-sm font-semibold">{T("Colour", "रंग")}</p>
            <div className="flex items-center gap-2.5 overflow-x-auto px-1 py-1">
              {Array.from(new Set([card.themeColor, ...SWATCHES])).map((sw) => (
                <button key={sw} type="button" onClick={() => setColor(sw)} aria-label={sw}
                  className={`h-8 w-8 shrink-0 rounded-full transition-transform ${color === sw ? "scale-110 ring-2 ring-offset-2 ring-offset-surface" : ""}`} style={{ background: sw, boxShadow: color === sw ? `0 0 0 2px ${sw}` : "none" }} />
              ))}
              <input type="color" value={color || card.themeColor} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 shrink-0 rounded border border-border bg-surface p-0.5" aria-label={T("Your own colour", "अपना रंग")} />
            </div>
          </div>
          <p className="pt-1 text-sm font-semibold">{T("Card look", "Card का look")}</p>
          <div className="grid grid-cols-3 gap-2">
            {LOOKS.map((l) => (
              <button key={l.key} type="button" onClick={() => setLook(l.key)} className={`overflow-hidden rounded-xl border text-left ${look === l.key ? "border-brand ring-2 ring-brand" : "border-border bg-surface"}`}>
                <div className="h-9" style={{ background: l.cover(color || card.themeColor) }} />
                <div className="flex items-center gap-1 px-1.5 py-1">
                  <span className="truncate text-[11px] font-semibold">{l.name}</span>
                  {card.template === l.key && <Check className="ml-auto h-3 w-3 shrink-0 text-brand" />}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs"><b>{cur.name}</b>{hi && cur.hi ? ` · ${cur.hi}` : ""} <span className="text-muted">— {cur.blurb}</span></p>
        </section>
      )}
      {embedSrc && (
        <EmbedPane src={embedSrc} title={TABS.find((t) => t.key === tab)?.label ?? ""} onLive={setEmbedView}
          saveTick={saveTick} onDirty={setEmbedDirty}
          onSaved={() => { setEmbedDirty(false); setEmbedView(null); setNote({ text: T("✅ Card saved — it is live on your link.", "✅ Card save हो गया — आपके link पर live है।"), bad: false }); if (ownAfter.current) { ownAfter.current = false; void save(); } else void refresh(); }}
          onError={(t) => { ownAfter.current = false; setNote({ text: t, bad: true }); }}
          onDone={(saved) => { setEmbedView(null); if (saved) { setSavedTab(tab); void refresh(); setTimeout(() => setSavedTab(""), 4000); } }} />
      )}
      {tab === "photos" && (
        <section className="rounded-2xl border border-border bg-surface p-3.5 shadow-card">
          <SitePhotos hi={hi} cardId={card.id} scope="card" onChanged={() => void refresh()} />
        </section>
      )}
      {tab === "offer" && (
        <section className="rounded-2xl border border-border bg-surface p-3.5 shadow-card">
          <NoticeBox card={card} url={link} locked={!paid} onChanged={(c) => setCard(c)} />
        </section>
      )}

      </>)}
    </div>
  );
}
