"use client";
// CRM Pro phase 3 screens (docs/crm-pro.md 3.9–3.11, 3.14): the customer's Sales tab (sales + quotations), the
// New-sale and New-quotation sheets, Duplicates (find + merge), phone-contacts import and the team leaderboard.
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Trash2, FileText, Send, Check, Users, Contact, Trophy, IndianRupee } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useShell, inputCls, Chip, BottomSheet, Avatar, StagePill, fmtDay, ago, type LeadPro } from "@/components/crm/shared";

type Product = { id: string; name: string; price_paise: number; photo_url: string | null };
type Item = { product_id?: string | null; name: string; qty: number; rate_paise: number; discount_pct?: number };
type Sale = { id: string; lead_id: string; items: Item[]; amount_paise: number; paid_paise: number; status: string; method: string; sold_at: string; note: string };
type Quote = { id: string; number: string; items: Item[]; subtotal_paise: number; discount_paise: number; gst_pct: number; total_paise: number; valid_till: string | null; pdf_url: string | null; status: string; sale_id: string | null; created_at: string };
const rs = (p: number) => "₹" + (Math.round(p) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const toPaise = (v: string) => Math.round((parseFloat(v.replace(/[^\d.]/g, "")) || 0) * 100);

let productCache: Product[] | null = null;
function useProducts() {
  const { as } = useShell();
  const [ps, setPs] = useState<Product[]>(productCache ?? []);
  useEffect(() => { if (productCache) return; api<{ products: Product[] }>(`/api/crm/products${as ? `?as=${as}` : ""}`).then((r) => { if (r.ok) { productCache = r.data.products; setPs(r.data.products); } }); }, [as]);
  return ps;
}

/* ---------------- line items editor (sale + quote) ---------------- */
function Items({ items, setItems, withDiscount }: { items: Item[]; setItems: (x: Item[]) => void; withDiscount?: boolean }) {
  const { L } = useShell();
  const products = useProducts();
  const hi = L.hi;
  const add = (p?: Product) => setItems([...items, { product_id: p?.id ?? null, name: p?.name ?? "", qty: 1, rate_paise: p?.price_paise ?? 0 }]);
  const set = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {products.length > 0 && <div className="flex flex-wrap gap-1.5">{products.slice(0, 30).map((p) => <Chip key={p.id} onClick={() => add(p)}>+ {p.name}{p.price_paise ? ` · ${rs(p.price_paise)}` : ""}</Chip>)}</div>}
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-border p-2">
          <div className="flex gap-1.5"><input value={it.name} onChange={(e) => set(i, { name: e.target.value })} placeholder={hi ? "सामान / सेवा" : "Item"} className={inputCls + " py-1.5"} /><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1 text-muted" aria-label="x"><Trash2 className="h-4 w-4" /></button></div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[11px] text-muted">
            <label>{hi ? "मात्रा" : "Qty"}<input value={it.qty} onChange={(e) => set(i, { qty: Math.max(0, parseFloat(e.target.value) || 0) })} inputMode="decimal" className={inputCls + " py-1"} /></label>
            <label>{hi ? "दर ₹" : "Rate ₹"}<input value={it.rate_paise ? it.rate_paise / 100 : ""} onChange={(e) => set(i, { rate_paise: toPaise(e.target.value) })} inputMode="decimal" className={inputCls + " py-1"} /></label>
            {withDiscount ? <label>{hi ? "छूट %" : "Disc %"}<input value={it.discount_pct ?? ""} onChange={(e) => set(i, { discount_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} inputMode="decimal" className={inputCls + " py-1"} /></label>
              : <div className="self-end pb-1.5 text-right font-semibold text-ink">{rs(it.qty * it.rate_paise)}</div>}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => add()} className="inline-flex items-center gap-1 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted"><Plus className="h-3.5 w-3.5" /> {hi ? "सामान जोड़ें" : "Add item"}</button>
    </div>
  );
}
const total = (items: Item[]) => items.reduce((n, i) => n + Math.round(i.qty * i.rate_paise * (1 - (i.discount_pct ?? 0) / 100)), 0);

/* ---------------- New sale ---------------- */
export function SaleSheet({ leadId, onClose, onSaved }: { leadId: string; onClose: () => void; onSaved: () => void }) {
  const { L, as } = useShell();
  const hi = L.hi;
  const [items, setItems] = useState<Item[]>([]);
  const [amount, setAmount] = useState("");
  const [paidAll, setPaidAll] = useState(true);
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("upi");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sum = items.length ? total(items) : toPaise(amount);
  async function save() {
    if (sum <= 0 || busy) return; setBusy(true); setErr("");
    const r = await api<{ error?: string }>("/api/crm/sales", { method: "POST", json: { lead_id: leadId, as: as ?? undefined, items, amount_paise: items.length ? undefined : sum, paid_paise: paidAll ? sum : toPaise(paid), method, note } });
    setBusy(false); if (!r.ok) { setErr(r.data.error || L.failed); return; } onSaved(); onClose();
  }
  return (
    <BottomSheet title={hi ? "क्या बिका?" : "What was sold?"} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Items items={items} setItems={setItems} />
        {!items.length && <label className="block text-xs text-muted">{hi ? "या सिर्फ़ रकम ₹" : "Or just the amount ₹"}<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="25000" className={inputCls} /></label>}
        <div className="rounded-xl bg-surface2/60 px-3 py-2 text-right text-base font-bold text-ink">{rs(sum)}</div>
        <div className="flex flex-wrap gap-1.5">{[["upi", "UPI"], ["cash", hi ? "नकद" : "Cash"], ["card", "Card"], ["bank", hi ? "बैंक" : "Bank"], ["other", hi ? "और" : "Other"]].map(([k, t]) => <Chip key={k} on={method === k} onClick={() => setMethod(k)}>{t}</Chip>)}</div>
        <label className="flex items-center gap-2 text-xs text-ink"><input type="checkbox" checked={paidAll} onChange={(e) => setPaidAll(e.target.checked)} /> {hi ? "पूरा पैसा मिल गया" : "Paid in full"}</label>
        {!paidAll && <label className="block text-xs text-muted">{hi ? "अभी कितना मिला ₹" : "Paid now ₹"}<input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className={inputCls} /></label>}
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder={hi ? "Note (बिल नंबर, delivery…)" : "Note (bill no., delivery…)"} className={inputCls} />
        {err && <p className="text-xs text-danger">{err}</p>}
        <button type="button" disabled={sum <= 0 || busy} onClick={save} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {hi ? "बिक्री सेव करें (Won)" : "Save sale (Won)"}</button>
      </div>
    </BottomSheet>
  );
}

/* ---------------- New quotation ---------------- */
export function QuoteSheet({ lead, onClose, onSaved }: { lead: Pick<LeadPro, "id" | "name" | "phone">; onClose: () => void; onSaved: () => void }) {
  const { L, as, ws } = useShell();
  const hi = L.hi;
  const [items, setItems] = useState<Item[]>([]);
  const [disc, setDisc] = useState("");
  const [gst, setGst] = useState(0);
  const [days, setDays] = useState(15);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "make" | "send">("");
  const [err, setErr] = useState("");
  const [made, setMade] = useState<Quote | null>(null);
  const sub = total(items), d = Math.min(sub, toPaise(disc)), grand = Math.round((sub - d) * (1 + gst / 100));
  async function make() {
    if (!items.length || busy) return; setBusy("make"); setErr("");
    const r = await api<{ quote: Quote; error?: string }>("/api/crm/quotes", { method: "POST", json: { lead_id: lead.id, as: as ?? undefined, items, discount_paise: d, gst_pct: gst, valid_days: days, note } });
    setBusy(""); if (!r.ok) { setErr(r.data.error || L.failed); return; } setMade(r.data.quote); onSaved();
  }
  async function send() {
    if (!made?.pdf_url || busy) return; setBusy("send"); setErr("");
    const first = (lead.name || "").split(/\s+/)[0] || "";
    const r = await api<{ error?: string }>("/api/crm/send", { method: "POST", json: { lead_id: lead.id, as: as ?? undefined, fileUrl: made.pdf_url, fileName: `${made.number}.pdf`, text: hi ? `${first ? `${first} जी, ` : ""}आपका कोटेशन ${made.number} — कुल ${rs(made.total_paise)}। कोई सवाल हो तो बताइए 🙏` : `${first ? `${first}, ` : ""}your quotation ${made.number} — total ${rs(made.total_paise)}. Any questions, just reply 🙏` } });
    if (!r.ok) { setBusy(""); setErr(r.data.error || L.failed); return; }
    await api("/api/crm/quotes", { method: "PATCH", json: { id: made.id, as: as ?? undefined, status: "sent" } });
    setBusy(""); onSaved(); onClose();
  }
  return (
    <BottomSheet title={made ? made.number : hi ? "नया कोटेशन" : "New quotation"} onClose={onClose}>
      {made ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-xl bg-good/10 px-3 py-2 text-good">✓ {made.number} · {rs(made.total_paise)}</p>
          {made.pdf_url ? <a href={made.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-ink"><FileText className="h-4 w-4 text-brand" /> PDF</a> : <p className="text-xs text-muted">{hi ? "PDF नहीं बन पाई — quotation सेव है।" : "The PDF could not be made — the quotation is saved."}</p>}
          {err && <p className="text-xs text-danger">{err}</p>}
          <button type="button" disabled={!made.pdf_url || ws.wa !== "connected" || !!busy} onClick={send} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white disabled:opacity-50">{busy === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {hi ? "WhatsApp पर भेजें" : "Send on WhatsApp"}</button>
          {ws.wa !== "connected" && <p className="text-[11px] text-muted">{L.waNotLinked}</p>}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <Items items={items} setItems={setItems} withDiscount />
          <div className="grid grid-cols-3 gap-2 text-[11px] text-muted">
            <label>{hi ? "कुल छूट ₹" : "Discount ₹"}<input value={disc} onChange={(e) => setDisc(e.target.value)} inputMode="decimal" className={inputCls + " py-1.5"} /></label>
            <label>GST %<select value={gst} onChange={(e) => setGst(Number(e.target.value))} className={inputCls + " py-1.5"}>{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
            <label>{hi ? "मान्य (दिन)" : "Valid (days)"}<input value={days} onChange={(e) => setDays(Math.max(1, parseInt(e.target.value || "15", 10)))} inputMode="numeric" className={inputCls + " py-1.5"} /></label>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={2} placeholder={hi ? "शर्तें / note (delivery, warranty…)" : "Terms / note (delivery, warranty…)"} className={inputCls} />
          <div className="rounded-xl bg-surface2/60 px-3 py-2 text-xs"><div className="flex justify-between"><span>{hi ? "कुल" : "Subtotal"}</span><span>{rs(sub)}</span></div>{d > 0 && <div className="flex justify-between"><span>{hi ? "छूट" : "Discount"}</span><span>− {rs(d)}</span></div>}{gst > 0 && <div className="flex justify-between"><span>GST {gst}%</span><span>{rs(Math.round((sub - d) * gst / 100))}</span></div>}<div className="mt-1 flex justify-between border-t border-border pt-1 text-base font-bold text-ink"><span>{hi ? "कुल देय" : "Total"}</span><span>{rs(grand)}</span></div></div>
          {err && <p className="text-xs text-danger">{err}</p>}
          <button type="button" disabled={!items.length || !!busy} onClick={make} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white disabled:opacity-50">{busy === "make" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {hi ? "कोटेशन PDF बनाएँ" : "Make quotation PDF"}</button>
        </div>
      )}
    </BottomSheet>
  );
}

/* ---------------- the customer's Sales tab ---------------- */
export function SalesTab({ lead, onChanged }: { lead: LeadPro; onChanged: () => void }) {
  const { L, as, ctx } = useShell();
  const hi = L.hi;
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sheet, setSheet] = useState<"" | "sale" | "quote">("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const q = as ? `&as=${as}` : "";
    const [s, qs] = await Promise.all([api<{ sales: Sale[] }>(`/api/crm/sales?lead=${lead.id}${q}`), api<{ quotes: Quote[] }>(`/api/crm/quotes?lead=${lead.id}${q}`)]);
    setSales(s.ok ? s.data.sales : []); setQuotes(qs.ok ? qs.data.quotes : []);
  }, [lead.id, as]);
  useEffect(() => { load(); }, [load]);
  const changed = () => { load(); onChanged(); };
  async function quoteStatus(id: string, status: string) { setBusy(id); await api("/api/crm/quotes", { method: "PATCH", json: { id, as: as ?? undefined, status } }); setBusy(""); changed(); }
  async function markPaid(s: Sale) { setBusy(s.id); await api("/api/crm/sales", { method: "PATCH", json: { id: s.id, as: as ?? undefined, paid_paise: s.amount_paise } }); setBusy(""); changed(); }
  const revenue = (sales ?? []).filter((s) => s.status !== "refunded").reduce((n, s) => n + s.amount_paise, 0);
  const due = (sales ?? []).filter((s) => s.status !== "refunded").reduce((n, s) => n + (s.amount_paise - s.paid_paise), 0);
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSheet("sale")} className="grad-brand inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white"><IndianRupee className="h-4 w-4" /> {hi ? "नई बिक्री" : "New sale"}</button>
        <button type="button" onClick={() => setSheet("quote")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface py-2.5 text-xs font-semibold text-ink"><FileText className="h-4 w-4 text-brand" /> {hi ? "कोटेशन" : "Quotation"}</button>
      </div>
      {sales === null ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" /> : (
        <>
          {(revenue > 0 || due > 0) && <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-border p-2"><div className="text-[10px] uppercase text-muted">{hi ? "कुल बिक्री" : "Total sales"}</div><div className="text-lg font-bold text-ink">{rs(revenue)}</div></div><div className="rounded-xl border border-border p-2"><div className="text-[10px] uppercase text-muted">{hi ? "बाकी पैसा" : "Due"}</div><div className={`text-lg font-bold ${due ? "text-danger" : "text-ink"}`}>{rs(due)}</div></div></div>}
          {sales.map((s) => (
            <div key={s.id} className="rounded-xl border border-border p-2.5 text-xs">
              <div className="flex items-center gap-2"><b className="text-ink">🧾 {rs(s.amount_paise)}</b><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${s.status === "paid" ? "bg-good/15 text-good" : s.status === "refunded" ? "bg-surface2 text-faint" : "bg-lead/15 text-lead"}`}>{s.status === "paid" ? (hi ? "पूरा मिला" : "paid") : s.status === "partial" ? `${rs(s.paid_paise)} ${hi ? "मिला" : "paid"}` : s.status === "refunded" ? (hi ? "वापस" : "refunded") : hi ? "बाकी" : "due"}</span><span className="ml-auto text-faint">{fmtDay(s.sold_at, hi)}{s.method ? ` · ${s.method}` : ""}</span></div>
              {s.items.length > 0 && <p className="mt-1 text-muted">{s.items.map((i) => `${i.name}${i.qty !== 1 ? ` ×${i.qty}` : ""}`).join(", ")}</p>}
              {s.note && <p className="text-muted">{s.note}</p>}
              {(s.status === "open" || s.status === "partial") && ctx.role !== "agent" && <button type="button" disabled={busy === s.id} onClick={() => markPaid(s)} className="mt-1.5 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-good">{hi ? "पूरा पैसा मिल गया" : "Mark paid"}</button>}
            </div>
          ))}
          {quotes.length > 0 && <p className="pt-1 text-[11px] font-semibold uppercase text-muted">{hi ? "कोटेशन" : "Quotations"}</p>}
          {quotes.map((q) => (
            <div key={q.id} className="rounded-xl border border-border p-2.5 text-xs">
              <div className="flex items-center gap-2"><b className="text-ink">📄 {q.number}</b><span>{rs(q.total_paise)}</span><span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{q.status}</span><span className="ml-auto text-faint">{ago(q.created_at, hi)}</span></div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {q.pdf_url && <a href={q.pdf_url} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2 py-1 text-[11px] text-ink">PDF</a>}
                {!["accepted", "rejected"].includes(q.status) && <button type="button" disabled={busy === q.id} onClick={() => quoteStatus(q.id, "accepted")} className="rounded-lg border border-good/40 px-2 py-1 text-[11px] font-semibold text-good">{hi ? "मान लिया → बिक्री" : "Accepted → sale"}</button>}
                {!["accepted", "rejected"].includes(q.status) && <button type="button" disabled={busy === q.id} onClick={() => quoteStatus(q.id, "rejected")} className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted">{hi ? "नहीं माना" : "Rejected"}</button>}
              </div>
            </div>
          ))}
          {!sales.length && !quotes.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">{hi ? "अभी कोई बिक्री या कोटेशन नहीं।" : "No sales or quotations yet."}</p>}
        </>
      )}
      {sheet === "sale" && <SaleSheet leadId={lead.id} onClose={() => setSheet("")} onSaved={changed} />}
      {sheet === "quote" && <QuoteSheet lead={lead} onClose={() => setSheet("")} onSaved={changed} />}
    </div>
  );
}

/* ---------------- duplicates ---------------- */
type DupLead = { id: string; name: string; phone: string; city: string; status: string; created_at: string; last_activity_at: string; unread: number; calls_count: number; value_paise: number };
export function DuplicatesSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { L, as } = useShell();
  const hi = L.hi;
  const [groups, setGroups] = useState<{ why: string; leads: DupLead[] }[] | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(async () => { const r = await api<{ groups: { why: string; leads: DupLead[] }[] }>(`/api/crm/duplicates${as ? `?as=${as}` : ""}`); setGroups(r.ok ? r.data.groups : []); }, [as]);
  useEffect(() => { load(); }, [load]);
  // The one with a real number (and more history) is kept; the others fold into it.
  const keeper = (g: DupLead[]) => [...g].sort((a, b) => Number(/^\+\d{11,15}$/.test(b.phone)) - Number(/^\+\d{11,15}$/.test(a.phone)) || b.calls_count - a.calls_count || (a.created_at < b.created_at ? -1 : 1))[0];
  async function mergeGroup(g: DupLead[], key: string) {
    setBusy(key); setErr("");
    const k = keeper(g);
    for (const d of g) if (d.id !== k.id) { const r = await api<{ error?: string }>("/api/crm/merge", { method: "POST", json: { keep: k.id, drop: d.id, as: as ?? undefined } }); if (!r.ok) { setErr(r.data.error || L.failed); break; } }
    setBusy(""); load(); onChanged();
  }
  async function mergeAll() {
    if (!groups) return;
    for (let i = 0; i < groups.length; i += 1) await mergeGroup(groups[i].leads, `g${i}`);
  }
  return (
    <BottomSheet title={hi ? "एक ही ग्राहक दो बार" : "Duplicate customers"} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted">{hi ? "WhatsApp कभी-कभी नंबर छुपा देता है, तो एक ही इंसान दो बार आ जाता है। मिलाने पर chat, calls, tasks, बिक्री सब एक में आ जाते हैं; असली नंबर वाला रखा जाता है।" : "WhatsApp sometimes hides a number, so one person arrives twice. Merging moves chats, calls, tasks and sales into one; the one with the real number is kept."}</p>
        {groups === null ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" /> : groups.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">{hi ? "कोई duplicate नहीं 👍" : "No duplicates 👍"}</p> : (
          <>
            <button type="button" disabled={!!busy} onClick={mergeAll} className="grad-brand w-full rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-50">{hi ? `सब ${groups.length} मिला दें` : `Merge all ${groups.length}`}</button>
            {groups.map((g, i) => { const k = keeper(g.leads); return (
              <div key={i} className="rounded-xl border border-border p-2.5">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted"><span>{g.why === "phone" ? (hi ? "एक ही नंबर" : "Same number") : (hi ? "एक ही नाम, नंबर छुपा" : "Same name, hidden number")}</span><button type="button" disabled={!!busy} onClick={() => mergeGroup(g.leads, `g${i}`)} className="rounded-lg border border-brand px-2 py-1 font-semibold text-brand-ink">{busy === `g${i}` ? <LoaderCircle className="h-3 w-3 animate-spin" /> : hi ? "मिलाएँ" : "Merge"}</button></div>
                {g.leads.map((l) => <div key={l.id} className="flex items-center gap-2 py-1 text-xs"><Avatar name={l.name} phone={l.phone} size={7} /><div className="min-w-0 flex-1"><p className="truncate font-semibold text-ink">{l.name || "—"} {l.id === k.id && <span className="text-good">✓ {hi ? "रखेंगे" : "keep"}</span>}</p><p className="truncate text-muted">{/^\+\d/.test(l.phone) ? l.phone : hi ? "नंबर छुपा" : "hidden number"} · {ago(l.last_activity_at, hi)}</p></div><StagePill status={l.status} hi={hi} /></div>)}
              </div>
            ); })}
          </>
        )}
        {err && <p className="text-xs text-danger">{err}</p>}
      </div>
    </BottomSheet>
  );
}

/* ---------------- phone contacts import (Contact Picker API: Android Chrome / the app's WebView) ---------------- */
type PickedContact = { name?: string[]; tel?: string[] };
export function ContactsImport({ onDone }: { onDone: () => void }) {
  const { L, as, ctx } = useShell();
  const hi = L.hi;
  const [res, setRes] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;
  if (ctx.role === "agent") return null;
  async function pick() {
    setRes("");
    try {
      const nav = navigator as unknown as { contacts: { select: (p: string[], o: { multiple: boolean }) => Promise<PickedContact[]> } };
      const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
      const leads = picked.flatMap((c) => (c.tel?.[0] ? [{ name: c.name?.[0] ?? "", phone: c.tel[0], city: "", tags: ["contacts"], note: "" }] : []));
      if (!leads.length) return;
      setBusy(true);
      const r = await api<{ added: number; skipped: number; error?: string }>("/api/crm/lead", { method: "POST", json: { as: as ?? undefined, leads } });
      setBusy(false);
      setRes(r.ok ? (hi ? `✓ ${r.data.added} जोड़े${r.data.skipped ? `, ${r.data.skipped} पहले से थे` : ""}` : `✓ ${r.data.added} added${r.data.skipped ? `, ${r.data.skipped} already there` : ""}`) : r.data.error || L.failed);
      if (r.ok) onDone();
    } catch { setBusy(false); }
  }
  return (
    <div>
      <button type="button" disabled={!supported || busy} onClick={pick} className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm text-ink disabled:opacity-60"><Contact className="h-4 w-4 text-brand" />{hi ? "फ़ोन के contacts से जोड़ें" : "Add from phone contacts"}{busy && <LoaderCircle className="ml-auto h-4 w-4 animate-spin" />}</button>
      {!supported && <p className="mt-1 text-[11px] text-muted">{hi ? "यह Android phone के Chrome / Shubhora app में चलता है। Laptop पर Import (CSV) इस्तेमाल करें।" : "Works in Chrome / the Shubhora app on an Android phone. On a laptop use Import (CSV)."}</p>}
      {res && <p className="mt-1 text-xs font-semibold text-brand-ink">{res}</p>}
    </div>
  );
}

/* ---------------- leaderboard ---------------- */
type Row = { id: string; calls: number; connected: number; won: number; revenue: number; tasksDone: number };
export function Leaderboard({ days }: { days: number }) {
  const { L, as, ctx } = useShell();
  const hi = L.hi;
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { api<{ board: Row[] }>(`/api/crm/leaderboard?days=${days}${as ? `&as=${as}` : ""}`).then((r) => setRows(r.ok ? r.data.board : [])); }, [days, as]);
  const name = useMemo(() => (id: string) => (id === ctx.me ? (hi ? "मैं" : "me") : ctx.agents.find((a) => a.id === id)?.name ?? (hi ? "मालिक" : "owner")), [ctx, hi]);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted"><Trophy className="h-3.5 w-3.5 text-lead" /> {hi ? "Leaderboard" : "Leaderboard"}{ctx.agents.length === 0 && <Users className="ml-auto h-3.5 w-3.5" />}</div>
      <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase text-faint"><th className="py-1">#</th><th>{hi ? "कौन" : "Who"}</th><th>{L.callsReport}</th><th>{L.callsConnected}</th><th>{L.won}</th><th className="text-right">₹</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id} className="border-t border-border"><td className="py-1.5">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td><td className="font-semibold text-ink">{name(r.id)}</td><td>{r.calls}</td><td>{r.connected}</td><td>{r.won}</td><td className="text-right">{r.revenue ? rs(r.revenue) : "—"}</td></tr>)}</tbody></table>
    </div>
  );
}
