// The brand, one screen (owner, 1 Nov 2026): what the month plan, the posters and the captions sound and look like.
//   GET  ?profile=<id>[&suggest=1] → { brand, suggest?: { accent, tone, audience, usps, tagline } }
//   POST { profile, name?, tagline?, logo_url?, lang?, category?, city?, accent?, palette?, tone?, audience?, usps?, photos? } → { brand }
// Everything is stored where it already lives: the poster profile (row + layout jsonb) and the card's facts (photos), so every
// screen that reads them — posters, the V-Card, the website — sees the same brand. Unknown layout keys are kept as they were.
import { NextResponse } from "next/server";
import { userFromRequest, ownProfile, restAsUser } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { brandSnapshot, suggestAccent, suggestBrand } from "@/lib/content-plan";
import { HEX6, clampStr, isTone } from "@/lib/brand-plan";
import { LANGS } from "@/lib/poster-client";
import { categoryOf } from "@/lib/poster-categories";
import { loadSavedFacts, saveFacts, ownMediaFacts } from "@/lib/card-inputs";
import { mergeFacts } from "@/lib/card-facts";

const OWN_MEDIA = (u: string, uid: string) => u.includes(`/media/poster/${uid}/`) || u.startsWith("/");

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const profile = await ownProfile(me.token, q.get("profile") ?? "");
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const brand = await brandSnapshot(me.id, profile.id);
  if (!brand) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  if (q.get("suggest") !== "1") return NextResponse.json({ brand });
  if (rateLimited(`brand-suggest:${me.id}`, 20, 24 * 3600_000)) return NextResponse.json({ brand, suggest: { accent: await suggestAccent(brand), tone: [], audience: "", usps: [], tagline: brand.tagline } });
  const [accent, ai] = await Promise.all([suggestAccent(brand), suggestBrand(brand)]);
  return NextResponse.json({ brand, suggest: { accent, ...ai } });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`brand-save:${me.id}`, 120, 3600_000)) return NextResponse.json({ error: "Too many saves. Please wait a few minutes." }, { status: 429 });
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const profile = await ownProfile(me.token, String(b.profile ?? ""));
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const cur = (await restAsUser<{ layout: Record<string, unknown> | null }[]>(me.token, `poster_profiles?id=eq.${profile.id}&select=layout`)).data?.[0];
  const layout: Record<string, unknown> = { ...(cur?.layout ?? {}) };
  const row: Record<string, unknown> = {};
  if (typeof b.name === "string" && clampStr(b.name, 60)) row.name = clampStr(b.name, 60);
  if (typeof b.tagline === "string") row.tagline = clampStr(b.tagline, 80) || null;
  if (typeof b.city === "string") row.city = clampStr(b.city, 40) || null;
  if (typeof b.category === "string" && (b.category === "" || categoryOf(b.category))) row.category = b.category;
  if (typeof b.lang === "string" && LANGS.some((l) => l.key === b.lang)) row.lang = b.lang;
  if (typeof b.logo_url === "string") { const u = b.logo_url.trim(); if (!u) row.logo_url = null; else if (/^https?:\/\//.test(u) && OWN_MEDIA(u, me.id)) row.logo_url = u; }
  if (typeof b.accent === "string") { if (HEX6.test(b.accent)) layout.accent = b.accent.toLowerCase(); else if (!b.accent) delete layout.accent; }
  if (Array.isArray(b.palette)) { const p = b.palette.map(String).filter((h) => HEX6.test(h)).slice(0, 3); if (p.length) layout.palette = p; else delete layout.palette; }
  if (Array.isArray(b.tone)) { const t = b.tone.map(String).filter(isTone).slice(0, 3); if (t.length) layout.tone = t; else delete layout.tone; }
  if (typeof b.audience === "string") { const a = clampStr(b.audience, 120); if (a) layout.audience = a; else delete layout.audience; }
  if (Array.isArray(b.usps)) {
    const u = b.usps.map((x) => String(x).split("|").map((y) => y.trim().slice(0, 22)).slice(0, 2).join("|").replace(/\|$/, "")).filter((x) => x && x !== "|").slice(0, 5);
    if (u.length) layout.usps = u; else delete layout.usps;
  }
  row.layout = layout;
  const r = await restAsUser(me.token, `poster_profiles?id=eq.${profile.id}&user_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
  if (!r.ok) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  // Business photos: the card's own (banner + photos), only the owner's own uploads.
  if (Array.isArray(b.photos)) {
    const photos = b.photos.map(String).filter((u) => /^https?:\/\//.test(u) && OWN_MEDIA(u, me.id)).slice(0, 12);
    try {
      const saved = await loadSavedFacts(me.id);
      if (saved.profileId) await saveFacts(me.id, saved.profileId, ownMediaFacts(mergeFacts(saved.facts, { photos }), me.id));
    } catch { /* the brand is saved; the photos can be added again */ }
  }
  return NextResponse.json({ brand: await brandSnapshot(me.id, profile.id) });
}
