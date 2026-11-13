"use client";
// /poster/site/plans — the website's plans and the payment (owner, 13 Nov 2026 — lib/site-order.ts). "Make my website" comes here before
// anything is made; an owner who leaves without paying comes back HERE (never to "Make my website" again); a paid order goes on to the
// thank-you page, where the website is made by itself.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { WebsitePlans } from "@/components/poster/website-plan";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";
import { SITE_INTENT_KEY, type OrderState } from "@/lib/site-order";

export default function WebsitePlansPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const { plan, loading } = usePlan();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [paidOrder, setPaidOrder] = useState(false);
  useEffect(() => { (async () => {
    if (!(await isLoggedIn())) { router.replace("/login?next=/poster/site/plans"); return; }
    const [o, s] = await Promise.all([
      api<OrderState>("/api/site/order").catch(() => null),
      api<{ cards?: { name: string }[] }>("/api/site/status").catch(() => null),
    ]);
    // Paid already (here, on another phone, or set by Shubhora): the order's own page.
    if (o?.ok && o.data.pkg) { setPaidOrder(true); router.replace(o.data.stage === "live" ? "/poster/site" : "/poster/site/order"); return; }
    if (s?.ok) setName(s.data.cards?.[0]?.name ?? "");
    setReady(true);
  })(); }, [router]);
  // An older monthly plan (Standard / Premium by autopay) already includes the website: it is made on the Make screen as before.
  useEffect(() => { if (!loading && plan !== "free" && ready && !paidOrder) router.replace("/poster/card/build?make=1"); }, [loading, plan, ready, paidOrder, router]);
  if (!ready || loading) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <WebsitePlans hi={hi} name={name || undefined}
      onClose={() => { try { localStorage.removeItem(SITE_INTENT_KEY); } catch { /* */ } router.push("/poster"); }}
      onPaid={() => { try { localStorage.removeItem(SITE_INTENT_KEY); } catch { /* */ } router.replace("/poster/site/order"); }} />
  );
}
