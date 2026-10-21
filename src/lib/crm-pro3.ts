// CRM Pro phase 3 (docs/crm-pro.md 3.9–3.11, 3.14): duplicates + merge, sales, quotations (PDF), the products a
// customer can buy, and the team leaderboard. Scoped like phases 1–2: owner id + role from resolveScope.
import { restAsService } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { addEvent, type Scope } from "@/lib/crm-server";
import { cardOf, businessOf, hindiCard } from "@/lib/customer-send";
import { htmlToPdf } from "@/lib/render-page";
import { isUuid, scopeFilter } from "@/lib/crm-pro";

const list = <T,>(r: { data: T[] | null }): T[] => (Array.isArray(r.data) ? r.data : []);
const enc = encodeURIComponent;
const last10 = (p: string) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const normName = (n: string) => String(n ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const rupeesOf = (p: number) => "₹" + (Math.round(p) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/* ---------------- duplicates + merge ---------------- */
export type DupLead = { id: string; name: string; phone: string; city: string; status: string; created_at: string; last_activity_at: string; unread: number; calls_count: number; value_paise: number };
export type DupGroup = { why: "phone" | "name"; leads: DupLead[] };
/** Leads that look like one person: the same last 10 digits, or the same name (3+ letters) with one of them having no
 *  real number (WhatsApp "hidden number" ids are what usually splits a person in two). */
export async function duplicates(scope: Scope): Promise<DupGroup[]> {
  const rows = list(await restAsService<DupLead[]>(`leads?${scopeFilter(scope)}&select=id,name,phone,city,status,created_at,last_activity_at,unread,calls_count,value_paise&order=created_at&limit=5000`));
  const groups: DupGroup[] = [];
  const used = new Set<string>();
  const byPhone = new Map<string, DupLead[]>();
  for (const l of rows) { const k = last10(l.phone); if (k) byPhone.set(k, [...(byPhone.get(k) ?? []), l]); }
  for (const g of byPhone.values()) if (g.length > 1) { groups.push({ why: "phone", leads: g }); g.forEach((l) => used.add(l.id)); }
  const byName = new Map<string, DupLead[]>();
  // Names the app writes itself are placeholders for different people, never one person.
  const PLACEHOLDER = /^(card chat visitor|caller|unknown|visitor|customer|guest|no|n a|na)$/;
  for (const l of rows) { if (used.has(l.id)) continue; const k = normName(l.name); if (k.replace(/\s/g, "").length >= 3 && !PLACEHOLDER.test(k)) byName.set(k, [...(byName.get(k) ?? []), l]); }
  for (const g of byName.values()) {
    if (g.length < 2 || g.length > 6) continue;                          // a common name used by many people is not a duplicate
    const real = g.filter((l) => /^\+\d{11,15}$/.test(l.phone));
    if (real.length <= 1) groups.push({ why: "name", leads: g });         // at most one real number → most likely one person
  }
  return groups.slice(0, 200);
}
/** Merge `drop` into `keep` (both must be in this workspace). Owner / manager only. */
export async function merge(scope: Scope, keep: string, drop: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (scope.role === "agent") return { ok: false, error: "Only the owner or a manager can merge." };
  if (!isUuid(keep) || !isUuid(drop) || keep === drop) return { ok: false, error: "Pick two different customers." };
  const r = await restAsService<string>("rpc/crm_merge_leads", { method: "POST", body: JSON.stringify({ p_owner: scope.ownerId, p_keep: keep, p_drop: drop }) });
  if (!r.ok) return { ok: false, error: /NOT_FOUND/.test(r.text) ? "Customer not found." : /does not exist|function/.test(r.text) ? "Run migration 0070 first." : "Could not merge. Please try again." };
  return { ok: true };
}

/* ---------------- products (for sales and quotes) ---------------- */
export type ProductLite = { id: string; name: string; price_paise: number; photo_url: string | null };
const pricePaise = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
export async function productsOf(ownerId: string): Promise<ProductLite[]> {
  let r = await restAsService<{ id: string; name: string; price: string | null; photo_url: string | null }[]>(`poster_products?user_id=eq.${ownerId}&active=eq.true&select=id,name,price,photo_url&order=sort,created_at&limit=200`);
  if (!r.ok) r = await restAsService(`poster_products?user_id=eq.${ownerId}&active=eq.true&select=id,name,photo_url&order=sort,created_at&limit=200`);
  return list(r).map((p) => ({ id: p.id, name: p.name, price_paise: pricePaise(p.price), photo_url: p.photo_url }));
}

/* ---------------- sales ---------------- */
export type SaleItem = { product_id?: string | null; name: string; qty: number; rate_paise: number };
export type SaleRow = { id: string; owner_id: string; lead_id: string; agent_id: string | null; items: SaleItem[]; amount_paise: number; paid_paise: number; status: "open" | "partial" | "paid" | "refunded"; method: string; sold_at: string; note: string; quote_id: string | null; created_at: string };
export const SALE_COLS = "id,owner_id,lead_id,agent_id,items,amount_paise,paid_paise,status,method,sold_at,note,quote_id,created_at";
export function cleanItems(v: unknown): SaleItem[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 50).map((x: Record<string, unknown>) => ({
    product_id: isUuid(x?.product_id) ? (x.product_id as string) : null,
    name: String(x?.name ?? "").trim().slice(0, 120),
    qty: Math.max(0, Math.min(100000, Number(x?.qty) || 0)),
    rate_paise: Math.max(0, Math.min(1e12, Math.round(Number(x?.rate_paise) || 0))),
    ...(x?.discount_pct !== undefined ? { discount_pct: Math.max(0, Math.min(100, Number(x.discount_pct) || 0)) } : {}),
  })).filter((x) => x.name && x.qty > 0);
}
const itemsTotal = (items: (SaleItem & { discount_pct?: number })[]) => items.reduce((n, i) => n + Math.round(i.qty * i.rate_paise * (1 - (i.discount_pct ?? 0) / 100)), 0);
async function leadIn(scope: Scope, id: string) {
  return list(await restAsService<{ id: string; name: string; phone: string; city: string; address: string; business: string; status: string }[]>(`leads?id=eq.${id}&${scopeFilter(scope)}&select=id,name,phone,city,address,business,status&limit=1`))[0] ?? null;
}
export async function salesOf(scope: Scope, leadId?: string): Promise<SaleRow[]> {
  const f = leadId ? `lead_id=eq.${leadId}` : `owner_id=eq.${scope.ownerId}`;
  return list(await restAsService<SaleRow[]>(`crm_sales?${f}&owner_id=eq.${scope.ownerId}&select=${SALE_COLS}&order=sold_at.desc&limit=200`));
}
export async function createSale(scope: Scope, b: { lead_id: string; items: unknown; amount_paise?: number; paid_paise?: number; method?: string; note?: string; sold_at?: string; quote_id?: string | null; mark_won?: boolean }): Promise<SaleRow | { error: string }> {
  const lead = await leadIn(scope, b.lead_id); if (!lead) return { error: "Lead not found." };
  const items = cleanItems(b.items);
  const amount = items.length ? itemsTotal(items) : Math.max(0, Math.round(Number(b.amount_paise) || 0));
  if (amount <= 0) return { error: "Add what was sold, or the amount." };
  const paid = Math.max(0, Math.min(amount, Math.round(Number(b.paid_paise ?? amount) || 0)));
  const row = { owner_id: scope.ownerId, lead_id: lead.id, agent_id: scope.userId, items, amount_paise: amount, paid_paise: paid, status: paid >= amount ? "paid" : paid > 0 ? "partial" : "open", method: String(b.method ?? "").slice(0, 20), note: String(b.note ?? "").slice(0, 500), sold_at: b.sold_at && !Number.isNaN(Date.parse(b.sold_at)) ? new Date(b.sold_at).toISOString() : new Date().toISOString(), quote_id: isUuid(b.quote_id) ? b.quote_id : null };
  const r = await restAsService<SaleRow[]>(`crm_sales?select=${SALE_COLS}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
  const sale = Array.isArray(r.data) ? r.data[0] : null;
  if (!sale) return { error: /does not exist/.test(r.text) ? "Run migration 0070 first." : "Could not save the sale." };
  await addEvent(scope.token, scope.ownerId, lead.id, "sale", `🧾 ${rupeesOf(amount)}${items.length ? ` — ${items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ").slice(0, 160)}` : ""}${paid < amount ? ` · due ${rupeesOf(amount - paid)}` : ""}`).catch(() => null);
  if (b.mark_won !== false && !["converted", "won"].includes(lead.status)) {
    await restAsService(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "converted", updated_at: new Date().toISOString() }) });
    await addEvent(scope.token, scope.ownerId, lead.id, "status", "Stage → converted").catch(() => null);
  }
  return sale;
}
export async function patchSale(scope: Scope, id: string, b: { paid_paise?: number; status?: string; note?: string; method?: string }): Promise<SaleRow | null> {
  const before = list(await restAsService<SaleRow[]>(`crm_sales?id=eq.${id}&owner_id=eq.${scope.ownerId}&select=${SALE_COLS}&limit=1`))[0];
  if (!before) return null;
  const patch: Record<string, unknown> = {};
  if (typeof b.paid_paise === "number") { const paid = Math.max(0, Math.min(before.amount_paise, Math.round(b.paid_paise))); patch.paid_paise = paid; patch.status = paid >= before.amount_paise ? "paid" : paid > 0 ? "partial" : "open"; }
  if (b.status === "refunded") patch.status = "refunded";
  if (typeof b.note === "string") patch.note = b.note.slice(0, 500);
  if (typeof b.method === "string") patch.method = b.method.slice(0, 20);
  const r = await restAsService<SaleRow[]>(`crm_sales?id=eq.${id}&select=${SALE_COLS}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } });
  const sale = Array.isArray(r.data) ? r.data[0] : null;
  if (sale && typeof b.paid_paise === "number" && b.paid_paise !== before.paid_paise) await addEvent(scope.token, scope.ownerId, sale.lead_id, "sale", `💰 ${rupeesOf(sale.paid_paise)} / ${rupeesOf(sale.amount_paise)} paid`).catch(() => null);
  if (sale && b.status === "refunded") await addEvent(scope.token, scope.ownerId, sale.lead_id, "sale", `↩ Refunded ${rupeesOf(sale.amount_paise)}`).catch(() => null);
  return sale;
}

