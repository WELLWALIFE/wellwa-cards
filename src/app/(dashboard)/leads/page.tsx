"use client";

import { useEffect, useState } from "react";
import { MessageCircle, FileText, QrCode, Send, Sparkles, LoaderCircle, Download, Lock, CalendarClock, X } from "lucide-react";
import { sampleLeads, getCard } from "@/lib/sample-data";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useUpgradeGate } from "@/lib/plan";

const sourceIcon = { whatsapp: MessageCircle, form: Send, vcard: FileText, qr: QrCode } as const;
const statusStyle: Record<string, string> = {
  hot: "bg-lead/15 text-lead", warm: "bg-brand-soft text-brand-ink",
  new: "bg-surface2 text-muted", contacted: "bg-ai/10 text-ai", interested: "bg-brand-soft text-brand-ink",
  follow_up: "bg-lead/15 text-lead", converted: "bg-good/15 text-good", lost: "bg-surface2 text-faint",
  won: "bg-good/15 text-good", cold: "bg-surface2 text-faint",
};
const STATUSES = ["new", "contacted", "interested", "follow_up", "converted", "lost"] as const;

type Lead = {
  id: string; name: string; phone: string; email: string; message: string;
  source: string; status: string; score: number; cardUsername: string;
  campaign?: string; adSource?: string; notes?: string; nextFollowUp?: string;
  valuePaise?: number; lostReason?: string; createdAt?: string;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(() => getBrowserSupabase() ? null : fromSample());
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState<Lead | null>(null);
  const exportGate = useUpgradeGate("lead-export");

  function exportCsv() {
    if (!exportGate.check()) return;
    const rows = [["Name", "Phone", "Email", "Message", "Source", "Status", "Score", "Card", "Ad source", "Campaign", "Notes", "Follow-up", "Value"]];
    for (const l of (leads ?? [])) {
      rows.push([l.name, l.phone, l.email, l.message, l.source, l.status, String(l.score), l.cardUsername, l.adSource ?? "", l.campaign ?? "", l.notes ?? "", l.nextFollowUp ?? "", String((l.valuePaise ?? 0) / 100)]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setLeads(fromSample()); return; }
      const { data } = await sb
        .from("leads")
        .select("id,name,phone,email,message,source,status,score,created_at,utm_source,utm_campaign,src,notes,next_follow_up,value_paise,lost_reason,cards(username)")
        .order("created_at", { ascending: false });
      if (data && data.length) {
        setLive(true);
        setLeads(data.map((l: Record<string, unknown>) => ({
          id: l.id as string, name: (l.name as string) || "—", phone: (l.phone as string) || "",
          email: (l.email as string) || "", message: (l.message as string) || "",
          source: (l.source as string) || "form", status: (l.status as string) || "new",
          score: (l.score as number) ?? 0,
          cardUsername: (l.cards as { username?: string } | null)?.username ?? "",
          campaign: (l.utm_campaign as string) || "",
          adSource: ((l.utm_source as string) || (l.src as string) || ""),
          notes: (l.notes as string) || "",
          nextFollowUp: (l.next_follow_up as string) || "",
          valuePaise: Number(l.value_paise) || 0,
          lostReason: (l.lost_reason as string) || "",
          createdAt: (l.created_at as string) || "",
        })));
      } else {
        // logged in but no real leads yet — show empty (not sample)
        setLive(true);
        setLeads([]);
      }
    })();
  }, []);

  const shown = (leads ?? []).filter((l) => filter === "All" || l.status === filter.toLowerCase().replace(" ", "_"));

  // Manual rank: owner sets status (New/Warm/Hot/Cold/Won) — persists when live.
  async function setStatus(id: string, status: string) {
    setLeads((ls) => (ls ?? []).map((l) => (l.id === id ? { ...l, status } : l)));
    if (live) {
      const sb = getBrowserSupabase();
      await sb?.from("leads").update({ status }).eq("id", id);
    }
  }

  // AI score on demand.
  async function scoreLead(l: Lead) {
    const r = await fetch("/api/ai/score-lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: l.name, message: l.message, source: l.source }),
    }).then((x) => x.json()).catch(() => null);
    if (!r || typeof r.score !== "number") return;
    setLeads((ls) => (ls ?? []).map((x) => (x.id === l.id ? { ...x, score: r.score } : x)));
    if (live) {
      const sb = getBrowserSupabase();
      await sb?.from("leads").update({ score: r.score }).eq("id", l.id);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-muted mt-1">
          {live ? "Your real leads from card chat, forms and WhatsApp." : "Sample data — log in to see your real leads."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["All", "New", "Contacted", "Interested", "Follow up", "Converted", "Lost"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${f === filter ? "bg-ink text-bg border-ink" : "border-border text-muted hover:bg-surface2"}`}>
            {f}
          </button>
        ))}
        <button onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface2">
          <Download className="h-3.5 w-3.5" /> Export CSV
          {!exportGate.allowed && <Lock className="h-3 w-3 text-faint" />}
        </button>
      </div>
      {exportGate.sheet}

      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-card">
        {leads === null ? (
          <div className="p-8 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">No leads yet</p>
            <p className="text-sm text-muted mt-1">Share your card — chats, contact forms and WhatsApp messages will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-faint mono text-xs uppercase tracking-wide border-b border-border">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Card</th>
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-4 py-3 font-semibold">AI score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((l) => {
                  const Icon = sourceIcon[l.source as keyof typeof sourceIcon] ?? Send;
                  return (
                    <tr key={l.id} className="hover:bg-surface2/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-muted mono">{l.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-muted capitalize"><Icon className="h-4 w-4" /> {l.source}</span>
                      </td>
                      <td className="px-4 py-3 text-muted mono text-xs">/{l.cardUsername}</td>
                      <td className="px-4 py-3 text-xs">
                        {l.campaign || l.adSource ? (
                          <>
                            <p className="font-medium truncate max-w-[140px]">{l.campaign || "—"}</p>
                            {l.adSource && <p className="text-faint capitalize">{l.adSource}</p>}
                          </>
                        ) : <span className="text-faint">Direct</span>}
                      </td>
                      <td className="px-4 py-3">
                        {l.score > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-surface2 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${l.score}%`, background: l.score > 75 ? "var(--lead)" : l.score > 50 ? "var(--brand)" : "var(--faint)" }} />
                            </div>
                            <span className="tabular-nums text-xs text-muted">{l.score}</span>
                          </div>
                        ) : (
                          <button onClick={() => scoreLead(l)}
                            className="inline-flex items-center gap-1 rounded-md bg-ai/10 text-ai px-2 py-1 text-[11px] font-medium hover:bg-ai/20">
                            <Sparkles className="h-3 w-3" /> Score
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {/* Manual rank — click to change */}
                        <select
                          value={l.status}
                          onChange={(e) => setStatus(l.id, e.target.value)}
                          className={`mono text-[11px] font-semibold uppercase px-1.5 py-1 rounded border-0 outline-none cursor-pointer appearance-none ${statusStyle[l.status] ?? statusStyle.new}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setEditing(l)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline">
                          <CalendarClock className="h-3.5 w-3.5" /> Details
                        </button>
                        {l.phone && <FollowupButton phone={l.phone} name={l.name} />}
                        {l.phone && (
                          <a href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`} target="_blank"
                            className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-good hover:underline">
                            <MessageCircle className="h-3.5 w-3.5" /> Reply
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <LeadEditor
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setLeads((items) => (items ?? []).map((item) => item.id === next.id ? next : item));
            setEditing(null);
          }}
        />
      )}
      {!live && <p className="text-xs text-faint">AI lead scoring runs when the AI key is set. Real leads flow in once your card is published and shared.</p>}
    </div>
  );
}

