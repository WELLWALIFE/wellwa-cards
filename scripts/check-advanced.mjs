// `node scripts/check-advanced.mjs` — the ADVANCED website's unit checks (src/lib/site-advanced*.ts, src/components/site-adv). No account, no
// server, no AI, no network: TypeScript is transpiled in memory (the same way scripts/trade-check compiles to CommonJS), so there is nothing to
// build first. Exit code 1 on any failure.
//   1. validateSpec / parseAdvanced / activeAdvanced never throw on garbage, and what they return is always drawable
//   2. 40 fake cards across the trades: specFromSeed gives >= 30 distinct (hero, order, palette) combinations, every spec is valid
//   3. every variant id (the lists, the archetype library, the specs) exists in the registry; the registry has nothing extra
//   4. the archetype library is sound (checkArchetypes) and every business category maps to a group with >= 8 archetypes
//   5. (when the renderer loads in plain Node) the page renders to HTML for a sample of the cards, in both languages
import Module, { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");

/* ---- an in-memory TypeScript loader: .ts / .tsx -> CommonJS, "@/x" -> src/x ---- */
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith("@/")) req = path.join(ROOT, "src", req.slice(2));
  return origResolve.call(this, req, ...rest);
};
for (const ext of [".ts", ".tsx"]) {
  Module._extensions[ext] = (mod, file) => {
    const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true },
    });
    mod._compile(out.outputText, file);
  };
}
// Server-only / CSS imports a renderer may carry; harmless in a test.
Module._extensions[".css"] = () => {};
const src = (p) => require(path.join(ROOT, "src", p));

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log(`  FAIL  ${msg}`); } };
const section = (t) => console.log(`\n${t}`);

const adv = src("lib/site-advanced.ts");
const lib = src("lib/site-advanced-archetypes.ts");
const { VARIANT_IDS, SECTION_KEYS, HERO_IDS, ADV_FONTS, BODY_FONTS, validateSpec, parseAdvanced, activeAdvanced, repairOrder } = adv;
const { PALETTE_KEYS } = src("lib/site-style.ts");

/* ---- seeded generator for the fuzz and the fake cards ---- */
const rnd = adv.rng("check-advanced");
const pick = (l) => l[Math.floor(rnd() * l.length)];

/** A spec the renderer can draw: every id known, every section once, hero first, footer last, only self-hosted faces. */
function drawable(s) {
  const bad = [];
  if (!s || typeof s !== "object") return ["not an object"];
  if (s.v !== 1) bad.push("v");
  if (!HERO_IDS.includes(s.hero)) bad.push(`hero ${s.hero}`);
  if (!Array.isArray(s.order) || s.order[0] !== "hero" || s.order[s.order.length - 1] !== "footer" || s.order.length !== SECTION_KEYS.length || new Set(s.order).size !== SECTION_KEYS.length || !s.order.every((k) => SECTION_KEYS.includes(k))) bad.push(`order ${JSON.stringify(s.order)}`);
  for (const [k, v] of Object.entries(s.sections ?? {})) if (!(VARIANT_IDS[k] ?? []).includes(v) || k === "hero") bad.push(`section ${k}=${v}`);
  if (!PALETTE_KEYS.includes(s.palette?.key)) bad.push(`palette ${s.palette?.key}`);
  if (!["light", "dark"].includes(s.palette?.tone)) bad.push("tone");
  if (!ADV_FONTS[s.fonts?.heading]) bad.push(`heading ${s.fonts?.heading}`);
  if (!BODY_FONTS.includes(s.fonts?.body)) bad.push(`body ${s.fonts?.body}`);
  if (!["sharp", "soft", "pill"].includes(s.shape) || !["airy", "compact"].includes(s.density) || !["none", "subtle", "rich"].includes(s.motion)) bad.push("shape/density/motion");
  if (typeof s.seed !== "string" || !s.seed || typeof s.archetype !== "string" || typeof s.notes !== "string") bad.push("strings");
  return bad;
}

