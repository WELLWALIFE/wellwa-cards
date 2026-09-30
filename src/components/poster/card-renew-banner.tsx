"use client";

// The V-Card's year running out (last 30 days), ended (7-day grace) or paused — one strip on Home and My V-Card that
// opens the renewal. Quiet until the last 30 days, so a fresh account never sees it; nothing at all while a paid plan
// (Growth) covers the card (owner's call, 27 Sep 2026).
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { CARD_RENEWAL, rupees } from "@/lib/billing";

type CardYear = { state: "included" | "active" | "grace" | "paused"; until: string | null; days_left: number | null; pause_on: string | null; renewed: boolean };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export function CardRenewBanner() {
  const { lang } = useT();
  const en = lang === "en";
  const [c, setC] = useState<CardYear | null>(null);
  useEffect(() => {
    api<{ card?: CardYear | null }>("/api/poster/plan").then((r) => { if (r.ok) setC(r.data.card ?? null); }).catch(() => {});
  }, []);
  if (!c || c.state === "included") return null;
  if (c.state === "active" && (c.days_left === null || c.days_left > 30)) return null;

  const price = rupees(CARD_RENEWAL.amount);
  const box = c.state === "paused" ? "border-danger/50 bg-danger/5" : c.state === "grace" ? "border-amber/50 bg-amber/10" : "border-amber/40 bg-amber/5";
  const Icon = c.state === "active" ? CalendarClock : AlertTriangle;
  const [title, body] = c.state === "paused"
    ? (en
      ? ["Your V-Card is paused", "Visitors see “Card renew karein” on your link. Renew and it comes back at once — all your details, photos and leads are safe."]
      : ["आपका V-Card रुका हुआ है", "आपके link पर लोग “Card renew karein” देख रहे हैं। Renew करते ही card तुरंत वापस — आपकी सारी details, photos और leads सुरक्षित हैं।"])
    : c.state === "grace"
    ? (en
      ? ["Your V-Card year has ended", `It keeps working till ${day(c.pause_on)}. After that your link shows “Card renew karein” until you renew.`]
      : ["आपके V-Card का साल पूरा हो गया", `${day(c.pause_on)} तक card चलता रहेगा। उसके बाद आपके link पर “Card renew karein” दिखेगा — renew करते ही card फिर चालू।`])
    : (en
      ? [`Your V-Card year ends on ${day(c.until)}`, `Renew for ${price} a year and your link, details and leads keep working without a break. Growth includes the V-Card.`]
      : [`आपके V-Card का साल ${day(c.until)} को पूरा हो रहा है`, `${price} में 1 साल और — आपका link, details और leads बिना रुकावट चलते रहेंगे। Growth में V-Card शामिल है।`]);

  return (
    <Link href="/poster/plan?renew=card" className={`block rounded-2xl border-2 p-3 ${box}`}>
      <p className={`flex items-center gap-1.5 text-sm font-bold ${c.state === "paused" ? "text-danger" : "text-amber"}`}><Icon className="h-4 w-4 shrink-0" /> {title}</p>
      <p className="mt-0.5 text-xs text-ink">{body}</p>
      <span className="mt-2 inline-block rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white">{en ? `Renew — ${price} / year` : `Renew करें — ${price} / साल`}</span>
    </Link>
  );
}
