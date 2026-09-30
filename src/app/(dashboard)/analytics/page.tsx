"use client";

// Live analytics from card_events (views with ?src= source + button clicks).
// Falls back to sample data when logged out / table not yet migrated.

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { PaidPage } from "@/components/paid-page";

type Ev = { kind: string; target: string; src: string; created_at: string;
  utm_source?: string | null; utm_campaign?: string | null };

const SAMPLE_WEEK = [
  { d: "Mon", v: 120 }, { d: "Tue", v: 180 }, { d: "Wed", v: 150 },
  { d: "Thu", v: 240 }, { d: "Fri", v: 320 }, { d: "Sat", v: 280 }, { d: "Sun", v: 210 },
];
const SAMPLE_SOURCES = [
  { label: "QR scan", n: 42 }, { label: "WhatsApp", n: 28 },
  { label: "Direct link", n: 18 }, { label: "Instagram", n: 12 },
];
const SAMPLE_CLICKS = [
  { label: "WhatsApp", n: 64 }, { label: "Call", n: 31 },
  { label: "Save contact", n: 22 }, { label: "Order: Aura Plus", n: 17 },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AnalyticsPageInner() {
  const [events, setEvents] = useState<Ev[] | null>(null); // null = loading / no data yet
  const [live, setLive] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      if (!sb) { setEvents([]); return; }
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setEvents([]); return; }
      const { data: cards } = await sb.from("cards").select("username").eq("owner_id", auth.user.id);
      const names = (cards ?? []).map((c: { username: string }) => c.username);
      if (!names.length) { setEvents([]); return; }
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await sb
        .from("card_events")
        .select("kind, target, src, created_at, utm_source, utm_campaign")
        .in("username", names)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error || !data) { setEvents([]); return; } // table missing → sample
      setEvents(data as Ev[]);
      setLive(true);
    })();
  }, []);

  const views = (events ?? []).filter((e) => e.kind === "view");
  const clicks = (events ?? []).filter((e) => e.kind === "click");
  const contactActions = clicks.filter((e) => ["whatsapp", "call", "phone", "form", "appointment"].includes(e.target)).length;
  const contactRate = views.length ? Math.round((contactActions / views.length) * 1000) / 10 : 0;

  // Last-7-days bars
  const week = live
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const key = d.toDateString();
        return { d: DAYS[d.getDay()], v: views.filter((e) => new Date(e.created_at).toDateString() === key).length };
      })
    : SAMPLE_WEEK;
  const max = Math.max(1, ...week.map((w) => w.v));

  const sources = live ? tally(views.map((e) => e.utm_source || e.src || "direct")) : SAMPLE_SOURCES;

  // Per-campaign performance. Views alone flatter an ad; the contact rate is
  // what tells you whether the traffic was any good.
  const MONEY = new Set(["whatsapp", "call", "phone", "form", "appointment"]);
  const campaigns = live
    ? Object.entries(
        (events ?? []).reduce((acc: Record<string, { views: number; actions: number }>, e) => {
          const key = e.utm_campaign || "";
          if (!key) return acc;
          acc[key] ??= { views: 0, actions: 0 };
          if (e.kind === "view") acc[key].views++;
          else if (MONEY.has(e.target)) acc[key].actions++;
          return acc;
        }, {}),
      )
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8)
    : [];
  const clickTargets = live ? tally(clicks.map((e) => prettyTarget(e.target))) : SAMPLE_CLICKS;
  const totalSrc = Math.max(1, sources.reduce((a, s) => a + s.n, 0));
  const totalClicks = Math.max(1, clickTargets.reduce((a, s) => a + s.n, 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted mt-1">See which manual posts, QR links and campaigns turn into real enquiries.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["30-day visits", live ? views.length : "—"],
          ["Contact actions", live ? contactActions : "—"],
          ["Contact rate", live ? `${contactRate}%` : "—"],
          ["Top source", live ? (sources[0]?.label || "Direct") : "Sample"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums capitalize">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Card views</h2>
            <span className="mono text-xs text-muted">
              {live ? `last 7 days · ${views.length} total (30d)` : "sample data"}
            </span>
          </div>
          <div className="mt-6 flex items-end gap-3 h-44">
            {week.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className="w-full max-w-9 rounded-t-md bg-brand/85 hover:bg-brand transition-colors"
                    style={{ height: `${(w.v / max) * 100}%`, minHeight: w.v ? 4 : 0 }}
                    title={`${w.v} views`}
                  />
                </div>
                <span className="text-xs text-faint mono">{w.d}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Traffic sources</h2>
          <p className="text-[11px] text-faint mt-0.5">Share links add <span className="mono">?src=</span> automatically.</p>
          <div className="mt-4 space-y-4">
            {sources.slice(0, 6).map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted capitalize">{c.label}</span>
                  <span className="tabular-nums text-ink font-medium">{Math.round((c.n / totalSrc) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface2 overflow-hidden">
                  <div className="h-full rounded-full bg-ai" style={{ width: `${(c.n / totalSrc) * 100}%` }} />
                </div>
              </div>
            ))}
            {live && !sources.length && <p className="text-sm text-muted">No views yet.</p>}
          </div>
        </section>
      </div>

      {campaigns.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">
            Ad campaigns <span className="text-xs text-muted font-normal">— which ads bring people who actually contact you</span>
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-faint mono text-xs uppercase border-b border-border">
                  <th className="py-2 font-semibold">Campaign</th>
                  <th className="py-2 font-semibold text-right">Visits</th>
                  <th className="py-2 font-semibold text-right">Contacts</th>
                  <th className="py-2 font-semibold text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => (
                  <tr key={c.label}>
                    <td className="py-2 pr-3 font-medium truncate max-w-[220px]">{c.label}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{c.views}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{c.actions}</td>
                    <td className="py-2 text-right tabular-nums" style={{ color: c.actions ? "var(--good)" : "var(--faint)" }}>
                      {c.views ? Math.round((c.actions / c.views) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-faint mt-3">
            Tag your ad links with <span className="mono">?utm_source=facebook&amp;utm_campaign=diwali</span> to see them here.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Button clicks <span className="text-xs text-muted font-normal">— what visitors do on your card</span></h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {clickTargets.slice(0, 8).map((c) => (
            <div key={c.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted capitalize truncate">{c.label}</span>
                <span className="tabular-nums text-ink font-medium">{c.n}</span>
              </div>
              <div className="h-2 rounded-full bg-surface2 overflow-hidden">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(c.n / totalClicks) * 100}%` }} />
              </div>
            </div>
          ))}
          {live && !clickTargets.length && <p className="text-sm text-muted">No clicks yet — share your card!</p>}
        </div>
      </section>

      {!live && (
        <p className="text-xs text-faint">
          Live analytics start once you&apos;re logged in, your card is published, and migration
          <span className="mono"> 0005_events.sql</span> has been run in Supabase.
        </p>
      )}
    </div>
  );
}

function tally(items: string[]) {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}

function prettyTarget(t: string) {
  if (t.startsWith("product:")) return `Order: ${t.slice(8)}`;
  if (t === "vcard") return "Save contact";
  if (t.startsWith("primary-")) return t.slice(8);
  return t;
}

export default function AnalyticsPage() {
  return (
    <PaidPage feature="analytics">
      <AnalyticsPageInner />
    </PaidPage>
  );
}
