"use client";
// The owner's AI phone receptionist (phase 3): their line, and every call the AI answered — who, what, what next.
import { useEffect, useState } from "react";
import { LoaderCircle, PhoneCall, PhoneIncoming } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { fmtWhen } from "@/lib/bookings";

type Line = { number: string; provider: string; label: string; active: boolean };
type Call = { id: string; caller: string; started_at: string; seconds: number; summary: string; intent: string; lead_id: string | null; booking_id: string | null; transcript: { role: "caller" | "ai"; text: string }[] };

export function PhoneCalls() {
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (h: string, e: string) => (hi ? h : e);
  const [data, setData] = useState<{ line: Line | null; calls: Call[]; ready: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<{ line: Line | null; calls: Call[]; ready: boolean }>("/api/phone").then((r) => setData(r.ok ? r.data : { line: null, calls: [], ready: false })); }, []);
  if (!data) return <div className="py-10 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;
  const pretty = (d: string) => { const n = d.replace(/\D/g, ""); return n.length >= 10 ? `+${n.slice(0, -10)} ${n.slice(-10, -5)} ${n.slice(-5)}` : d; };
  const badge = (i: string) => i === "booking" ? T("बुकिंग", "booking") : i === "order" ? T("ऑर्डर", "order") : i === "callback" ? T("कॉल बैक", "call back") : i === "enquiry" ? T("पूछताछ", "enquiry") : T("कॉल", "call");
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"><PhoneCall className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{T("AI फ़ोन रिसेप्शनिस्ट", "AI phone receptionist")}</p>
            {data.line
              ? <p className="text-xs text-muted">{T("आपका नंबर:", "Your number:")} <b className="text-ink">{pretty(data.line.number)}</b>{data.line.label ? ` · ${data.line.label}` : ""} · {data.line.active ? T("चालू", "on") : T("बंद", "off")}</p>
              : <p className="text-xs text-muted">{T("अभी कोई नंबर नहीं। Pro प्लान में Shubhora आपको एक नंबर देता है — अपने फ़ोन की मिस्ड कॉल उस पर फ़ॉरवर्ड करें, AI उठाकर बात करेगा, बुकिंग लेगा और आपको WhatsApp पर बताएगा।", "No number yet. On the Pro plan Shubhora gives you a number — forward your missed calls to it and the AI answers, takes bookings and tells you on WhatsApp.")}</p>}
          </div>
        </div>
        {data.line && <p className="mt-3 rounded-xl bg-bg px-3 py-2 text-xs text-muted">{T("अपने फ़ोन में सेट करें: Settings → Calls → Call forwarding → \"When unanswered / busy\" → ये नंबर। तब आपकी हर मिस्ड कॉल AI उठाएगा।", "On your phone: Settings → Calls → Call forwarding → \"When unanswered / busy\" → this number. Then the AI picks up every call you miss.")}</p>}
      </div>
      {!data.calls.length ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">{T("अभी कोई कॉल नहीं आई।", "No calls yet.")}</p>
      ) : data.calls.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-surface p-3">
          <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="w-full text-left">
            <div className="flex items-start gap-2">
              <PhoneIncoming className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{c.caller ? pretty(c.caller) : T("अनजान नंबर", "Unknown number")} <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-ink">{badge(c.intent)}</span></p>
                <p className="mt-0.5 text-xs text-muted">{fmtWhen(c.started_at, hi)} · {Math.max(1, Math.round(c.seconds / 60))} min</p>
                <p className="mt-1 text-sm">{c.summary}</p>
              </div>
            </div>
          </button>
          {open === c.id && c.transcript?.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
              {c.transcript.map((t, i) => <p key={i} className={t.role === "ai" ? "text-muted" : "text-ink"}><b>{t.role === "ai" ? "AI" : T("ग्राहक", "Caller")}:</b> {t.text}</p>)}
            </div>
          )}
          {c.caller && <a href={`tel:+${c.caller.replace(/\D/g, "")}`} className="mt-2 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold"><PhoneCall className="h-3.5 w-3.5" /> {T("कॉल बैक", "Call back")}</a>}
        </div>
      ))}
    </div>
  );
}
