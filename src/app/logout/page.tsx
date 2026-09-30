"use client";

// One logout for everything: the app session, and the Business (partner panel) session on this same browser.
// Linked from the panel's own Log out and from the Me page.
import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { endPartnerSession } from "@/lib/logout";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try { await getBrowserSupabase()?.auth.signOut(); } catch { /* already out */ }
      await endPartnerSession();
      window.location.replace("/login");
    })();
  }, []);
  return <div className="flex-1 grid place-items-center py-24"><p className="inline-flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> Logging you out…</p></div>;
}
