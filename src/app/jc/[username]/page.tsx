// A Jewellery shop's whole collection (owner, 23 Nov 2026 — phase 6): every piece in stock with photo, weight, purity, HUID and a
// "from ₹" price at today's rate (the metal only; making, stones and GST extra), filter by item, ask about a piece on WhatsApp.
// Only when the shop has Jewellery on and Settings → "Show my stock on my website". Sold pieces leave by themselves.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCloudCard } from "@/lib/supabase/public";
import { restAsService } from "@/lib/poster-server";
import { addonOn } from "@/lib/addons-server";
import { jwSetup, publicCatalogFor } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";
import { PieceCard, waNumber } from "@/components/jewellery/catalogue";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ username: string }>; searchParams: Promise<{ type?: string; lang?: string }> };

async function ownerOf(username: string): Promise<string | null> {
  try { return (await restAsService<{ owner_id: string }[]>(`cards?username=eq.${encodeURIComponent(username)}&select=owner_id&limit=1`)).data?.[0]?.owner_id ?? null; } catch { return null; }
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { username } = await params;
  const card = await fetchCloudCard(username).catch(() => null);
  const name = card?.company || card?.name || username;
  return { title: `${name} — Jewellery collection`, description: `Gold and silver jewellery at ${name}: weights, purity, HUID and today's prices. Ask on WhatsApp.` };
}

export default async function Collection({ params, searchParams }: P) {
  const { username } = await params;
  const { type = "", lang } = await searchParams;
  const ownerId = await ownerOf(username);
  if (!ownerId || !(await addonOn(ownerId, "jewellery").catch(() => false))) notFound();
  const [card, setup, cat, shop] = await Promise.all([fetchCloudCard(username).catch(() => null), jwSetup(ownerId), publicCatalogFor(ownerId, 500), shopName(ownerId)]);
  if (!card || !cat) notFound();
  const hi = lang ? lang === "hi" : card.language === "hi";
  const accent = card.themeColor || "#B8860B";
  const wa = waNumber(card);
  const types = [...new Set(cat.items.map((p) => p.type))];
  const items = type ? cat.items.filter((p) => p.type === type) : cat.items;
  const name = setup.shopName || card.company || shop || username;
  const typeName = (k: string) => { const it = setup.items.find((i) => i.key === k); return it ? (hi ? it.hi : it.en) : k; };
  const q = (t: string) => `/jc/${encodeURIComponent(username)}${t ? `?type=${encodeURIComponent(t)}` : ""}`;
  return (
    <main className="min-h-screen bg-neutral-50 text-black">
      <header className="px-4 pb-5 pt-6 text-white" style={{ background: `linear-gradient(135deg, ${accent}, #3b0d1a)` }}>
        <div className="mx-auto max-w-5xl">
          <Link href={`/c/${encodeURIComponent(username)}`} className="text-xs opacity-90">← {name}</Link>
          <h1 className="mt-1 text-2xl font-extrabold">{hi ? "हमारा कलेक्शन" : "Our collection"}</h1>
          <p className="text-sm opacity-90">{cat.count} {hi ? "पीस स्टॉक में" : cat.count === 1 ? "piece in stock" : "pieces in stock"}{cat.priced ? (hi ? " · आज के रेट से दाम" : " · prices at today's rate") : ""}</p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {types.length > 1 && (
          <nav className="flex flex-wrap gap-1.5">
            <Link href={q("")} className={`rounded-full border px-3 py-1 text-xs font-semibold ${!type ? "border-transparent text-white" : "border-neutral-300 bg-white"}`} style={!type ? { background: accent } : undefined}>{hi ? "सब" : "All"}</Link>
            {types.map((t) => <Link key={t} href={q(t)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${type === t ? "border-transparent text-white" : "border-neutral-300 bg-white"}`} style={type === t ? { background: accent } : undefined}>{typeName(t)}</Link>)}
          </nav>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((p) => <PieceCard key={p.id} p={p} wa={wa} hi={hi} accent={accent} />)}</div>
        <p className="text-[11px] text-neutral-500">{cat.priced ? (hi ? "“से शुरू” = आज के रेट से धातु का दाम; मेकिंग, नग और 3% GST अलग। दाम रेट के साथ रोज़ बदलता है। पक्का दाम दुकान पर / WhatsApp पर।" : "“From” = the metal at today's rate; making, stones and 3% GST are extra. Prices change with the daily rate; the final price at the shop / on WhatsApp.") : (hi ? "दाम के लिए WhatsApp पर पूछें।" : "Ask on WhatsApp for the price.")}</p>
        <p className="text-center text-[10px] text-neutral-400">Made with Shubhora · shubhora.com</p>
      </div>
    </main>
  );
}
