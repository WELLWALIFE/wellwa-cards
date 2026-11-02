// GET ?profile=<id>&date=YYYY-MM-DD → the carousel of that day of the month plan (brief.format "carousel"):
// { slides: [url, …] } — a cover, one picture per step, an ending with the name, number and link (bridge/carousel.mjs).
// Paid plans get the clean slides. A free account sees the first three planned days only, with the "SAMPLE" band drawn
// into every slide (no clean copy is ever drawn for it), like the single-poster preview (/api/poster/today?sample=1).
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api-security";
import { userFromRequest, ownProfile, posterQuota, istDate, posterEngine, restAsService, OUT_URL, posterVersion, cardLinkFor } from "@/lib/poster-server";
import { isCarousel, type DayBrief } from "@/lib/brand-plan";

type Row = { kind: string; overrides: { title?: string; sub?: string; accent?: string } | null; brief: DayBrief | null };

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const date = q.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const profile = await ownProfile(me.token, q.get("profile") ?? "");
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const row = (await restAsService<Row[]>(`poster_calendar?profile_id=eq.${profile.id}&for_date=eq.${date}&select=kind,overrides,brief`)).data;
  const cal = Array.isArray(row) ? row[0] : undefined;
  if (!cal || cal.kind === "skip" || !isCarousel(cal.brief)) return NextResponse.json({ error: "not a carousel", message: "This day is not a carousel post." }, { status: 404 });

  const quota = await posterQuota(me.token, me.id);
  const sample = quota.plan === "free";
  if (sample) {
    const first = (await restAsService<{ for_date: string }[]>(`poster_calendar?profile_id=eq.${profile.id}&for_date=gte.${istDate()}&kind=neq.skip&order=for_date&limit=3&select=for_date`)).data;
    const allowed = Array.isArray(first) ? first.map((r) => r.for_date) : [];
    if (!allowed.includes(date)) return NextResponse.json({ error: "plan", quota, message: "The free plan shows the first three posts of your plan. The Standard plan shows every day." }, { status: 402 });
  }
  const link = await cardLinkFor(me.id, (profile as unknown as { card_facts?: { primaryCardId?: string } | null }).card_facts?.primaryCardId);
  const ov = cal.overrides ?? {};
  const base = (profile as unknown as { layout?: Record<string, unknown> }).layout ?? {};
  const p = { ...profile, layout: { ...base, ...(ov.accent ? { accent: ov.accent } : {}) } } as unknown as Record<string, unknown>;
  const opts = { title: ov.title || cal.brief?.hook || "", kicker: ov.sub || "", slides: cal.brief!.slides!, link: link?.show ?? "", sample };
  const eng = await posterEngine();
  try {
    const fs = await import("node:fs");
    const want = await eng.renderCarouselDay(date, p, { ...opts, nameOnly: true });
    // A drawing costs a little CPU: a free account draws a handful a day; files already made cost nothing.
    if (sample && !want.every((f) => fs.existsSync(f)) && rateLimited(`carousel-sample:${me.id}`, 8, 24 * 3600_000))
      return NextResponse.json({ error: "plan", quota, message: "Free previews for today are done. The Standard plan shows every day of the plan." }, { status: 402 });
    const files = await eng.renderCarouselDay(date, p, opts);
    const slides = await Promise.all(files.map(async (f) => { const u = OUT_URL(f); return `${u}?v=${await posterVersion(u)}`; }));
    return NextResponse.json({ slides, sample, date });
  } catch (e) {
    return NextResponse.json({ error: "The carousel could not be made right now. Please try again in a minute.", detail: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
