"use client";
// The website of a test link: the card wearing one design, rendered by the real website renderer (the same way /preview/site does from localStorage).
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SiteView } from "@/components/site-view";
import { SITE_URL } from "@/lib/site-url";
import type { Card } from "@/lib/types";
import { isShubhoraSellerCard, withoutFreeCard, withoutShubhoraLeaks } from "@/lib/shubhora-page";
import { withQuality } from "@/lib/site-quality";
import { activeAdvanced, advancedItemStubs, withAdvancedPages } from "@/lib/site-advanced";

export function TestSite({ card, name, n, of }: { card: Card; name: string; n: number; of: number }) {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(SITE_URL, { width: 320, margin: 1 }).then(setQr).catch(() => setQr("")); }, []);
  const shown = useMemo(() => {
    // Drawn exactly as the live website draws it (app/c/[username]/render.tsx): the partner's home order, the new banners and
    // pictures, the website check's fixes. Without this a test link showed the stored card as it was (old pictures, no plans on home).
    const seller = isShubhoraSellerCard(card);
    const base = withQuality(withoutFreeCard(seller ? card : withoutShubhoraLeaks(card), seller));
    if (!activeAdvanced(base.site, base.username)) return base;
    const withPages = withAdvancedPages(base);
    return { ...withPages, pages: [...withPages.pages, ...advancedItemStubs(withPages)] };
  }, [card]);
  return (
    <>
      <div className="sticky top-0 z-50 bg-[#12144a] px-3 py-1.5 text-center text-[12px] font-semibold text-white">Design {n} of {of}: {name} — test link</div>
      <SiteView card={shown} qr={qr} free={false} initialLang={card.language === "hi" ? "hi" : "en"} unlisted={shown.pages.filter((p) => p.hidden && p.id.startsWith("adv-")).map((p) => p.slug)} />
    </>
  );
}
