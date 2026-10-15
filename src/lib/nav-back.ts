"use client";

// ONE rule for every Back in the app (owner, 15 Oct 2026: "back matlab previous page hona chahiye, kahi aur nahi"):
//   Back = the screen the owner was just on. Only when there is no earlier screen inside the app (a link opened fresh from
//   WhatsApp, a reload on the first page) does it go to the page's natural parent, `fallback`.
// A fixed `<Link href="/poster/more">` as a Back arrow is wrong whenever the page can be reached from more than one place.
//
// `document.referrer` does not change on in-app navigation, so the app counts its own moves: `installNavTracker()` (once, from the
// poster layout) counts history.pushState (a forward move) up and popstate (Back / Forward) down.
import { useEffect } from "react";

let moves = 0;
let installed = false;

/** Called once from the poster layout (NavTracker). Safe to call again. */
export function installNavTracker() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...a: Parameters<History["pushState"]>) => { moves += 1; return push(...a); };
  window.addEventListener("popstate", () => { moves = Math.max(0, moves - 1); });
}

/** Is there an earlier screen of THIS app to go back to? */
export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  if (moves > 0) return true;
  try { return window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { return false; }
}

type Nav = { back: () => void; push: (href: string) => void };

/** Back: the previous screen when there is one inside the app, else `fallback` (the page's natural parent). */
export function goBack(router: Nav, fallback: string) {
  if (canGoBackInApp()) router.back(); else router.push(fallback);
}

/** Mounts the move counter. */
export function useNavTracker() {
  useEffect(() => { installNavTracker(); }, []);
}
