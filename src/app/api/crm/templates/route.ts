// Quick replies (owner/manager edit; agents read via thread). GET ?as= → list. POST { as?, id?, name, shortcut?, body } → upsert. DELETE ?id=
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { templatesFor, resolveScope, type TemplateRow } from "@/lib/crm-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return NextResponse.json({ templates: await templatesFor(me.token, scope.ownerId), canEdit: scope.role === "owner" });
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 60), body = String(b.body ?? "").trim().slice(0, 2000);
  const shortcut = String(b.shortcut ?? "").trim().replace(/^\//, "").replace(/\s+/g, "").toLowerCase().slice(0, 20);
  if (!name || !body) return NextResponse.json({ error: "Name and message are required." }, { status: 400 });
  const row = { owner_id: me.id, name, shortcut, body };
  const isEdit = typeof b.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id);
  const r = await restAsUser<TemplateRow[]>(me.token, isEdit ? `wa_templates?id=eq.${b.id}&select=id,name,shortcut,body,uses` : "wa_templates?select=id,name,shortcut,body,uses", { method: isEdit ? "PATCH" : "POST", body: JSON.stringify(isEdit ? { name, shortcut, body } : row), headers: { Prefer: "return=representation" } });
  const t = Array.isArray(r.data) ? r.data[0] : null;
  if (!t) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save." }, { status: 502 });
  return NextResponse.json({ template: t });
}
export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  await restAsUser(me.token, `wa_templates?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return NextResponse.json({ ok: true });
}
