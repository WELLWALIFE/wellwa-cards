"use client";

// ONE rule for every Back in the app (owner, 15 Oct 2026: "back matlab previous page hona chahiye, kahi aur nahi"):
//   Back = the screen the owner was just on. Only when there is no earlier screen inside the app (a link opened fresh from
//   WhatsApp, a reload on the first page) does it go to the page's natural parent, `fallback`.
// A fixed `<Link href="/poster/more">` as a Back arrow is wrong whenever the page can be reached from more than one place.
//
// `document.referrer` does not change on in-app navigation, so the app counts its own moves: `installNavTracker()` (once, from the
// poster layout) counts history.pushState (a forward move) up and popstate (Back / Forward) down.
import { useEffect } from "react";

const KEY = "nav-moves";
let moves = 0;
let installed = false;

const save = () => { try { sessionStorage.setItem(KEY, String(moves)); } catch { /* private mode: the count then lives for this page only */ } };

/** Called once from the poster layout (NavTracker) and from the Finish-setup bar. Safe to call again. */
export function installNavTracker() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // The count survives a reload and a full page load inside the app (the browser keeps its history, so must we).
  try { moves = Math.max(0, Number(sessionStorage.getItem(KEY)) || 0); } catch { moves = 0; }
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...a: Parameters<History["pushState"]>) => { moves += 1; save(); return push(...a); };
  window.addEventListener("popstate", () => { moves = Math.max(0, moves - 1); save(); });
}

/** Is there an earlier screen of THIS app to go back to? */
export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  if (moves > 0) return true;
  try { return window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { return false; }
}

type Nav = { back: () => void; push: (href: string) => void; replace?: (href: string) => void };

/** Back: the previous screen when there is one inside the app, else `fallback` (the page's natural parent).
 *  The fallback REPLACES this screen: pushing it would make the parent's own Back come straight back here, and the two would bounce. */
export function goBack(router: Nav, fallback: string) {
  if (canGoBackInApp()) router.back();
  else if (router.replace) router.replace(fallback);
  else router.push(fallback);
}

/** Mounts the move counter. */
export function useNavTracker() {
  useEffect(() => { installNavTracker(); }, []);
}
