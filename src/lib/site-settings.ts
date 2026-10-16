"use client";

// Platform-level settings the owner edits from /admin.
// Stored in localStorage until Supabase; marketing pages read overrides client-side.

export interface PlanDef {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  hot: boolean;
}

export interface SiteSettings {
  heroTitle: string;
  heroHighlight: string; // the gradient part
  heroSub: string;
  introVideoUrl: string; // YouTube/Vimeo/mp4; empty = placeholder
  announcement: string; // empty = hidden
  plans: PlanDef[];
}

export const defaultSettings: SiteSettings = {
  heroTitle: "The business card that",
  heroHighlight: "sells for you",
  heroSub:
    "Build a stunning digital card in minutes. It captures every lead, scores them with AI, and replies on WhatsApp automatically — around the clock.",
  introVideoUrl: "",
  announcement: "",
  plans: [
    // Free = the digital card only (free for 1 year, then ₹1,499 a year). Standard / Premium / Custom, as on the pricing page (owner, 16 Oct 2026). Prices include GST.
    {
      name: "Standard", price: "₹2,999", period: "/month incl. GST", tagline: "Card, website, daily posters and WhatsApp AI", hot: false,
      features: [
        "Digital business card on one link", "Standard website (up to 5 pages)", "With a sub-domain address",
        "Daily poster on Facebook, Instagram and WhatsApp Status", "Meta Ads (Facebook and Instagram)",
        "WhatsApp AI assistant that answers customers and filters leads", "AI Ad Studio and Reel Maker",
        "Google reviews and Google Business posts", "Works in 12 Indian languages", "WhatsApp AI replies, up to 1,000 a month (fair use)",
      ],
    },
    {
      name: "Premium", price: "₹5,999", period: "first month only, then ₹2,999 a month", tagline: "Standard plus a multi-page website and Google SEO", hot: true,
      features: [
        "Everything in Standard", "Premium website, multiple pages",
        "Google SEO: every page and product on Google, with schema and a sitemap", "Try up to 3 layouts and keep the one you like",
      ],
    },
    {
      name: "Custom Solutions", price: "On request", period: "quoted per requirement", tagline: "Every kind of software and automation", hot: false,
      features: [
        "Custom software, apps and websites built for your business",
        "Daily work done by itself: WhatsApp, customers, follow-ups, billing and reports",
        "Your own CRM and business software, with screens for your numbers and logins for your team",
        "AI assistants and chat bots taught about your business",
        "Works with the tools you already use: online payments, Tally, Google Sheets",
        "A manager from Shubhora just for you",
      ],
    },
  ],
};

const KEY = "wellwa-site-settings";

export function loadSettings(): SiteSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    // Plans always come from code: browsers that saved settings before the
    // free tier was removed would otherwise keep showing a "Free ₹0" card
    // that no longer exists. (localStorage is per-browser anyway — it never
    // reached real visitors.)
    const { plans: _stale, ...rest } = JSON.parse(raw) as Partial<SiteSettings>;
    return { ...defaultSettings, ...rest, plans: defaultSettings.plans };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: SiteSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
