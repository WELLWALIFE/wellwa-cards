"use client";
// Super Admin → Live help. Who is asking for help, who is being helped, and what they are looking at.
//
// What a staff member sees: the screen the person is on right now, what to tell them about that screen, and
// their card as it stands. What they can do: take a request, ask someone if they want help, and send a
// person who said yes to another screen — their app goes there with a banner showing who is helping.
//
// What is NOT here, deliberately: what the person types. This is not a screen recording (see
// supabase/migrations/0061_live_help.sql).

import { useCallback, useEffect, useRef, useState } from "react";
import { Headset, LoaderCircle, PencilLine, RefreshCw, Send, Smartphone, SquareArrowOutUpRight, TriangleAlert, UserPlus, X } from "lucide-react";
import { adminHeaders } from "@/lib/admin-client";
import { GUIDE_TARGETS, helpFor } from "@/lib/help-screens";
import { LiveScreen } from "@/components/admin/live-screen";

type Session = {
  id: string;
  userId: string;
  status: "requested" | "invited" | "live" | "ended";
  openedBy: "user" | "staff";
  staffName: string | null;
  note: string | null;
  since: string;
  path: string | null;
  screen: string | null;
  state: { screen?: string; step?: string; missing?: string[] };
  guidePath: string | null;
  lastSeen: string | null;
  quiet: boolean;
  person: { name: string; phone: string; email: string } | null;
  cardUsername: string | null;
};

