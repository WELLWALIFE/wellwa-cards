// Karigars (outside workers without the app) of a shop (bearer; ?as= / body.as).
//   GET → { karigars, ledger }  ledger: per karigar the pieces / metres given and taken back, and the open jobs they hold
//   POST { name, phone?, skill? } → { karigar }          PATCH { id, name?, phone?, skill?, active? } → { karigar }
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { denied, has, isUuid, jobsCtx } from "@/lib/jobs-server";
import { cleanPhone, type Karigar } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function GET(request: Request) {
  const c = await jobsCtx(request, new URL(request.url).searchParams.get("as")); if (!c.ok) return c.res;
  const { scope, access } = c;
  const boss = has(access, "assign");
  const [ks, ev, open] = await Promise.all([
    restAsService<Karigar[]>(`job_karigars?owner_id=eq.${scope.ownerId}&select=id,name,phone,skill,active&order=name`),
    !boss ? Promise.resolve({ data: [] }) : restAsService<{ karigar_id: string | null; kind: string; pieces: number | null; meters: number | null }[]>(`job_events?owner_id=eq.${scope.ownerId}&kind=in.(cloth_out,cloth_in)&karigar_id=not.is.null&select=karigar_id,kind,pieces,meters&limit=20000`),
    !boss ? Promise.resolve({ data: [] }) : restAsService<{ karigar_id: string }[]>(`job_orders?owner_id=eq.${scope.ownerId}&status=not.in.(delivered,cancelled,ready)&karigar_id=not.is.null&select=karigar_id&limit=5000`),
  ]);
  const ledger: Record<string, { piecesOut: number; piecesIn: number; metersOut: number; metersIn: number; openJobs: number }> = {};
  const row = (id: string) => (ledger[id] ??= { piecesOut: 0, piecesIn: 0, metersOut: 0, metersIn: 0, openJobs: 0 });
  for (const e of list(ev as { data: { karigar_id: string | null; kind: string; pieces: number | null; meters: number | null }[] | null })) {
    if (!e.karigar_id) continue;
    const r = row(e.karigar_id);
    if (e.kind === "cloth_out") { r.piecesOut += e.pieces || 0; r.metersOut += Number(e.meters) || 0; }
    else { r.piecesIn += e.pieces || 0; r.metersIn += Number(e.meters) || 0; }
  }
  for (const j of list(open as { data: { karigar_id: string }[] | null })) row(j.karigar_id).openJobs += 1;
  return NextResponse.json({ karigars: list(ks), ledger });
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const c = await jobsCtx(request, typeof b.as === "string" ? b.as : null); if (!c.ok) return c.res;
  const { scope, access } = c;
  if (!has(access, "assign")) return denied("add karigars");
  const name = txt(b.name, 60);
  if (!name) return NextResponse.json({ error: "Write the karigar's name." }, { status: 400 });
  const r = await restAsService<Karigar[]>("job_karigars?select=id,name,phone,skill,active", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ owner_id: scope.ownerId, name, phone: cleanPhone(b.phone), skill: txt(b.skill, 60) }),
  });
  const k = list(r)[0];
  if (!k) return NextResponse.json({ error: /job_karigars/.test(r.text) ? "Orders are not set up yet — run migration 0076 in Supabase." : "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ karigar: k });
}

export async function PATCH(request: Request) {
  const b = await request.json().catch(() => ({}));
  const c = await jobsCtx(request, typeof b.as === "string" ? b.as : null); if (!c.ok) return c.res;
  const { scope, access } = c;
  if (!has(access, "assign")) return denied("change karigars");
  if (!isUuid(b.id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const patch: Record<string, unknown> = {};
  if ("name" in b && txt(b.name, 60)) patch.name = txt(b.name, 60);
  if ("phone" in b) patch.phone = cleanPhone(b.phone);
  if ("skill" in b) patch.skill = txt(b.skill, 60);
  if ("active" in b) patch.active = b.active !== false;
  const k = list(await restAsService<Karigar[]>(`job_karigars?id=eq.${b.id}&owner_id=eq.${scope.ownerId}&select=id,name,phone,skill,active`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }))[0];
  if (!k) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ karigar: k });
}
