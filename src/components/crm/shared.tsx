"use client";
// Shared bits of the CRM Pro screens (docs/crm-pro.md): the workspace (who am I here, what is connected), the lead
// shape with the phase-1 columns, date helpers in IST, and small UI atoms every screen uses.
import { createContext, useContext, type ReactNode } from "react";
import { api } from "@/lib/poster-client";
import type { Ctx, Wa, Team, Agent, Lead } from "@/components/crm/crm";
import type { CrmStrings } from "@/components/crm/i18n";

export type LeadPro = Lead & { kind: "lead" | "customer" | "lost"; alt_phone: string; business: string; address: string; pincode: string; birthday: string | null; anniversary: string | null; lang: string; product_ids: string[]; budget_paise: number; last_activity_at: string; last_call_at: string | null; calls_count: number; opted_out?: boolean; last_in?: { text: string; at: string } | null; last_call?: { at: string; outcome: string; note: string } | null };
export type Task = { id: string; lead_id: string | null; assigned_to: string | null; kind: "call" | "whatsapp" | "visit" | "meeting" | "other"; title: string; text: string; due_at: string; remind_at: string | null; done_at: string | null; outcome: string; source: string; created_at: string };
export type Call = { id: string; lead_id: string | null; agent_id: string | null; direction: "out" | "in"; channel: string; status: string; started_at: string; seconds: number; outcome: string; note: string; recording_url: string | null };
export type Prefs = { ask_outcome: boolean; retry_after_min: number; missed_call_wa: boolean; missed_call_text: string; auto_task_new_lead: boolean; daily_summary: boolean; birthday_wish: boolean; stale_days: number; round_robin: boolean; call_target: number };
export type Workspace = { wa: Wa; channel: string; role: "owner" | "manager" | "agent"; ownerId: string; me: string; teams: Team[]; upi: string; payee: string; business: string; prefs: Prefs; agents: Agent[]; line: { number: string; caller_id: string; label: string } | null };

export type CrmShell = {
  ws: Workspace; ctx: Ctx; L: CrmStrings & { lang: "hi" | "en"; hi: boolean };
  as: string | null;                                   // team workspace id (null = my own)
  openCustomer: (id: string) => void;                  // navigate to the customer screen
  startCall: (lead: Pick<LeadPro, "id" | "name" | "phone" | "status">, onLogged?: () => void) => void;
  reload: () => void;                                  // the current section refetches
  notifyLogged: () => void;                            // a call outcome was saved (call list moves on)
  version: number;                                     // bumps on reload(); sections refetch on it
};
export const Shell = createContext<CrmShell | null>(null);
export const useShell = () => { const c = useContext(Shell); if (!c) throw new Error("CRM shell missing"); return c; };

