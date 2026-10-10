"use client";
// "N photos your website still needs →" — shown on My website and My card when stock stands in for the owner's
// own pictures (photo-wishlist.ts). Quiet when everything is there.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { api } from "@/lib/poster-client";
import { fetchMyCards } from "@/lib/cloud";
import { normalizeFacts, type FactsResponse } from "@/lib/card-facts";
import { photoWishlist } from "@/lib/photo-wishlist";
import { useT } from "@/lib/poster-i18n";

export function PhotoNudge() {
  const { lang } = useT();
  const hi = lang === "hi";
  const [n, setN] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const [r, cards] = await Promise.all([api<FactsResponse>("/api/card/facts"), fetchMyCards().catch(() => [])]);
        if (!r.ok || !r.data.facts) return;
        const facts = normalizeFacts(r.data.facts);
        const card = cards.find((c) => c.id === facts.primaryCardId) ?? cards[0] ?? null;
        setN(photoWishlist({ category: r.data.setup?.category ?? "", facts, products: r.data.products ?? [], card, lang }).filter((w) => w.slot === "banner" || w.slot === "photo" || w.slot === "product").length);
      } catch { /* quiet */ }
    })();
  }, [lang]);
  if (!n) return null;
  return (
    <Link href="/poster/photos" className="flex items-center gap-3 rounded-2xl border-2 border-amber/50 bg-amber/10 px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber text-white"><Camera className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{hi ? `${n} photo चाहिए — stock की जगह आपकी असली` : `${n} photo${n === 1 ? "" : "s"} needed — yours instead of stock`}</span>
        <span className="block text-[11px] text-muted">{hi ? "phone से लो, हम सही जगह लगा देंगे" : "Take them on your phone; we put each in the right place"}</span>
      </span>
      <span className="text-amber">→</span>
    </Link>
  );
}
