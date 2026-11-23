"use client";
// One karigar's ledger: what they hold of the shop's gold and silver (fine), the money owed, the orders with them, and every entry
// (gold given, work received with wastage allowed, labour, money paid) with the running fine balance. A wrong entry is voided with
// a reason, never deleted. The statement can go to the karigar on WhatsApp.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, MessageCircle, Plus } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { grams, inr, mgOf, paiseOf, type JwSetup, type Metal } from "@/lib/jewellery";
import { TXN_KINDS, fineOf, type Karigar, type KarigarBalance, type KarigarTxn, type OrderRow, type TxnKind } from "@/lib/jewellery-orders";
import { JwTip } from "@/components/jewellery/jw-tip";

type Ans = { karigar: Karigar; txns: KarigarTxn[]; balance: KarigarBalance; orders: OrderRow[]; today: string; setup: JwSetup; error?: string };

function Ledger() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [kind, setKind] = useState<TxnKind>("issue");
  const [f, setF] = useState({ metal: "gold" as Metal, gross: "", touch: "99.5", wastage: "", amount: "", note: "", order: sp.get("order") ?? "", day: "" });
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState<string>("");
  const [why, setWhy] = useState("");
  const asQ = ws.q ? `?${ws.q}` : "";

  const load = useCallback(async () => {
    const r = await api<Ans>(`/api/jewellery/karigars/${id}${asQ}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setD(r.data);
  }, [id, asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  // The running fine-gold balance after each entry (oldest first), shown beside it.
  const running = useMemo(() => {
    const out: Record<string, number> = {}; let bal = 0;
    for (const t of [...(d?.txns ?? [])].reverse()) {
      if (!t.voided && t.metal === "gold") { if (t.kind === "issue") bal += t.fine_mg; if (t.kind === "receive") bal -= t.fine_mg + t.wastage_mg; }
      out[t.id] = bal;
    }
    return out;
  }, [d]);

  async function post(body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const r = await api<{ ok?: boolean; txn?: KarigarTxn; error?: string }>(`/api/jewellery/karigars/${id}`, { method: "POST", json: { as: ws.as || undefined, ...body } });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return false; }
    setMsg({ ok: true, t: T("✅ Saved.", "✅ Save हो गया।") }); void load(); return true;
  }
  async function addEntry() {
    const money = kind === "labour" || kind === "payment";
    const ok = await post({
      order_id: f.order || undefined, day: f.day || undefined,
      txn: money ? { kind, paise: paiseOf(f.amount), note: f.note } : { kind, metal: f.metal, gross_mg: mgOf(f.gross), touch_bp: Math.round(Number(f.touch) * 100) || 0, wastage_mg: kind === "receive" ? mgOf(f.wastage) : 0, note: f.note },
    });
    if (ok) setF({ ...f, gross: "", wastage: "", amount: "", note: "" });
  }
  async function setActive(active: boolean) {
    if (!d) return;
    const r = await api<{ ok?: boolean; error?: string }>("/api/jewellery/karigars", { method: "POST", json: { as: ws.as || undefined, id: d.karigar.id, name: d.karigar.name, phone: d.karigar.phone, skill: d.karigar.skill, active } });
    if (r.ok) void load();
  }

  if (err && !d) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const k = d.karigar, b = d.balance;
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-brand";
  const lab = "mb-0.5 block text-[11px] font-semibold text-muted";
  const money = kind === "labour" || kind === "payment";
  const preview = !money && mgOf(f.gross) > 0 ? fineOf(mgOf(f.gross), Math.round(Number(f.touch) * 100) || 0) : 0;
  const statement = [
    `${k.name} ji — hisaab (${d.today})`,
    `Sona aapke paas (fine): ${grams(b.fine.gold)}`,
    b.fine.silver ? `Chandi aapke paas (fine): ${grams(b.fine.silver)}` : "",
    `Diya: ${grams(b.issued.gold)} · Aaya: ${grams(b.received.gold)} · Wastage: ${grams(b.wastage.gold)}`,
    b.money ? (b.money > 0 ? `Majdoori baaki (dukaan se lena): ${inr(b.money)}` : `Advance diya hua: ${inr(-b.money)}`) : "",
  ].filter(Boolean).join("\n");

  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery/karigars${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Karigars", "कारीगर")}</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">👷 {k.name} <span className="text-sm font-normal text-muted">{[k.skill, k.phone].filter(Boolean).join(" · ")}</span></h1>
        <div className="flex gap-2">
          {k.phone && <a href={`https://wa.me/${k.phone.replace(/\D/g, "")}?text=${encodeURIComponent(statement)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366] px-3 py-2 text-xs font-semibold text-[#128C7E]"><MessageCircle className="h-4 w-4" /> {T("Send statement", "हिसाब भेजें")}</a>}
          <button type="button" onClick={() => void setActive(!k.active)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted">{k.active ? T("Stop (old karigar)", "बंद करें") : T("Make active", "चालू करें")}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#c9a227]/40 bg-[#fffaf0] p-3"><p className="text-[11px] text-muted">{T("Gold they hold (fine)", "उनके पास सोना (fine)")}</p><p className="text-xl font-bold tabular-nums">{grams(b.fine.gold)}</p><p className="text-[10px] text-muted">{T("given", "दिया")} {grams(b.issued.gold)} · {T("back", "आया")} {grams(b.received.gold)} · {T("wastage", "वेस्टेज")} {grams(b.wastage.gold)}</p></div>
        {(b.issued.silver > 0 || b.fine.silver !== 0) && <div className="rounded-2xl border border-border bg-surface p-3"><p className="text-[11px] text-muted">{T("Silver they hold (fine)", "उनके पास चाँदी (fine)")}</p><p className="text-xl font-bold tabular-nums">{grams(b.fine.silver)}</p></div>}
        <div className="rounded-2xl border border-border bg-surface p-3"><p className="text-[11px] text-muted">{b.money >= 0 ? T("Labour to pay", "मज़दूरी देनी है") : T("Advance given", "एडवांस दिया")}</p><p className={`text-xl font-bold tabular-nums ${b.money > 0 ? "text-danger" : ""}`}>{inr(Math.abs(b.money))}</p></div>
      </div>

      {d.orders.length > 0 && (
        <section className="space-y-1 rounded-2xl border border-border bg-surface p-3">
          <h2 className="text-sm font-bold">{T("Orders with them", "उनके पास ऑर्डर")}</h2>
          {d.orders.map((o) => <Link key={o.id} href={`/poster/jewellery/order/${o.id}${asQ}`} className="block text-xs"><b>{o.code}</b> · {o.customer_name} · {o.items.map((i) => i.desc).filter(Boolean).join(", ")}{o.due_date ? ` · ${T("due", "तारीख़")} ${o.due_date}` : ""}{o.status === "ready" ? " · ✅" : ""}</Link>)}
        </section>
      )}

      <section className="space-y-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
        <div className="flex flex-wrap gap-1">
          {TXN_KINDS.map((x) => <button key={x.key} type="button" onClick={() => { setKind(x.key); if (x.key === "receive" && f.touch === "99.5") setF({ ...f, touch: "91.6" }); if (x.key === "issue" && f.touch === "91.6") setF({ ...f, touch: "99.5" }); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${kind === x.key ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{hi ? x.hi : x.en}</button>)}
        </div>
        <p className="text-[11px] text-muted">{TXN_KINDS.find((x) => x.key === kind)?.help}</p>
        {money ? (
          <label className="block"><span className={lab}>₹</span><input className={inp} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label><span className={lab}>{T("Metal", "धातु")}<JwTip k="Metal" /></span><select className={inp} value={f.metal} onChange={(e) => setF({ ...f, metal: e.target.value as Metal })}><option value="gold">{T("Gold", "सोना")}</option><option value="silver">{T("Silver", "चाँदी")}</option></select></label>
            <label><span className={lab}>{T("Gross weight (g)", "वज़न (g)")}<JwTip k="Gross weight (g)" /></span><input className={inp} inputMode="decimal" value={f.gross} onChange={(e) => setF({ ...f, gross: e.target.value })} placeholder="0.000" /></label>
            <label><span className={lab}>{T("Touch %", "टंच %")}<JwTip k="Touch %" /></span><input className={inp} inputMode="decimal" value={f.touch} onChange={(e) => setF({ ...f, touch: e.target.value })} /></label>
            {kind === "receive" && <label><span className={lab}>{T("Wastage allowed (fine g)", "वेस्टेज छूट (fine g)")}<JwTip k="Wastage allowed (fine g)" /></span><input className={inp} inputMode="decimal" value={f.wastage} onChange={(e) => setF({ ...f, wastage: e.target.value })} placeholder="0.000" /></label>}
          </div>
        )}
        {preview > 0 && <p className="text-xs font-semibold">= {grams(preview)} fine{kind === "receive" && mgOf(f.wastage) ? ` + ${grams(mgOf(f.wastage))} ${T("wastage", "वेस्टेज")}` : ""}</p>}
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lab}>{T("For order (optional)", "किस ऑर्डर के लिए")}<JwTip k="For order (optional)" /></span><select className={inp} value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })}><option value="">—</option>{d.orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.customer_name}</option>)}{f.order && !d.orders.some((o) => o.id === f.order) && <option value={f.order}>{T("This order", "यह ऑर्डर")}</option>}</select></label>
          <label><span className={lab}>{T("Date", "तारीख़")}<JwTip k="Date" /></span><input type="date" className={inp} max={d.today} value={f.day || d.today} onChange={(e) => setF({ ...f, day: e.target.value })} /></label>
        </div>
        <input className={inp} placeholder={T("Note (e.g. 2 bangles, bill no.)", "नोट (जैसे 2 चूड़ी, पर्ची नंबर)")} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-good" : "text-danger"}`}>{msg.t}</p>}
        <button type="button" disabled={busy} onClick={() => void addEntry()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {T("Save entry", "Entry save करें")}</button>
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <h2 className="border-b border-border px-3 py-2 text-sm font-bold">{T("Ledger", "खाता")}</h2>
        {d.txns.length === 0 && <p className="p-4 text-center text-sm text-muted">{T("No entries yet.", "अभी कोई entry नहीं।")}</p>}
        <ul className="divide-y divide-border">
          {d.txns.map((t) => {
            const kk = TXN_KINDS.find((x) => x.key === t.kind);
            const sign = t.kind === "issue" ? "+" : t.kind === "receive" ? "−" : "";
            return (
              <li key={t.id} className={`px-3 py-2 text-xs ${t.voided ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className={t.voided ? "line-through" : ""}>
                    <b>{kk ? (hi ? kk.hi : kk.en) : t.kind}</b> · {t.day}{t.metal !== "gold" && !t.paise ? ` · ${t.metal}` : ""}
                    <span className="block text-muted">{t.paise ? inr(t.paise) : `${grams(t.gross_mg)} @ ${t.touch_bp / 100}% = ${sign}${grams(t.fine_mg)} fine${t.wastage_mg ? ` · ${T("wastage", "वेस्टेज")} ${grams(t.wastage_mg)}` : ""}`}{t.note ? ` · ${t.note}` : ""}{t.created_by_name ? ` — ${t.created_by_name}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">{t.metal === "gold" && !t.paise && <b className="block">{grams(running[t.id] ?? 0)}</b>}{!t.voided && <button type="button" onClick={() => { setVoiding(voiding === t.id ? "" : t.id); setWhy(""); }} className="text-[10px] text-muted underline">{T("wrong?", "ग़लत?")}</button>}</span>
                </div>
                {voiding === t.id && (
                  <div className="mt-1 flex gap-1">
                    <input className="flex-1 rounded border border-border px-2 py-1" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={T("Why is it wrong?", "क्यों ग़लत है?")} />
                    <button type="button" disabled={!why.trim() || busy} onClick={async () => { if (await post({ void: t.id, reason: why })) setVoiding(""); }} className="rounded bg-danger px-2 py-1 font-semibold text-white disabled:opacity-50">{T("Void", "रद्द")}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default function KarigarPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Ledger /></Suspense>;
}
