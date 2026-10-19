// A live Shubhora screen, shared by its owner with a link (lib/live-share.ts). View only; never indexed; the link never travels in a Referer header.
import type { Metadata } from "next";
import { WatchScreen } from "./view";

export const metadata: Metadata = { title: "Shubhora: live screen", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function WatchPage({ params }: { params: Promise<{ token: string }> }) {
  return <WatchScreen token={(await params).token} />;
}
