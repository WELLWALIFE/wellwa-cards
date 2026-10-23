import "server-only";
// Three big lines for the Premium website's sliding top banners (site.hero.slides; owner, 23 Oct 2026), written from the card's own
// facts. Used by the editor's "Write with AI" (/api/site/slides) and by every Premium design run, so a new design comes with its
// three banners already made (each with a picture from the card).
import { geminiComplete } from "@/lib/gemini";
import type { Card, HeroSlide } from "@/lib/types";

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** The card's pictures that suit a wide banner: the website banner, the card cover, then the gallery. */
export function slidePhotos(c: Card): string[] {
  const gallery = c.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).flatMap((b) => (b.kind === "gallery" ? b.images.map((g) => g.url) : []));
  return [...new Set([c.site?.hero?.imageUrl, c.coverUrl, ...gallery].filter((u): u is string => !!u && /^https:\/\//.test(u)))];
}

/** Three banners (headline + sub), or null when the AI is not available or says nothing usable. With `withPhotos` each gets a picture. */
export async function writeSlides(c: Card, withPhotos = false): Promise<HeroSlide[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const items = c.pages.flatMap((p) => p.blocks).flatMap((bl) => (bl.kind === "product" ? bl.items.map((i) => i.name) : [])).filter(Boolean).slice(0, 12);
  const hindi = c.language === "hi";
  const facts = [
    `Business: ${c.company || c.name}`, `What they do: ${c.jobTitle}`, c.seo?.city ? `City: ${c.seo.city}` : "",
    c.tagline ? `Tagline: ${c.tagline}` : "", c.about ? `About: ${c.about.slice(0, 700)}` : "", items.length ? `Products / services: ${items.join(", ")}` : "",
    c.site?.hero?.headline ? `Present big line (do not repeat it): ${c.site.hero.headline}` : "",
  ].filter(Boolean).join("\n");
  try {
    const out = await geminiComplete({
      apiKey: key, json: true, maxOutputTokens: 600, temperature: 0.8, tag: "site-slides",
      system: "You write website banner headlines for Indian small businesses. Plain, confident, true to the facts; no hype, no prices, no claims that are not in the facts.",
      contents: [{ role: "user", parts: [{ text: `${facts}\n\nWrite 3 website top banners, each about a DIFFERENT reason to choose this business (for example: the main offer, why trust them, how easy it is to start). Language: ${hindi ? "simple Hindi (Devanagari)" : "simple English"}.\nEach: "headline" at most 6 words; "sub" one sentence, at most 90 characters.\nReturn JSON: {"slides":[{"headline":"...","sub":"..."},{"headline":"...","sub":"..."},{"headline":"...","sub":"..."}]}` }] }],
    });
    const parsed = JSON.parse(out.text.replace(/^```(?:json)?|```$/g, "").trim()) as { slides?: { headline?: unknown; sub?: unknown }[] };
    const photos = withPhotos ? slidePhotos(c) : [];
    const slides = (parsed.slides ?? []).map((s) => ({ headline: clip(s.headline, 90), sub: clip(s.sub, 240) })).filter((s) => s.headline).slice(0, 3)
      .map((s, i) => (photos.length ? { ...s, imageUrl: photos[i % photos.length] } : s));
    return slides.length >= 2 ? slides : null;
  } catch { return null; }
}
