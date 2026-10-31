// The app icon of a business's Premium website (see ../manifest.webmanifest): its logo (else its photo) on a square of its colour; with
// nothing to draw, its initials. ?s=192|512|180 (size), ?m=1 (maskable: more padding, so Android's round / squircle masks keep the logo whole).
import sharp from "sharp";
import { fetchCloudCard, getPublicSupabase } from "@/lib/supabase/public";
import { getCardByUsername } from "@/lib/sample-data";
import { SITE_URL } from "@/lib/site-url";

const SIZES = new Set([180, 192, 512]);
const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#2f5bf5");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const abs = url.startsWith("http") ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
    const r = await fetch(abs, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 0 && b.length < 8_000_000 ? b : null;
  } catch { return null; }
}

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const q = new URL(req.url).searchParams;
  const s = Number(q.get("s")) || 512;
  const size = SIZES.has(s) ? s : 512;
  const maskable = q.get("m") === "1";
  const card = (await fetchCloudCard(username)) ?? (getPublicSupabase() ? null : getCardByUsername(username));
  if (!card) return new Response("Not found", { status: 404 });
  const colour = hex(card.themeColor);
  const src = (card.site?.logoUrl || card.avatarUrl || "").trim();
  const img = src && !src.startsWith("/api/monogram/") ? await fetchImage(src) : null;
  const headers = { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" };
  try {
    if (img) {
      // The logo inside a padded square of the brand colour (a white square when the logo is on white already is not knowable, so the
      // colour it is): 20% padding for maskable (Android's safe zone), 12% otherwise.
      const pad = Math.round(size * (maskable ? 0.2 : 0.12));
      const inner = size - pad * 2;
      const logo = await sharp(img).rotate().resize(inner, inner, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
      const meta = await sharp(logo).metadata();
      const left = Math.round((size - (meta.width ?? inner)) / 2), top = Math.round((size - (meta.height ?? inner)) / 2);
      const out = await sharp({ create: { width: size, height: size, channels: 4, background: colour } }).composite([{ input: logo, left, top }]).png().toBuffer();
      return new Response(new Uint8Array(out), { headers });
    }
  } catch { /* fall through to the initials */ }
  const initials = (card.company || card.name || username).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "S";
  const font = Math.round(size * (initials.length > 1 ? 0.42 : 0.52));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${colour}"/><text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="${font}" fill="#ffffff">${esc(initials)}</text></svg>`;
  const out = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(out), { headers });
}
