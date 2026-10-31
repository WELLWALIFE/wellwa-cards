"use client";
// The app's navigation. On a phone: the bottom tab bar (unchanged). On a computer (lg, ≥1024px — owner, 31 Oct 2026: "desktop par
// website ki tarah khule, mobile par app ki tarah"): a fixed left sidebar with the logo, the same five sections and the screens people
// open most, and the page beside it at full width (the shell, app/poster/layout.tsx + globals.css `.app-shell`).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, PlusCircle, Users, Handshake, UserCircle, Globe, CreditCard, Settings, Package, CalendarDays, Share2, LogOut, Languages, Link2, ChevronsUpDown, HelpCircle } from "lucide-react";
import { useAccountKind, showsPartnerUi } from "@/lib/use-account-kind";
import { useT, LangToggle } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";
import { LogoMark } from "@/components/logo";
import { initials } from "@/lib/initials";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { endPartnerSession } from "@/lib/logout";
import { ShareSheet } from "@/components/poster/share-links";

type Tab = { href: string; label: string; icon: typeof Home };

function isActive(href: string, p: string): boolean {
  if (href === "/poster") return p === "/poster" || p.startsWith("/poster/history");
  if (href === "/poster/more") return /^\/poster\/(more|setup|social|report|guide|connect|profiles)/.test(p);
  if (href === "/poster/create") return /^\/poster\/(create|video|calendar|brand|testimonials|card|text-video|explainer|reel|photoshoot|website)/.test(p);
  if (href === "/poster/crm") return /^\/poster\/(crm|leads|learn)/.test(p);
  return p.startsWith(href);
}

