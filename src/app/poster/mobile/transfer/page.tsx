"use client";
// Stock transfer between the main shop and the branches (Mobile → Settings → Branches). Counted items move by number, phones by IMEI.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LoaderCircle, Search, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { MsHelp } from "@/components/mobile/page-help";
import { itemMatches, itemTitle, storeName, type ItemRow, type MsSetup } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";

type Item = ItemRow & { stock: number; places?: Record<string, number> };
type Past = { id: string; from_store: string; to_store: string; lines: { name: string; qty: number }[]; created_by_name: string; created_at: string };
type TL = { key: string; itemId: string; name: string; serial: boolean; qty: string; imeis: string };
let seq = 0;
const imeiList = (s: string) => s.split(/[\s,]+/).filter(Boolean);

export default function TransferPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [items, setItems] = useState<Item[] | null>(null);
  const [setup, setSetup] = useState<MsSetup | null>(null);
  const [access, setAccess] = useState<MsAccess | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<TL[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api<{ items?: Item[]; setup?: MsSetup; access?: MsAccess; error?: string }>(`/api/mobile/items${asQ}`, { fresh: true }), api<{ transfers?: Past[]; setup?: MsSetup; error?: string }>(`/api/mobile/transfer${asQ}`, { fresh: true })]);
      if (!a.ok || !b.ok) { setErr(b.data?.error || a.data?.error || "Could not load."); return; }
      setErr(""); setItems(a.data.items ?? []); setSetup(a.data.setup ?? null); setAccess(a.data.access ?? null); setPast(b.data.transfers ?? []);
      const st = a.data.setup?.stores ?? [];
      setTo((t) => t || st[0]?.id || "");
    } catch { setErr("No internet."); }
  }, [asQ]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  const found = useMemo(() => (items && q.trim() ? items.filter((i) => i.active && i.kind !== "service" && itemMatches(i, q)).slice(0, 20) : []), [items, q]);
  const change = (key: string, p: Partial<TL>) => setLines((c) => c.map((x) => (x.key === key ? { ...x, ...p } : x)));
  async function save() {
    setNote(null);
    if (from === to) { setNote({ ok: false, t: T("From and To are the same.", "कहाँ से और कहाँ एक ही है।") }); return; }
    setBusy(true);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/mobile/transfer", { method: "POST", json: { as: ws.as || undefined, from, to, lines: lines.map((l) => ({ itemId: l.itemId, qty: Math.round(Number(l.qty)) || 0, imeis: l.serial ? imeiList(l.imeis) : [] })) } });
      setBusy(false);
      if (!r.ok) { setNote({ ok: false, t: r.data?.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
      setLines([]); setNote({ ok: true, t: T("✅ Moved.", "✅ ट्रांसफ़र हो गया।") }); void load();
    } catch { setBusy(false); setNote({ ok: false, t: T("No internet.", "इंटरनेट नहीं है।") }); }
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!items || !setup || !access) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (!setup.stores.length) return <div className="space-y-3 py-10 text-center"><p className="font-semibold">{T("Add a branch first: Mobile shop → Settings → Branches.", "पहले ब्रांच जोड़ें: मोबाइल दुकान → Settings → ब्रांच।")}</p><Link href={`/poster/mobile/settings${asQ}`} className="text-sm font-semibold text-brand-ink">Settings →</Link></div>;
  const places = ["", ...setup.stores.map((s) => s.id)];
  const sel = "rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold";
  const small = "rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";
  const name = (id: string) => storeName(setup, id, hi);
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">{T("Stock transfer", "स्टॉक ट्रांसफ़र")}</h1>
      <MsHelp k="transfer" />
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={from} onChange={(e) => { setFrom(e.target.value); setLines([]); }}>{places.map((p) => <option key={p} value={p}>{name(p)}</option>)}</select>
        <ArrowRight className="h-4 w-4 text-muted" />
        <select className={sel} value={to} onChange={(e) => setTo(e.target.value)}>{places.map((p) => <option key={p} value={p}>{name(p)}</option>)}</select>
      </div>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search the item to move", "जो item भेजना है वो खोजें")} /></div>
      {q.trim() && (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5">
          {found.map((i) => <button key={i.id} type="button" onClick={() => { setQ(""); setLines((c) => (c.some((x) => x.itemId === i.id) ? c : [...c, { key: `t${++seq}`, itemId: i.id, name: itemTitle(i), serial: i.serial, qty: "", imeis: "" }])); }} className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-bg"><span className="truncate font-semibold">{itemTitle(i)}</span><span className="shrink-0 text-[11px] text-muted">{name(from)}: {i.places?.[from] ?? 0}</span></button>)}
          {!found.length && <p className="px-2 py-2 text-sm text-muted">{T("Not found.", "नहीं मिला।")}</p>}
        </div>
      )}
      {lines.map((l) => { const it = items.find((i) => i.id === l.itemId); return (
        <div key={l.key} className="space-y-1.5 rounded-2xl border border-border bg-surface p-2.5">
          <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{l.name} <span className="font-normal text-muted">({name(from)}: {it?.places?.[from] ?? 0})</span></p><button type="button" aria-label="Remove" onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button></div>
          {l.serial ? <label className="block text-[12px] text-muted">IMEI ({imeiList(l.imeis).length}) — {T("scan each, one per line", "हर एक scan करें, एक line में एक")}<textarea className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm" rows={3} value={l.imeis} onChange={(e) => change(l.key, { imeis: e.target.value })} /></label>
            : <label className="flex items-center gap-2 text-[12px] text-muted">{T("How many", "कितने")}<input className={`${small} w-20`} inputMode="numeric" value={l.qty} onChange={(e) => change(l.key, { qty: e.target.value })} /></label>}
        </div>); })}
      {note && <p className={`text-sm font-semibold ${note.ok ? "text-good" : "text-danger"}`}>{note.t}</p>}
      {lines.length > 0 && <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {T(`Move to ${name(to)}`, `${name(to)} भेजें`)}</button>}
      {past.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="text-sm font-bold">{T("Past transfers", "पिछले ट्रांसफ़र")}</h2>
          {past.map((p) => <div key={p.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"><p className="font-semibold">{name(p.from_store)} → {name(p.to_store)}</p><p className="truncate text-[11px] text-muted">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {p.created_by_name} · {(p.lines ?? []).map((l) => `${l.name} ×${l.qty}`).join(", ")}</p></div>)}
        </section>
      )}
    </div>
  );
}
