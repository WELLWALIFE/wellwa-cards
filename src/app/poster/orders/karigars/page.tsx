"use client";
// Karigars of the shop and their cloth account: pieces / metres given and taken back, and the jobs they hold now.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LoaderCircle, Phone, Plus } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import type { Karigar } from "@/lib/jobs";
import { useWorkspace } from "@/components/orders/orders-common";

type Ledger = Record<string, { piecesOut: number; piecesIn: number; metersOut: number; metersIn: number; openJobs: number }>;

export default function KarigarsPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [ks, setKs] = useState<Karigar[] | null>(null);
  const [ledger, setLedger] = useState<Ledger>({});
  const [f, setF] = useState({ name: "", phone: "", skill: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/orders/karigars"); return; }
    const r = await api<{ karigars: Karigar[]; ledger: Ledger; error?: string }>(`/api/jobs/karigars${ws.q ? `?${ws.q}` : ""}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || T("Could not load.", "Load नहीं हुआ।")); setKs([]); return; }
    setKs(r.data.karigars); setLedger(r.data.ledger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.q, router]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setErr(""); setBusy(true);
    const r = await api<{ error?: string }>("/api/jobs/karigars", { method: "POST", json: { as: ws.as || undefined, ...f } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || T("Could not save.", "सेव नहीं हुआ।")); return; }
    setF({ name: "", phone: "", skill: "" }); void load();
  }
  async function toggle(k: Karigar) {
    await api("/api/jobs/karigars", { method: "PATCH", json: { as: ws.as || undefined, id: k.id, active: !k.active } });
    void load();
  }
  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";
  if (!ks) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-2"><Link href="/poster/orders" className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></Link><h1 className="text-lg font-bold">{T("Karigars", "कारीगर")}</h1></div>
      <section className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <p className="text-sm font-bold">{T("Add a karigar", "कारीगर जोड़ें")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={field} placeholder={T("Name", "नाम")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={field} placeholder={T("Mobile", "मोबाइल")} inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <input className={field} placeholder={T("Work (fall-pico, blouse…)", "काम (fall-pico, blouse…)")} value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} />
        </div>
        {err && <p className="text-xs font-semibold text-danger">{err}</p>}
        <button type="button" onClick={() => void add()} disabled={busy || !f.name.trim()} className="inline-flex items-center gap-1 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {T("Add", "जोड़ें")}</button>
        <p className="text-[11px] text-muted">{T("Tailors and masters who use the app themselves are added in Orders → Staff & logins.", "जो tailor / master खुद app चलाएँगे, उन्हें Orders → Staff · login में जोड़ें।")}</p>
      </section>
      <ul className="space-y-2">
        {ks.map((k) => {
          const l = ledger[k.id] ?? { piecesOut: 0, piecesIn: 0, metersOut: 0, metersIn: 0, openJobs: 0 };
          const pcs = l.piecesOut - l.piecesIn, mtr = Math.round((l.metersOut - l.metersIn) * 100) / 100;
          return (
            <li key={k.id} className={`rounded-2xl border border-border bg-surface p-4 shadow-card ${k.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <b className="flex-1 text-sm">{k.name}{k.skill && <span className="font-normal text-muted"> · {k.skill}</span>}</b>
                {k.phone && <a href={`tel:${k.phone}`} className="inline-flex items-center gap-1 text-xs text-brand-ink"><Phone className="h-3.5 w-3.5" /> {k.phone}</a>}
                <button type="button" onClick={() => void toggle(k)} className="text-xs text-muted underline">{k.active ? T("Stop", "बंद करें") : T("Start again", "फिर चालू")}</button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <p className="rounded-xl bg-bg p-2"><b className="block text-base">{l.openJobs}</b>{T("jobs with them", "job उनके पास")}</p>
                <p className="rounded-xl bg-bg p-2"><b className={`block text-base ${pcs > 0 ? "text-amber-700" : ""}`}>{pcs}</b>{T("pieces still out", "pieces अभी बाहर")}</p>
                <p className="rounded-xl bg-bg p-2"><b className={`block text-base ${mtr > 0 ? "text-amber-700" : ""}`}>{mtr}</b>{T("metres still out", "मीटर अभी बाहर")}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
