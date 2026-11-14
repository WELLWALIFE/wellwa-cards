// POST (bearer) { card, looks } → { token } — the six designs of the owner's website as test links (lib/test-links.ts).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { saveTestLinks, type TestDesign } from "@/lib/test-links";
import { BLUEPRINT_KEYS } from "@/lib/site-style";
import type { Card } from "@/lib/types";
import type { Look } from "@/lib/site-looks";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`test-links:${me.id}`, 12, 60 * 60_000)) return NextResponse.json({ error: "Too many links made. Please wait a little." }, { status: 429 });
  const raw = await request.text();
  if (raw.length > 4_000_000) return NextResponse.json({ error: "This card is too big to send as a test link." }, { status: 413 });
  let b: { card?: Card; looks?: Look[]; designs?: { name?: unknown; adv?: { spec?: unknown; copy?: unknown; slides?: unknown } }[] } | null = null;
  try { b = JSON.parse(raw); } catch { /* below */ }
  const card = b?.card, looks = b?.looks ?? [];
  // Premium designs (the choose screen): up to six, each a spec with its words. Keys are ours (d1…d6), never the caller's.
  const designs: TestDesign[] = (Array.isArray(b?.designs) ? b!.designs! : []).slice(0, 6)
    .filter((d) => d && d.adv && typeof d.adv.spec === "object" && d.adv.spec)
    .map((d, i) => ({ key: `d${i + 1}`, name: String(d.name ?? `Design ${i + 1}`).slice(0, 40), adv: { spec: d.adv!.spec, ...(d.adv!.copy && typeof d.adv!.copy === "object" ? { copy: d.adv!.copy as TestDesign["adv"]["copy"] } : {}), ...(Array.isArray(d.adv!.slides) ? { slides: d.adv!.slides } : {}) } }));
  if (card && Array.isArray(card.pages) && Array.isArray(card.links) && designs.length) {
    return NextResponse.json({ token: await saveTestLinks(me.id, card, [], designs), keys: designs.map((d) => d.key) });
  }
  if (!card || !Array.isArray(card.pages) || !Array.isArray(card.links) || !Array.isArray(looks) || looks.length < 1 || looks.length > 6) return NextResponse.json({ error: "Nothing to send yet." }, { status: 400 });
  const keys = new Set<string>(BLUEPRINT_KEYS);
  const clean = looks.filter((l) => l && keys.has(l.key) && l.style && typeof l.style === "object");
  if (!clean.length) return NextResponse.json({ error: "Nothing to send yet." }, { status: 400 });
  const token = await saveTestLinks(me.id, card, clean);
  return NextResponse.json({ token });
}
