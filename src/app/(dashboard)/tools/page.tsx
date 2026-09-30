"use client";
import { SITE_URL } from "@/lib/site-url";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Check, Download, Mail, Monitor } from "lucide-react";
import { sampleCards } from "@/lib/sample-data";
import type { Card } from "@/lib/types";
import { fetchMyCards } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function ToolsPage() {
  // Only the signed-in user's own cards (samples appear in demo mode only).
  const [myCards, setMyCards] = useState<Card[] | null>(null);
  const [cardId, setCardId] = useState("");

  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      const list = sb ? await fetchMyCards() : sampleCards;
      setMyCards(list);
      setCardId((id) => id || list[0]?.id || "");
    })();
  }, []);

  const card = myCards?.find((c) => c.id === cardId) ?? myCards?.[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="text-muted mt-1">Turn your card into an email signature and a meeting background.</p>
      </div>

      {!card ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="font-medium">No card yet</p>
          <p className="text-sm text-muted mt-1">Create a card first — then generate your email signature and meeting background here.</p>
          <Link href="/cards/new" className="mt-4 inline-flex rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">
            Create my card
          </Link>
        </div>
      ) : (
        <>
          <label className="block max-w-xs">
            <span className="text-[13px] font-medium mb-1 block text-muted">Card</span>
            <select className="ed-input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {(myCards ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} — /{c.username}</option>)}
            </select>
          </label>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <SignatureTool card={card} />
            <BackgroundTool card={card} />
          </div>
        </>
      )}
    </div>
  );
}

/* ============ Email signature ============ */
function SignatureTool({ card }: { card: Card }) {
  const [copied, setCopied] = useState<"html" | "text" | null>(null);
  // Preview renders after mount only: browsers re-parent whitespace inside
  // <table> markup, which otherwise triggers a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const url = `${SITE_URL}/c/${card.username}`;
  const phone = card.links.find((l) => l.type === "phone")?.value ?? "";
  const email = card.links.find((l) => l.type === "email")?.value ?? "";

  const html = `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#131a22">
  <tr>
    <td style="padding-right:14px;border-right:3px solid ${card.themeColor};vertical-align:top">
      <div style="font-size:16px;font-weight:bold">${card.name}</div>
      <div style="font-size:12px;color:#55606d">${card.jobTitle}</div>
      <div style="font-size:12px;color:#55606d">${card.company}</div>
    </td>
    <td style="padding-left:14px;font-size:12px;color:#55606d;vertical-align:top">
      ${phone ? `<div>📞 ${phone}</div>` : ""}
      ${email ? `<div>✉️ ${email}</div>` : ""}
      <div style="margin-top:4px"><a href="${url}" style="color:${card.themeColor};font-weight:bold;text-decoration:none">👉 My digital card</a></div>
    </td>
  </tr>
</table>`;

  const text = `${card.name} | ${card.jobTitle}, ${card.company}${phone ? ` | ${phone}` : ""}${email ? ` | ${email}` : ""} | My card: ${url}`;

  async function copy(kind: "html" | "text") {
    try {
      if (kind === "html" && "write" in navigator.clipboard) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(kind === "html" ? html : text);
      }
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch { /* ignore */ }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl grad-brand text-white"><Mail className="h-5 w-5" /></span>
        <div>
          <h2 className="font-semibold">Email signature</h2>
          <p className="text-xs text-muted">Paste into Gmail / Outlook signature settings.</p>
        </div>
      </div>

      {/* live preview (client-only) */}
      <div className="rounded-xl border border-border bg-white p-4 overflow-x-auto min-h-24">
        {mounted && <div dangerouslySetInnerHTML={{ __html: html }} />}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={() => copy("html")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white">
          {copied === "html" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy signature
        </button>
        <button onClick={() => copy("text")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2">
          {copied === "text" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy plain text
        </button>
      </div>
    </section>
  );
}

/* ============ Virtual background ============ */
function BackgroundTool({ card }: { card: Card }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<"brand" | "dark" | "light">("brand");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 1920, H = 1080;

    // background
    const g = ctx.createLinearGradient(0, 0, W, H);
    if (style === "brand") {
      g.addColorStop(0, "#0d1a1c"); g.addColorStop(0.7, "#0d1a1c"); g.addColorStop(1, card.themeColor);
    } else if (style === "dark") {
      g.addColorStop(0, "#0a0e13"); g.addColorStop(1, "#16222a");
    } else {
      g.addColorStop(0, "#f4f7f7"); g.addColorStop(1, "#dfeeec");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const ink = style === "light" ? "#0d1a1c" : "#ffffff";
    const sub = style === "light" ? "#55606d" : "rgba(255,255,255,0.7)";

    // name block — bottom-left, out of the face area
    ctx.fillStyle = card.themeColor;
    ctx.fillRect(80, H - 260, 8, 150);
    ctx.fillStyle = ink;
    ctx.font = "bold 64px Arial";
    ctx.fillText(card.name, 120, H - 190);
    ctx.font = "36px Arial";
    ctx.fillStyle = sub;
    ctx.fillText(`${card.jobTitle} · ${card.company}`, 120, H - 135);

    // QR bottom-right
    QRCode.toDataURL(`${SITE_URL}/c/${card.username}`, { width: 300, margin: 1 })
      .then((qr) => {
        const img = new Image();
        img.onload = () => {
          const s = 220;
          ctx.fillStyle = "#ffffff";
          const pad = 14;
          ctx.beginPath();
          ctx.roundRect(W - s - 80 - pad, H - s - 80 - pad, s + pad * 2, s + pad * 2, 18);
          ctx.fill();
          ctx.drawImage(img, W - s - 80, H - s - 80, s, s);
          ctx.font = "24px Arial";
          ctx.fillStyle = sub;
          ctx.textAlign = "right";
          ctx.fillText("Scan my card", W - 80, H - s - 80 - pad - 14);
          ctx.textAlign = "left";
        };
        img.src = qr;
      })
      .catch(() => {});
  }, [card, style]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${card.username}-background.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: "var(--grad-ai)" }}>
          <Monitor className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">Virtual meeting background</h2>
          <p className="text-xs text-muted">1920×1080 PNG with your name + card QR. Use in Zoom / Meet.</p>
        </div>
      </div>

      <canvas ref={canvasRef} width={1920} height={1080} className="w-full rounded-xl border border-border" />

      <div className="mt-4 flex items-center gap-2">
        <div className="flex gap-1 p-1 rounded-lg border border-border bg-surface2/50">
          {(["brand", "dark", "light"] as const).map((s) => (
            <button key={s} onClick={() => setStyle(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${style === s ? "bg-surface shadow-card" : "text-muted"}`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={download} className="ml-auto inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white">
          <Download className="h-4 w-4" /> Download PNG
        </button>
      </div>
    </section>
  );
}
