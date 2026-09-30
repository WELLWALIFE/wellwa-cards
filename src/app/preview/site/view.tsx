"use client";
// Renders the card saved in localStorage "vcard-preview" (written by /poster/card/build) with the real
// website renderer. Nothing is sent anywhere; the page follows the preview live when the owner changes it.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { SiteView } from "@/components/site-view";
import { PlanProvider, usePlan } from "@/lib/plan";
import { SITE_URL } from "@/lib/site-url";
import type { Card } from "@/lib/types";

const KEY = "vcard-preview";
/** The website editor (/poster/website/edit) previews under its own key, passed as ?k=, so it never
 *  collides with a V-Card build in another tab. Only letters, digits and dashes are accepted. */
function storageKey(): string {
  try { const k = new URLSearchParams(window.location.search).get("k") ?? ""; return /^[a-z0-9-]{1,40}$/i.test(k) ? k : KEY; } catch { return KEY; }
}

function readCard(): Card | null {
  try {
    const raw = localStorage.getItem(storageKey());
    const c = raw ? (JSON.parse(raw) as Card) : null;
    return c && Array.isArray(c.pages) && Array.isArray(c.links) ? c : null;
  } catch {
    return null;
  }
}

export function PreviewSite() {
  return <PlanProvider><PreviewInner /></PlanProvider>;
}

// Free plan: the website is a preview only (visitors get the card) — say so at the top, with the upgrade link.
// Growth / Pro (or a card plan set by admin): the website as visitors will see it.
function UpgradeBar() {
  const { plan, loading } = usePlan();
  if (loading || plan !== "free") return null;
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-[#12144a] px-4 py-3 text-center text-base text-white">
      <span><b>Website preview only.</b> You are on the Free plan — visitors see your card, not this website. Upgrade your account to put the website live.</span>
      <a href="/poster/plan" target="_top" className="rounded-full bg-white px-4 py-1.5 font-semibold text-[#12144a]">Upgrade now</a>
    </div>
  );
}

function PreviewInner() {
  const { plan, loading } = usePlan();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [qr, setQr] = useState("");

  const [editor, setEditor] = useState(false);
  useEffect(() => {
    const key = storageKey();
    setEditor(key !== KEY);
    setCard(readCard());
    QRCode.toDataURL(SITE_URL, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(""));
    const onStorage = (e: StorageEvent) => { if (e.key === key) setCard(readCard()); };
    // The editor sits in the parent window and posts after every change as well (storage events can lag).
    const onMessage = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data === `preview:${key}`) setCard(readCard()); };
    window.addEventListener("storage", onStorage); window.addEventListener("message", onMessage);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("message", onMessage); };
  }, []);

  if (card === undefined) return null;
  if (!card) return <div className="flex-1 grid min-h-screen place-items-center text-center text-muted">Nothing to preview</div>;
  // The key re-mounts the renderer when a new card arrives, so its page and language state start fresh.
  // The editor's preview re-renders in place (the key would reset the page and scroll on every keystroke).
  return (
    <>
      {!editor && <UpgradeBar />}
      <SiteView key={editor ? "editor" : `${card.id}-${card.username}`} card={card} qr={qr} free={loading || plan === "free"} />
    </>
  );
}
