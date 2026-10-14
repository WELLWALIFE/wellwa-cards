"use client";
// Business → Grow: the left and right referral links. Response (mirror src/server/app-api/grow.ts):
// { handle, status: "red"|"green", links: { left, right }, plainLink, text } | { disabled: true }
import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, useBiz } from "@/components/business/kit";

type Res = { disabled?: boolean; handle: string; status: "red" | "green"; links: { left: string; right: string }; plainLink: string; text: string };

export default function GrowPage() {
  const { lang } = useT();
  const en = lang === "en";
  const { data, error, loading, reload } = useBiz<Res>("grow");
  const text = en ? "Get your own Shubhora — digital card, website, daily posters and WhatsApp AI. Free to start:" : "अपना Shubhora लें — digital card, website, रोज़ के poster और WhatsApp AI. Free में शुरू करें:";

  return (
    <BizShell title={en ? "Grow my team" : "अपनी team बढ़ाएँ"}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled ? (
          <p className={`${CARD} text-sm text-muted`}>{en ? "This page is not open right now." : "यह page अभी बंद है।"}</p>
        ) : data ? (
          <>
            <section className="rounded-2xl bg-[#12144a] p-4 text-white">
              <p className="text-base font-bold">{en ? "Two links, one for each side" : "दो link, हर side का एक"}</p>
              <p className="mt-1 text-xs text-white/75">{en ? "Share a link. Whoever makes a Shubhora account from it joins your team on that side." : "Link share करें। जो भी इससे Shubhora account बनाएगा, वो उसी side में आपकी team में आएगा।"}</p>
            </section>
            {data.status !== "green" && (
              <p className="rounded-2xl border border-border bg-surface2 p-3 text-xs text-muted">{en ? "Your ID is Red. You can build your team now, but you earn only after your plan is active." : "आपकी ID Red है। आप अभी team बना सकते हैं, पर कमाई plan चालू होने के बाद ही होगी।"}</p>
            )}
            <LinkCard label={en ? `Left team link · ${data.handle}` : `Left team link · ${data.handle}`} url={data.links.left} text={text} en={en} />
            <LinkCard label={en ? `Right team link · ${data.handle}` : `Right team link · ${data.handle}`} url={data.links.right} text={text} en={en} />
            <p className="text-[11px] text-muted">{en ? "Your digital card has the plain link at the bottom. People who join from the card go to your weaker side by themselves." : "आपके digital card के नीचे सादा link है। card से जुड़ने वाले अपने-आप कम वाली side में जाते हैं।"} <span className="font-mono">{data.plainLink.replace(/^https?:\/\//, "")}</span></p>
          </>
        ) : null}
      </BizState>
    </BizShell>
  );
}

function LinkCard({ label, url, text, en }: { label: string; url: string; text: string; en: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  async function share() {
    try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch { /* cancelled */ }
    void copy();
  }
  return (
    <section className={`${CARD} space-y-3`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="truncate rounded-lg bg-surface2 px-3 py-2 font-mono text-xs text-muted">{url.replace(/^https?:\/\//, "")}</p>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold">
          {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} {copied ? (en ? "Copied" : "Copy हुआ") : "Copy"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button type="button" onClick={share} aria-label="Share" className="grid w-11 place-items-center rounded-xl grad-brand text-white"><Share2 className="h-4 w-4" /></button>
      </div>
    </section>
  );
}
