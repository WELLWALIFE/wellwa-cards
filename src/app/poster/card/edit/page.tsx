"use client";
// Card edit — the same one-page pattern as Website edit (owner, 25 Oct 2026: "card edit ka bhi same pattern bana do"): the phone card
// live on top, four groups under it (Design / Content / Contact / Settings), each part opening right here. Look and colour save with
// the Save bar; the other parts are their own screens shown inside (components/poster/embed-pane.tsx) and save by themselves.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookUser, Camera, Check, ChevronLeft, Clock, ExternalLink, FileText, ListChecks, LoaderCircle, Megaphone, Package, Paintbrush, Palette, Phone, RefreshCw, Settings, Star, Store, User, Wallet } from "lucide-react";
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
import { EmbedPane, type EmbedLive } from "@/components/poster/embed-pane";
import { SitePhotos } from "@/components/poster/site-photos";
import { NoticeBox } from "@/components/poster/notice-box";

type Tab = "look" | "text" | "photos" | "products" | "about" | "details" | "reviews" | "you" | "where" | "links" | "offer" | "trade";
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
const SWATCHES = ["#2f5bf5", "#0e9e90", "#6d5cf5", "#d24b4b", "#e5673b", "#f2a33c", "#1e3a8a", "#b86a3a", "#0d9488", "#111827"];
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-ink hover:bg-surface2"}`;

