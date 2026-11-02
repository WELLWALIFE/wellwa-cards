"use client";
// /poster/site/plans — "Your V-Card is ready" → "Continue to your website": Standard and Premium with everything each gives, one to pick,
// Razorpay, then the receipt and "Make my website now" (owner, 2 Nov 2026: "ek line — your V-Card is ready, view; fir continue website,
// Standard aur Premium, dono me kya kya hai, select kare to payment — professional"). Card & Website sends free accounts here.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { WebsitePlans, PaidReceipt } from "@/components/poster/website-plan";
import type { PaidInfo } from "@/components/subscribe-button";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";
import { withView } from "@/lib/site-url";

export default function WebsitePlansPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const { plan, loading, refresh } = usePlan();
  const [card, setCard] = useState<{ url: string; name: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [paid, setPaid] = useState<PaidInfo | null | undefined>(undefined);
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/site/plans"); return; }
    const r = await api<{ hasCard?: boolean; url?: string; customDomain?: string; cards?: { name: string }[] }>("/api/site/status").catch(() => null);
    if (r?.ok && r.data.hasCard) setCard({ url: r.data.customDomain ? `https://${r.data.customDomain}` : r.data.url ?? "", name: r.data.cards?.[0]?.name ?? "" });
    else { router.replace("/poster/onboard"); return; }   // no card yet: the set-up makes it first
    setReady(true);
  })(); }, [router]);
  // Already on a plan (and not just paid here): the website is made straight away.
  useEffect(() => { if (!loading && plan !== "free" && paid === undefined && ready) router.replace("/poster/card/build?make=1"); }, [loading, plan, paid, ready, router]);
  if (!ready || loading) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (paid !== undefined) return <PaidReceipt hi={hi} paid={paid} onGo={() => router.push("/poster/card/build?make=1")} />;
  return (
    <WebsitePlans hi={hi} name={card?.name} cardHref={card ? withView(card.url, "card") : undefined}
      onClose={() => router.push("/poster/site")} onPaid={(p) => { void refresh(); setPaid(p); try { window.scrollTo({ top: 0 }); } catch { /* */ } }} />
  );
}
