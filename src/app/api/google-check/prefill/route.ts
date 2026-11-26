// GET (bearer) ?p=<Google place id> → what the free Google check already read about that business, to fill the set-up for someone who
// joined from their report (owner, 26 Nov 2026: "maksad hai wo hamare saath jude" — joining must take a minute, not a form).
// Only a report already kept is read: nothing new is asked of Google, so this costs nothing.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Report } from "@/lib/google-check";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams.get("p") ?? "";
  if (!/^[\w-]{10,300}$/.test(p)) return NextResponse.json({ error: "Bad place." }, { status: 400 });
  const admin = getAdminSupabase(); if (!admin) return NextResponse.json({ error: "Not set up." }, { status: 503 });
  const { data } = await admin.from("google_checks").select("report").eq("place_id", p).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const r = data?.report as Report | undefined;
  if (!r?.place) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const city = r.city ?? "";
  // The street part only: the city has its own box.
  const address = city ? r.place.address.replace(new RegExp(`,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "i"), "").trim() : r.place.address;
  return NextResponse.json({ name: r.place.name, address: address || r.place.address, city, website: r.place.website || "", map: r.place.mapsUrl || "", phone: (r.place.phone || "").replace(/\D/g, "").slice(-10) });
}
