import "server-only";
// Reads a public website the user gives as a reference, so the AI can follow its structure and tone.
// Only public http(s) pages: private, local and internal addresses are refused (so this can never be used to
// reach our own server), redirects are re-checked, and only the first 1.5 MB of HTML is read.
import { lookup } from "node:dns/promises";
import net from "node:net";
import type { ReferenceStyle } from "@/lib/site-style";
import { htmlOf } from "@/lib/render-page";

function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`); } catch { return null; }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return null;
  if (u.port && !["80", "443"].includes(u.port)) return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return null;
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  } catch { return null; }
  return u;
}

/** One public URL (same safety rules as the pages: no private or local addresses, redirects re-checked), at most
 *  maxBytes. `want` checks the content type: html pages, json catalogs or images. Null on any failure. */
export async function fetchPublic(raw: string, want: "html" | "json" | "image", maxBytes = 1_500_000, timeoutMs = 10_000): Promise<{ url: string; type: string; body: Buffer } | null> {
  let u: URL | null = await safeUrl(raw);
  const accept = want === "html" ? "text/html" : want === "json" ? "application/json" : "image/*";
  for (let hop = 0; hop < 4 && u; hop++) {
    const r: Response | null = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "Mozilla/5.0 (compatible; ShubhoraBot/1.0; +https://shubhora.com)", accept } }).catch(() => null);
    if (!r) return null;
    if (r.status >= 300 && r.status < 400) { const loc: string | null = r.headers.get("location"); u = loc ? await safeUrl(new URL(loc, u).toString()) : null; continue; }
    const type = (r.headers.get("content-type") ?? "").toLowerCase();
    const ok = want === "html" ? type.includes("html") : want === "json" ? type.includes("json") : type.startsWith("image/");
    if (!r.ok || !ok) { r.body?.cancel().catch(() => undefined); return null; }
    const len = Number(r.headers.get("content-length") ?? 0);
    if (len && len > maxBytes && want !== "html") { r.body?.cancel().catch(() => undefined); return null; }
    const reader = r.body?.getReader(); if (!reader) return null;
    const chunks: Uint8Array[] = []; let size = 0;
    while (size < maxBytes) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; }
    const cut = size >= maxBytes;
    reader.cancel().catch(() => undefined);
    if (cut && want !== "html") return null; // a half image or half JSON is useless
    return { url: u.toString(), type, body: Buffer.concat(chunks) };
  }
  return null;
}

const clean = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

export type Reference = { url: string; summary: string; themeColor?: string; style?: ReferenceStyle };

const GENERIC_FONT = /^(?:inherit|initial|unset|sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|cursive|fantasy|emoji|math|arial|helvetica(?: neue)?|verdana|tahoma|segoe ui|roboto|-apple-system|blinkmacsystemfont|times new roman|courier new|noto sans|noto serif|sans serif)$/i;
const hex6 = (c: string): string | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return `#${m[1].toLowerCase()}`;
  const s = /^#([0-9a-f]{3})$/i.exec(c); return s ? `#${s[1].split("").map((x) => x + x).join("").toLowerCase()}` : null;
};
const hsl = (h: string): [number, number] => {
  const n = parseInt(h.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const sat = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return [sat, l];
};

/** What the page LOOKS like, read from its raw HTML: brand colours, font families, a dark body, a big top photo.
 *  Heuristics on the HTML alone (no CSS files are fetched), so a site that keeps everything in external
 *  stylesheets yields little — the caller falls back to our own defaults. */
export function readStyle(html: string): ReferenceStyle {
  const head = html.slice(0, 400_000);
  const styles = [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const inline = [...head.matchAll(/style=["']([^"']{0,400})["']/gi)].map((m) => m[1]).join(";");
  const css = `${styles}\n${inline}`;

  // --- fonts: Google Fonts links first (they name exactly what the site loads), then font-family declarations.
  const fonts = new Map<string, number>();
  const bump = (name: string, w: number) => { const f = name.replace(/^["']|["']$/g, "").trim(); if (f && !GENERIC_FONT.test(f) && f.length < 40) fonts.set(f, (fonts.get(f) ?? 0) + w); };
  for (const m of head.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const fam of m[1].split(/&|%26/).filter((x) => /^family=/i.test(x))) bump(decodeURIComponent(fam.replace(/^family=/i, "").replace(/\+/g, " ")).split(/[:|]/)[0], 5);
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}"']+|"[^"]+"|'[^']+')/gi)) bump(m[1].split(",")[0], 1);
  const fontList = [...fonts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 4);

  // --- colours: a declared brand variable or theme-color first, then the most-used saturated colours.
  const colors = new Map<string, number>();
  const addColor = (c: string | undefined, w: number) => {
    const h = c ? hex6(c) : null; if (!h) return;
    const [sat, l] = hsl(h);
    if (sat < 0.18 || l > 0.86 || l < 0.06) return; // greys, near-white, near-black are not a brand colour
    colors.set(h, (colors.get(h) ?? 0) + w);
  };
  for (const m of css.matchAll(/--(?:[\w-]*?)(?:primary|brand|accent|main|theme)(?:[\w-]*?)\s*:\s*(#[0-9a-f]{3,6})\b/gi)) addColor(m[1], 12);
  addColor(head.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3,6})/i)?.[1], 10);
  addColor(head.match(/<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["'](#[0-9a-f]{3,6})/i)?.[1], 4);
  for (const m of css.matchAll(/(?:background(?:-color)?|color|border(?:-color)?|fill)\s*:\s*(#[0-9a-f]{3,6})\b/gi)) addColor(m[1], 1);
  const colorList = [...colors.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 3);

  // --- dark page: a dark body/html background, or the site says so.
  let dark = /<meta[^>]+name=["']color-scheme["'][^>]+content=["']dark/i.test(head) || /<html[^>]+class=["'][^"']*\bdark\b/i.test(head);
  const body = /(?:^|[}\s])(?:body|html)\s*\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-f]{3,6})\b/i.exec(styles)?.[1];
  if (body) { const h = hex6(body); if (h) dark = hsl(h)[1] < 0.22; }

  // --- a big picture at the top: a large image, a background image or a video in the first stretch of the body.
  const at = head.search(/<body\b/i);
  const top = head.slice(at < 0 ? 0 : at, (at < 0 ? 0 : at) + 30_000);
  const heroImage = /<video\b/i.test(top) || /background(?:-image)?\s*:\s*url\(/i.test(top) || /<img\b[^>]*(?:class=["'][^"']*(?:hero|banner|cover|slide)|width=["']?(?:[6-9]\d\d|\d{4})\b|srcset=)/i.test(top)
    || /<(?:section|div|header)\b[^>]*class=["'][^"']*(?:hero|banner|masthead|jumbotron)[^"']*["'][^>]*>[\s\S]{0,4000}?<img\b/i.test(top);

  return { colors: colorList, fonts: fontList, dark, heroImage };
}

/** Returns a short text outline of the page (title, menu, headings, key lines), or null when it cannot be read. */
export async function readReference(raw: string): Promise<Reference | null> {
  let u: URL | null = await safeUrl(raw);
  if (!u) return null;
  let html = "";
  for (let hop = 0; hop < 4 && u; hop++) {
    const r: Response | null = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "user-agent": "Mozilla/5.0 (compatible; ShubhoraBot/1.0; +https://shubhora.com)", accept: "text/html" } }).catch(() => null);
    if (!r) return null;
    if (r.status >= 300 && r.status < 400) { const loc: string | null = r.headers.get("location"); u = loc ? await safeUrl(new URL(loc, u).toString()) : null; continue; }
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) return null;
    const reader = r.body?.getReader(); if (!reader) return null;
    const chunks: Uint8Array[] = []; let size = 0;
    while (size < 1_500_000) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; }
    reader.cancel().catch(() => undefined);
    html = Buffer.concat(chunks).toString("utf8");
    break;
  }
  if (!html || !u) return null;
  // The same for a reference or an own site read here: if the HTML is a shell, take what the page becomes
  // once its JavaScript has run — otherwise its look and its words are both invisible to us.
  html = (await htmlOf(u.toString(), html)) ?? html;
  const style = readStyle(html);
  html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, " ");
  const pick = (re: RegExp, n: number, len: number) => [...html.matchAll(re)].map((m) => clean(m[1])).filter((t) => t.length > 1).map((t) => t.slice(0, len)).filter((t, i, a) => a.indexOf(t) === i).slice(0, n);
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/gi, 1, 120)[0] ?? "";
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] ?? "").slice(0, 200);
  const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3,8})/i)?.[1];
  const nav = pick(/<nav[^>]*>([\s\S]*?)<\/nav>/gi, 2, 800).join(" ").slice(0, 400);
  const heads = pick(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, 25, 120);
  const paras = pick(/<p[^>]*>([\s\S]*?)<\/p>/gi, 12, 220).filter((t) => t.length > 40);
  const summary = [`Title: ${title}`, desc && `Description: ${desc}`, nav && `Menu: ${nav}`, heads.length && `Headings in order:\n- ${heads.join("\n- ")}`, paras.length && `Sample lines:\n- ${paras.join("\n- ")}`]
    .filter(Boolean).join("\n").slice(0, 4000);
  if (themeColor && !style.colors.includes(themeColor.toLowerCase())) style.colors.unshift(themeColor.toLowerCase());
  return summary.length > 40 ? { url: u.toString(), summary, themeColor, style } : null;
}

/** The owner's OWN website, read for facts (not just style): the home page plus the usual About / Products /
 *  Services / Contact pages when they exist. Same safety rules as readReference. */
export async function readOwnSite(raw: string): Promise<{ url: string; text: string } | null> {
  const home = await readReference(raw);
  if (!home) return null;
  const origin = new URL(home.url).origin;
  const paths = ["/about", "/about-us", "/products", "/services", "/contact", "/contact-us"];
  const more = await Promise.all(paths.map((p) => readReference(`${origin}${p}`).catch(() => null)));
  const seen = new Set([home.summary]);
  const parts = [`[Home page]\n${home.summary}`];
  more.forEach((r, i) => { if (r && !seen.has(r.summary) && new URL(r.url).origin === origin) { seen.add(r.summary); parts.push(`[${paths[i]} page]\n${r.summary}`); } });
  return { url: home.url, text: parts.join("\n\n").slice(0, 7000) };
}
