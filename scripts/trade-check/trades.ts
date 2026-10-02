// Bulk check of every trade (`npm run check:trades`): each of the 78 categories, in English and Hindi, with and
// without products, composed and audited exactly as /api/card/build does — with the AI's copy left EMPTY, so the
// trade's own seeds (site-recipes.ts + trade-data/*) carry the whole card. No account, no server, no AI call.
// Prints what came out thin, generic or broken, and the home-page order each trade gets.
import { CATEGORIES } from "@/lib/poster-categories";
import { composeCard, type ComposeInput } from "@/lib/card-compose";
import { auditCard } from "@/lib/card-audit";
import { recipeFor, tradeDataFor, isGeneric } from "@/lib/site-recipes";
import { homeSections, isEmptyBlock } from "@/lib/site-home";
import { EMPTY_FACTS, type SetupInfo, type SavedProduct } from "@/lib/card-facts";
import { FONT_PAIRS, SITE_PALETTES } from "@/lib/site-style";
import type { CardCopy } from "@/lib/card-ai";
import type { Card, CardBlock } from "@/lib/types";

const emptyCopy = (): CardCopy => ({ jobTitle: "", tagline: "", about: "", color: "", highlights: [], services: [], offer: null, hours: [], faq: [], contactNote: "", promise: [], steps: [], more: "", titles: {}, cta: "", hero: { sub: "" }, productLines: {}, seoTitle: "", seoDescription: "" });
const products = (n: number): SavedProduct[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Item ${i + 1}`, brand: "", price: `${199 + i * 50}`, mrp: "", photo: `https://x.supabase.co/storage/v1/object/public/media/u/p${i}.jpg`, images: [], offer: "", benefits: ["Good quality", "Fair price"] }));

type Row = { key: string; lang: string; prods: number; problems: string[]; sections: string; style: string };
const rows: Row[] = [];
let crashes = 0;
for (const c of CATEGORIES) {
  const trade = tradeDataFor(c.key);
  const recipe = recipeFor(c.key);
  for (const lang of ["en", "hi"] as const) {
    for (const n of [0, 4]) {
      const problems: string[] = [];
      const persona = c.persona;
      const role: SetupInfo["role"] = persona === "professional" ? "professional" : persona === "personal" ? "personal" : "business";
      const setup: SetupInfo = { kind: role === "business" ? "business" : "person", role, reach: "local", business: `Test ${c.en}`, person: "Ramesh Kumar", category: c.key, categoryLabel: c.en, persona, city: "Rewari", address: "Main market", website: "", gstin: "", about: "", map: "", logo: "", photo: "", phone: "9876543210", email: "" };
      const input: ComposeInput = { setup, facts: { ...EMPTY_FACTS, lang, social: { ...EMPTY_FACTS.social } }, products: products(n), brandProducts: false, reviews: [], copy: emptyCopy(), info: new Map(), siteUrl: null };
      let sections = "", style = "";
      try {
        const { card } = composeCard(input);
        const audited = auditCard(card, { stockPhotos: [], city: setup.city, trade, lang });
        const out = audited.card;
        const all: CardBlock[] = out.pages.flatMap((p) => p.blocks);
        if (!out.pages.length) problems.push("no pages");
        const home = out.pages[0];
        if (!home || home.slug !== "home") problems.push("first page is not home");
        const hs = homeSections(out as unknown as Card, out.pages);
        sections = hs.map((s) => (s.kind === "block" ? s.block.kind : s.kind)).join(",");
        if (hs.length < 4) problems.push(`home has only ${hs.length} sections`);
        const kinds = (k: CardBlock["kind"]) => all.filter((b) => b.kind === k);
        const svc = kinds("services") as Extract<CardBlock, { kind: "services" }>[];
        const lists = svc.filter((b) => !/^\d+[.)]\s/.test(b.items[0]?.name ?? ""));
        const steps = svc.filter((b) => /^\d+[.)]\s/.test(b.items[0]?.name ?? ""));
        if (!lists.length && role !== "personal") problems.push("no services list");
        for (const b of lists) { if (b.items.length < (recipe.min?.services ?? 3)) problems.push(`services only ${b.items.length}`); for (const it of b.items) { if (isGeneric(it.name, trade)) problems.push(`generic service: ${it.name}`); if (!it.name.trim()) problems.push("empty service name"); } }
        if (!steps.length && recipe.home.includes("steps")) problems.push("no steps");
        for (const b of steps) if (b.items.length < 3) problems.push(`steps only ${b.items.length}`);
        const hl = kinds("highlights") as Extract<CardBlock, { kind: "highlights" }>[];
        const whyUs = hl.find((b) => b.items.length >= 3 && b.items.every((x) => x.startsWith("✅")));
        if (!whyUs && recipe.home.includes("whyUs")) problems.push("no why-us");
        for (const b of hl) for (const it of b.items) if (isGeneric(it.replace(/^✅\s*/, ""), trade)) problems.push(`generic why-us: ${it}`);
        const faq = kinds("faq") as Extract<CardBlock, { kind: "faq" }>[];
        if (!faq.length) problems.push("no faq"); else for (const b of faq) { if (b.items.length < 3) problems.push(`faq only ${b.items.length}`); for (const f of b.items) if (!f.q.trim() || !f.a.trim()) problems.push("empty faq"); }
        for (const b of all) if (isEmptyBlock(b)) problems.push(`empty block ${b.kind}`);
        for (const b of all) if ("title" in b && typeof b.title === "string" && !b.title.trim() && b.kind !== "cta") problems.push(`untitled ${b.kind}`);
        // A Hindi card must not carry English seed lines.
        if (lang === "hi") { for (const b of [...lists, ...steps]) for (const it of b.items) if (/^[A-Za-z][A-Za-z ,'&()./-]{6,}$/.test(it.name.trim())) problems.push(`english in hindi card: ${it.name}`); }
        if (n === 4 && recipe.catalog === "products" && !kinds("product").length) problems.push("products given but no product block");
        if (n === 0 && kinds("product").length) problems.push("product block with no products");
        const st = out.site?.style ?? {};
        style = `${st.font ?? "-"}/${st.palette ?? "-"}/${st.radius ?? "-"}/${st.hero ?? "-"}`;
        if (st.font && !FONT_PAIRS.some((f) => f.key === st.font)) problems.push(`unknown font ${st.font}`);
        if (st.palette && !SITE_PALETTES.some((p) => p.key === st.palette)) problems.push(`unknown palette ${st.palette}`);
        if (!out.site?.enabled) problems.push("website not enabled");
        if (!out.seo?.categoryKey) problems.push("no seo.categoryKey");
      } catch (e) { crashes++; problems.push(`CRASH: ${(e as Error).message?.slice(0, 120)}`); }
      rows.push({ key: c.key, lang, prods: n, problems: [...new Set(problems)], sections, style });
    }
  }
}
const bad = rows.filter((r) => r.problems.length);
console.log(`trades: ${CATEGORIES.length}  runs: ${rows.length}  clean: ${rows.length - bad.length}  with problems: ${bad.length}  crashes: ${crashes}\n`);
const byProblem = new Map<string, string[]>();
for (const r of bad) for (const p of r.problems) { const k = p.replace(/: .*$/, ""); byProblem.set(k, [...(byProblem.get(k) ?? []), `${r.key}/${r.lang}/${r.prods}`]); }
for (const [k, v] of [...byProblem].sort((a, b) => b[1].length - a[1].length)) console.log(`${String(v.length).padStart(4)}  ${k}   e.g. ${v.slice(0, 6).join(" ")}`);
console.log("\n--- details (first 40) ---");
for (const r of bad.slice(0, 40)) console.log(`${r.key}/${r.lang}/${r.prods}: ${r.problems.join(" | ")}`);
console.log("\n--- home section order per trade (en, with products) ---");
for (const r of rows.filter((r) => r.lang === "en" && r.prods === 4)) console.log(`${r.key.padEnd(16)} ${r.style.padEnd(28)} ${r.sections}`);
process.exitCode = crashes ? 1 : 0;
