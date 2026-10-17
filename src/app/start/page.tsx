import { redirect } from "next/navigation";

// The consumer link (owner, 17 Oct 2026): shubhora.com/start. Whoever signs up through it uses the app (card, website, posters, plan) and is never
// shown the partner programme or placed in a team. It is the sign-up page in "consumer" mode.
export const metadata = { title: "Start with Shubhora" };

export default function Start() {
  redirect("/signup?kind=consumer");
}
