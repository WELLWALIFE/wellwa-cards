// POST (Super Admin) { dryRun?: boolean, offset?: number, limit?: number, username?: string } → { report, next }
// Every live website on the new (Premium) designs, the same editor for everyone (owner, 24 Nov 2026: "sabhi website ko new pe hi convert
// kar do taki ye issue na aaye"). Per card, in this order:
//   1. a Shubhora partner's website is written into the card exactly as it is drawn today (api/site/bake), so it is edited like any card;
//   2. a Premium design that is stored but switched off is switched on;
//   3. a website with no Premium design gets the first of its twelve (the same list the "Ready designs" screen shows) — no AI run.
// The text and photos stay; only the design changes. dryRun = report only, nothing written. Runs in pages (offset / limit) so one
// call never runs long; `next` is the offset to send next, null when done.
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/admin-guard";
import { restAsService } from "@/lib/poster-server";
import { applyAdvanced, cleanResult, setAdvancedOn } from "@/lib/site-advanced-ai";
import { parseAdvanced, type AdvancedSpec } from "@/lib/site-advanced";
import { isShubhoraSellerCard, sellerBaked, sellerDrawsPremium, withoutFreeCard } from "@/lib/shubhora-page";
import { fillDesigns, tradeItems } from "@/lib/site-designs-server";
import type { Card } from "@/lib/types";

export const maxDuration = 300;

type Row = { id: string; owner_id: string; username: string; data: Card };
type Line = { username: string; steps: string[]; ok: boolean; error?: string };

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({})) as { dryRun?: unknown; offset?: unknown; limit?: unknown; username?: unknown };
  const dry = b.dryRun !== false;
  const offset = Math.max(0, Number(b.offset) || 0);
  const limit = Math.min(25, Math.max(1, Number(b.limit) || 10));
  const one = typeof b.username === "string" && /^[\w.-]{1,80}$/.test(b.username) ? b.username : "";
  const q = one ? `cards?username=eq.${encodeURIComponent(one)}&select=id,owner_id,username,data&limit=1`
    : `cards?select=id,owner_id,username,data&order=created_at.asc&offset=${offset}&limit=${limit}`;
  const r = await restAsService<Row[]>(q);
  if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) }, { status: 500 });
  const rows = r.data ?? [];
  const report: Line[] = [];
  for (const row of rows) {
    const line: Line = { username: row.username, steps: [], ok: true };
    try {
      let card = row.data;
      const seller = isShubhoraSellerCard(card);
      if (!card?.site || (card.site.enabled !== true && !seller)) { line.steps.push("no website — left alone"); report.push(line); continue; }
      if (seller && !sellerBaked(card)) {
        let drawn = withoutFreeCard(card, true);
        if (drawn.site?.advanced && !sellerDrawsPremium(drawn.site)) drawn = { ...drawn, site: { ...drawn.site, advancedOn: false } as Card["site"] };
        card = { ...drawn, site: { ...(drawn.site ?? { enabled: true }), sellerBaked: true } as Card["site"] };
        line.steps.push("partner website written as drawn");
      }
      const site = card.site as (Card["site"] & { advancedOn?: boolean }) | undefined;
      if (parseAdvanced(site?.advanced)) {
        if (site?.advancedOn === false) { card = setAdvancedOn(card, true); line.steps.push("Premium design switched on"); }
        else line.steps.push("already on a new design");
      } else if (dry) {
        line.steps.push("would get design 1 of its 12");
      } else {
        await fillDesigns(row.owner_id, { id: row.id, username: row.username, data: card });
        const items = await tradeItems(row.owner_id, { id: row.id, data: card });
        const fixed = items.filter((x) => String((x.spec as AdvancedSpec | undefined)?.seed ?? "").includes("|fix:"));
        const pick = (fixed.length ? fixed : items)[0];
        const clean = pick ? cleanResult(pick, card) : null;
        if (!clean) throw new Error("no design could be made");
        card = applyAdvanced(card, clean);
        card = { ...card, site: { ...card.site, designChosenAt: new Date().toISOString() } as Card["site"] };
        line.steps.push(`design 1 put on (${clean.spec.archetype})`);
      }
      if (!dry && card !== row.data) {
        const w = await restAsService(`cards?id=eq.${row.id}&owner_id=eq.${row.owner_id}`, { method: "PATCH", body: JSON.stringify({ data: card }) });
        if (!w.ok) throw new Error(w.text.slice(0, 160) || "save failed");
      }
    } catch (e) { line.ok = false; line.error = e instanceof Error ? e.message : String(e); }
    report.push(line);
  }
  return NextResponse.json({ dryRun: dry, report, next: one || rows.length < limit ? null : offset + rows.length });
}
