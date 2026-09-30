import { redirect } from "next/navigation";

// shubhora.com/join/RAHUL_99 — the short invite link on the Me page. It works before the person has built a
// card: it opens the sign-up with RAHUL_99 as the introducer (shown by username only, never a name).
// ?leg=L|R (the partner panel's left / right links) chooses the side of the introducer's team; without it (the card's
// universal link) the panel places the new ID on the weaker side.
export default async function JoinHandle({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ leg?: string }> }) {
  const { handle } = await params;
  const { leg } = await searchParams;
  const by = decodeURIComponent(handle || "").trim().slice(0, 40);
  const side = leg === "L" || leg === "R" ? `&leg=${leg}` : "";
  redirect(/^[A-Za-z0-9_-]{2,40}$/.test(by) ? `/signup?by=${encodeURIComponent(by)}${side}` : "/signup");
}
