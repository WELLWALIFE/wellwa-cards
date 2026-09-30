"use client";
// One quiet line under the day's poster: what is left today, and the one thing Growth would add.
// Never a wall — a free user reads it in two seconds and keeps using the app.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, MessageCircle } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";

type PlanRes = { tier: string | null; state: "none" | "active" | "grace" | "expired"; days_left: number; credits: { total: number }; trial: { days_left: number; expired: boolean } | null };

export function PremiumLine({ plan, used, limit }: { plan?: string; used?: number; limit?: number | null }) {
  const { lang } = useT(); const en = lang === "en";
  const cardPlan = usePlan();
  const [r, setR] = useState<PlanRes | null>(null);
  useEffect(() => { api<PlanRes>("/api/poster/plan").then((x) => { if (x.ok) setR(x.data); }).catch(() => {}); }, []);
  if (!r || cardPlan.loading) return null;
  // Paid either way: a Growth / Pro subscription, or a card plan (pro / team, incl. one set by admin or a running trial).
  const paid = r.state === "active" || r.state === "grace" || cardPlan.plan !== "free";
  const credits = r.credits?.total ?? 0;

  if (paid) return (
    <p className="text-center text-xs text-muted">{en ? `${credits} credits left` : `${credits} credits बचे`}{r.state === "grace" || (cardPlan.isTrial && cardPlan.daysLeft <= 7) ? <> · <Link href="/poster/plan" className="text-brand-ink">{en ? "renew" : "renew करें"}</Link></> : null}</p>
  );

  // WhatsApp AI trial running: say so — it is the thing they will miss most when it ends.
  if (r.trial && !r.trial.expired) return (
    <Link href="/poster/guide/whatsapp" className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand-soft/40 px-3 py-2 text-xs text-brand-ink">
      <MessageCircle className="h-4 w-4 shrink-0" />
      <span>{en ? `WhatsApp AI trial — ${r.trial.days_left} day${r.trial.days_left === 1 ? "" : "s"} left. Customers get replies even while you sleep; keep it with Growth.` : `WhatsApp AI trial — ${r.trial.days_left} दिन बाकी। आपके सोते हुए भी customers को जवाब मिलता है; Growth में यह चलता रहेगा।`}</span>
    </Link>
  );

  const day = plan === "free" && limit ? (en ? `Today's poster ${used ?? 1}/${limit} · free` : `आज का poster ${used ?? 1}/${limit} · free`) : null;
  const rest = credits > 0
    ? (en ? `${credits} credits left` : `${credits} credits बचे`)
    : (en ? "0 credits left" : "0 credits बचे");
  return (
    <Link href="/poster/plan" className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
      <Sparkles className="h-4 w-4 shrink-0 text-brand" />
      <span>{[day, rest].filter(Boolean).join(" · ")} — <span className="font-semibold text-brand-ink">{"Growth ₹2,999:"}</span> {en ? "no watermark, voice in videos, tomorrow's poster today, auto-post, website." : "बिना watermark, video में आवाज़, कल का poster आज, auto-post, website।"}</span>
    </Link>
  );
}
