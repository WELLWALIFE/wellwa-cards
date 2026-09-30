// 1st of every month 08:30 IST: WhatsApp the last-30-day marketing report to
// every user who has WhatsApp connected (their own number = profile.phone).
import fs from "node:fs"; import path from "node:path";
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env }; try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch {}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, SITE = (env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = async (q) => { const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: H }); try { return await r.json(); } catch { return null; } };
async function main() {
  const profiles = await rest(`poster_profiles?is_default=eq.true&phone=neq.&select=user_id,phone,name,lang`);
  if (!Array.isArray(profiles)) { console.log("query failed", profiles); return; }
  let sent = 0;
  for (const p of profiles) {
    try {
      const pl = (await rest(`profiles?id=eq.${p.user_id}&select=plan_expires_at,plan`))?.[0];
      if (!pl?.plan_expires_at || new Date(pl.plan_expires_at) < new Date()) continue; // bridge only runs for active plans
      // reuse the app's report endpoint via an internal service call
      const r = await fetch(`${SITE}/api/poster/report-internal?user=${p.user_id}`, { headers: { "x-internal-key": env.INTERNAL_KEY || KEY } }).then((x) => x.json()).catch(() => null);
      if (!r?.text) continue;
      const to = String(p.phone).replace(/\D/g, "").slice(-10);
      const s = await fetch("http://127.0.0.1:8787/send", { method: "POST", headers: { "content-type": "application/json", "x-neuraledge-user": p.user_id, "x-neuraledge-plan-expires": pl.plan_expires_at }, body: JSON.stringify({ to: "91" + to, text: r.text }), signal: AbortSignal.timeout(30000) });
      if (s.ok) sent++; else console.log("send failed", p.user_id, s.status);
    } catch (e) { console.log("report failed", p.user_id, e.message); }
  }
  console.log(`[report] sent ${sent}/${profiles.length}`);
}
main().then(() => process.exit(0));
