"use client";

// Overview — real numbers for the signed-in user only. Sample data appears
// solely in demo mode (no Supabase configured), never for a real account.

import { SetupChecklist } from "@/components/setup-checklist";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Eye, Users, MessageCircle, TrendingUp, ArrowUpRight, Plus, CreditCard, LoaderCircle,
} from "lucide-react";
import type { Card, Lead } from "@/lib/types";
import { sampleCards, sampleLeads } from "@/lib/sample-data";
import { fetchMyCards } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const statusStyle: Record<string, string> = {
  hot: "bg-lead/15 text-lead",
  warm: "bg-brand-soft text-brand-ink",
  new: "bg-surface2 text-muted",
  won: "bg-good/15 text-good",
  cold: "bg-surface2 text-faint",
};

type Row = { id: string; name: string; message: string; status: string; score: number };

export default function DashboardPage() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [leads, setLeads] = useState<Row[]>([]);
  const [clicks, setClicks] = useState(0);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      if (!sb) {
        // demo mode — show the sample story so the UI is explorable
        setDemo(true);
        setCards(sampleCards);
        setLeads(sampleLeads.slice(0, 4).map((l) => ({
          id: l.id, name: l.name, message: l.message, status: l.status, score: l.score,
        })));
        return;
      }
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setCards([]); return; }

      const mine = await fetchMyCards();
      setCards(mine);

      const { data: ld } = await sb
        .from("leads")
        .select("id,name,message,status,score")
        .eq("owner_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(4);
      setLeads((ld ?? []) as Row[]);

      // WhatsApp/chat engagement = click events on my cards
      if (mine.length) {
        const { count } = await sb
          .from("card_events")
          .select("id", { count: "exact", head: true })
          .in("username", mine.map((c) => c.username))
          .eq("kind", "click");
        setClicks(count ?? 0);
      }
    })();
  }, []);

  const views = (cards ?? []).reduce((n, c) => n + (c.views ?? 0), 0);
  const leadCount = leads.length;
  const conversion = views > 0 ? ((leadCount / views) * 100).toFixed(1) + "%" : "—";

  const stats = demo
    ? [
        { label: "Card views", value: "1,626", icon: Eye },
        { label: "Leads captured", value: String(sampleLeads.length), icon: Users },
        { label: "Link clicks", value: "48", icon: MessageCircle },
        { label: "Conversion", value: "6.2%", icon: TrendingUp },
      ]
    : [
        { label: "Card views", value: views.toLocaleString("en-IN"), icon: Eye },
        { label: "Leads captured", value: String(leadCount), icon: Users },
        { label: "Link clicks", value: String(clicks), icon: MessageCircle },
        { label: "Conversion", value: conversion, icon: TrendingUp },
      ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted mt-1">Your business at a glance: leads, visits and what to do next.</p>
      </div>

      <SetupChecklist />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-ink">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
            <div className="text-sm text-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="font-semibold">Recent leads</h2>
            <Link href="/leads" className="text-sm text-brand-ink inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              No leads yet. Share your card — enquiries land here automatically.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {leads.map((l) => (
                <li key={l.id} className="flex items-center gap-3 p-4">
                  <div className="h-9 w-9 rounded-full bg-surface2 grid place-items-center text-sm font-medium text-muted shrink-0">
                    {(l.name || "?").charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{l.name || "Visitor"}</p>
                    <p className="text-xs text-muted truncate">{l.message}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`mono text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${statusStyle[l.status] ?? statusStyle.new}`}>
                      {l.status}
                    </span>
                    {l.score > 0 && <p className="text-xs text-faint mt-1 tabular-nums">Score {l.score}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Your cards</h2>
          {cards === null ? (
            <div className="py-8 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
          ) : cards.length === 0 ? (
            <div className="mt-4 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-surface2 text-muted">
                <CreditCard className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm text-muted">You haven&apos;t created a card yet.</p>
              <Link href="/cards/new"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg grad-brand px-3.5 py-2 text-sm font-semibold text-white">
                <Plus className="h-4 w-4" /> Create my card
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {cards.map((c) => (
                <Link key={c.id} href={`/cards/${c.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-border-strong transition-colors">
                  <div className="h-9 w-9 rounded-full grid place-items-center text-white text-sm font-semibold shrink-0 overflow-hidden"
                    style={{ background: c.avatarColor }}>
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarUrl} alt="" className="h-full w-full object-contain bg-surface" />
                    ) : c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted truncate">/{c.username}</p>
                  </div>
                  <span className="mono text-xs text-faint tabular-nums">{c.views ?? 0}👁</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
