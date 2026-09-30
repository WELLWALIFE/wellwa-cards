// GET (bearer) → the Facebook connection, its ad accounts and the chosen one; whether ads permission is there.
// POST { ad_account } → choose the ad account.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { fbAccount, adAccounts, chooseAdAccount, isPermissionError } from "@/lib/ads-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ connected: false, accounts: [], selected: "", permission: "none" });
  try {
    const accounts = await adAccounts(fb);
    const selected = fb.ad_account_id && accounts.some((a) => a.id === fb.ad_account_id) ? fb.ad_account_id : (accounts.find((a) => a.ok)?.id ?? accounts[0]?.id ?? "");
    return NextResponse.json({ connected: true, page: fb.name, picture: fb.picture, accounts, selected, permission: "ok" });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ connected: true, page: fb.name, picture: fb.picture, accounts: [], selected: "", permission: isPermissionError(msg) ? "missing" : "error", error: msg.slice(0, 200) });
  }
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.ad_account ?? "");
  if (!/^act_\d{5,20}$/.test(id)) return NextResponse.json({ error: "bad ad account" }, { status: 400 });
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ error: "Connect Facebook first." }, { status: 400 });
  await chooseAdAccount(fb, id);
  return NextResponse.json({ ok: true });
}
