"use client";
// The viewer's side of a Share Screen link: the sender's Shubhora screen, live, view only (components/share/screen-feed.tsx draws it).
import { useCallback } from "react";
import { ScreenFeed, type Controller, type Loader } from "@/components/share/screen-feed";

export function WatchScreen({ token }: { token: string }) {
  const load = useCallback<Loader>(({ after, epoch, vid, ask }) =>
    fetch(`/api/share/watch?token=${encodeURIComponent(token)}&after=${after}&epoch=${epoch}&v=${vid}${ask ? "&ask=1" : ""}`, { cache: "no-store" }), [token]);
  const control = useCallback<Controller>(async (cmds) => {
    const r = await fetch("/api/share/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, cmds }), cache: "no-store" });
    return r.ok;
  }, [token]);
  return (
    <div className="min-h-screen bg-[#0b0e33] text-white">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm font-bold">Shubhora <span className="font-normal text-white/60">· Share Screen</span></span>
      </div>
      <p className="mx-auto max-w-md px-4 pb-2 text-center text-[11px] text-white/60">You see their Shubhora screen. If they allow it, you can also tap and type for them. Hindi: आप उनकी Shubhora screen देख सकते हैं; उन्होंने इजाज़त दी हो तो उनकी जगह दबा-लिख भी सकते हैं।</p>
      <ScreenFeed load={load} control={control} />
    </div>
  );
}
