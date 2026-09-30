"use client";

// One phone, two accounts (a partner signing up a team member on their own phone, or the owner using "Login as"):
// when the signed-in account changes, nothing of the previous account may stay behind. This drops the previous
// account's drafts and choices kept in this browser, and ends the Business section's (partner panel's) own session,
// so /partners can never keep showing the previous person's ID — the next visit signs in as the new account.
import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { endPartnerSession } from "@/lib/logout";

const LAST_USER = "shubhora.uid";
/** Browser storage that belongs to one account (not scoped by account id where it is written). */
const PER_ACCOUNT = ["akp-draft", "akp-video-draft", "akp-profile", "akp-crm-ws", "vcard-preview"];

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
    const { data } = sb.auth.onAuthStateChange((_e, s) => switched(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
