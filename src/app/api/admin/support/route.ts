// Live help — the staff side (Super Admin → Live help).
//
//   GET   → everyone asking for help, everyone being helped, and who they are
//   POST  → invite (ask to help someone) / guide (send them to a screen) / end
//
// Nobody is watched without agreeing to it: "invite" only puts the question on their phone. The session
// starts reporting their screen when they answer yes (/api/support/session).

import { adminAllowedFor, adminIdentity, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";
import { screenName } from "@/lib/help-screens";

/** The app reports every 5 seconds while live. Miss a handful of those and whatever is on screen here is no
 *  longer what the person is looking at — usually because their phone went to sleep or they switched to
 *  another app, which stops the browser's timers. Say so rather than letting staff trust an old screen. */
const STALE_MS = 25_000;

type Row = {
  id: string; user_id: string; status: "requested" | "invited" | "live" | "ended"; opened_by: "user" | "staff";
  staff_name: string | null; note: string | null; user_path: string | null;
  user_state: { screen?: string; step?: string; missing?: string[] } | null;
  guide_path: string | null; guide_at: string | null; user_seen_at: string | null; created_at: string;
};

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** The same rule the person's app enforces: staff may only send someone inside the app. */
function safePath(v: unknown): string | null {
  const s = str(v, 200);
  return /^\/poster(\/[\w\-/[\]]*)?$/.test(s) && !s.includes("//") ? s : null;
}

async function rest<T>(pathAndQuery: string, init?: RequestInit): Promise<T | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, {
    ...init, headers: { ...serviceHeaders(), ...(init?.headers ?? {}) }, cache: "no-store",
  });
  const text = await r.text();
  try { return text ? (JSON.parse(text) as T) : null; } catch { return null; }
}

export async function GET(request: Request) {
  if (!(await adminAllowedFor(request, "support"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ sessions: [], configured: false });

  const rows = (await rest<Row[]>("support_sessions?status=neq.ended&order=created_at.desc&limit=50")) ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const h = serviceHeaders();

  // Who they are, and the card they are building — so a staff member knows who they are talking to and can
  // open the card itself beside the session.
  const [people, cards] = await Promise.all([
    Promise.all(ids.map(async (id) => {
      const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { headers: h, cache: "no-store" });
      if (!r.ok) return [id, null] as const;
      const u = await r.json();
      const md = (u?.user_metadata ?? {}) as Record<string, unknown>;
      return [id, { name: str(md.display_name || md.full_name, 60), phone: str(u?.phone || md.phone, 20), email: str(u?.email, 120) }] as const;
    })),
    ids.length
      ? rest<{ owner_id: string; username: string }[]>(`cards?select=owner_id,username&owner_id=in.(${ids.join(",")})`)
      : Promise.resolve([]),
  ]);
  const who = Object.fromEntries(people);
  const cardOf = Object.fromEntries((cards ?? []).map((c) => [c.owner_id, c.username]));

  return Response.json({
    configured: true,
    sessions: rows.map((s) => {
      const quiet = s.user_seen_at ? Date.now() - new Date(s.user_seen_at).getTime() : null;
      return {
        id: s.id,
        userId: s.user_id,
        status: s.status,
        openedBy: s.opened_by,
        staffName: s.staff_name,
        note: s.note,
        since: s.created_at,
        path: s.user_path,
        screen: s.user_path ? screenName(s.user_path) : null,
        state: s.user_state ?? {},
        guidePath: s.guide_path,
        lastSeen: s.user_seen_at,
        // Live but silent for a while: the phone is asleep or the app is closed. Say so rather than
        // showing a stale screen as if it were current.
        quiet: s.status === "live" && quiet !== null && quiet > STALE_MS,
        person: who[s.user_id] ?? null,
        cardUsername: cardOf[s.user_id] ?? null,
      };
    }),
  });
}

export async function POST(request: Request) {
  const me = await adminIdentity(request);
  if (!me || (me.scope !== "all" && me.scope !== "support")) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "not configured" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(body.action, 20);
  // A Staff Admin member helps under the name their panel sent them over with — taken from the signed
  // handoff, not from the browser, so nobody can appear to the card holder as somebody else. The owner,
  // who came in with the password, types their own name at the console.
  const staffName = (me.scope === "support" ? str(me.sub, 60) : str(body.staffName, 60)) || "Shubhora support";
  const now = new Date().toISOString();

  if (action === "invite") {
    // Who to ask: the account id, or the username they are known by.
    let userId = str(body.userId, 60);
    if (!userId) {
      const username = str(body.username, 40);
      if (!username) return Response.json({ error: "Give a username or a user id." }, { status: 400 });
      const p = await rest<{ id: string }[]>(`profiles?select=id&username=eq.${encodeURIComponent(username)}&limit=1`);
      userId = p?.[0]?.id ?? "";
      if (!userId) return Response.json({ error: `No account with the username “${username}”.` }, { status: 404 });
    }
    // One open session per person: asking again while one is open just returns it.
    const open = await rest<Row[]>(`support_sessions?user_id=eq.${userId}&status=neq.ended&limit=1`);
    if (open?.[0]) return Response.json({ session: open[0], already: true });
    const made = await rest<Row[]>("support_sessions", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: userId, status: "invited", opened_by: "staff", staff_name: staffName }),
    });
    return Response.json({ session: made?.[0] ?? null });
  }

  const id = str(body.id, 60);
  if (!id) return Response.json({ error: "Which session?" }, { status: 400 });

  if (action === "pickup") {
    // A person who asked for help; a staff member takes it. They already asked, so it goes straight to live.
    await rest(`support_sessions?id=eq.${id}&status=eq.requested`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "live", staff_name: staffName, staff_seen_at: now }),
    });
    return Response.json({ ok: true });
  }

  if (action === "guide") {
    const path = safePath(body.path);
    if (!path) return Response.json({ error: "That is not a screen inside the app." }, { status: 400 });
    // Only a live session may be steered — never someone who has not said yes.
    await rest(`support_sessions?id=eq.${id}&status=eq.live`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ guide_path: path, guide_at: now, staff_seen_at: now }),
    });
    return Response.json({ ok: true });
  }

  if (action === "end") {
    await rest(`support_sessions?id=eq.${id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "ended", ended_at: now }),
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
