// POST (bearer) { keep, drop, as? } → merge the second customer into the first (migration 0070, crm_merge_leads).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { merge } from "@/lib/crm-pro3";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const r = await merge(scope, String(b.keep ?? ""), String(b.drop ?? ""));
  return r.ok ? NextResponse.json({ ok: true, id: b.keep }) : NextResponse.json({ error: r.error }, { status: 400 });
}
