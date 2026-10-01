"use client";

// Arrival point from the associate admin: exchanges a one-time handoff for an admin session, then opens
// Super Admin. A handoff minted for a Staff Admin member (action "support-link" on /api/link) comes back
// scoped to "support": it opens Live help and the menu shows nothing else.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Link() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState(false);
  useEffect(() => {
    const t = params.get("t");
    if (!t) { setError(true); return; }
    fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handoff: t }) })
      .then((r) => r.json()).then((j: { ok?: boolean; key?: string; scope?: string; who?: string }) => {
        if (!j.ok || !j.key) { setError(true); return; }
        const support = j.scope === "support";
        try {
          sessionStorage.setItem("ne-superadmin-ok", "1");
          sessionStorage.setItem("ne-admin-key", j.key);
          sessionStorage.setItem("ne-admin-scope", support ? "support" : "all");
          if (j.who) sessionStorage.setItem("ne-admin-who", j.who);
        } catch { /* ignore */ }
        const to = params.get("to");
        // A support session has only one page to go to, whatever the link asked for.
        router.replace(support || to === "support" ? "/admin/support" : to === "users" ? "/admin/users" : "/admin");
      }).catch(() => setError(true));
  }, [params, router]);
  return <div className="min-h-screen grid place-items-center p-6 text-sm text-muted">{error ? "This link has expired. Open Shubhora admin again from the partner admin." : "Opening Shubhora admin…"}</div>;
}

export default function Page() {
  return <Suspense><Link /></Suspense>;
}
