// POST (bearer) { business, category, city, style, colors_hint?, lang?, tagline? } → AI brand kit:
// 4 logo options + taglines, voice guide, palette, local SEO keywords.
//
// Why the logos look professional now: the image model draws ONLY the symbol (a flat icon on white — the one thing
// it does well); the name is typeset by us in a clean font in the brand colour, so the spelling is always right and
// every option reads like a real logo (symbol + wordmark), not an AI collage. Each symbol is checked by eye for
// stray lettering and redrawn once if needed. The kit is free for the first run; later runs cost LOGO_CREDITS.
import { NextResponse } from "next/server";
import sharp from "sharp";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

const STYLES = new Set(["modern", "classic", "playful", "premium"]);
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-3.1-flash-image"; // 2.5 shuts down 2026-10-02, the 3.1 preview went 2026-06-25
const JUDGE = "gemini-3.5-flash-lite";
const LOGO_CREDITS = 2;

type Kit = { taglines: string[]; voice: string; palette: { name: string; hex: string }[]; keywords: string[] };

const STYLE_WORDS: Record<string, string> = {
  modern: "modern, minimal, geometric, one or two flat colours",
  classic: "classic, timeless, elegant, balanced, heritage feel",
  playful: "playful, friendly, rounded shapes, cheerful",
  premium: "premium, refined, understated, luxury feel",
};

async function textKit(key: string, business: string, category: string, city: string, style: string, colorsHint: string, lang: "hi" | "en"): Promise<Kit | null> {
  const taglineLang = lang === "en" ? "English" : "Hindi (Devanagari)";
  const prompt = `You are a brand strategist for small Indian businesses. Business name: "${business}". Category: "${category || "local business"}". City: "${city || "India"}". Style: ${style} (${STYLE_WORDS[style]}).${colorsHint ? ` Colour preference: "${colorsHint}".` : ""}
Return JSON exactly in this shape:
{"taglines": ["<short ${taglineLang} tagline, max 6 words>", "<...>", "<...>", "<...>", "<...>", "<...>"],
 "voice": "<2-line brand voice guide in ${taglineLang}: how the brand should sound on posters and WhatsApp>",
 "palette": [{"name": "primary", "hex": "#RRGGBB"}, {"name": "secondary", "hex": "#RRGGBB"}, {"name": "accent", "hex": "#RRGGBB"}, {"name": "neutral", "hex": "#RRGGBB"}],
 "keywords": ["<6 local SEO keywords a customer in ${city || "the city"} would search, mixing English and Hinglish, include the city name in some>"],
 "symbols": ["<4 different simple symbol ideas for the logo mark, each max 8 words, concrete objects or shapes tied to this trade, no letters>"]}
Rules: taglines and voice in ${taglineLang} only. Truthful, no medical/income claims, no prices. The primary colour must be dark enough to read as text on white (never yellow or light).`;
  try {
    const r = await fetch(`${GEMINI}/${JUDGE}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 1400 } }),
    });
    const j = await r.json().catch(() => ({}));
    const raw = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const strs = (a: unknown, n: number) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 80)).slice(0, n) : []);
    const palette = Array.isArray(raw.palette)
      ? raw.palette.filter((p: { name?: unknown; hex?: unknown }) => typeof p?.name === "string" && typeof p?.hex === "string" && /^#[0-9a-f]{6}$/i.test(p.hex)).map((p: { name: string; hex: string }) => ({ name: p.name.slice(0, 20), hex: p.hex.toUpperCase() })).slice(0, 4)
      : [];
    return { taglines: strs(raw.taglines, 6), voice: typeof raw.voice === "string" ? raw.voice.trim().slice(0, 400) : "", palette, keywords: strs(raw.keywords, 6), ...({ symbols: strs(raw.symbols, 4) } as object) } as Kit & { symbols: string[] };
  } catch { return null; }
}

async function symbolImage(key: string, prompt: string): Promise<Buffer | null> {
  try {
    const r = await fetch(`${GEMINI}/${IMAGE_MODEL}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } } }),
    });
    const d = await r.json().catch(() => null);
    const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x: { inlineData?: { data?: string } }) => x.inlineData?.data);
    return part?.inlineData?.data ? Buffer.from(part.inlineData.data, "base64") : null;
  } catch { return null; }
}

