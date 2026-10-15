"use client";

// The setup journey every new user follows, in the order the app really walks it (owner, 15 Oct 2026: Back / Previous / Continue
// must agree with the screens): About you → Your business → V-Card (the "Make" screen) → website (same card, shown on computers) →
// products or services (added later, from Card & Website → Edit) → daily posters. The first six steps are free and each one reuses
// what was filled before; the last two run the business on autopilot and need the subscription.
import { useEffect, useState } from "react";
import { api } from "@/lib/poster-client";
import { fetchMyCards } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isThinCard } from "@/lib/card-facts";
import { SETUP_SCREENS, isScreenKey, screenHref, type ScreenKey } from "@/lib/setup-steps";

export type StepKey = "you" | "business" | "products" | "card" | "website" | "poster" | "social" | "whatsapp";
export type Step = { key: StepKey; title: string; titleHi: string; sub: string; subHi: string; href: string; done: boolean; premium: boolean };

export type Business = { name?: string; /** The card's link: the business name or the person's own (onboarding, "Your card link"). */ linkBy?: "name" | "business"; /** The trade in the owner's own words when the list had no fit (category "other"): "collage", "drone repair". */ trade?: string; /** How the card leads: shop/company name, or the person (professional, agent, personal). */ role?: "business" | "professional" | "agent" | "personal"; /** How far the service goes: own city and nearby, all of India, or anywhere online. */ reach?: "local" | "india" | "online"; category?: string; gstin?: string; address?: string; city?: string; about?: string; website?: string; /** True when the name on record is the one the owner's website gave (see SetupInfo.nameFromSite). */ nameFromSite?: boolean; categoryFromSite?: boolean; aboutFromSite?: boolean; /** Exact Google Maps link from the "pin it" button, e.g. https://maps.google.com/?q=26.912434,75.787271 */ map?: string };

/** The journey step a set-up screen belongs to: the "you" screens are About you, the business screens are Your business, and the
 *  products / Make screens are the V-Card (the Make screen builds it). */
const stepOfScreen = (k: ScreenKey): StepKey => {
  const chapter = SETUP_SCREENS.find((s) => s.key === k)?.chapter;
  return chapter === "you" ? "you" : chapter === "business" ? "business" : "card";
};
const pathOf = (href: string) => href.split("?")[0];
/** Is the owner on this step's own screen (its page, or a page under it)? "/poster" is the Home screen only, not every page of the app. */
const onStep = (s: Step, cur: string) => { const p = pathOf(s.href); return cur === p || (p !== "/poster" && cur.startsWith(p + "/")); };

/** `refreshKey` (e.g. the current path) re-reads the steps when it changes, so progress stays current, and tells the hook which screen
 *  the owner is on (for `continueTo` / `prevFree`). `backTo`: where the "About you" screen returns to once it is done and only being
 *  edited (a simple in-app path; the default is the set-up list, the desktop dashboard passes its own). */
