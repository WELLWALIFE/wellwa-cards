// POST (bearer) { ids: [], action: assign|stage|tag|untag|send, value, as? } → { done, failed, skipped } (docs/crm-pro.md 3.2).
// "send" goes from the owner's own linked WhatsApp, paced, skipping opted-out customers; {name} = first name.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { bulk, type BulkAction } from "@/lib/crm-pro2";

export const maxDuration = 300;
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const action = b.action as BulkAction;
  if (!["assign", "stage", "tag", "untag", "send"].includes(action) || !Array.isArray(b.ids)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (scope.role === "agent" && action !== "tag" && action !== "untag") return NextResponse.json({ error: "Only the owner or a manager can do this." }, { status: 403 });
  return NextResponse.json(await bulk(scope, b.ids.map(String), action, typeof b.value === "string" ? b.value : null));
}