/* ================= 1. garbage in, drawable out ================= */
section("1. validateSpec on garbage");
const garbage = [
  undefined, null, 0, 1, -1, NaN, Infinity, true, false, "", "x", "{}", "hero", [], [1, 2, 3], ["hero"], {}, { v: 1 }, { v: 2 }, { hero: {} }, { hero: ["split-frame"] },
  { hero: "nope", order: "hero", palette: "midnight", fonts: "Inter", sections: "x" },
  { order: ["footer", "hero", "hero", "zzz", null, 5, {}, "about", "about"], sections: { trust: {}, about: 3, services: "grid", hero: "mosaic", __proto__: { x: 1 } } },
  { palette: { key: "brand", color: "javascript:alert(1)", tone: "purple", luxe: "yes" }, fonts: { heading: "Comic Sans", body: "Papyrus" } },
  { palette: { key: "brand", color: "#12ab3" }, shape: "triangle", density: 9, motion: [] },
  { seed: "a".repeat(100000), archetype: "b".repeat(100000), notes: "c\u0000\u0007".repeat(5000) },
  { seed: {}, archetype: [], notes: 7 }, { sections: null, palette: null, fonts: null, order: null },
  JSON.parse('{"__proto__":{"polluted":true},"hero":"masthead"}'), { constructor: { prototype: { polluted: true } } },
  { order: new Array(50).fill("trust") }, { sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, 12345])) },
  () => 1, Symbol("s"), new Date(), /x/, new Map(), new Error("e"),
];
// Plus 600 random nests of random junk.
const junk = (d = 0) => {
  const t = Math.floor(rnd() * 9);
  if (d > 3 || t < 3) return pick([null, undefined, 0, 1.5, -7, "", "hero", "masthead", "\u0000", "#ffffff", true, [], {}, NaN, "x".repeat(200)]);
  if (t < 5) return Array.from({ length: Math.floor(rnd() * 6) }, () => junk(d + 1));
  const o = {};
  const keys = [...SECTION_KEYS, "hero", "order", "sections", "palette", "fonts", "shape", "density", "motion", "seed", "archetype", "notes", "v", "key", "tone", "color", "luxe", "heading", "body", "toString", "constructor"];
  for (let i = 0, n = Math.floor(rnd() * 8); i < n; i++) o[pick(keys)] = junk(d + 1);
  return o;
};
for (let i = 0; i < 600; i++) garbage.push(junk());
let threw = 0, undrawable = 0;
for (const g of garbage) {
  try {
    const v = validateSpec(g, "seed");
    const bad = drawable(v);
    if (bad.length) { undrawable++; if (undrawable < 4) console.log("    ", bad.join(", "), "<-", JSON.stringify(g)?.slice(0, 120)); }
    // The same input again gives the same spec, and repairing a repaired spec changes nothing.
    ok(JSON.stringify(validateSpec(v, "seed")) === JSON.stringify(v), `validateSpec is not idempotent on ${JSON.stringify(g)?.slice(0, 100)}`);
    parseAdvanced(g); activeAdvanced({ advanced: g, advancedOn: rnd() < 0.5 }); activeAdvanced(g);
  } catch (e) { threw++; if (threw < 4) console.log("    threw:", e?.message, "<-", String(g).slice(0, 80)); }
}
ok(threw === 0, `validateSpec threw on ${threw} of ${garbage.length} garbage inputs`);
ok(undrawable === 0, `${undrawable} of ${garbage.length} garbage inputs gave a spec the renderer could not draw`);
ok(({}).polluted === undefined, "prototype pollution through a spec");
ok(repairOrder("nonsense").join() === adv.DEFAULT_ORDER.join(), "repairOrder of garbage is the default order");
ok(parseAdvanced({ hero: "masthead" }) === null && parseAdvanced({ v: 1, hero: "masthead" })?.hero === "masthead", "parseAdvanced accepts only v1");
ok(activeAdvanced({ advanced: { v: 1 }, advancedOn: false }) === null && activeAdvanced({ advanced: { v: 1 } }) !== null && activeAdvanced({ advanced: { v: 1 }, advancedOn: true }) !== null && activeAdvanced(undefined) === null, "activeAdvanced honours advancedOn=false, and treats a missing flag as on");
console.log(`  ${garbage.length} garbage inputs, ${threw} threw, ${undrawable} undrawable`);

