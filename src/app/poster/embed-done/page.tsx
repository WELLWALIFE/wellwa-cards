"use client";
// Where a screen opened inside Website edit lands after Save / Cancel: it tells Website edit, which shows "saved" and opens the screen again.
import { useEffect } from "react";
import { Check } from "lucide-react";
import { toParent } from "@/components/poster/embed-mode";

export default function EmbedDonePage() {
  useEffect(() => {
    let saved = false; try { saved = new URLSearchParams(window.location.search).get("saved") === "1"; } catch { /* ignore */ }
    toParent({ type: "embed-done", saved });
  }, []);
  return <div className="grid place-items-center py-10 text-good"><Check className="h-6 w-6" /></div>;
}
