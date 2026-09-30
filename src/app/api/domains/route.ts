// Custom domains for a card (the website on the owner's own domain).
//   POST   { domain, cardId, username } → claim it (a bare domain also claims www), return the DNS steps
//   GET    ?domain=…                     → provider, the records to add and what DNS says now
//   PUT    { domain }                    → if DNS points here: certificate + live (www too when ready)
//   DELETE ?domain=…                     → release it (and its www)
// A background job (/api/cron/domains) finishes the same PUT step by itself, so the owner can close the page.
// The caller must own the card: queries use the caller's own token so RLS decides.
import { NextResponse } from "next/server";
import { SITE_HOST } from "@/lib/site-url";
import { cleanDomain, dnsStatus, hostsFor, issueCertificate, servedElsewhere, validDomain } from "@/lib/domains-server";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function userHeaders(request: Request): Record<string, string> | null {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return { apikey: ANON, Authorization: auth, "Content-Type": "application/json" };
}
const rows = (h: Record<string, string>, hosts: string[]) =>
  fetch(`${SUPA}/rest/v1/card_domains?domain=in.(${hosts.map(encodeURIComponent).join(",")})&select=domain,verified,last_error`, { headers: h, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []) as Promise<{ domain: string; verified: boolean; last_error: string | null }[]>;

export async function POST(request: Request) {
  const h = userHeaders(request);
  if (!h) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const domain = cleanDomain(body.domain);
  const bad = validDomain(domain, SITE_HOST);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (!body.cardId || !body.username) return NextResponse.json({ error: "Publish the card first, then add a domain." }, { status: 400 });

  const who = await fetch(`${SUPA}/auth/v1/user`, { headers: h }).then((r) => r.json()).catch(() => null);
  if (!who?.id) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  // Your own domain is part of the paid plan (the Shubhora link is free).
  const plan = await fetch(`${SUPA}/rest/v1/rpc/my_plan`, { method: "POST", headers: h, body: "{}" }).then((r) => r.json()).catch(() => null);
  const row = Array.isArray(plan) ? plan[0] : plan;
  if (!row || row.expired || row.plan === "free") return NextResponse.json({ error: "Your own domain is part of the paid plan. Subscribe to connect it.", plan: true }, { status: 402 });

  const hosts = hostsFor(domain);
  for (const host of hosts) {
    if (await servedElsewhere(host)) return NextResponse.json({ error: `${host} is already a website hosted with us, so it cannot be connected to a card.` }, { status: 409 });
    const avail = await fetch(`${SUPA}/rest/v1/rpc/domain_available`, { method: "POST", headers: h, body: JSON.stringify({ p_domain: host, p_card_id: body.cardId }) })
      .then((r) => r.json()).catch(() => null);
    if (avail === false) return NextResponse.json({ error: `${host} is already connected to another card.` }, { status: 409 });
  }
  const res = await fetch(`${SUPA}/rest/v1/card_domains?on_conflict=domain`, {
    method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(hosts.map((host) => ({ domain: host, card_id: body.cardId, owner_id: who.id, username: body.username, verified: false, last_error: null }))),
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: /23503/.test(text) ? "Publish the card first, then add a domain." : "Could not save that domain. Please try again." }, { status: 400 });
  }
  const status = await dnsStatus(hosts[0]);
  return NextResponse.json({ ok: true, domain: hosts[0], hosts, ...status });
}

export async function GET(request: Request) {
  const h = userHeaders(request);
  if (!h) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  const domain = cleanDomain(new URL(request.url).searchParams.get("domain"));
  if (validDomain(domain, SITE_HOST)) return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
  const hosts = hostsFor(domain);
  const [status, mine] = await Promise.all([dnsStatus(hosts[0]), rows(h, hosts)]);
  if (!mine.length) return NextResponse.json({ error: "This domain is not connected to your card." }, { status: 404 });
  return NextResponse.json({ domain: hosts[0], ...status, live: mine.filter((r) => r.verified).map((r) => r.domain), lastError: mine.find((r) => r.last_error)?.last_error ?? null });
}

/** Check DNS, then issue the certificate and switch live — for the bare domain and, when ready, www. */
export async function PUT(request: Request) {
  const h = userHeaders(request);
  if (!h) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const domain = cleanDomain(body.domain);
  if (validDomain(domain, SITE_HOST)) return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
  const hosts = hostsFor(domain);
  const mine = await rows(h, hosts);
  if (!mine.length) return NextResponse.json({ error: "This domain is not connected to your card." }, { status: 404 });

  const status = await dnsStatus(hosts[0]);
  const live: string[] = [];
  let error: string | null = null;
  for (const rec of status.records) {
    if (!mine.some((m) => m.domain === rec.host)) continue;
    if (!rec.ok) {
      const msg = rec.current.length ? `${rec.host} points to ${rec.current.join(", ")} instead of ${rec.value}.` : `${rec.host} does not point anywhere yet.`;
      if (rec === status.records[0]) error = msg;
      await mark(h, rec.host, false, msg);
      continue;
    }
    const cert = await issueCertificate(rec.host);
    if (!cert.ok) { if (rec === status.records[0]) error = "DNS is correct; the security certificate will be retried in a few minutes."; await mark(h, rec.host, false, cert.error ?? "certificate failed"); continue; }
    await mark(h, rec.host, true, null);
    live.push(rec.host);
  }
  if (!live.includes(hosts[0])) return NextResponse.json({ error: error ?? "Not ready yet.", ...status, live }, { status: 400 });
  return NextResponse.json({ ok: true, domain: hosts[0], url: `https://${hosts[0]}`, live, ...status });
}

async function mark(h: Record<string, string>, host: string, verified: boolean, lastError: string | null) {
  await fetch(`${SUPA}/rest/v1/card_domains?domain=eq.${encodeURIComponent(host)}`, {
    method: "PATCH", headers: h, body: JSON.stringify({ verified, last_error: lastError, ...(verified ? { verified_at: new Date().toISOString() } : {}) }),
  }).catch(() => {});
}

export async function DELETE(request: Request) {
  const h = userHeaders(request);
  if (!h) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  const domain = cleanDomain(new URL(request.url).searchParams.get("domain") ?? "");
  if (!domain) return NextResponse.json({ error: "No domain given." }, { status: 400 });
  const hosts = hostsFor(domain);
  const res = await fetch(`${SUPA}/rest/v1/card_domains?domain=in.(${hosts.map(encodeURIComponent).join(",")})`, { method: "DELETE", headers: h });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 400 });
  // Certificates and vhosts stay: harmless once DNS stops pointing here.
  return NextResponse.json({ ok: true });
}
