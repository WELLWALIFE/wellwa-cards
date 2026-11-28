// Platform-wide AI training (every card's chat and every WhatsApp bot reads it) — written ONLY here, by the super admin.
// Until 28 Sep 2026 any signed-in account could update the table straight from the browser (0004_platform.sql left the
// write policy open); 0060_security_lock.sql closes that, and the admin pages post here instead.
//   POST { bot_persona?, bot_knowledge?, shubhora_persona?, shubhora_knowledge?, shubhora_faq?, ai_v2?, shubhora_menu? } → { ok }
//   shubhora_menu (an object) is cleaned to known items, languages and http(s) links (bridge/shubhora-menu.mjs).
import { adminAllowed } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { cleanMenuConfig } from "../../../../../bridge/shubhora-menu.mjs";

const FIELDS = ["bot_persona", "bot_knowledge", "shubhora_persona", "shubhora_knowledge", "shubhora_faq", "ai_v2"] as const;

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "Admin only." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const k of FIELDS) if (typeof body[k] === "string") row[k] = (body[k] as string).slice(0, k === "ai_v2" ? 2000 : 200_000);
  if (body.shubhora_menu && typeof body.shubhora_menu === "object") row.shubhora_menu = cleanMenuConfig(body.shubhora_menu);
  if (!Object.keys(row).length) return Response.json({ error: "Nothing to save." }, { status: 400 });
  const admin = getAdminSupabase();
  if (!admin) return Response.json({ error: "The database is not connected." }, { status: 503 });
  const { error } = await admin.from("platform_settings").update({ ...row, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
