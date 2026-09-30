// "Talk to us" for the custom Pro plan: opens WhatsApp to the company with a ready message (the fastest way in India),
// with a phone call as the second option. Used wherever the Pro plan is shown.
import { MessageCircle, Phone } from "lucide-react";
import { PRO_CUSTOM } from "@/lib/billing";
import { SUPPORT_PHONE, waLink } from "@/lib/site-brand";

export function TalkToUs({ className = "", call = true, label = PRO_CUSTOM.cta }: { className?: string; call?: boolean; label?: string }) {
  return (
    <div className="space-y-1.5">
      <a href={waLink(PRO_CUSTOM.waText)} target="_blank" rel="noopener noreferrer"
        className={className || "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"}>
        <MessageCircle className="h-4 w-4" /> {label}
      </a>
      {call && (
        <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} className="flex items-center justify-center gap-1.5 text-xs text-muted hover:text-ink">
          <Phone className="h-3.5 w-3.5" /> or call {SUPPORT_PHONE}
        </a>
      )}
    </div>
  );
}