const REFRESH_MS = 5_000;
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`;
};

const BADGE: Record<Session["status"], { label: string; cls: string }> = {
  requested: { label: "Asking for help", cls: "bg-amber/15 text-amber border-amber/40" },
  invited: { label: "Waiting for their yes", cls: "bg-surface2 text-muted border-border" },
  live: { label: "Live", cls: "bg-good/15 text-good border-good/40" },
  ended: { label: "Ended", cls: "bg-surface2 text-faint border-border" },
};

export default function LiveHelpPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [staffName, setStaffName] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  // A Staff Admin member handed over from the partner panel: their name came with the signed handoff and
  // the server uses that, not anything typed here. The owner, who unlocked with the password, types theirs.
  const [fixedName, setFixedName] = useState("");
  // "Fill it in for them": the one-time address that opens their app as them.
  const [asThem, setAsThem] = useState<{ link?: string; email?: string; password?: string; login?: string } | null>(null);
  const liveRef = useRef<HTMLIFrameElement>(null);

  // Whoever is at this console — shown to the person in their banner, so help never comes from "someone".
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ne-admin-scope") === "support") { setFixedName(sessionStorage.getItem("ne-admin-who") ?? "Shubhora support"); return; }
      setStaffName(localStorage.getItem("ne-staff-name") ?? "");
    } catch { /* private mode */ }
  }, []);
  useEffect(() => {
    if (fixedName) return;
    try { localStorage.setItem("ne-staff-name", staffName); } catch { /* private mode */ }
  }, [staffName, fixedName]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/support", { headers: await adminHeaders(), cache: "no-store" });
      const j = (await r.json()) as { sessions?: Session[]; error?: string };
      if (!r.ok) { setErr(j.error || `Could not load (${r.status}).`); return; }
      setErr(""); setSessions(j.sessions ?? []);
    } catch {
      setErr("No internet — retrying.");
    } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  async function act(action: string, body: Record<string, unknown>) {
    setBusy(action); setErr("");
    try {
      const r = await fetch("/api/admin/support", {
        method: "POST", headers: await adminHeaders(),
        body: JSON.stringify({ action, staffName: staffName.trim() || undefined, ...body }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setErr(j.error || `Could not do that (${r.status}).`); return; }
      await load();
    } catch {
      setErr("No internet — please try again.");
    } finally { setBusy(""); }
  }

  /** Open their app already logged in as them, so a staff member can do the typing while the person
   *  watches their own screen. The same flow as Users → "Login as", with its "← Back to admin" bar. */
  async function fillForThem(userId: string) {
    setBusy("as"); setErr(""); setAsThem(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST", headers: await adminHeaders(), body: JSON.stringify({ action: "login_as", id: userId }),
      });
      const j = (await r.json().catch(() => ({}))) as { link?: string; email?: string; password?: string; login?: string; error?: string };
      if (!r.ok) {
        setErr(r.status === 401
          ? "Only the platform owner can open a customer's account. Ask them to do this part."
          : j.error || `Could not open their account (${r.status}).`);
        return;
      }
      // "← Back to admin" should come back HERE, not to the user list.
      if (j.link) j.link = `${j.link}${j.link.includes("?") ? "&" : "?"}from=%2Fadmin%2Fsupport`;
      setAsThem(j);
      // Opened for convenience, and shown below as well: this browser's app login becomes theirs, so an
      // owner who unlocked this console with their own account (not the admin password) needs the private
      // window instead, or this console stops working mid-session.
      if (j.link) window.open(j.link, "_blank", "noopener");
    } catch {
      setErr("No internet — please try again.");
    } finally { setBusy(""); }
  }

  useEffect(() => { setAsThem(null); }, [selected]);

  const open = sessions.find((s) => s.id === selected) ?? null;
  const screen = open?.path ? helpFor(open.path) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold"><Headset className="h-5 w-5 text-brand" /> Live help</h1>
          <p className="mt-1 text-sm text-muted">
            See the screen a card holder is on while you talk them through it. They always know you are there,
            and a session only starts when they agree to it.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {fixedName ? (
        <p className="rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm">
          You are helping as <b>{fixedName}</b> — that is the name the card holder sees. It comes from your
          Staff Admin login and cannot be changed here.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-sm font-semibold">
            Your name (the person sees this)
            <input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="e.g. Priya from Shubhora"
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm" />
          </label>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-semibold">Offer to help someone</p>
        <div className="flex flex-wrap gap-2">
          <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="their username (the part after /c/)"
            className="min-w-48 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm" />
          <button type="button" disabled={!invite.trim() || !!busy}
            onClick={() => act("invite", { username: invite.trim() }).then(() => setInvite(""))}
            className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy === "invite" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Ask them
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          A question appears on their phone. Nothing is shown here until they say yes — useful when you already
          have them on a call.
        </p>
      </div>

      {err && <p className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"><TriangleAlert className="h-4 w-4" /> {err}</p>}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* ---- who needs help ---- */}
        <div className="space-y-2">
          {!loaded && <p className="text-sm text-muted">Loading…</p>}
          {loaded && !sessions.length && (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              Nobody is asking for help right now.
            </p>
          )}
          {sessions.map((s) => {
            const b = BADGE[s.status];
            return (
              <button key={s.id} type="button" onClick={() => setSelected(s.id)}
                className={`w-full rounded-2xl border p-3 text-left ${s.id === selected ? "border-brand bg-brand-soft/40" : "border-border bg-surface"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{s.person?.name || s.person?.phone || s.person?.email || s.userId.slice(0, 8)}</p>
                    <p className="truncate text-xs text-muted">{s.cardUsername ? `/c/${s.cardUsername}` : "no card yet"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>{b.label}</span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                  <Smartphone className="h-3.5 w-3.5" />
                  {s.status === "live" ? (s.quiet ? "gone quiet" : s.screen || "—") : `asked ${ago(s.since)} ago`}
                </p>
                {s.status === "requested" && (
                  <span onClick={(e) => { e.stopPropagation(); act("pickup", { id: s.id }); }}
                    className="mt-2 inline-block cursor-pointer rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white">
                    Take this one
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ---- the one being helped ---- */}
        {open ? (
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold">{open.person?.name || open.userId.slice(0, 8)}</p>
                <p className="text-xs text-muted">{[open.person?.phone, open.person?.email].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <button type="button" onClick={() => act("end", { id: open.id })} disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60">
                <X className="h-4 w-4" /> End session
              </button>
            </div>

            {open.status !== "live" ? (
              <p className="rounded-xl bg-surface2 px-3 py-2.5 text-sm text-muted">
                {open.status === "invited"
                  ? "Waiting for them to say yes. Their screen is not reported until they do."
                  : "They asked for help — take the session to start."}
                {open.note ? <> They were on <b className="text-ink">{open.note}</b>.</> : null}
              </p>
            ) : (
              <>
                {/* The one thing this page is for, so it stays in view while you scroll the rest. */}
                <div className={`sticky top-16 z-10 rounded-xl border px-3 py-2.5 shadow-sm ${open.quiet ? "border-amber/40 bg-amber/10" : "border-good/40 bg-good/10"}`}>
                  <p className="text-xs font-semibold text-muted">They are on</p>
                  <p className="text-lg font-bold">{open.screen ?? "—"}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">{open.path}</p>
                  {open.quiet ? (
                    <p className="mt-1 text-xs font-semibold text-amber">
                      Last reported {ago(open.lastSeen)} ago — this may not be where they are now. Their phone is
                      probably asleep, or the app is behind another app or tab. It catches up the moment they
                      look at it again.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">updated {ago(open.lastSeen)} ago · refreshes every 5s</p>
                  )}
                </div>

                {/* The screen itself, replayed as they use it. This is the point of the page. */}
                <div>
                  <p className="mb-1.5 text-sm font-semibold">Their screen</p>
                  <LiveScreen sessionId={open.id} live={open.status === "live"} />
                </div>

                {screen && (
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs font-semibold text-muted">What to tell them on this screen</p>
                    <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
                      {screen.steps.map((st, i) => <li key={i}>{st.en}</li>)}
                    </ol>
                    {screen.mistake && <p className="mt-2 text-xs text-amber"><b>Usual mistake:</b> {screen.mistake.en}</p>}
                  </div>
                )}

                {/* When talking them through it is not enough: do the typing yourself, in their account. */}
                <div className="rounded-xl border border-border p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><PencilLine className="h-4 w-4 text-brand" /> Fill it in for them</p>
                  <p className="mt-1 text-xs text-muted">
                    You cannot press anything on their phone from here — this is a view of their screen, not a
                    remote control. When someone cannot manage it themselves, ask them, then open their app as
                    them and type it in. They watch it happen on their own screen, and a “← Back to admin” bar
                    brings you back to your own account.
                  </p>
                  {fixedName ? (
                    <p className="mt-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
                      Opening a customer&apos;s account is the platform owner&apos;s to do — ask them for this part.
                    </p>
                  ) : (
                    <button type="button" onClick={() => fillForThem(open.userId)} disabled={!!busy}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
                      {busy === "as" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SquareArrowOutUpRight className="h-4 w-4" />} Open their app as them
                    </button>
                  )}
                  {asThem?.link && (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-surface2 px-3 py-2">
                      <p className="text-xs">
                        Opened in a new tab. <b>This browser&apos;s app login is now theirs.</b> This console keeps
                        working if you unlocked it with the admin password. If you came in on your own owner
                        login, close that tab and open this address in a private window instead:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-[11px]">{asThem.link}</code>
                        <button type="button" onClick={() => navigator.clipboard?.writeText(asThem.link ?? "")}
                          className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold">Copy</button>
                      </div>
                      <p className="text-[11px] text-muted">
                        It works once, for a short time. When you are done, tap “← Back to admin” at the bottom of
                        their app.
                      </p>
                    </div>
                  )}
                  {asThem?.password && (
                    <p className="mt-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs">
                      This account has no email, so a temporary password was set. Log in with{" "}
                      <b>{asThem.login ?? asThem.email}</b> and <b className="font-mono">{asThem.password}</b>.
                      Tell them it changed — their old password no longer works.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-semibold">Send them to a screen</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GUIDE_TARGETS.map((t) => (
                      <button key={t.path} type="button" disabled={!!busy || t.path === open.path}
                        onClick={() => act("guide", { id: open.id, path: t.path })}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${t.path === open.guidePath ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}>
                        <Send className="h-3 w-3" /> {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">Their app opens that screen, with the banner still showing your name.</p>
                </div>
              </>
            )}

            {/* Their card as it stands — the thing you are usually helping them build. */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-semibold">Their published card</p>
                {open.cardUsername && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { if (liveRef.current) liveRef.current.src = `/c/${open.cardUsername}?t=${Date.now()}`; }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-muted"><RefreshCw className="h-3 w-3" /> Reload</button>
                    <a href={`/c/${open.cardUsername}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><SquareArrowOutUpRight className="h-3 w-3" /> Open</a>
                  </div>
                )}
              </div>
              {open.cardUsername ? (
                <>
                  <p className="mb-1.5 text-xs text-muted">
                    What a customer sees at /c/{open.cardUsername} — not their phone screen. It changes when they
                    publish; press Reload to fetch it again.
                  </p>
                  <iframe ref={liveRef} src={`/c/${open.cardUsername}`} title="Their published card"
                    className="h-[32rem] w-full max-w-sm rounded-xl border border-border bg-bg" />
                </>
              ) : (
                <p className="rounded-xl bg-surface2 px-3 py-2.5 text-sm text-muted">They have not made a card yet — that is probably what they need help with.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            Pick someone on the left to see their screen.
          </div>
        )}
      </div>
    </div>
  );
}