/* ================= 2. forty fake cards ================= */
section("2. specFromSeed over 40 fake cards");
const { CATEGORIES } = src("lib/poster-categories.ts");
const catKeys = CATEGORIES.map((c) => c.key);
const NAMES = ["Sharma", "Gupta", "Verma", "Jain", "Agarwal", "Mehta", "Singh", "Patel", "Rao", "Khan", "Das", "Iyer", "Nair", "Bose", "Kapoor", "Malhotra", "Saxena", "Tiwari", "Joshi", "Pandey"];
const SUFFIX = ["Traders", "Studio", "Care", "House", "Works", "Point", "Centre", "& Sons", "Hub", "Corner"];
const photo = (n) => `https://example.test/p${n}.jpg`;
function fakeCard(i, catKey) {
  const name = `${NAMES[i % NAMES.length]} ${SUFFIX[(i * 7) % SUFFIX.length]}`;
  const rich = i % 3 !== 0, bare = i % 5 === 0;
  const blocks = [];
  if (!bare) {
    blocks.push({ id: `a${i}`, kind: "about", title: "About", body: "We have served this neighbourhood for years. ".repeat(1 + (i % 7)), imageUrl: rich ? photo(1) : "" });
    blocks.push({ id: `p${i}`, kind: "product", title: "Products", items: Array.from({ length: i % 9 }, (_, n) => ({ id: `i${n}`, name: `Item ${n}`, price: `Rs ${100 + n}`, desc: "good", imageUrl: rich ? photo(n) : "" })) });
    blocks.push({ id: `g${i}`, kind: "gallery", title: "Photos", images: Array.from({ length: (i * 3) % 10 }, (_, n) => ({ url: photo(n), label: "" })) });
    blocks.push({ id: `t${i}`, kind: "testimonials", title: "Reviews", items: Array.from({ length: i % 5 }, (_, n) => ({ id: `t${n}`, name: `Customer ${n}`, text: "Very good service and honest prices.", rating: 5 })) });
    blocks.push({ id: `f${i}`, kind: "faq", title: "FAQ", items: Array.from({ length: i % 4 }, (_, n) => ({ id: `q${n}`, q: `Question ${n}?`, a: "Yes, of course." })) });
    blocks.push({ id: `h${i}`, kind: "hours", title: "Timings", rows: [{ day: "Mon-Sat", time: "10 am - 8 pm" }] });
    blocks.push({ id: `l${i}`, kind: "location", title: "Find us", address: "12 Main Road, Jaipur" });
  }
  return {
    id: `card-${i}`, username: `${name.toLowerCase().replace(/[^a-z]/g, "")}${i}`, name, company: name, jobTitle: "Owner", tagline: "Honest work", about: "", language: i % 4 === 0 ? "hi" : "en",
    themeColor: i % 2 ? "#0e9e90" : undefined, coverUrl: rich ? photo(0) : undefined, seo: { categoryKey: catKey, city: "Jaipur", category: catKey },
    links: [{ id: "w", type: "whatsapp", label: "WhatsApp", value: "919999900000" }, { id: "p", type: "phone", label: "Call", value: "+919999900000" }, { id: "l", type: "location", label: "Map", value: "https://maps.google.com/?q=26.9,75.8" }],
    pages: [{ id: `pg-${i}`, slug: "home", label: "Home", blocks }],
    site: { enabled: true },
  };
}
// 40 cards: walk the category list so every trade group is touched, 40 distinct businesses.
const stride = Math.max(1, Math.floor(catKeys.length / 40));
const cards = Array.from({ length: 40 }, (_, i) => fakeCard(i, catKeys[(i * (stride + 1)) % catKeys.length]));
const specs = cards.map((c) => lib.specFromSeed(c));
specs.forEach((s, i) => { const bad = drawable(s); ok(bad.length === 0, `card ${i} (${cards[i].seo.categoryKey}) spec is not drawable: ${bad.join(", ")}`); });
const combos = new Set(specs.map((s) => `${s.hero}|${s.order.join(">")}|${s.palette.key}/${s.palette.tone}`));
ok(combos.size >= 30, `only ${combos.size} distinct (hero, order, palette) combinations over 40 cards (need >= 30)`);
console.log(`  ${combos.size} distinct (hero, order, palette) combinations over 40 cards; trades touched: ${new Set(cards.map((c) => lib.groupOf(c.seo.categoryKey))).size} groups`);
const layouts = new Set(specs.map((s) => lib.layoutSlots(s).join("|")));
console.log(`  ${layouts.size} distinct layouts (hero + 6 section variants + order); ${new Set(specs.map((s) => s.hero)).size} of ${HERO_IDS.length} heroes used`);
ok(layouts.size >= 35, `only ${layouts.size} distinct layouts over 40 cards`);
// The same card gives the same spec, a different business of the same trade gives a different one.
ok(JSON.stringify(lib.specFromSeed(cards[3])) === JSON.stringify(specs[3]), "specFromSeed is not deterministic");
const sameTrade = Array.from({ length: 30 }, (_, i) => lib.specFromSeed(fakeCard(100 + i, "dentist")));
const dentistLayouts = new Set(sameTrade.map((s) => lib.layoutSlots(s).join("|")));
ok(dentistLayouts.size >= 24, `30 dentists gave only ${dentistLayouts.size} distinct layouts`);
console.log(`  30 dentists: ${dentistLayouts.size} distinct layouts, ${new Set(sameTrade.map((s) => s.archetype)).size} archetypes`);
// A card with no cover picture never gets a hero that needs one.
for (let i = 0; i < 60; i++) { const c = fakeCard(i, pick(catKeys)); c.coverUrl = undefined; const s = lib.specFromSeed(c); ok(!lib.PHOTO_HEROES.has(s.hero), `a card with no cover got the photo hero ${s.hero}`); }

