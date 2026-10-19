// Premium websites tell the search engines about their pages — hourly from cron (deploy.sh writes /etc/cron.d/shubhora-indexnow → scripts/indexnow.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/indexnow
// Only a card with an active Premium website is sent (Google / search is Premium only, owner 19 Oct 2026), and only when its pages changed since the
// last time (a hash per card in .indexnow-state.json). A card on a verified own domain is sent for that domain, else for shubhora.com.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { cardUrls, isPremiumRow, type Row } from "@/lib/seo-urls";
import { submitIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/site-url";

const STATE = path.join(process.cwd(), ".indexnow-state.json");
type CardRow = Row & { data?: unknown };

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const r = await restAsService<{ username: string; data: { pages?: Row["pages"]; site?: Row["site"]; about?: string; language?: string } }[]>("cards?select=username,data&active=eq.true&data->site->advanced=not.is.null&limit=2000");
  const d = await restAsService<{ username: string; domain: string }[]>("card_domains?select=username,domain&verified=eq.true&limit=2000");
  const domainOf = new Map((d.data ?? []).map((x) => [x.username, x.domain]));
  let state: Record<string, string> = {};
  try { state = JSON.parse(await fs.readFile(STATE, "utf8")); } catch { /* first run */ }
  const byHost = new Map<string, string[]>();
  const hashes: Record<string, string> = {};
  let premium = 0, changed = 0;
  for (const c of r.data ?? []) {
    const row: CardRow = { username: c.username, pages: c.data?.pages ?? null, site: c.data?.site ?? null, about: c.data?.about ?? null, language: c.data?.language ?? null };
    if (!isPremiumRow(row)) continue;
    premium++;
    const dom = domainOf.get(c.username);
    const host = dom || new URL(SITE_URL).host;
    const urls = cardUrls(dom ? `https://${dom}` : `${SITE_URL}/c/${c.username}`, row).map((u) => u.url);
    const h = createHash("sha1").update(JSON.stringify([host, urls, c.data])).digest("hex");
    hashes[c.username] = h;
    if (state[c.username] === h) continue;
    changed++;
    byHost.set(host, [...(byHost.get(host) ?? []), ...urls]);
  }
  const sent: Record<string, number> = {};
  for (const [host, urls] of byHost) sent[host] = await submitIndexNow(host, urls);
  // a host that was not taken stays "changed" for the next run
  const next = { ...state };
  for (const c of r.data ?? []) {
    const dom = domainOf.get(c.username); const host = dom || new URL(SITE_URL).host;
    if (hashes[c.username] && (sent[host] === undefined || sent[host] === 200 || sent[host] === 202)) next[c.username] = hashes[c.username];
  }
  await fs.writeFile(STATE, JSON.stringify(next)).catch(() => undefined);
  return NextResponse.json({ ok: true, premium, changed, sent });
}
