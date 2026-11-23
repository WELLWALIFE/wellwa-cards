// The shop's "Today's rate" poster (1080 × 1350, for WhatsApp status, Instagram and the counter screen): a PNG anyone can open, like
// the rate on the shop's website. Only a shop with Shubhora Jewellery on and a rate of the last 3 days; English only (the image
// renderer has no Hindi font).
import { ImageResponse } from "next/og";
import { restAsService } from "@/lib/poster-server";
import { addonOn } from "@/lib/addons-server";
import { istDay, jwSetup, rateOf } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";
import { cardLink } from "@/lib/crm-server";
import { publicRate } from "@/lib/jewellery";
import { SITE_URL } from "@/lib/site-url";

type Ctx = { params: Promise<{ username: string }> };

async function inter(): Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap", { next: { revalidate: 86400 } }).then((r) => r.text());
    const out: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[] = [];
    for (const w of [400, 700] as const) {
      const url = /url\((https:[^)]+\.(?:ttf|woff2?))\)/.exec(css.split("@font-face").find((b) => b.includes(`font-weight: ${w}`)) ?? "")?.[1];
      if (url) out.push({ name: "Inter", data: await fetch(url, { next: { revalidate: 86400 } }).then((r) => r.arrayBuffer()), weight: w, style: "normal" });
    }
    return out.length === 2 ? out : [];
  } catch { return []; }
}

const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export async function GET(_req: Request, { params }: Ctx) {
  const username = (await params).username.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 60);
  const card = (await restAsService<{ owner_id: string }[]>(`cards?username=eq.${encodeURIComponent(username)}&select=owner_id&limit=1`).catch(() => null))?.data?.[0];
  const ownerId = card?.owner_id;
  if (!ownerId || !(await addonOn(ownerId, "jewellery").catch(() => false))) return new Response("Not found", { status: 404 });
  const [setup, book] = await Promise.all([jwSetup(ownerId), rateOf(ownerId)]);
  const fresh = book && Date.parse(`${istDay()}T00:00:00Z`) - Date.parse(`${book.day}T00:00:00Z`) <= 3 * 86400_000;
  const rate = fresh ? publicRate(book, setup) : null;
  if (!rate) return new Response("No rate set in the last 3 days", { status: 404 });
  const shop = setup.shopName || (await shopName(ownerId).catch(() => "")) || username;
  const phone = setup.phone;
  const day = new Date(`${rate.day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fonts = await inter();
  const site = ((await cardLink(ownerId).catch(() => "")) || `${SITE_URL}/c/${username}`).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const gold = "#E9C46A";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 72, fontFamily: fonts.length ? "Inter" : "sans-serif",
        background: "linear-gradient(160deg, #3b0d1a 0%, #5a1426 55%, #2a0912 100%)", color: "#fff", position: "relative" }}>
        <div style={{ position: "absolute", right: -160, top: -160, width: 560, height: 560, borderRadius: 400, background: gold, opacity: 0.16, display: "flex" }} />
        <div style={{ display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>{shop}</div>
        <div style={{ display: "flex", marginTop: 46, fontSize: 30, letterSpacing: 6, color: gold, fontWeight: 700 }}>TODAY&apos;S RATE</div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 30, opacity: 0.85 }}>{day}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, gap: 18 }}>
          {rate.rows.map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 34px", borderRadius: 26,
              background: "rgba(255,255,255,0.08)", border: `2px solid ${r.metal === "gold" ? "rgba(233,196,106,0.55)" : "rgba(255,255,255,0.25)"}` }}>
              <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>{r.label}</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: r.metal === "gold" ? gold : "#fff" }}>{money(r.paise)}</div>
                <div style={{ display: "flex", fontSize: 26, marginLeft: 10, opacity: 0.75 }}>/ {r.unit}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", fontSize: 24, opacity: 0.7 }}>GST and making charges extra. Rates may change during the day.</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 30, fontWeight: 700 }}>
          <div style={{ display: "flex" }}>{phone ? `Call / WhatsApp ${phone}` : ""}</div>
          <div style={{ display: "flex", color: gold }}>{site}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: fonts.length ? fonts : undefined, headers: { "cache-control": "public, max-age=300" } },
  );
}
