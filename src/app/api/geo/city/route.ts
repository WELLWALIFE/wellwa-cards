// GET ?lat=&lng= → { city, area, pin } — the place a GPS pin falls in, so "📍 where I am standing" can fill the
// city and the locality instead of the owner typing them (owner's call, 1 Oct 2026: the person should type as
// little as possible). OpenStreetMap's free reverse lookup; no key, no cost, and the card is built either way.
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";

const CACHE = new Map<string, { at: number; body: unknown }>();
const TTL = 24 * 3600_000;

type Addr = Record<string, string | undefined>;

export async function GET(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (rateLimited(clientKey(request, "geo-city"), 20, 10 * 60_000)) return Response.json({ ok: false }, { status: 429 });
  const u = new URL(request.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ ok: false }, { status: 400 });
  }
  // Rounded to ~100 m: everyone standing in the same shop shares one cache entry and one upstream call.
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL) return Response.json(hit.body);

  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": "Shubhora/1.0 (https://shubhora.com)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return Response.json({ ok: false }, { status: 502 });
    const j = (await r.json()) as { address?: Addr };
    const a = j.address ?? {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || "";
    const area = [a.neighbourhood || a.suburb || a.hamlet, a.road].filter(Boolean).join(", ");
    const body = { ok: true, city: city.slice(0, 60), area: area.slice(0, 120), pin: (a.postcode ?? "").slice(0, 10) };
    if (CACHE.size > 500) CACHE.clear();
    CACHE.set(key, { at: Date.now(), body });
    return Response.json(body);
  } catch { return Response.json({ ok: false }, { status: 502 }); }
}
