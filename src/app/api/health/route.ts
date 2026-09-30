import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const admin = getAdminSupabase();
  if (!admin) return Response.json({ ok: false, database: false }, { status: 503 });
  const { error } = await admin.from("platform_settings").select("id").limit(1);
  if (error) return Response.json({ ok: false, database: false }, { status: 503 });
  return Response.json({ ok: true, database: true, version: process.env.APP_VERSION || "current" });
}
