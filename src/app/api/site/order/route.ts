// The website order (lib/site-order.ts).
//   GET  (bearer) → where the order stands: { stage, pkg, wanted, until, readyAt, hasCard, receipt }
//   POST (bearer) { op: "change", note } → "Not happy? Tell us": the request goes to Shubhora and the franchise (the first is free)
//   POST (bearer) { op: "start" } → a paid order whose website is not made yet: the build starts on the server (once — a running one is
//                                   joined) and finishes by itself. Called by the thank-you page; safe to call again.
import { NextResponse } from "next/server";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { myCard } from "@/lib/site-server";
import { franchiseOf, notifyFranchise } from "@/lib/franchise-server";
import { notify } from "@/lib/notify";
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
  const b = (await request.json().catch(() => ({}))) as { op?: string; note?: string };
  // "Not happy? Tell us" (owner, 14 Nov 2026): what the owner wants changed goes to Shubhora and to their franchise. The first is free;
  // after that the work is quoted (Customise). Kept on the card (site.changeAsks), so the team sees it on the account.
  if (b.op === "change") {
    const note = String(b.note ?? "").trim().slice(0, 600);
    if (note.length < 5) return NextResponse.json({ error: "Write in a line or two what you want changed." }, { status: 400 });
    if (rateLimited(`site-change:${me.id}`, 3, 24 * 60 * 60_000)) return NextResponse.json({ error: "Your request is already with our team. We will contact you." }, { status: 429 });
    const row = await myCard(me.id);
    if (!row?.data.site) return NextResponse.json({ error: "Your website is not made yet." }, { status: 400 });
    const site = row.data.site as NonNullable<typeof row.data.site> & { changeAsks?: { at: string; note: string }[] };
    const asks = [...(site.changeAsks ?? []), { at: new Date().toISOString(), note }].slice(-10);
    const w = await restAsService(`cards?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...row.data, site: { ...site, changeAsks: asks } } }) });
    if (!w.ok) return NextResponse.json({ error: "Could not send it now. Please try again." }, { status: 500 });
    const free = asks.length === 1;
    const n = { title: free ? "Website change asked (free)" : "Website change asked (to be quoted)", body: `${row.data.company || row.data.name} · /${row.username}: ${note}`.slice(0, 300), ref: `site-change:${row.id}:${asks.length}` };
    const fr = await franchiseOf(me.id).catch(() => null);
    if (fr) await notifyFranchise(fr, n);
    const admins = (await restAsService<{ id: string }[]>("admin_users?franchise_id=is.null&active=is.true&select=id&limit=20")).data;
    await Promise.all((Array.isArray(admins) ? admins : []).map((a) => notify(a.id, "franchise_update", { ...n, path: "/admin/websites" }).catch(() => undefined)));
    return NextResponse.json({ ok: true, free, count: asks.length });
  }
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