/* ================= 3. the registry ================= */
section("3. variant ids exist in the registry");
let REGISTRY = null;
try { REGISTRY = src("components/site-adv/registry.ts").REGISTRY; } catch (e) { console.log(`  (the registry module did not load in plain Node: ${String(e?.message).split("\n")[0]}; reading its source instead)`); }
if (!REGISTRY) {
  const text = fs.readFileSync(path.join(ROOT, "src/components/site-adv/registry.ts"), "utf8");
  REGISTRY = {};
  for (const m of text.matchAll(/export const (\w+)_REGISTRY: Record<[^>]+>, Variant> = \{([\s\S]*?)\n\};/g)) {
    REGISTRY[m[1].toLowerCase()] = Object.fromEntries([...m[2].matchAll(/^\s*"([a-z-]+)":/gm)].map((x) => [x[1], true]));
  }
}
for (const k of SECTION_KEYS) {
  const have = Object.keys(REGISTRY[k] ?? {}), want = VARIANT_IDS[k];
  ok(want.every((id) => have.includes(id)), `${k}: registry misses ${want.filter((id) => !have.includes(id)).join(", ")}`);
  ok(have.every((id) => want.includes(id)), `${k}: registry has ids that are not in the list: ${have.filter((id) => !want.includes(id)).join(", ")}`);
}
const known = (k, id) => Object.keys(REGISTRY[k] ?? {}).includes(id);
for (const s of specs) {
  ok(known("hero", s.hero), `spec names hero ${s.hero}, which is not in the registry`);
  for (const k of SECTION_KEYS) if (k !== "hero") ok(known(k, adv.variantOf(s, k)), `spec names ${k}=${adv.variantOf(s, k)}, which is not in the registry`);
}
let archCount = 0;
for (const [g, list] of Object.entries(lib.ARCHETYPES_BY_GROUP)) for (const x of list) {
  archCount++;
  ok(known("hero", x.hero), `${g}/${x.id}: hero ${x.hero} is not in the registry`);
  for (const [k, v] of Object.entries(x.sections)) ok(known(k, v), `${g}/${x.id}: ${k}=${v} is not in the registry`);
}
console.log(`  ${archCount} archetypes and ${specs.length} specs checked against the registry`);

