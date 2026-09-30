// POST (bearer) { name, phone, city?, tags?, note? } → create a lead by hand (owner/manager).
// POST { leads: [{name, phone, city, tags, note}] } → bulk import (owner), skips numbers already present.
// PATCH { id, as?, status?, tags?, notes?, next_follow_up?, value_paise?, lost_reason?, name?, city?, note?, assigned_to? }
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, restAsService } from "@/lib/poster-server";
import { STAGES, LEAD_COLS, addEvent, leadById, resolveScope, agentsFor, type LeadRow } from "@/lib/crm-server";

const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
const cleanPhone = (v: unknown) => { let d = String(v ?? "").replace(/[^0-9]/g, ""); if (d.length === 11 && d.startsWith("0")) d = d.slice(1); if (d.length < 10 || d.length > 15) return ""; return "+" + (d.length === 10 ? "91" + d : d); };
const friendly = (t: string) => { try { return String(JSON.parse(t).message ?? "Could not save.").slice(0, 200); } catch { return "Could not save."; } };
const cleanTags = (v: unknown) => (Array.isArray(v) ? v.map((t) => String(t).trim().replace(/^#/, "").slice(0, 24)).filter(Boolean).slice(0, 12) : undefined);

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || scope.role === "agent") return NextResponse.json({ error: "Only the owner or a manager can add leads." }, { status: 403 });
  const card = (await restAsService<{ id: string }[]>(`cards?owner_id=eq.${scope.ownerId}&select=id&order=created_at.desc&limit=1`)).data?.[0]?.id ?? null;

  if (Array.isArray(b.leads)) {
    const rows = b.leads.slice(0, 2000).map((x: Record<string, unknown>) => ({ phone: cleanPhone(x.phone), name: S(x.name, 80) ?? "", city: S(x.city, 60) ?? "", tags: cleanTags(x.tags) ?? [], message: S(x.note, 500) ?? "" })).filter((x: { phone: string }) => x.phone);
    if (!rows.length) return NextResponse.json({ error: "No valid mobile numbers found." }, { status: 400 });
    const existing = new Set((await restAsService<{ phone: string }[]>(`leads?owner_id=eq.${scope.ownerId}&select=phone&limit=5000`)).data?.map((l) => l.phone) ?? []);
    const seen = new Set<string>();
    const fresh = rows.filter((r: { phone: string }) => { if (existing.has(r.phone) || seen.has(r.phone)) return false; seen.add(r.phone); return true; })
      .map((r: Record<string, unknown>) => ({ ...r, owner_id: scope.ownerId, card_id: card, source: "form", status: "new" }));
    let added = 0;
    for (let i = 0; i < fresh.length; i += 200) {
      const r = await restAsService<{ id: string }[]>("leads?select=id", { method: "POST", body: JSON.stringify(fresh.slice(i, i + 200)), headers: { Prefer: "return=representation" } });
      if (!r.ok) return NextResponse.json({ error: friendly(r.text), added }, { status: 502 });
      added += Array.isArray(r.data) ? r.data.length : 0;
    }
    return NextResponse.json({ ok: true, added, skipped: rows.length - fresh.length });
  }

  const phone = cleanPhone(b.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  const dup = (await restAsService<{ id: string }[]>(`leads?owner_id=eq.${scope.ownerId}&phone=eq.${encodeURIComponent(phone)}&select=id&limit=1`)).data;
  if (Array.isArray(dup) && dup[0]) return NextResponse.json({ error: "This number is already in your leads.", id: dup[0].id }, { status: 409 });
  const row = { owner_id: scope.ownerId, card_id: card, phone, name: S(b.name, 80) ?? "", city: S(b.city, 60) ?? "", tags: cleanTags(b.tags) ?? [], source: "form", status: "new", message: S(b.note, 500) ?? "" };
  const r = await restAsService<LeadRow[]>(`leads?select=${LEAD_COLS}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
  const lead = Array.isArray(r.data) ? r.data[0] : null;
  if (!lead) return NextResponse.json({ error: /card_id/.test(r.text) ? "Make your digital card first (Card tab), then add leads." : friendly(r.text) }, { status: 502 });
  await addEvent(me.token, scope.ownerId, lead.id, "created", "Added manually");
  return NextResponse.json({ lead });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const before = await leadById(me.token, String(b.id ?? ""), scope.ownerId);
  if (!before) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const events: [string, string][] = [];
  if (typeof b.status === "string" && (STAGES as readonly string[]).includes(b.status) && b.status !== before.status) { patch.status = b.status; events.push(["status", `Stage → ${b.status.replace("_", " ")}`]); }
  const tags = cleanTags(b.tags); if (tags) patch.tags = tags;
  if (S(b.notes, 4000) !== undefined) patch.notes = S(b.notes, 4000);
  if (S(b.name, 80) !== undefined) patch.name = S(b.name, 80);
  if (S(b.city, 60) !== undefined) patch.city = S(b.city, 60);
  if (S(b.lost_reason, 200) !== undefined) patch.lost_reason = S(b.lost_reason, 200);
  if (typeof b.value_paise === "number" && b.value_paise >= 0) patch.value_paise = Math.round(b.value_paise);
  if (b.next_follow_up === null) { patch.next_follow_up = null; patch.reminded_at = null; if (before.next_follow_up) events.push(["followup", "Follow-up cleared"]); }
  else if (typeof b.next_follow_up === "string" && !Number.isNaN(Date.parse(b.next_follow_up))) {
    const iso = new Date(b.next_follow_up).toISOString();
    if (iso !== before.next_follow_up) { patch.next_follow_up = iso; patch.reminded_at = null; events.push(["followup", `Follow-up set: ${new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`]); }
  }
  if ("assigned_to" in b && scope.role !== "agent") {
    const to = b.assigned_to === null ? null : String(b.assigned_to);
    if (to !== before.assigned_to) {
      const agents = await agentsFor(me.token, scope.ownerId, scope.role);
      const a = to ? agents.find((x) => x.agent_user_id === to) : null;
      if (to && !a) return NextResponse.json({ error: "That agent is not in your team." }, { status: 400 });
      patch.assigned_to = to; events.push(["assign", to ? `Assigned to ${a?.name || a?.phone || "agent"}` : "Unassigned"]);
    }
  }
  const note = S(b.note, 500); if (note) events.push(["note", note]);
  const r = await restAsUser<LeadRow[]>(me.token, `leads?id=eq.${before.id}&select=${LEAD_COLS}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } });
  const lead = Array.isArray(r.data) ? r.data[0] : null;
  if (!lead) return NextResponse.json({ error: friendly(r.text) }, { status: 502 });
  for (const [k, t] of events) await addEvent(me.token, scope.ownerId, lead.id, k, t);
  return NextResponse.json({ lead });
}
