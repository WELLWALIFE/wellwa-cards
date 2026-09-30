// Finishes custom-domain setups by itself — every 10 minutes from cron:
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/domains
// For every domain added in the last 14 days that is not live yet: if DNS now points here, fit the certificate, mark
// it live and tell the owner ("Website is live"). Owners never have to come back and press anything.
import { NextResponse } from "next/server";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { addressesOf, issueCertificate, SERVER_IP } from "@/lib/domains-server";
import { notify } from "@/lib/notify";

export const maxDuration = 300;
const rest = (path: string, init: RequestInit = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(), ...(init.headers ?? {}) }, cache: "no-store" });

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const r = await rest(`card_domains?verified=is.false&created_at=gte.${since}&select=domain,owner_id&order=created_at&limit=100`);
  const pending = (r.ok ? await r.json() : []) as { domain: string; owner_id: string }[];
  const madeLive: string[] = [];
  for (const d of pending) {
    const ips = await addressesOf(d.domain);
    if (!ips.length || !ips.every((ip) => ip === SERVER_IP)) continue;
    const cert = await issueCertificate(d.domain);
    await rest(`card_domains?domain=eq.${encodeURIComponent(d.domain)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify(cert.ok ? { verified: true, last_error: null, verified_at: new Date().toISOString() } : { last_error: cert.error ?? "certificate failed" }),
    });
    if (!cert.ok) continue;
    madeLive.push(d.domain);
    if (!d.domain.startsWith("www.")) {
      await notify(d.owner_id, "website_live", {
        title: "Your website is live 🎉", body: `https://${d.domain} is connected and secured.`, path: "/poster/website", ref: `live:${d.domain}`,
        whatsappText: `🎉 Your website is live: https://${d.domain}\nShare it with your customers.`,
      }).catch(() => undefined);
    }
  }
  return NextResponse.json({ ok: true, checked: pending.length, live: madeLive });
}