export const IST = "Asia/Kolkata";
export const CLOSED = ["converted", "won", "lost"];
export const digits = (p: string) => (p || "").replace(/[^0-9]/g, "");
const waNumOf = (p: string) => { const d = digits(p); return d.length === 10 ? `91${d}` : d; };
export const waLink = (p: string) => `https://wa.me/${waNumOf(p)}`;
export { waNum, waOpenHref, openWhatsAppChat, waClick } from "@/lib/wa-open";
export const telLink = (p: string) => `tel:${p.startsWith("+") ? p : "+" + digits(p)}`;
export const rupees = (paise: number) => (paise ? "₹" + (paise / 100).toLocaleString("en-IN") : "");
export const initial = (name: string, phone: string) => (name || "").trim().charAt(0).toUpperCase() || (phone ? "#" : "?");
export const hue = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const isToday = (iso: string | null) => !!iso && new Date(iso).toLocaleDateString("en-CA", { timeZone: IST }) === new Date().toLocaleDateString("en-CA", { timeZone: IST });
export const isPast = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now();
export function fmtTime(iso: string, hi: boolean) { return new Date(iso).toLocaleTimeString(hi ? "hi-IN" : "en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" }); }
export function fmtDay(iso: string, hi: boolean) { return new Date(iso).toLocaleDateString(hi ? "hi-IN" : "en-IN", { timeZone: IST, day: "numeric", month: "short" }); }
export function fmtWhen(iso: string, hi: boolean) { return isToday(iso) ? `${hi ? "आज" : "Today"} ${fmtTime(iso, hi)}` : `${fmtDay(iso, hi)}, ${fmtTime(iso, hi)}`; }
export function ago(iso: string | null | undefined, hi: boolean): string {
  if (!iso) return "";
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return hi ? "अभी" : "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (isToday(iso)) return fmtTime(iso, hi);
  const y = new Date(Date.now() - 86400000);
  if (d.toLocaleDateString("en-CA", { timeZone: IST }) === y.toLocaleDateString("en-CA", { timeZone: IST })) return hi ? "कल" : "Yesterday";
  return fmtDay(iso, hi);
}
/** Quick follow-up moments (IST), as ISO. */
export function quickMoments(): { key: "today6" | "tomorrow11" | "d3" | "week"; iso: string }[] {
  const at = (days: number, hour: number) => { const x = new Date(Date.now() + 5.5 * 3600_000); x.setUTCDate(x.getUTCDate() + days); x.setUTCHours(hour, 0, 0, 0); return new Date(x.getTime() - 5.5 * 3600_000); };
  const t6 = at(0, 18); const todayOk = t6.getTime() > Date.now() + 10 * 60000;
  return [{ key: "today6", iso: (todayOk ? t6 : new Date(Date.now() + 2 * 3600_000)).toISOString() }, { key: "tomorrow11", iso: at(1, 11).toISOString() }, { key: "d3", iso: at(3, 11).toISOString() }, { key: "week", iso: at(7, 11).toISOString() }];
}
export const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export const inputCls = "w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand";
export function Chip({ on, onClick, children, tone = "brand" }: { on?: boolean; onClick?: () => void; children: ReactNode; tone?: "brand" | "good" | "danger" }) {
  const onCls = tone === "good" ? "border-good bg-good/10 text-good" : tone === "danger" ? "border-danger bg-danger/10 text-danger" : "border-brand bg-brand-soft text-brand-ink";
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? onCls : "border-border bg-surface text-muted"}`}>{children}</button>;
}
export function Avatar({ name, phone, size = 11 }: { name: string; phone: string; size?: number }) {
  return <div className={`grid h-${size} w-${size} shrink-0 place-items-center rounded-full text-base font-bold text-white`} style={{ background: `hsl(${hue(phone || name)} 55% 50%)`, width: size * 4, height: size * 4 }}>{initial(name, phone)}</div>;
}
export function StagePill({ status, hi }: { status: string; hi: boolean }) {
  const k = ["new", "contacted", "interested", "follow_up", "converted", "lost"].includes(status) ? status : status === "won" ? "converted" : status === "hot" ? "interested" : status === "warm" ? "contacted" : "new";
  const cls: Record<string, string> = { new: "bg-surface2 text-muted", contacted: "bg-ai/10 text-ai", interested: "bg-brand-soft text-brand-ink", follow_up: "bg-lead/15 text-lead", converted: "bg-good/15 text-good", lost: "bg-surface2 text-faint" };
  const label: Record<string, [string, string]> = { new: ["नया", "New"], contacted: ["बात हुई", "Contacted"], interested: ["रुचि है", "Interested"], follow_up: ["Follow-up", "Follow-up"], converted: ["बिका", "Won"], lost: ["गया", "Lost"] };
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls[k]}`}>{label[k][hi ? 0 : 1]}</span>;
}
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-ink">{title}</h3><button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface2" aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  );
}
export async function loadWorkspace(as: string | null): Promise<Workspace | null> {
  const r = await api<Workspace & { error?: string }>(`/api/crm/workspace?x=1${as ? `&as=${as}` : ""}`);
  return r.ok ? r.data : null;
}

/* ---------------- stars (owner, 26 Oct 2026: "star dena") ---------------- */
/** 0–5 stars, kept as one tag star:N on the lead (no new column). */
export const STAR_TAG = /^star:([1-5])$/;
export const starsOf = (tags?: string[] | null) => { for (const t of tags ?? []) { const m = STAR_TAG.exec(t); if (m) return Number(m[1]); } return 0; };
/** Tags as the owner wrote them: the stars tag is shown as stars, never as #star:3. */
export const shownTags = (tags?: string[] | null) => (tags ?? []).filter((t) => !STAR_TAG.test(t) && !/^temp:(hot|warm|cold)$/.test(t));
export function Stars({ value, onChange, size = 18, hi }: { value: number; onChange?: (n: number) => void; size?: number; hi?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? "radiogroup" : "img"} aria-label={`${value}/5 ${hi ? "स्टार" : "stars"}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const star = <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill={on ? "#f5b301" : "none"} stroke={on ? "#f5b301" : "currentColor"} strokeWidth="1.6" strokeLinejoin="round" /></svg>;
        return onChange
          ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`} onClick={(e) => { e.stopPropagation(); onChange(value === n ? 0 : n); }} className="text-faint transition active:scale-90">{star}</button>
          : <span key={n} className={on ? "" : "text-faint"}>{star}</span>;
      })}
    </span>
  );
}

