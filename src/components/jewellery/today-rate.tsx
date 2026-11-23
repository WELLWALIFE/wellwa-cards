// "Today's rate" on a Shubhora Jewellery shop's V-Card and website (card.jewelRate, put on the card for each request by
// c/[username]/render.tsx). Plain markup with inline colours, so it sits well on every look and in dark mode.
import type { Card } from "@/lib/types";

const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export function TodayRate({ rate, accent = "#B8860B", hi = false, className = "" }: { rate: Card["jewelRate"]; accent?: string; hi?: boolean; className?: string }) {
  if (!rate?.rows?.length) return null;
  const day = new Date(`${rate.day}T00:00:00`).toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
  return (
    <section aria-label={hi ? "आज का रेट" : "Today's rate"} className={`jw-today-rate overflow-hidden rounded-2xl border ${className}`}
      style={{ borderColor: `${accent}55`, background: `linear-gradient(135deg, ${accent}14, ${accent}05)` }}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="text-sm font-bold" style={{ color: accent }}>✨ {hi ? "आज का रेट" : "Today's rate"}</p>
        <p className="text-[11px] opacity-70">{day}</p>
      </div>
      <div className="grid grid-cols-2 gap-px px-2 pb-2 pt-2 sm:grid-cols-3">
        {rate.rows.map((r) => (
          <div key={r.label} className="rounded-xl px-2 py-1.5">
            <p className="text-[11px] font-semibold opacity-75">{r.label}</p>
            <p className="text-base font-bold tabular-nums leading-tight">{money(r.paise)}<span className="text-[11px] font-normal opacity-70"> / {r.unit}</span></p>
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-[10px] opacity-60">{hi ? "GST और making अलग। रेट दिन में बदल सकता है।" : "GST and making extra. Rates may change during the day."}</p>
    </section>
  );
}
