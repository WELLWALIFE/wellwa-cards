// POST (bearer) { id, status: "ACTIVE" | "PAUSED" } → start or pause one of the owner's campaigns.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { fbAccount, setCampaignStatus, isPermissionError, type CampaignRow } from "@/lib/ads-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const status = b.status === "ACTIVE" ? "ACTIVE" : b.status === "PAUSED" ? "PAUSED" : null;
  if (!status || typeof b.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const row = (await restAsService<CampaignRow[]>(`ad_campaigns?id=eq.${b.id}&user_id=eq.${me.id}&select=*`)).data?.[0];
  if (!row) return NextResponse.json({ error: "Ad not found." }, { status: 404 });
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ error: "Connect Facebook first." }, { status: 400 });
  try {
    await setCampaignStatus(fb, row.campaign_id, status);
    await restAsService(`ad_campaigns?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString(), ...(status === "ACTIVE" && !("started_at" in row && (row as unknown as { started_at?: string }).started_at) ? { started_at: new Date().toISOString() } : {}) }) });
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: isPermissionError(msg) ? "Facebook has not allowed ads for this login yet — reconnect Facebook in Connections." : msg.slice(0, 300) }, { status: 400 });
  }
}
