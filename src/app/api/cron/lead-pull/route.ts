// CRM → Lead sources → IndiaMART. Every 15 minutes (scripts/lead-pull.sh): for each owner who saved their IndiaMART "Pull API" key, the
// new enquiries are fetched from IndiaMART's Lead Manager Pull API v2 and put in the CRM like any other lead (crm_inbound_lead), each
// enquiry once (its UNIQUE_QUERY_ID is kept). Called without a time range, the API answers what came in since the last call (or the
// last 24 hours). One call per key per 5 minutes is IndiaMART's limit — 15 minutes stays well inside it.
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/lead-pull
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { alertNewLead, leadPhone } from "@/lib/lead-in";

export const maxDuration = 270;
type Row = { owner_id: string; inbound_token: string; indiamart_key: string; indiamart_seen: string[] | null };
type ImLead = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const KIND: Record<string, string> = { W: "Direct enquiry", B: "Buy-lead", P: "Phone call", BIZ: "Catalog view", WA: "WhatsApp enquiry" };

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const rows = await restAsService<Row[]>("crm_integrations?indiamart_key=neq.&select=owner_id,inbound_token,indiamart_key,indiamart_seen&limit=2000");
  const list = Array.isArray(rows.data) ? rows.data : [];
  const out = { owners: list.length, leads: 0, errors: 0 };
  for (const row of list) {
    let note = "", seen = row.indiamart_seen ?? [];
    try {
      const r = await fetch(`https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(row.indiamart_key)}`, { signal: AbortSignal.timeout(30_000) });
      const d = (await r.json().catch(() => ({}))) as { CODE?: number; STATUS?: string; MESSAGE?: string; RESPONSE?: ImLead[] };
      const code = Number(d.CODE ?? r.status);
      if (code === 204) note = "ok · no new enquiry";
      else if (code !== 200) { note = code === 401 ? "key wrong or expired — make a new key on IndiaMART and save it here" : `IndiaMART: ${s(d.MESSAGE).slice(0, 120) || `error ${code}`}`; out.errors++; }
      else {
        let added = 0, noPhone = 0;
        for (const q of Array.isArray(d.RESPONSE) ? d.RESPONSE : []) {
          const id = s(q.UNIQUE_QUERY_ID);
          if (!id || seen.includes(id)) continue;
          seen = [...seen, id];
          const phone = leadPhone(q.SENDER_MOBILE) || leadPhone(q.SENDER_MOBILE_ALT);
          if (!phone) { noPhone++; continue; }
          const name = (s(q.SENDER_NAME) || "IndiaMART buyer").slice(0, 80);
          const product = s(q.QUERY_PRODUCT_NAME) || s(q.SUBJECT);
          const message = [KIND[s(q.QUERY_TYPE)] ?? "", product, s(q.QUERY_MESSAGE).replace(/<br\s*\/?>/gi, " ")].filter(Boolean).join(" — ").slice(0, 500);
          const company = s(q.SENDER_COMPANY);
          const lr = await restAsService<string>("rpc/crm_inbound_lead", { method: "POST", body: JSON.stringify({
            p_token: row.inbound_token, p_name: company && !name.includes(company) ? `${name} (${company})`.slice(0, 80) : name, p_phone: phone, p_message: message,
            p_source: "indiamart", p_city: (s(q.SENDER_CITY) || s(q.SENDER_STATE)).slice(0, 60), p_tags: ["indiamart"],
          }) });
          if (lr.ok) { added++; out.leads++; if (added <= 5) await alertNewLead(row.owner_id, { name, phone, message, source: "indiamart" }).catch(() => undefined); }
        }
        note = `ok · ${added} new${noPhone ? ` · ${noPhone} without a mobile (email only)` : ""}`;
      }
    } catch (e) {
      note = `could not reach IndiaMART (${e instanceof Error ? e.message.slice(0, 60) : "error"})`; out.errors++;
    }
    await restAsService(`crm_integrations?owner_id=eq.${row.owner_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      indiamart_seen: seen.slice(-500), indiamart_at: new Date().toISOString(), indiamart_note: note.slice(0, 200),
    }) }).catch(() => undefined);
  }
  return NextResponse.json(out);
}
