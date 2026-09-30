// Super Admin → which app account belongs to which partner ID.
// The SH code is the identity. An ID and an app account are tied only by the account id (kept in the partner panel as
// suite_user_id) — never by a matching email or mobile. The account's `associate_id` (what the app shows as "your
// partner ID") is only a copy of that tie, and "repair" rewrites every copy from the partner panel.
//   POST { op: "repair" }                         → every account's associate_id = the ID tied to it (or none)
//   POST { op: "link", code, account }            → tie ID `code` to the app account (`account` = email or user id)
//   POST { op: "unlink", code }                   → untie ID `code` from its app account
import { adminAllowed, serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { partnerCall } from "@/lib/partner-link";

type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };

async function allAuthUsers(): Promise<AuthUser[]> {
  const out: AuthUser[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: serviceHeaders(), cache: "no-store" });
    if (!r.ok) { if (page === 1) throw new Error(`auth users: ${r.status}`); break; }
    const list: AuthUser[] = (await r.json()).users ?? [];
    out.push(...list);
    if (list.length < 1000) break;
  }
  return out;
}

async function getUser(id: string): Promise<AuthUser | null> {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { headers: serviceHeaders(), cache: "no-store" });
  return r.ok ? r.json() : null;
}

async function setAssociate(u: AuthUser, code: string) {
  // user_metadata is merged by the API, so an empty string (not a missing key) is what clears it.
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${u.id}`, {
    method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ user_metadata: { ...(u.user_metadata ?? {}), associate_id: code } }),
  });
  if (!r.ok) throw new Error(`could not update ${u.email ?? u.id}`);
}

/** Who is doing it, for the partner panel's activity log. */
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "not configured" }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const op = String(b.op ?? "");
  const code = String(b.code ?? "").trim().toUpperCase();

  try {
    if (op === "repair") {
      const pm = await partnerCall<{ members?: { code: string; suiteUserId: string | null }[] }>("members", {}, 15000);
      if (!pm.ok || !Array.isArray(pm.data.members)) return Response.json({ error: pm.data.error ?? "partner panel not reachable" }, { status: 502 });
      const tie = new Map(pm.data.members.filter((m) => m.suiteUserId).map((m) => [m.suiteUserId as string, m.code]));
      const changes: { email: string; from: string; to: string }[] = [];
      for (const u of await allAuthUsers()) {
        const have = typeof u.user_metadata?.associate_id === "string" ? (u.user_metadata.associate_id as string) : "";
        const want = tie.get(u.id) ?? "";
        if (have === want) continue;
        await setAssociate(u, want);
        changes.push({ email: u.email ?? u.id, from: have, to: want });
      }
      return Response.json({ ok: true, changes });
    }

    if (!/^[A-Z]{1,6}\d{3,10}$/.test(code)) return Response.json({ error: "Enter a partner ID like SH100053." }, { status: 400 });

    if (op === "unlink") {
      const r = await partnerCall<{ suiteUserId?: string | null }>("unlink", { code, by: await who(request) });
      if (!r.ok) return Response.json({ error: r.data.error ?? "partner panel not reachable" }, { status: r.status || 502 });
      const uid = r.data.suiteUserId;
      if (uid) {
        const u = await getUser(uid);
        if (u && u.user_metadata?.associate_id === code) await setAssociate(u, "");
      }
      return Response.json({ ok: true, code, unlinked: uid ?? null });
    }

    if (op === "link") {
      const account = String(b.account ?? "").trim().toLowerCase();
      let u: AuthUser | null = null;
      if (UUID.test(account)) u = await getUser(account);
      else if (account.includes("@")) u = (await allAuthUsers()).find((x) => (x.email ?? "").toLowerCase() === account) ?? null;
      if (!u) return Response.json({ error: "No app account with that email / id." }, { status: 404 });
      const r = await partnerCall("link", { code, suiteUserId: u.id, email: u.email ?? "", by: await who(request) });
      if (!r.ok) return Response.json({ error: r.data.error ?? "partner panel not reachable" }, { status: r.status || 502 });
      await setAssociate(u, code);
      return Response.json({ ok: true, code, account: u.email ?? u.id });
    }

    return Response.json({ error: "bad request" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
