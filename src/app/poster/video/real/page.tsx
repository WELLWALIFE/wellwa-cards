"use client";
// Pro video — AI films every scene (real-looking clips of people and the owner's own product). Same one page as the
// Product video, tier "realistic" (owner, 27 Oct 2026: "real profactional video ad banana hai, kaam nahi chalana").
import { AiPageGate } from "@/lib/ai-access";
import { VideoMaker } from "@/components/poster/video-maker";

export default function ProVideo() {
  return <AiPageGate title="Pro video" reason="AI films real-looking scenes with your own product, then adds voice, music and your logo."><VideoMaker tier="realistic" /></AiPageGate>;
}
