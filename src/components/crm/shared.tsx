"use client";
// Shared bits of the CRM Pro screens (docs/crm-pro.md): the workspace (who am I here, what is connected), the lead
// shape with the phase-1 columns, date helpers in IST, and small UI atoms every screen uses.
import { createContext, useContext, type ReactNode } from "react";
import { api } from "@/lib/poster-client";
import type { Ctx, Wa, Team, Agent, Lead } from "@/components/crm/crm";
import type { CrmStrings } from "@/components/crm/i18n";

export type LeadPro = Lead & { kind: "lead" | "customer" | "lost"; alt_phone: string; business: string; address: string; pincode: string; birthday: string | null; anniversary: string | null; lang: string; product_ids: string[]; budget_paise: number; last_activity_at: string; last_call_at: string | null; calls_count: number; opted_out?: boolean };
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
