// Resets the DEMO account through the app's own /api/demo/reset (what the "Reset demo" pill calls). Run on the VPS.
import fs from "node:fs"; import path from "node:path";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, EMAIL = "p919000001212@phone.neuraledge.me";
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const gl = await (await fetch(`${SUPA}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email: EMAIL }) })).json();
const v = await (await fetch(`${SUPA}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: gl.hashed_token ?? gl.properties?.hashed_token }) })).json();
const r = await fetch("https://shubhora.com/api/demo/reset", { method: "POST", headers: { authorization: `Bearer ${v.access_token}`, "content-type": "application/json" }, body: "{}" });
console.log(r.status, (await r.text()).slice(0, 200));
