import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/site-brand";
import { cardsIn, cityBySlug } from "@/lib/directory";
import { DirectoryList } from "@/components/directory-list";

export const revalidate = 1800;

export async function generateMetadata({ params }: { params: Promise<{ city: string; category: string }> }): Promise<Metadata> {
  const { city, category } = await params;
  const c = await cityBySlug(city);
  const k = c?.categories.find((x) => x.slug === category);
  if (!c || !k) return pageMeta(`/in/${city}/${category}`, { title: "Not found — Shubhora", description: "No businesses listed here yet." });
  return pageMeta(`/in/${city}/${category}`, {
    title: `${k.name} in ${c.name} — ${k.count} near you | Shubhora`,
    description: `${k.name} in ${c.name}: ${k.count} business${k.count === 1 ? "" : "es"} with prices, photos and WhatsApp ordering. ${c.name} में ${k.hi}.`,
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ city: string; category: string }> }) {
  const { city, category } = await params;
  const c = await cityBySlug(city);
  const k = c?.categories.find((x) => x.slug === category);
  if (!c || !k) notFound();
  const cards = await cardsIn(c.slug, k.slug);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold text-muted"><Link href="/in" className="text-brand-ink">All cities</Link> › <Link href={`/in/${c.slug}`} className="text-brand-ink">{c.name}</Link> › {k.name}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{k.name} in {c.name}</h1>
      <p className="mt-2 text-muted">{k.count} business{k.count === 1 ? "" : "es"} · {c.name} में {k.hi}</p>
      <DirectoryList cards={cards} />
    </main>
  );
}
