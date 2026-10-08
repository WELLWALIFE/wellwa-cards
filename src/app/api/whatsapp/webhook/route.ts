// WhatsApp Cloud API webhook — multi-tenant. One URL for every user:
// GET  → Meta verification (hub.verify_token is matched against wa_cloud_accounts.verify_token)
// POST → routed by entry.changes[].value.metadata.phone_number_id → that owner's account.
//        Signature (x-hub-signature-256) is checked with the account's app secret when set.
// Inbound messages → CRM log + menu bot / AI reply; statuses → delivery tracking (src/lib/wa-cloud.ts).
// Shubhora's OWN number (WA_ONBOARD_OWNER_ID) runs the website-making bot instead (src/lib/wa-onboard.ts).
import crypto from "node:crypto";
import { cloudAccountByPhoneId, cloudAccountByVerify, handleCloudValue } from "@/lib/wa-cloud";
import { handleOnboardValue, isOnboardAccount } from "@/lib/wa-onboard";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const tok = u.searchParams.get("hub.verify_token") ?? "";
  if (u.searchParams.get("hub.mode") === "subscribe" && tok) {
    const ok = (process.env.WHATSAPP_VERIFY_TOKEN && tok === process.env.WHATSAPP_VERIFY_TOKEN) || !!(await cloudAccountByVerify(tok));
    if (ok) return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  let body: { object?: string; entry?: { changes?: { field?: string; value?: Record<string, unknown> & { metadata?: { phone_number_id?: string } } }[] }[] };
  try { body = JSON.parse(raw); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (body.object !== "whatsapp_business_account") return Response.json({ ok: true });
  const sig = request.headers.get("x-hub-signature-256") ?? "";
  const checked = new Map<string, boolean>();
  const work: Promise<unknown>[] = [];
  for (const entry of body.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      const v = ch.value; const pnid = v?.metadata?.phone_number_id;
      if (!v || !pnid) continue;
      const acc = await cloudAccountByPhoneId(pnid);
      if (!acc) continue;
      if (acc.app_secret) {
        if (!checked.has(acc.owner_id)) {
          const expected = `sha256=${crypto.createHmac("sha256", acc.app_secret).update(raw).digest("hex")}`;
          checked.set(acc.owner_id, sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
        }
        if (!checked.get(acc.owner_id)) { console.warn("[wa-cloud] bad signature for", acc.owner_id); continue; }
      }
      const run = isOnboardAccount(acc)
        ? handleOnboardValue(acc, v as Parameters<typeof handleOnboardValue>[1])
        : handleCloudValue(acc, v as Parameters<typeof handleCloudValue>[1]);
      work.push(run.catch((e) => console.error("[wa-cloud]", e?.message ?? e)));
    }
  }
  await Promise.all(work);
  return Response.json({ ok: true }); // always 200 so Meta doesn't retry endlessly
}
