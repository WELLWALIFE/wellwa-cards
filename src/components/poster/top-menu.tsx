"use client";
// The small round button at the top-right of every app page: who is logged in, language, Log out.
// Hidden during onboarding and when nobody is logged in.
import { initials } from "@/lib/initials";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound, Handshake, Languages, Link2, Share2 } from "lucide-react";
import { ShareSheet } from "@/components/poster/share-links";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useT, LangToggle } from "@/lib/poster-i18n";
import { endPartnerSession } from "@/lib/logout";

export function TopMenu() {
  const p = usePathname();
  const router = useRouter();
  const { lang } = useT();
  const en = lang === "en";
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
    // The account's username for the Home header (owner's call, 29 Sep 2026: photo, name, @username on the left).
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
  useEffect(() => { setOpen(false); setSharing(false); }, [p]);

  if (!me || /^\/poster\/start/.test(p)) return null;

  async function logout() {
    try { await getBrowserSupabase()?.auth.signOut(); } catch { /* already out */ }
    await endPartnerSession();
    router.push("/login");
  }

  const home = p === "/poster";
  return (
    <div ref={box} className={`absolute z-40 flex items-start gap-2 ${home ? "inset-x-3" : "right-3"}`} style={{ top: "max(0.6rem, env(safe-area-inset-top))" }}>
      {sharing && <ShareSheet onClose={() => setSharing(false)} />}
      <div className={`relative ${home ? "min-w-0 flex-1" : ""}`}>
      {/* Home: photo on the left with the name and @username beside it — whose app is open, at a glance. */}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Account menu" className={`flex items-center gap-2.5 text-left ${home ? "max-w-full" : ""}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface shadow-sm">
          {me.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={me.photo} alt="" className="h-full w-full object-cover" />
            : <span className="text-sm font-bold text-brand-ink">{initials(me.name)}</span>}
        </span>
        {home && (
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold leading-tight">{me.name}</span>
            {username && <span className="block truncate text-xs text-muted leading-tight">@{username}</span>}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl ${home ? "left-0" : "right-0"}`}>
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{me.name}</p>
          </div>
          <Link href="/poster/settings" className="flex items-center gap-2.5 px-3 py-2.5 text-sm"><UserRound className="h-4 w-4 text-muted" /> {en ? "Me · account" : "Me · account"}</Link>
          <Link href="/poster/business" className="flex items-center gap-2.5 px-3 py-2.5 text-sm"><Handshake className="h-4 w-4 text-muted" /> Business</Link>
          <Link href="/poster/connect" className="flex items-center gap-2.5 px-3 py-2.5 text-sm"><Link2 className="h-4 w-4 text-muted" /> {en ? "Connections" : "Connections (WhatsApp, FB…)"}</Link>
          <Link href="/poster/share" className="flex items-center gap-2.5 px-3 py-2.5 text-sm"><Share2 className="h-4 w-4 text-muted" /> {en ? "Share my links" : "मेरे links share करें"}</Link>
          <div className="flex items-center justify-between px-3 py-2.5 text-sm"><span className="inline-flex items-center gap-2.5"><Languages className="h-4 w-4 text-muted" /> {en ? "Language" : "भाषा"}</span><LangToggle /></div>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-left text-sm text-danger"><LogOut className="h-4 w-4" /> {en ? "Log out" : "Log out"}</button>
        </div>
      )}
      </div>
      {/* Share: card link + LEFT / RIGHT join links, one tap from every page. */}
      <button type="button" onClick={() => setSharing(true)} aria-label="Share my links"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-sm">
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}
