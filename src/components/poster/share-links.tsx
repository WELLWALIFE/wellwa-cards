"use client";
// The three links people share most (owner's call, 24 Sep 2026): the card, the LEFT join link and the RIGHT join link.
// One tap each — WhatsApp, copy, share, QR. Shown on the Share page, in the share sheet (the round share button at the
// top of every app page) and on Home.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { Check, CircleArrowLeft, CircleArrowRight, Copy, Download, IdCard, LoaderCircle, QrCode, Share2, X } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

type Res = { username: string | null; link: string | null; cardLink: string | null; promoter?: boolean };
type Item = { key: "card" | "L" | "R"; emoji: string; title: string; sub: string; url: string; text: string };

let cache: Res | null = null;
async function loadLinks(): Promise<Res | null> {
  if (cache) return cache;
  const r = await api<Res>("/api/partner/dashboard").catch(() => null);
  if (r?.ok) cache = r.data;
  return cache;
}

function withLeg(link: string, leg: "L" | "R") {
  try { const u = new URL(link); u.searchParams.set("leg", leg); return u.toString(); } catch { return `${link}${link.includes("?") ? "&" : "?"}leg=${leg}`; }
}

/** Clean icons instead of emoji (an emoji swallowed the space after it and looked unfinished). */
const ICONS = { card: IdCard, L: CircleArrowLeft, R: CircleArrowRight } as const;

