"use client";
// Staff & roles (Admin v2): who may open this panel and what each may do. A person = their Shubhora login (e-mail or mobile)
// + a role (a ready bundle of rights, changeable per person). New logins get a temporary password shown once here.
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, ShieldOff, Trash2, UserCog } from "lucide-react";
import { adminApi, ago, useAdminMe } from "@/lib/admin-client";
import { RIGHTS, RIGHT_GROUPS, ROLES, roleLabel, type Right, type Role } from "@/lib/admin-rights";
import { Avatar, Badge, Btn, Card, CopyBtn, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Table, inputCls, td, toast, useConfirm } from "@/components/admin/ui";

type Member = { id: string; email: string; name: string; phone: string; role: Role; rights: Right[]; franchise_id: string | null; active: boolean; must_change_password: boolean; last_login_at: string | null; created_at: string };
type Fr = { id: string; code: string; name: string };
const login = (m: Member) => (/^p91(\d{10})@phone\./.test(m.email) ? `+91 ${m.email.slice(3, 8)} ${m.email.slice(8, 13)}` : m.email);

function RightsPicker({ role, rights, onRole, onRights, franchises, franchiseId, onFranchise, canSuper }: { role: Role; rights: Right[]; onRole: (r: Role) => void; onRights: (r: Right[]) => void; franchises: Fr[]; franchiseId: string | null; onFranchise: (id: string | null) => void; canSuper: boolean }) {
  const preset = ROLES.find((r) => r.key === role);
  const custom = role === "custom" || (preset && preset.rights.join() !== rights.join() && role !== "super_admin");
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Role</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ROLES.filter((r) => canSuper || r.key !== "super_admin").map((r) => (
            <button key={r.key} type="button" onClick={() => { onRole(r.key); onRights(r.rights); }} className={`rounded-xl border p-3 text-left transition ${role === r.key ? "border-brand bg-brand-soft" : "border-border hover:bg-surface2"}`}>
              <span className="block text-sm font-semibold text-ink">{r.label}</span><span className="block text-[11px] text-muted">{r.hint}</span>
            </button>
          ))}
        </div>
      </div>
      {role === "franchise" && (
        <Field label="Which franchise" hint="This login sees only that franchise's users and earnings.">
          <select className={inputCls} value={franchiseId ?? ""} onChange={(e) => onFranchise(e.target.value || null)}>
            <option value="">— pick —</option>
            {franchises.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}
          </select>
        </Field>
      )}
      {role !== "super_admin" && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Rights {custom && <Badge tone="brand">custom</Badge>}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {RIGHT_GROUPS.map((g) => (
              <div key={g} className="rounded-xl border border-border p-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">{g}</p>
                {RIGHTS.filter((r) => r.group === g).map((r) => (
                  <label key={r.key} className="flex items-start gap-2 py-1 text-xs">
                    <input type="checkbox" className="mt-0.5" checked={rights.includes(r.key)} onChange={(e) => onRights(e.target.checked ? [...rights, r.key] : rights.filter((x) => x !== r.key))} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  const { me } = useAdminMe();
  const [list, setList] = useState<Member[] | null>(null);
  const [franchises, setFranchises] = useState<Fr[]>([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Member | null>(null);
  const [form, setForm] = useState<{ login: string; name: string; role: Role; rights: Right[]; franchise_id: string | null }>({ login: "", name: "", role: "support", rights: ROLES[2].rights, franchise_id: null });
  const [busy, setBusy] = useState("");
  const [secret, setSecret] = useState<{ who: string; login: string; password: string; created: boolean } | null>(null);
  const [confirm, dialog] = useConfirm();
  const canSuper = me?.role === "super_admin";

  const load = useCallback(async () => {
    const r = await adminApi<{ staff: Member[]; franchises: Fr[] }>("/api/admin/v2/staff");
    if (!r.ok) { setErr(r.data.error || "Could not load."); setList([]); return; }
    setList(r.data.staff); setFranchises(r.data.franchises); setErr("");
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy("add");
    const r = await adminApi<{ member: Member; password?: string; created?: boolean }>("/api/admin/v2/staff", { json: form });
    setBusy("");
    if (!r.ok) { toast(r.data.error || "Could not add.", "err"); return; }
    setAdding(false);
    setSecret({ who: form.name, login: form.login, password: r.data.password ?? "", created: !!r.data.created });
    setForm({ login: "", name: "", role: "support", rights: ROLES[2].rights, franchise_id: null });
    await load();
  }
  async function save() {
    if (!edit) return;
    setBusy("save");
    const r = await adminApi<{ member: Member }>("/api/admin/v2/staff", { method: "PATCH", json: { id: edit.id, name: edit.name, role: edit.role, rights: edit.rights, franchise_id: edit.franchise_id } });
    setBusy("");
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    toast("Saved."); setEdit(null); await load();
  }
  async function toggleActive(m: Member) {
    if (!(await confirm({ title: m.active ? `Stop ${m.name}'s admin access?` : `Give ${m.name} access again?`, body: m.active ? "They are logged out of the panel at once. Their Shubhora account itself keeps working." : "", ok: m.active ? "Stop access" : "Give access", danger: m.active }))) return;
    const r = await adminApi("/api/admin/v2/staff", { method: "PATCH", json: { id: m.id, active: !m.active } });
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    await load();
  }
  async function resetPw(m: Member) {
    if (!(await confirm({ title: `Reset ${m.name}'s password?`, body: "A new temporary password is made; they must change it at their next login.", ok: "Reset password" }))) return;
    const r = await adminApi<{ password: string }>("/api/admin/v2/staff", { json: { op: "reset_password", id: m.id } });
    if (!r.ok) { toast(r.data.error || "Could not reset.", "err"); return; }
    setSecret({ who: m.name, login: login(m), password: r.data.password, created: false });
  }
  async function resetMfa(m: Member) {
    if (!(await confirm({ title: `Reset ${m.name}'s 2-step?`, body: "For someone who lost their phone. Their authenticator is removed; they set it up again at the next login.", ok: "Reset 2-step", danger: true }))) return;
    const r = await adminApi("/api/admin/v2/staff", { json: { op: "reset_mfa", id: m.id } });
    toast(r.ok ? "2-step reset." : r.data.error || "Could not reset.", r.ok ? "ok" : "err");
  }
  async function remove(m: Member) {
    if (!(await confirm({ title: `Remove ${m.name} from the admin panel?`, body: "Their admin access ends now. Their Shubhora account and everything in it stay as they are.", ok: "Remove", danger: true, ask: "REMOVE" }))) return;
    const r = await adminApi(`/api/admin/v2/staff?id=${m.id}`, { method: "DELETE" });
    if (!r.ok) { toast(r.data.error || "Could not remove.", "err"); return; }
    toast("Removed.", "info"); await load();
  }
  const frName = (id: string | null) => franchises.find((f) => f.id === id)?.code ?? "";

  return (
    <div className="space-y-5">
      <PageHeader title="Staff & roles" sub="Who can open this panel and what each person may do. Every action they take is written in the audit log."
        actions={<Btn variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add staff</Btn>} />
      {err && <ErrorBox>{err}</ErrorBox>}
      {list === null ? <Spinner /> : list.length === 0 ? <Empty icon={UserCog} title="No staff yet" sub="Add your manager, support and accounts people — each with their own login and only the rights they need." action={<Btn variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add staff</Btn>} /> : (
        <Card pad={false}>
          <Table head={["Person", "Role", "Rights", "Franchise", "2-step / last login", "Status", ""]} minW={900}>
            {list.map((m) => (
              <tr key={m.id} className={`hover:bg-surface2/50 ${m.active ? "" : "opacity-60"}`}>
                <td className={td}><div className="flex items-center gap-2.5"><Avatar name={m.name || m.email} /><div className="min-w-0"><p className="truncate font-semibold text-ink">{m.name}{m.id === me?.id && <span className="ml-1 text-[10px] text-muted">(you)</span>}</p><p className="truncate text-xs text-muted">{login(m)}</p></div></div></td>
                <td className={td}><Badge tone={m.role === "super_admin" ? "violet" : m.role === "franchise" ? "brand" : "neutral"}>{roleLabel(m.role)}</Badge></td>
                <td className={`${td} text-xs text-muted`}>{m.role === "super_admin" ? "everything" : `${m.rights.length} of ${RIGHTS.length}`}</td>
                <td className={`${td} text-xs text-muted`}>{frName(m.franchise_id) || "—"}</td>
                <td className={`${td} text-xs text-muted`}>{m.must_change_password ? <Badge tone="warn">not logged in yet</Badge> : m.last_login_at ? ago(m.last_login_at) : "never"}</td>
                <td className={td}>{m.active ? <Badge tone="good" dot>Active</Badge> : <Badge tone="danger">Stopped</Badge>}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <Btn size="sm" onClick={() => setEdit({ ...m })}>Edit</Btn>
                  <Btn size="sm" variant="ghost" icon={KeyRound} title="Reset password" onClick={() => void resetPw(m)} className="ml-1" />
                  <Btn size="sm" variant="ghost" icon={ShieldOff} title="Reset 2-step" onClick={() => void resetMfa(m)} />
                  {m.id !== me?.id && <Btn size="sm" variant="ghost" onClick={() => void toggleActive(m)}>{m.active ? "Stop" : "Start"}</Btn>}
                  {m.id !== me?.id && <Btn size="sm" variant="ghost" icon={Trash2} title="Remove" onClick={() => void remove(m)} className="text-red-600" />}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> How roles work</span>}>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => <div key={r.key} className="rounded-xl bg-bg p-3"><p className="font-semibold text-ink">{r.label}</p><p className="text-xs text-muted">{r.hint}</p></div>)}
        </div>
        <p className="mt-3 text-xs text-muted">A franchise login sees the same panel with fewer pages and only its own users. Rights can be changed per person at any time; they apply from their next request.</p>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add staff" sub="They log in at shubhora.com/admin/login with this e-mail or mobile and the temporary password you get next." width="max-w-2xl"
        footer={<><Btn onClick={() => setAdding(false)}>Cancel</Btn><Btn variant="primary" loading={busy === "add"} disabled={!form.login.trim() || !form.name.trim() || (form.role === "franchise" && !form.franchise_id)} onClick={() => void create()}>Create login</Btn></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" /></Field>
            <Field label="Login: e-mail or mobile" hint="An existing Shubhora account with this login gets admin access; otherwise a new login is made."><input className={inputCls} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="priya@company.com or 98765 43210" /></Field>
          </div>
          <RightsPicker role={form.role} rights={form.rights} onRole={(role) => setForm({ ...form, role })} onRights={(rights) => setForm({ ...form, rights })} franchises={franchises} franchiseId={form.franchise_id} onFranchise={(franchise_id) => setForm({ ...form, franchise_id })} canSuper={!!canSuper} />
        </div>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Edit ${edit.name}` : ""} sub={edit ? login(edit) : ""} width="max-w-2xl"
        footer={<><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn variant="primary" loading={busy === "save"} onClick={() => void save()}>Save</Btn></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Name"><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <RightsPicker role={edit.role} rights={edit.rights} onRole={(role) => setEdit({ ...edit, role })} onRights={(rights) => setEdit({ ...edit, rights })} franchises={franchises} franchiseId={edit.franchise_id} onFranchise={(franchise_id) => setEdit({ ...edit, franchise_id })} canSuper={!!canSuper} />
          </div>
        )}
      </Modal>

      <Modal open={!!secret} onClose={() => setSecret(null)} title={secret?.created ? "Login created" : "Temporary password"} sub="Shown once. Send it to the person on a channel you trust; they must change it at their first login." width="max-w-md"
        footer={<Btn variant="primary" onClick={() => setSecret(null)}>Done</Btn>}>
        {secret && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Login</p><p className="font-semibold">{secret.login}</p></div>
            <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Temporary password</p><p className="font-mono text-lg font-semibold tracking-wide">{secret.password || "(unchanged)"}</p></div>
            <div className="flex gap-2"><CopyBtn size="md" text={`Shubhora Admin\nLogin: ${location.origin}/admin/login\nUser: ${secret.login}\nTemporary password: ${secret.password}\nChange it at your first login and set up 2-step (Security).`} label="Copy message" /></div>
          </div>
        )}
      </Modal>
      {dialog}
    </div>
  );
}
