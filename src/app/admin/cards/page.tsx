"use client";

// Super Admin → Cards. Verify or block any card for real — the toggle here
// calls /api/admin/cards, which writes the shared `active` column that the
// public page, lead capture and the WhatsApp bot all read. Blocking a card
// here stops it everywhere within a few minutes, not just on this screen.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { displayLogin } from "@/lib/phone";
import { BadgeCheck, Ban, CircleCheck, ExternalLink, LoaderCircle, Search } from "lucide-react";
import { adminCards, type AdminCardRow } from "@/lib/admin-data";
import { getBrowserSupabase } from "@/lib/supabase/browser";

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

export default function AdminCards() {
  const [cards, setCards] = useState<AdminCardRow[]>(adminCards);
  const [q, setQ] = useState("");
  const [live, setLive] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [owners, setOwners] = useState<Record<string, { email: string; phone?: string; provider?: string; name: string }>>({});
  const [loginInfo, setLoginInfo] = useState<{ mode: string; link?: string; password?: string; phone?: string; email?: string; login_url?: string; name: string } | null>(null);
  useEffect(() => { (async () => { const r = await fetch("/api/admin/users", { headers: await adminHeaders(), cache: "no-store" }); if (r.ok) { const j = await r.json(); const m: typeof owners = {}; for (const u of j.users ?? []) m[u.id] = { email: u.email, phone: u.phone, provider: u.provider, name: u.name }; setOwners(m); } })(); }, []);
  async function loginAs(ownerId: string, name: string) {
    setBusyId(ownerId);
    const r = await fetch("/api/admin/users", { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ action: "login_as", id: ownerId }) });
    const j = await r.json().catch(() => ({})); setBusyId("");
    if (!r.ok) { alert(j.error || "Failed"); return; }
    setLoginInfo({ ...j, name });
  }

  // Load real published cards from Supabase; fall back to sample rows.
  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      if (!sb) return;
      const { data } = await sb
        .from("cards")
        .select("id, username, name, active, data, owner_id")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data && data.length) {
        setLive(true);
        setCards(data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          username: c.username as string,
          owner: (c.name as string) || "—",
          ownerId: String(c.owner_id ?? ""),
          plan: ((c.data as { plan?: string } | null)?.plan ?? "free") as AdminCardRow["plan"],
          views: ((c.data as { views?: number } | null)?.views ?? 0),
          leads: 0,
          verified: ((c.data as { verified?: boolean } | null)?.verified ?? false),
          active: (c.active as boolean) ?? true,
        })));
      }
    })();
  }, []);

  async function toggleActive(c: AdminCardRow) {
    const next = !c.active;
    if (next === false && !confirm(`Block "/${c.username}"?\n\nIska public page, lead capture aur WhatsApp bot turant band ho jayenge.`)) return;
    setBusyId(c.id);
    setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, active: next } : x)));
    try {
      const r = await fetch("/api/admin/cards", {
        method: "PATCH", headers: await adminHeaders(),
        body: JSON.stringify({ id: c.id, active: next }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, active: !next } : x))); // revert on failure
      alert("Save nahi ho paya — dobara try karein.");
    }
    setBusyId("");
  }

  async function toggleVerified(c: AdminCardRow) {
    const next = !c.verified;
    setBusyId(c.id);
    setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, verified: next } : x)));
    try {
      const r = await fetch("/api/admin/cards", {
        method: "PATCH", headers: await adminHeaders(),
        body: JSON.stringify({ id: c.id, verified: next }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, verified: !next } : x)));
      alert("Save nahi ho paya — dobara try karein.");
    }
    setBusyId("");
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cards;
    return cards.filter((c) => c.username.toLowerCase().includes(s) || c.owner.toLowerCase().includes(s));
  }, [cards, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cards</h1>
          <p className="text-muted mt-1">
            {live ? "Real published cards from the cloud." : "Sample data — no cards published yet."}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 w-full sm:w-72 focus-within:ring-1 focus-within:ring-brand">
          <Search className="h-4 w-4 text-faint shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="Search card /username or owner…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-faint mono text-xs uppercase tracking-wide border-b border-border">
                <th className="px-4 py-3 font-semibold">Card</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Login</th>
                <th className="px-4 py-3 font-semibold">Views</th>
                <th className="px-4 py-3 font-semibold">Leads</th>
                <th className="px-4 py-3 font-semibold">Verified</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((c) => (
                <tr key={c.id} className="hover:bg-surface2/50">
                  <td className="px-4 py-3">
                    <p className="font-medium mono text-xs">/{c.username}</p>
                    <p className="text-[11px] text-faint mono">#{c.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">{c.ownerId ? <Link href={`/admin/users/${c.ownerId}`} className="text-brand-ink hover:underline">{owners[c.ownerId]?.name || c.owner}</Link> : c.owner}</td>
                  <td className="px-4 py-3">
                    {owners[c.ownerId ?? ""] ? (<>
                      <p className="text-xs mono">{/@phone\./i.test(owners[c.ownerId ?? ""].email ?? "") ? `📱 ${displayLogin(owners[c.ownerId ?? ""].email ?? "")}` : <>{owners[c.ownerId ?? ""].email || "—"}{owners[c.ownerId ?? ""].phone ? ` · +${String(owners[c.ownerId ?? ""].phone).replace(/^\+/, "")}` : ""}</>}</p>
                      <p className="text-[11px] text-faint">via {owners[c.ownerId ?? ""].provider || "?"} · <button onClick={() => loginAs(c.ownerId ?? "", c.owner)} disabled={busyId === (c.ownerId ?? "")} className="font-semibold text-brand-ink hover:underline disabled:opacity-40">Login as</button></p>
                    </>) : <span className="text-xs text-faint">…</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.views.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums">{c.leads}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleVerified(c)} disabled={!live || busyId === c.id}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                        c.verified ? "border-brand text-brand-ink bg-brand-soft" : "border-border text-muted hover:text-ink"
                      }`}>
                      <BadgeCheck className="h-3.5 w-3.5" /> {c.verified ? "Verified" : "Verify"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(c)} disabled={!live || busyId === c.id}
                      title={c.active ? "Click to block this card" : "Click to unblock"}
                      className={`inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40 ${c.active ? "text-good hover:text-danger" : "text-danger hover:text-good"}`}>
                      {busyId === c.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        : c.active ? <CircleCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      {c.active ? "active" : "blocked"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/c/${c.username}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
                      <ExternalLink className="h-3.5 w-3.5" /> View
                    </Link>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No cards match &ldquo;{q}&rdquo;.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-faint">Blocking a card stops its public page, lead capture and WhatsApp bot — usually within a few minutes.</p>
      {loginInfo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setLoginInfo(null)}>
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Login as {loginInfo.name}</h3>
            {loginInfo.mode === "link" ? (<>
              <p className="text-muted text-xs">Magic link for <b>{loginInfo.email}</b> — open in a <b>private / incognito window</b> (single use, short-lived).</p>
              <a href={loginInfo.link} target="_blank" rel="noreferrer" className="block w-full rounded-lg bg-brand px-3 py-2 text-center font-semibold text-white">Open login link ↗</a>
              <button onClick={() => navigator.clipboard?.writeText(loginInfo.link ?? "")} className="w-full rounded-lg border border-border px-3 py-2">Copy link</button>
            </>) : (<>
              <p className="text-muted text-xs">Phone account — a temporary password was set. Log in at <code>{loginInfo.login_url}</code> (private window):</p>
              <div className="rounded-lg bg-surface2 p-3"><div>Phone: <b>+{loginInfo.phone}</b></div><div>Password: <b className="mono">{loginInfo.password}</b></div></div>
              <button onClick={() => navigator.clipboard?.writeText(loginInfo.password ?? "")} className="w-full rounded-lg border border-border px-3 py-2">Copy password</button>
            </>)}
            <button onClick={() => setLoginInfo(null)} className="w-full rounded-lg border border-border px-3 py-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
