// Premium website expiry — once a day from cron (deploy.sh writes /etc/cron.d/shubhora-advanced-expiry → scripts/advanced-expiry.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/advanced-expiry
// The Premium website keeps running for one year after the Premium payment, and for as long as a Standard / Pro plan runs (owner, 16 Oct 2026).
// When neither holds, the card's `site.advancedOn` is switched off: the basic website and the card keep working, the Premium design stays stored
// (paying again, or a running Standard plan with a new Premium payment, turns it back on from the Premium page).
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { advancedWithinYear, readAdvancedMeta, standardRunning } from "@/lib/advanced-access";

type Row = { id: string; owner_id: string; data: { site?: { advanced?: unknown; advancedOn?: boolean } & Record<string, unknown> } & Record<string, unknown> };

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  if (process.env.ADVANCED_SITE_OPEN === "1") return NextResponse.json({ ok: true, skipped: "open for review" });
  const r = await restAsService<Row[]>("cards?select=id,owner_id,data&data->site->advanced=not.is.null&limit=2000");
  const rows = (r.data ?? []).filter((c) => c.data?.site?.advanced && c.data.site.advancedOn !== false);
  const verdict = new Map<string, boolean>();
  let off = 0, kept = 0, unknown = 0;
  for (const c of rows) {
    if (!verdict.has(c.owner_id)) {
      const meta = await readAdvancedMeta(c.owner_id);
      // A failed lookup never switches anything off; an account that never paid for Premium (reviewed during the free window) is left as it is.
      verdict.set(c.owner_id, meta === undefined || meta === null || meta.paid !== true ? true : advancedWithinYear(meta) || (await standardRunning(c.owner_id)));
    }
    if (verdict.get(c.owner_id)) { kept++; continue; }
    const next = { ...c.data, site: { ...c.data.site, advancedOn: false } };
    const w = await restAsService(`cards?id=eq.${c.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: next }) });
    if (w.ok) off++; else unknown++;
  }
  return NextResponse.json({ ok: true, checked: rows.length, kept, switchedOff: off, failed: unknown });
}
