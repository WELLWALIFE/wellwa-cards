"use client";
// Business › Support — tickets to the company's support team: list, open one, reply, start a new one (screenshot optional).
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, bizAct, dayOf, useBiz, useBizMsg } from "@/components/business/kit";
import { KycPhoto } from "@/components/business/kyc-photo";

type Msg = { fromAdmin: boolean; body: string; at: string; attachmentUrl: string | null };
type Res = {
  disabled?: boolean;
  tickets: { id: number; subject: string; status: string; updatedAt: string }[];
  ticket: { id: number; subject: string; status: string; messages: Msg[] } | null;
  contact: { grievanceName: string; grievanceEmail: string; grievancePhone: string; supportPhone: string; supportEmail: string };
};

const STATUS: Record<string, [string, string]> = { open: ["Open", "खुला"], answered: ["Answered", "जवाब आ गया"], closed: ["Closed", "बंद"] };

export default function SupportPage() {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  const [open, setOpen] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const { data, error, loading, reload } = useBiz<Res>("support", open ? { ticket: open } : {});
  const [subject, setSubject] = useState(""); const [text, setText] = useState(""); const [file, setFile] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setDone("");
    const r = await bizAct<{ ticket?: number }>("support", open ? { op: "reply", ticket: open, body: text, file } : { op: "new_ticket", subject, body: text, file });
    setBusy(false);
    if (!r.ok) { setErr(tr(r.error)); return; }
    setDone(en ? "Sent. Our team will reply here." : "भेज दिया। हमारी team यहीं जवाब देगी।");
    setText(""); setSubject(""); setFile("");
    if (!open && r.data.ticket) { setComposing(false); setOpen(r.data.ticket); } else void reload();
  }

  const back = open || composing;
  const c = data?.contact;
  return (
    <BizShell title="Support">
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled ? <p className={`${CARD} text-sm text-muted`}>{en ? "This is switched off right now." : "यह अभी बंद है।"}</p> : data && (
          <>
            {back && <button type="button" onClick={() => { setOpen(null); setComposing(false); setErr(""); setDone(""); }} className="text-sm font-semibold text-brand">← {en ? "All messages" : "सारे संदेश"}</button>}

            {!back && (
              <>
                <p className="text-sm text-muted">{en ? "Ask anything about your ID, income or payments." : "अपनी ID, कमाई या payment के बारे में कुछ भी पूछें।"}</p>
                <button type="button" onClick={() => { setComposing(true); setDone(""); }} className="flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />{en ? "New message" : "नया संदेश"}</button>
                {data.tickets.length === 0 && <p className={`${CARD} text-center text-sm text-muted`}>{en ? "No messages yet." : "अभी कोई संदेश नहीं।"}</p>}
                {data.tickets.map((t) => (
                  <button key={t.id} type="button" onClick={() => { setOpen(t.id); setDone(""); }} className={`${CARD} flex w-full items-center gap-2 text-left`}>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.subject}</p><p className="text-xs text-muted">#{t.id} · {dayOf(t.updatedAt)} · {STATUS[t.status] ? STATUS[t.status][en ? 0 : 1] : t.status}</p></div>
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </button>
                ))}
              </>
            )}

            {open && data.ticket && (
              <div className="space-y-3">
                <p className="font-bold">{data.ticket.subject}</p>
                {data.ticket.messages.map((m, i) => (
                  <div key={i} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${m.fromAdmin ? "bg-brand-soft" : "ml-auto bg-surface2"}`}>
                    <p className="mb-1 text-[11px] font-semibold text-muted">{m.fromAdmin ? (en ? "Support team" : "Support team") : (en ? "You" : "आप")} · {dayOf(m.at)}</p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.attachmentUrl && <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand">{en ? "See attachment" : "फ़ाइल देखें"}</a>}
                  </div>
                ))}
              </div>
            )}

            {(composing || (open && data.ticket)) && (
              <form onSubmit={send} className={`${CARD} space-y-3`}>
                {composing && <label className="block"><span className="text-xs font-semibold text-muted">{en ? "Subject" : "विषय"}</span><input className="ed-input mt-1" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} required /></label>}
                <label className="block"><span className="text-xs font-semibold text-muted">{open ? (en ? "Your reply" : "आपका जवाब") : (en ? "Message" : "संदेश")}</span><textarea className="ed-input mt-1" rows={open ? 3 : 5} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} required /></label>
                <KycPhoto kind="ticket" pdf label={en ? "Add a screenshot (optional)" : "screenshot जोड़ें (ज़रूरी नहीं)"} id={file} onChange={setFile} />
                {err && <p className="text-sm font-semibold text-danger">{err}</p>}
                {done && <p className="text-sm font-semibold text-good">{done}</p>}
                <button type="submit" disabled={busy} className="w-full rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? (en ? "Sending…" : "भेज रहे हैं…") : open ? (en ? "Send reply" : "जवाब भेजें") : (en ? "Send" : "भेजें")}</button>
              </form>
            )}

            {!back && c && (
              <div className={`${CARD} text-sm text-muted space-y-1`}>
                <p className="font-bold text-ink">{en ? "Grievance officer" : "शिकायत अधिकारी"}</p>
                <p>{[c.grievanceName, c.grievanceEmail, c.grievancePhone].filter(Boolean).join(" · ") || (en ? "Details will be added by the company." : "जानकारी कंपनी जोड़ेगी।")}</p>
                {(c.supportPhone || c.supportEmail) && <p><b className="text-ink">Support:</b> {[c.supportPhone, c.supportEmail].filter(Boolean).join(" · ")}</p>}
              </div>
            )}
          </>
        )}
      </BizState>
    </BizShell>
  );
}
