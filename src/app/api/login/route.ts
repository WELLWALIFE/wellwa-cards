// One login: username, mobile number or email + password.
//   POST { id, password } → { access_token, refresh_token } for supabase.auth.setSession, or { error }.
// The server resolves what was typed to the account's sign-in address (auth_email_for, service role — addresses
// never reach the browser), then asks Supabase for a password session. Wrong username, wrong mobile and wrong
// password all get the same answer, so nothing can be probed. Same-origin JSON: the phone app uses it as it is.
import { NextResponse } from "next/server";
import { SUPA_URL } from "@/lib/admin-guard";
import { clientIp } from "@/lib/api-security";
import { restAsService } from "@/lib/poster-server";
import { phoneEmail, toE164 } from "@/lib/phone";

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const WINDOW = 15 * 60_000;
const MAX = 10;
const attempts = new Map<string, { n: number; at: number }>();
function limited(key: string) { const a = attempts.get(key); return !!a && Date.now() - a.at < WINDOW && a.n >= MAX; }
function failed(key: string) {
  if (attempts.size > 5000) attempts.clear();
  const a = attempts.get(key);
  attempts.set(key, a && Date.now() - a.at < WINDOW ? { n: a.n + 1, at: a.at } : { n: 1, at: Date.now() });
}

const MISMATCH = "That username / mobile number / email and password don't match.";

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { id?: unknown; password?: unknown };
  const id = String(b.id ?? "").trim().slice(0, 120);
  const password = String(b.password ?? "");
  if (!id || !password) return NextResponse.json({ error: "Enter your username, mobile number or email, and your password." }, { status: 400 });
  const ip = clientIp(request); // the last X-Forwarded-For entry — the first one is whatever the visitor typed
  const key = `${ip}|${id.toLowerCase()}`;
  if (limited(key)) return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });

  // What did they type? The database knows usernames, contact emails and phones on email accounts; the plain
  // reading (an email as typed, a mobile number's internal address) is the fallback, so login never depends on it.
  const candidates: string[] = [];
  const r = await restAsService<string>("rpc/auth_email_for", { method: "POST", body: JSON.stringify({ p: id }) });
  if (r.ok && typeof r.data === "string" && r.data) candidates.push(r.data.toLowerCase());
  if (id.includes("@")) candidates.push(id.toLowerCase());
  else { const p = toE164(id); if (p) candidates.push(phoneEmail(p)); }
  const emails = [...new Set(candidates)];
  if (!emails.length) { failed(key); return NextResponse.json({ error: MISMATCH }, { status: 401 }); }

  let unconfirmed = false;
  for (const email of emails) {
    const t = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }), cache: "no-store",
    });
    const j = (await t.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error_code?: string; msg?: string; error_description?: string };
    if (t.ok && j.access_token && j.refresh_token) {
      attempts.delete(key);
      return NextResponse.json({ access_token: j.access_token, refresh_token: j.refresh_token, expires_in: j.expires_in ?? 3600 });
    }
    if (j.error_code === "email_not_confirmed" || /not confirmed/i.test(j.msg ?? j.error_description ?? "")) unconfirmed = true;
  }
  failed(key);
  if (unconfirmed) return NextResponse.json({ error: "Please confirm your email first — open the link we sent you, then log in." }, { status: 403 });
  return NextResponse.json({ error: MISMATCH }, { status: 401 });
}
