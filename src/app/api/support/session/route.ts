// Live help — the card holder's side.
//
//   GET   → my open session, if there is one (a staff invite waiting for an answer, or a live session)
//   POST  → request / accept / decline / end / ping
//
// A session only reports anything while it is "live", and it only becomes live when both sides agreed:
// the person asked for help, or staff asked and the person said yes. The person can end it at any time.

import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";

/** No report from the app for this long and the session is treated as gone (closed tab, phone asleep). */
const STALE_MS = 90_000;
/** An invite nobody answers does not sit there for ever. */
const INVITE_MS = 5 * 60_000;

type Row = {
  id: string; user_id: string; status: "requested" | "invited" | "live" | "ended"; opened_by: "user" | "staff";
  staff_name: string | null; note: string | null; user_path: string | null;
  guide_path: string | null; guide_at: string | null; user_seen_at: string | null; created_at: string;
};

/** Staff may only send someone to a screen inside their own app — never to an outside address. */
function safePath(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^\/poster(\/[\w\-/[\]]*)?$/.test(s) && s.length < 200 && !s.includes("//") ? s : null;
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

async function openSession(userId: string): Promise<Row | null> {
  const r = await restAsService<Row[]>(
    `support_sessions?user_id=eq.${userId}&status=neq.ended&order=created_at.desc&limit=1`,
  );
  return r.data?.[0] ?? null;
}

async function patch(id: string, body: Record<string, unknown>) {
  await restAsService(`support_sessions?id=eq.${id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body),
  });
}

/** What the person's app is told. Never the staff's own notes — only who is helping. */
function shape(s: Row | null) {
  if (!s) return null;
  return {
    id: s.id,
    status: s.status,
    staffName: s.staff_name ?? null,
    guidePath: s.guide_path ?? null,
    guideAt: s.guide_at ?? null,
    since: s.created_at,
  };
}

/** An invite nobody answered, or a live session whose app stopped reporting, is over. */
async function expire(s: Row | null): Promise<Row | null> {
  if (!s) return null;
  const age = Date.now() - new Date(s.created_at).getTime();
  const quiet = s.user_seen_at ? Date.now() - new Date(s.user_seen_at).getTime() : age;
  const over = (s.status === "invited" && age > INVITE_MS) || (s.status === "live" && quiet > STALE_MS * 4);
  if (!over) return s;
  await patch(s.id, { status: "ended", ended_at: new Date().toISOString() });
  return null;
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const s = await expire(await openSession(me.id));
  return NextResponse.json({ session: shape(s) });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "sign in" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 8_000) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(body.action, 20);
  const now = new Date().toISOString();
  const current = await expire(await openSession(me.id));

  if (action === "request") {
    // Already waiting or already being helped: nothing new to open.
    if (current) return NextResponse.json({ session: shape(current) });
    const r = await restAsService<Row[]>("support_sessions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: me.id, status: "requested", opened_by: "user",
        note: str(body.note, 300), user_path: safePath(body.path), user_seen_at: now,
      }),
    });
    return NextResponse.json({ session: shape(r.data?.[0] ?? null) });
  }

  if (!current) return NextResponse.json({ session: null });

  if (action === "accept") {
    if (current.status !== "invited") return NextResponse.json({ session: shape(current) });
    await patch(current.id, { status: "live", user_seen_at: now, user_path: safePath(body.path) ?? current.user_path });
    return NextResponse.json({ session: shape({ ...current, status: "live" }) });
  }

  if (action === "decline" || action === "end") {
    await patch(current.id, { status: "ended", ended_at: now });
    return NextResponse.json({ session: null });
  }

  if (action === "ping") {
    // Only a live session reports the screen. A session still waiting for an answer reports nothing.
    if (current.status !== "live") return NextResponse.json({ session: shape(current) });
    await patch(current.id, {
      user_seen_at: now,
      user_path: safePath(body.path) ?? current.user_path,
      // Small and plain: the screen, the step, and what the card is still missing. Never what they type.
      user_state: {
        screen: str((body.state as Record<string, unknown>)?.screen, 60),
        step: str((body.state as Record<string, unknown>)?.step, 60),
        missing: (Array.isArray((body.state as Record<string, unknown>)?.missing)
          ? ((body.state as Record<string, unknown>).missing as unknown[])
          : []).slice(0, 10).map((x) => str(x, 40)).filter(Boolean),
      },
    });
    return NextResponse.json({ session: shape(current) });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
