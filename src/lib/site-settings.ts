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
    // Free V-Card for the first year (then ₹1,499 a year); Growth adds the automation. Prices include GST.
    {
      name: "Growth", price: "₹2,499", period: "/month incl. GST", tagline: "Everything to run one business online", hot: true,
      features: [
        "V-Card free for 1 year, upgrade any time", "Unlimited pages & blocks", "Custom domain + SSL", "AI card builder + AI chat",
        "Lead CRM + follow-ups", "WhatsApp auto-reply", "Remove branding",
      ],
    },
    {
      name: "White label", price: "Custom", period: "pricing", tagline: "For resellers and agencies", hot: false,
      features: [
        "Everything in Pro", "Teams, sub-teams & roles", "Broadcast campaigns",
        "White-label + own billing", "Priority support",
      ],
    },
    {
      name: "Automation software", price: "Custom", period: "quote", tagline: "AI, automation & custom builds", hot: false,
      features: [
        "Workflow & WhatsApp automation", "AI assistants trained on your business",
        "CRM, portals & dashboards",
        "APIs & integrations", "Scoped in phases — pay per milestone",
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
