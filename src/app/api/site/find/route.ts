// POST (bearer) { q } → { ok, url, name } — the official website of a brand or company typed by NAME
// (owner's call, 2 Oct 2026: "maruti car" should be enough; the system finds marutisuzuki.com itself).
// One grounded AI lookup; a social page, a marketplace listing or our own site is never the answer.
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api-security";
import { userFromRequest } from "@/lib/poster-server";
import { geminiComplete } from "@/lib/gemini";
import { cleanSiteUrl, isShubhoraHost, looksLikeSite, socialDetour } from "@/lib/site-role";

const NOT_A_BRAND_SITE = /(amazon|flipkart|indiamart|justdial|wikipedia|facebook|instagram|youtube|linkedin|twitter|x\.com|google\.|tradeindia|sulekha)/i;

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`site-find:${me.id}`, 20, 10 * 60_000)) return NextResponse.json({ ok: false, error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  const b = (await request.json().catch(() => ({}))) as { q?: unknown };
  const q = String(b.q ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ ok: false }, { status: 400 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: "off" });
  try {
    const r = await geminiComplete({
      apiKey: key, webSearch: true, maxOutputTokens: 80, temperature: 0,
      system: "You find the OFFICIAL website of a brand or company (India first). Answer on one line as: <url> | <brand name>. The url must be the company's own site (not a marketplace, directory, Wikipedia or social page). If you are not sure which company is meant, or it has no site, answer: none",
      contents: [{ role: "user", parts: [{ text: q }] }],
    });
    const line = (r.text ?? "").split("\n").map((x) => x.trim()).filter(Boolean)[0] ?? "";
    if (!line || /^none$/i.test(line)) return NextResponse.json({ ok: false, reason: "none" });
    const [rawUrl, rawName = ""] = line.split("|").map((x) => x.trim());
    const url = cleanSiteUrl(rawUrl.replace(/[`*"'<>]/g, ""));
    if (!url || !looksLikeSite(url) || socialDetour(url) || isShubhoraHost(url) || NOT_A_BRAND_SITE.test(url)) return NextResponse.json({ ok: false, reason: "none" });
    return NextResponse.json({ ok: true, url, name: rawName.replace(/[`*"']/g, "").slice(0, 80) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, reason: "none" });
  }
}