export default function CardEditPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [card, setCard] = useState<Card | null>(null);
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState<Group>("design");
  const [tab, setTab] = useState<Tab>("look");
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

  async function save() {
    if (!card) return;
    setBusy(true); setNote(null);
    try {
      const m = await fetchMine().catch(() => null);   // the latest card: a tab may have saved something since this page opened
      const latest = m && m !== "thin" ? m : card;
      const next: Card = { ...latest, template: (look || latest.template) as Card["template"], themeColor: color, avatarColor: color };
      const r = await publishCard(next);
      if (!r.ok) { setNote({ text: r.error || T("Could not save. Try again.", "Save नहीं हुआ। दोबारा try करें।"), bad: true }); return; }
      setCard(next); setNote({ text: T("✅ Card saved — it is live on your link.", "✅ Card save हो गया — आपके link पर live है।"), bad: false });
    } catch { setNote({ text: T("No internet — please try again.", "Internet नहीं है — दोबारा try करें।"), bad: true }); }
    finally { setBusy(false); }
  }

  const GROUPS: { key: Group; label: string; Icon: typeof Palette; tabs: { key: Tab; label: string; Icon: typeof Palette }[] }[] = [
    { key: "design", label: T("Design", "डिज़ाइन"), Icon: Paintbrush, tabs: [{ key: "look", label: T("Look & colour", "Look और रंग"), Icon: Palette }] },
    { key: "content", label: T("Content", "सामग्री"), Icon: Camera, tabs: [
      { key: "text", label: T("Text & pages", "Text और pages"), Icon: FileText },
      { key: "photos", label: T("Photos & banner", "Photos और banner"), Icon: Camera },
      { key: "products", label: T("Products & prices", "Products और दाम"), Icon: Package },
      { key: "about", label: T("About & logo", "परिचय और logo"), Icon: BookUser },
      { key: "details", label: T("What you offer", "आप क्या देते हैं"), Icon: ListChecks },
      { key: "reviews", label: T("Reviews", "Reviews"), Icon: Star },
    ] },
    { key: "contact", label: T("Contact", "संपर्क"), Icon: Phone, tabs: [
      { key: "you", label: T("Name, number, photo", "नाम, number, photo"), Icon: User },
      { key: "where", label: T("Timings & address", "समय और पता"), Icon: Clock },
      { key: "links", label: T("UPI & social", "UPI और social"), Icon: Wallet },
    ] },
    { key: "settings", label: T("Settings", "Settings"), Icon: Settings, tabs: [
      { key: "offer", label: T("Offer / pop-up", "Offer / pop-up"), Icon: Megaphone },
      { key: "trade", label: T("Business name & type", "Business का नाम और काम"), Icon: Store },
    ] },
  ];
  const TABS = GROUPS.find((g) => g.key === group)!.tabs;
  const pick = (t: Tab) => { setEmbedView(null); setTab(t); };
  const embedSrc = tab === "text" ? `/poster/d/editor?id=${encodeURIComponent(card.id)}&back=${DONE}` : EMBED[tab];
  const cur = LOOKS.find((l) => l.key === look) ?? LOOKS[0];

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => goBack(router, "/poster/site?edit=card")} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-lg font-bold">{T("Edit card", "Card edit करें")}</h1>
        <CardLink href={withView(link, "card")} title={T("My card", "मेरा card")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">{T("See card", "Card देखें")} <ExternalLink className="h-3.5 w-3.5" /></CardLink>
      </div>

      <LiveWindow card={shown} k="card-edit-live" view="card" focus={embedView?.focus ?? { top: true }} hi={hi} />

      {group === "design" && (
        <div className="space-y-2 rounded-2xl border border-border bg-surface px-2 pb-2 pt-2">
          <p className="flex items-center gap-1 px-1 text-[11px] font-semibold text-muted"><Palette className="h-3.5 w-3.5 text-brand" /> {T("Pick a colour", "रंग चुनें")}</p>
          <div className="flex items-center gap-2.5 overflow-x-auto px-1 pb-1">
            {Array.from(new Set([card.themeColor, ...SWATCHES])).map((sw) => (
              <button key={sw} type="button" onClick={() => setColor(sw)} aria-label={sw}
                className={`h-8 w-8 shrink-0 rounded-full transition-transform ${color === sw ? "scale-110 ring-2 ring-offset-2 ring-offset-surface" : ""}`} style={{ background: sw, boxShadow: color === sw ? `0 0 0 2px ${sw}` : "none" }} />
            ))}
            <input type="color" value={color || card.themeColor} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 shrink-0 rounded border border-border bg-surface p-0.5" aria-label={T("Your own colour", "अपना रंग")} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-surface2 p-1">
        {GROUPS.map((g) => (
          <button key={g.key} type="button" onClick={() => { setGroup(g.key); pick(g.tabs[0].key); }}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold transition ${group === g.key ? "bg-surface text-brand-ink shadow-card" : "text-muted"}`}>
            <g.Icon className="h-4 w-4" /> {g.label}
          </button>
        ))}
      </div>
      {TABS.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ key, label, Icon }) => <button key={key} type="button" onClick={() => pick(key)} className={`${chip(tab === key)} inline-flex shrink-0 items-center gap-1.5`}><Icon className="h-4 w-4" /> {label}</button>)}
        </div>
      )}
      {savedTab && savedTab === tab && <p role="status" className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good"><Check className="h-4 w-4" /> {T("Saved — it is live on your card", "Save हो गया — card पर live है")}</p>}

      {tab === "look" && (
        <section className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-sm font-semibold">{T("Card look", "Card का look")}</p>
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
          <button type="button" onClick={() => { setGroup("content"); pick("text"); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink"><FileText className="h-4 w-4" /> {T("Change any text, add a page", "कोई भी text बदलें, नया page जोड़ें")} →</button>
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
        <section className="rounded-xl border border-border p-3">
          <SitePhotos hi={hi} cardId={card.id} scope="card" onChanged={() => void refresh()} />
        </section>
      )}
      {tab === "offer" && (
        <section className="rounded-xl border border-border p-3">
          <NoticeBox card={card} url={link} locked={!paid} onChanged={(c) => setCard(c)} />
        </section>
      )}

      {/* Look and colour save here; the other tabs save by themselves (the bar shows there only while a look change waits). */}
      {(group === "design" || dirty || embedDirty || note) && (
        <div className="fixed bottom-[64px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          {note && <p role={note.bad ? "alert" : "status"} className={`mb-2 rounded-lg border px-3 py-2 text-xs font-semibold ${note.bad ? "border-danger/40 bg-danger/10 text-danger" : "border-good/40 bg-good/10 text-good"}`}>{note.text}</p>}
          <div className="flex items-center gap-3">
            <p className="flex-1 text-xs text-muted">{dirty || embedDirty ? T("Tap Save to put it on your card", "Save दबाएँ — तभी card पर लगेगा") : T("All saved", "सब save है")}</p>
            <button type="button" onClick={() => { if (embedDirty) { setNote(null); ownAfter.current = dirty; setSaveTick((n) => n + 1); } else void save(); }} disabled={busy || !(dirty || embedDirty)} className="rounded-xl grad-brand px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? "…" : T("Save", "Save करें")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
