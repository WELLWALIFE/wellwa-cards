// The shop's items, their measurement fields, the kinds of work and the unit (bearer; ?as= / body.as).
//   GET → { setup, canEdit }      PUT { setup } → { setup }   (owner / manager)
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { addonGate } from "@/lib/addons-server";
import { resolveScope } from "@/lib/crm-server";
import { jobSetup, saveJobSetup } from "@/lib/jobs-server";
import { cleanSetup } from "@/lib/jobs";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const gate = await addonGate(scope.ownerId, "orders"); if (gate) return gate;
  return NextResponse.json({ setup: await jobSetup(scope.ownerId), canEdit: scope.role !== "agent" });
}

export async function PUT(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || scope.role === "agent") return NextResponse.json({ error: "Only the owner or a manager can change the setup." }, { status: 403 });
  const gate = await addonGate(scope.ownerId, "orders"); if (gate) return gate;
  const setup = cleanSetup(b.setup);
  if (!setup.items.length) return NextResponse.json({ error: "Keep at least one item." }, { status: 400 });
  if (!(await saveJobSetup(scope.ownerId, setup))) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  return NextResponse.json({ setup });
}
