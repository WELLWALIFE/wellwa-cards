"use client";

// AI Training → "मेरा मेनू" for a Shubhora partner (owner, 28 Nov 2026: "shubhora partner ki site me auto sari cheez lag jaaye,
// but agar wo change karta hai to change apply hona chahiye"). Every item and link comes from Shubhora (Super Admin) by itself;
// the partner may change any one of them for their own number, and bring Shubhora's back with one tap. Only the change is
// stored on the card (card.botMenu) — an item they never touched keeps following Shubhora's latest text.
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Link2, ListOrdered, LoaderCircle, RotateCcw } from "lucide-react";
import { publishCard } from "@/lib/cloud";
import type { Card } from "@/lib/types";
import { MENU_LINKS, cleanMenuConfig, resolveMenu, visibleItems } from "../../../bridge/shubhora-menu.mjs";

type BotMenu = NonNullable<Card["botMenu"]>;

export function AiShubhoraMenu({ card, onSaved, hi }: { card: Card; onSaved: (c: Card) => void; hi: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const lang = hi ? "hi" : "en";
  const [platform, setPlatform] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState("");
  const [text, setText] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/shubhora/menu").then((r) => r.json()).then((d) => setPlatform(d?.menu ?? {})).catch(() => setPlatform({}));
  }, []);

  const shubhora = useMemo(() => resolveMenu(platform ?? {}, {}), [platform]);
  const mine = useMemo(() => resolveMenu(platform ?? {}, card.botMenu ?? {}), [platform, card.botMenu]);
  const items = visibleItems(mine, card.partnerPlan !== false).filter((i: { call: boolean }) => !i.call);

  async function save(next: BotMenu, ok: string, key: string) {
    setBusy(key); setNote(null);
    const clean = cleanMenuConfig(next) as BotMenu;
    const c: Card = { ...card, botMenu: Object.keys(clean).length ? clean : undefined };
    const r = await publishCard(c).catch(() => ({ ok: false } as { ok: false }));
    setBusy("");
    if (!r.ok) { setNote({ text: T("Could not save — try again.", "Save नहीं हुआ — दोबारा try करें।"), bad: true }); return; }
    onSaved(c); setNote({ text: ok });
  }
  const withItem = (id: string, reply: string | null): BotMenu => {
    const cur = card.botMenu ?? {};
    const it = { ...(cur.items?.[id] ?? {}) };
    const r = { ...(it.reply ?? {}) };
    if (reply === null) delete r[lang]; else r[lang] = reply;
    it.reply = r;
    return { ...cur, items: { ...(cur.items ?? {}), [id]: it } };
  };
  const withLink = (key: string, url: string | null): BotMenu => {
    const cur = card.botMenu ?? {};
    const l = { ...(cur.links ?? {}) };
    if (url === null) delete l[key]; else l[key] = url;
    return { ...cur, links: l };
  };

  if (platform === null) return <div className="grid place-items-center rounded-2xl border border-border bg-surface p-5"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;

  const tag = (own: boolean) => own
    ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-ink">{T("Yours", "आपका")}</span>
    : <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] text-muted">{T("From Shubhora", "Shubhora से")}</span>;

  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ai/10 text-ai"><ListOrdered className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{T("My menu", "मेरा मेनू")}</p>
          <p className="mt-0.5 text-xs text-muted">{T("A new Hi gets this menu; each number gets its answer. All set by Shubhora — change any one for your number.", "नए Hi पर यह मेनू जाता है, हर नंबर पर उसका जवाब। सब Shubhora से लगा है — चाहें तो कोई भी बदलें।")}</p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.map((it: { id: string; title: Record<string, string>; reply: Record<string, string>; src: { reply: Record<string, string> } }) => {
          const n = visibleItems(mine, card.partnerPlan !== false).findIndex((x: { id: string }) => x.id === it.id) + 1;
          const own = it.src.reply[lang] === "own";
          const isOpen = open === it.id;
          return (
            <li key={it.id} className="rounded-xl border border-border bg-bg">
              <button type="button" onClick={() => { setOpen(isOpen ? "" : it.id); setText(it.reply[lang]); setNote(null); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ai/10 text-xs font-bold text-ai">{n}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.title[lang]}</span>
                {tag(own)}
                <ChevronDown className={`h-4 w-4 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-border p-2.5">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} maxLength={1500} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-snug outline-none focus:border-brand" />
                  <p className="text-[11px] text-muted">{T("{join} = your joining link, [MEDIA] {pdf} = the PDF as a file.", "{join} = आपका joining link, [MEDIA] {pdf} = PDF फ़ाइल।")}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!!busy || !text.trim() || text.trim() === it.reply[lang].trim()}
                      onClick={() => void save(withItem(it.id, text.trim() === shubhora.items.find((x: { id: string }) => x.id === it.id)?.reply[lang].trim() ? null : text.trim()), T("✅ Saved. WhatsApp within 5 minutes.", "✅ Save हो गया। WhatsApp पर 5 मिनट में।"), it.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {busy === it.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {T("Save", "सेव करें")}
                    </button>
                    {own && <button type="button" disabled={!!busy} onClick={() => { void save(withItem(it.id, null), T("✅ Shubhora's text is back.", "✅ Shubhora वाला text वापस लग गया।"), it.id); setText(shubhora.items.find((x: { id: string }) => x.id === it.id)?.reply[lang] ?? ""); }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-muted underline"><RotateCcw className="h-3.5 w-3.5" /> {T("Shubhora's text", "Shubhora वाला वापस")}</button>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5 border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold"><Link2 className="h-3.5 w-3.5 text-brand" /> {T("PDF and videos the AI sends", "AI जो PDF और video भेजता है")}</p>
        {MENU_LINKS.filter((l) => card.partnerPlan !== false || (l.key !== "pdf" && l.key !== "planVideo")).map((l) => {
          const own = mine.linkSrc[l.key] === "own";
          const v = links[l.key] ?? mine.links[l.key];
          return (
            <div key={l.key} className="rounded-xl border border-border bg-bg p-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold">{hi ? l.hi : l.en} <span className="ml-auto">{tag(own)}</span></div>
              <div className="mt-1 flex gap-1.5">
                <input value={v} onChange={(e) => setLinks({ ...links, [l.key]: e.target.value })} inputMode="url" autoCapitalize="none" spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-brand" />
                {links[l.key] !== undefined && links[l.key].trim() !== mine.links[l.key] && (
                  <button type="button" disabled={!!busy || !/^https?:\/\/\S+$/i.test(links[l.key].trim())}
                    onClick={() => { const u = links[l.key].trim(); void save(withLink(l.key, u === shubhora.links[l.key] ? null : u), T("✅ Link saved.", "✅ Link save हो गया।"), l.key).then(() => setLinks((x) => { const n = { ...x }; delete n[l.key]; return n; })); }}
                    className="shrink-0 rounded-lg grad-brand px-3 text-xs font-semibold text-white disabled:opacity-50">{busy === l.key ? "…" : T("Save", "सेव")}</button>
                )}
                {own && links[l.key] === undefined && (
                  <button type="button" disabled={!!busy} onClick={() => void save(withLink(l.key, null), T("✅ Shubhora's link is back.", "✅ Shubhora वाला link वापस।"), l.key)}
                    className="shrink-0 px-1.5 text-muted" aria-label={T("Shubhora's link", "Shubhora वाला link")}><RotateCcw className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {note && <p className={`text-xs font-semibold ${note.bad ? "text-danger" : "text-good"}`}>{note.text}</p>}
    </div>
  );
}
