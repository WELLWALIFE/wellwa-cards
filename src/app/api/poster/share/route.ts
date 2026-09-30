// POST { id } → count a share (used for the "shared N times" streak and analytics)
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: true });
  // Ownership is implied by the unguessable id + the profile join on read.
  const cur = await restAsService<{ shares: number; poster_profiles: { user_id: string } }[]>(`posters?id=eq.${id}&select=shares,poster_profiles!inner(user_id)`);
  const row = cur.data?.[0];
  if (!row || row.poster_profiles.user_id !== me.id) return NextResponse.json({ ok: true });
  await restAsService(`posters?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ shares: (row.shares ?? 0) + 1 }) });
  return NextResponse.json({ ok: true, shares: (row.shares ?? 0) + 1 });
}
