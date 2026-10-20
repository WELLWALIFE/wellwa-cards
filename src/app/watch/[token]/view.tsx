"use client";
// The viewer's side of a Share Screen link: the sender's Shubhora screen, live, view only (components/share/screen-feed.tsx draws it).
import { useCallback } from "react";
import { ScreenFeed, type Loader } from "@/components/share/screen-feed";

export function WatchScreen({ token }: { token: string }) {
  const load = useCallback<Loader>(({ after, epoch, vid, ask }) =>
    fetch(`/api/share/watch?token=${encodeURIComponent(token)}&after=${after}&epoch=${epoch}&v=${vid}${ask ? "&ask=1" : ""}`, { cache: "no-store" }), [token]);
  return (
    <div className="min-h-screen bg-[#0b0e33] text-white">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm font-bold">Shubhora <span className="font-normal text-white/60">· Share Screen</span></span>
      </div>
      <p className="mx-auto max-w-md px-4 pb-2 text-center text-[11px] text-white/60">You can only watch their Shubhora screen. Nothing you do here reaches their phone. Hindi: आप सिर्फ़ उनकी Shubhora screen देख सकते हैं।</p>
      <ScreenFeed load={load} />
    </div>
  );
}
