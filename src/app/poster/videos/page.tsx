"use client";
// Video hub — step 1 of every video: pick the type. One card per kind with what you get, how long, what it costs
// and how long it takes, and the credit balance on top — so nobody is surprised at the Make button.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Camera, Clapperboard, Wand2, Film, Coins, Sparkles, UserRound } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";
import { VideoSteps } from "@/components/poster/video-steps";
import { adCredits, AD_LENGTHS, REALISTIC_MAX_LENGTH, EXPLAINER_MAX_MIN, EXPLAINER_CREDITS_PER_MIN } from "@/lib/media/ad-pricing";

type Kind = { href: string; I: typeof Camera; t: string; s: string; get: string; len: string; cost: string; time: string; tag: "FREE" | "AI" | ""; best: string };

export default function VideoHub() {
  const { lang } = useT(); const hi = lang !== "en";
  const [credits, setCredits] = useState<number | null>(null);
  useEffect(() => { fetch("/api/media/jobs", { cache: "no-store" }).then((x) => x.json()).then((r) => { if (typeof r.credits === "number") setCredits(r.credits); }).catch(() => {}); }, []);
  const min = adCredits(AD_LENGTHS[0]), max = adCredits(AD_LENGTHS[AD_LENGTHS.length - 1]);

  const kinds: Kind[] = [
    { href: "/poster/reel", I: Camera, t: "Reel / Status", tag: "FREE",
      s: hi ? "Stock clips + aapki photos + AI awaaz, captions, music" : "Stock clips + your photos + AI voice, captions, music",
      get: hi ? "10–30 sec ki reel, 9:16" : "A 10–30 sec reel, 9:16", len: "10 · 15 · 20 · 30 sec",
      cost: hi ? "Free (stock clips) · AI scene 1 credit/scene" : "Free with stock clips · AI scene 1 credit each", time: "~2 min",
      best: hi ? "Roz ki Reels aur Stories" : "Daily Reels and Stories" },
    { href: "/poster/video", I: Clapperboard, t: "Video ad", tag: "AI",
      s: hi ? "AI script likhta hai, aapke product ki photo ke saath ad" : "AI writes the script; an ad around your product photo",
      get: hi ? "Reel / Post / YouTube size, voice + music" : "Reel / Post / YouTube sizes, voice + music", len: `${AD_LENGTHS.join(" · ")} sec`,
      cost: hi ? `${min}–${max} credits (${adCredits(10)} per 10 sec) · Realistic ${adCredits(REALISTIC_MAX_LENGTH)} tak` : `${min}–${max} credits (${adCredits(10)} per 10 sec) · Realistic up to ${adCredits(REALISTIC_MAX_LENGTH)}`, time: "2–5 min",
      best: hi ? "Facebook / Instagram ads, product launch" : "Facebook / Instagram ads, a product launch" },
    { href: "/poster/text-video", I: Wand2, t: hi ? "Apne shabdon se" : "From your own words", tag: "",
      s: hi ? "Aap text likhein — AI awaaz, photos, subtitles" : "You write the words — AI voice, pictures, subtitles",
      get: hi ? "Short ad ya lamba video, aapke shabd" : "A short ad or a long video in your words", len: hi ? `10 sec se ${EXPLAINER_MAX_MIN} min` : `10 sec to ${EXPLAINER_MAX_MIN} min`,
      cost: `Short: ${min}–${max} credits · Long: ${EXPLAINER_CREDITS_PER_MIN} credits/min (min 20)`, time: "2–8 min",
      best: hi ? "Jab baat aapki apni honi chahiye" : "When the words must be your own" },
    { href: "/poster/explainer", I: Film, t: hi ? "Lamba video (5–10 min)" : "Long video (5–10 min)", tag: "",
      s: hi ? "Text ya aapki recording — slides, AI pictures, Scene Editor" : "Your text or recording — slides, AI pictures, a Scene Editor",
      get: hi ? "YouTube / training / product explainer" : "A YouTube / training / product explainer", len: hi ? `${EXPLAINER_MAX_MIN} min tak` : `Up to ${EXPLAINER_MAX_MIN} min`,
      cost: `${EXPLAINER_CREDITS_PER_MIN} credits/min (min 20)`, time: "5–15 min",
      best: hi ? "Business plan, training, demo" : "Business plan, training, a demo" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/create" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold flex-1">Video</h1>
        <Link href="/poster/video?credits=1" className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5 text-xs font-semibold"><Coins className="h-3.5 w-3.5 text-brand" /> {credits === null ? "…" : `${credits} credits`}</Link>
      </div>
      <VideoSteps step={1} hi={hi} note={hi ? "kaunsi video chahiye" : "which video you want"} />
      <Guide hi="Har video 4 steps me banti hai: Type → Shabd → Look & awaaz → Banayein. Credits banane se pehle dikhte hain; jo video fail ho, uske credits wapas." en="Every video takes 4 steps: Type → Words → Look & voice → Make. Credits are shown before you make it; a failed video is refunded." />
      <div className="space-y-3">
        {kinds.map((k) => (
          <Link key={k.href} href={k.href} className="block rounded-2xl border border-border bg-surface p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><k.I className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">{k.t}{k.tag && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${k.tag === "FREE" ? "bg-good/15 text-good" : "bg-surface2 text-muted"}`}>{k.tag}</span>}</p>
                <p className="text-xs text-muted">{k.s}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <div><dt className="text-muted">{hi ? "Kya milega" : "You get"}</dt><dd className="font-medium">{k.get}</dd></div>
              <div><dt className="text-muted">{hi ? "Lambai" : "Length"}</dt><dd className="font-medium">{k.len}</dd></div>
              <div><dt className="flex items-center gap-1 text-muted"><Coins className="h-3 w-3" /> Credits</dt><dd className="font-semibold text-brand-ink">{k.cost}</dd></div>
              <div><dt className="text-muted">{hi ? "Samay" : "Time"}</dt><dd className="font-medium">{k.time}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-muted"><Sparkles className="mr-1 inline h-3 w-3" />{hi ? "Sabse achha:" : "Best for:"} {k.best}</p>
          </Link>
        ))}
      </div>
      <p className="text-[11px] text-muted"><UserRound className="mr-1 inline h-3 w-3" />{hi ? "1 credit ≈ ₹10 (plan ke saath). Realistic AI ad 30 sec tak. Video poori hone tak credits hold rahte hain — fail ho to poore wapas." : "1 credit ≈ ₹10 with a plan. Realistic AI ads run up to 30 sec. Credits are held until the video is done — a failure returns all of them."}</p>
    </div>
  );
}
