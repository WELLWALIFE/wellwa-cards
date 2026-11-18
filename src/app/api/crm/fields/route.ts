// The business's own fields on one customer (owner, 18 Nov 2026). Definitions: owner_prefs.crm.fields (saved with the CRM settings);
// values: leads.extra (migration 0090). Kept apart from /api/crm/lead on purpose: until the migration is run this route answers
// { ready: false } and nothing else in the CRM is touched.
//   GET ?lead=<id>&as=  → { fields, values, ready }
//   PATCH { lead_id, values: { key: value }, as? } → { values }
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { leadById, resolveScope, addEvent } from "@/lib/crm-server";
import { prefsOf, cleanFieldValue } from "@/lib/crm-pro";

type Extra = Record<string, string>;
const readExtra = async (id: string, ownerId: string) => {
  const r = await restAsService<{ extra: Extra | null }[]>(`leads?id=eq.${id}&owner_id=eq.${ownerId}&select=extra&limit=1`);
  return { ready: r.ok, values: (r.ok && Array.isArray(r.data) ? r.data[0]?.extra : null) ?? {} };
};

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const u = new URL(request.url);
  const scope = await resolveScope(me, u.searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const lead = await leadById(me.token, u.searchParams.get("lead") ?? "", scope.ownerId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const [prefs, extra] = await Promise.all([prefsOf(scope.ownerId), readExtra(lead.id, scope.ownerId)]);
  return NextResponse.json({ fields: prefs.fields ?? [], values: extra.values, ready: extra.ready });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { lead_id?: string; values?: Record<string, unknown>; as?: string };
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const lead = await leadById(me.token, String(b.lead_id ?? ""), scope.ownerId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const [prefs, extra] = await Promise.all([prefsOf(scope.ownerId), readExtra(lead.id, scope.ownerId)]);
  if (!extra.ready) return NextResponse.json({ error: "Your own fields are not switched on yet. Please ask support." }, { status: 503 });
  const next: Extra = { ...extra.values }; const changed: string[] = [];
  for (const f of prefs.fields ?? []) {
    if (!b.values || !(f.key in b.values)) continue;
    const v = cleanFieldValue(f, b.values[f.key]);
    if (v === null) return NextResponse.json({ error: `"${f.label}" is not valid.` }, { status: 400 });
    if ((next[f.key] ?? "") === v) continue;
    if (v) next[f.key] = v; else delete next[f.key];
    changed.push(`${f.label}: ${v || "—"}`);
  }
  if (!changed.length) return NextResponse.json({ values: next });
  const r = await restAsService(`leads?id=eq.${lead.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ extra: next, updated_at: new Date().toISOString() }) });
  if (!r.ok) return NextResponse.json({ error: "Could not save." }, { status: 502 });
  await addEvent(me.token, scope.ownerId, lead.id, "note", `✏️ ${changed.join(" · ").slice(0, 300)}`).catch(() => null);
  return NextResponse.json({ values: next });
}
