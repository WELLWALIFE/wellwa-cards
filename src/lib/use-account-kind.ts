"use client";
// The signed-in account's kind (partner / pending / consumer), read from the account itself (see lib/account-kind.ts). While it is not known
// yet the answer is "loading", and the screens behave as they always did (so a partner never sees the Business parts blink away).
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { kindOf, type AccountKind } from "@/lib/account-kind";

let cached: { uid: string; kind: AccountKind } | null = null;

export function useAccountKind(): AccountKind | "loading" {
  const [kind, setKind] = useState<AccountKind | "loading">("loading");
  useEffect(() => {
    let live = true;
    const sb = getBrowserSupabase();
    if (!sb) { setKind("partner"); return; }
    sb.auth.getUser().then(({ data }) => {
      if (!live || !data.user) return;
      cached = { uid: data.user.id, kind: kindOf(data.user.app_metadata) };
      setKind(cached.kind);
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return kind;
}

/** Show the partner side (Business tab, team, join links)? Yes for partners, and while the kind is still loading. */
export const showsPartnerUi = (k: AccountKind | "loading") => k === "partner" || k === "loading";
