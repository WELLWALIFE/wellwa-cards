// The website order (lib/site-order.ts).
//   GET  (bearer) → where the order stands: { stage, pkg, wanted, until, readyAt, hasCard, receipt }
//   POST (bearer) { op: "start" } → a paid order whose website is not made yet: the build starts on the server (once — a running one is
//                                   joined) and finishes by itself. Called by the thank-you page; safe to call again.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { currentJob } from "@/lib/card-jobs";
import { orderState } from "@/lib/site-order-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json(await orderState(me.id));
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { op?: string };
  if (b.op !== "start") return NextResponse.json({ error: "unknown op" }, { status: 400 });
  const st = await orderState(me.id);
  if (st.stage !== "queued") return NextResponse.json({ ok: true, ...st });
  // A build that just failed is not hammered: the next try waits ten minutes (and three starts an hour at most).
  const last = await currentJob(me.id).catch(() => null);
  if (last?.state === "failed" && last.endedAt && Date.now() - last.endedAt < 10 * 60_000) return NextResponse.json({ ok: true, ...st });
  if (rateLimited(`site-order:${me.id}`, 3, 60 * 60_000)) return NextResponse.json({ ok: true, ...st });
  const origin = `http://127.0.0.1:${process.env.PORT || 3001}`;
  const r = await fetch(`${origin}/api/card/build`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${me.token}` }, body: JSON.stringify({ async: true, order: true, facts: {} }) }).catch(() => null);
  if (!r || !r.ok) console.log("[site-order] build not started", me.id, r?.status);
  return NextResponse.json({ ok: true, ...(await orderState(me.id)) });
}
