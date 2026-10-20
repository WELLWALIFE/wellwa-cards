// Demo: the Studio button on the Standard plan (a digital product) must draw the product in use on a screen, not polish the old speaker.
import fs from "node:fs"; import path from "node:path";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SITE = "https://shubhora.com", EMAIL = "p919000001212@phone.neuraledge.me";
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const gl = await (await fetch(`${SUPA}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email: EMAIL }) })).json();
const v = await (await fetch(`${SUPA}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: gl.hashed_token ?? gl.properties?.hashed_token }) })).json();
const body = { photo_url: "https://kyywwgkrbozbsyodolvj.supabase.co/storage/v1/object/public/media/poster/2e4475d3-89e9-470e-b48b-3c197dc094ed/product-studio-1792431830361.jpg", product: "Shubhora AI Business Assistant — Standard", brand: "Shubhora", category: "Shubhora", about: "Pre-launch: join free. Digital business card + Standard website (up to 5 pages). Daily poster on Facebook, Instagram and WhatsApp Status. WhatsApp AI assistant answers customers and filters leads", allowPaid: true, product_id: "cb69101e-6df9-479d-bdca-52bb5e2c27bd" };
const t0 = Date.now();
const r = await fetch(`${SITE}/api/card/product-photo`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${v.access_token}` }, body: JSON.stringify(body) });
const j = await r.json().catch(() => null);
console.log(r.status, JSON.stringify(j).slice(0, 300), `${Math.round((Date.now() - t0) / 1000)}s`);
if (j?.url) { const b = Buffer.from(await (await fetch(j.url)).arrayBuffer()); fs.writeFileSync("/tmp/studio-std.jpg", b); console.log("saved", b.length); }