export function useJourney(refreshKey?: string, backTo = "/poster/setup") {
  const [steps, setSteps] = useState<Step[] | null>(null);
  /** The set-up screen the owner left off on (setup_pos on the account), until the card is live, and the step it belongs to. */
  const [resume, setResume] = useState<{ href: string; key: StepKey } | null>(null);
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
      const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; business?: Business; setup_pos?: unknown };
      const profile = profiles?.data.profiles?.find((p) => p.is_default) ?? profiles?.data.profiles?.[0];
      const realCard = cards.some((c) => !isThinCard(c));
      // The screen the owner left the set-up on counts only while there is no real card; the step it belongs to is still in progress.
      const resumeScreen = isScreenKey(meta.setup_pos) && !realCard ? meta.setup_pos : null;
      const resumeKey = resumeScreen ? stepOfScreen(resumeScreen) : null;
      const youDone = !!((meta.display_name || meta.full_name) && profile?.phone);
      const s: Step[] = [
        // Once done, "About you" is where name / mobile / photo are changed: Save there updates every place and comes back to `backTo`.
        { key: "you", title: "About you", titleHi: "आपके बारे में", sub: "Your name, mobile and photo", subHi: "आपका नाम, mobile और photo", href: youDone && resumeKey !== "you" ? `/poster/onboard?step=you&back=${backTo}` : "/poster/onboard?step=you", premium: false, done: youDone && resumeKey !== "you" },
        { key: "business", title: "Your business", titleHi: "आपका business", sub: "Have a website? Its link fills in your name, logo and products. If not, just tell us your kind of work, name and city", subHi: "Website है? उसका link आपका नाम, logo और products भर देगा। नहीं है तो बस अपना काम, नाम और शहर बताएँ", href: "/poster/onboard?step=site", premium: false, done: !!(meta.business?.category || meta.business?.name) && resumeKey !== "business" },
        // Done only when a real card exists — not an untouched "Your Name" draft or an empty one-tap card. Until then it opens the Make screen.
        { key: "card", title: "Your V-Card", titleHi: "आपका V-Card", sub: "Your digital visiting card — the AI makes it from your details", subHi: "आपका digital visiting card — AI आपकी जानकारी से बनाता है", href: realCard ? "/poster/site" : screenHref("make"), premium: false, done: realCard },
        // The website is the same card shown on computers: publishing the V-Card turns it on.
        { key: "website", title: "Your website", titleHi: "आपकी website", sub: "Turns on with your V-Card — have a look", subHi: "आपके V-Card के साथ चालू हो जाती है — एक बार देखें", href: "/poster/site", premium: false, done: cards.some((c) => !!c.site?.enabled) },
        // Products come after the website now: nobody has the photos and prices ready while signing up (owner, 14 Oct 2026). Until a real card exists the Make screen takes its place.
        { key: "products", title: "Products or services", titleHi: "Products या services", sub: "Photos and prices — shown on your V-Card, website and posters", subHi: "Photos और दाम — आपके V-Card, website और posters पर दिखते हैं", href: realCard ? "/poster/products" : screenHref("products"), premium: false, done: (products?.data.products?.length ?? 0) > 0 },
        { key: "poster", title: "Daily posters", titleHi: "रोज़ के posters", sub: "A new poster with your name every morning", subHi: "हर सुबह आपके नाम के साथ नया poster", href: "/poster", premium: false, done: !!profile },
        { key: "social", title: "Auto-post to Facebook & Instagram", titleHi: "Facebook और Instagram पर auto-post", sub: "Your posters post themselves", subHi: "आपके posters अपने-आप post होते हैं", href: "/poster/social", premium: true, done: !!(soc?.data.accounts ?? []).find((a) => a.provider === "facebook" && a.is_active) },
        { key: "whatsapp", title: "WhatsApp AI assistant", titleHi: "WhatsApp AI assistant", sub: "Answers your customers day and night and saves their details", subHi: "ग्राहकों को दिन-रात जवाब देता है और उनकी जानकारी सहेजता है", href: "/poster/leads", premium: true, done: wa?.state === "connected" },
      ];
      setSteps(s);
      setResume(resumeScreen && resumeKey ? { href: screenHref(resumeScreen), key: resumeKey } : null);
    })();
  }, [refreshKey, backTo]);
  const done = steps?.filter((s) => s.done).length ?? 0;
  const next = steps?.find((s) => !s.done) ?? null;
  // The free part (profile → posters) is what every account should finish; the paid steps stay optional.
  const free = steps?.filter((s) => !s.premium) ?? [];
  const freeDone = free.filter((s) => s.done).length;
  const nextFree = free.find((s) => !s.done) ?? null;
  const cur = refreshKey ?? "";
  // "Continue" = the next thing still to do, never the screen the owner is already on. The exact set-up screen the owner left (owner's
  // call, 7 Oct 2026) wins; otherwise the first unfinished step — the order is the real set-up order, so an unfinished step BEHIND
  // the owner (e.g. no V-Card yet) is a prerequisite and comes first.
  const resumeStep = resume ? free.find((s) => s.key === resume.key) ?? null : null;
  const continueTo = resumeStep ?? free.find((s) => !s.done && !(cur && onStep(s, cur))) ?? null;
  const continueHref = resumeStep && resume ? resume.href : continueTo?.href ?? null;
  // "Previous" itself is the browser's own Back (goBack); this is only where it falls back to when the app has no earlier screen:
  // the step before the one the owner is on, and never the page Continue opens.
  const here = cur ? free.findIndex((s) => onStep(s, cur)) : -1;
  const prevFree = here > 0 ? free.slice(0, here).reverse().find((s) => !onStep(s, cur) && pathOf(s.href) !== pathOf(continueHref ?? "")) ?? null : null;
  return { steps, done, total: steps?.length ?? 8, next, freeDone, freeTotal: free.length || 6, nextFree, prevFree, continueTo, continueHref, resumeHref: resume?.href ?? null };
}
