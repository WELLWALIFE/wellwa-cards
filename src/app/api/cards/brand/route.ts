// After a publish, stamp the card with its owner's white-label brand.
//
// resolve_brand_host() joins on cards.brand_id, so without this a member who
// signed up on join.wellwalife.com would publish a card that never answers at
// <user>.wellwalife.com. Migration 0022 does the same in a trigger; this route
// is the belt to that brace and is harmless once the trigger exists.
//
// Only the caller's own cards, only when the card has no brand yet — so it can
// never move a card between partners.

import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

const CERT_SCRIPT = "/opt/neuraledge/bin/add-domain.sh";

/** Issue the HTTPS certificate for a member's <user>.<brand> address.
 *  Fire-and-forget: certbot takes ~30-60 s and the publish must not wait.
 *  Skipped when the cert already exists (Let's Encrypt rate limits) or off
 *  the VPS (no script). Same script the custom-domain flow uses. */
function ensureMemberCert(host: string) {
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) return;
  if (!existsSync(CERT_SCRIPT)) return;
  if (existsSync(`/etc/letsencrypt/live/${host}`)) return;
  execFile("sudo", ["-n", CERT_SCRIPT, host], { timeout: 180_000 }, (err, _out, stderr) => {
    if (err) console.error(`[member-cert] ${host}:`, stderr?.toString().slice(-300) || err.message);
    else console.log(`[member-cert] issued ${host}`);
  });
}

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const cardId = String(body.cardId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) return NextResponse.json({ error: "Bad card id." }, { status: 400 });
  if (!serviceConfigured()) return NextResponse.json({ ok: true, brand: null });

  const who = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: auth },
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!who?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const prof = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${who.id}&select=brand_id`, {
    headers: serviceHeaders(), cache: "no-store",
  }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const brandId = prof[0]?.brand_id;
  if (!brandId) return NextResponse.json({ ok: true, brand: null });

  await fetch(
    `${SUPA_URL}/rest/v1/cards?id=eq.${cardId}&owner_id=eq.${who.id}&brand_id=is.null`,
    { method: "PATCH", headers: serviceHeaders(), body: JSON.stringify({ brand_id: brandId }) },
  );

  // The branded address needs its own certificate — issue it now so the
  // member's very first share never shows a browser security warning.
  const [card, brand] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/cards?id=eq.${cardId}&select=username`, { headers: serviceHeaders(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch(`${SUPA_URL}/rest/v1/brands?id=eq.${brandId}&select=base_domain`, { headers: serviceHeaders(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]);
  const username = card[0]?.username;
  const baseDomain = brand[0]?.base_domain;
  if (username && baseDomain) ensureMemberCert(`${username}.${baseDomain}`.toLowerCase());

  return NextResponse.json({ ok: true, brand: brandId });
}
