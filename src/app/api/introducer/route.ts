// Who introduced this person — shown on the sign-up by username only, never a name.
//   GET /api/introducer?by=<username | old referral code | partner SH code>  →  { by: "<username or SH code>" | null }
// Looks in the app's accounts first, then in the partner panel: a partner from before the one-account model
// has an SH code (and maybe a panel username) but no app account yet, and their joining links must keep working.
// Public — the sign-up page calls it before anyone is signed in. Same-origin, so the phone app needs nothing extra.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { partnerCall, partnerLinked } from "@/lib/partner-link";

const HANDLE = /^[A-Za-z0-9_-]{2,40}$/;

export async function GET(request: Request) {
  const by = (new URL(request.url).searchParams.get("by") || "").trim();
  if (!HANDLE.test(by)) return NextResponse.json({ by: null });

  const r = await restAsService<{ username: string }[]>("rpc/resolve_introducer", { method: "POST", body: JSON.stringify({ p: by }) });
  const u = r.data?.[0]?.username;
  if (u) return NextResponse.json({ by: u, source: "account" });

  if (partnerLinked()) {
    const p = await partnerCall<{ code?: string; username?: string | null }>("resolve", { handle: by }, 4000);
    if (p.ok && (p.data.username || p.data.code)) return NextResponse.json({ by: p.data.username || p.data.code, source: "partner" });
  }
  return NextResponse.json({ by: null });
}
