// The shop's setup: items (measurement fields, usual work, steps), kinds of work, unit, the flow (steps and their person),
// auto start, and the staff's rights (bearer; ?as= / body.as).
//   GET → { setup, canEdit, me, people }   people: who a step can go to (staff logins "a:<id>", karigars "k:<id>")
//   PUT { setup } → { setup }   ("setup" right; the staff's rights need the "staff" right and are otherwise kept as they were)
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { denied, has, jobsCtx, saveJobSetup } from "@/lib/jobs-server";
import { cleanSetup } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function GET(request: Request) {
  const c = await jobsCtx(request, new URL(request.url).searchParams.get("as")); if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const [ag, ks] = await Promise.all([
    restAsService<{ id: string; name: string; phone: string; agent_user_id: string | null; active: boolean }[]>(`crm_agents?owner_id=eq.${scope.ownerId}&active=is.true&select=id,name,phone,agent_user_id,active&order=created_at`),
    restAsService<{ id: string; name: string; skill: string; active: boolean }[]>(`job_karigars?owner_id=eq.${scope.ownerId}&active=is.true&select=id,name,skill,active&order=name`),
  ]);
  const people = [
    ...list(ag).map((a) => ({ who: `a:${a.id}`, name: a.name || a.phone, kind: "staff" as const, title: setup.staff[a.id]?.title ?? "", joined: !!a.agent_user_id })),
    ...list(ks).map((k) => ({ who: `k:${k.id}`, name: k.name, kind: "karigar" as const, title: k.skill, joined: true })),
  ];
  return NextResponse.json({ setup, canEdit: has(access, "setup"), me: { ...access, userId: scope.userId }, people });
}

export async function PUT(request: Request) {
  const b = await request.json().catch(() => ({}));
  const c = await jobsCtx(request, typeof b.as === "string" ? b.as : null); if (!c.ok) return c.res;
  const { scope, setup: before, access } = c;
  if (!has(access, "setup")) return denied("change the setup");
  const setup = cleanSetup(b.setup);
  if (!setup.items.length) return NextResponse.json({ error: "Keep at least one item." }, { status: 400 });
  if (!has(access, "staff")) setup.staff = before.staff;
  if (!(await saveJobSetup(scope.ownerId, setup))) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ setup });
}
