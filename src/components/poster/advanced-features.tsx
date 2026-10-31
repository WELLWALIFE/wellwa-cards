"use client";
// "Advanced features" (owner, 30 Oct 2026): modules customised for one kind of business and paid separately — see
// src/lib/addons.ts. Shown to every account whose business they suit (owner, 31 Oct 2026: Standard and Premium both see the
// customise option; a Standard account is asked to upgrade), so a tailor on Standard sees what the boutique module does and
// where to get it. Everyone else sees nothing here, so a simple account stays simple. A tailor who works in a shop that has
// Orders on gets the link too. Three states per feature: ON → open it; Premium, not on → ask the price; not Premium → upgrade.
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronRight, Lock, MessageCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/poster-client";
import { ADDONS, addonWaText, type AddonsAnswer } from "@/lib/addons";
import { waLink } from "@/lib/site-brand";
import { CUSTOM_DAYS } from "@/lib/site-ready";
import { ADVANCED_HREF } from "@/components/poster/advanced-entry";

export function AdvancedFeatures({ hi, className = "" }: { hi: boolean; className?: string }) {
  const [d, setD] = useState<AddonsAnswer | null>(null);
  useEffect(() => { void api<AddonsAnswer>("/api/poster/addons").then((r) => { if (r.ok) setD(r.data); }); }, []);
  if (!d) return null;
  const T = (en: string, h: string) => (hi ? h : en);
  const items = d.list.map((s) => ({ ...s, a: ADDONS.find((x) => x.key === s.key)! })).filter((x) => x.a);
  const ownOrders = items.some((x) => x.key === "orders" && x.on);
  if (!items.length && !d.teamOrders) return null;
  const orders = ADDONS.find((x) => x.key === "orders")!;
  const primary = "inline-flex w-full items-center justify-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white";
  const secondary = "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold";
  return (
    <section className={`space-y-2 rounded-2xl border border-[#c9a227]/40 bg-gradient-to-br from-[#fffaf0] to-surface p-4 shadow-card ${className}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#c9a227] to-[#e0b84a] text-white"><Sparkles className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-bold">{T("Advanced features", "Advanced features")}</p>
          <p className="text-[11px] text-muted">{T("Made for your kind of business · customised for you", "आपके business के लिए · आपके हिसाब से customise")}</p>
        </div>
      </div>
      {items.map(({ key, on, a }) => on ? (
        <Link key={key} href={a.href} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <span className="text-xl">{a.emoji}</span>
          <span className="min-w-0 flex-1"><b className="block text-sm">{hi ? a.hi : a.en}</b><span className="block text-[11px] text-muted">{hi ? a.descHi : a.descEn}</span></span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      ) : (
        <div key={key} className="space-y-2.5 rounded-xl border border-dashed border-border bg-surface p-3">
          <div className="flex items-start gap-3">
            <span className="text-xl">{a.emoji}</span>
            <span className="min-w-0 flex-1">
              <b className="flex items-center gap-1 text-sm">{hi ? a.hi : a.en} <Lock className="h-3.5 w-3.5 text-muted" /></b>
              <span className="block text-[11px] text-muted">{hi ? a.descHi : a.descEn}</span>
            </span>
          </div>
          {/* What they would get: the owner sees the module before asking for it (owner, 31 Oct 2026: "aise option user ko dikh jaaye"). */}
          <ul className="space-y-1">
            {a.points.map(([en, h]) => <li key={en} className="flex items-start gap-1.5 text-xs"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" /> <span>{T(en, h)}</span></li>)}
          </ul>
          {d.premium ? (
            <>
              <a href={waLink(addonWaText(a, true))} target="_blank" rel="noopener noreferrer" className={primary}><MessageCircle className="h-4 w-4" /> {T("Get it customised — ask the price", "अपने हिसाब से बनवाएँ — price पूछें")}</a>
              <Link href={a.guide} className={secondary}><BookOpen className="h-3.5 w-3.5 text-brand" /> {T("See how it works", "कैसे चलता है, देखें")}</Link>
              <p className="text-center text-[10px] text-muted">{T(`Set up for your shop by Shubhora within ${CUSTOM_DAYS} days · charged separately`, `Shubhora आपकी दुकान के लिए ${CUSTOM_DAYS} दिन में set करेगा · charge अलग से`)}</p>
            </>
          ) : (
            <>
              {/* Not Premium yet: the module comes with Premium, so the first step is the upgrade (the Premium page knows what they pay). */}
              <Link href={ADVANCED_HREF} className={primary}><Sparkles className="h-4 w-4" /> {T("Upgrade to Premium to get it", "Premium लें, फिर ये मिलेगा")}</Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href={a.guide} className={secondary}><BookOpen className="h-3.5 w-3.5 text-brand" /> {T("How it works", "कैसे चलता है")}</Link>
                <a href={waLink(addonWaText(a, false))} target="_blank" rel="noopener noreferrer" className={secondary}><MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> {T("Ask the price", "Price पूछें")}</a>
              </div>
              <p className="text-center text-[10px] text-muted">{T(`Comes with Premium · set up for your shop within ${CUSTOM_DAYS} days · charged separately`, `Premium के साथ · ${CUSTOM_DAYS} दिन में आपकी दुकान के लिए set · charge अलग से`)}</p>
            </>
          )}
        </div>
      ))}
      {d.teamOrders && !ownOrders && (
        <Link href={orders.href} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <span className="text-xl">{orders.emoji}</span>
          <span className="min-w-0 flex-1"><b className="block text-sm">{hi ? orders.hi : orders.en}</b><span className="block text-[11px] text-muted">{T("The jobs of the shop you work in", "जिस दुकान में आप काम करते हैं, उसके job")}</span></span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}
    </section>
  );
}
