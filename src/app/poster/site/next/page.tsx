"use client";
// "Complete your website" used to be its own list of six steps, counted differently from the editor (owner, 26 Oct 2026: "ek hi ginti").
// It now opens the editor, whose list shows what is still empty on top — the one count used everywhere (lib/edit-status.ts).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { fetchMyCardsStrict } from "@/lib/cloud";
import { editHref, lastEdit } from "@/lib/edit-nav";

export default function SiteNextPage() {
  const router = useRouter();
  useEffect(() => {
    fetchMyCardsStrict()
      .then((cs) => { const c = cs[0]; router.replace(c ? editHref(lastEdit() ?? (c.site?.enabled ? "site" : "card")) : "/poster/card/build"); })
      .catch(() => router.replace("/poster/site"));
  }, [router]);
  return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
}
