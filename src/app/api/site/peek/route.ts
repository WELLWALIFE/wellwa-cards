// POST (bearer) { url, role: "own" | "dealer" } → what the website says about itself, for the set-up's website
// step (owner's call, 1 Oct 2026: the person should type as little as possible — a site they already have
// fills the business screen for them).
//
//   own    → { ok, url, name, logo, about, city, address, phone, products, category }
//   dealer → { ok, url, name, products }             (the brand's name and how many products — nothing else)
//   cannot be opened / opened but empty → { ok: false, reason: "unreadable" | "empty" }
//
// One home-page read, bounded (the full import of pictures and products happens later, in the build, where
// there is time for it). Never returns the site's pictures or products: for an OWN site the logo alone is
// copied into the owner's bucket, so it passes the "own media" rule when the form saves it.
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api-security";
import { userFromRequest } from "@/lib/poster-server";
import { copyLogo, peekSite } from "@/lib/site-import";
import { matchCategory } from "@/lib/category-match";
import { categoryOf, CATEGORIES } from "@/lib/poster-categories";
import { geminiComplete } from "@/lib/gemini";
import { cleanSiteUrl, isShubhoraHost, looksLikeSite, socialDetour } from "@/lib/site-role";

// A JavaScript-built site needs one headless render (20 s) on top of the fetch; the client gives up at 45 s.
export const maxDuration = 60;

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);

/** The trade the site most likely belongs to: a confident keyword match, else one short AI pick, else "". */
async function guessCategory(text: string): Promise<string> {
  const byWords = matchCategory(text);
  if (byWords) return byWords;
  const key = process.env.GEMINI_API_KEY;
  if (!key || text.trim().length < 20) return "";
  try {
    const keys = CATEGORIES.filter((c) => c.key !== "other" && c.key !== "personal").map((c) => `${c.key} (${c.en})`).join(", ");
    const r = await within(geminiComplete({
      apiKey: key, maxOutputTokens: 12, temperature: 0,
      system: `You classify an Indian business from its website text into exactly one key. Answer with the key only, nothing else. Keys: ${keys}. If none fits, answer: none`,
      contents: [{ role: "user", parts: [{ text: text.slice(0, 1500) }] }],
    }), 8_000);
    const k = (r?.text ?? "").trim().toLowerCase().replace(/[^a-z-]/g, "");
    return categoryOf(k) ? k : "";
  } catch { return ""; }
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  // Each peek can cost a browser render; a form that loops on a bad link gets a plain message, not a queue.
  if (rateLimited(`site-peek:${me.id}`, 10, 10 * 60_000)) return NextResponse.json({ ok: false, reason: "unreadable", error: "Too many tries. Please wait a few minutes." }, { status: 429 });

  const b = (await request.json().catch(() => ({}))) as { url?: unknown; role?: unknown };
  const url = cleanSiteUrl(typeof b.url === "string" ? b.url : "");
  const role = b.role === "dealer" ? "dealer" : "own";
  if (!url || !looksLikeSite(url) || socialDetour(url) || isShubhoraHost(url)) {
    return NextResponse.json({ ok: false, reason: "unreadable" }, { status: 400 });
  }

  const peek = await within(peekSite(url).catch(() => null), 40_000);
  if (!peek) return NextResponse.json({ ok: false, reason: "unreadable" }, { headers: { "Cache-Control": "no-store" } });
  if (peek.empty && !peek.name && !peek.about) return NextResponse.json({ ok: false, reason: "empty" }, { headers: { "Cache-Control": "no-store" } });

  if (role === "dealer") {
    // The brand's name and how many of its products there are to import. Its logo, address and phone are the
    // brand's, not the dealer's, and never reach the dealer's form.
    return NextResponse.json({ ok: true, url: peek.url, name: peek.name, products: peek.products }, { headers: { "Cache-Control": "no-store" } });
  }

  const [logo, category] = await Promise.all([
    peek.logos.length ? within(copyLogo(me.id, peek.logos).catch(() => null), 20_000) : Promise.resolve(null),
    guessCategory(`${peek.name} ${peek.title} ${peek.about}`),
  ]);
  return NextResponse.json({
    ok: true,
    url: peek.url,
    name: peek.name,
    logo: logo?.url ?? "",
    about: peek.about,
    city: peek.address.city,
    address: peek.address.full,
    phone: peek.phone.replace(/\D/g, "").slice(-10),
    products: peek.products,
    category,
    empty: peek.empty,
  }, { headers: { "Cache-Control": "no-store" } });
}
