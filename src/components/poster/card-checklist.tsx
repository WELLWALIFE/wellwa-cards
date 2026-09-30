"use client";
// "Your card is 60% complete" (owner's call, 25 Sep 2026): the pieces customers look for, each one tap away —
// the tap opens the editor right on that piece (…/editor?focus=hours), adding the section when it is missing.
// Counted from the live card itself, so it is always true; nothing is stored.
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import type { Card, CardBlock } from "@/lib/types";

type Item = { key: string; en: string; hi: string; done: boolean; href?: string };

const blocks = (c: Card): CardBlock[] => c.pages.flatMap((p) => p.blocks ?? []);
const hasLink = (c: Card, type: string) => c.links.some((l) => l.type === type && l.value.replace(/[^0-9a-z@]/gi, "").length > 4);

export function cardChecklist(card: Card): Item[] {
  const bs = blocks(card);
  const has = (pred: (b: CardBlock) => boolean) => bs.some(pred);
  return [
    { key: "photo", en: "Your photo or logo", hi: "आपकी photo या logo", done: !!card.avatarUrl },
    { key: "cover", en: "Banner photo on top", hi: "ऊपर की बड़ी photo (banner)", done: !!card.coverUrl },
    { key: "whatsapp", en: "WhatsApp button", hi: "WhatsApp button", done: hasLink(card, "whatsapp") },
    { key: "about", en: "A few lines about you", hi: "अपने बारे में कुछ lines", done: !!card.about?.trim() || has((b) => b.kind === "about" && b.body.trim().length > 30) },
    { key: "products", en: "Products or services with price", hi: "Products / services, दाम के साथ", done: has((b) => (b.kind === "product" || b.kind === "services") && b.items.some((i) => !!i.name?.trim())) },
    { key: "gallery", en: "Photos of your shop or work", hi: "दुकान / काम की photos", done: has((b) => (b.kind === "gallery" || b.kind === "image" || b.kind === "carousel") && b.images.some((i) => !!i.url)) },
    { key: "hours", en: "Opening hours", hi: "खुलने का समय", done: has((b) => b.kind === "hours" && b.rows.length > 0) },
    { key: "location", en: "Address and map", hi: "पता और map", done: hasLink(card, "location") || has((b) => b.kind === "location" && (!!b.address?.trim() || !!b.mapUrl)) },
    { key: "upi", en: "UPI — get paid from the card", hi: "UPI — card से payment लें", done: hasLink(card, "upi") },
    { key: "reviews", en: "Customer reviews", hi: "Customers के reviews", done: has((b) => b.kind === "testimonials" && b.items.some((i) => !!i.text?.trim())), href: "/poster/testimonials" },
  ];
}

export function CardChecklist({ card, hi }: { card: Card; hi: boolean }) {
  const items = cardChecklist(card);
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const [showDone, setShowDone] = useState(false);
  if (done === items.length) return null;
  const todo = items.filter((i) => !i.done);
  return (
    <section className="rounded-2xl border-2 border-brand/30 bg-brand-soft/40 p-4 space-y-3">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-base font-bold">{hi ? `आपका card ${pct}% पूरा है` : `Your card is ${pct}% complete`}</p>
          <span className="text-xs font-semibold text-muted">{done}/{items.length}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full grad-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted">{hi ? "पूरा card = ज़्यादा भरोसा, ज़्यादा customers। हर काम एक tap का है।" : "A complete card earns more trust and more enquiries. Each one is a single tap."}</p>
      </div>
      <div className="space-y-1.5">
        {todo.map((i) => (
          <Link key={i.key} href={i.href ?? `/poster/d/editor?id=${card.id}&focus=${i.key}`}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white"><Plus className="h-3.5 w-3.5" /></span>
            <span className="flex-1">{hi ? i.hi : i.en}</span>
            <span className="text-xs text-brand-ink">{hi ? "जोड़ें →" : "Add →"}</span>
          </Link>
        ))}
      </div>
      {done > 0 && (
        <button type="button" onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
          <Check className="h-3.5 w-3.5 text-good" /> {hi ? `${done} हो गए` : `${done} done`} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDone ? "rotate-180" : ""}`} />
        </button>
      )}
      {showDone && (
        <ul className="space-y-1 text-xs text-muted">
          {items.filter((i) => i.done).map((i) => <li key={i.key} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-good" /> {hi ? i.hi : i.en}</li>)}
        </ul>
      )}
    </section>
  );
}
