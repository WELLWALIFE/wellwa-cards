// POST (bearer) { card, looks } → { token } — the six designs of the owner's website as test links (lib/test-links.ts).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { saveTestLinks } from "@/lib/test-links";
import { BLUEPRINT_KEYS } from "@/lib/site-style";
import type { Card } from "@/lib/types";
import type { Look } from "@/lib/site-looks";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`test-links:${me.id}`, 12, 60 * 60_000)) return NextResponse.json({ error: "Too many links made. Please wait a little." }, { status: 429 });
  const raw = await request.text();
  if (raw.length > 4_000_000) return NextResponse.json({ error: "This card is too big to send as a test link." }, { status: 413 });
  let b: { card?: Card; looks?: Look[] } | null = null;
  try { b = JSON.parse(raw); } catch { /* below */ }
  const card = b?.card, looks = b?.looks;
  if (!card || !Array.isArray(card.pages) || !Array.isArray(card.links) || !Array.isArray(looks) || looks.length < 1 || looks.length > 6) return NextResponse.json({ error: "Nothing to send yet." }, { status: 400 });
  const keys = new Set<string>(BLUEPRINT_KEYS);
  const clean = looks.filter((l) => l && keys.has(l.key) && l.style && typeof l.style === "object");
  if (!clean.length) return NextResponse.json({ error: "Nothing to send yet." }, { status: 400 });
  const token = await saveTestLinks(me.id, card, clean);
  return NextResponse.json({ token });
}
