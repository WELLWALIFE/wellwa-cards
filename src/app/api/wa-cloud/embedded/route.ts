// WhatsApp Cloud API by Embedded Signup (phase 3, owner's call 8 Oct 2026): the seller presses one button, logs in to
// Facebook, picks or creates their WhatsApp Business account and number inside Meta's own window, and comes back
// connected — no tokens to copy, no Baileys, their own number, Meta's official API.
//   GET  (bearer) → { ready, appId, configId }  — what the button needs (Shubhora's Meta app + its Embedded Signup config)
//   POST (bearer) { code, phone_number_id, waba_id } → exchanges the code for the business token, subscribes our app to
//        the account's webhooks, registers the number for Cloud API and saves the account like the manual form does.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { META_APP_ID, META_APP_SECRET } from "@/lib/social-server";
import { GRAPH, cloudAccount, publicAccount, phoneInfo, friendlyGraphError, type CloudAccount } from "@/lib/wa-cloud";

const CONFIG_ID = () => process.env.NEXT_PUBLIC_META_WA_CONFIG_ID ?? "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com";
const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const verifyToken = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");

async function meta<T = Record<string, unknown>>(path: string, init: { token?: string; method?: string; body?: unknown; query?: Record<string, string> }): Promise<T> {
  const q = new URLSearchParams(init.query ?? {}).toString();
  const r = await fetch(`${GRAPH}/${path}${q ? `?${q}` : ""}`, {
    method: init.method ?? (init.body ? "POST" : "GET"), cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) }, body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } } } & T;
  if (!r.ok || j.error) { const e = new Error(j.error?.error_data?.details || j.error?.message || `Graph ${r.status}`) as Error & { code?: number }; e.code = j.error?.code ?? r.status; throw e; }
  return j;
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const ready = !!(META_APP_ID && META_APP_SECRET && CONFIG_ID());
  return NextResponse.json({ ready, appId: ready ? META_APP_ID : "", configId: ready ? CONFIG_ID() : "" });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!(META_APP_ID && META_APP_SECRET && CONFIG_ID())) return NextResponse.json({ error: "Embedded signup is not set up on this server yet." }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = S(b.code, 600), phone_number_id = S(b.phone_number_id, 40), waba_id = S(b.waba_id, 40);
  if (!code || !/^\d{6,25}$/.test(phone_number_id) || !/^\d{6,25}$/.test(waba_id)) return NextResponse.json({ error: "Meta did not hand back the number — please try the connect button again." }, { status: 400 });
  const clash = (await restAsService<{ owner_id: string }[]>(`wa_cloud_accounts?phone_number_id=eq.${phone_number_id}&select=owner_id`)).data?.[0];
  if (clash && clash.owner_id !== me.id) return NextResponse.json({ error: "This phone number is already connected to another account." }, { status: 409 });
  try {
    // 1. The code from Meta's window → a business integration token (long-lived, scoped to this WABA).
    const tok = await meta<{ access_token: string }>("oauth/access_token", { query: { client_id: META_APP_ID, client_secret: META_APP_SECRET, code } });
    const access_token = tok.access_token;
    // 2. Our app receives this account's messages (the webhook is set once on the app; this points the account at it).
    await meta(`${waba_id}/subscribed_apps`, { token: access_token, body: {} });
    // 3. The number is registered for Cloud API (a two-step PIN of our own; fine to repeat — "already registered" is not an error).
    const pin = String(parseInt(me.id.replace(/-/g, "").slice(0, 8), 16) % 1_000_000).padStart(6, "0");
    await meta(`${phone_number_id}/register`, { token: access_token, body: { messaging_product: "whatsapp", pin } }).catch((e: Error & { code?: number }) => { if (e.code !== 131_000 && !/already/i.test(e.message)) throw e; });
    const info = await phoneInfo(access_token, phone_number_id);
    const cur = await cloudAccount(me.id);
    const row: Partial<CloudAccount> & { owner_id: string; updated_at: string } = {
      owner_id: me.id, phone_number_id, waba_id, access_token,
      // Signature checks use Shubhora's own app secret — the account came through our app.
      app_secret: META_APP_SECRET, verify_token: cur?.verify_token || verifyToken(),
      display_phone: info.display_phone_number ?? "", verified_name: info.verified_name ?? "", quality_rating: info.quality_rating ?? "",
      messaging_limit: info.messaging_limit_tier ?? "", official: !!info.is_official_business_account,
      enabled: true, ai_enabled: cur?.ai_enabled ?? true, last_error: "", updated_at: new Date().toISOString(),
    };
    const r = await restAsService("wa_cloud_accounts?on_conflict=owner_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save (run migration 0039?)." }, { status: 502 });
    const a = await cloudAccount(me.id);
    return NextResponse.json({ ok: true, account: a ? publicAccount(a) : null, webhook_url: `${SITE}/api/whatsapp/webhook` });
  } catch (e) {
    console.error("[wa-embedded]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: `Meta did not complete the connection: ${friendlyGraphError(e)}` }, { status: 502 });
  }
}
