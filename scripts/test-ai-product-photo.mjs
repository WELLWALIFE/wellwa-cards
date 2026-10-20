// Demo: make an AI photo for the Standard plan with the product-aware prompt (1 credit on the demo account); saves /tmp/ai-std.jpg.
import fs from "node:fs"; import path from "node:path";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SITE = "https://shubhora.com", EMAIL = "p919000001212@phone.neuraledge.me";
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const gl = await (await fetch(`${SUPA}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email: EMAIL }) })).json();
const th = gl.hashed_token ?? gl.properties?.hashed_token;
const v = await (await fetch(`${SUPA}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: th }) })).json();
const tok = v.access_token; if (!tok) { console.log("login failed", JSON.stringify(v).slice(0, 200)); process.exit(1); }
const body = { name: process.argv[2] || "Shubhora AI Business Assistant — Standard", mode: "ai", brand: "Shubhora", category: "Shubhora", about: process.argv[3] || "Pre-launch: join free. Digital business card + Standard website (up to 5 pages). Daily poster on Facebook, Instagram and WhatsApp Status. WhatsApp AI assistant answers customers and filters leads" };
const t0 = Date.now();
const r = await fetch(`${SITE}/api/poster/products/stock-photo`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok}` }, body: JSON.stringify(body) });
const j = await r.json().catch(() => null);
console.log(r.status, JSON.stringify(j).slice(0, 300), `${Math.round((Date.now() - t0) / 1000)}s`);
if (j?.url) { const b = Buffer.from(await (await fetch(j.url)).arrayBuffer()); fs.writeFileSync(process.argv[4] || "/tmp/ai-std.jpg", b); console.log("saved", b.length); }