/* ---------------- the last call, first (owner, 26 Oct 2026: "last call kab ki thi, us time kya note add kiya tha — wo jyada zaruri") ---------------- */
export type LastCall = { at: string; outcome: string; seconds: number; note: string; direction?: string } | null;
export function LastCallBox({ call, note, hi, outcomeLabel }: { call: LastCall; note?: { text: string; at: string } | null; hi: boolean; outcomeLabel: (o: string) => string }) {
  const mins = call && call.seconds > 0 ? `${Math.floor(call.seconds / 60)}:${String(call.seconds % 60).padStart(2, "0")} min` : "";
  const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: IST });
  const rel = (iso: string) => {
    const days = Math.round((Date.parse(dayOf(new Date())) - Date.parse(dayOf(new Date(iso)))) / 864e5);
    return days <= 0 ? (hi ? "आज" : "today") : days === 1 ? (hi ? "कल" : "yesterday") : hi ? `${days} दिन पहले` : `${days} days ago`;
  };
  const when = (iso: string) => `${rel(iso)} · ${new Date(iso).toLocaleDateString(hi ? "hi-IN" : "en-IN", { timeZone: IST, day: "numeric", month: "short" })}, ${fmtTime(iso, hi)}`;
  const laterNote = note && (!call || note.at > call.at) ? note : null;
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-brand/20 bg-brand-soft/40 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink">📞 {hi ? "पिछली call" : "Last call"}</p>
        {call ? (
          <>
            <p className="mt-0.5 text-sm font-semibold text-ink">{when(call.at)}</p>
            <p className="text-xs text-muted">{outcomeLabel(call.outcome)}{mins ? ` · ${mins}` : ""}</p>
            {call.note?.trim()
              ? <p className="mt-1.5 whitespace-pre-line rounded-lg bg-surface px-2.5 py-1.5 text-sm text-ink">📝 {call.note.trim().slice(0, 400)}</p>
              : <p className="mt-1 text-xs italic text-faint">{hi ? "उस call पर कोई note नहीं लिखा" : "No note on that call"}</p>}
          </>
        ) : <p className="mt-0.5 text-sm text-muted">{hi ? "अभी तक कोई call नहीं की" : "Not called yet"}</p>}
      </div>
      {laterNote && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink">📝 {hi ? "बाद का note" : "Later note"} <span className="font-normal normal-case text-muted">· {ago(laterNote.at, hi)}</span></p>
          <p className="whitespace-pre-line text-sm text-ink">{laterNote.text.slice(0, 300)}</p>
        </div>
      )}
    </div>
  );
}

/** One line under a name in the lists (owner, 26 Oct 2026): what the customer last said, or the last call's note — whichever is newer —
 *  never our own automatic message. */
export function previewOf(l: Pick<LeadPro, "last_in" | "last_call" | "ai_next" | "city" | "source" | "message">, hi: boolean, outcome?: (o: string) => string): string {
  const c = l.last_call, m = l.last_in;
  if (c && (!m || c.at >= m.at)) return `📞 ${c.note?.trim() || (outcome ? outcome(c.outcome) : c.outcome)}`;
  if (m) return `💬 ${m.text}`;
  if (l.ai_next) return `✨ ${l.ai_next}`;
  return l.city || (hi ? "अभी कोई बात नहीं" : "No conversation yet");
}

/* ---------------- hot / warm / cold (owner, 26 Oct 2026) ---------------- */
export const TEMP_TAG = /^temp:(hot|warm|cold)$/;
export type Temp = "hot" | "warm" | "cold" | "";
/** Set by the owner (tag temp:…); without one, the AI's score ≥ 70 counts as hot. */
export const tempOf = (l: { tags?: string[] | null; score?: number }): Temp => { for (const t of l.tags ?? []) { const m = TEMP_TAG.exec(t); if (m) return m[1] as Temp; } return (l.score ?? 0) >= 70 ? "hot" : ""; };
export const TEMP_LOOK: Record<Exclude<Temp, "">, { icon: string; en: string; hi: string; cls: string }> = {
  hot: { icon: "🔥", en: "Hot", hi: "Hot", cls: "bg-danger/10 text-danger border-danger/30" },
  warm: { icon: "☀️", en: "Warm", hi: "Warm", cls: "bg-amber/15 text-[#b45309] border-amber/40" },
  cold: { icon: "❄️", en: "Cold", hi: "Cold", cls: "bg-brand-soft text-brand-ink border-brand/20" },
};
export function TempPill({ temp, hi, onClick }: { temp: Temp; hi: boolean; onClick?: () => void }) {
  if (!temp && !onClick) return null;
  const t = temp ? TEMP_LOOK[temp] : null;
  const body = <>{t ? `${t.icon} ${hi ? t.hi : t.en}` : (hi ? "+ Hot/Warm/Cold" : "+ Hot/Warm/Cold")}</>;
  const cls = `inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${t ? t.cls : "border-dashed border-border text-muted"}`;
  return onClick ? <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className={cls}>{body}</button> : <span className={cls}>{body}</span>;
}
/** Hot → Warm → Cold → none. */
export const nextTemp = (t: Temp): Temp => (t === "" ? "hot" : t === "hot" ? "warm" : t === "warm" ? "cold" : "");
