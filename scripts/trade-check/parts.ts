// `PARTS_CAT=<key>` or all: composes the card of every combined trade (lib/trade-parts.ts) with each single part ticked and with all
// ticked, with the AI's copy EMPTY, and prints the label, the tick list and which of the OTHER parts' words leaked into the card.
import { composeCard, type ComposeInput } from "@/lib/card-compose";
import { auditCard } from "@/lib/card-audit";
import { tradeDataFor } from "@/lib/site-recipes";
import { tradeLabelOf } from "@/lib/card-inputs";
import { tradeQuestionsFor, tradeOwnQuestions } from "@/lib/trade-questions";
import { TRADE_PARTS, PART_TICKS } from "@/lib/trade-parts";
import { SEEDS_ALL } from "@/lib/trade-data/parts-all";
import { EMPTY_FACTS, type SetupInfo } from "@/lib/card-facts";
import type { CardCopy } from "@/lib/card-ai";

const emptyCopy = (): CardCopy => ({ jobTitle: "", tagline: "", about: "", color: "", highlights: [], services: [], offer: null, hours: [], faq: [], contactNote: "", promise: [], steps: [], more: "" }) as unknown as CardCopy;
const only = process.env.PARTS_CAT;
let bad = 0;
for (const [cat, parts] of Object.entries(TRADE_PARTS)) {
  if (only && only !== cat) continue;
  // 1. every tick named in PART_TICKS must be a real chip of the category
  const chips = new Set(tradeOwnQuestions(cat).flatMap((q) => (q.options ?? []).map((o) => o.en)));
  for (const [pk, ticks] of Object.entries(PART_TICKS[cat] ?? {})) for (const t of ticks) if (!chips.has(t)) { bad++; console.log(`!! ${cat}/${pk}: tick "${t}" is not a chip of the category`); }
  const cases: [string, string[] | undefined][] = [...parts.map((p): [string, string[]] => [p.key, [p.en]]), ["ALL", undefined]];
  for (const [name, picked] of cases) {
    const tradeAnswers: Record<string, string[]> = picked ? { parts: picked } : {};
    const setup = { kind: "business", role: "business", reach: "local", business: "Test Co", person: "Ramesh", category: cat, categoryLabel: tradeLabelOf({ category: cat, categoryLabel: "" }, tradeAnswers), persona: "business", city: "Rewari", address: "Main market", website: "", gstin: "", about: "", map: "", logo: "", photo: "", phone: "9876543210" } as unknown as SetupInfo;
    for (const lang of ["en", "hi"] as const) {
      const input = { setup, facts: { ...EMPTY_FACTS, lang, tradeAnswers }, products: [], brandProducts: false, reviews: [], copy: emptyCopy(), info: new Map(), siteUrl: null } as unknown as ComposeInput;
      const trade = tradeDataFor(cat, tradeAnswers);
      const card = auditCard(composeCard(input).card, { stockPhotos: [], city: "Rewari", trade, lang }).card;
      const strs: string[] = []; const walk = (v: unknown) => { if (typeof v === "string") strs.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v as object).forEach(walk); };
      walk(card); const text = strs.join(" | ").toLowerCase();
      const seed = picked ? SEEDS_ALL[`${cat}:${parts.find((p) => p.en === picked[0])!.key}`] : undefined;
      const own = seed ? [...seed.explain, ...seed.services.flatMap((x) => [x.en, x.desc])].join(" ").toLowerCase() : "";
      const leaks = (seed?.avoid ?? []).filter((w) => !cat.includes(w.toLowerCase().trim()) && !own.includes(w.toLowerCase().trim()) && new RegExp(`\\b${w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text));
      if (lang === "en" && process.env.SHOW) for (const w of leaks) { const i = text.indexOf(w.toLowerCase()); console.log(`     "${w}" in: …${text.slice(Math.max(0, i - 70), i + 60).replace(/\s+/g, " ")}…`); }
      const nServ = (trade?.services ?? []).length;
      if (lang === "en") console.log(`${cat.padEnd(12)} ${name.padEnd(12)} label="${setup.categoryLabel}" services=${nServ} faq=${trade?.faq.length} whyUs=${trade?.whyUs.length} steps=${trade?.steps.length}${leaks.length ? `  LEAK: ${leaks.join(", ")}` : ""}`);
      if (leaks.length || nServ < 4) { bad++; if (lang === "hi") console.log(`   (${lang}) ${cat}/${name} ${leaks.length ? "leak " + leaks.join(",") : ""} ${nServ < 4 ? "few services" : ""}`); }
    }
  }
  void tradeQuestionsFor;
}
console.log(`\n${bad ? bad + " problem(s)" : "no problems"}`);
