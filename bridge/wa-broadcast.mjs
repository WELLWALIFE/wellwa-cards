// WhatsApp Cloud API broadcast sender: every minute, take queued items of
// "sending" campaigns (and start "scheduled" ones whose time has come), send
// the approved template through the owner's own Cloud API number, record the
// message id (delivery/read statuses arrive via the webhook).
//   pm2 start bridge/wa-broadcast.mjs --name neuraledge-broadcast --cron "* * * * *" --no-autorestart
// Pace: at most 80 messages per campaign per run (~1.3/s) — well inside Meta's
// throughput; Meta's own tier limits (250/1k/10k unique customers per 24h) still apply.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* no env file */ }
  return env;
}
const env = loadEnv();
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GRAPH = "https://graph.facebook.com/v21.0";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const PER_RUN = 80;
async function rest(q, init) { const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } }); const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }
async function restList(q) { const j = await rest(q); if (Array.isArray(j)) return j; if (j?.message) console.error(`[broadcast] ${q.split("?")[0]}: ${j.message}`); return []; }
const patch = (q, body) => rest(q, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });

function components(params, item, headerImage) {
  const out = [];
  if (headerImage) out.push({ type: "header", parameters: [{ type: "image", image: { link: headerImage } }] });
  if (params?.length) out.push({ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p.source === "name" ? ((item.name || "").split(/\s+/)[0] || "ji") : p.source === "city" ? (item.city || "") : p.source === "phone" ? item.phone : (p.value || "")).slice(0, 200) || "-" })) });
  return out;
}
async function sendTemplate(acc, item, b) {
  const r = await fetch(`${GRAPH}/${acc.phone_number_id}/messages`, { method: "POST", headers: { Authorization: `Bearer ${acc.access_token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ messaging_product: "whatsapp", to: item.phone.replace(/[^0-9]/g, ""), type: "template", template: { name: b.template_name, language: { code: b.template_lang || "en" }, components: components(b.params, item, b.header_image) } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${j.error?.code ?? r.status} ${j.error?.error_data?.details || j.error?.message || ""}`.slice(0, 200));
  return j.messages?.[0]?.id ?? "";
}

async function main() {
  if (!SUPA || !KEY) throw new Error("env missing");
  const now = new Date().toISOString();
  // scheduled → sending
  await patch(`wa_broadcasts?status=eq.scheduled&scheduled_at=lte.${now}`, { status: "sending" });
  const campaigns = await restList("wa_broadcasts?status=eq.sending&select=id,owner_id,template_name,template_lang,params,header_image&order=created_at&limit=20");
  if (!campaigns.length) return;
  for (const b of campaigns) {
    const acc = (await restList(`wa_cloud_accounts?owner_id=eq.${b.owner_id}&select=phone_number_id,access_token,enabled`))[0];
    if (!acc?.enabled) { await patch(`wa_broadcasts?id=eq.${b.id}`, { status: "failed", finished_at: now }); await patch(`wa_broadcast_items?broadcast_id=eq.${b.id}&status=eq.queued`, { status: "failed", error: "API not connected" }); continue; }
    const items = await restList(`wa_broadcast_items?broadcast_id=eq.${b.id}&status=eq.queued&select=id,lead_id,phone,name&order=id&limit=${PER_RUN}`);
    if (!items.length) {
      const counts = await restList(`wa_broadcast_items?broadcast_id=eq.${b.id}&select=status`);
      const sent = counts.filter((x) => x.status !== "failed").length, failed = counts.length - sent;
      await patch(`wa_broadcasts?id=eq.${b.id}`, { status: "done", finished_at: now, sent, failed });
      console.log(`[broadcast] ${b.id.slice(0, 8)} done: sent=${sent} failed=${failed}`);
      continue;
    }
    // per-item city from the lead (name is on the item)
    const leadIds = items.map((i) => i.lead_id).filter(Boolean);
    const cities = new Map((leadIds.length ? await restList(`leads?id=in.(${leadIds.join(",")})&select=id,city`) : []).map((l) => [l.id, l.city]));
    let ok = 0, bad = 0;
    for (const it of items) {
      try {
        const id = await sendTemplate(acc, { ...it, city: cities.get(it.lead_id) || "" }, b);
        await patch(`wa_broadcast_items?id=eq.${it.id}`, { status: "sent", wa_msg_id: id, updated_at: now });
        if (id) await rest("rpc/wa_log_message", { method: "POST", body: JSON.stringify({ p_owner: b.owner_id, p_card: null, p_phone: it.phone, p_name: it.name || "", p_wa_id: id, p_direction: "out", p_sender: "owner", p_kind: "text", p_text: `📣 [${b.template_name}] broadcast`, p_sent_at: now }) });
        if (id) await patch(`wa_messages?owner_id=eq.${b.owner_id}&wa_id=eq.${encodeURIComponent(id)}`, { channel: "cloud", status: "sent" });
        ok += 1;
      } catch (e) {
        await patch(`wa_broadcast_items?id=eq.${it.id}`, { status: "failed", error: String(e?.message ?? e).slice(0, 200), updated_at: now });
        bad += 1;
        if (/^(190|131049|130429) /.test(String(e?.message))) { console.log(`[broadcast] ${b.id.slice(0, 8)} paused: ${e.message}`); break; } // token/rate problem — stop this run
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    const done = await restList(`wa_broadcast_items?broadcast_id=eq.${b.id}&status=neq.queued&select=status`);
    await patch(`wa_broadcasts?id=eq.${b.id}`, { sent: done.filter((x) => x.status !== "failed").length, failed: done.filter((x) => x.status === "failed").length });
    console.log(`[broadcast] ${b.id.slice(0, 8)}: +${ok} sent, ${bad} failed`);
  }
}
main().catch((e) => { console.error("[broadcast] fatal", e); process.exit(1); });
