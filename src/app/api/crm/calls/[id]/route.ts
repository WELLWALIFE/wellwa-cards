// GET (bearer) /api/crm/calls/<id> → the live state of one call (the calling screen polls this every 3 s).
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { isUuid, CALL_COLS, type CallRow } from "@/lib/crm-pro";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params;
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope || !isUuid(id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const call = (await restAsService<CallRow[]>(`crm_calls?id=eq.${id}&owner_id=eq.${scope.ownerId}&select=${CALL_COLS}&limit=1`)).data?.[0];
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  return NextResponse.json({ call });
}