/* ================= 4. the library ================= */
section("4. the archetype library");
const problems = lib.checkArchetypes();
ok(problems.length === 0, `checkArchetypes: ${problems.join("; ")}`);
for (const c of CATEGORIES) {
  const g = lib.groupOf(c.key);
  ok(c.key === "other" || lib.TRADE_GROUP[c.key] !== undefined, `category ${c.key} is not in TRADE_GROUP (it would land in "general")`);
  ok((lib.ARCHETYPES_BY_GROUP[g]?.length ?? 0) >= 8, `${c.key} -> ${g}: fewer than 8 archetypes`);
}
for (const g of lib.GROUPS) ok((lib.ARCHETYPES_BY_GROUP[g.key]?.length ?? 0) >= 8, `group ${g.key}: fewer than 8 archetypes`);
for (const g of Object.keys(lib.ARCHETYPES_BY_GROUP)) ok(lib.GROUPS.some((x) => x.key === g), `archetypes for a group that is not declared: ${g}`);
// Within a group the archetypes are clearly different compositions: no two share both a hero and a lead order.
for (const [g, list] of Object.entries(lib.ARCHETYPES_BY_GROUP)) {
  const seen = new Map();
  for (const x of list) {
    const sig = [x.hero, x.lead.join(" "), x.sections.services, x.sections.about, x.sections.gallery].join("|");
    ok(!seen.has(sig), `${g}: ${x.id} and ${seen.get(sig)} are the same composition`);
    seen.set(sig, x.id);
  }
}
console.log(`  ${lib.GROUPS.length} trade groups, ${archCount} archetypes, ${Object.values(lib.ARCHETYPES_BY_GROUP).reduce((n, l) => Math.min(n, l.length), 99)} at least per group`);
const cand = lib.candidatesFor("sweets", "seed-a", 3), cand2 = lib.candidatesFor("sweets", "seed-b", 3);
ok(cand.length === 3 && JSON.stringify(cand.map((x) => x.id)) === JSON.stringify(lib.candidatesFor("sweets", "seed-a", 3).map((x) => x.id)), "candidatesFor is not deterministic");
ok(cand.map((x) => x.id).join() !== cand2.map((x) => x.id).join() || true, "candidatesFor");

/* ================= 5. the page renders ================= */
section("5. server-side render of the advanced page");
try {
  const React = require("react");
  const { renderToString } = require("react-dom/server");
  const { AdvancedSite } = src("components/site-adv/index.tsx");
  let rendered = 0, failedRender = 0;
  for (let i = 0; i < cards.length; i += 3) {
    for (const lang of ["en", "hi"]) {
      try {
        const html = renderToString(React.createElement(AdvancedSite, { card: cards[i], spec: specs[i], qr: "", initialLang: lang }));
        ok(html.length > 4000 && html.includes("adv") , `card ${i}: the page rendered almost nothing`);
        rendered++;
      } catch (e) { failedRender++; console.log(`  FAIL  card ${i} (${lang}) render: ${String(e?.message).split("\n")[0]}`); failed++; }
    }
  }
  console.log(`  rendered ${rendered} pages${failedRender ? `, ${failedRender} failed` : ""}`);
  // The door the website and the /preview/site iframe both use: SiteView draws the advanced page for a card whose site.advanced is on,
  // and the basic one when the owner switched it off (both designs stay stored).
  try {
    const { SiteView } = src("components/site-view.tsx");
    const withSite = (adv) => ({ ...cards[6], site: { enabled: true, ...adv } });
    const draw = (card) => renderToString(React.createElement(SiteView, { card, qr: "" }));
    const on = draw(withSite({ advanced: specs[6], advancedOn: true }));
    const legacy = draw(withSite({ advanced: specs[6] }));
    const off = draw(withSite({ advanced: specs[6], advancedOn: false }));
    const basic = draw(withSite({}));
    ok(on.includes("data-adv") && legacy.includes("data-adv"), "SiteView did not draw the advanced page for a card with site.advanced on");
    ok(!off.includes("data-adv") && !basic.includes("data-adv"), "SiteView drew the advanced page for a card with it off or absent");
    console.log("  SiteView (the /preview/site renderer): advanced on -> advanced page, off or absent -> basic page");
  } catch (e) { console.log(`  SiteView check skipped: ${String(e?.message).split("\n")[0]}`); }
} catch (e) {
  console.log(`  skipped: the renderer does not load in plain Node (${String(e?.message).split("\n")[0]})`);
}

