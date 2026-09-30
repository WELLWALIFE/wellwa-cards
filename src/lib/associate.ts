"use client";

// Is the signed-in Suite user also a company associate (partner)? Read from their account metadata,
// set when the associate panel created or linked the account.
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export const PARTNER_PANEL = "/api/partner-panel";
export const PARTNER_ACTIVATE = "/api/partner-panel?next=activate";

// One lookup per page load, shared by every button that asks (parallel getUser calls can fail on the auth lock).
let pending: Promise<string | null> | null = null;
function lookup(): Promise<string | null> {
  if (!pending) {
    pending = (getBrowserSupabase()?.auth.getUser() ?? Promise.resolve({ data: { user: null } }))
      .then(({ data }) => { const c = data.user?.user_metadata?.associate_id; return typeof c === "string" && c ? c : null; })
      .catch(() => { pending = null; return null; });
  }
  return pending;
}

export function useAssociate(): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { lookup().then(setCode); }, []);
  return code;
}
