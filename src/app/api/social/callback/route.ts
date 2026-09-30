// Meta redirects here with ?code&state (or ?error). We verify our own state,
// exchange the code, store the pages/IG accounts and bounce back into the app.
import { NextResponse } from "next/server";
import { accountsFromCode, saveAccounts, verifyState, SITE_URL } from "@/lib/social-server";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const st = verifyState(u.searchParams.get("state") ?? "");
  const back = (q: string) => NextResponse.redirect(`${SITE_URL}${st?.returnTo ?? "/poster/social"}?tab=${st?.provider || "facebook"}&social=${q}`);
  if (!st) return back("error&reason=state");
  if (u.searchParams.get("error")) return back(`error&reason=${encodeURIComponent(u.searchParams.get("error_reason") ?? u.searchParams.get("error") ?? "denied")}`);
  const code = u.searchParams.get("code") ?? "";
  if (!code) return back("error&reason=nocode");
  try {
    const all = await accountsFromCode(code);
    const accounts = st.provider === "instagram" ? all.filter((a) => a.provider === "instagram") : all.filter((a) => a.provider === "facebook");
    if (!accounts.length) return back(st.provider === "instagram" ? "error&reason=noinstagram" : "error&reason=nopages");
    await saveAccounts(st.userId, accounts);
    return back(`pick&n=${accounts.length}`);
  } catch (e) {
    console.error("[social/callback]", e);
    return back(`error&reason=${encodeURIComponent(((e as Error).message ?? "graph").slice(0, 80))}`);
  }
}
