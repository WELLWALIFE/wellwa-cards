// Super Admin → Staff (sub admins): the Staff Admin logins, their duties and their work, managed from here.
// The logins live in the partner panel's database; every call goes there over the signed server-to-server link,
// and every change is written to its activity log as done by the Super Admin.
//   GET                          → { staff: [...] }
//   POST { op: "create" | "update" | "reset" | "reset2fa" | "logout" | "activity", ... }
import { adminAllowed, SUPA_URL } from "@/lib/admin-guard";
import { partnerCall } from "@/lib/partner-link";

/** Who is doing it, for the log: the owner's email when logged in, else "password unlock". */
async function who(request: Request): Promise<string> {
  const token = request.headers.get("x-owner-token") ?? "";
  if (token && SUPA_URL) {
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) return String((await r.json())?.email ?? "owner");
    } catch { /* fall through */ }
  }
  return "Super Admin password";
}

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const r = await partnerCall<{ staff?: unknown[] }>("staff", { op: "list" }, 12000);
  if (!r.ok) return Response.json({ error: r.data.error ?? `Staff Admin not reachable (${r.status})` }, { status: 502 });
  return Response.json({ staff: r.data.staff ?? [] });
}

const OPS = new Set(["create", "update", "reset", "reset2fa", "logout", "activity"]);

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(b.op ?? "");
  if (!OPS.has(op)) return Response.json({ error: "bad request" }, { status: 400 });
  const body: Record<string, unknown> = { op, by: await who(request) };
  for (const k of ["id", "username", "name", "role", "password", "active"]) if (b[k] !== undefined) body[k] = b[k];
  const r = await partnerCall("staff", body, 15000);
  return Response.json(r.data, { status: r.ok ? 200 : r.status || 502 });
}
