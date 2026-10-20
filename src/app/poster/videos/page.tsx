"use client";
// Video — the simple door (owner, 20 Oct 2026: "video wala part bahut mushkil hai; bilkul simple, jo koi bhi bana sake").
// Two big buttons, nothing to compare: a free Reel in one tap, or a Video ad in one tap. The old hub with every
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
      <p className="text-sm text-muted">{hi ? "Ek tap me video. Shabd, awaaz, music — sab hum laga denge." : "A video in one tap. We write the words and add the voice and music."}</p>

      <Link href="/poster/reel" className="block rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-brand"><Camera className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">{hi ? "Reel banao" : "Make a Reel"} <span className="ml-1 rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-semibold text-good">FREE</span></p>
            <p className="text-sm text-muted">{hi ? "15 second ki reel, 2 minute me · WhatsApp Status, Instagram, Facebook" : "A 15-second reel in about 2 minutes · WhatsApp Status, Instagram, Facebook"}</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-brand" />
        </div>
      </Link>

      <Link href="/poster/video" className="block rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Clapperboard className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">{hi ? "Video ad banao" : "Make a Video ad"} <span className="ml-1 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">{adCost} credits</span></p>
            <p className="text-sm text-muted">{hi ? "Aapke product ki photo ke saath 10 second ka ad · Facebook / Instagram ads ke liye" : "A 10-second ad around your product photo · for Facebook / Instagram ads"}</p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-muted" />
        </div>
      </Link>

      <Link href="/poster/videos/all" className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted">
        <SlidersHorizontal className="h-4 w-4 shrink-0" /> {hi ? "Aur tarike: apne shabdon se video, lamba video (5–10 min), lambai aur style khud chunein" : "More ways: a video from your own words, a long video (5–10 min), choose the length and style yourself"}
      </Link>
      <p className="text-[11px] text-muted">{hi ? "Jo video fail ho, uske credits poore wapas." : "A video that fails is refunded in full."}</p>
    </div>
  );
}
