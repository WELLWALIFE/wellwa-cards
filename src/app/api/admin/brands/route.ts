// White-label brands (super admin).
//   GET    → every brand
//   POST   → create/update a brand
//   PUT    → verify the wildcard DNS record, then publish the Apache vhost
//   DELETE → remove a brand (its cards fall back to plain Shubhora)

import { NextResponse } from "next/server";
import { promises as dns } from "node:dns";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

const run = promisify(execFile);
const SERVER_IP = process.env.NEURALEDGE_SERVER_IP ?? "148.72.247.91";
const BRAND_SCRIPT = "/opt/neuraledge/bin/add-brand.sh";

const clean = (d: string) =>
  String(d ?? "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^\*\./, "").replace(/\/.*$/, "").replace(/\.$/, "");

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ brands: [], configured: false });

  const [bRes, aRes, uRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/brands?select=*&order=created_at.desc`, { headers: serviceHeaders(), cache: "no-store" }),
    fetch(`${SUPA_URL}/rest/v1/brand_admins?select=brand_id,user_id`, { headers: serviceHeaders(), cache: "no-store" }),
    fetch(`${SUPA_URL}/auth/v1/admin/users?per_page=200`, { headers: serviceHeaders(), cache: "no-store" }),
  ]);

  const brands = bRes.ok ? await bRes.json() : [];
  const links: { brand_id: string; user_id: string }[] = aRes.ok ? await aRes.json() : [];
  const users: { id: string; email?: string }[] = uRes.ok ? ((await uRes.json())?.users ?? []) : [];
  const emailOf = new Map(users.map((u) => [u.id, u.email ?? ""]));

  return NextResponse.json({
    configured: true, serverIp: SERVER_IP,
    brands: (brands as { id: string }[]).map((b) => ({
      ...b,
      admins: links.filter((l) => l.brand_id === b.id)
        .map((l) => ({ userId: l.user_id, email: emailOf.get(l.user_id) ?? "(deleted user)" })),
    })),
  });
}

/** Random but readable — the super admin hands this to the partner once. */
function tempPassword(): string {
  const a = "abcdefghjkmnpqrstuvwxyz", n = "23456789";
  const pick = (s: string, k: number) =>
    Array.from({ length: k }, () => s[Math.floor(Math.random() * s.length)]).join("");
  return `${pick(a, 4)}-${pick(n, 4)}-${pick(a, 4)}`;
}

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const action = new URL(request.url).searchParams.get("do");

  /* ---- give a person access to the partner panel ---- */
  if (action === "add-admin") {
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!email || !b.brandId) return NextResponse.json({ error: "Email and brand required." }, { status: 400 });

    // Reuse the account if they already have one, so a partner who is also a
    // card holder keeps a single login.
    const found = await fetch(
      `${SUPA_URL}/auth/v1/admin/users?per_page=200`, { headers: serviceHeaders(), cache: "no-store" },
    ).then((r) => (r.ok ? r.json() : { users: [] })).catch(() => ({ users: [] }));
    let user = (found.users ?? []).find((u: { email?: string }) => (u.email ?? "").toLowerCase() === email);

    let password: string | undefined;
    if (!user) {
      password = String(b.password ?? "").trim() || tempPassword();
      const c = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
        method: "POST", headers: serviceHeaders(),
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      if (!c.ok) return NextResponse.json({ error: (await c.json())?.msg ?? "Could not create the login." }, { status: 400 });
      user = await c.json();
    }

    const link = await fetch(`${SUPA_URL}/rest/v1/brand_admins?on_conflict=brand_id,user_id`, {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ brand_id: b.brandId, user_id: user.id }),
    });
    if (!link.ok) return NextResponse.json({ error: await link.text() }, { status: 400 });

    // Keep it in the super admin's credential book, same as ordinary signups.
    // Goes through the vault route because admin_vault is a single JSON row —
    // a direct insert would violate its singleton constraint.
    if (password) {
      const origin = new URL(request.url).origin;
      fetch(`${origin}/api/admin/vault`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: email, email, password, note: "partner admin" }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, email, password });
  }

  if (action === "remove-admin") {
    if (!b.brandId || !b.userId) return NextResponse.json({ error: "Missing ids." }, { status: 400 });
    const r = await fetch(
      `${SUPA_URL}/rest/v1/brand_admins?brand_id=eq.${b.brandId}&user_id=eq.${b.userId}`,
      { method: "DELETE", headers: serviceHeaders() },
    );
    if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const base_domain = clean(b.base_domain);
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(base_domain)) {
    return NextResponse.json({ error: "Enter a domain like wellwalife.com" }, { status: 400 });
  }
  if (/(neuraledge\.me|shubhora\.com)$/.test(base_domain)) {
    return NextResponse.json({ error: "Pick the reseller's own domain." }, { status: 400 });
  }
  if (!b.name?.trim()) return NextResponse.json({ error: "Brand name is required." }, { status: 400 });

  const slug = (b.slug || b.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const row = {
    ...(b.id ? { id: b.id } : {}),
    slug, name: b.name.trim(), base_domain,
    logo_url: b.logo_url || null,
    theme_color: b.theme_color || "#0e9e90",
    support_email: b.support_email || null,
    hide_platform_branding: b.hide_platform_branding !== false,
    // One partner pixel covers every member card — they run a single campaign
    // for the whole network and see it all in one ad account.
    fb_pixel_id: b.fb_pixel_id || null,
    ga4_id: b.ga4_id || null,
    google_ads_id: b.google_ads_id || null,
    ads_conversion_label: b.ads_conversion_label || null,
    // AI training shared by every member card of this brand.
    bot_persona: b.bot_persona || null,
    bot_knowledge: b.bot_knowledge || null,
    bot_faq: b.bot_faq || null,
    // active is only ever set by the verify step below.
  };

  const r = await fetch(`${SUPA_URL}/rest/v1/brands?on_conflict=base_domain`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });

  return NextResponse.json({
    ok: true,
    brand: (await r.json())[0],
    dns: { type: "A", name: `*.${base_domain}`, value: SERVER_IP },
  });
}

/** Confirm the wildcard record resolves here, then publish the vhost. */
export async function PUT(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const base_domain = clean(b.base_domain);
  if (!base_domain) return NextResponse.json({ error: "No domain." }, { status: 400 });

  // Probe a name nobody would ever create by hand: only a wildcard record can
  // answer it, so this proves the wildcard exists rather than a stray A record.
  const probe = `neuraledge-wildcard-probe.${base_domain}`;
  let addresses: string[] = [];
  try {
    addresses = await dns.resolve4(probe);
  } catch {
    return fail(base_domain,
      `No wildcard record yet — ${probe} doesn't resolve. Add "*.${base_domain} A ${SERVER_IP}" at the domain provider, then verify again.`);
  }
  if (!addresses.includes(SERVER_IP)) {
    return fail(base_domain,
      `*.${base_domain} points to ${addresses.join(", ")} instead of ${SERVER_IP}.`);
  }

  try {
    await run("sudo", ["-n", BRAND_SCRIPT, base_domain], { timeout: 120_000 });
  } catch (e) {
    return fail(base_domain, `DNS is correct but the server step failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}`);
  }

  await fetch(`${SUPA_URL}/rest/v1/brands?base_domain=eq.${encodeURIComponent(base_domain)}`, {
    method: "PATCH", headers: serviceHeaders(),
    body: JSON.stringify({ active: true, last_error: null, dns_verified_at: new Date().toISOString() }),
  });
  return NextResponse.json({ ok: true, active: true });
}

async function fail(base_domain: string, error: string) {
  await fetch(`${SUPA_URL}/rest/v1/brands?base_domain=eq.${encodeURIComponent(base_domain)}`, {
    method: "PATCH", headers: serviceHeaders(),
    body: JSON.stringify({ active: false, last_error: error }),
  }).catch(() => {});
  return NextResponse.json({ error }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No id." }, { status: 400 });
  const r = await fetch(`${SUPA_URL}/rest/v1/brands?id=eq.${id}`, { method: "DELETE", headers: serviceHeaders() });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
  return NextResponse.json({ ok: true });
}
