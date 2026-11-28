// A dealer's card, refilled from the brand's website with the dealer import (site-import.ts dealerEnrich + storeSiteMedia "dealer"):
// every model with its own photos, spec points, colours and MRP; the brand's product banners as the sliding banners and the cover;
// the brand's product pictures in the card's first picture block. Products are matched by name — never deleted.
//
// Built into one file and run on the server (it needs the server's .env.local; keys are never printed):
//   ~/.npm/_npx/*/node_modules/.bin/esbuild scripts/dealer-refresh.ts --bundle --platform=node --format=esm --target=node20 \
//     --external:sharp --external:next --external:puppeteer-core --alias:server-only=./scripts/empty.js --outfile=work/dealer-refresh.mjs
//   ssh … 'cd /opt/neuraledge/app && set -a && . ./.env.local && set +a && CARD=vipin-thakkar SITE=https://chitrakaev.com [APPLY=1] [THEME=#16a34a] node --input-type=module -' < work/dealer-refresh.mjs
// Without APPLY it only reads the brand site and prints what it found (nothing copied, nothing written).
import { mkdirSync, writeFileSync } from "fs";
import { dealerEnrich, importSite, storeSiteMedia } from "@/lib/site-import";
import { bannerFocus } from "@/lib/media/photo-focus";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", K = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const CARD = process.env.CARD ?? "", SITE = process.env.SITE ?? "", APPLY = process.env.APPLY === "1", THEME = process.env.THEME ?? "";
type Row = { id: string; name: string; sort: number; brand: string | null; benefits: string[] };
type Item = { name: string; images?: string[]; imageUrl?: string; features?: string[]; specs?: { label: string; value: string }[]; mrp?: string; price?: string; desc?: string };
type Block = { id: string; kind: string; title?: string; items?: Item[]; images?: { url: string }[] };

async function get<T>(path: string): Promise<T> { const r = await fetch(`${U}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`GET ${path.split("?")[0]} ${r.status}`); return r.json() as Promise<T>; }
async function write(path: string, method: string, body: unknown) {
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} ${r.status} ${await r.text()}`);
}
const rupees = (d: string) => (d ? `₹${Number(d).toLocaleString("en-IN")}` : "");

