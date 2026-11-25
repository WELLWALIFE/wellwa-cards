"use client";
// "Ask for a review" (owner, 25 Nov 2026): send a customer the review link on WhatsApp, copy it, or download a QR poster for the
// counter. The link opens the review helper page (stars → what they liked → a draft → Google's own review box).
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, MessageCircle, Check } from "lucide-react";
import { api } from "@/lib/poster-client";
import { reviewAskText } from "@/lib/review-ask";

type Info = { page: string; google: boolean; biz: string; hindi: boolean; site: string };

/** A 1080×1350 poster: business name, the ask, the QR, the address under it. Drawn here, so nothing is uploaded. */
async function poster(i: Info, hi: boolean): Promise<string> {
  const W = 1080, H = 1350, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#171447"; x.fillRect(0, 0, W, 300);
  x.textAlign = "center"; x.fillStyle = "#ffffff";
  let size = 72; x.font = `bold ${size}px sans-serif`;
  while (x.measureText(i.biz).width > W - 120 && size > 36) { size -= 4; x.font = `bold ${size}px sans-serif`; }
  x.fillText(i.biz, W / 2, 175);
  x.fillStyle = "#FBBC05"; x.font = "64px sans-serif"; x.fillText("★★★★★", W / 2, 400);
  x.fillStyle = "#171447"; x.font = "bold 58px sans-serif";
  x.fillText(hi ? "हमें Google पर review दें" : "Review us on Google", W / 2, 490);
  x.fillStyle = "#555"; x.font = "36px sans-serif";
  x.fillText(hi ? "Scan करें · सिर्फ 20 सेकंड" : "Scan · takes 20 seconds", W / 2, 550);
  const qr = await QRCode.toDataURL(i.page, { width: 560, margin: 1 });
  const img = new Image(); img.src = qr; await img.decode();
  x.drawImage(img, (W - 560) / 2, 610, 560, 560);
  x.fillStyle = "#777"; x.font = "28px sans-serif"; x.fillText(i.page.replace(/^https?:\/\//, ""), W / 2, 1240);
  x.fillStyle = "#171447"; x.font = "bold 34px sans-serif"; x.fillText(hi ? "धन्यवाद! 🙏" : "Thank you! 🙏", W / 2, 1300);
  return cv.toDataURL("image/png");
}

export function ReviewAsk({ hi }: { hi: boolean }) {
  const [i, setI] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const T = (en: string, h: string) => (hi ? h : en);
  useEffect(() => { api<Info & { error?: string }>("/api/google/review-ask").then((r) => (r.ok ? setI(r.data) : setErr(r.data?.error ?? "Could not load."))); }, []);
  if (err) return <section className="rounded-xl border border-border p-3 text-xs text-muted">{err}</section>;
  if (!i) return null;

  const text = reviewAskText({ biz: i.biz, name, link: i.page, site: i.site, hindi: i.hindi });
  const d = phone.replace(/\D/g, ""); const to = d.length === 10 ? `91${d}` : d.length >= 11 ? d : "";
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  return (
    <section className="rounded-xl border border-border p-3 space-y-2.5">
      <div>
        <div className="text-sm font-semibold text-ink">{T("Ask a customer for a review", "Customer से review माँगें")}</div>
        <div className="text-[11px] text-muted">{T("They tap the stars and what they liked, get a ready review to change, and Google opens with it copied.", "Customer star और पसंद tap करे, तैयार review मिले जिसे बदल सके, और copy होकर Google खुल जाए।")}</div>
      </div>
      {!i.google && <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">{T("Google did not give us your review address yet — the link will ask customers to message you instead. Tap Refresh above, or add your Google Maps link on your card.", "Google से अभी review का address नहीं मिला — link पर customer आपको message कर पाएगा। ऊपर Refresh दबाएँ, या card पर Google Maps link डालें।")}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T("Name (optional)", "नाम (चाहें तो)")} className="w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={T("WhatsApp number", "WhatsApp नंबर")} className="w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand" />
      </div>
      <a href={to ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!to} onClick={(e) => { if (!to) { e.preventDefault(); flash(T("Type the customer's 10-digit number.", "Customer का 10 अंक का नंबर डालें।")); } }} className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white ${to ? "" : "opacity-60"}`}>
        <MessageCircle className="h-4 w-4" />{T("Send on WhatsApp", "WhatsApp पर भेजें")}
      </a>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); flash(T("✅ Message copied", "✅ Message copy हो गया")); } catch { flash(i.page); } }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-ink"><Copy className="h-4 w-4" />{T("Copy message", "Message copy")}</button>
        <button type="button" onClick={async () => { try { const u = await poster(i, i.hindi); const a = document.createElement("a"); a.href = u; a.download = "google-review-qr.png"; a.click(); } catch { flash(T("Could not make the poster.", "Poster नहीं बना।")); } }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-ink"><Download className="h-4 w-4" />{T("QR poster", "QR poster")}</button>
      </div>
      <a href={i.page} target="_blank" rel="noopener noreferrer" className="block text-xs text-brand-ink">{T("See what the customer sees →", "Customer को क्या दिखेगा, देखें →")}</a>
      {msg && <p className="flex items-center gap-1.5 text-xs font-semibold text-good"><Check className="h-3.5 w-3.5" />{msg.replace(/^✅ /, "")}</p>}
    </section>
  );
}
