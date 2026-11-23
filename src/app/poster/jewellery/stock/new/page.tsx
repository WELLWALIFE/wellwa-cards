"use client";
// Add stock: one piece at a time, fast — type and purity stay for the next piece, the weights clear; every piece gets its tag at
// once, and the pieces added here can go to the label printer together.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle, Printer } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { StockForm, bodyOf, draftOf, type StockDraft } from "@/components/jewellery/stock-form";
import { grams, type JwSetup } from "@/lib/jewellery";
import type { JwAccess } from "@/lib/jewellery-types";
import type { StockRow } from "@/lib/jewellery-stock";

type Home = { setup: JwSetup; access: JwAccess; error?: string };

export default function NewStock() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [h, setH] = useState<Home | null>(null);
  const [d, setDraft] = useState<StockDraft | null>(null);
  const [added, setAdded] = useState<StockRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const load = useCallback(async () => {
    const r = await api<Home>(`/api/jewellery${ws.q ? `?${ws.q}` : ""}`);
    if (!r.ok) { setMsg({ ok: false, t: r.data?.error || "Could not load." }); return; }
    setH(r.data); setDraft((x) => x ?? draftOf(null, r.data.setup));
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function save() {
    if (!d || !h) return;
    setBusy(true); setMsg(null);
    const r = await api<{ item?: StockRow; error?: string }>("/api/jewellery/stock", { method: "POST", json: { as: ws.as || undefined, ...bodyOf(d) } });
    setBusy(false);
    if (!r.ok || !r.data.item) { setMsg({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    setAdded((a) => [r.data.item!, ...a]);
    setMsg({ ok: true, t: `✅ ${T("Saved — tag", "Save हुआ — टैग")} ${r.data.item.tag}` });
    // The next piece: same type, purity, place and source; fresh weights and HUID.
    setDraft(draftOf(null, h.setup, { item_type: d.item_type, purity: d.purity, counter: d.counter, source: d.source, descr: d.descr }));
  }

  const q = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";
  if (!h || !d) return <div className="grid place-items-center py-24">{msg ? <p className="text-danger">{msg.t}</p> : <LoaderCircle className="h-6 w-6 animate-spin text-muted" />}</div>;
  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery/stock${q}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Stock", "स्टॉक")}</Link>
      <h1 className="text-lg font-bold">{T("Add stock", "स्टॉक चढ़ाएँ")}</h1>
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
        <StockForm d={d} set={(p) => setDraft({ ...d, ...p })} setup={h.setup} owner={h.access.owner} hi={hi} />
        <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Save and add the next", "Save करें और अगला")}</button>
        {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-good" : "text-danger"}`}>{msg.t}</p>}
      </section>
      {added.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{T(`Added now (${added.length})`, `अभी चढ़ाए (${added.length})`)}</h2>
            <Link href={`/poster/jewellery/stock/labels${amp}ids=${added.map((a) => a.id).join(",")}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"><Printer className="h-3.5 w-3.5" /> {T("Print their labels", "इनके लेबल छापें")}</Link>
          </div>
          <ul className="divide-y divide-border text-sm">
            {added.map((a) => <li key={a.id} className="flex justify-between py-1.5"><Link href={`/poster/jewellery/stock/${a.id}${q}`} className="font-semibold text-brand-ink">{a.tag}</Link><span className="tabular-nums text-muted">{grams(a.gross_mg)}{a.huid ? ` · ${a.huid}` : ""}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