async function main() {
  if (!U || !K || !CARD || !SITE) throw new Error("CARD, SITE and the server env are needed");
  const [card] = await get<{ id: string; owner_id: string; data: Record<string, unknown> & { pages: { slug: string; blocks: Block[] }[] } }[]>(`cards?username=eq.${encodeURIComponent(CARD)}&select=id,owner_id,data`);
  if (!card) throw new Error("card not found");
  const uid = card.owner_id;
  const t0 = Date.now();
  const imp0 = await importSite(SITE);
  if (!imp0) throw new Error("brand site not read");
  const imp = await dealerEnrich(imp0, process.env.DEBUG ? (u, k) => console.log(`  seen ${k.padEnd(8)} ${u.replace(/^https?:\/\/[^/]+\//, "")}`) : undefined);
  console.log(`read in ${Math.round((Date.now() - t0) / 1000)} s — ${imp.products.length} models, ${imp.dealer?.banners.length ?? 0} banners, ${imp.dealer?.pictures.length ?? 0} pictures`);
  for (const p of imp.products) console.log(`  ${p.name} | ${p.mrp ? `MRP ${p.mrp} ` : ""}| ${p.images.length} photos | ${p.specs.slice(0, 6).join(" · ")}`);
  for (const p of imp.products) for (const u of p.images) console.log(`     ${p.name.slice(0, 22)}: ${u.replace(/^https?:\/\/[^/]+\//, "")}`);
  for (const u of imp.dealer?.banners ?? []) console.log(`  banner: ${u.replace(/^https?:\/\/[^/]+\//, "")}`);
  for (const u of imp.dealer?.pictures ?? []) console.log(`  picture: ${u.replace(/^https?:\/\/[^/]+\//, "")}`);
  if (!APPLY) { console.log("read only (APPLY=1 to write)"); return; }

  const rows = await get<Row[]>(`poster_products?user_id=eq.${uid}&select=id,name,sort,brand,benefits`);
  const dir = `/root/dealer-backup-${CARD}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/card.json`, JSON.stringify(card));
  writeFileSync(`${dir}/poster_products.json`, JSON.stringify(rows));
  console.log(`backup: ${dir}`);

  const stored = await storeSiteMedia(uid, imp, "dealer");
  const key = (n: string) => n.trim().toLowerCase();
  const byName = new Map(rows.map((r) => [key(r.name), r]));
  for (const [i, p] of stored.products.entries()) {
    if (!p.stored.length) { console.log(`  ${p.name}: no photo copied — row left as it is`); continue; }
    const photos = p.stored.map((url) => ({ url, view: "front", role: "identity" }));
    const patch = { photo_url: p.stored[0], photos, benefits: p.specs.slice(0, 6), ...(p.mrp ? { mrp: p.mrp } : {}), sort: 200 + i };
    const have = byName.get(key(p.name));
    if (have) await write(`poster_products?id=eq.${have.id}&user_id=eq.${uid}`, "PATCH", patch);
    else await write("poster_products", "POST", { user_id: uid, name: p.name.slice(0, 60), brand: (imp.name || "").slice(0, 40), price: "", mrp: "", offer: "", category: "", active: true, ...patch });
    console.log(`  ${have ? "updated" : "added"} ${p.name} (${p.stored.length} photos)`);
  }

  const data = structuredClone(card.data) as typeof card.data & { coverUrl?: string; themeColor?: string; site?: { bannerUrl?: string; hero?: { imageUrl?: string; focus?: string; textSide?: string; focusOwn?: boolean; slides?: { headline: string; sub?: string; imageUrl?: string; focus?: string; focusOwn?: boolean }[] } } };
  const pblock = data.pages.flatMap((pg) => pg.blocks).find((b) => b.kind === "product");
  if (pblock) {
    const old = new Map((pblock.items ?? []).map((it) => [key(it.name), it]));
    const models = stored.products.filter((p) => p.stored.length);
    const others = (pblock.items ?? []).filter((it) => !models.some((p) => key(p.name) === key(it.name)) && !/^₹/.test(it.name.trim()));
    pblock.items = [...models.map((p) => {
      const it = old.get(key(p.name));
      return { ...(it ?? { specs: [] }), name: p.name, images: p.stored.slice(0, 6), imageUrl: p.stored[0], features: p.specs.slice(0, 6), specs: p.specRows ?? it?.specs ?? [], ...(p.mrp ? { mrp: rupees(p.mrp) } : {}), ...(!it?.desc && p.description ? { desc: p.description } : {}) };
    }), ...others];
    console.log(`  products block: ${pblock.items.length} items`);
  }
  const home = data.pages.find((pg) => pg.slug === "home") ?? data.pages[0];
  const pics = home?.blocks.find((b) => b.kind === "image" || b.kind === "gallery");
  if (pics && stored.gallery.length) { pics.images = stored.gallery.slice(0, 6).map((url) => ({ url })); console.log(`  ${pics.title}: ${pics.images.length} pictures`); }
  const banners = stored.banners ?? [];
  if (banners.length && data.site) {
    const focus = await Promise.all(banners.map((u) => bannerFocus(u).catch(() => null)));
    const hero = data.site.hero ?? {};
    const old = hero.slides ?? [];
    const lines = old.length ? old : [{ headline: "", sub: "" }];
    data.site.hero = { ...hero, imageUrl: banners[0], ...(focus[0] ? { focus: focus[0].focus, textSide: focus[0].textSide } : {}),
      // A model's own studio banner says the model and two of its facts; the others keep the card's own lines, in order.
      slides: (() => { let k = 0; return banners.slice(0, 5).map((imageUrl, i) => {
        const model = stored.bannerModel?.[imageUrl];
        const p = model ? stored.products.find((x) => x.name === model) : undefined;
        const line = p ? { headline: p.name, sub: (p.specRows ?? []).slice(0, 2).map((r) => `${r.label} ${r.value}`).join(" · ") } : lines[k++ % lines.length];
        return { ...line, imageUrl, ...(focus[i] ? { focus: focus[i]!.focus } : {}), focusOwn: false };
      }).filter((x) => x.headline); })() };
    data.site.bannerUrl = banners[0];
    data.coverUrl = banners[0];
    console.log(`  banners: ${banners.length}, slides: ${data.site.hero.slides?.length ?? 0}`);
  }
  if (THEME) data.themeColor = THEME;
  await write(`cards?id=eq.${card.id}`, "PATCH", { data });
  console.log("done");
}
main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
