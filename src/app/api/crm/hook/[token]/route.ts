// Public incoming lead hook: POST /api/crm/hook/<token> { name, phone, message?, source?, city?, tags? }
// For website forms, Zapier/Make (Facebook Lead Ads, IndiaMART, JustDial…), Google Forms scripts.
// Also accepts form-encoded bodies and GET with query params for no-code tools.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { rateLimited, clientKey } from "@/lib/api-security";

const cleanPhone = (v: unknown) => { let d = String(v ?? "").replace(/[^0-9]/g, ""); if (d.length === 11 && d.startsWith("0")) d = d.slice(1); if (d.length === 12 && d.startsWith("91")) d = d.slice(2); if (d.length < 10 || d.length > 15) return ""; return "+" + (d.length === 10 ? "91" + d : d); };
const pick = (o: Record<string, unknown>, keys: string[]) => { for (const k of keys) { const v = o[k]; if (typeof v === "string" && v.trim()) return v.trim(); if (typeof v === "number") return String(v); } return ""; };

async function handle(request: Request, tokenStr: string, raw: Record<string, unknown>) {
  if (!/^[a-f0-9]{36}$/.test(tokenStr)) return NextResponse.json({ error: "bad token" }, { status: 404 });
  // Zapier / our own webhook format wrap the lead in "data" — flatten it so both shapes work.
  const body: Record<string, unknown> = raw.data && typeof raw.data === "object" ? { ...(raw.data as Record<string, unknown>), ...raw } : raw;
  if (rateLimited(clientKey(request, "crm-hook"), 60, 60 * 1000)) return NextResponse.json({ error: "too many requests" }, { status: 429 });
  const phone = cleanPhone(pick(body, ["phone", "mobile", "phone_number", "whatsapp", "number", "contact"]));
  if (!phone) return NextResponse.json({ error: "phone (10-digit mobile) is required" }, { status: 400 });
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : typeof body.tags === "string" ? body.tags.split(/[,;|]/) : [];
  const r = await restAsService<string>("rpc/crm_inbound_lead", { method: "POST", body: JSON.stringify({
    p_token: tokenStr, p_name: pick(body, ["name", "full_name", "first_name", "customer_name"]).slice(0, 80), p_phone: phone,
    p_message: pick(body, ["message", "note", "notes", "enquiry", "query", "comment", "text"]).slice(0, 500),
    p_source: pick(body, ["source", "platform", "utm_source", "from"]).slice(0, 30).toLowerCase() || "webhook",
    p_city: pick(body, ["city", "location", "area"]).slice(0, 60), p_tags: tags.map((t) => String(t).trim().slice(0, 24)).filter(Boolean).slice(0, 8),
  }) });
  if (!r.ok) return NextResponse.json({ error: /BAD_TOKEN/.test(r.text) ? "bad token" : "could not save" }, { status: /BAD_TOKEN/.test(r.text) ? 404 : 502 });
  return NextResponse.json({ ok: true, lead_id: r.data });
}
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ct = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  if (ct.includes("application/json")) body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  else if (ct.includes("form")) body = Object.fromEntries((await request.formData().catch(() => new FormData())).entries()) as Record<string, unknown>;
  else { const t = await request.text().catch(() => ""); try { body = JSON.parse(t); } catch { body = Object.fromEntries(new URLSearchParams(t).entries()); } }
  return handle(request, token, body);
}
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(request, token, Object.fromEntries(new URL(request.url).searchParams.entries()));
}
