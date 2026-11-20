// What this login is to Shubhora, for the Shubhora website the set-up makes (owner, 20 Nov 2026: "official account bana do — as a
// company, as a franchise, dono"):
//   official   the company's own account — Super Admin → Users → the account → "Shubhora Official" (app_metadata.shubhora_official,
//              which a login cannot write for itself)
//   franchise  the login that owns an active franchise (franchises.owner_user_id)
//   partner    everyone else
// It only changes how the Shubhora website introduces itself ("Shubhora", "Shubhora Franchise · Jaipur", "Shubhora Partner").
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const u = await fetch(`${SUPA_URL}/auth/v1/admin/users/${me.id}`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { app_metadata?: { shubhora_official?: unknown } } | null;
  if (u?.app_metadata?.shubhora_official === true) return NextResponse.json({ role: "official" });
  const fr = await restAsService<{ name: string | null; company: string | null; city: string | null; area: string | null; state: string | null }[]>(`franchises?owner_user_id=eq.${me.id}&status=eq.active&select=name,company,city,area,state&limit=1`).catch(() => null);
  const f = Array.isArray(fr?.data) ? fr!.data![0] : null;
  if (f) return NextResponse.json({ role: "franchise", franchise: { name: f.company || f.name || "", city: f.city || "", area: f.area || f.state || "" } });
  return NextResponse.json({ role: "partner" });
}
