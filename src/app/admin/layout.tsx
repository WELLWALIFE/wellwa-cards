"use client";
// The admin panel's shell (Admin v2, 31 Oct 2026 — owner: "professional admin panel, jugaad nahi"). One shell for every
// admin login: Super Admin, staff with their rights, and franchises (who see the same panel with fewer pages and only their
// own users). The menu comes from the person's rights (src/lib/admin-rights.ts); the APIs check the same rights again.
// Not logged in → /admin/login. 2-step or a first password still to do → /admin/security. Not an admin → a plain "no access".
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, ChevronDown, LogOut, Menu, Search, ShieldAlert, ShieldCheck, Store, X, Command, Headset, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PartnerAdminButton } from "@/components/partner-admin-button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { adminApi, useAdminMe } from "@/lib/admin-client";
import { MENU, menuFor, roleLabel, type AdminMe } from "@/lib/admin-rights";
import { Avatar, Spinner, ToastHost } from "@/components/admin/ui";

const ALL = MENU.flatMap((g) => g.items);
const isActive = (href: string, path: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
const BARE = ["/admin/login"];

function Brand({ me }: { me: AdminMe | null }) {
  const tag = me?.franchise ? `Franchise · ${me.franchise.code}` : me?.role === "super_admin" ? "Super Admin" : me ? roleLabel(me.role) : "Admin";
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/app-192.png" alt="" className="h-9 w-9 rounded-xl shadow-sm" />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">Shubhora</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{tag}</span>
      </span>
    </Link>
  );
}

