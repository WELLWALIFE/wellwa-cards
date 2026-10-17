"use client";
// Home: the Premium upgrade for someone on a running Standard plan (owner, 17 Oct 2026). They pay only the ₹3,000 difference once;
// the Premium website page takes the payment. Free members see the Standard card instead; Premium members see nothing.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

type PlanRes = { tier: string | null; state: "none" | "active" | "grace" | "expired"; premium?: boolean };

export function PremiumUpgrade() {
  const { lang } = useT(); const en = lang === "en";
  const [r, setR] = useState<PlanRes | null>(null);
  useEffect(() => { api<PlanRes>("/api/poster/plan").then((x) => { if (x.ok) setR(x.data); }).catch(() => undefined); }, []);
  if (!r || r.premium || r.tier !== "growth" || (r.state !== "active" && r.state !== "grace")) return null;
  return (
    <Link href="/poster/site/advanced" className="block rounded-2xl border-2 border-brand bg-brand-soft/40 p-4">
      <p className="flex items-center gap-2 text-base font-bold"><Sparkles className="h-4 w-4 text-brand" /> {en ? "Upgrade to Premium" : "Premium में upgrade करें"}</p>
      <p className="mt-1 text-sm text-muted">{en ? "A bigger multi-page website and Google SEO, so customers find you. You pay only ₹3,000 more, one time. Your plan stays ₹2,999 a month." : "बड़ी multi-page website और Google SEO, ताकि ग्राहक आपको ढूँढ लें। सिर्फ़ ₹3,000 और, एक बार। आपका plan ₹2,999 / महीना ही रहेगा।"}</p>
      <span className="mt-2 inline-block rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white">{en ? "Upgrade for ₹3,000" : "₹3,000 में upgrade करें"}</span>
    </Link>
  );
}
