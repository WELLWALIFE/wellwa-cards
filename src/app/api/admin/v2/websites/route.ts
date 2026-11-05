// Super Admin → Websites (owner, 2 Nov 2026: "auto after 24 hr live, sath me admin me live ka option; 24 hr se pehle live karna ho to
// Live dabao; pause karni ho to admin se pause"). The waiting time itself is lib/site-ready.ts + the hourly /api/cron/site-live.
//   GET  ?filter=waiting|paused|live|all → websites still waiting, paused, or made live in the last 7 days (scope applied)
//   POST { id, action: "live" | "pause" | "resume" }
// "live" shows the website (and a first Premium design) to visitors now and sends the "your website is live" message; "pause" holds the
// website for visitors (the card shows) and stops the clock; "resume" lets it show again (its due time, if past, shows at once).
import { NextResponse } from "next/server";
import { requireAdmin, audit, userInScope } from "@/lib/admin-v2";
import { svc } from "@/lib/service";
import { tellSiteLive } from "@/lib/site-live-server";

type Row = { id: string; owner_id: string; username: string; name: string | null; created_at: string; site_paused?: boolean; ready: string | null; adv: string | null; told: string | null; enabled: string | null; company: string | null };
const COLS = "id,owner_id,username,name,created_at,ready:data->site->>readyAt,adv:data->site->>advancedReadyAt,told:data->site->>liveToldAt,enabled:data->site->>enabled,company:data->>company";

export async function GET(request: Request) {
  const g = await requireAdmin(request, "users.view"); if (!g.ok) return g.res;
  const week = new Date(Date.now() - 7 * 86400e3).toISOString();
  const base = `or=(data->site->>readyAt.not.is.null,data->site->>advancedReadyAt.not.is.null,data->site->>liveToldAt.gte.${week}`;
  // A franchise login: its own users' cards are asked for directly (filtering a capped list afterwards could miss them).
  const scope = g.me.franchiseId ? (!g.me.franchiseIds?.length ? [] : ((await svc<{ id: string }[]>(`profiles?franchise_id=in.(${g.me.franchiseIds.join(",")})&select=id&limit=5000`)).data ?? []).map((p) => p.id)) : null;
  if (scope && !scope.length) return NextResponse.json({ pauseReady: true, websites: [] });
  const chunks = scope ? Array.from({ length: Math.ceil(scope.length / 150) }, (_, i) => `&owner_id=in.(${scope.slice(i * 150, i * 150 + 150).join(",")})`) : [""];
  // With migration 0085 the paused ones are listed too; without it the column does not exist and the list is read without it.
  let pauseReady = true;
  let rows: Row[] = [];
  for (const own of chunks) {
    let r = await svc<Row[]>(`cards?select=${COLS},site_paused&${base},site_paused.is.true)${own}&order=created_at.desc&limit=300`);
    if (!r.ok) { pauseReady = false; r = await svc<Row[]>(`cards?select=${COLS}&${base})${own}&order=created_at.desc&limit=300`); }
    rows = rows.concat(r.data ?? []);
  }
  const owners = [...new Set(rows.map((x) => x.owner_id))];
  const names = owners.length ? ((await svc<{ id: string; full_name: string | null }[]>(`profiles?id=in.(${owners.join(",")})&select=id,full_name`)).data ?? []) : [];
  const byId = new Map(names.map((n) => [n.id, n]));
  const now = new Date().toISOString();
  return NextResponse.json({
    pauseReady,
    websites: rows.map((x) => {
      const paused = x.site_paused === true;
      const waiting = !paused && ((!!x.ready && x.ready > now) || (!!x.adv && x.adv > now));
      return {
        id: x.id, username: x.username, business: x.company || x.name || x.username, owner: byId.get(x.owner_id)?.full_name ?? "", ownerId: x.owner_id,
        readyAt: x.ready, advancedReadyAt: x.adv, liveAt: x.told, premium: !!x.adv,
        status: paused ? "paused" : waiting ? "waiting" : "live",
      };
    }),
  });
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, "users.edit", { sensitive: false }); if (!g.ok) return g.res;
  const b = (await request.json().catch(() => ({}))) as { id?: string; action?: string };
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Pick the website." }, { status: 400 });
  if (!["live", "pause", "resume"].includes(String(b.action))) return NextResponse.json({ error: "Live, Pause or Resume." }, { status: 400 });
  const cur = (await svc<{ id: string; owner_id: string; username: string; data: Record<string, unknown> & { site?: Record<string, unknown>; customDomain?: string } }[]>(`cards?id=eq.${id}&select=id,owner_id,username,data&limit=1`)).data?.[0];
  if (!cur) return NextResponse.json({ error: "Website not found." }, { status: 404 });
  if (!(await userInScope(g.me, cur.owner_id))) return NextResponse.json({ error: "That user is not in your franchise." }, { status: 403 });
  const patch = (body: Record<string, unknown>) => svc(`cards?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });

  if (b.action === "pause" || b.action === "resume") {
    const w = await patch({ site_paused: b.action === "pause" });
    if (!w.ok) return NextResponse.json({ error: /site_paused/.test(w.text) ? "Run migration 0085 in Supabase first (Pause needs it)." : "Could not save. Please try again." }, { status: 502 });
    await audit(g.me, b.action === "pause" ? "website.pause" : "website.resume", { type: "card", id, label: cur.username }, request);
    return NextResponse.json({ ok: true, status: b.action === "pause" ? "paused" : "resumed" });
  }

  // Live now: the waiting fields go, the website (and a first Premium design) shows at once, the owner is told once.
  const site = { ...(cur.data?.site ?? {}) };
  const hadSite = !!site.readyAt, hadAdv = !!site.advancedReadyAt;
  delete site.readyAt; delete site.advancedReadyAt;
  const now = new Date().toISOString();
  const data = { ...cur.data, site: { ...site, liveToldAt: now } };
  let w = await patch({ data, site_paused: false });
  if (!w.ok && /site_paused/.test(w.text)) w = await patch({ data });
  if (!w.ok) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  const told = await tellSiteLive({ id, owner_id: cur.owner_id, username: cur.username, data: { customDomain: cur.data?.customDomain } }, hadAdv && !hadSite).catch(() => false);
  await audit(g.me, "website.live", { type: "card", id, label: cur.username, note: told ? "owner told" : "message not sent" }, request);
  return NextResponse.json({ ok: true, status: "live", told });
}
