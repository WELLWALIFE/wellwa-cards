"use client";

// Share kit — everything a distributor needs to put their card in front of
// people: a high-res QR to print, a ready-made poster, and one-tap sharing.

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, MessageCircle, QrCode, Image as ImageIcon } from "lucide-react";
import type { Card } from "@/lib/types";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

export function ShareKit({ card }: { card: Card }) {
  const [url, setUrl] = useState(`${SITE}/c/${card.username}`);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"" | "qr" | "poster">("");
  const posterRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : SITE;
    setUrl(`${origin}/c/${card.username}`);
  }, [card.username]);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 512, margin: 1, color: { dark: card.themeColor, light: "#ffffff" } })
      .then(setQr).catch(() => {});
  }, [url, card.themeColor]);

  const download = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename; a.click();
  };

  async function downloadQr() {
    setBusy("qr");
    try {
      // 1024px with a quiet zone — safe for print
      const hi = await QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: card.themeColor, light: "#ffffff" } });
      download(hi, `${card.username}-qr.png`);
    } finally { setBusy(""); }
  }

  /** A printable A-series poster: name, role, QR and the link. */
  const buildPoster = useCallback(async () => {
    const W = 1200, H = 1600;
    const canvas = posterRef.current ?? document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    // header band
    const grad = ctx.createLinearGradient(0, 0, W, 420);
    grad.addColorStop(0, card.themeColor);
    grad.addColorStop(1, "#0b1214");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 420);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 68px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(card.name.slice(0, 26), W / 2, 200);
    ctx.font = "36px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.globalAlpha = 0.9;
    ctx.fillText([card.jobTitle, card.company].filter(Boolean).join(" · ").slice(0, 46), W / 2, 262);
    ctx.globalAlpha = 1;
    if (card.tagline) {
      ctx.font = "italic 30px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.globalAlpha = 0.85;
      ctx.fillText(card.tagline.slice(0, 56), W / 2, 330);
      ctx.globalAlpha = 1;
    }

    // QR
    const qrUrl = await QRCode.toDataURL(url, { width: 700, margin: 1, color: { dark: "#0b1214", light: "#ffffff" } });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = qrUrl; });
    const qs = 620;
    ctx.drawImage(img, (W - qs) / 2, 560, qs, qs);

    // caption
    ctx.fillStyle = "#0b1214";
    ctx.font = "bold 46px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Scan to save my card", W / 2, 1300);
    ctx.fillStyle = card.themeColor;
    ctx.font = "34px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, 1364);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "26px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Powered by Shubhora", W / 2, 1520);

    return canvas.toDataURL("image/png");
  }, [card, url]);

  async function downloadPoster() {
    setBusy("poster");
    try {
      const data = await buildPoster();
      if (data) download(data, `${card.username}-poster.png`);
    } finally { setBusy(""); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  }

  const waText = encodeURIComponent(`${card.name} — ${card.jobTitle}${card.company ? `, ${card.company}` : ""}\n${url}?src=whatsapp`);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 className="font-semibold flex items-center gap-2">
        <QrCode className="h-4 w-4 text-muted" /> Share kit
      </h2>
      <p className="text-sm text-muted mt-1">
        Print the QR on flyers and visiting cards, or share the link directly.
      </p>

      <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start">
        <div className="rounded-xl border border-border bg-white p-3 shrink-0">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Card QR code" className="h-32 w-32" />
          ) : <div className="h-32 w-32 grid place-items-center text-xs text-muted">…</div>}
        </div>

        <div className="flex-1 w-full space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface2/50 px-3 py-2">
            <span className="mono text-xs truncate flex-1">{url}</span>
            <button onClick={copyLink} className="ed-icon shrink-0" aria-label="Copy link">
              {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={downloadQr} disabled={busy === "qr"}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2 disabled:opacity-60">
              <Download className="h-4 w-4" /> {busy === "qr" ? "Preparing…" : "QR (PNG)"}
            </button>
            <button onClick={downloadPoster} disabled={busy === "poster"}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2 disabled:opacity-60">
              <ImageIcon className="h-4 w-4" /> {busy === "poster" ? "Building…" : "Poster"}
            </button>
          </div>

          <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--good)" }}>
            <MessageCircle className="h-4 w-4" /> Share on WhatsApp
          </a>
        </div>
      </div>

      <canvas ref={posterRef} className="hidden" />
    </section>
  );
}
