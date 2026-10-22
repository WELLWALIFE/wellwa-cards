"use client";
// CRM Pro (owner's call, 21 Oct 2026 — docs/crm-pro.md): Today · Customers · Calendar · Reports · Settings, a customer's
// screen with everything on it, tap-to-call with the outcome sheet, the call list. The old CRM's sheets (quick replies,
// team, menu bot, integrations, import) live on under Settings; /poster/leads keeps Bookings / Phone / WhatsApp / Teach bot.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Users } from "lucide-react";
import { isLoggedIn } from "@/lib/poster-client";
import { useCrmT } from "@/components/crm/i18n";
import { Shell, loadWorkspace, type Workspace, type LeadPro, type CrmShell } from "@/components/crm/shared";
import { CallReturnWatcher, CallOutcomeSheet, CallList, CloudCallSheet, dial, type CallListItem, type PendingCall } from "@/components/crm/call";
import { TodayScreen } from "@/components/crm/today";
import { CustomersList } from "@/components/crm/list";
import { CustomerScreen } from "@/components/crm/customer";
import { CalendarSection } from "@/components/crm/tasks";
import { SettingsSection, ReportsSection } from "@/components/crm/settings";
import type { Ctx } from "@/components/crm/crm";

const WS_KEY = "akp-crm-ws";
let loggedCb: (() => void) | null = null;   // what to do once the call outcome is saved (the call list moves on)
type Section = "today" | "customers" | "calendar" | "reports" | "settings";

function CrmPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const L = useCrmT();
  const [ready, setReady] = useState(false);
  const [as, setAs] = useState<string | null>(() => { try { return localStorage.getItem(WS_KEY); } catch { return null; } });
  const [ws, setWs] = useState<Workspace | null>(null);
  const [wsErr, setWsErr] = useState("");
  const [section, setSection] = useState<Section>(() => { const s = sp.get("s"); return s === "customers" || s === "calendar" || s === "reports" || s === "settings" ? s : "today"; });
  const [customer, setCustomer] = useState<string | null>(sp.get("lead"));
  const [callList, setCallList] = useState<CallListItem[] | null>(null);
  const [desktopCall, setDesktopCall] = useState<PendingCall | null>(null);
  const [cloudCall, setCloudCall] = useState<Pick<LeadPro, "id" | "name" | "phone" | "status"> | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/crm${window.location.search}`)}`); return; } setReady(true); })(); }, [router]);
  const loadWs = useCallback(async () => {
    const w = await loadWorkspace(as);
    if (!w) { if (as) { setAs(null); try { localStorage.removeItem(WS_KEY); } catch { /* ignore */ } return; } setWsErr(L.failed); return; }
    setWs(w); setWsErr("");
  }, [as, L.failed]);
  useEffect(() => { if (ready) loadWs(); }, [ready, loadWs]);
  // Deep links: ?lead=<id> opens the customer, ?s= the section (push notifications and the old Leads page use them).
  useEffect(() => { const lead = sp.get("lead"); if (lead) setCustomer(lead); }, [sp]);

  const ctx = useMemo<Ctx>(() => (ws ? { as: ws.ownerId === ws.me ? null : ws.ownerId, role: ws.role, me: ws.me, agents: ws.agents, upi: ws.upi, payee: ws.payee } : { as: null, role: "owner", me: "", agents: [] }), [ws]);
  const hasLine = !!ws?.line, askOutcome = ws?.prefs.ask_outcome ?? true;
  const startCall = useCallback((lead: Pick<LeadPro, "id" | "name" | "phone" | "status">, onLogged?: () => void) => {
    loggedCb = onLogged ?? null;
    // Phase 2: a tenant with an outbound Shubhora number calls through Exotel (works from a laptop too; recorded).
    if (hasLine) { setCloudCall(lead); return; }
    if (!askOutcome) { window.location.href = `tel:${lead.phone}`; return; }
    dial(lead, setDesktopCall);
  }, [hasLine, askOutcome]);
  const notifyLogged = useCallback(() => { const f = loggedCb; loggedCb = null; f?.(); setTick((t) => t + 1); }, []);
  const shell = useMemo<CrmShell | null>(() => ws ? {
    ws, ctx, L, as: ws.ownerId === ws.me ? null : ws.ownerId,
    openCustomer: (id: string) => { setCustomer(id); window.scrollTo({ top: 0 }); },
    startCall,
    reload: () => setTick((t) => t + 1),
    version: tick,
    notifyLogged,
  } : null, [ws, ctx, L, tick, startCall, notifyLogged]);

  const switchWs = (id: string | null) => { setAs(id); setWs(null); setCustomer(null); setCallList(null); try { if (id) localStorage.setItem(WS_KEY, id); else localStorage.removeItem(WS_KEY); } catch { /* ignore */ } };
  if (!ready || (!ws && !wsErr)) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (!ws || !shell) return <div className="space-y-3 py-16 text-center"><p className="text-sm text-danger">{wsErr}</p><button type="button" onClick={loadWs} className="rounded-xl border border-border px-4 py-2 text-sm">↻</button></div>;
  const firstName = (ws.business || "").split(/\s+/)[0] || "";
  const sections: [Section, string][] = [["today", L.today], ["customers", L.customers], ["calendar", L.calendar], ["reports", L.reports], ["settings", L.settings]];

  return (
    <Shell.Provider value={shell}>
      <div className="@container"><div className="space-y-3 @3xl:grid @3xl:grid-cols-[180px_1fr] @3xl:gap-4 @3xl:space-y-0">
        {/* section switch: pills on the phone, a rail on a laptop */}
        <div className="space-y-2 @3xl:sticky @3xl:top-20 @3xl:self-start">
          {(ws.teams.length > 0 || as) && (
            <div className="flex gap-1.5 overflow-x-auto text-xs [scrollbar-width:none] @3xl:flex-col">
              <button type="button" onClick={() => switchWs(null)} className={`shrink-0 rounded-full border px-2.5 py-1 font-semibold ${!as ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>{L.hi ? "मेरा CRM" : "My CRM"}</button>
              {ws.teams.map((t) => <button key={t.owner_id} type="button" onClick={() => switchWs(t.owner_id)} className={`shrink-0 rounded-full border px-2.5 py-1 font-semibold ${as === t.owner_id ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}><Users className="mr-1 inline h-3 w-3" />{t.owner_name} · {t.role}</button>)}
            </div>
          )}
          <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-0.5 text-sm font-semibold [scrollbar-width:none] @3xl:flex-col @3xl:rounded-2xl @3xl:p-1">
            {sections.map(([k, t]) => <button key={k} type="button" onClick={() => { setSection(k); setCustomer(null); setCallList(null); router.replace(`/poster/crm?s=${k}`); }} className={`shrink-0 rounded-full px-3 py-1.5 @3xl:rounded-xl @3xl:text-left ${section === k && !customer ? "grad-brand text-white" : "text-muted"}`}>{t}</button>)}
          </div>
        </div>
        <div className="min-w-0">
          {customer && section === "customers" ? (
            <div className="@5xl:grid @5xl:grid-cols-[minmax(280px,1fr)_minmax(0,1.4fr)] @5xl:gap-4">
              <div className="hidden @5xl:block"><CustomersList onCallThese={(leads) => { setCustomer(null); setCallList(leads.map((lead) => ({ lead, why: lead.ai_next || lead.ai_intent || "" }))); }} /></div>
              <CustomerScreen key={customer} id={customer} onBack={() => { setCustomer(null); shell.reload(); }} />
            </div>
          ) : customer ? <CustomerScreen key={customer} id={customer} onBack={() => { setCustomer(null); shell.reload(); }} />
            : callList ? <CallList items={callList} onExit={() => setCallList(null)} />
            : section === "today" ? <TodayScreen firstName={firstName} onCallList={setCallList} />
            : section === "customers" ? <CustomersList onCallThese={(leads) => setCallList(leads.map((lead) => ({ lead, why: lead.ai_next || lead.ai_intent || "" })))} />
            : section === "calendar" ? <CalendarSection />
            : section === "reports" ? <ReportsSection />
            : <SettingsSection onChanged={loadWs} />}
        </div>
      </div></div>
      <CallReturnWatcher />
      {desktopCall && <CallOutcomeSheet pending={desktopCall} dialHint onSaved={shell.notifyLogged} onClose={() => setDesktopCall(null)} />}
      {cloudCall && <CloudCallSheet lead={cloudCall} onFallback={() => { const l = cloudCall; setCloudCall(null); dial(l, setDesktopCall); }} onClose={() => setCloudCall(null)} />}
    </Shell.Provider>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><CrmPage /></Suspense>;
}
