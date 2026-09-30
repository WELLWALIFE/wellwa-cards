"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, ChevronLeft, Share2, BarChart3 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";

type R = { days: number; posters: number; posts: { facebook: number; instagram: number; whatsapp: number }; reach: number | null; leads: number; leadsHot: number; videos: number; learned: number; calendarPlanned: number };
export default function ReportPage() {
  const router = useRouter(); const { lang } = useT(); const hi = lang !== "en";
  const [days, setDays] = useState(30);
  const [d, setD] = useState<{ report: R; text: string } | null>(null);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.push("/login?next=/poster/report"); return; } setD(null); const r = await api<{ report: R; text: string }>(`/api/poster/report?days=${days}`); if (r.ok) setD(r.data); })(); }, [router, days]);
  const tile = (l: string, v: string | number, sub?: string) => <div className="rounded-xl border border-border p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted">{l}{sub ? ` · ${sub}` : ""}</p></div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Link href="/poster/more" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link><h1 className="text-lg font-bold flex-1 flex items-center gap-1.5"><BarChart3 className="h-5 w-5 text-brand" /> {hi ? "Marketing report" : "Marketing report"}</h1></div>
      <Guide hi="आपकी marketing का हिसाब — कितने poster, post, reach, leads। हर महीने की 1 तारीख को WhatsApp पर भी आता है।" en="Your marketing scorecard — posters, posts, reach, leads. Also sent to WhatsApp on the 1st of every month." />
      <div className="flex gap-2">{[7, 30, 90].map((n) => <button key={n} type="button" onClick={() => setDays(n)} className={`rounded-full border px-3 py-1.5 text-sm ${days === n ? "border-brand bg-brand-soft text-brand-ink font-semibold" : "border-border"}`}>{n} {hi ? "दिन" : "days"}</button>)}</div>
      {!d ? <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {tile(hi ? "Posters बने" : "Posters made", d.report.posters)}
            {tile(hi ? "Posts हुईं" : "Posts published", d.report.posts.facebook + d.report.posts.instagram + d.report.posts.whatsapp, `FB ${d.report.posts.facebook} · IG ${d.report.posts.instagram} · Status ${d.report.posts.whatsapp}`)}
            {tile(hi ? "Facebook reach" : "Facebook reach", d.report.reach === null ? "—" : d.report.reach.toLocaleString("en-IN"))}
            {tile(hi ? "नई leads" : "New leads", d.report.leads, `hot ${d.report.leadsHot}`)}
            {tile(hi ? "Video ads" : "Video ads", d.report.videos)}
            {tile(hi ? "Bot ने सीखा" : "Bot learned", d.report.learned)}
          </div>
          <p className="text-xs text-muted">{hi ? `आगे ${d.report.calendarPlanned} दिन planned हैं। हर महीने की 1 तारीख को ये report आपके WhatsApp पर भी आएगी।` : `${d.report.calendarPlanned} days planned ahead. This report is also sent to your WhatsApp on the 1st of every month.`}</p>
          <button type="button" onClick={() => { const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }; if (nav.share) nav.share({ text: d.text }).catch(() => {}); else window.open(`https://wa.me/?text=${encodeURIComponent(d.text)}`, "_blank"); }} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white"><Share2 className="h-4 w-4" /> {hi ? "Report share करें" : "Share report"}</button>
        </>
      )}
    </div>
  );
}
