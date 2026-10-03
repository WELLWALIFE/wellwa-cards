"use client";
// "My website" moved into "Card & Website" (/poster/site, 3 Oct 2026): one link, one screen.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export default function WebsiteRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace(`/poster/site${typeof window !== "undefined" ? window.location.search : ""}`); }, [router]);
  return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
}
