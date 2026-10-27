"use client";
// Video — the simple door (owner, 20 Oct 2026: "video wala part bahut mushkil hai; bilkul simple, jo koi bhi bana sake").
// Two big buttons, nothing to compare: a free Reel in one tap, or a Product video in one tap. The old hub with every
// kind, its lengths, credits and times lives on at /poster/videos/all behind one small link.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Camera, Clapperboard, Coins, SlidersHorizontal } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { adCredits } from "@/lib/media/ad-pricing";

export default function VideoDoor() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const [credits, setCredits] = useState<number | null>(null);
  useEffect(() => { fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((r) => { if (typeof r.credits === "number") setCredits(r.credits); }).catch(() => {}); }, []);
  const adCost = adCredits(10);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => goBack(router, "/poster/create")} aria-label={hi ? "पीछे" : "Back"} className="text-muted"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-lg font-bold">Video</h1>
        {credits !== null && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5 text-xs font-semibold"><Coins className="h-3.5 w-3.5 text-brand" /> {credits} credits</span>}
      </div>
      <p className="text-sm text-muted">{hi ? "एक tap में video। शब्द, आवाज़, music — सब हम लगा देंगे। बनने के बाद 🚀 Boost से Facebook / Instagram पर चला सकते हैं।" : "A video in one tap. We write the words and add the voice and music. Once made, 🚀 Boost runs it on Facebook / Instagram."}</p>

      <Link href="/poster/reel" className="block rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-brand"><Camera className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">{hi ? "Reel बनाओ" : "Make a Reel"} <span className="ml-1 rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-semibold text-good">FREE</span></p>
            <p className="text-sm text-muted">{hi ? "आपके business के बारे में 15 सेकंड की reel, 2 मिनट में · WhatsApp Status, Instagram, Facebook" : "A 15-second reel about your business in about 2 minutes · WhatsApp Status, Instagram, Facebook"}</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-brand" />
        </div>
      </Link>

      <Link href="/poster/video" className="block rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Clapperboard className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">{hi ? "Product video बनाओ" : "Make a Product video"} <span className="ml-1 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">{adCost} credits</span></p>
            <p className="text-sm text-muted">{hi ? "एक product की photo के साथ 10 सेकंड का video · बेचने और Boost करने के लिए" : "A 10-second video around one product photo · to sell it, and to Boost"}</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-muted" />
        </div>
      </Link>

      {/* The third kind (owner, 27 Oct 2026): AI films every scene — a real video ad, not pictures that zoom. */}
      <Link href="/poster/video/real" className="block rounded-2xl border border-ai/30 bg-ai-soft/30 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-ai"><Clapperboard className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">{hi ? "Pro video — असली video" : "Pro video — a real video"} <span className="ml-1 rounded-full bg-ai/10 px-2 py-0.5 text-[11px] font-semibold text-ai">PRO · {adCost} credits</span></p>
            <p className="text-sm text-muted">{hi ? "AI हर scene film करता है — लोग, घर और आपका असली product, हिलते हुए · 5–12 मिनट" : "AI films every scene — people, a home and your real product, moving · 5–12 minutes"}</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-ai" />
        </div>
      </Link>

      <Link href="/poster/videos/all" className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted">
        <SlidersHorizontal className="h-4 w-4 shrink-0" /> {hi ? "और तरीके: अपने शब्दों से video, लंबा video (5–10 मिनट), लंबाई और style खुद चुनें" : "More ways: a video from your own words, a long video (5–10 min), choose the length and style yourself"}
      </Link>
      <p className="text-[11px] text-muted">{hi ? "जो video न बने, उसके पूरे credits वापस।" : "A video that fails is refunded in full."}</p>
    </div>
  );
}
