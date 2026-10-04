// POST (bearer) right after a Google sign-in, before anything else runs for the account. Joining with Google is off
// (owner's call, 4 Oct 2026: "google se joining band karo") — new accounts are made with email on /signup only.
// Google still logs in an account that already exists; one Google just made (Google-only identity, created moments
// ago) is removed again and the caller is told { blocked: true }.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

type AuthUser = { id: string; created_at?: string; identities?: { provider: string }[] };

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const who = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${me.token}` }, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null) as AuthUser | null;
  if (!who) return NextResponse.json({ ok: true });
  const providers = (who.identities ?? []).map((i) => i.provider);
  const googleOnly = providers.length > 0 && providers.every((p) => p === "google");
  const brandNew = !!who.created_at && Date.now() - new Date(who.created_at).getTime() < 10 * 60_000;
  if (!googleOnly || !brandNew) return NextResponse.json({ ok: true });
  if (serviceConfigured()) {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${who.id}`, { method: "DELETE", headers: serviceHeaders() }).catch(() => null);
    if (!r?.ok) console.warn("[auth] google-gate: could not remove new Google account", who.id, r?.status);
  }
  return NextResponse.json({ blocked: true });
}
