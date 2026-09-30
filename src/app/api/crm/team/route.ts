// Team inbox. GET → my agents (owner). POST { name, phone, role } → invite (join code).
// POST { join: "CODE" } → join someone's team as an agent. PATCH { id, active?, role?, name? }. DELETE ?id=
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { SUPA_URL } from "@/lib/admin-guard";
import { userHeaders } from "@/lib/poster-server";
import { agentsFor, newJoinCode, type AgentRow } from "@/lib/crm-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ agents: await agentsFor(me.token, me.id) });
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.join === "string") {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/crm_join`, { method: "POST", headers: userHeaders(me.token), body: JSON.stringify({ p_code: b.join.trim().toUpperCase() }), cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: "That code is not valid (or was removed)." }, { status: 400 });
    return NextResponse.json({ ok: true, owner_id: await r.json() });
  }
  const name = String(b.name ?? "").trim().slice(0, 60), phone = String(b.phone ?? "").replace(/[^0-9+]/g, "").slice(0, 16);
  const role = b.role === "manager" ? "manager" : "agent";
  if (!name) return NextResponse.json({ error: "Agent name is required." }, { status: 400 });
  const existing = await agentsFor(me.token, me.id);
  if (existing.length >= 20) return NextResponse.json({ error: "Team limit reached (20)." }, { status: 400 });
  const r = await restAsUser<AgentRow[]>(me.token, "crm_agents?select=id,owner_id,agent_user_id,name,phone,role,join_code,active,joined_at", { method: "POST", body: JSON.stringify({ owner_id: me.id, name, phone, role, join_code: newJoinCode() }), headers: { Prefer: "return=representation" } });
  const a = Array.isArray(r.data) ? r.data[0] : null;
  if (!a) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not add." }, { status: 502 });
  return NextResponse.json({ agent: a });
}
export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(b.id))) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof b.active === "boolean") patch.active = b.active;
  if (b.role === "agent" || b.role === "manager") patch.role = b.role;
  if (typeof b.name === "string") patch.name = b.name.trim().slice(0, 60);
  if (b.regenerate === true) patch.join_code = newJoinCode();
  const r = await restAsUser<AgentRow[]>(me.token, `crm_agents?id=eq.${b.id}&owner_id=eq.${me.id}&select=id,owner_id,agent_user_id,name,phone,role,join_code,active,joined_at`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } });
  const a = Array.isArray(r.data) ? r.data[0] : null;
  return a ? NextResponse.json({ agent: a }) : NextResponse.json({ error: "Could not update." }, { status: 502 });
}
export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  await restAsUser(me.token, `crm_agents?id=eq.${id}&owner_id=eq.${me.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return NextResponse.json({ ok: true });
}