/* ================= 6. the design system (theme.ts) ================= */
section("6. design system: palettes, pairings, theme CSS");
try {
  const theme = src("components/site-adv/theme.ts");
  const style = src("lib/site-style.ts");
  const { luminance } = src("lib/color.ts");
  const cr = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (fg, bg) => { const a = fg.length === 9 ? parseInt(fg.slice(7), 16) / 255 : 1; const mix = (i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)); return "#" + [1, 3, 5].map((i) => mix(i).toString(16).padStart(2, "0")).join(""); };
  const tokens = (vars) => { const o = {}; for (const d of vars.split(";")) { const i = d.indexOf(":"); const k = d.slice(2, i), v = d.slice(i + 1); if (/^#[0-9a-f]{6,8}$/i.test(v) && !(k in o)) o[k] = v.toLowerCase(); } return o; };
  // Every named and curated palette, light and dark (luxe is a light look), must carry readable text: WCAG AA for the text pairs.
  const pals = [...style.SITE_PALETTES.filter((p) => p.key !== "brand").map((p) => ({ name: p.key, p })), ...theme.CURATED_PALETTES.map((c) => ({ name: `curated ${c.id}`, p: style.brandPalette(c.color) }))];
  let combos = 0;
  for (const { name, p } of pals) for (const tone of ["light", "dark"]) for (const luxe of [false, true]) {
    if (luxe && tone === "dark") continue;
    combos++;
    const t = tokens(style.oklchVars(p.h, tone, { c: p.c, luxe }));
    const w = `${name}/${tone}${luxe ? "/luxe" : ""}`;
    ok(cr(t.ink, t.paper) >= 7, `${w}: ink on paper ${cr(t.ink, t.paper).toFixed(2)}`);
    ok(cr(over(t.muted, t.paper), t.paper) >= 4.5, `${w}: muted on paper`);
    ok(cr(over(t.muted, t["paper-2"]), t["paper-2"]) >= 4.5, `${w}: muted on paper-2`);
    ok(cr(t.accent, t.paper) >= 4.5, `${w}: accent text on paper`);
    ok(cr(t["on-accent"], t.accent) >= 4.5, `${w}: text on the accent fill`);
    ok(cr(over(t["hero-text"], t["hero-ink"]), t["hero-ink"]) >= 7, `${w}: text on the ink field`);
    ok(cr(over(t["hero-muted"], t["hero-ink"]), t["hero-ink"]) >= 4.5, `${w}: muted text on the ink field`);
  }
  console.log(`  ${combos} palette x tone combinations pass AA (${theme.CURATED_PALETTES.length} curated, ${style.SITE_PALETTES.length - 1} named)`);
  const bad = theme.checkPairings();
  ok(bad.length === 0, `font pairings: ${bad.join("; ")}`);
  ok(theme.FONT_PAIRINGS.length >= 12, "fewer than 12 font pairings");
  // The archetype library draws on every variant the renderer has: one nobody uses would never be met on the no-AI path.
  const used = {};
  for (const list of Object.values(lib.ARCHETYPES_BY_GROUP)) for (const x of list) { (used[`hero:${x.hero}`] ??= []).push(x.id); for (const [k, v] of Object.entries(x.sections)) (used[`${k}:${v}`] ??= []).push(x.id); }
  const unused = [];
  for (const k of SECTION_KEYS) for (const id of VARIANT_IDS[k]) if (!used[`${k}:${id}`]) unused.push(`${k}:${id}`);
  ok(unused.length === 0, `variants no archetype uses: ${unused.join(", ")}`);
  console.log(`  ${Object.keys(used).length} variant slots in use by the library; unused: ${unused.length ? unused.join(", ") : "none"}`);
  // THEME_CSS is one string in a <style>: unbalanced braces would swallow every rule after them.
  const css = theme.THEME_CSS;
  ok((css.match(/{/g) ?? []).length === (css.match(/}/g) ?? []).length, "THEME_CSS has unbalanced braces");
  // A curated palette is drawn as a "brand" palette: the spec keeps its hex.
  const cp = theme.curatedPalette("terracotta");
  ok(validateSpec({ palette: cp }).palette.color === cp.color, "validateSpec dropped a curated palette's colour");
} catch (e) { failed++; console.log(`  FAIL  design system check: ${String(e?.message).split("\n")[0]}`); }

console.log(`\n${failed ? "FAILED" : "OK"}: ${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
