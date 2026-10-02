// Super Admin → one user → "Clear all data" (owner's call, 26 Sep 2026: "Demo_Shubhora ka data complete clear
// karna hai, aur fir se banana hai"). Wipes what the member MADE and keeps who they ARE:
//   removed: V-Cards (and their links, sections, leads, domains), poster profiles (posters, calendar, card facts),
//            products, testimonials, social / Google / WhatsApp connections and their history, CRM, media jobs,
//            and the business details saved with the login (so setup starts again after "About you").
//   kept:    the login (mobile / email / password), the username, name and mobile, the partner ID and team,
//            the plan, credits and wallet — money and the partner tree are never touched here.
// The account then looks like one that has just signed up: the congratulations page, then the profile steps.
// The wipe itself lives in lib/member-wipe.ts (the demo account's own Reset button uses the same one).
//   POST { id, confirm: "<username or email>" } → { ok, cleared: { table: rows } }   Super-admin only.
import { adminAllowed, serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { wipeMemberData } from "@/lib/member-wipe";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });
  const b = (await request.json().catch(() => ({}))) as { id?: unknown; confirm?: unknown };
  const id = String(b.id ?? "");
  if (!UUID.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const h = serviceHeaders();

  const ur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { headers: h, cache: "no-store" });
  if (!ur.ok) return Response.json({ error: "user not found" }, { status: 404 });
  const u = (await ur.json()) as { email?: string; phone?: string; user_metadata?: Record<string, unknown> };
  const pr = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${id}&select=username`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []) as { username?: string | null }[];
  const username = String(pr[0]?.username ?? "");

  // A typed confirmation: the username (or the email / mobile when there is none). Nothing is deleted without it.
  const typed = String(b.confirm ?? "").trim().toLowerCase();
  const accepted = [username, u.email ?? "", (u.phone ?? "").replace(/\D/g, "")].map((x) => x.toLowerCase()).filter(Boolean);
  if (!typed || !accepted.includes(typed.replace(/^\+/, ""))) return Response.json({ error: `Type ${username || "the email"} to confirm.` }, { status: 400 });

  const { ok, cleared } = await wipeMemberData(id, h, u.user_metadata);
  return Response.json({ ok, username, cleared }, { status: ok ? 200 : 207 });
}