/* ---------------- quotations ---------------- */
export type QuoteItem = SaleItem & { discount_pct?: number };
export type QuoteRow = { id: string; owner_id: string; lead_id: string; number: string; items: QuoteItem[]; subtotal_paise: number; discount_paise: number; gst_pct: number; total_paise: number; valid_till: string | null; note: string; pdf_url: string | null; status: "draft" | "sent" | "accepted" | "rejected" | "expired"; sale_id: string | null; created_at: string };
export const QUOTE_COLS = "id,owner_id,lead_id,number,items,subtotal_paise,discount_paise,gst_pct,total_paise,valid_till,note,pdf_url,status,sale_id,created_at";
export async function quotesOf(scope: Scope, leadId: string): Promise<QuoteRow[]> {
  return list(await restAsService<QuoteRow[]>(`crm_quotes?lead_id=eq.${leadId}&owner_id=eq.${scope.ownerId}&select=${QUOTE_COLS}&order=created_at.desc&limit=50`));
}
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
function quoteHtml(q: QuoteRow, lead: { name: string; phone: string; business: string; address: string; city: string }, biz: { name: string; phone: string; email: string; address: string; gstin: string; logo: string }, hi: boolean): string {
  const T = (h: string, e: string) => (hi ? h : e);
  const rows = q.items.map((i, n) => { const line = Math.round(i.qty * i.rate_paise * (1 - (i.discount_pct ?? 0) / 100)); return `<tr><td>${n + 1}</td><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${rupeesOf(i.rate_paise)}</td><td class="r">${i.discount_pct ? `${i.discount_pct}%` : "—"}</td><td class="r">${rupeesOf(line)}</td></tr>`; }).join("");
  const gst = Math.round((q.subtotal_paise - q.discount_paise) * (q.gst_pct / 100));
  const date = new Date(q.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
  *{box-sizing:border-box} body{font-family:'Noto Sans','Noto Sans Devanagari',sans-serif;color:#1f2937;font-size:12px;margin:0}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px}
  h1{font-size:22px;margin:0;color:#4f46e5} .biz{font-size:16px;font-weight:700} .muted{color:#6b7280} .box{display:flex;gap:24px;margin-bottom:16px}
  .box>div{flex:1;background:#f8fafc;border-radius:8px;padding:10px} table{width:100%;border-collapse:collapse;margin-top:6px}
  th{background:#eef2ff;text-align:left;padding:8px;font-size:11px} td{padding:8px;border-bottom:1px solid #e5e7eb} .r{text-align:right}
  .tot{margin-left:auto;width:260px;margin-top:12px} .tot div{display:flex;justify-content:space-between;padding:4px 0} .grand{font-size:16px;font-weight:700;border-top:2px solid #1f2937;margin-top:4px;padding-top:6px!important}
  .note{margin-top:18px;padding:10px;background:#fffbeb;border-radius:8px} .foot{margin-top:28px;font-size:10px;color:#9ca3af;text-align:center}
  </style></head><body>
  <div class="top"><div>${biz.logo ? `<img src="${esc(biz.logo)}" style="height:48px;margin-bottom:6px"/><br/>` : ""}<div class="biz">${esc(biz.name)}</div><div class="muted">${esc([biz.address, biz.phone, biz.email].filter(Boolean).join(" · "))}</div>${biz.gstin ? `<div class="muted">GSTIN: ${esc(biz.gstin)}</div>` : ""}</div>
  <div style="text-align:right"><h1>${T("कोटेशन", "QUOTATION")}</h1><div><b>${esc(q.number)}</b></div><div class="muted">${T("तारीख", "Date")}: ${date}</div>${q.valid_till ? `<div class="muted">${T("मान्य", "Valid till")}: ${new Date(q.valid_till).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>` : ""}</div></div>
  <div class="box"><div><div class="muted">${T("ग्राहक", "To")}</div><b>${esc(lead.name || lead.phone)}</b>${lead.business ? `<br/>${esc(lead.business)}` : ""}<br/>${esc([lead.address, lead.city].filter(Boolean).join(", "))}<br/>${esc(lead.phone)}</div></div>
  <table><thead><tr><th>#</th><th>${T("सामान / सेवा", "Item")}</th><th class="r">${T("मात्रा", "Qty")}</th><th class="r">${T("दर", "Rate")}</th><th class="r">${T("छूट", "Disc.")}</th><th class="r">${T("रकम", "Amount")}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><div><span>${T("कुल", "Subtotal")}</span><span>${rupeesOf(q.subtotal_paise)}</span></div>${q.discount_paise ? `<div><span>${T("छूट", "Discount")}</span><span>− ${rupeesOf(q.discount_paise)}</span></div>` : ""}${q.gst_pct ? `<div><span>GST ${q.gst_pct}%</span><span>${rupeesOf(gst)}</span></div>` : ""}<div class="grand"><span>${T("कुल देय", "Total")}</span><span>${rupeesOf(q.total_paise)}</span></div></div>
  ${q.note ? `<div class="note">${esc(q.note).replace(/\n/g, "<br/>")}</div>` : ""}
  <div class="foot">${T("यह कोटेशन", "Quotation by")} ${esc(biz.name)} · Shubhora</div></body></html>`;
}
export async function createQuote(scope: Scope, b: { lead_id: string; items: unknown; discount_paise?: number; gst_pct?: number; valid_days?: number; note?: string }): Promise<QuoteRow | { error: string }> {
  const lead = await leadIn(scope, b.lead_id); if (!lead) return { error: "Lead not found." };
  const items = cleanItems(b.items) as QuoteItem[];
  if (!items.length) return { error: "Add at least one item." };
  const subtotal = itemsTotal(items);
  const discount = Math.max(0, Math.min(subtotal, Math.round(Number(b.discount_paise) || 0)));
  const gstPct = Math.max(0, Math.min(28, Number(b.gst_pct) || 0));
  const total = Math.round((subtotal - discount) * (1 + gstPct / 100));
  const num = await restAsService<string>("rpc/crm_next_quote_number", { method: "POST", body: JSON.stringify({ p_owner: scope.ownerId }) });
  const number = typeof num.data === "string" && num.data ? num.data : `Q-${Date.now().toString().slice(-6)}`;
  const validDays = Math.max(1, Math.min(365, Number(b.valid_days) || 15));
  const valid = new Date(Date.now() + validDays * 86400000).toISOString().slice(0, 10);
  const row = { owner_id: scope.ownerId, lead_id: lead.id, number, items, subtotal_paise: subtotal, discount_paise: discount, gst_pct: gstPct, total_paise: total, valid_till: valid, note: String(b.note ?? "").slice(0, 1000), status: "draft" };
  const r = await restAsService<QuoteRow[]>(`crm_quotes?select=${QUOTE_COLS}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
  const q = Array.isArray(r.data) ? r.data[0] : null;
  if (!q) return { error: /does not exist/.test(r.text) ? "Run migration 0070 first." : "Could not save the quotation." };
  // PDF: the card's business details, Hindi when the card is Hindi.
  const card = await cardOf(scope.ownerId);
  const d = (card?.data ?? {}) as unknown as { phone?: string; email?: string; address?: string; gstin?: string; avatarUrl?: string; site?: { logoUrl?: string } };
  const html = quoteHtml(q, lead, { name: businessOf(card), phone: d.phone ?? "", email: d.email ?? "", address: d.address ?? "", gstin: d.gstin ?? "", logo: d.site?.logoUrl ?? "" }, hindiCard(card));
  const pdf = await htmlToPdf(html);
  if (pdf) {
    const key = `quotes/${scope.ownerId}/${q.id}.pdf`;
    const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, { method: "POST", headers: { ...serviceHeaders(), "Content-Type": "application/pdf", "x-upsert": "true" }, body: new Uint8Array(pdf) });
    if (up.ok) { q.pdf_url = `${SUPA_URL}/storage/v1/object/public/media/${key}`; await restAsService(`crm_quotes?id=eq.${q.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ pdf_url: q.pdf_url }) }); }
  }
  await addEvent(scope.token, scope.ownerId, lead.id, "quote", `📄 ${number} · ${rupeesOf(total)}`).catch(() => null);
  return q;
}
export async function patchQuote(scope: Scope, id: string, status: QuoteRow["status"]): Promise<{ quote: QuoteRow; sale?: unknown } | null> {
  const q = list(await restAsService<QuoteRow[]>(`crm_quotes?id=eq.${id}&owner_id=eq.${scope.ownerId}&select=${QUOTE_COLS}&limit=1`))[0];
  if (!q) return null;
  let sale_id = q.sale_id; let sale: unknown;
  if (status === "accepted" && !q.sale_id) {
    const s = await createSale(scope, { lead_id: q.lead_id, items: q.items, paid_paise: 0, note: q.number, quote_id: q.id });
    if ("id" in s) { sale_id = s.id; sale = s; }
  }
  const r = await restAsService<QuoteRow[]>(`crm_quotes?id=eq.${id}&select=${QUOTE_COLS}`, { method: "PATCH", body: JSON.stringify({ status, sale_id }), headers: { Prefer: "return=representation" } });
  const quote = Array.isArray(r.data) ? r.data[0] : q;
  if (status !== q.status) await addEvent(scope.token, scope.ownerId, q.lead_id, "quote", `📄 ${q.number} → ${status}`).catch(() => null);
  return { quote, sale };
}

/* ---------------- leaderboard ---------------- */
export type Board = { id: string; calls: number; connected: number; won: number; revenue: number; tasksDone: number }[];
export async function leaderboard(scope: Scope, days: number): Promise<Board> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [calls, sales, tasks] = await Promise.all([
    restAsService<{ agent_id: string | null; outcome: string }[]>(`crm_calls?owner_id=eq.${scope.ownerId}&status=eq.done&started_at=gte.${enc(since)}&select=agent_id,outcome&limit=10000`),
    restAsService<{ agent_id: string | null; amount_paise: number; status: string }[]>(`crm_sales?owner_id=eq.${scope.ownerId}&sold_at=gte.${enc(since)}&select=agent_id,amount_paise,status&limit=5000`),
    restAsService<{ assigned_to: string | null; created_by: string | null }[]>(`crm_tasks?owner_id=eq.${scope.ownerId}&done_at=gte.${enc(since)}&select=assigned_to,created_by&limit=10000`),
  ]);
  const m = new Map<string, Board[number]>();
  const at = (id: string | null) => { const k = id ?? scope.ownerId; let v = m.get(k); if (!v) { v = { id: k, calls: 0, connected: 0, won: 0, revenue: 0, tasksDone: 0 }; m.set(k, v); } return v; };
  for (const c of list(calls)) { const v = at(c.agent_id); v.calls += 1; if (c.outcome === "connected") v.connected += 1; }
  for (const s of list(sales)) { if (s.status === "refunded") continue; const v = at(s.agent_id); v.won += 1; v.revenue += s.amount_paise; }
  for (const t of list(tasks)) at(t.assigned_to ?? t.created_by).tasksDone += 1;
  return [...m.values()].sort((a, b) => b.revenue - a.revenue || b.won - a.won || b.connected - a.connected);
}
