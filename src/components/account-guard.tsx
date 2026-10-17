"use client";

// One phone, two accounts (a partner signing up a team member on their own phone, or the owner using "Login as"):
// when the signed-in account changes, nothing of the previous account may stay behind. This drops the previous
// account's drafts and choices kept in this browser, and ends the Business section's (partner panel's) own session,
// so /partners can never keep showing the previous person's ID — the next visit signs in as the new account.
import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { endPartnerSession } from "@/lib/logout";
import { dropStaleLocal, onLocalReset, PER_ACCOUNT_KEYS as PER_ACCOUNT } from "@/lib/local-reset";

const LAST_USER = "shubhora.uid";

function switched(uid: string | null) {
  if (!uid) return;                                   // signed out: the logout flows clean up themselves
  let prev: string | null = null;
  try { prev = localStorage.getItem(LAST_USER); } catch { return; }
  if (prev === uid) return;
  try {
    localStorage.setItem(LAST_USER, uid);
    for (const k of PER_ACCOUNT) localStorage.removeItem(k);
    sessionStorage.removeItem("card-seed");
  } catch { /* private mode */ }
  void endPartnerSession();
}

export function AccountGuard() {
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => switched(data.session?.user.id ?? null)).catch(() => undefined);
    // The same account, cleared by Super Admin since this phone last looked: its local drafts go too. getUser()
    // asks the server, because the session kept here does not learn of an admin's change on its own.
    sb.auth.getUser().then(({ data }) => dropStaleLocal(data.user)).catch(() => undefined);
    // The account this page started with: when another account signs in INSIDE the same page (log out, log in, no reload), the page is
    // reloaded, so nothing kept in memory (the share links, the plan, the connected accounts) shows the previous person (owner, 17 Oct 2026:
    // Vinay Khanna's app showed RAJWAL's join link).
    let known: string | null = null;
    sb.auth.getSession().then(({ data }) => { known = known ?? data.session?.user.id ?? null; }).catch(() => undefined);
    const { data } = sb.auth.onAuthStateChange((_e, s) => {
      const uid = s?.user.id ?? null;
      switched(uid); dropStaleLocal(s?.user);
      if (uid && known && uid !== known) { known = uid; window.location.reload(); return; }
      if (uid) known = uid;
    });
    // "Reset demo" was pressed in ANOTHER tab of this phone: whatever this tab shows (and any draft it is about to write) belongs to the
    // account as it was before. It opens again on the fresh one; there its own copies are dropped by dropStaleLocal above. The tab that
    // pressed the button opens the welcome page itself. (The set-up screen also hears this, to stop writing its draft first.)
    let reloading = false;
    const unReset = onLocalReset((ownTab) => { if (ownTab || reloading) return; reloading = true; window.location.reload(); });
    return () => { data.subscription.unsubscribe(); unReset(); };
  }, []);
  return null;
}
