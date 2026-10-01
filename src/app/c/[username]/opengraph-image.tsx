import { SITE_HOST } from "@/lib/site-url";
import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getCardByUsername } from "@/lib/sample-data";
import { fetchCloudCard, getPublicSupabase } from "@/lib/supabase/public";
import { brandForHost, shareBlurb } from "@/lib/brand";

export const alt = "Digital business card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Relative asset paths must become absolute for the image renderer to fetch them. */
function abs(url: string | null | undefined, origin: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("data:")) return null; // too big / not fetchable by satori
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Inter 400 + 700 from Google Fonts. The renderer's built-in font has one
 *  weight only, so "bold" silently renders regular without these. Cached a
 *  day; on any failure the image still renders with the default font. */
async function loadFonts(): Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap", {
      // No browser UA on purpose: Google then serves one plain TTF per weight
      // (browsers get woff2 subsets, which the renderer can't read).
      next: { revalidate: 86400 },
    }).then((r) => r.text());
    const out: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[] = [];
    for (const w of [400, 700] as const) {
      const block = css.split("@font-face").find((b) => b.includes(`font-weight: ${w}`)) ?? "";
      const url = /url\((https:[^)]+\.(?:ttf|woff2?))\)/.exec(block)?.[1];
      if (!url) continue;
      const data = await fetch(url, { next: { revalidate: 86400 } }).then((r) => r.arrayBuffer());
      out.push({ name: "Inter", data, weight: w, style: "normal" });
    }
    return out.length === 2 ? out : [];
  } catch {
    return [];
  }
}

/** Mix a hex colour towards black by `k` (0..1). */
function darken(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#0b1220";
  const n = parseInt(m[1], 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - k)).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// The image WhatsApp / Facebook / LinkedIn show when a card link is shared.
// Brand-aware: on a partner host it carries the partner's logo and name,
// the member's real photo, and never mentions the platform.
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const cloud = await fetchCloudCard(username);
  const card = cloud ?? (getPublicSupabase() ? null : getCardByUsername(username));

  const host = (await headers()).get("host");
  const brand = await brandForHost(host);
  const origin = brand ? `https://${username}.${brand.baseDomain}` : SITE;
  const shownUrl = brand ? `${username}.${brand.baseDomain}` : `${SITE_HOST}/c/${username}`;

  const job = card?.jobTitle || "";
  const company = card?.company || "";
  const person = card?.name || "";
  // A shop's card leads with the business name; the owner moves to the role line.
  const business = card?.lead === "business" && !!company.trim();
  const name = (business ? company.trim() : person) || "Digital card";
  // A square avatar is usually a logo: show it whole on white instead of clipping it into a circle.
  const square = card?.avatarShape === "square";
  const accent = card?.themeColor || brand?.themeColor || "#10b981";
  const bg1 = darken(accent, 0.55);
  const bg2 = darken(accent, 0.8);
  const photo = abs(card?.avatarUrl, origin);
  const logo = abs(brand?.logoUrl, origin);
  const brandName = brand?.name ?? "Shubhora";
  const fonts = await loadFonts();
  const family = fonts.length ? "Inter, sans-serif" : "sans-serif";
  const initials = name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // One clear line about what the visitor gets — never a repeat of the role.
  // …and the city, because a share preview of a local business is read as "who, what, where".
  const city = (card?.seo?.city ?? "").trim();
  const roleLine = [
    business
      ? [job, person && person.trim().toLowerCase() !== company.trim().toLowerCase() ? person : ""].filter(Boolean).join(" · ")
      : [job, company].filter(Boolean).join(" · "),
    city,
  ].filter(Boolean).join(" · ");
  // First sentence only, cut on a word boundary, so it never ends mid-word.
  const full = shareBlurb(brand, card ?? null);
  const sentence = full.split(/(?<=\.)\s+/)[0] || full;
  const blurb = sentence.length > 112 ? sentence.slice(0, 112).replace(/\s+\S*$/, "") + "…" : sentence;
  const chips = brand?.slug === "wellwa-life"
    ? ["Alkaline water ionizers", "Free home demo", "Business plan"]
    : ["Products & services", "Save contact", "Chat on WhatsApp"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: 64, fontFamily: family,
          background: `linear-gradient(120deg, ${bg1} 0%, ${bg2} 100%)`, color: "#fff", position: "relative",
        }}
      >
        {/* soft accent glow */}
        <div style={{ position: "absolute", right: -140, top: -140, width: 520, height: 520, borderRadius: 400, background: accent, opacity: 0.35, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={56} height={56} style={{ borderRadius: 14, background: "#fff", objectFit: "contain" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 12, background: accent, display: "flex" }} />
          )}
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 0.5 }}>{brandName}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={220} height={220} style={square
              ? { borderRadius: 36, objectFit: "contain", background: "#fff", border: "8px solid rgba(255,255,255,0.9)", flexShrink: 0 }
              : { borderRadius: 200, objectFit: "cover", border: "8px solid rgba(255,255,255,0.9)", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 220, height: 220, borderRadius: 200, background: accent, color: "#fff", fontSize: 88, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "8px solid rgba(255,255,255,0.9)", flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
            {roleLine ? <div style={{ fontSize: 32, marginTop: 10, opacity: 0.92 }}>{roleLine}</div> : null}
            <div style={{ fontSize: 27, marginTop: 18, opacity: 0.85, lineHeight: 1.3 }}>{blurb}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              {chips.map((c) => (
                <div key={c} style={{ fontSize: 22, padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.35)", display: "flex" }}>{c}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, opacity: 0.85 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ display: "flex", fontWeight: 700, fontSize: 27, color: "#fff" }}>Tap to view more details</div><div style={{ display: "flex" }}>· Save contact · WhatsApp</div></div>
          <div style={{ display: "flex", fontWeight: 600 }}>{shownUrl}</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
