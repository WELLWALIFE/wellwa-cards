// POST (bearer) { card_id? } → { slides: [{ headline, sub }] × 3 } — three different big lines for the Premium website's sliding
// banners (owner, 23 Oct 2026), written from the card's own facts (lib/site-slides.ts). Nothing is saved: the editor fills its boxes.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { myCard } from "@/lib/site-server";
import { writeSlides } from "@/lib/site-slides";
import type { Card } from "@/lib/types";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`site-slides:${me.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: "Please wait a little and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const row = await myCard(me.id, typeof b.card_id === "string" ? b.card_id : undefined);
  if (!row) return NextResponse.json({ error: "Make your website first." }, { status: 404 });
  const slides = await writeSlides(row.data as Card);
  return slides ? NextResponse.json({ slides }) : NextResponse.json({ error: "Could not write them. Please try again." }, { status: 502 });
}
