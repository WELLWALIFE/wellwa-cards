// "Clear all data" for one member — shared by Super Admin → user → Clear all data and by the demo account's own
// Reset button (owner's call, 2 Oct 2026: a demo account that anyone can wipe back to fresh after a demo).
// Wipes what the member MADE and keeps who they ARE:
//   removed: V-Cards (and their links, sections, leads, domains), poster profiles (posters, calendar, card facts),
//            products, testimonials, social / Google / WhatsApp connections and their history, CRM, media jobs,
//            the WhatsApp link on the bridge, and the business details saved with the login.
//   kept:    the login, the username, name and mobile, the partner ID and team, the plan, credits and wallet.
// The account is stamped data_cleared_at so the owner's phone drops its own copies of the old answers.
import { SUPA_URL } from "@/lib/admin-guard";

// [table, owner column] — in an order where nothing is still pointed at when it goes (cards cascade their own rows).
const TABLES: [string, string][] = [
  ["leads", "owner_id"], ["lead_events", "owner_id"], ["card_domains", "owner_id"], ["cards", "owner_id"],
  ["poster_calendar", "user_id"], ["poster_testimonials", "user_id"], ["poster_products", "user_id"], ["poster_profiles", "user_id"],
  ["social_posts", "user_id"], ["social_replies", "user_id"], ["social_accounts", "user_id"], ["google_accounts", "user_id"],
  ["wa_broadcast_items", "owner_id"], ["wa_broadcasts", "owner_id"], ["wa_messages", "owner_id"], ["wa_templates", "owner_id"],
  ["wa_flows", "owner_id"], ["wa_cloud_accounts", "owner_id"], ["crm_outbox", "owner_id"], ["crm_integrations", "owner_id"],
  ["crm_agents", "owner_id"], ["bot_learning", "user_id"], ["media_jobs", "owner_id"],
  ["poster_offers", "user_id"], ["ad_campaigns", "user_id"],
];
// Saved with the login by the setup; the rest of user_metadata (name, mobile, DOB, introducer, partner code, the
// demo flag) stays. home_city / home_address and whatsapp are profile step 1's answers, so they go too.
// contact_email is NOT here: for a mobile sign-up it is the person's email (like name and mobile), shown and edited in
// Super Admin; a clear used to wipe it, and the demo tooling could no longer find the account by it.
const SETUP_KEYS = ["business", "photo_url", "promote", "setup_done", "kb", "also_shubhora", "setup_skipped_at", "home_city", "home_address", "you_done_at", "setup_pos", "whatsapp"];
const BRIDGE = "http://127.0.0.1:8787";

export async function wipeMemberData(id: string, h: Record<string, string>, userMetadata: Record<string, unknown> | undefined): Promise<{ ok: boolean; cleared: Record<string, number | string> }> {
  const cleared: Record<string, number | string> = {};
  const slugs: string[] = [];
  for (const [table, col] of TABLES) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${col}=eq.${id}`, { method: "DELETE", headers: { ...h, Prefer: "return=representation" } });
    if (r.ok) {
      const rows = (await r.json().catch(() => [])) as { username?: string }[];
      if (rows.length) cleared[table] = rows.length;
      if (table === "cards") for (const c of rows) if (c.username) slugs.push(c.username);
    }
    else if (r.status !== 404) cleared[table] = `failed ${r.status}`;   // 404 = that table is not in this database
  }
  // The views and taps counted for those cards (kept by slug, not by owner): a card made again under the same
  // link starts its counts from zero.
  if (slugs.length) {
    const r = await fetch(`${SUPA_URL}/rest/v1/card_events?username=in.(${slugs.map((u) => `"${u.replace(/"/g, "")}"`).join(",")})`, { method: "DELETE", headers: { ...h, Prefer: "return=representation" } });
    if (r.ok) { const rows = (await r.json().catch(() => [])) as unknown[]; if (rows.length) cleared.card_events = rows.length; }
    else if (r.status !== 404) cleared.card_events = `failed ${r.status}`;
  }
  // The setup's answers go, and the account is stamped with the time of the wipe: a phone that still holds this
  // account's drafts (the setup, the V-Card form, the built preview) drops them when it next opens — see
  // lib/local-reset.ts. Always written, so the account's version moves even when nothing was saved yet.
  const md = { ...(userMetadata ?? {}) } as Record<string, unknown>;
  // null, not delete: Supabase MERGES user_metadata on an admin update, so a key left out of the body stays as it
  // was — the old business, trade and About came back after every clear (owner, 4 Oct 2026). null removes the key.
  for (const k of SETUP_KEYS) md[k] = null;
  md.data_cleared_at = new Date().toISOString();
  {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { method: "PUT", headers: h, body: JSON.stringify({ user_metadata: md }) });
    cleared.setup_details = r.ok ? "cleared" : `failed ${r.status}`;
  }
  // The WhatsApp number linked on the bridge (best effort: the bridge may be down or the number never linked).
  try {
    const r = await fetch(`${BRIDGE}/logout`, { method: "POST", headers: { "X-Shubhora-User": id, "X-Shubhora-Plan-Expires": "2999-12-31T23:59:59.000Z", "X-Shubhora-Ai-Until": "none", "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(6000) });
    if (r.ok) cleared.whatsapp_link = "cleared";
  } catch { /* not linked, or the bridge is not running */ }
  const failed = Object.entries(cleared).filter(([, v]) => typeof v === "string" && v.startsWith("failed"));
  return { ok: failed.length === 0, cleared };
}
