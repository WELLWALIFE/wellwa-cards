import { Phone, MessageCircle, Mail, Globe, Download, BadgeCheck, QrCode } from "lucide-react";

/** Decorative premium phone mockup for the hero (static). */
export function CardMockup() {
  return (
    <div className="relative w-[270px] mx-auto animate-floaty">
      {/* glow */}
      <div className="absolute -inset-8 -z-10 rounded-full blur-3xl opacity-40" style={{ background: "var(--grad-brand)" }} />
      {/* phone frame */}
      <div className="rounded-[2.4rem] border-[10px] border-ink bg-surface overflow-hidden shadow-float">
        {/* notch */}
        <div className="relative">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-5 w-24 rounded-full bg-ink z-10" />
          {/* cover */}
          <div className="h-24 grad-brand" />
        </div>
        <div className="px-5 -mt-9 pb-5">
          <div className="h-16 w-16 rounded-full ring-4 ring-surface grad-brand grid place-items-center text-white text-xl font-bold shadow-card">
            J
          </div>
          <div className="mt-2 flex items-center gap-1">
            <p className="font-semibold tracking-tight">J. S. Rao</p>
            <BadgeCheck className="h-4 w-4 text-brand" />
          </div>
          <p className="text-xs text-muted">Founder & CEO · Wellwa Life</p>

          <div className="mt-3 flex gap-1.5">
            {[Phone, MessageCircle, Mail, Globe].map((Icon, i) => (
              <span key={i} className="h-8 w-8 rounded-lg grad-brand grid place-items-center text-white">
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <span className="rounded-lg grad-brand text-white text-[11px] font-semibold py-2 grid place-items-center gap-1">
              <span className="flex items-center gap-1"><Download className="h-3 w-3" /> Save</span>
            </span>
            <span className="rounded-lg border border-border text-[11px] font-semibold py-2 grid place-items-center">
              WhatsApp
            </span>
          </div>

          <div className="mt-3 flex gap-2 text-[10px] text-faint mono border-b border-border pb-2">
            <span className="text-brand-ink font-semibold">Home</span>
            <span>Products</span>
            <span>Gallery</span>
            <span>Contact</span>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border p-2">
            <QrCode className="h-8 w-8 text-ink" />
            <div className="text-[10px] leading-tight">
              <p className="font-medium">Scan to open</p>
              <p className="text-muted mono">shubhora</p>
            </div>
          </div>
        </div>
      </div>

      {/* floating chips */}
      <div className="absolute -left-10 top-16 rounded-xl bg-surface border border-border shadow-float px-3 py-2 text-xs font-medium flex items-center gap-1.5 animate-floaty" style={{ animationDelay: "-2s" }}>
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--good)" }} /> New lead captured
      </div>
      <div className="absolute -right-8 top-40 rounded-xl bg-surface border border-border shadow-float px-3 py-2 text-xs font-medium flex items-center gap-1.5 animate-floaty" style={{ animationDelay: "-4s" }}>
        <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: "var(--grad-ai)" }}>✦</span>
        AI replied on WhatsApp
      </div>
    </div>
  );
}
