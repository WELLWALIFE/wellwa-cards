"use client";
// The admin panel's building blocks (Admin v2, 31 Oct 2026): one look for every page — header, cards, stats, tables, badges,
// buttons, fields, modals, confirm, toasts, empty and loading states. Pages compose these and nothing else.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, Inbox, LoaderCircle, X, type LucideIcon } from "lucide-react";

/* ---------- page ---------- */
export function PageHeader({ title, sub, crumbs, actions }: { title: ReactNode; sub?: ReactNode; crumbs?: { href?: string; label: string }[]; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-xs text-muted">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3 w-3" />}{c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span>{c.label}</span>}</span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, sub, actions, children, className = "", pad = true }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div><h2 className="text-sm font-semibold text-ink">{title}</h2>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = "brand", href }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: "brand" | "good" | "warn" | "danger" | "neutral" | "violet"; href?: string }) {
  const tones = { brand: "bg-brand-soft text-brand-ink", good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", neutral: "bg-surface2 text-muted", violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</span>
        {Icon && <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </>
  );
  const cls = "block rounded-2xl border border-border bg-surface p-4 shadow-sm";
  return href ? <Link href={href} className={`${cls} transition hover:border-brand/50`}>{body}</Link> : <div className={cls}>{body}</div>;
}

/* ---------- table ---------- */
export const th = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-faint whitespace-nowrap";
export const td = "px-4 py-3 align-middle text-sm";
export function Table({ head, children, empty, loading, minW = 640 }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode; loading?: boolean; minW?: number }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: minW }}>
        <thead className="bg-surface2/60"><tr>{head.map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{head.map((_, j) => <td key={j} className={td}><span className="block h-3.5 w-3/4 animate-pulse rounded bg-surface2" /></td>)}</tr>)
            : rows.length ? rows : <tr><td colSpan={head.length} className="px-4 py-10 text-center text-sm text-muted">{empty ?? "Nothing here yet."}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- small things ---------- */
export function Badge({ tone = "neutral", children, dot }: { tone?: "neutral" | "good" | "warn" | "danger" | "brand" | "violet"; children: ReactNode; dot?: boolean }) {
  const t = { neutral: "bg-surface2 text-muted", good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", brand: "bg-brand-soft text-brand-ink", violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${t}`}>{dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{children}</span>;
}
export function Btn({ children, variant = "secondary", size = "md", loading, icon: Icon, className = "", type = "button", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean; icon?: LucideIcon }) {
  const v = { primary: "grad-brand text-white shadow-sm hover:opacity-95", secondary: "border border-border bg-surface text-ink hover:bg-surface2", ghost: "text-muted hover:bg-surface2 hover:text-ink", danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" }[variant];
  const s = size === "sm" ? "h-8 px-2.5 text-xs gap-1" : "h-9 px-3.5 text-sm gap-1.5";
  return (
    <button type={type} {...rest} disabled={rest.disabled || loading} className={`inline-flex items-center justify-center rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon ? <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} /> : null}{children}
    </button>
  );
}
export const inputCls = "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60";
export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs font-semibold text-muted">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}</label>;
}
export function Toggle({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-xl border border-border bg-surface p-3.5 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span><span className="block text-sm font-semibold text-ink">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
      <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-surface2 border border-border"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
export function CopyBtn({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [ok, setOk] = useState(false);
  return <Btn size={size} icon={ok ? Check : Copy} onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }}>{ok ? "Copied" : label}</Btn>;
}
export function Empty({ icon: Icon = Inbox, title, sub, action }: { icon?: LucideIcon; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface2 text-muted"><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-xs text-muted">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Spinner({ className = "py-16" }: { className?: string }) {
  return <div className={`grid place-items-center ${className}`}><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
}
export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{children}</div>;
}
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)} className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition ${value === t.key ? "border-brand font-semibold text-brand-ink" : "border-transparent text-muted hover:text-ink"}`}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- modal / confirm ---------- */
export function Modal({ open, title, sub, onClose, children, footer, width = "max-w-lg" }: { open: boolean; title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className={`relative flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div><h3 className="text-base font-semibold text-ink">{title}</h3>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
type ConfirmOpts = { title: ReactNode; body?: ReactNode; ok?: string; danger?: boolean; ask?: string };
/** `const [confirm, dialog] = useConfirm(); if (await confirm({ title: "Delete?" })) …` — `ask`: a word the person must type (for the irreversible). */
export function useConfirm(): [(o: ConfirmOpts) => Promise<boolean>, ReactNode] {
  const [o, setO] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState("");
  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => { setTyped(""); setO({ ...opts, resolve }); }), []);
  const done = (v: boolean) => { o?.resolve(v); setO(null); };
  const dialog = o ? (
    <Modal open title={o.title} onClose={() => done(false)} width="max-w-md"
      footer={<><Btn onClick={() => done(false)}>Cancel</Btn><Btn variant={o.danger ? "danger" : "primary"} disabled={!!o.ask && typed.trim() !== o.ask} onClick={() => done(true)}>{o.ok ?? "Yes, continue"}</Btn></>}>
      {o.body && <div className="text-sm text-muted">{o.body}</div>}
      {o.ask && <Field label={<>Type <b className="text-ink">{o.ask}</b> to confirm</>} className="mt-3"><input autoFocus className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>}
    </Modal>
  ) : null;
  return [confirm, dialog];
}

/* ---------- toasts ---------- */
type Toast = { id: number; msg: string; tone: "ok" | "err" | "info" };
export function toast(msg: string, tone: Toast["tone"] = "ok") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("admin-toast", { detail: { msg, tone } }));
}
export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ msg: string; tone: Toast["tone"] }>).detail;
      const id = ++n.current;
      setItems((xs) => [...xs, { id, ...d }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), d.tone === "err" ? 6000 : 3200);
    };
    window.addEventListener("admin-toast", on);
    return () => window.removeEventListener("admin-toast", on);
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-80 max-w-[90vw] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-float ${t.tone === "err" ? "bg-red-600 text-white" : t.tone === "info" ? "bg-ink text-bg" : "bg-emerald-600 text-white"}`}>{t.msg}</div>
      ))}
    </div>
  );
}

/* ---------- data helpers ---------- */
export const money = (paise: number | null | undefined) => `₹${Math.round((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
export const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null;
  const d = before ? Math.round(((now - before) / before) * 100) : 100;
  return <span className={`text-[11px] font-semibold ${d >= 0 ? "text-emerald-600" : "text-red-600"}`}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)}% vs last month</span>;
}
export const initials = (s: string) => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
export function Avatar({ name, size = 8 }: { name: string; size?: 7 | 8 | 9 | 10 }) {
  const sz = { 7: "h-7 w-7 text-[10px]", 8: "h-8 w-8 text-xs", 9: "h-9 w-9 text-xs", 10: "h-10 w-10 text-sm" }[size];
  return <span className={`grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-ink ${sz}`}>{initials(name)}</span>;
}
