// POST (bearer) { card_id? } → { slides: [{ headline, sub }] × 3 } — three different big lines for the Premium website's sliding
// banners (owner, 23 Oct 2026), written from the card's own facts. Nothing is saved: the editor fills its boxes, the owner saves.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { myCard } from "@/lib/site-server";
import { geminiComplete } from "@/lib/gemini";
import type { Card } from "@/lib/types";

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`site-slides:${me.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: "Please wait a little and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const row = await myCard(me.id, typeof b.card_id === "string" ? b.card_id : undefined);
  if (!row) return NextResponse.json({ error: "Make your website first." }, { status: 404 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not available right now." }, { status: 503 });
  const c = row.data as Card;
  const items = c.pages.flatMap((p) => p.blocks).flatMap((bl) => (bl.kind === "product" ? bl.items.map((i) => i.name) : [])).filter(Boolean).slice(0, 12);
  const hindi = c.language === "hi";
  const facts = [
    `Business: ${c.company || c.name}`, `What they do: ${c.jobTitle}`, c.seo?.city ? `City: ${c.seo.city}` : "",
    c.tagline ? `Tagline: ${c.tagline}` : "", c.about ? `About: ${c.about.slice(0, 700)}` : "", items.length ? `Products / services: ${items.join(", ")}` : "",
    c.site?.hero?.headline ? `Present big line (do not repeat it): ${c.site.hero.headline}` : "",
  ].filter(Boolean).join("\n");
  try {
    const out = await geminiComplete({
      apiKey: key, json: true, maxOutputTokens: 600, temperature: 0.8, tag: "site-slides",
      system: "You write website banner headlines for Indian small businesses. Plain, confident, true to the facts; no hype, no prices, no claims that are not in the facts.",
      contents: [{ role: "user", parts: [{ text: `${facts}\n\nWrite 3 website top banners, each about a DIFFERENT reason to choose this business (for example: the main offer, why trust them, how easy it is to start). Language: ${hindi ? "simple Hindi (Devanagari)" : "simple English"}.\nEach: "headline" at most 6 words; "sub" one sentence, at most 90 characters.\nReturn JSON: {"slides":[{"headline":"...","sub":"..."},{"headline":"...","sub":"..."},{"headline":"...","sub":"..."}]}` }] }],
    });
    const parsed = JSON.parse(out.text.replace(/^```(?:json)?|```$/g, "").trim()) as { slides?: { headline?: unknown; sub?: unknown }[] };
    const slides = (parsed.slides ?? []).map((s) => ({ headline: clip(s.headline, 90), sub: clip(s.sub, 240) })).filter((s) => s.headline).slice(0, 3);
    if (slides.length < 2) return NextResponse.json({ error: "Could not write them. Please try again." }, { status: 502 });
    return NextResponse.json({ slides });
  } catch {
    return NextResponse.json({ error: "Could not write them. Please try again." }, { status: 502 });
  }
}
