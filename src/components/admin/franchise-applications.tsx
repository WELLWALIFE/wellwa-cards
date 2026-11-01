"use client";
// Franchise applications from the website (Admin → Franchises → Applications; owner, 1 Nov 2026). Review, note, mark contacted,
// reject — or Approve: one form makes the franchise, its login (temporary password, shown once) and the welcome message to send.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, MessageCircle, Phone, X } from "lucide-react";
import { adminApi, ago, fmtDate } from "@/lib/admin-client";
import { Badge, Btn, Card, CopyBtn, Empty, Field, Modal, Table, Toggle, inputCls, td, toast, useConfirm } from "@/components/admin/ui";
import { STATUS_LABEL, type ApplicationStatus, type FranchiseApplication } from "@/lib/franchise-apply";

type Filter = ApplicationStatus | "all";
type Approved = { franchise: { id: string; code: string; name: string; phone: string }; login: string; created: boolean; hasAccount: boolean; loginError: string; message: string };
const ten = (p: string) => p.replace(/\D/g, "").slice(-10);
const wa = (phone: string, text: string) => `https://wa.me/91${ten(phone)}?text=${encodeURIComponent(text)}`;

export function FranchiseApplications({ canManage, codes, defaults, onApproved }: { canManage: boolean; codes: string[]; defaults: { first: number; renewal: number; canActivate: boolean } | null; onApproved: () => void }) {
  const [rows, setRows] = useState<FranchiseApplication[] | null>(null);
  const [filter, setFilter] = useState<Filter>("new");
  const [open, setOpen] = useState<string>("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [approving, setApproving] = useState<FranchiseApplication | null>(null);
  const [done, setDone] = useState<Approved | null>(null);
  const [confirm, dialog] = useConfirm();

  const load = useCallback(async () => {
    const r = await adminApi<{ applications: FranchiseApplication[] }>("/api/admin/v2/franchise-applications?status=all");
    if (!r.ok) { setErr(r.data.error || "Could not load."); setRows([]); return; }
    setErr(""); setRows(r.data.applications);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function patch(a: FranchiseApplication, body: Record<string, unknown>, said: string) {
    const r = await adminApi<{ application: FranchiseApplication }>("/api/admin/v2/franchise-applications", { method: "PATCH", json: { id: a.id, ...body } });
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    toast(said); await load();
  }
  const counts = (rows ?? []).reduce((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {} as Record<string, number>);
  const shown = (rows ?? []).filter((a) => filter === "all" || a.status === filter);
  const chips: { k: Filter; l: string }[] = [{ k: "new", l: "New" }, { k: "contacted", l: "Contacted" }, { k: "approved", l: "Approved" }, { k: "rejected", l: "Rejected" }, { k: "all", l: "All" }];

  return (
    <div className="space-y-4">
      <Card pad={false} title="Applications from shubhora.com/franchise" sub="Call within 2 working days, agree the territory and the commission, then Approve: the franchise, its login and the welcome message are made in one go."
        actions={<div className="flex flex-wrap gap-1.5">{chips.map((c) => <button key={c.k} type="button" onClick={() => setFilter(c.k)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === c.k ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted hover:text-ink"}`}>{c.l} {c.k === "all" ? rows?.length ?? 0 : counts[c.k] ?? 0}</button>)}</div>}>
        {err && <p className="px-4 py-3 text-sm font-semibold text-danger">{err}</p>}
        {rows && shown.length === 0 && !err ? <Empty title={filter === "new" ? "No new application" : "Nothing here"} sub={filter === "new" ? "New applications land here the moment someone sends the form — you also get a push and a WhatsApp." : undefined} /> : (
          <Table head={["Who", "Where", "Applied", "Status", ""]} minW={760} loading={!rows}>
            {shown.map((a) => {
              const st = STATUS_LABEL[a.status];
              const isOpen = open === a.id;
              return [
                <tr key={a.id} className="hover:bg-surface2/50">
                  <td className={td}>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs text-muted">{ten(a.phone)}{a.company ? ` · ${a.company}` : ""}{a.email ? ` · ${a.email}` : ""}</p>
                  </td>
                  <td className={`${td} text-xs text-muted`}>{[a.city, a.state].filter(Boolean).join(", ")}{a.area && <span className="block">wants: {a.area}</span>}</td>
                  <td className={`${td} text-xs text-muted`} title={fmtDate(a.created_at)}>{ago(a.created_at)}</td>
                  <td className={td}><Badge tone={st.tone} dot>{st.label}</Badge>{a.status === "approved" && a.franchise_id && <Link href={`/admin/franchises/${a.franchise_id}`} className="block text-xs font-semibold text-brand-ink hover:underline">open franchise →</Link>}</td>
                  <td className={`${td} text-right`}>
                    <div className="flex items-center justify-end gap-1.5">
                      <a href={`tel:+91${ten(a.phone)}`} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:text-ink" title="Call"><Phone className="h-3.5 w-3.5" /></a>
                      <a href={wa(a.phone, `Namaste ${a.name.split(" ")[0]} ji, Shubhora se bol raha hoon — aapki franchise application mili. Kab baat kar sakte hain?`)} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-[#25D366]" title="WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></a>
                      {canManage && a.status !== "approved" && <Btn size="sm" variant="primary" icon={Check} onClick={() => setApproving(a)}>Approve</Btn>}
                      <button type="button" onClick={() => { setOpen(isOpen ? "" : a.id); setNote({ ...note, [a.id]: note[a.id] ?? a.note }); }} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:text-ink" aria-label="Details">{isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
                    </div>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${a.id}-d`} className="bg-bg/60">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
                        <div className="space-y-2 text-sm">
                          <p><span className="text-xs font-semibold uppercase tracking-wide text-muted">Why them</span><br />{a.background || <span className="text-muted">— not written —</span>}</p>
                          {a.reach && <p><span className="text-xs font-semibold uppercase tracking-wide text-muted">Reach</span><br />{a.reach}</p>}
                          <p className="text-xs text-muted">Applied {fmtDate(a.created_at)} · source {a.source}{a.decided_at ? ` · decided ${fmtDate(a.decided_at)}` : ""}</p>
                        </div>
                        <div className="space-y-2">
                          <Field label="Notes (calls, terms agreed)"><textarea className={inputCls} rows={3} disabled={!canManage} value={note[a.id] ?? a.note} onChange={(e) => setNote({ ...note, [a.id]: e.target.value })} /></Field>
                          {canManage && a.status !== "approved" && (
                            <div className="flex flex-wrap gap-1.5">
                              <Btn size="sm" onClick={() => void patch(a, { note: note[a.id] ?? a.note }, "Note saved.")}>Save note</Btn>
                              {a.status === "new" && <Btn size="sm" onClick={() => void patch(a, { status: "contacted", note: note[a.id] ?? a.note }, "Marked contacted.")}>Mark contacted</Btn>}
                              {a.status !== "rejected" && <Btn size="sm" variant="danger" icon={X} onClick={async () => { if (await confirm({ title: `Reject ${a.name}'s application?`, body: "They are not told automatically — tell them yourself if you wish. It stays in the list under Rejected.", danger: true, ok: "Reject" })) void patch(a, { status: "rejected", note: note[a.id] ?? a.note }, "Rejected."); }}>Reject</Btn>}
                              {a.status === "rejected" && <Btn size="sm" onClick={() => void patch(a, { status: "new" }, "Back to New.")}>Reopen</Btn>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </Table>
        )}
      </Card>

      {approving && <ApproveModal app={approving} codes={codes} defaults={defaults} onClose={() => setApproving(null)} onDone={(r) => { setApproving(null); setDone(r); void load(); onApproved(); }} />}
      {done && (
        <Modal open title={`${done.franchise.code} is live`} sub={`${done.franchise.name} — send them the welcome message now.`} width="max-w-xl" onClose={() => setDone(null)}
          footer={<Btn variant="primary" onClick={() => setDone(null)}>Done</Btn>}>
          <div className="space-y-3 text-sm">
            {done.loginError ? <p className="rounded-xl border border-amber-400/60 bg-amber-50 px-3 py-2 text-amber-900"><b>Login not made:</b> {done.loginError}</p> : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Login</p><p className="font-semibold">{done.login}</p></div>
                <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Password</p><p className="text-sm font-semibold">{done.hasAccount ? "Their existing Shubhora password" : "The one they set in the application"}</p></div>
              </div>
            )}
            <pre className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 text-xs leading-relaxed">{done.message}</pre>
            <div className="flex flex-wrap gap-2">
              <a href={wa(done.franchise.phone, done.message)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> Send on WhatsApp</a>
              <CopyBtn size="md" text={done.message} label="Copy message" />
              <Link href={`/admin/franchises/${done.franchise.id}`} className="inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-semibold hover:bg-surface2">Open the franchise</Link>
            </div>
          </div>
        </Modal>
      )}
      {dialog}
    </div>
  );
}

function ApproveModal({ app, codes, defaults, onClose, onDone }: { app: FranchiseApplication; codes: string[]; defaults: { first: number; renewal: number; canActivate: boolean } | null; onClose: () => void; onDone: (r: Approved) => void }) {
  const suggest = (city: string) => { const base = city.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6); if (!base) return ""; let n = 1; while (codes.includes(`${base}${String(n).padStart(2, "0")}`)) n += 1; return `${base}${String(n).padStart(2, "0")}`; };
  const [f, setF] = useState({ code: suggest(app.city), login: ten(app.phone), area: app.area || app.city, company: app.company, email: app.email, commission_first_pct: String(defaults?.first ?? 20), commission_renewal_pct: String(defaults?.renewal ?? 10), can_activate: defaults?.canActivate ?? false });
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await adminApi<Approved>("/api/admin/v2/franchise-applications", { json: { id: app.id, ...f } });
    setBusy(false);
    if (!r.ok) { toast(r.data.error || "Could not approve.", "err"); return; }
    onDone(r.data);
  }
  return (
    <Modal open title={`Approve ${app.name}`} sub={`${[app.city, app.state].filter(Boolean).join(", ")} · ${ten(app.phone)} — check the terms you agreed on the call.`} width="max-w-2xl" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon={Check} loading={busy} disabled={!/^[A-Z0-9]{3,16}$/.test(f.code) || !f.login} onClick={() => void go()}>Approve & create login</Btn></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Franchise code" hint="Goes in their sign-up link. Cannot be changed later."><input className={`${inputCls} font-mono uppercase`} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) })} /></Field>
        <Field label="Panel login (mobile or e-mail)" hint={app.has_account ? "This mobile already has a Shubhora account — they log in with that password." : "They log in at /admin/login with this and the password they set in the application."}><input className={inputCls} value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} /></Field>
        <Field label="Territory"><input className={inputCls} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
        <Field label="Company / firm"><input className={inputCls} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
        <Field label="Commission, first payment (%)" hint="Of the amount without GST."><input type="number" min={0} max={100} step={0.5} className={inputCls} value={f.commission_first_pct} onChange={(e) => setF({ ...f, commission_first_pct: e.target.value })} /></Field>
        <Field label="Commission, renewals (%)"><input type="number" min={0} max={100} step={0.5} className={inputCls} value={f.commission_renewal_pct} onChange={(e) => setF({ ...f, commission_renewal_pct: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Toggle on={f.can_activate} onChange={(v) => setF({ ...f, can_activate: v })} label="May activate plans for its users" hint="For payments the franchise takes by hand. Can be changed later." /></div>
      </div>
      <p className="mt-3 text-xs text-muted">On Approve: the franchise is created (active), its login is made with the password the applicant chose, and a welcome message with the login, the sign-up link and the commission is ready to send on WhatsApp.</p>
    </Modal>
  );
}
