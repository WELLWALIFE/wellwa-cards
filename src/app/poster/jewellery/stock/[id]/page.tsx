"use client";
// One piece: its label, where it is (in stock / on approval / sold on which bill / melted / returned), edit it, move it, print its label.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle, Pencil, Printer } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { StockForm, bodyOf, draftOf, type StockDraft } from "@/components/jewellery/stock-form";
import { StockLabel } from "@/components/jewellery/stock-label";
import { grams, inr, type JwSetup } from "@/lib/jewellery";
import type { JwAccess } from "@/lib/jewellery-types";
import { STOCK_STATUSES, type StockRow, type StockStatus } from "@/lib/jewellery-stock";

type Ans = { item: StockRow; bill: { id: string; code: string; customer_name: string } | null; setup: JwSetup; access: JwAccess; error?: string };

export default function StockPiece() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<StockDraft | null>(null);
  const [move, setMove] = useState<{ to: StockStatus; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const asQ = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";
  const load = useCallback(async () => {
    const r = await api<Ans>(`/api/jewellery/stock/${id}${asQ}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setD(r.data);
  }, [id, asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);
  const purity = useMemo(() => d?.setup.purities.find((p) => p.key === d.item.purity)?.label ?? d?.item.purity ?? "", [d]);

  async function patch(json: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const r = await api<{ item?: StockRow; error?: string }>(`/api/jewellery/stock/${id}`, { method: "PATCH", json: { as: ws.as || undefined, ...json } });
    setBusy(false);
    if (!r.ok || !r.data.item) { setMsg({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    setD((x) => (x ? { ...x, item: r.data.item! } : x)); setEdit(null); setMove(null);
    setMsg({ ok: true, t: T("✅ Saved.", "✅ Save हो गया।") });
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const s = d.item;
  const st = STOCK_STATUSES.find((x) => x.key === s.status);
  const it = d.setup.items.find((i) => i.key === s.item_type);
  const inp = "rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  const moves: [StockStatus, string][] = s.status === "sold" ? [] : ([
    ["in_stock", T("Back in stock", "वापस स्टॉक में")], ["approval", T("Out on approval", "पसंद के लिए दिया")],
    ["melted", T("Melted / broken", "गलाया / तोड़ा")], ["returned", T("Returned to supplier", "सप्लायर को वापस")],
  ] as [StockStatus, string][]).filter(([k]) => k !== s.status);

  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery/stock${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Stock", "स्टॉक")}</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">{s.tag} <span className="text-sm font-normal text-muted">· {it ? (hi ? it.hi : it.en) : s.item_type} {purity}</span></h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.status === "sold" ? "bg-good/15 text-good" : s.status === "in_stock" ? "bg-brand/10 text-brand-ink" : "bg-amber-100 text-amber-800"}`}>{st ? (hi ? st.hi : st.en) : s.status}</span>
      </div>
      {s.status === "sold" && d.bill && <p className="text-sm">{T("Sold on", "बिका —")} <Link href={`/poster/jewellery/bill/${d.bill.id}${asQ}`} className="font-semibold text-brand-ink">{d.bill.code}</Link>{d.bill.customer_name ? ` · ${d.bill.customer_name}` : ""}</p>}
      {s.status_note && <p className="text-xs text-muted">{s.status_note}</p>}

      <div className="overflow-x-auto rounded-2xl border border-border bg-white p-3"><StockLabel s={s} purity={purity} shop="" size="tag" /></div>

      {!edit && (
        <section className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-3 text-sm sm:grid-cols-4">
          <p><span className="block text-[11px] text-muted">{T("Gross", "कुल")}</span>{grams(s.gross_mg)}</p>
          <p><span className="block text-[11px] text-muted">{T("Stone", "नग")}</span>{grams(s.stone_mg)}{s.stone_paise ? ` · ${inr(s.stone_paise)}` : ""}</p>
          <p><span className="block text-[11px] text-muted">{T("Net", "शुद्ध")}</span><b>{grams(s.net_mg)}</b></p>
          <p><span className="block text-[11px] text-muted">HUID</span>{s.huid || "—"}</p>
          {s.size && <p><span className="block text-[11px] text-muted">{T("Size", "साइज़")}</span>{s.size}</p>}
          {s.counter && <p><span className="block text-[11px] text-muted">{T("Kept at", "कहाँ रखा")}</span>{s.counter}</p>}
          {s.source && <p><span className="block text-[11px] text-muted">{T("Came from", "कहाँ से")}</span>{s.source}</p>}
          {d.access.owner && s.cost_paise > 0 && <p><span className="block text-[11px] text-muted">{T("Cost", "लागत")}</span>{inr(s.cost_paise)}</p>}
          {s.descr && <p className="col-span-2"><span className="block text-[11px] text-muted">{T("Description", "विवरण")}</span>{s.descr}</p>}
          <p className="col-span-2 text-[11px] text-muted sm:col-span-4">{T("Added", "चढ़ाया")} {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{s.created_by_name ? ` · ${s.created_by_name}` : ""}</p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/poster/jewellery/stock/labels${amp}ids=${s.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold"><Printer className="h-4 w-4" /> {T("Print label", "लेबल छापें")}</Link>
        {s.status !== "sold" && !edit && <button type="button" onClick={() => setEdit(draftOf(s, d.setup))} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold"><Pencil className="h-4 w-4" /> {T("Edit", "बदलें")}</button>}
      </div>

      {edit && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-3">
          <StockForm d={edit} set={(p) => setEdit({ ...edit, ...p })} setup={d.setup} owner={d.access.owner} hi={hi} />
          <p className="text-[11px] text-muted">{T("The tag number stays as printed.", "टैग नंबर वही रहेगा जो छपा है।")}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void patch({ action: "edit", ...bodyOf(edit) })} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Save", "Save")}</button>
            <button type="button" onClick={() => setEdit(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">{T("Close", "बंद")}</button>
          </div>
        </section>
      )}

      {moves.length > 0 && !edit && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3">
          <h2 className="text-sm font-bold">{T("Move this piece", "इस पीस को")}</h2>
          <div className="flex flex-wrap gap-2">{moves.map(([k, l]) => <button key={k} type="button" onClick={() => setMove({ to: k, note: "" })} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${move?.to === k ? "border-brand bg-brand/10" : "border-border"}`}>{l}</button>)}</div>
          {move && (
            <div className="flex flex-wrap gap-2">
              <input className={`${inp} min-w-0 flex-1`} value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} placeholder={move.to === "approval" ? T("Given to whom (name, mobile)?", "किसे दिया (नाम, मोबाइल)?") : move.to === "in_stock" ? T("Note (optional)", "नोट (optional)") : T("Why?", "क्यों?")} />
              <button type="button" disabled={busy} onClick={() => void patch({ action: "move", status: move.to, note: move.note })} className="rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Save", "Save")}</button>
            </div>
          )}
        </section>
      )}
      {s.status === "sold" && <p className="text-xs text-muted">{T("A sold piece comes back to stock only when its bill is cancelled.", "बिका हुआ पीस बिल रद्द करने पर ही स्टॉक में लौटता है।")}</p>}
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-good" : "text-danger"}`}>{msg.t}</p>}
    </div>
  );
}
