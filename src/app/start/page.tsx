import { redirect } from "next/navigation";

// The consumer link (owner, 17 Oct 2026): shubhora.com/start. Whoever signs up through it uses the app (card, website, posters, plan) and is never
// shown the partner programme or placed in a team. It is the sign-up page in "consumer" mode.
// ?f=CODE (Admin v2, 31 Oct 2026): a franchise's own link — the sign-up joins that franchise.
export const metadata = { title: "Start with Shubhora" };

export default async function Start({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const f = String((await searchParams).f ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  redirect(`/signup?kind=consumer${f ? `&f=${f}` : ""}`);
}
