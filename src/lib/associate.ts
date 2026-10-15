"use client";

// Is the signed-in Suite user also a company associate (partner)? Read from their account metadata,
// set when the associate panel created or linked the account.
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export const PARTNER_PANEL = "/api/partner-panel";

// One lookup per page load, shared by every button that asks (parallel getUser calls can fail on the auth lock).
let pending: Promise<string | null> | null = null;
function lookup(): Promise<string | null> {
  if (!pending) {
    pending = (getBrowserSupabase()?.auth.getUser() ?? Promise.resolve({ data: { user: null } }))
      .then(({ data }) => { const c = data.user?.user_metadata?.associate_id; const v = typeof c === "string" && c ? c : null; if (!v) setTimeout(() => { pending = null; }, 5000); return v; })   // "not a partner" is asked again after a few seconds: an ID may be made during set-up
      .catch(() => { pending = null; return null; });
  }
  return pending;
}

export function useAssociate(): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { lookup().then(setCode); }, []);
  return code;
}
