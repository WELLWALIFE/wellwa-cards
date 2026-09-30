// Attach a brand-new user to the white-label partner whose domain they signed
// up on.
//
// The brand comes from the real Host header of *this* request, never from the
// browser: a client-supplied brand would let anyone add themselves to a
// partner's member list, and the partner's wallet pays for member activations.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { brandForHost } from "@/lib/brand";
import { serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const host = (await headers()).get("host");
  const brand = await brandForHost(host);
  if (!brand) return NextResponse.json({ ok: true, brand: null }); // plain signup

  // Confirm the token really belongs to somebody before writing anything.
  const who = await fetch(`${SUPA}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: auth },
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!who?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!serviceConfigured()) return NextResponse.json({ ok: true, brand: brand.slug });

  // Look up the brand id, then stamp the profile — only if it has no brand yet,
  // so this can never move an existing member between partners.
  const rows = await fetch(
    `${SUPA_URL}/rest/v1/brands?base_domain=eq.${encodeURIComponent(brand.baseDomain)}&select=id`,
    { headers: serviceHeaders(), cache: "no-store" },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const brandId = rows[0]?.id;
  if (!brandId) return NextResponse.json({ ok: true, brand: null });

  await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${who.id}&brand_id=is.null`, {
    method: "PATCH", headers: serviceHeaders(),
    body: JSON.stringify({ brand_id: brandId }),
  });

  return NextResponse.json({ ok: true, brand: brand.slug });
}
