"use client";

import Link from "next/link";
import { Users, CreditCard, IndianRupee, TrendingUp, ArrowUpRight, Network, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { displayLogin } from "@/lib/phone";

type Totals = { accounts: number; partners: number; green: number; cards: number; paid: number; mrr: number };
type Recent = { id: string; name: string; contact: string; joined: string; plan: string; username: string | null };
/** Monthly price per plan for the estimate when no subscription amount is on record (Growth ₹2,999). */
const PLAN_MRR: Record<string, number> = { pro: 2999, team: 4999 };

export default function AdminOverview() {
  // Real platform totals via the service-role admin API.
  const [t, setT] = useState<Totals>({ accounts: 0, partners: 0, green: 0, cards: 0, paid: 0, mrr: 0 });
  const [recent, setRecent] = useState<Recent[] | null>(null);

  useEffect(() => {
    (async () => {
      const h: Record<string, string> = { "content-type": "application/json" };
      try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
      try {
        const sb = getBrowserSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
        if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
      } catch { /* ignore */ }

      const r = await fetch("/api/admin/users", { headers: h });
      if (!r.ok) return;
      const d = await r.json();
      type Row = { id: string; kind?: string; name: string; email?: string; phone?: string; joined: string; username?: string | null; cards: number; plan: string; subscription?: { amount: number | null } | null; partner?: { status: string } | null };
      const all = (d.users ?? []) as Row[];
      const accounts = all.filter((u) => u.kind !== "partner");
      const partners = all.filter((u) => u.partner);
      const paid = accounts.filter((u) => u.plan !== "free");
      setT({
        accounts: accounts.length,
        partners: partners.length,
        green: partners.filter((u) => u.partner?.status === "green").length,
        cards: accounts.reduce((a, u) => a + (u.cards ?? 0), 0),
        paid: paid.length,
        mrr: paid.reduce((a, u) => a + (u.subscription?.amount ?? PLAN_MRR[u.plan] ?? 0), 0),
      });
      // The list comes newest first: the latest sign-ups at a glance.
      setRecent(accounts.slice(0, 6).map((u) => ({ id: u.id, name: u.name, contact: /@phone\./i.test(u.email ?? "") ? `📱 ${displayLogin(u.email ?? "")}` : u.email || u.phone || "", joined: u.joined, plan: u.plan, username: u.username ?? null })));
    })();
  }, []);

  const stats = [
    { label: "App accounts", value: t.accounts, icon: Users },
    { label: "Partner IDs (incl. root)", value: `${t.partners} · ${t.green} green`, icon: Network },
    { label: "Cards", value: t.cards, icon: CreditCard },
    { label: "Paid plans", value: t.paid, icon: TrendingUp },
    { label: "MRR (est.)", value: `₹${t.mrr.toLocaleString("en-IN")}`, icon: IndianRupee },
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-muted">Everything on Shubhora, at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-faint">{label}</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">Newest users</h2>
          <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink hover:underline">All users <ChevronRight className="h-3.5 w-3.5" /></Link>
        </div>
        {recent === null
          ? <p className="px-5 py-6 text-sm text-faint">Loading…</p>
          : recent.length === 0
          ? <p className="px-5 py-6 text-sm text-faint">No users yet.</p>
          : <ul className="divide-y divide-border">
              {recent.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface2/60">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink">{(u.name || "?").slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.name}{u.username ? <span className="ml-1.5 text-xs font-normal text-faint">@{u.username}</span> : null}</span>
                      <span className="block truncate text-xs text-muted">{u.contact}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.plan === "free" ? "bg-surface2 text-muted" : "bg-good/10 text-good"}`}>{u.plan === "free" ? "Free" : "Paid"}</span>
                    <span className="hidden w-24 text-right text-xs tabular-nums text-faint sm:block">{u.joined}</span>
                  </Link>
                </li>
              ))}
            </ul>}
      </section>

      <div className="grid md:grid-cols-3 gap-5">
        {[
          { href: "/admin/users", title: "All users", desc: "Every account and partner ID, root included" },
          { href: "/admin/cards", title: "Manage cards", desc: "Verify, activate, monitor" },
          { href: "/admin/site", title: "Edit site content", desc: "Hero text, intro video, announcement" },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{c.title}</h3>
              <ArrowUpRight className="h-4 w-4 text-muted" />
            </div>
            <p className="text-sm text-muted mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>

    </div>
  );
}
