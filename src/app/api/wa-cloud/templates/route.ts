// Meta message templates for the owner's WABA. GET → list (with status). POST → create. DELETE ?name=
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { cloudAccount, listTemplates, createTemplate, deleteTemplate, friendlyGraphError, type NewTemplate } from "@/lib/wa-cloud";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const a = await cloudAccount(me.id);
  if (!a) return NextResponse.json({ error: "Connect your Cloud API account first." }, { status: 400 });
  if (!a.waba_id) return NextResponse.json({ error: "Add your WhatsApp Business Account ID (WABA ID) to manage templates." }, { status: 400 });
  try { return NextResponse.json({ templates: await listTemplates(a) }); }
  catch (e) { return NextResponse.json({ error: friendlyGraphError(e) }, { status: 502 }); }
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const a = await cloudAccount(me.id);
  if (!a?.waba_id) return NextResponse.json({ error: "Connect your Cloud API account (with WABA ID) first." }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 60);
  const body = String(b.body ?? "").trim().slice(0, 1024);
  if (!name || !body) return NextResponse.json({ error: "Name and message body are required." }, { status: 400 });
  const t: NewTemplate = {
    name, category: b.category === "UTILITY" ? "UTILITY" : "MARKETING", language: /^[a-z]{2}(_[A-Z]{2})?$/.test(String(b.language)) ? String(b.language) : "en",
    body, footer: String(b.footer ?? "").trim().slice(0, 60) || undefined,
    header: b.header_text ? { type: "TEXT", text: String(b.header_text).slice(0, 60) } : b.header_image ? { type: "IMAGE" } : undefined,
    buttons: (Array.isArray(b.buttons) ? b.buttons : []).slice(0, 3).map((x: Record<string, string>) => x.type === "URL" ? { type: "URL" as const, text: String(x.text ?? "").slice(0, 25), url: String(x.url ?? "").slice(0, 2000) } : x.type === "PHONE_NUMBER" ? { type: "PHONE_NUMBER" as const, text: String(x.text ?? "").slice(0, 25), phone_number: String(x.phone_number ?? "").replace(/[^0-9+]/g, "") } : { type: "QUICK_REPLY" as const, text: String(x.text ?? "").slice(0, 25) }).filter((x: { text: string }) => x.text),
    bodyExamples: Array.isArray(b.examples) ? b.examples.map(String) : undefined,
  };
  try { const r = await createTemplate(a, t); return NextResponse.json({ ok: true, ...r }); }
  catch (e) { return NextResponse.json({ error: friendlyGraphError(e) }, { status: 502 }); }
}
export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const a = await cloudAccount(me.id);
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!a?.waba_id || !name) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try { await deleteTemplate(a, name); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: friendlyGraphError(e) }, { status: 502 }); }
}
