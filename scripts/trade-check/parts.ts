// `node scripts/trade-check/run.cjs parts` style check for the parts of a combined trade (lib/trade-parts.ts): composes the
// "Pest control / cleaning" card with only Cleaning, only Pest control, and both ticked, with the AI's copy EMPTY, and prints the label,
// the tick list and whether the other part's words leak into the card.
import { composeCard, type ComposeInput } from "@/lib/card-compose";
import { auditCard } from "@/lib/card-audit";
import { tradeDataFor } from "@/lib/site-recipes";
import { tradeLabelOf } from "@/lib/card-inputs";
import { tradeQuestionsFor } from "@/lib/trade-questions";
import { EMPTY_FACTS, type SetupInfo } from "@/lib/card-facts";
import type { CardCopy } from "@/lib/card-ai";

const emptyCopy = (): CardCopy => ({ jobTitle: "", tagline: "", about: "", color: "", highlights: [], services: [], offer: null, hours: [], faq: [], contactNote: "", promise: [], steps: [], more: "" }) as unknown as CardCopy;
const base = { ...EMPTY_FACTS };
const CAT = process.env.PARTS_CAT ?? "cleaning";
const cases: [string, string[] | undefined][] = CAT === "cleanprod" ? [["only makers", ["We make them"]], ["only suppliers", ["We sell / supply them"]], ["both", undefined]] : [["only Cleaning", ["Cleaning"]], ["only Pest control", ["Pest control"]], ["both ticked", ["Pest control", "Cleaning"]], ["nothing ticked (old cards)", undefined]];
for (const [name, parts] of cases) {
  const tradeAnswers: Record<string, string[]> = parts ? { parts } : {};
  const setup = { kind: "business", role: "business", reach: "local", business: "Test Cleaners", person: "Ramesh", category: CAT, categoryLabel: tradeLabelOf({ category: CAT, categoryLabel: "" }, tradeAnswers), persona: "business", city: "Rewari", address: "Main market", website: "", gstin: "", about: "", map: "", logo: "", photo: "", phone: "9876543210" } as unknown as SetupInfo;
  const input = { setup, facts: { ...base, lang: "en" as const, tradeAnswers }, products: [], brandProducts: false, reviews: [], copy: emptyCopy(), info: new Map(), siteUrl: null } as unknown as ComposeInput;
  const trade = tradeDataFor(CAT, tradeAnswers);
  const card = auditCard(composeCard(input).card, { stockPhotos: [], city: "Rewari", trade, lang: "en" }).card;
  const text = JSON.stringify(card).toLowerCase();
  const ticks = tradeQuestionsFor(CAT, tradeAnswers).map((q) => `${q.key}: ${(q.options ?? []).map((o) => o.en).join(" | ")}`);
  console.log(`\n== ${name}\n  label: ${setup.categoryLabel}\n  services: ${(trade?.services ?? []).map((s) => s.en).join(" | ")}`);
  console.log(`  questions:\n    ${ticks.join("\n    ")}`);
  console.log(`  leaks → pest words: ${/termite|cockroach|pest/.test(text)}  cleaning words: ${/sofa|carpet|deep clean|water tank/.test(text)}`);
}
