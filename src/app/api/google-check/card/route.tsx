// The Google report as one picture (1080 × 1350) to send on WhatsApp or keep (owner, 25 Nov 2026: a report people can share, like the
// competitor's). GET ?p=<Google place id>[&by=<partner card>]: drawn from the report already kept in google_checks — it never calls
// Google, so opening the picture costs nothing. English only (the image renderer has no Hindi font). Public Google data only.
import { ImageResponse } from "next/og";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isShubhoraSellerCard } from "@/lib/shubhora-page";
import { SITE_HOST } from "@/lib/site-url";
import type { Report } from "@/lib/google-check";

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
const ascii = (s: string, n: number) => s.replace(/[^\x20-\x7E₹·–—]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const placeId = (q.get("p") ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 300);
  const admin = getAdminSupabase();
  if (!placeId || !admin) return new Response("Not found", { status: 404 });
  const { data } = await admin.from("google_checks").select("report").eq("place_id", placeId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const r = data?.report as Report | undefined;
  if (!r) return new Response("No report yet", { status: 404 });

  // The partner who shared it signs the picture (a real Shubhora partner card only).
  let by = "";
  const who = (q.get("by") ?? "").toLowerCase();
  if (/^[a-z0-9_.-]{2,60}$/.test(who)) {
    const { data: c } = await admin.from("cards").select("data").eq("username", who).maybeSingle();
    const d = (c?.data ?? {}) as { company?: string; name?: string; jobTitle?: string; tagline?: string };
    if (c && isShubhoraSellerCard(d)) by = ascii(d.name || d.company || "", 40);
  }

  const issues = r.issues?.length ? r.issues : r.fixes;
  const ahead = r.local?.ahead.length ?? 0;
  const plus = r.local && r.local.rank === null ? "+" : "";
  const pct = r.profile?.length ? Math.round((r.profile.filter((x) => x.ok).length / r.profile.length) * 100) : null;
  const tone = (good: boolean, mid: boolean) => (good ? "#16a34a" : mid ? "#d97706" : "#dc2626");
  const word = (good: boolean, mid: boolean) => (good ? "Good" : mid ? "Average" : "Poor");
  const tiles: { k: string; v: string; good: boolean; mid: boolean; note: string }[] = [
    { k: "Google score", v: `${r.score}/100`, good: r.score >= 75, mid: r.score >= 45, note: "Rating, reviews, photos, hours, website" },
    ...(pct !== null ? [{ k: "Profile completion", v: `${pct}%`, good: pct >= 85, mid: pct >= 60, note: ((n) => (n === 0 ? "Nothing missing" : n === 1 ? "1 field is missing" : `${n} fields are missing`))(r.profile!.filter((x) => !x.ok).length) }] : []),
    { k: "Reviews", v: String(r.place.reviews), good: r.place.reviews >= 100, mid: r.place.reviews >= 30, note: r.place.rating ? `Rating ${r.place.rating.toFixed(1)} / 5` : "No rating yet" },
    { k: "Issues found", v: String(issues.length), good: issues.length === 0, mid: issues.length <= 2, note: "Things hurting your ranking" },
  ].slice(0, 4);
  const fonts = await inter();

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "Inter", color: "#111827" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "44px 60px 34px", background: "#f3f4f6" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1.1 }}>{ascii(r.place.name, 44) || "Your business"}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 30, color: "#4b5563" }}>{`${r.place.rating ? r.place.rating.toFixed(1) : "0"}/5  ·  ${r.place.reviews} reviews  ·  ${ascii(r.city, 30)}`}</div>
          <div style={{ display: "flex", marginTop: 6, fontSize: 24, color: "#6b7280" }}>{ascii(r.place.address, 78)}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "30px 60px 0", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "34px 40px", borderRadius: 28, border: "3px solid #2563eb", background: "#eaf2ff" }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>Google Search Rank</div>
              <div style={{ display: "flex", marginTop: 8, fontSize: 27, color: "#4b5563", lineHeight: 1.3 }}>
                {r.local ? `Your place among "${ascii(r.trade || r.place.category, 28)}" businesses near you` : "Google has no clear category for this business, so it cannot be ranked"}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 84, fontWeight: 700, color: r.local ? tone((r.local.rank ?? 99) <= 3, (r.local.rank ?? 99) <= 10) : "#dc2626" }}>{r.local ? (r.local.rank ?? `${r.local.total}+`) : "–"}</div>
              <div style={{ display: "flex", padding: "4px 22px", borderRadius: 14, fontSize: 30, fontWeight: 700, background: "#fee2e2", color: "#dc2626" }}>
                {r.local ? (ahead === 0 ? "You are first" : `${ahead}${plus} ahead of you`) : "Not ranked"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", marginTop: 24 }}>
            {tiles.map((t) => (
              <div key={t.k} style={{ display: "flex", flexDirection: "column", width: 464, marginBottom: 22, padding: "22px 30px", borderRadius: 26, background: "#f5f5f7" }}>
                <div style={{ display: "flex", fontSize: 32, color: "#1f2937" }}>{t.k}</div>
                <div style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
                  <div style={{ display: "flex", fontSize: 58, fontWeight: 700 }}>{t.v}</div>
                  <div style={{ display: "flex", marginLeft: 22, padding: "4px 18px", borderRadius: 12, fontSize: 30, fontWeight: 700, color: tone(t.good, t.mid), background: t.good ? "#dcfce7" : t.mid ? "#fef3c7" : "#fee2e2" }}>{word(t.good, t.mid)}</div>
                </div>
                <div style={{ display: "flex", marginTop: 10, fontSize: 26, color: "#6b7280" }}>{t.note}</div>
              </div>
            ))}
          </div>

          {issues.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#dc2626" }}>Fix these first</div>
              {issues.slice(0, 3).map((f, i) => <div key={i} style={{ display: "flex", marginTop: 10, fontSize: 27, color: "#374151" }}>{`${i + 1}.  ${ascii(f.title, 62)}`}</div>)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "30px 60px", background: "#171447", color: "#ffffff" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: "#a9c8ff" }}>{by ? "Your Google report from" : "Free Google report by"}</div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{by ? `${by} · Shubhora` : "Shubhora"}</div>
          </div>
          <div style={{ display: "flex", fontSize: 28 }}>{`${SITE_HOST}/google-check`}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, ...(fonts.length ? { fonts } : {}), headers: { "cache-control": "public, max-age=600" } },
  );
}
