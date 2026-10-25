"use client";
// The guided finish (lib/site-finish.ts): `useFinish` reads the card and the owner's products and works out the steps; `FinishBar` is
// the one-line "Website 3/6 पूरी · अगला: Photos" box with a single button, shown on Congratulations and on Card & Website.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Check, ChevronRight, MapPin, Plus, Search, Smartphone, Star } from "lucide-react";
import { api } from "@/lib/poster-client";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { FINISH_HREF, finishSteps, skippedSteps, type FinishStep } from "@/lib/site-finish";
import type { Card } from "@/lib/types";
import { completeness, PART_NAME } from "@/lib/edit-status";
import { editHref, lastEdit } from "@/lib/edit-nav";

export const FINISH_ICON = { plus: Plus, camera: Camera, map: MapPin, phone: Smartphone, star: Star, search: Search } as const;

export function useFinish() {
  const [card, setCard] = useState<Card | null>(null);
  const [steps, setSteps] = useState<FinishStep[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const [cards, prods] = await Promise.all([
        fetchMyCardsStrict(),
        api<{ products?: unknown[] }>("/api/poster/products").then((r) => (r.ok ? r.data.products?.length ?? 0 : 0)).catch(() => 0),
      ]);
      const c = cards[0] ?? null;
      setCard(c); setFailed(false);
      setSteps(c ? finishSteps(c, prods) : []);
      setSkipped(c ? skippedSteps(c.id) : []);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => {
    void load();
    // Back from a step's page: read it all again, so the step just finished shows ✓ and the next one comes up.
    const again = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("pageshow", again); window.addEventListener("focus", again); document.addEventListener("visibilitychange", again);
    return () => { window.removeEventListener("pageshow", again); window.removeEventListener("focus", again); document.removeEventListener("visibilitychange", again); };
  }, [load]);
  const done = steps?.filter((s) => s.done).length ?? 0;
  const total = steps?.length ?? 0;
  const next = steps?.find((s) => !s.done && !skipped.includes(s.key)) ?? null;
  return { card, steps, skipped, setSkipped, done, total, next, failed, reload: load };
}

/** The box: how complete, the next empty part, one tap into the editor (its list shows the empty ones on top). The same count as the
 *  editor's (lib/edit-status.ts, owner 26 Oct 2026: "ek hi ginti"). Nothing when the card is not there yet. */
export function FinishBar({ hi, className = "" }: { hi: boolean; className?: string }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const { card } = useFinish();
  if (!card) return null;
  const site = !!card.site?.enabled;
  const { done, total, pct, empty } = completeness(card, site);
  const all = done === total;
  const what = site ? T("website", "website") : T("card", "card");
  const nextName = empty[0] ? PART_NAME[empty[0]] : null;
  return (
    <Link href={editHref(lastEdit() ?? (site ? "site" : "card"))} className={`block overflow-hidden rounded-3xl border border-border bg-surface shadow-card transition active:scale-[.99] ${className}`}>
      <div className={`flex items-center gap-3 px-4 py-3 text-white ${all ? "bg-gradient-to-r from-[#1fb956] to-[#25D366]" : "bg-gradient-to-r from-[#2f5bf5] to-[#5b7cff]"}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-extrabold">{all ? <Check className="h-5 w-5" strokeWidth={3} /> : `${pct}%`}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold leading-tight">{all ? T(`Your ${what} is complete`, `आपकी ${what} पूरी है`) : T(`Your ${what} is ${pct}% complete`, `आपकी ${what} ${pct}% पूरी`)}</span>
          <span className="block truncate text-[11px] text-white/90">{all ? T(`All ${total} done`, `सभी ${total} पूरे`) : `${done}/${total} · ${T("Next", "अगला")}: ${nextName ? (hi ? nextName[1] : nextName[0]) : ""}`}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0" />
      </div>
      <div className="flex gap-1 px-4 py-2.5">
        {Array.from({ length: total }, (_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < done ? "bg-good" : "bg-surface2"}`} />)}
      </div>
    </Link>
  );
}

/** On a step's own page opened from the guided finish (?back=/poster/site/next): one "Done, next →" button at the foot, so a list page
 *  (products, reviews, Google) also moves on without hunting for Back. Nothing when the page was opened any other way. */
export function FinishNext({ hi, when = true }: { hi: boolean; /** e.g. only once saved, so nothing typed is left behind. */ when?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => { try { setOn(new URLSearchParams(window.location.search).get("back") === FINISH_HREF); } catch { /* ignore */ } }, []);
  if (!on || !when) return null;
  return (
    <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 pt-3">
      <Link href={FINISH_HREF} replace className="flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white shadow-float">
        <Check className="h-5 w-5" strokeWidth={3} /> {hi ? "हो गया, आगे बढ़ें" : "Done, next"} <ChevronRight className="h-5 w-5" />
      </Link>
    </div>
  );
}
