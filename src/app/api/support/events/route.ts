// Live help — the person's screen going out.
//
// The app records its own page with rrweb and posts a batch every couple of seconds while a help session
// is live. Nothing is recorded, and nothing is accepted here, unless that session is live — which only
// happens after the person has agreed to it (/api/support/session).

import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";

/** One batch. A couple of seconds of a page is far smaller than this; the cap is for a runaway page. */
const MAX_BATCH = 900_000;
/** A session keeps roughly this many batches. Older ones go, except the snapshot the console starts from. */
const KEEP_BATCHES = 400;

type Session = { id: string; status: string };

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "sign in" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BATCH) {
    return NextResponse.json({ error: "batch too large" }, { status: 413 });
  }

  // Their own live session, or nothing. The session id is never taken from the browser.
  const s = await restAsService<Session[]>(
    `support_sessions?select=id,status&user_id=eq.${me.id}&status=eq.live&order=created_at.desc&limit=1`,
  );
  const session = s.data?.[0];
  if (!session) return NextResponse.json({ recording: false });

  const body = (await request.json().catch(() => ({}))) as { seq?: unknown; events?: unknown; snapshot?: unknown };
  const events = Array.isArray(body.events) ? body.events : [];
  if (!events.length) return NextResponse.json({ recording: true });

  await restAsService("support_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      session_id: session.id,
      seq: Number.isFinite(Number(body.seq)) ? Math.trunc(Number(body.seq)) : 0,
      snapshot: body.snapshot === true,
      events,
    }),
  });

  // Keep the table from growing through a long session: drop everything before the second-newest full
  // picture once there are plenty of batches. The newest picture and everything after it stay, so a staff
  // member can still join at any moment.
  if (Math.random() < 0.05) {
    const old = await restAsService<{ id: number }[]>(
      `support_events?select=id&session_id=eq.${session.id}&snapshot=is.true&order=id.desc&offset=1&limit=1`,
    );
    const cut = old.data?.[0]?.id;
    const count = await restAsService<{ id: number }[]>(`support_events?select=id&session_id=eq.${session.id}&order=id.desc&limit=${KEEP_BATCHES + 1}`);
    if (cut && (count.data?.length ?? 0) > KEEP_BATCHES) {
      await restAsService(`support_events?session_id=eq.${session.id}&id=lt.${cut}`, {
        method: "DELETE", headers: { Prefer: "return=minimal" },
      });
    }
  }

  return NextResponse.json({ recording: true });
}
