import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/site-brand";
import { cardsIn, cityBySlug } from "@/lib/directory";
import { DirectoryList } from "@/components/directory-list";

export const revalidate = 1800;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const c = await cityBySlug(city);
  if (!c) return pageMeta(`/in/${city}`, { title: "City not found — Shubhora", description: "No businesses listed for this city yet." });
  return pageMeta(`/in/${city}`, {
    title: `Businesses in ${c.name} — shops, clinics, services | Shubhora`,
    description: `${c.count} local businesses in ${c.name} with websites, prices and WhatsApp ordering: ${c.categories.slice(0, 6).map((x) => x.name).join(", ")}.`,
  });
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const c = await cityBySlug(city);
  if (!c) notFound();
  const cards = await cardsIn(c.slug);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold text-muted"><Link href="/in" className="text-brand-ink">All cities</Link> › {c.name}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Businesses in {c.name}</h1>
      <p className="mt-2 text-muted">{c.count} business{c.count === 1 ? "" : "es"} — each with a website, prices and a WhatsApp order button.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {c.categories.map((k) => (
          <Link key={k.slug} href={`/in/${c.slug}/${k.slug}`} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium no-underline hover:border-brand/60">{k.name} <span className="text-muted">{k.count}</span></Link>
        ))}
      </div>
      <DirectoryList cards={cards} />
    </main>
  );
}