function NavList({ me, path, onPick }: { me: AdminMe | null; path: string; onPick?: () => void }) {
  const groups = menuFor(me);
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.title || "top"} className={g.title ? "mt-5" : ""}>
          {g.title && <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const on = isActive(href, path);
              return (
                <Link key={href} href={href} onClick={onPick} aria-current={on ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${on ? "bg-brand-soft font-semibold text-brand-ink" : "text-muted hover:bg-surface2 hover:text-ink"}`}>
                  {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand" />}
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={on ? 2.2 : 1.9} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Cmd+K: find a user (name, mobile, e-mail, username, business) or a franchise and jump to it. */
function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ type: string; id: string; title: string; sub: string; href: string }[]>([]);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setQ(""); setHits([]); setI(0); } }, [open]);
  useEffect(() => {
    if (!open || q.trim().length < 2) { setHits([]); return; }
    let off = false; setBusy(true);
    const t = setTimeout(async () => {
      const r = await adminApi<{ hits: typeof hits }>(`/api/admin/v2/search?q=${encodeURIComponent(q.trim())}`);
      if (!off) { setHits(r.ok ? r.data.hits : []); setI(0); setBusy(false); }
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [q, open]);
  if (!open) return null;
  const go = (h: (typeof hits)[number]) => { onClose(); router.push(h.href); };
  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center bg-black/50 p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by name, mobile, e-mail, username… or a franchise"
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(hits.length - 1, x + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); } if (e.key === "Enter" && hits[i]) go(hits[i]); }}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {q.trim().length < 2 ? <p className="px-3 py-6 text-center text-xs text-muted">Type at least 2 letters or 4 digits.</p>
            : busy && !hits.length ? <p className="px-3 py-6 text-center text-xs text-muted">Searching…</p>
            : !hits.length ? <p className="px-3 py-6 text-center text-xs text-muted">Nothing found for “{q}”.</p>
            : hits.map((h, k) => (
              <button key={`${h.type}:${h.id}`} type="button" onMouseEnter={() => setI(k)} onClick={() => go(h)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${k === i ? "bg-brand-soft" : "hover:bg-surface2"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${h.type === "franchise" ? "bg-violet-100 text-violet-700" : "bg-surface2 text-muted"}`}>{h.type === "franchise" ? <Store className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{h.title}</span>{h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}</span>
                <span className="text-[10px] uppercase tracking-wider text-faint">{h.type}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/admin";
  const router = useRouter();
  const bare = BARE.some((p) => path.startsWith(p));
  const { me, all, status, error, reload } = useAdminMe();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Where to send someone who cannot use the panel yet.
  useEffect(() => {
    if (bare || status === "loading") return;
    if (status === "anon") router.replace(`/admin/login?next=${encodeURIComponent(path)}`);
    else if ((status === "mfa" || status === "password") && !path.startsWith("/admin/security")) router.replace(`/admin/security?need=${status === "mfa" ? "mfa_required" : "password_change_required"}&next=${encodeURIComponent(path)}`);
  }, [status, bare, path, router]);
  useEffect(() => { setOpen(false); setMenu(false); }, [path]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); }
      if (e.key === "Escape") { setOpen(false); setMenu(false); }
    };
    const click = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("keydown", key); window.addEventListener("mousedown", click);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("mousedown", click); };
  }, []);
  const logout = useCallback(async () => {
    try { sessionStorage.removeItem("ne-admin-key"); sessionStorage.removeItem("ne-admin-scope"); sessionStorage.removeItem("ne-admin-who"); } catch { /* ignore */ }
    try { await getBrowserSupabase()?.auth.signOut(); } catch { /* ignore */ }
    router.replace("/admin/login");
  }, [router]);

  if (bare) return <>{children}<ToastHost /></>;
  if (status === "loading" || status === "anon") return <div className="grid min-h-screen place-items-center bg-bg"><Spinner /></div>;
  if (status === "blocked") {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-float">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><ShieldAlert className="h-6 w-6" /></span>
          <h1 className="mt-3 text-lg font-semibold">No admin access</h1>
          <p className="mt-1 text-sm text-muted">{error || "This login is not an admin of Shubhora. Ask the Super Admin to add you under Staff & roles."}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/poster" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Open the app</Link>
            <button type="button" onClick={() => void logout()} className="rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white">Log in as someone else</button>
          </div>
        </div>
      </div>
    );
  }
  const securityOnly = status === "mfa" || status === "password";
  const here = ALL.find((i) => isActive(i.href, path)) ?? (path.startsWith("/admin/security") ? { label: "Security", href: "/admin/security" } : path.startsWith("/admin/users/") ? { label: "User", href: "/admin/users" } : path.startsWith("/admin/franchises/") ? { label: "Franchise", href: "/admin/franchises" } : ALL[0]);
  const group = MENU.find((g) => g.items.some((i) => i.href === here.href))?.title;
  const alerts = (all?.alerts.payouts ?? 0) + (all?.alerts.pending ?? 0);
  const needMfa = !!me && me.via === "session" && !me.mfaEnrolled && !path.startsWith("/admin/security");

  return (
    <div className="flex min-h-screen bg-bg">
      {!securityOnly && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <div className="flex h-16 items-center border-b border-border px-5"><Brand me={me} /></div>
          <NavList me={me} path={path} />
          <div className="space-y-1 border-t border-border p-3">
            {me?.rights.includes("partner.panel") && <PartnerAdminButton />}
            <Link href="/poster" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to app</Link>
          </div>
        </aside>
      )}
      {open && !securityOnly && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-float">
            <div className="flex h-16 items-center justify-between border-b border-border px-4"><Brand me={me} /><button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-5 w-5" /></button></div>
            <NavList me={me} path={path} onPick={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/85 px-4 backdrop-blur md:px-6">
          {!securityOnly && <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-ink md:hidden"><Menu className="h-5 w-5" /></button>}
          <div className="min-w-0 flex-1">
            {group && <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{group}</p>}
            <p className="truncate text-[15px] font-semibold tracking-tight text-ink">{here.label}</p>
          </div>
          {!securityOnly && me?.rights.some((r) => r === "users.view" || r === "franchises.view") && (
            <button type="button" onClick={() => setPalette(true)} className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted hover:text-ink sm:inline-flex">
              <Search className="h-4 w-4" /> Search <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-border px-1.5 text-[10px]"><Command className="h-2.5 w-2.5" />K</kbd>
            </button>
          )}
          {!securityOnly && alerts > 0 && (
            <Link href={me?.franchise ? "/admin/earnings" : "/admin/franchises?tab=payouts"} className="relative grid h-9 w-9 place-items-center rounded-lg border border-border text-ink" title={`${alerts} payout${alerts === 1 ? "" : "s"} waiting`}>
              <Bell className="h-4 w-4" /><span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{alerts}</span>
            </Link>
          )}
          <ThemeToggle />
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface pl-1 pr-2 text-sm">
              <Avatar name={me?.name || me?.email || "A"} size={7} />
              <span className="hidden max-w-[140px] truncate font-semibold sm:block">{me?.name || me?.email}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </button>
            {menu && (
              <div className="absolute right-0 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-float">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-semibold text-ink">{me?.name}</p>
                  <p className="truncate text-xs text-muted">{me?.email}</p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-ink">{me?.franchise ? `Franchise · ${me.franchise.code}` : roleLabel(me?.role ?? "")}</p>
                </div>
                <Link href="/admin/security" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface2"><ShieldCheck className="h-4 w-4 text-muted" /> Security & 2-step {me && !me.mfaEnrolled && me.via === "session" && <span className="ml-auto h-2 w-2 rounded-full bg-amber-500" />}</Link>
                {me?.rights.includes("support.live") && <Link href="/admin/support" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface2"><Headset className="h-4 w-4 text-muted" /> Live help</Link>}
                <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm text-red-600 hover:bg-surface2"><LogOut className="h-4 w-4" /> Log out</button>
              </div>
            )}
          </div>
        </header>
        {needMfa && (
          <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 md:px-6">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="flex-1"><b>2-step verification is not set up on your login.</b> Admin logins should have it: an authenticator app code at every login.</span>
            <Link href="/admin/security" className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white">Set up now</Link>
          </div>
        )}
        <main className="w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} />
      <ToastHost />
      {/* a page that changed the login's state (2-step done, password set) asks the shell to look again */}
      <ReloadOn reload={reload} />
    </div>
  );
}
function ReloadOn({ reload }: { reload: () => void }) {
  useEffect(() => { const on = () => reload(); window.addEventListener("admin-me-changed", on); return () => window.removeEventListener("admin-me-changed", on); }, [reload]);
  return null;
}