function LeadEditor({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: (lead: Lead) => void }) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [nextFollowUp, setNextFollowUp] = useState(lead.nextFollowUp?.slice(0, 16) ?? "");
  const [value, setValue] = useState(String((lead.valuePaise ?? 0) / 100 || ""));
  const [lostReason, setLostReason] = useState(lead.lostReason ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const next = {
      ...lead,
      notes: notes.slice(0, 4000),
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp).toISOString() : "",
      valuePaise: Math.max(0, Math.round(Number(value || 0) * 100)),
      lostReason: lostReason.slice(0, 500),
    };
    const sb = getBrowserSupabase();
    const { error } = await sb!.from("leads").update({
      notes: next.notes,
      next_follow_up: next.nextFollowUp || null,
      value_paise: next.valuePaise,
      lost_reason: next.lostReason,
      updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    setBusy(false);
    if (!error) onSaved(next);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-float">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-semibold">{lead.name}</h2><p className="text-xs text-muted">{lead.phone || lead.email} · {lead.message || "No message"}</p></div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <label className="block"><span className="text-xs font-medium text-muted">Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-28 w-full rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand" placeholder="Conversation, requirement, next step…" /></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className="text-xs font-medium text-muted">Next follow-up</span><input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
          <label><span className="text-xs font-medium text-muted">Potential value (₹)</span><input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
        </div>
        <label className="block"><span className="text-xs font-medium text-muted">Lost reason (optional)</span><input value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
        <button disabled={busy} className="w-full rounded-lg grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save lead"}</button>
      </form>
    </div>
  );
}

/* One-tap: enroll this lead into the AI WhatsApp follow-up sequence (Day 1→3→6→weekly). */
function FollowupButton({ phone, name }: { phone: string; name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  async function start() {
    setState("busy");
    try {
      const r = await fetch("/api/wa/followups/start", {
        method: "POST",
        body: JSON.stringify({ contacts: [{ phone, name }], perDay: 3 }),
      }).then((x) => x.json());
      setState(r.started >= 1 || r.skipped?.[0]?.reason === "already active" ? "done" : "err");
    } catch {
      setState("err");
    }
  }
  if (state === "done")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-ai"><Sparkles className="h-3 w-3" /> Following up</span>;
  return (
    <button onClick={start} disabled={state === "busy"}
      className="inline-flex items-center gap-1 text-xs font-medium text-ai hover:underline disabled:opacity-50"
      title="AI will follow up on WhatsApp: Day 1, 3, 6, then weekly">
      {state === "busy" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {state === "err" ? "Bridge off" : "AI follow-up"}
    </button>
  );
}

function fromSample(): Lead[] {
  return sampleLeads.map((l) => ({
    id: l.id, name: l.name, phone: l.phone, email: l.email, message: l.message,
    source: l.source, status: l.status, score: l.score,
    cardUsername: getCard(l.cardId)?.username ?? "",
  }));
}
