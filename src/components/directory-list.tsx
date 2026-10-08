// The cards of one city (or one trade in a city) as a grid: logo or initial, business, trade, tagline → the website.
import Link from "next/link";
import type { DirCard } from "@/lib/directory";

export function DirectoryList({ cards }: { cards: DirCard[] }) {
  if (!cards.length) return <p className="mt-8 text-sm text-muted">Nothing here yet.</p>;
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => {
        const title = c.company || c.name;
        return (
          <li key={c.username}>
            <Link href={`/c/${c.username}`} className="flex h-full items-start gap-3 rounded-2xl border border-border bg-surface p-4 no-underline hover:border-brand/60">
              {c.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.avatarUrl} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: c.theme }}>{(title || "?").trim().charAt(0).toUpperCase()}</span>}
              <span className="min-w-0">
                <span className="block font-semibold leading-tight truncate">{title}</span>
                <span className="block text-xs text-brand-ink">{c.category}{c.company && c.name && c.company !== c.name ? ` · ${c.name}` : ""}</span>
                {c.tagline && <span className="mt-1 block text-xs text-muted line-clamp-2">{c.tagline}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
