// Super admin: block/unblock or verify a card for real (WhatsApp bot + public
// page + lead capture all read the same `active` column, so this is a true
// platform-wide kill switch, not a display-only toggle).

import { NextResponse } from "next/server";
import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

export async function PATCH(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const patch: Record<string, boolean> = {};
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.verified === "boolean") patch.verified = b.verified;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Send active or verified." }, { status: 400 });

  // "verified" lives inside the card's JSON blob, not a column — merge it in.
  if ("verified" in patch) {
    const cur = await fetch(`${SUPA_URL}/rest/v1/cards?id=eq.${id}&select=data`, { headers: serviceHeaders() });
    const rows = cur.ok ? await cur.json() : [];
    const data = { ...(rows?.[0]?.data ?? {}), verified: patch.verified };
    delete patch.verified;
    const r = await fetch(`${SUPA_URL}/rest/v1/cards?id=eq.${id}`, {
      method: "PATCH", headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, data }),
    });
    if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const r = await fetch(`${SUPA_URL}/rest/v1/cards?id=eq.${id}`, {
    method: "PATCH", headers: serviceHeaders(),
    body: JSON.stringify(patch),
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
  return NextResponse.json({ ok: true });
}
