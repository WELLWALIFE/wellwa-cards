// Super Admin → switch an advanced feature on / off for one account (after the customisation is paid — see src/lib/addons.ts).
//   GET ?id= → { addons }      POST { id, key, on } → { ok, addons }
import { adminAllowed, serviceConfigured } from "@/lib/admin-guard";
import { requireAdmin, audit, userInScope } from "@/lib/admin-v2";
import { addonOf } from "@/lib/addons";
import { readAddons, setAddon } from "@/lib/addons-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return Response.json({ error: "bad account" }, { status: 400 });
  return Response.json({ addons: await readAddons(id) });
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, "users.plan", { sensitive: true }); if (!g.ok) return g.res;
  if (!serviceConfigured()) return Response.json({ error: "not configured" }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as { id?: string; key?: string; on?: boolean };
  if (!UUID.test(String(b.id ?? ""))) return Response.json({ error: "bad account" }, { status: 400 });
  const a = addonOf(String(b.key ?? ""));
  if (!a) return Response.json({ error: "unknown feature" }, { status: 400 });
  if (!(await userInScope(g.me, b.id as string))) return Response.json({ error: "That user is outside your scope." }, { status: 403 });
  await audit(g.me, b.on === true ? "user.addon_on" : "user.addon_off", { type: "user", id: b.id as string, after: { addon: a.key } }, request);
  if (!(await setAddon(b.id as string, a.key, b.on === true))) return Response.json({ error: "Could not save." }, { status: 500 });
  return Response.json({ ok: true, addons: await readAddons(b.id as string) });
}
