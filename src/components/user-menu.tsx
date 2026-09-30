"use client";
import { displayLogin } from "@/lib/phone";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, LogIn } from "lucide-react";
import { getSessionUser, signOut, isCloudConfigured } from "@/lib/cloud";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSessionUser().then((u) => { setUser(u); setReady(true); });
  }, []);

  if (!ready) return <div className="h-8 w-8 rounded-full bg-surface2" />;

  if (!isCloudConfigured()) {
    return (
      <div className="h-8 w-8 rounded-full grad-brand text-white grid place-items-center text-sm font-semibold shadow-card" title="Demo mode">
        W
      </div>
    );
  }

  if (!user) {
    return (
      <Link href="/login" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2">
        <LogIn className="h-4 w-4" /> Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right">
        <p className="text-xs font-medium leading-tight">{displayLogin(user.email)}</p>
        <p className="text-[10px] text-good mono leading-tight">● Cloud connected</p>
      </div>
      <div className="h-8 w-8 rounded-full grad-brand text-white grid place-items-center text-sm font-semibold shadow-card">
        {(user.email[0] ?? "W").toUpperCase()}
      </div>
      <button
        onClick={async () => { await signOut(); setUser(null); router.push("/login"); }}
        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:text-ink hover:bg-surface2"
        title="Sign out" aria-label="Sign out">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
