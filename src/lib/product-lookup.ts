import "server-only";
// Product details from the web: for products where the owner gave the brand, one Google-grounded AI call looks up
// the maker's public description — key features and main specs. Never prices (they change and differ by seller),
// never health or income claims. Best effort: on any failure the card is made from the owner's words alone.
import { geminiComplete } from "@/lib/gemini";

export type ProductInfo = { summary: string; features: string[]; specs: { label: string; value: string }[] };

/** False for text with a price, a discount or a health / medical / income claim. Web-found maker details and
 *  brand-supplied benefits must pass it before they reach a card. */
export const noClaims = (s: string) =>
  !/₹|rs\.?\s?\d|\$\d|price|discount|cure|disease|treat|heal|guarantee|income|health|immun|antioxid|detox|weight loss|diabet|blood pressure|cancer|kidney|therap|clinically|medical|doctor recommended/i.test(s);

export async function lookupProducts(items: { name: string; brand: string }[]): Promise<Map<string, ProductInfo>> {
  const out = new Map<string, ProductInfo>();
  const key = process.env.GEMINI_API_KEY;
  const list = items.filter((i) => i.name && i.brand).slice(0, 6);
  if (!key || !list.length) return out;
  const prompt = `Search the web for the official public details of these products (use the manufacturer's site or reliable retailers):
${list.map((p, i) => `${i + 1}. Brand: ${p.brand} — Product: ${p.name}`).join("\n")}

For each product return what the maker says: a one-line summary, 3-5 key features (short), and up to 6 main specifications (label + value).
Rules: NO prices, NO discounts, NO health, medical or income claims, nothing you could not find — if a product is not found, return empty fields for it.
Return ONLY this JSON, no other text:
[{"n":1,"summary":"","features":[""],"specs":[{"label":"","value":""}]}]`;
  try {
    const r = await Promise.race([
      geminiComplete({ apiKey: key, webSearch: true, maxOutputTokens: 2000, contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      new Promise<null>((res) => setTimeout(() => res(null), 35_000)),
    ]);
    if (!r || r.blocked || !r.text) return out;
    const json = r.text.slice(r.text.indexOf("["), r.text.lastIndexOf("]") + 1);
    const rows = JSON.parse(json) as { n: number; summary?: string; features?: string[]; specs?: { label?: string; value?: string }[] }[];
    for (const row of rows) {
      const p = list[row.n - 1];
      if (!p) continue;
      const features = (row.features ?? []).map((f) => String(f).trim().slice(0, 90)).filter((f) => f && noClaims(f)).slice(0, 5);
      const specs = (row.specs ?? []).map((x) => ({ label: String(x.label ?? "").trim().slice(0, 40), value: String(x.value ?? "").trim().slice(0, 60) }))
        .filter((x) => x.label && x.value && noClaims(`${x.label} ${x.value}`)).slice(0, 6);
      const summary = noClaims(row.summary ?? "") ? String(row.summary ?? "").trim().slice(0, 200) : "";
      if (summary || features.length || specs.length) out.set(`${p.brand}|${p.name}`.toLowerCase(), { summary, features, specs });
    }
  } catch { /* best effort */ }
  return out;
}
