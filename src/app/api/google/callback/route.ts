// GET ?code&state → tokens → all Business Profile locations → google_accounts row (first location active; user can switch).
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { verifyState, SITE_URL } from "@/lib/social-server";
import { exchangeCode, listLocations, googleCreds, googleRow, friendlyGoogleError } from "@/lib/google-server";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const st = verifyState(u.searchParams.get("state") ?? "");
  const back = (q: string) => NextResponse.redirect(`${SITE_URL}${st?.returnTo || "/poster/social?tab=google"}${(st?.returnTo || "").includes("?") ? "&" : "?"}${q}`);
  if (!st || st.provider !== "google") return NextResponse.redirect(`${SITE_URL}/poster/social?tab=google&google=error&reason=state`);
  const code = u.searchParams.get("code");
  if (!code) return back(`google=error&reason=${encodeURIComponent(u.searchParams.get("error") ?? "denied")}`);
  try {
    const creds = await googleCreds(st.userId);
    const t = await exchangeCode(creds, code);
    const { account, locations } = await listLocations(t.access_token);
    const prev = await googleRow(st.userId);
    const keep = prev?.location_name && locations.find((l) => l.name === prev.location_name);
    const loc = keep || locations[0];
    await restAsService("google_accounts?on_conflict=user_id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: st.userId, account_name: account, location_name: loc.name, location_title: loc.title, address: loc.address, phone: loc.phone, maps_url: loc.maps, locations, access_token: t.access_token, refresh_token: t.refresh_token ?? prev?.refresh_token ?? "", token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), status: "ok", last_error: "", connected_at: new Date().toISOString() }),
    });
    return back(locations.length > 1 ? "google=ok&pick=1" : "google=ok");
  } catch (e) { return back(`google=error&reason=${encodeURIComponent(friendlyGoogleError(e).slice(0, 140))}`); }
}
