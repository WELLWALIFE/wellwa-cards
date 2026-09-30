"use client";
// /poster/card/edit — "Card badlein" from anywhere (Home): opens the editor on the owner's own V-Card in one tap.
// Same pick as the My V-Card tab: with several cards, the one made on "Make your V-Card"; no card yet → make one.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { isThinCard } from "@/lib/card-personalize";
import type { FactsResponse } from "@/lib/card-facts";

export default function EditMyCard() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  async function go() {
    setFailed(false);
    try {
      if (!(await isLoggedIn())) { router.replace("/login?next=/poster/card/edit"); return; }
      const cards = await fetchMyCardsStrict();
      let primaryId = "";
      if (cards.length > 1) {
        const fr = await api<Partial<FactsResponse>>("/api/card/facts").catch(() => null);
        primaryId = fr?.ok ? fr.data.facts?.primaryCardId ?? "" : "";
      }
      const mine = cards.find((c) => c.id === primaryId) ?? cards[0];
      router.replace(!mine || isThinCard(mine) ? "/poster/card/build" : `/poster/d/editor?id=${mine.id}`);
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => { go(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (failed) return (
    <div className="py-20 grid place-items-center gap-3 text-center">
      <p className="font-semibold">No internet — tap to try again</p>
      <button type="button" onClick={go} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-base font-semibold text-white"><RefreshCw className="h-5 w-5" /> Try again</button>
    </div>
  );
  return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
}