/** One look at the symbol: any lettering, photo-realism or clutter → redraw. */
async function symbolOk(key: string, png: Buffer): Promise<boolean> {
  try {
    const small = await sharp(png).resize(384).jpeg({ quality: 80 }).toBuffer();
    const r = await fetch(`${GEMINI}/${JUDGE}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }, { text: 'This should be a single flat logo SYMBOL on a plain white background with NO letters, words or numbers. Answer JSON {"ok":true|false,"why":"<5 words>"}: ok is false if there is any text, if it is a photo or 3D render, if there are several separate symbols, or if the background is not plain white.' }] }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 100 } }),
    });
    const j = await r.json().catch(() => ({}));
    return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}").ok !== false;
  } catch { return true; }
}

/** White background → transparent, trimmed to the symbol, padded square. */
async function cutout(png: Buffer): Promise<Buffer> {
  const img = sharp(png).ensureAlpha().flatten({ background: "#ffffff" });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const m = Math.min(out[i], out[i + 1], out[i + 2]);
    // near-white → transparent, with a soft edge so anti-aliased outlines keep their shape
    const a = m >= 250 ? 0 : m >= 225 ? Math.round(((250 - m) / 25) * 255) : 255;
    out[i + 3] = a;
  }
  const cut = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const trimmed = await sharp(cut).trim({ threshold: 8 }).toBuffer().catch(() => cut);
  const meta = await sharp(trimmed).metadata();
  const side = Math.max(meta.width ?? 1, meta.height ?? 1);
  const pad = Math.round(side * 0.08);
  return sharp(trimmed).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = "Noto Sans, Noto Sans Devanagari, DejaVu Sans, Helvetica, Arial, sans-serif";
const SERIF = "Noto Serif, Noto Serif Devanagari, DejaVu Serif, Georgia, serif";

/** Symbol + typeset name (+ tagline) → the finished logo: wide (for headers), stacked (for profile / posters), dark version. */
async function compose(icon: Buffer, name: string, tagline: string, color: string, style: string, dark = false): Promise<{ wide: Buffer; stacked: Buffer }> {
  const fam = style === "classic" || style === "premium" ? SERIF : FONT;
  const weight = style === "premium" ? 600 : 800;
  const ink = dark ? "#FFFFFF" : color;
  const sub = dark ? "rgba(255,255,255,0.72)" : "#4B5563";
  const bg = dark ? "#12144A" : "#FFFFFF";
  const upper = style === "premium" || style === "modern";
  const nm = upper ? name.toUpperCase() : name;
  const spacing = upper ? 0.08 : 0;
  // wide 1600×560: icon 440 left, text right
  const W = 1600, H = 560, IC = 440;
  const fs1 = Math.max(56, Math.min(150, Math.round(1000 / Math.max(6, nm.length) * 1.55)));
  const svgWide = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${bg}"/>
    <text x="${IC + 90}" y="${tagline ? 292 : 318}" font-family="${fam}" font-weight="${weight}" font-size="${fs1}" fill="${ink}" letter-spacing="${spacing}em">${esc(nm)}</text>
    ${tagline ? `<text x="${IC + 92}" y="${292 + Math.round(fs1 * 0.62)}" font-family="${FONT}" font-weight="500" font-size="${Math.round(fs1 * 0.34)}" fill="${sub}" letter-spacing="0.04em">${esc(tagline)}</text>` : ""}</svg>`;
  const wide = await sharp(Buffer.from(svgWide)).png().composite([{ input: await sharp(icon).resize(IC, IC, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), left: 60, top: 60 }]).png().toBuffer();
  // stacked 1200×1200: icon 560 top, name centred below
  const S = 1200, SI = 560;
  const fs2 = Math.max(52, Math.min(120, Math.round(1050 / Math.max(6, nm.length) * 1.5)));
  const svgSt = `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg"><rect width="${S}" height="${S}" fill="${bg}"/>
    <text x="600" y="${tagline ? 860 : 890}" text-anchor="middle" font-family="${fam}" font-weight="${weight}" font-size="${fs2}" fill="${ink}" letter-spacing="${spacing}em">${esc(nm)}</text>
    ${tagline ? `<text x="600" y="${860 + Math.round(fs2 * 0.66)}" text-anchor="middle" font-family="${FONT}" font-weight="500" font-size="${Math.round(fs2 * 0.36)}" fill="${sub}" letter-spacing="0.04em">${esc(tagline)}</text>` : ""}</svg>`;
  const stacked = await sharp(Buffer.from(svgSt)).png().composite([{ input: await sharp(icon).resize(SI, SI, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), left: 320, top: 150 }]).png().toBuffer();
  return { wide, stacked };
}

async function upload(userId: string, name: string, png: Buffer): Promise<string | null> {
  const key = `poster/${userId}/logo/${name}.png`;
  const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, {
    method: "POST", headers: { ...serviceHeaders(), "Content-Type": "image/png", "x-upsert": "true", "Cache-Control": "max-age=31536000" }, body: new Uint8Array(png),
  }).catch(() => null);
  return r?.ok ? `${SUPA_URL}/storage/v1/object/public/media/${key}` : null;
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const business = String(b.business ?? "").trim().slice(0, 40);
  const category = String(b.category ?? "").trim().slice(0, 60);
  const city = String(b.city ?? "").trim().slice(0, 40);
  const style = STYLES.has(b.style) ? (b.style as string) : "modern";
  const colorsHint = String(b.colors_hint ?? "").trim().slice(0, 80);
  const tagline = String(b.tagline ?? "").trim().slice(0, 40);
  const lang: "hi" | "en" = b.lang === "en" ? "en" : "hi";
  if (!business) return NextResponse.json({ error: "Business name is required." }, { status: 400 });

  // First kit free; from the second one LOGO_CREDITS (a designer's 4 options cost more than a chai).
  // "Had one before" = logo files already in this account's folder.
  const prior = await fetch(`${SUPA_URL}/storage/v1/object/list/media`, { method: "POST", headers: serviceHeaders(), body: JSON.stringify({ prefix: `poster/${me.id}/logo`, limit: 1 }) })
    .then(async (r) => (r.ok ? ((await r.json()) as unknown[]).length : 0)).catch(() => 0);
  if (prior > 0) {
    const spend = await restAsService<{ ok?: boolean }>("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: LOGO_CREDITS, p_reason: "logo_kit", p_ref: `logo:${me.id}:${Date.now()}` }) });
    if (!spend.ok) return NextResponse.json({ error: `A new logo set costs ${LOGO_CREDITS} credits. Add credits and try again.`, cost: LOGO_CREDITS }, { status: 402 });
  }

  const kit = (await textKit(key, business, category, city, style, colorsHint, lang)) as (Kit & { symbols?: string[] }) | null;
  const primary = kit?.palette?.find((p) => p.name === "primary")?.hex ?? "#12144A";
  const accent = kit?.palette?.find((p) => p.name === "accent")?.hex ?? "#2F4BD8";
  const ideas = (kit?.symbols ?? []).length >= 2 ? kit!.symbols! : [`a simple symbol for a ${category || "local"} business`, "an abstract geometric emblem", "a circular badge with one simple motif", "a minimal line-art mark"];
  const base = `Flat vector LOGO SYMBOL only, ${STYLE_WORDS[style]}, using ${primary} and ${accent}${colorsHint ? ` (${colorsHint})` : ""}. Plain pure white background, centred, generous margin, crisp edges, no gradients, no shadows, no 3D, no photo, no mockup. ABSOLUTELY NO text, letters, numbers or words anywhere.`;
  const prompts = ideas.slice(0, 4).map((idea, i) => `${base} Symbol idea: ${idea}. ${i === 2 ? "Enclose it in a circle or shield." : i === 3 ? "Line-art, single stroke weight." : "Solid shapes."}`);

  // Draw the four symbols in parallel; each is checked and redrawn once if it came back with lettering or clutter.
  const symbols = await Promise.all(prompts.map(async (p) => {
    for (let t = 0; t < 2; t++) {
      const png = await symbolImage(key, p);
      if (!png) continue;
      if (await symbolOk(key, png)) return png;
    }
    return null;
  }));
  const ts = Date.now();
  const options: string[] = [];
  const variants: { icon: string; wide: string; stacked: string; dark: string }[] = [];
  await Promise.all(symbols.map(async (png, i) => {
    if (!png) return;
    try {
      const icon = await cutout(png);
      const light = await compose(icon, business, tagline, primary, style, false);
      const dk = await compose(icon, business, tagline, primary, style, true);
      const [iconUrl, wideUrl, stackedUrl, darkUrl] = await Promise.all([
        upload(me.id, `icon-${i + 1}-${ts}`, icon), upload(me.id, `wide-${i + 1}-${ts}`, light.wide), upload(me.id, `stacked-${i + 1}-${ts}`, light.stacked), upload(me.id, `dark-${i + 1}-${ts}`, dk.stacked),
      ]);
      if (stackedUrl) { options[i] = stackedUrl; variants[i] = { icon: iconUrl ?? "", wide: wideUrl ?? "", stacked: stackedUrl, dark: darkUrl ?? "" }; }
    } catch { /* this option is left out */ }
  }));
  const opts = options.filter(Boolean), vars = variants.filter(Boolean);
  if (!kit && opts.length === 0) return NextResponse.json({ error: "AI did not respond. Please try again." }, { status: 502 });
  return NextResponse.json({ options: opts, variants: vars, taglines: kit?.taglines ?? [], voice: kit?.voice ?? "", palette: kit?.palette ?? [], keywords: kit?.keywords ?? [], partial: !kit || opts.length < 4, charged: prior > 0 ? LOGO_CREDITS : 0 });
}
