// One-off (28 Nov 2026): Vipin Thakkar's Single Light said "Top Speed: Speed: 20-25 km/h" — the doubled word taken out (row + card).
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']\r?$/g, "").trim()]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY, H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const UID = "17f07ec1-1809-479e-b94e-00abb04e58a0", CARD = "35414dfa-feb5-4468-9521-0adfa3ad7f4d";
const fix = (s) => typeof s === "string" ? s.replace(/^Top Speed: Speed: /, "Top Speed: ") : s;
const rows = await (await fetch(`${U}/rest/v1/poster_products?user_id=eq.${UID}&select=id,benefits`, { headers: H })).json();
for (const r of rows) { const b = r.benefits.map(fix); if (JSON.stringify(b) !== JSON.stringify(r.benefits)) { await fetch(`${U}/rest/v1/poster_products?id=eq.${r.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ benefits: b }) }); console.log("row fixed"); } }
const [c] = await (await fetch(`${U}/rest/v1/cards?id=eq.${CARD}&select=data`, { headers: H })).json();
let n = 0;
for (const pg of c.data.pages) for (const bl of pg.blocks) if (bl.kind === "product") for (const it of bl.items) {
  it.features = (it.features ?? []).map((f) => { const g = fix(f); if (g !== f) n++; return g; });
  it.specs = (it.specs ?? []).map((s) => { const m = /^Speed:\s*/.test(s.value ?? "") && /speed/i.test(s.label); if (m) n++; return m ? { ...s, value: s.value.replace(/^Speed:\s*/, "") } : s; });
}
if (n) { const r = await fetch(`${U}/rest/v1/cards?id=eq.${CARD}`, { method: "PATCH", headers: H, body: JSON.stringify({ data: c.data }) }); console.log("card fixed", n, r.status); }
