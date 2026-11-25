// Super Admin → Leads (owner, 25 Nov 2026): every lead the platform's own website brought — the contact form and the free Google
// check — newest first, with the card it also went to. PATCH { id, status } marks one contacted / closed.
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/admin-guard";
import { restAsService } from "@/lib/poster-server";

type Row = { id: number; created_at: string; source: string; name: string; phone: string; email: string; message: string; card: string; status: string };

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await restAsService<Row[]>("site_leads?select=id,created_at,source,name,phone,email,message,card,status&order=created_at.desc&limit=500");
  if (!r.ok) return NextResponse.json({ leads: [], missing: true });
  return NextResponse.json({ leads: Array.isArray(r.data) ? r.data : [] });
}

export async function PATCH(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id); const status = String(b.status ?? "");
  if (!Number.isInteger(id) || !["new", "contacted", "closed"].includes(status)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const r = await restAsService(`site_leads?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status }) });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not save." }, { status: 502 });
}

/** Removes one lead from the Admin list for good (a test, a wrong number). The copy on a card's own Leads is not touched. */
export async function DELETE(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const r = await restAsService(`site_leads?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not delete." }, { status: 502 });
}
