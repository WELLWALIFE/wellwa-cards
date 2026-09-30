// WhatsApp Cloud API account (bearer, owner only).
// GET → account (secrets masked) + webhook URL. PUT { phone_number_id, waba_id, access_token?, app_secret?, enabled?, ai_enabled? } → validate with Meta and save.
// POST { to, text } → test send. DELETE → disconnect.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { cloudAccount, publicAccount, phoneInfo, sendCloud, friendlyGraphError, logCloud, cardForOwner, type CloudAccount } from "@/lib/wa-cloud";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com";
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const a = await cloudAccount(me.id);
  return NextResponse.json({ account: a ? publicAccount(a) : null, webhook_url: `${SITE}/api/whatsapp/webhook`, verify_token: a?.verify_token ?? "" });
}

export async function PUT(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const cur = await cloudAccount(me.id);
  const phone_number_id = S(b.phone_number_id, 40) || cur?.phone_number_id || "";
  const waba_id = S(b.waba_id, 40) || cur?.waba_id || "";
  const access_token = S(b.access_token, 600) || cur?.access_token || "";
  const app_secret = "app_secret" in b ? S(b.app_secret, 120) : (cur?.app_secret ?? "");
  if (!/^\d{6,25}$/.test(phone_number_id)) return NextResponse.json({ error: "Phone number ID looks wrong (digits only, from Meta → WhatsApp → API setup)." }, { status: 400 });
  if (!access_token) return NextResponse.json({ error: "Access token is required." }, { status: 400 });
  let info;
  try { info = await phoneInfo(access_token, phone_number_id); }
  catch (e) { return NextResponse.json({ error: `Meta rejected these details: ${friendlyGraphError(e)}` }, { status: 400 }); }
  const row: Partial<CloudAccount> & { owner_id: string; updated_at: string } = {
    owner_id: me.id, phone_number_id, waba_id, access_token, app_secret, verify_token: cur?.verify_token || token(),
    display_phone: info.display_phone_number ?? "", verified_name: info.verified_name ?? "", quality_rating: info.quality_rating ?? "",
    messaging_limit: info.messaging_limit_tier ?? "", official: !!info.is_official_business_account,
    enabled: typeof b.enabled === "boolean" ? b.enabled : (cur?.enabled ?? true), ai_enabled: typeof b.ai_enabled === "boolean" ? b.ai_enabled : (cur?.ai_enabled ?? true),
    last_error: "", updated_at: new Date().toISOString(),
  };
  const clash = (await restAsService<{ owner_id: string }[]>(`wa_cloud_accounts?phone_number_id=eq.${phone_number_id}&select=owner_id`)).data?.[0];
  if (clash && clash.owner_id !== me.id) return NextResponse.json({ error: "This phone number is already connected to another account." }, { status: 409 });
  const r = await restAsService("wa_cloud_accounts?on_conflict=owner_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
  if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save (run migration 0039?)." }, { status: 502 });
  const a = await cloudAccount(me.id);
  return NextResponse.json({ ok: true, account: a ? publicAccount(a) : null, webhook_url: `${SITE}/api/whatsapp/webhook`, verify_token: a?.verify_token ?? "" });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  if (typeof b.ai_enabled === "boolean") patch.ai_enabled = b.ai_enabled;
  if (b.refresh === true) {
    const a = await cloudAccount(me.id);
    if (a) { try { const i = await phoneInfo(a.access_token, a.phone_number_id); Object.assign(patch, { display_phone: i.display_phone_number ?? "", verified_name: i.verified_name ?? "", quality_rating: i.quality_rating ?? "", messaging_limit: i.messaging_limit_tier ?? "", official: !!i.is_official_business_account, last_error: "" }); } catch (e) { patch.last_error = friendlyGraphError(e); } }
  }
  await restAsService(`wa_cloud_accounts?owner_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  const a = await cloudAccount(me.id);
  return NextResponse.json({ ok: true, account: a ? publicAccount(a) : null });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const a = await cloudAccount(me.id);
  if (!a) return NextResponse.json({ error: "Connect your Cloud API account first." }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const to = String(b.to ?? "").replace(/[^0-9]/g, ""); const text = S(b.text, 1000) || "✅ Shubhora WhatsApp API is connected. (test message)";
  if (to.length < 10) return NextResponse.json({ error: "Enter a valid number with country code, e.g. 919876543210." }, { status: 400 });
  try {
    const id = b.template ? await sendCloud(a, to, { template: S(b.template, 512), lang: S(b.lang, 10) || "en_US" }) : await sendCloud(a, to, { text });
    const card = await cardForOwner(me.id);
    if (id) await logCloud({ ownerId: me.id, cardId: card?.id ?? null, phone: "+" + (to.length === 10 ? "91" + to : to), waId: id, direction: "out", sender: "owner", text: b.template ? `[template ${b.template}]` : text });
    return NextResponse.json({ ok: true, id });
  } catch (e) { return NextResponse.json({ error: friendlyGraphError(e) }, { status: 502 }); }
}

export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  await restAsService(`wa_cloud_accounts?owner_id=eq.${me.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return NextResponse.json({ ok: true });
}
