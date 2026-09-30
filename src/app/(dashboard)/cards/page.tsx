"use client";

// My Card — the user's one card (edit / view / delete) plus every template. One account = one link = one card
// (owner's call, 24 Sep 2026): with a card in place a template changes ITS look on the same link; a new card is
// only offered when there is none yet.

import { authHeaders } from "@/lib/auth-headers";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink, Pencil, Eye, LoaderCircle, Trash2, CreditCard, ArrowRight,
} from "lucide-react";
import type { Card } from "@/lib/types";
import type { CardTemplateDef } from "@/lib/templates";
import { sampleCards } from "@/lib/sample-data";
import { fetchMyCards, deleteMyCard } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { usePlan, PLAN_LIMITS, UpgradeSheet } from "@/lib/plan";

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [templates, setTemplates] = useState<CardTemplateDef[]>([]);
  const [demo, setDemo] = useState(false);
  const { plan } = usePlan();
  const [askUpgrade, setAskUpgrade] = useState(false);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) { setDemo(true); setCards(sampleCards); return; }
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { setCards([]); return; }
    setCards(await fetchMyCards());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    authHeaders().then((headers) => fetch("/api/templates", { headers })).then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? [])).catch(() => {});
  }, []);

  async function remove(c: Card) {
    if (!confirm(`Delete "${c.name}" (/${c.username})?\n\nThis removes the card and its public link.`)) return;
    const ok = await deleteMyCard(c.id);
    if (!ok) { alert("Could not delete the card. Please try again in a moment."); return; }
    load();
  }

  const limit = PLAN_LIMITS[plan].cards;
  const count = cards?.length ?? 0;
  const mine = cards?.[0] ?? null;
  const atLimit = !demo && count >= limit;

  // With a card already there, a template re-dresses THAT card (same link, same leads) instead of making a second one.
  function startFrom(key: string) {
    if (mine && !demo) { router.push(`/cards/${mine.id}?template=${key}`); return; }
    if (atLimit) { setAskUpgrade(true); return; }
    router.push(`/cards/new?template=${key}`);
  }

  return (
    <div className="space-y-10">
      {/* ---------- your cards ---------- */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My V-Card</h1>
            <p className="text-muted mt-1">
              One account, one link, one card — edit it, share it, or give it a new look below.
            </p>
          </div>
        </div>

        {cards === null ? (
          <div className="py-12 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
        ) : count === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-surface2 text-muted">
              <CreditCard className="h-5 w-5" />
            </span>
            <p className="mt-3 font-medium">No cards yet</p>
            <p className="text-sm text-muted mt-1">Pick a template below to build your first card in minutes.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {cards.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-surface overflow-hidden shadow-card">
                <div className="h-20 relative" style={{ background: `linear-gradient(120deg, ${c.themeColor}, ${c.themeColor}88)` }}>
                  {c.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  )}
                </div>
                <div className="px-5 pb-5">
                  <div className="relative z-10 h-14 w-14 -mt-7 rounded-full ring-4 ring-surface grid place-items-center text-white text-lg font-semibold overflow-hidden"
                    style={{ background: c.avatarColor }}>
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarUrl} alt="" className="h-full w-full object-contain bg-surface" />
                    ) : c.name.charAt(0)}
                  </div>
                  <div className="mt-3 flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      <p className="text-sm text-muted truncate">{c.jobTitle} · {c.company}</p>
                    </div>
                    <span className={`shrink-0 mono text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${c.active ? "bg-good/15 text-good" : "bg-surface2 text-faint"}`}>
                      {c.active ? "Live" : "Off"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-faint mono flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {c.views ?? 0} views · /{c.username}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/cards/${c.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                    <Link href={`/c/${c.username}`} target="_blank"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2">
                      <ExternalLink className="h-3.5 w-3.5" /> View
                    </Link>
                    {!demo && (
                      <button onClick={() => remove(c)}
                        className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm text-danger hover:bg-danger hover:text-white hover:border-danger transition-colors"
                        aria-label="Delete card" title="Delete card">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- start another card ---------- */}
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {count === 0 ? "Choose a template" : "Give your card a new look"}
          </h2>
          <p className="text-muted text-sm mt-1">
            {count === 0
              ? "Each template arrives almost complete — swap in your name, photos and numbers, then publish."
              : "Pick a template and your card's pages are replaced with that design — same link, same leads. Check it in the editor, then Publish."}
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="py-8 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => {
              const accent = t.data?.themeColor ?? "#0e9e90";
              const pages = t.data?.pages?.length ?? 0;
              const blocks = (t.data?.pages ?? []).reduce((n, p) => n + p.blocks.length, 0);
              return (
                <div
                  key={t.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => startFrom(t.key)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startFrom(t.key); }}
                  className="group cursor-pointer rounded-2xl border border-border bg-surface overflow-hidden shadow-card hover:shadow-float hover:-translate-y-0.5 transition-all"
                >
                  <div className="h-14 relative" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}>
                    <span className="absolute left-4 -bottom-4 grid h-10 w-10 place-items-center rounded-xl bg-surface ring-4 ring-surface text-xl shadow-card">
                      {t.emoji}
                    </span>
                  </div>
                  <div className="p-4 pt-6">
                    <h3 className="font-semibold text-[15px]">{t.name}</h3>
                    <p className="text-[11px] mono text-muted">{t.category}</p>
                    <p className="text-sm text-muted mt-1.5 line-clamp-2">{t.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <a href={`/templates/${t.key}`} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
                        <Eye className="h-3 w-3" /> Preview · {pages} {pages === 1 ? "page" : "pages"}, {blocks} sections
                      </a>
                      <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: accent }}>
                        {count === 0 ? "Use" : "Apply"} <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {askUpgrade && <UpgradeSheet feature="extra-cards" onClose={() => setAskUpgrade(false)} />}
    </div>
  );
}
