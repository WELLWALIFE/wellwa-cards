import Link from "next/link";

// A card link that does not exist (never made, switched off, or moved to a new link after the owner changed it).
// Was Next's bare "404 · This page could not be found" — now a clear, friendly page with a way on (owner's review,
// 25 Sep 2026). Neutral wording: white-label partner domains show this page too.
export default function CardNotFound() {
  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 text-center shadow-card">
        <p className="text-4xl" aria-hidden>🔍</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This card is not available</h1>
        <p className="mt-2 text-sm text-muted">
          The link may have changed, or the card is switched off. Ask the owner for their new link.
        </p>
        <div className="mt-6 space-y-2">
          <Link href="/signup" className="block w-full rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">
            Make your own free digital card
          </Link>
          <Link href="/" className="block w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold">
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}
