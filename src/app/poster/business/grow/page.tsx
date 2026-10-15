"use client";
// Business → Grow: the left and right referral links. Response (mirror src/server/app-api/grow.ts):
// { handle, status: "red"|"green", links: { left, right }, plainLink, text, qr: { left, right } (small PNG data URLs, may be null) } | { disabled: true }
import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, useBiz } from "@/components/business/kit";

type Res = { disabled?: boolean; handle: string; status: "red" | "green"; links: { left: string; right: string }; plainLink: string; text: string; qr?: { left: string | null; right: string | null } };

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
            <LinkCard label={`Left side link · ${data.handle}`} url={data.links.left} qr={data.qr?.left} text={text} en={en} />
            <LinkCard label={`Right side link · ${data.handle}`} url={data.links.right} qr={data.qr?.right} text={text} en={en} />
            <p className="text-[11px] text-muted">{en ? "Your digital card has the plain link at the bottom. People who join from the card go to your weaker side by themselves." : "आपके digital card के नीचे सादा link है। card से जुड़ने वाले अपने-आप कम वाली side में जाते हैं।"} <span className="font-mono">{data.plainLink.replace(/^https?:\/\//, "")}</span></p>
          </>
        ) : null}
      </BizState>
    </BizShell>
  );
}

function LinkCard({ label, url, qr, text, en }: { label: string; url: string; qr?: string | null; text: string; en: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false); // the phone refused the copy: say so right under the buttons
  async function copy() { setCopyErr(false); try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopyErr(true); } }
  async function share() {
    setCopyErr(false);
    try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch { /* cancelled */ }
    void copy();
  }
  return (
    <section className={`${CARD} space-y-3`}>
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        {qr && /^data:image\/png;base64,/.test(qr) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={en ? "QR code of this link" : "इस link का QR code"} width={144} height={144} className="h-36 w-36 shrink-0 rounded-xl border border-border bg-white" />
        )}
        <div className="w-full min-w-0 flex-1 space-y-1">
          <p className="break-all rounded-lg bg-surface2 px-3 py-2 font-mono text-xs text-muted">{url.replace(/^https?:\/\//, "")}</p>
          {qr && <p className="text-[11px] text-muted">{en ? "Show this code to a person. They scan it with the phone camera and the link opens." : "यह code किसी को दिखाएँ। वे phone के camera से scan करें तो link खुल जाएगा।"}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold">
          {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} {copied ? (en ? "Copied" : "Copy हो गया") : "Copy"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button type="button" onClick={share} aria-label={en ? "Share" : "Share करें"} className="grid w-11 place-items-center rounded-xl grad-brand text-white"><Share2 className="h-4 w-4" /></button>
      </div>
      {copyErr && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="status">{en ? "Could not copy. Press and hold the link above to copy it." : "Copy नहीं हो पाया। ऊपर का link दबाकर रखें और खुद copy करें।"}</p>}
    </section>
  );
}
