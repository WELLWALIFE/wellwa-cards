"use client";
// Product video (template tier): the one-page maker lives in components/poster/video-maker.tsx, shared with the Pro video.
import { AiPageGate } from "@/lib/ai-access";
import { VideoMaker } from "@/components/poster/video-maker";

export default function VideoAd() {
  return <AiPageGate title="Product video" reason="Turn your product into a ready video ad with AI voice and music."><VideoMaker /></AiPageGate>;
}
