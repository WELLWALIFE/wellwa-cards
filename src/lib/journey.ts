"use client";

// The setup journey every new user follows, in this order. The first six steps are free and each one reuses what
// was filled before (profile → business → products → card → website → posters); the last two run the business on
// autopilot and need the subscription.
import { useEffect, useState } from "react";
import { api } from "@/lib/poster-client";
import { fetchMyCards } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isThinCard } from "@/lib/card-facts";

export type StepKey = "you" | "business" | "products" | "card" | "website" | "poster" | "social" | "whatsapp";
export type Step = { key: StepKey; title: string; sub: string; href: string; done: boolean; premium: boolean };

export type Business = { name?: string; /** How the card leads: shop/company name, or the person (professional, agent, personal). */ role?: "business" | "professional" | "agent" | "personal"; /** How far the service goes: own city and nearby, all of India, or anywhere online. */ reach?: "local" | "india" | "online"; category?: string; gstin?: string; address?: string; city?: string; about?: string; website?: string; /** True when the name on record is the one the owner's website gave (see SetupInfo.nameFromSite). */ nameFromSite?: boolean; categoryFromSite?: boolean; aboutFromSite?: boolean; /** Exact Google Maps link from the "pin it" button, e.g. https://maps.google.com/?q=26.912434,75.787271 */ map?: string };

/** `refreshKey` (e.g. the current path) re-reads the steps when it changes, so progress stays current. */
export function useJourney(refreshKey?: string) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      const { data: { session } } = (await sb?.auth.getSession()) ?? { data: { session: null } };
      if (!session) { setSteps([]); return; }       // signed out: no journey
      const [user, profiles, products, cards, soc, wa] = await Promise.all([
        sb?.auth.getUser().then((r) => r.data.user).catch(() => null) ?? null,
        api<{ profiles?: { name: string; phone?: string; photo_url?: string | null; is_default?: boolean }[] }>("/api/poster/profiles").catch(() => null),
        api<{ products?: unknown[] }>("/api/poster/products").catch(() => null),
        fetchMyCards().catch(() => []),
        api<{ accounts?: { provider: string; is_active?: boolean }[] }>("/api/social/accounts").catch(() => null),
        fetch("/api/wa/status", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; business?: Business };
      const profile = profiles?.data.profiles?.find((p) => p.is_default) ?? profiles?.data.profiles?.[0];
      const s: Step[] = [
        // Once done, "About you" is where name / mobile / photo are changed: Save there updates every place and comes back here.
        { key: "you", title: "About you", sub: "Your name, mobile and photo", href: (meta.display_name || meta.full_name) && profile?.phone ? "/poster/onboard?step=you&back=/poster/setup" : "/poster/onboard?step=you", premium: false, done: !!((meta.display_name || meta.full_name) && profile?.phone) },
        { key: "business", title: "Your business", sub: "Have a website? Its link fills name, logo and products; else just trade, name and city", href: "/poster/onboard?step=site", premium: false, done: !!(meta.business?.category || meta.business?.name) },
        { key: "products", title: "Products or services", sub: "Photos and prices — shown on your V-Card, website and posters", href: "/poster/products", premium: false, done: (products?.data.products?.length ?? 0) > 0 },
        // Done only when a real card exists — not an untouched "Your Name" draft or an empty one-tap card.
        { key: "card", title: "Your V-Card", sub: "Your digital visiting card — the AI makes it from your details", href: "/poster/site", premium: false, done: cards.some((c) => !isThinCard(c)) },
        // The website is the same card shown on computers: publishing the V-Card turns it on.
        { key: "website", title: "Your website", sub: "Turns on with your V-Card — have a look", href: "/poster/site", premium: false, done: cards.some((c) => !!c.site?.enabled) },
        { key: "poster", title: "Daily posters", sub: "A new poster with your name every morning", href: "/poster", premium: false, done: !!profile },
        { key: "social", title: "Auto-post to Facebook & Instagram", sub: "Your posters post themselves", href: "/poster/social", premium: true, done: !!(soc?.data.accounts ?? []).find((a) => a.provider === "facebook" && a.is_active) },
        { key: "whatsapp", title: "WhatsApp AI assistant", sub: "Answers customers 24×7 and saves every lead", href: "/poster/leads", premium: true, done: wa?.state === "connected" },
      ];
      setSteps(s);
    })();
  }, [refreshKey]);
  const done = steps?.filter((s) => s.done).length ?? 0;
  const next = steps?.find((s) => !s.done) ?? null;
  // The free part (profile → posters) is what every account should finish; the paid steps stay optional.
  const free = steps?.filter((s) => !s.premium) ?? [];
  const freeDone = free.filter((s) => s.done).length;
  const nextFree = free.find((s) => !s.done) ?? null;
  // "Previous" = the step before the screen the owner is on (e.g. on the card screen → products). On any other
  // screen it is the step before the next unfinished one.
  const here = refreshKey ? free.findIndex((s) => refreshKey === s.href.split("?")[0] || (s.href !== "/poster" && refreshKey.startsWith(s.href.split("?")[0] + "/"))) : -1;
  const prevFree = here > 0 ? free[here - 1] : here === 0 ? null : nextFree ? free[free.indexOf(nextFree) - 1] ?? null : null;
  // "Continue" goes forward from the screen the owner is on (products → V-Card → website …), else to the first unfinished step.
  const ahead = here >= 0 ? free.slice(here + 1).find((s) => !s.done) ?? null : null;
  const continueTo = ahead ?? nextFree;
  return { steps, done, total: steps?.length ?? 8, next, freeDone, freeTotal: free.length || 6, nextFree, prevFree, continueTo };
}
