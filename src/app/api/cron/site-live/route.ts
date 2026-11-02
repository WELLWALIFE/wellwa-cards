// The website's waiting time (src/lib/site-ready.ts) — hourly from cron (deploy.sh writes /etc/cron.d/shubhora-site-live → scripts/site-live.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/site-live
// A website (or a first Premium design) whose moment has come shows to visitors by itself — the public route reads the time, nothing has to
// flip. This job only tells the owner (push + WhatsApp, the link) and clears the field, so the message goes once. Nothing manual (owner, 31 Oct 2026);
// Super Admin → Websites can make one live at once or pause it (2 Nov 2026) — a paused one is skipped here.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { tellSiteLive } from "@/lib/site-live-server";

type Site = { readyAt?: string; advancedReadyAt?: string; enabled?: boolean; paused?: boolean } & Record<string, unknown>;
type Row = { id: string; owner_id: string; username: string; data: { site?: Site; customDomain?: string } & Record<string, unknown> };

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const now = new Date().toISOString();
  // ISO strings compare as text; a field that is absent never matches.
  const r = await restAsService<Row[]>(`cards?select=id,owner_id,username,data&or=(data->site->>readyAt.lte.${now},data->site->>advancedReadyAt.lte.${now})&limit=500`);
  if (!r.ok) return NextResponse.json({ error: "could not read cards" }, { status: 502 });
  let told = 0, cleared = 0, failed = 0;
  for (const c of r.data ?? []) {
    const site = c.data?.site ?? {};
    if (site.paused === true) continue;   // Super Admin paused it: held until Resume (lib/site-ready.ts sitePaused)
    const dueSite = !!site.readyAt && site.readyAt <= now;
    const dueAdv = !!site.advancedReadyAt && site.advancedReadyAt <= now;
    if (!dueSite && !dueAdv) continue;
    const { readyAt: _r, advancedReadyAt: _a, ...rest } = site; void _r; void _a;
    const next = { ...c.data, site: { ...rest, ...(dueSite ? {} : { readyAt: site.readyAt }), ...(dueAdv ? {} : { advancedReadyAt: site.advancedReadyAt }), liveToldAt: now } };
    const w = await restAsService(`cards?id=eq.${c.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: next }) });
    if (!w.ok) { failed++; continue; }
    cleared++;
    // The field is cleared first, so a message that fails is not repeated every hour; the website is live either way.
    if (await tellSiteLive(c, dueAdv && !dueSite)) told++;
  }
  return NextResponse.json({ ok: true, due: (r.data ?? []).length, cleared, told, failed });
}
