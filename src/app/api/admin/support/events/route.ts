// Live help — the person's screen coming in, for the console to replay.
//
//   GET ?id=<session>            → the newest full picture of their page, and everything since
//   GET ?id=<session>&after=<id> → only what has happened since that batch
//
// Open to the owner and to a Staff Admin member sent over for Live help, exactly like the rest of
// /api/admin/support.

import { adminAllowedFor, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

/** Enough batches for a console that has been away a moment; it asks again straight after. */
const PAGE = 120;

type Batch = { id: number; snapshot: boolean; events: unknown[] };

async function rest<T>(pathAndQuery: string): Promise<T | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, { headers: serviceHeaders(), cache: "no-store" });
  const text = await r.text();
  try { return text ? (JSON.parse(text) as T) : null; } catch { return null; }
}

export async function GET(request: Request) {
  if (!(await adminAllowedFor(request, "support"))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").slice(0, 60);
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "which session?" }, { status: 400 });
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw !== null && /^\d+$/.test(afterRaw) ? Number(afterRaw) : null;

  // Joining (or re-joining): start from the newest complete picture of the page, so the replay has
  // something to build on. Catching up: just what is new.
  let from = after;
  if (from === null) {
    const snap = await rest<{ id: number }[]>(`support_events?select=id&session_id=eq.${id}&snapshot=is.true&order=id.desc&limit=1`);
    from = snap?.[0]?.id ? snap[0].id - 1 : 0;
  }

  const rows = await rest<Batch[]>(
    `support_events?select=id,snapshot,events&session_id=eq.${id}&id=gt.${from}&order=id.asc&limit=${PAGE}`,
  ) ?? [];

  return Response.json({
    // Flattened: the console feeds these straight into the replay, in order.
    events: rows.flatMap((r) => (Array.isArray(r.events) ? r.events : [])),
    last: rows.length ? rows[rows.length - 1].id : from,
    // True when this answer begins with a complete picture — the console starts a fresh replay on it.
    fresh: after === null,
    more: rows.length === PAGE,
  });
}
