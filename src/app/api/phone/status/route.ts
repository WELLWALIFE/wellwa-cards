// Exotel status callback for click-to-call (docs/crm-pro.md 3.7). Exotel POSTs JSON or a form when a call ends;
// the URL carries ?k=<CRON_KEY> (set when the call was placed) so nobody else can mark calls. By Sid → crm_calls row.
import { NextResponse } from "next/server";
import { applyCallStatus } from "@/lib/crm-pro2";

export async function POST(request: Request) {
  const u = new URL(request.url);
  const key = process.env.CRON_KEY || process.env.INTERNAL_KEY || "";
  if (!key || u.searchParams.get("k") !== key) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: Record<string, unknown> = {};
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("json")) b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  else { const f = await request.formData().catch(() => null); if (f) for (const [k, v] of f.entries()) b[k] = typeof v === "string" ? v : ""; }
  const ok = await applyCallStatus(b);
  return NextResponse.json({ ok });
}
export async function GET() { return NextResponse.json({ ok: true }); }