export function PosterNav() {
  const p = usePathname();
  const { t, lang } = useT();
  const kind = useAccountKind();
  const hi = lang !== "en";
  const tabs: Tab[] = [
    { href: "/poster", label: t.tabHome, icon: Home },
    { href: "/poster/create", label: t.tabCard, icon: PlusCircle },
    { href: "/poster/crm", label: t.tabLeads, icon: Users },
    { href: "/poster/business", label: t.tabBusiness, icon: Handshake },
    { href: "/poster/more", label: t.tabMore, icon: UserCircle },
  ].filter((x) => x.href !== "/poster/business" || showsPartnerUi(kind));   // a consumer has no Business tab
  // The screens opened most, one click away on a computer.
  const quick: Tab[] = [
    { href: "/poster/site", label: hi ? "Card & Website" : "Card & Website", icon: Globe },
    { href: "/poster/products", label: hi ? "Products" : "Products", icon: Package },
    { href: "/poster/calendar", label: hi ? "Posters" : "Posters", icon: CalendarDays },
    { href: "/poster/plan", label: hi ? "मेरा plan" : "My plan", icon: CreditCard },
    { href: "/poster/settings", label: hi ? "Settings" : "Settings", icon: Settings },
  ];
  // The profile steps (You, Company…) stay inside the app, tabs and all (owner's call, 2 Oct 2026); only the very
  // first "start" screen is full-screen.
  if (p.startsWith("/poster/start")) return null;
  return (
    <>
      {/* Phone: the bottom tab bar. z-40: stays above page content (cards, previews, sticky bars). */}
      <nav className="app-tabbar fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-md border-t border-border bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((x) => {
            const active = isActive(x.href, p);
            return (
              <Link key={x.href} href={x.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-brand-ink" : "text-muted"}`}>
                <x.icon className={`h-5 w-5 ${active ? "text-brand" : ""}`} />
                {x.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Computer: the sidebar. */}
      <aside className="app-side fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-border bg-surface lg:flex">
        <Link href="/poster" className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <LogoMark className="h-9 w-7" />
          <span className="text-[1.15rem] font-extrabold tracking-tight text-ink">Shubhora</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-0.5">
            {tabs.map((x) => {
              const active = isActive(x.href, p);
              return (
                <li key={x.href}>
                  <Link href={x.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-brand-soft text-brand-ink" : "text-ink hover:bg-surface2"}`}>
                    <x.icon className={`h-5 w-5 ${active ? "text-brand" : "text-muted"}`} /> {x.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wide text-faint">{hi ? "जल्दी खोलें" : "Quick open"}</p>
          <ul className="space-y-0.5">
            {quick.map((x) => {
              const active = p.startsWith(x.href);
              return (
                <li key={x.href}>
                  <Link href={x.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition ${active ? "bg-brand-soft text-brand-ink" : "text-muted hover:bg-surface2 hover:text-ink"}`}>
                    <x.icon className={`h-4 w-4 ${active ? "text-brand" : ""}`} /> {x.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <SideAccount hi={hi} />
      </aside>
    </>
  );
}

/** The foot of the sidebar: who is logged in, their plan, and the things the round account button holds on a phone
 *  (settings, connections, share links, language, log out). */
function SideAccount({ hi }: { hi: boolean }) {
  const router = useRouter();
  const { plan } = usePlan();
  const kind = useAccountKind();
  const [me, setMe] = useState<{ name: string; photo: string | null } | null>(null);
  const [username, setUsername] = useState("");
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      const u = data.user; if (!u) { setMe(null); return; }
      const md = (u.user_metadata ?? {}) as Record<string, unknown>;
      setMe({ name: String(md.display_name ?? md.full_name ?? md.name ?? "").trim() || (u.email ?? ""), photo: (md.photo_url as string) || null });
    });
    import("@/lib/poster-client").then(({ api }) => api<{ username: string | null }>("/api/account").then((r) => { if (r.ok && r.data.username) setUsername(r.data.username); })).catch(() => {});
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (!s) setMe(null); });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!me) return null;
  async function logout() {
    try { await getBrowserSupabase()?.auth.signOut(); } catch { /* already out */ }
    await endPartnerSession();
    router.replace("/login");
  }
  // Only a free account is named as such here (the plan context reads a running Standard / Premium as "pro"); the plan page has the rest.
  const planLabel = plan === "free" ? (hi ? "Free plan" : "Free plan") : "";
  const item = "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-surface2";
  return (
    <div ref={box} className="relative border-t border-border p-3">
      {sharing && <ShareSheet onClose={() => setSharing(false)} />}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          <Link href="/poster/settings" className={item}><Settings className="h-4 w-4 text-muted" /> {hi ? "मेरा account" : "My account"}</Link>
          <Link href="/poster/plan" className={item}><CreditCard className="h-4 w-4 text-muted" /> {hi ? "Plan और credits" : "Plan & credits"}</Link>
          {showsPartnerUi(kind) && <Link href="/poster/business" className={item}><Handshake className="h-4 w-4 text-muted" /> Business</Link>}
          <Link href="/poster/connect" className={item}><Link2 className="h-4 w-4 text-muted" /> {hi ? "Connections" : "Connections"}</Link>
          <button type="button" onClick={() => { setOpen(false); setSharing(true); }} className={item}><Share2 className="h-4 w-4 text-muted" /> {hi ? "मेरे links share करें" : "Share my links"}</button>
          <Link href="/poster/guide" className={item}><HelpCircle className="h-4 w-4 text-muted" /> {hi ? "कैसे चलाएँ" : "How to use"}</Link>
          <div className="flex items-center justify-between px-3 py-2.5 text-sm"><span className="inline-flex items-center gap-2.5"><Languages className="h-4 w-4 text-muted" /> {hi ? "भाषा" : "Language"}</span><LangToggle /></div>
          <button type="button" onClick={logout} className={`${item} border-t border-border text-danger`}><LogOut className="h-4 w-4" /> {hi ? "लॉग आउट" : "Log out"}</button>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface2" aria-label="Account menu">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface">
          {me.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={me.photo} alt="" className="h-full w-full object-cover" />
            : <span className="text-sm font-bold text-brand-ink">{initials(me.name)}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold leading-tight">{me.name}</span>
          <span className="block truncate text-[11px] text-muted leading-tight">{[username ? `@${username}` : "", planLabel].filter(Boolean).join(" · ")}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
    </div>
  );
}
