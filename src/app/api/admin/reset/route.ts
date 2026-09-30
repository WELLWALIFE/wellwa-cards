// Super Admin → one user → "Clear all data" (owner's call, 26 Sep 2026: "Demo_Shubhora ka data complete clear
// karna hai, aur fir se banana hai"). Wipes what the member MADE and keeps who they ARE:
//   removed: V-Cards (and their links, sections, leads, domains), poster profiles (posters, calendar, card facts),
//            products, testimonials, social / Google / WhatsApp connections and their history, CRM, media jobs,
//            and the business details saved with the login (so setup starts again after "About you").
//   kept:    the login (mobile / email / password), the username, name and mobile, the partner ID and team,
//            the plan, credits and wallet — money and the partner tree are never touched here.
// The account then looks like one that has just signed up: setup opens on "What is your card for?".
//   POST { id, confirm: "<username or email>" } → { ok, cleared: { table: rows } }   Super-admin only.
import { adminAllowed, serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

const UUID = /^[0-9a-f-]{36}$/i;

// [table, owner column] — in an order where nothing is still pointed at when it goes (cards cascade their own rows).
const TABLES: [string, string][] = [
  ["leads", "owner_id"], ["lead_events", "owner_id"], ["card_domains", "owner_id"], ["cards", "owner_id"],
  ["poster_calendar", "user_id"], ["poster_testimonials", "user_id"], ["poster_products", "user_id"], ["poster_profiles", "user_id"],
  ["social_posts", "user_id"], ["social_replies", "user_id"], ["social_accounts", "user_id"], ["google_accounts", "user_id"],
  ["wa_broadcast_items", "owner_id"], ["wa_broadcasts", "owner_id"], ["wa_messages", "owner_id"], ["wa_templates", "owner_id"],
  ["wa_flows", "owner_id"], ["wa_cloud_accounts", "owner_id"], ["crm_outbox", "owner_id"], ["crm_integrations", "owner_id"],
  ["crm_agents", "owner_id"], ["bot_learning", "user_id"], ["media_jobs", "owner_id"],
];
// Saved with the login by the setup; the rest of user_metadata (name, mobile, DOB, introducer, partner code) stays.
const SETUP_KEYS = ["business", "photo_url", "promote", "setup_done", "kb"];

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

  const cleared: Record<string, number | string> = {};
  for (const [table, col] of TABLES) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${col}=eq.${id}`, { method: "DELETE", headers: { ...h, Prefer: "return=representation" } });
    if (r.ok) { const rows = (await r.json().catch(() => [])) as unknown[]; if (rows.length) cleared[table] = rows.length; }
    else if (r.status !== 404) cleared[table] = `failed ${r.status}`;   // 404 = that table is not in this database
  }

  const md = { ...(u.user_metadata ?? {}) } as Record<string, unknown>;
  if (SETUP_KEYS.some((k) => k in md)) {
    for (const k of SETUP_KEYS) delete md[k];
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { method: "PUT", headers: h, body: JSON.stringify({ user_metadata: md }) });
    cleared.setup_details = r.ok ? "cleared" : `failed ${r.status}`;
  }
  const failed = Object.entries(cleared).filter(([, v]) => typeof v === "string" && v.startsWith("failed"));
  return Response.json({ ok: failed.length === 0, username, cleared }, { status: failed.length ? 207 : 200 });
}
