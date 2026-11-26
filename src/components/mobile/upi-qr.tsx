"use client";
// A UPI QR for the exact amount (any UPI app scans it), with the shop's UPI ID under it. On a phone, "Pay by UPI" opens the app.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { inr } from "@/lib/jewellery";
import { upiLink, validUpi } from "@/lib/mobile";

export function UpiQr({ upi, name, paise, note = "", size = 140, button = false }: { upi: string; name: string; paise: number; note?: string; size?: number; button?: boolean }) {
  const ok = validUpi(upi || "");
  const link = ok ? upiLink(upi, name, paise, note) : "";
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!link) return;
    let on = true;
    QRCode.toDataURL(link, { width: size * 3, margin: 1 }).then((u) => { if (on) setSrc(u); }).catch(() => undefined);
    return () => { on = false; };
  }, [link, size]);
  if (!ok || !src) return null;
  return (
    <figure className="mx-auto flex flex-col items-center gap-1 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="UPI QR" width={size} height={size} style={{ width: size, height: size }} />
      <figcaption style={{ fontSize: 11 }}><b>Scan &amp; pay {paise > 0 ? inr(paise) : ""}</b><br />UPI: {upi}</figcaption>
      {button && <a href={link} className="mt-1 rounded-xl bg-[#5f259f] px-4 py-2 text-sm font-bold text-white print:hidden">Pay {paise > 0 ? inr(paise) : ""} by UPI</a>}
    </figure>
  );
}
