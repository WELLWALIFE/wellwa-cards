// GET (bearer) → the last weekly Google + website check of the signed-in owner's connected profile, with the score history.
// POST (bearer) → run it now (Google + PageSpeed: up to a minute). Three a day per owner.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { keptHealth, runHealth } from "@/lib/google-health";

export const maxDuration = 120;

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json(await keptHealth(me.id));
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`google-health:${me.id}`, 3, 24 * 60 * 60_000)) return NextResponse.json({ error: "Checked 3 times today already. It runs by itself every Monday." }, { status: 429 });
  try {
    const h = await runHealth(me.id, true);
    if ("error" in h) return NextResponse.json(h, { status: 400 });
    return NextResponse.json(await keptHealth(me.id));
  } catch (e) {
    console.error("[google-health] now", e);
    return NextResponse.json({ error: "Could not finish the check. Please try again in a few minutes." }, { status: 502 });
  }
}
