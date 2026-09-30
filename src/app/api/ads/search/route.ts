// GET (bearer) ?kind=city|interest&q= → Meta's matching cities / regions or interests for the audience step.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { fbAccount, searchCities, searchInterests } from "@/lib/ads-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const u = new URL(request.url);
  const q = (u.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ results: [] });
  try {
    const results = u.searchParams.get("kind") === "interest" ? await searchInterests(fb, q) : await searchCities(fb, q);
    return NextResponse.json({ results });
  } catch (e) { return NextResponse.json({ results: [], error: (e as Error).message.slice(0, 200) }); }
}