function Row({ it, en }: { it: Item; en: boolean }) {
  const Icon = ICONS[it.key];
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  async function copy() { try { await navigator.clipboard.writeText(it.url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ } }
  async function more() { try { if (navigator.share) { await navigator.share({ text: it.text, url: it.url }); return; } } catch { return; } copy(); }
  async function showQr() { if (qr) { setQr(""); return; } setQr(await QRCode.toDataURL(it.url, { width: 520, margin: 1 })); }
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{it.title}</p>
          <p className="text-[11px] text-muted">{it.sub}</p>
        </div>
      </div>
      <button type="button" onClick={copy} className="flex w-full items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-left">
        <code className="min-w-0 flex-1 truncate text-xs">{it.url.replace(/^https?:\/\//, "")}</code>
        {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4 text-muted" />}
      </button>
      <div className="grid grid-cols-4 gap-1.5">
        <a href={`https://wa.me/?text=${encodeURIComponent(it.text)}`} target="_blank" rel="noreferrer"
          className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white">
          <Share2 className="h-4 w-4" /> WhatsApp
        </a>
        <button type="button" onClick={copy} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-xs font-semibold">
          {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} {copied ? (en ? "Copied" : "Copy हुआ") : "Copy"}
        </button>
        <button type="button" onClick={showQr} className="inline-flex items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-xs font-semibold">
          <QrCode className="h-4 w-4" /> QR
        </button>
      </div>
      <button type="button" onClick={more} className="w-full text-center text-[11px] font-semibold text-brand-ink">{en ? "More apps (Facebook, Instagram, SMS…) →" : "और apps (Facebook, Instagram, SMS…) →"}</button>
      {qr && (
        <div className="rounded-xl border border-border p-3 text-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code" className="mx-auto h-48 w-48" />
          <a href={qr} download={`shubhora-${it.key === "card" ? "card" : it.key === "L" ? "left" : "right"}-qr.png`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Download className="h-3.5 w-3.5" /> {en ? "Download QR" : "QR download करें"}</a>
        </div>
      )}
    </div>
  );
}

/** Share Links (owner's call, 28 Sep 2026): three tabs — LEFT join · Card · RIGHT join — and the chosen link's card
 *  (WhatsApp, copy, QR) below. Home, the Share page and the share sheet all show the same thing. */
export function ShareLinks({ compact = false, allHref }: { compact?: boolean; allHref?: string }) {
  const { lang } = useT(); const en = lang === "en";
  const [res, setRes] = useState<Res | null | undefined>(cache ?? undefined);
  const [tab, setTab] = useState<"L" | "card" | "R">("card");
  useEffect(() => { if (res === undefined) loadLinks().then(setRes); }, [res]);

  if (res === undefined) return <div className="py-6 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;
  const items: Item[] = [];
  if (res?.link) {
    const join = (leg: "L" | "R") => withLeg(res.link as string, leg);
    const msg = (u: string) => en ? `Get your own Shubhora — digital card, website, daily posters, WhatsApp AI. Free to start: ${u}` : `अपना Shubhora लें — digital card, website, रोज़ के poster, WhatsApp AI. Free में शुरू: ${u}`;
    items.push({ key: "L", emoji: "⬅️", title: en ? "Join link — LEFT team" : "Join link — LEFT team", sub: en ? "Whoever joins with this goes to your left side" : "इस link से जो जुड़ेगा वो आपकी left side में जाएगा", url: join("L"), text: msg(join("L")) });
  }
  if (res?.cardLink) items.push({
    key: "card", emoji: "📇", title: en ? "My card" : "मेरा card", sub: en ? "Your digital visiting card — for customers" : "आपका digital visiting card — customers के लिए",
    url: res.cardLink, text: en ? `Hi! Here is my digital visiting card — contact, products and more in one tap: ${res.cardLink}` : `नमस्ते! ये मेरा digital visiting card है — contact, products सब एक tap में: ${res.cardLink}`,
  });
  if (res?.link) {
    const join = (leg: "L" | "R") => withLeg(res.link as string, leg);
    const msg = (u: string) => en ? `Get your own Shubhora — digital card, website, daily posters, WhatsApp AI. Free to start: ${u}` : `अपना Shubhora लें — digital card, website, रोज़ के poster, WhatsApp AI. Free में शुरू: ${u}`;
    items.push({ key: "R", emoji: "➡️", title: en ? "Join link — RIGHT team" : "Join link — RIGHT team", sub: en ? "Whoever joins with this goes to your right side" : "इस link से जो जुड़ेगा वो आपकी right side में जाएगा", url: join("R"), text: msg(join("R")) });
  }
  if (!items.length) return <p className="text-sm text-muted">{en ? "Make your card and choose a username first — your links appear here." : "पहले card बनाएँ और username चुनें — आपके links यहाँ आएँगे।"}</p>;

  const current = items.find((i) => i.key === tab) ?? items.find((i) => i.key === "card") ?? items[0];
  const label = (k: Item["key"]) => (k === "card" ? "Card" : k === "L" ? (en ? "Left" : "Left") : (en ? "Right" : "Right"));
  return (
    <div className={compact ? "rounded-2xl border border-border bg-surface p-3 space-y-2.5" : "space-y-3"}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{en ? "Share Links" : "Share Links"}</p>
        {compact && allHref && <Link href={allHref} className="text-[11px] font-semibold text-brand-ink">{en ? "All links →" : "सारे links →"}</Link>}
      </div>
      {items.length > 1 && (
        <div className="grid gap-1 rounded-xl border border-border bg-surface2/60 p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((it) => {
            const Icon = ICONS[it.key]; const on = it.key === current.key;
            return (
              <button key={it.key} type="button" onClick={() => setTab(it.key)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${on ? "bg-surface text-ink shadow-card border border-brand" : "text-muted"}`}>
                <Icon className="h-4 w-4" /> {label(it.key)}
              </button>
            );
          })}
        </div>
      )}
      <Row it={current} en={en} />
    </div>
  );
}

/** Bottom sheet with all three links — opened by the round share button at the top of every app page. */
export function ShareSheet({ onClose }: { onClose: () => void }) {
  const { lang } = useT(); const en = lang === "en";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl bg-surface p-4 space-y-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold">{en ? "Share my links" : "मेरे links share करें"}</p>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-surface2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <ShareLinks />
      </div>
    </div>
  );
}
