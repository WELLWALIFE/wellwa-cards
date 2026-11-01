import { getAdminSupabase } from "@/lib/supabase/admin";
import { DEPLOY_ID } from "@/lib/deploy-id";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

export async function GET(request: Request) {
  const admin = getAdminSupabase();
  if (!admin) return Response.json({ ok: false, database: false }, { status: 503 });
  const { error } = await admin.from("platform_settings").select("id").limit(1);
  if (error) return Response.json({ ok: false, database: false }, { status: 503 });
  const body: Record<string, unknown> = { ok: true, database: true, version: process.env.APP_VERSION || "current", deploy: DEPLOY_ID };
  // ?probe=1 (owner, 1 Nov 2026 "slow nahi chalna chahiye"): how long ONE trip from this server to the database takes, three times in a
  // row, with the database's own processing time — so distance (network) and a slow query can be told apart. No data is returned.
  if (new URL(request.url).searchParams.get("probe") === "1") {
    const trips: { ms: number; dbMs: number | null; via: string | null }[] = [];
    for (let i = 0; i < 3; i += 1) {
      const t = Date.now();
      const r = await fetch(`${SUPA_URL}/rest/v1/platform_settings?select=id&limit=1`, { headers: serviceHeaders(), cache: "no-store" }).catch(() => null);
      await r?.text().catch(() => "");
      const up = r?.headers.get("x-envoy-upstream-service-time");
      // cf-ray ends in the Cloudflare site that answered the server (SIN, BOM, IAD…): roughly where the server sits.
      trips.push({ ms: Date.now() - t, dbMs: up ? Number(up) : null, via: r?.headers.get("cf-ray")?.split("-")[1] ?? null });
    }
    body.probe = { trips, region: process.env.SUPABASE_REGION_HINT || null, node: process.version };
  }
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
