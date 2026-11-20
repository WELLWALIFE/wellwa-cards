// Public incoming lead hook: POST /api/crm/hook/<token> { name, phone, message?, source?, city?, tags? }
// For website forms (any website — CRM → Lead sources gives the ready form), Google Forms (the ready script), Zapier / Make / Pabbly
// (Facebook Lead Ads, JustDial, TradeIndia…), or any server. Accepts JSON, form-encoded bodies, and GET with query params.
//   CORS open: a form on another website may post here with fetch.
//   A plain HTML form (no script) gets a small thank-you page, or goes to its `_next` address.
//   `_hp` is a hidden trap field: a bot that fills it is thanked and nothing is saved.
//   `site` (the page the form is on) is kept as a tag, so the owner sees which website it came from.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { rateLimited, clientKey } from "@/lib/api-security";
import { alertNewLead, leadPhone } from "@/lib/lead-in";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const pick = (o: Record<string, unknown>, keys: string[]) => { for (const k of keys) { const v = o[k]; if (typeof v === "string" && v.trim()) return v.trim(); if (typeof v === "number") return String(v); } return ""; };
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: CORS });
const hostOf = (u: string) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).host.replace(/^www\./, ""); } catch { return ""; } };

function thanks(next: string, ok: boolean) {
  if (ok && /^https?:\/\/[^\s]+$/.test(next)) return NextResponse.redirect(next, 303);
  const msg = ok ? "Thank you! We have your details and will contact you soon. 🙏" : "Sorry — please enter a valid 10-digit mobile number and try again.";
  return new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank you</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f6f7fb"><div style="max-width:420px;padding:28px;background:#fff;border-radius:18px;box-shadow:0 6px 24px rgba(0,0,0,.08);text-align:center"><p style="font-size:18px;margin:0 0 14px">${msg}</p><a href="javascript:history.back()" style="color:#2f4bd8">← Back</a></div></body>`, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", ...CORS } });
}

async function handle(request: Request, tokenStr: string, raw: Record<string, unknown>, plainForm: boolean) {
  const next = typeof raw._next === "string" ? raw._next : "";
  const answer = (b: Record<string, unknown>, status = 200) => (plainForm ? thanks(next, status < 300) : json(b, status));
  if (!/^[a-f0-9]{36}$/.test(tokenStr)) return answer({ error: "bad token" }, 404);
  // Zapier / our own webhook format wrap the lead in "data" — flatten it so both shapes work.
  const body: Record<string, unknown> = raw.data && typeof raw.data === "object" ? { ...(raw.data as Record<string, unknown>), ...raw } : raw;
  if (rateLimited(clientKey(request, "crm-hook"), 60, 60 * 1000)) return answer({ error: "too many requests" }, 429);
  if (typeof body._hp === "string" && body._hp.trim()) return answer({ ok: true });
  const phone = leadPhone(pick(body, ["phone", "mobile", "phone_number", "whatsapp", "number", "contact", "SENDER_MOBILE"]));
  if (!phone) return answer({ error: "phone (10-digit mobile) is required" }, 400);
  const site = hostOf(pick(body, ["site", "page", "website"]));
  const tags = (Array.isArray(body.tags) ? body.tags.map(String) : typeof body.tags === "string" ? body.tags.split(/[,;|]/) : []).concat(site ? [site] : []);
  const name = pick(body, ["name", "full_name", "first_name", "customer_name", "SENDER_NAME"]).slice(0, 80);
  const message = pick(body, ["message", "note", "notes", "enquiry", "query", "comment", "text", "QUERY_MESSAGE"]).slice(0, 500);
  const source = (pick(body, ["source", "platform", "utm_source", "from"]) || (site ? "website" : "webhook")).slice(0, 30).toLowerCase();
  const r = await restAsService<string>("rpc/crm_inbound_lead", { method: "POST", body: JSON.stringify({
    p_token: tokenStr, p_name: name, p_phone: phone, p_message: message, p_source: source,
    p_city: pick(body, ["city", "location", "area", "SENDER_CITY"]).slice(0, 60), p_tags: tags.map((t) => String(t).trim().slice(0, 24)).filter(Boolean).slice(0, 8),
  }) });
  if (!r.ok) return answer({ error: /BAD_TOKEN/.test(r.text) ? "bad token" : "could not save" }, /BAD_TOKEN/.test(r.text) ? 404 : 502);
  // The owner hears about it at once (push; their own WhatsApp on a paid plan). Never a message to the customer from here.
  const owner = (await restAsService<{ owner_id: string }[]>(`crm_integrations?inbound_token=eq.${tokenStr}&select=owner_id`).catch(() => null))?.data?.[0]?.owner_id;
  if (owner && source !== "test") await alertNewLead(owner, { name, phone, message, source }).catch(() => undefined);
  return answer({ ok: true, lead_id: r.data });
}

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ct = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  // A browser form submitted without any script expects a page back, not JSON (its Accept asks for text/html).
  const plainForm = ct.includes("form") && /text\/html/.test(request.headers.get("accept") ?? "");
  if (ct.includes("application/json")) body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  else if (ct.includes("form")) body = Object.fromEntries((await request.formData().catch(() => new FormData())).entries()) as Record<string, unknown>;
  else { const t = await request.text().catch(() => ""); try { body = JSON.parse(t); } catch { body = Object.fromEntries(new URLSearchParams(t).entries()); } }
  return handle(request, token, body, plainForm);
}
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(request, token, Object.fromEntries(new URL(request.url).searchParams.entries()), false);
}
