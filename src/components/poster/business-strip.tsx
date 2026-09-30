"use client";
// The dark line on Home (owner's call, 28 Sep 2026): just two numbers — the team that joined today and the whole team.
// Opens the Business tab. (Who is logged in shows in the header above, next to the photo.)
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Handshake } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

type Partner = { code: string; status: "red" | "green"; team: number; teamToday?: number; walletPaise: number; renewalsDue: number };
type Account = { username: string | null; partner: Partner | null };

export function BusinessStrip() {
  const [a, setA] = useState<Account | null | undefined>(undefined);
  const { lang } = useT();
  const en = lang === "en";
  useEffect(() => {
    api<Account>("/api/account").then((r) => setA(r.ok ? r.data : null)).catch(() => setA(null));
  }, []);
  if (a === undefined) return null;
  const p = a?.partner ?? null;
  const green = p?.status === "green";
  return (
    <div className="space-y-2">
      {p && (
        <Link href="/poster/business" className="flex items-center gap-3 rounded-xl bg-[#12144a] px-3 py-2.5 text-white">
          <Handshake className="h-4 w-4 shrink-0 opacity-80" />
          <span className="flex min-w-0 flex-1 items-center gap-4 text-sm">
            <span><span className="text-white/70">{en ? "Today team" : "आज की team"}</span> <span className="font-bold">{p.teamToday ?? 0}</span></span>
            <span><span className="text-white/70">{en ? "Total team" : "कुल team"}</span> <span className="font-bold">{p.team}</span></span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${green ? "bg-[#7fe3b0]/20 text-[#7fe3b0]" : "bg-[#ffb4a2]/20 text-[#ffb4a2]"}`}>{green ? "Green" : "Red"}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
        </Link>
      )}
    </div>
  );
}
