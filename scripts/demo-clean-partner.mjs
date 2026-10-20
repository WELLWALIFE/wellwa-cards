// One-off for the DEMO account (19 Oct 2026): it was walked as a Shubhora partner and then as "Sharma Sweets"; the Shubhora plan products
// and the seller marks (kb, Shubhora logo) that stayed behind are taken off. Run on the VPS.
import fs from "node:fs"; import path from "node:path";
const APP = "/opt/neuraledge/app"; const env = {};
for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SITE = "https://shubhora.com", EMAIL = "p919000001212@phone.neuraledge.me", UID = "2e4475d3-89e9-470e-b48b-3c197dc094ed";
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const gl = await (await fetch(`${SUPA}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email: EMAIL }) })).json();
const v = await (await fetch(`${SUPA}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: gl.hashed_token ?? gl.properties?.hashed_token }) })).json();
const A = { authorization: `Bearer ${v.access_token}`, "content-type": "application/json" };
const list = await (await fetch(`${SITE}/api/poster/products`, { headers: A })).json();
let gone = 0;
for (const p of list.products ?? []) if (/shubhora/i.test(`${p.category ?? ""} ${p.brand ?? ""}`)) { const r = await fetch(`${SITE}/api/poster/products?id=${p.id}`, { method: "DELETE", headers: A }); if (r.ok) gone++; }
console.log("Shubhora products removed:", gone);
const cards = await (await fetch(`${SUPA}/rest/v1/cards?owner_id=eq.${UID}&select=id,data`, { headers: H })).json();
for (const c of cards) {
  const d = c.data; if (d.kb !== "shubhora" && d.site?.logoUrl !== "/art/brand/shubhora-logo.png") continue;
  delete d.kb; if (d.site?.logoUrl === "/art/brand/shubhora-logo.png") delete d.site.logoUrl;
  const r = await fetch(`${SUPA}/rest/v1/cards?id=eq.${c.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ data: d }) });
  console.log("card cleaned:", c.id, r.status);
}
const prof = await (await fetch(`${SUPA}/rest/v1/poster_profiles?user_id=eq.${UID}&logo_url=eq.%2Fart%2Fbrand%2Fshubhora-logo.png&select=id`, { headers: H })).json();
for (const p of prof) { const r = await fetch(`${SUPA}/rest/v1/poster_profiles?id=eq.${p.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ logo_url: null }) }); console.log("profile logo cleared:", p.id, r.status); }
