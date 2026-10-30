// Staff logins of the shop's Orders (owner, 30 Oct 2026: "multi login — admin, measurement master, cutting, stitching —
// and what rights each one has"). A staff login is a row of the shop's team (crm_agents, role agent): the person opens
// the invite link, logs in to Shubhora with their own mobile, and joins with the code. Their Orders rights live in the
// shop's setup (jobSetup.staff, keyed by the team row id). Needs the "staff" right.
//   GET → { staff, canManage }
//   POST { name, phone, title, rights } → { member }
//   PATCH { id, name?, phone?, title?, rights?, active?, regenerate? } → { member }
//   DELETE ?id= → { ok }
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { newJoinCode } from "@/lib/crm-server";
import { denied, has, isUuid, jobsCtx, saveJobSetup } from "@/lib/jobs-server";
import { ALL_RIGHTS, cleanPhone, type JobSetup, type Right } from "@/lib/jobs";

type Row = { id: string; agent_user_id: string | null; name: string; phone: string; role: string; join_code: string; active: boolean; joined_at: string | null; created_at: string };
const COLS = "id,agent_user_id,name,phone,role,join_code,active,joined_at,created_at";
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const rightsOf = (v: unknown): Right[] => (Array.isArray(v) ? v.filter((r): r is Right => (ALL_RIGHTS as string[]).includes(r)) : []);
const view = (r: Row, s: JobSetup) => ({
  id: r.id, name: r.name, phone: r.phone, joined: !!r.agent_user_id, active: r.active, code: r.join_code, crmRole: r.role,
  title: s.staff[r.id]?.title ?? (r.role === "manager" ? "Manager" : ""), rights: s.staff[r.id]?.rights ?? (r.role === "manager" ? ALL_RIGHTS : ["book", "measure"]), set: !!s.staff[r.id],
});

export async function GET(request: Request) {
  const c = await jobsCtx(request, new URL(request.url).searchParams.get("as")); if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!has(access, "staff")) return denied("see the staff");
  const rows = list(await restAsService<Row[]>(`crm_agents?owner_id=eq.${scope.ownerId}&select=${COLS}&order=created_at`));
  return NextResponse.json({ staff: rows.map((r) => view(r, setup)), canManage: true });
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const c = await jobsCtx(request, typeof b.as === "string" ? b.as : null); if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!has(access, "staff")) return denied("add staff");
  const name = txt(b.name, 60), phone = cleanPhone(b.phone);
  if (!name) return NextResponse.json({ error: "Write the person's name." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Write their 10-digit mobile — the invite and the work messages go there." }, { status: 400 });
  const rows = list(await restAsService<Row[]>(`crm_agents?owner_id=eq.${scope.ownerId}&select=${COLS}`));
  if (rows.length >= 20) return NextResponse.json({ error: "Team limit reached (20)." }, { status: 400 });
  if (rows.some((r) => r.phone.replace(/\D/g, "").slice(-10) === phone.slice(-10) && r.active)) return NextResponse.json({ error: "This mobile is already in your staff." }, { status: 409 });
  const r = await restAsService<Row[]>(`crm_agents?select=${COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: scope.ownerId, name, phone, role: "agent", join_code: newJoinCode() }) });
  const row = list(r)[0];
  if (!row) return NextResponse.json({ error: "Could not add. Please try again." }, { status: 502 });
  const next = { ...setup, staff: { ...setup.staff, [row.id]: { title: txt(b.title, 40), rights: rightsOf(b.rights) } } };
  await saveJobSetup(scope.ownerId, next);
  return NextResponse.json({ member: view(row, next) });
}

export async function PATCH(request: Request) {
  const b = await request.json().catch(() => ({}));
  const c = await jobsCtx(request, typeof b.as === "string" ? b.as : null); if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!has(access, "staff")) return denied("change staff");
  if (!isUuid(b.id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if ("name" in b && txt(b.name, 60)) patch.name = txt(b.name, 60);
  if ("phone" in b) { const p = cleanPhone(b.phone); if (!p) return NextResponse.json({ error: "That mobile does not look right." }, { status: 400 }); patch.phone = p; }
  if (typeof b.active === "boolean") patch.active = b.active;
  if (b.regenerate === true) patch.join_code = newJoinCode();
  let row = list(await restAsService<Row[]>(`crm_agents?id=eq.${b.id}&owner_id=eq.${scope.ownerId}&select=${COLS}`))[0];
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Someone cannot take away their own "staff" right (and lock everyone out).
  if (row.agent_user_id === scope.userId && "rights" in b && !rightsOf(b.rights).includes("staff")) return NextResponse.json({ error: "You cannot remove your own staff right." }, { status: 400 });
  if (Object.keys(patch).length) row = list(await restAsService<Row[]>(`crm_agents?id=eq.${b.id}&owner_id=eq.${scope.ownerId}&select=${COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }))[0] ?? row;
  let next = setup;
  if ("title" in b || "rights" in b) {
    const was = setup.staff[row.id] ?? { title: "", rights: [] as Right[] };
    next = { ...setup, staff: { ...setup.staff, [row.id]: { title: "title" in b ? txt(b.title, 40) : was.title, rights: "rights" in b ? rightsOf(b.rights) : was.rights } } };
    await saveJobSetup(scope.ownerId, next);
  }
  return NextResponse.json({ member: view(row, next) });
}

export async function DELETE(request: Request) {
  const p = new URL(request.url).searchParams;
  const c = await jobsCtx(request, p.get("as")); if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!has(access, "staff")) return denied("remove staff");
  const id = p.get("id");
  if (!isUuid(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  const row = list(await restAsService<Row[]>(`crm_agents?id=eq.${id}&owner_id=eq.${scope.ownerId}&select=${COLS}`))[0];
  if (row?.agent_user_id === scope.userId) return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });
  await restAsService(`crm_agents?id=eq.${id}&owner_id=eq.${scope.ownerId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  const staff = { ...setup.staff }; delete staff[id];
  const steps = setup.steps.map((s) => (s.who === `a:${id}` ? { ...s, who: "" } : s));
  await saveJobSetup(scope.ownerId, { ...setup, staff, steps });
  return NextResponse.json({ ok: true });
}
