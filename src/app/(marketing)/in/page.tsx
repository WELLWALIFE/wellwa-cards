import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { pageMeta } from "@/lib/site-brand";
import { cities } from "@/lib/directory";

export const revalidate = 1800;
export const metadata: Metadata = pageMeta("/in", {
  title: "Local businesses by city — Shubhora",
  description: "Shops, clinics, tutors, salons and professionals with a Shubhora website, city by city. Find one near you and order or book on WhatsApp.",
});

export default async function CitiesPage() {
  const list = await cities();
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">Directory · डायरेक्टरी</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Local businesses, city by city</h1>
      <p className="mt-2 max-w-2xl text-muted">Every business here has a Shubhora website with prices, photos and a WhatsApp order button — and an AI that answers at any hour. अपने शहर का नाम चुनें।</p>
      {list.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">The directory is filling up — the first businesses appear here as soon as their websites go live.</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.slug}>
              <Link href={`/in/${c.slug}`} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 no-underline hover:border-brand/60">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"><MapPin className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted">{c.count} business{c.count === 1 ? "" : "es"} · {c.categories.slice(0, 3).map((x) => x.name).join(", ")}{c.categories.length > 3 ? "…" : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-10 text-sm text-muted">Run a business? <Link href="/signup" className="font-semibold text-brand-ink">Get your free website</Link> and be listed in your city.</p>
    </main>
  );
}
