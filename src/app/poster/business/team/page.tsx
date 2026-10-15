"use client";
// Business → Team. Data from the partner handler `team` (handles only, no names). Response shapes (mirror src/server/app-api/team.ts):
//  Summary  { counts, me: { handle, status }, exportUrls: { team } } | { disabled: true }
//  list     { rows: Row[], hasMore }       (op "list", tab, offset)
//  node     { node: Node, children: Kid[] } | { error }  (op "node", handle)
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, LoaderCircle, Search } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, ExcelButton, bizAct, dayOf, useBiz, useBizMsg } from "@/components/business/kit";

type Status = "green" | "red";
type Side = "L" | "R";
type Summary = {
  disabled?: boolean;
  counts: { left: number; right: number; leftGreen: number; rightGreen: number; directs: number; directsGreen: number };
  me: { handle: string; status: Status };
  exportUrls?: { team?: string | null };
};
type Row = { handle: string; status: Status; side: Side; joined: string; lapsed: boolean };
type ListRes = { rows: Row[]; hasMore: boolean };
type Kid = { handle: string; status: Status; side: Side; joined: string; hasKids: boolean };
type TeamNode = { handle: string; status: Status; side: Side | null; joined: string };
type NodeRes = { node?: TeamNode; children?: Kid[]; error?: string };

type Tab = "directs" | "left" | "right";

export default function TeamPage() {
  const { lang } = useT();
  const en = lang === "en";
  const { data, error, loading, reload } = useBiz<Summary>("team", { op: "summary" });
  const [view, setView] = useState<"list" | "tree">("list");
  const [found, setFound] = useState<TeamNode | null>(null);

  return (
    // A person found by search is a step inside this page (the same one "Show my whole tree" leaves): the arrow closes it first.
    <BizShell title={en ? "My team" : "मेरी team"} right={data && !data.disabled ? <ExcelButton url={data.exportUrls?.team} /> : null} onBack={view === "tree" && found ? () => setFound(null) : undefined}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled ? (
          <p className={`${CARD} text-sm text-muted`}>{en ? "This page is not open right now." : "यह page अभी बंद है।"}</p>
        ) : data ? (
          <>
            <section className="rounded-2xl bg-[#12144a] p-4 text-white">
              <p className="text-xs text-white/70">{en ? "People in your team" : "आपकी team में लोग"}</p>
              <p className="text-3xl font-bold">{data.counts.left + data.counts.right}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  [String(data.counts.left), "Left side", `${data.counts.leftGreen} Green`],
                  [String(data.counts.right), "Right side", `${data.counts.rightGreen} Green`],
                  [String(data.counts.directs), en ? "My directs" : "मेरे direct", `${data.counts.directsGreen} Green`],
                ].map(([v, l, h]) => (
                  <div key={l} className="rounded-xl bg-white/10 p-2.5"><p className="text-lg font-bold leading-tight">{v}</p><p className="text-[11px] text-white/70">{l}</p><p className="text-[10px] text-white/50">{h}</p></div>
                ))}
              </div>
              <p className="mt-3 text-xs text-white/75">{en ? "Green means the plan is active. Red means not active yet." : "Green मतलब plan चालू है। Red मतलब अभी चालू नहीं।"}</p>
            </section>

            <FindPerson myHandle={data.me.handle} onFound={(n, self) => { setFound(n); if (n || self) setView("tree"); }} />

            <div className="flex gap-1 rounded-xl bg-surface2 p-1">
              {(["list", "tree"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${view === v ? "bg-surface shadow-sm" : "text-muted"}`}>
                  {v === "list" ? (en ? "List" : "सूची") : (en ? "Tree" : "Tree")}
                </button>
              ))}
            </div>

            {view === "list" ? <MemberList /> : <TreeView rootHandle={data.me.handle} found={found} onClear={() => setFound(null)} />}
          </>
        ) : null}
      </BizState>
    </BizShell>
  );
}

function StatusPill({ status, lapsed }: { status: Status; lapsed?: boolean }) {
  const { lang } = useT(); const en = lang === "en";
  const green = status === "green";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${green ? "bg-good/15 text-good" : "bg-danger/10 text-danger"}`}>
      {green ? "Green" : "Red"}{lapsed ? ` · ${en ? "ended" : "खत्म"}` : ""}
    </span>
  );
}

/** "Find a person": a username or ID in my team opens in the tree. Someone who is not in my team gets a plain message (the server never says more). */
function FindPerson({ myHandle, onFound }: { myHandle: string; onFound: (n: TeamNode | null, self?: boolean) => void }) {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const h = q.trim().replace(/^@/, "").slice(0, 40);
    if (!h || busy) return;
    setBusy(true); setMsg(null);
    const r = await bizAct<NodeRes>("team", { op: "node", handle: h });
    setBusy(false);
    if (!r.ok) { setMsg({ text: tr(r.error), error: true }); onFound(null); return; }
    if (r.data.error || !r.data.node) {
      setMsg({ text: en ? "This person is not in your team. Check the username or ID and try again." : "यह व्यक्ति आपकी team में नहीं है। Username या ID जाँचकर फिर कोशिश करें।", error: true });
      onFound(null); return;
    }
    if (r.data.node.side === null || r.data.node.handle.toLowerCase() === myHandle.toLowerCase()) {
      // Not a mistake: it is you. Show your own tree (the List view has none, so switch to Tree) and say so in a calm colour.
      setMsg({ text: en ? "That is you. Your own tree is below." : "यह तो आप ही हैं। आपका tree नीचे है।", error: false });
      onFound(null, true); return;
    }
    onFound(r.data.node);
  }

  return (
    <form onSubmit={go} className={`${CARD} space-y-2`}>
      <label className="block text-sm font-semibold" htmlFor="team-find">{en ? "Find a person" : "किसी को खोजें"}</label>
      <div className="flex gap-2">
        <input id="team-find" value={q} onChange={(e) => { setQ(e.target.value); setMsg(null); }} maxLength={40} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={en ? "Username or ID, like SH100245" : "Username या ID, जैसे SH100245"} className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-base" />
        <button type="submit" disabled={busy || !q.trim()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{en ? "Find" : "खोजें"}
        </button>
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.error ? "text-danger" : "text-muted"}`} role="status">{msg.text}</p>}
    </form>
  );
}

function MemberList() {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  const [tab, setTab] = useState<Tab>("directs");
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const seq = useRef(0); // only the newest answer is used (tabs can be tapped quickly)

  const load = useCallback(async (t: Tab, offset: number) => {
    const mine = ++seq.current;
    setBusy(true); setErr("");
    const r = await bizAct<ListRes>("team", { op: "list", tab: t, offset, limit: 30 });
    if (mine !== seq.current) return;
    if (!r.ok) setErr(r.error ?? "");
    else { setRows((old) => (offset ? [...old, ...r.data.rows] : r.data.rows)); setHasMore(r.data.hasMore); }
    setBusy(false);
  }, []);
  useEffect(() => { void load(tab, 0); }, [tab, load]);

  const tabs: [Tab, string][] = [["directs", en ? "My directs" : "मेरे direct"], ["left", "Left side"], ["right", "Right side"]];
  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setRows([]); setHasMore(false); setTab(k); }} className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${tab === k ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>{l}</button>
        ))}
      </div>
      {err && rows.length === 0 && <p className="text-sm font-semibold text-danger">{tr(err)}</p>}
      {!busy && !err && rows.length === 0 && <p className={`${CARD} text-center text-sm text-muted`}>{en ? "Nobody here yet." : "यहाँ अभी कोई नहीं।"}</p>}
      {rows.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.map((r) => (
            <div key={r.handle} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.handle}</p>
                <p className="text-[11px] text-muted">{r.side === "L" ? "Left side" : "Right side"} · {en ? "joined" : "जुड़े"} {dayOf(r.joined)}</p>
              </div>
              <StatusPill status={r.status} lapsed={r.lapsed} />
            </div>
          ))}
        </div>
      )}
      {busy && <div className="py-4 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>}
      {hasMore && !busy && (
        <button type="button" onClick={() => load(tab, rows.length)} className="w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold">{en ? "Show more" : "और दिखाएँ"}</button>
      )}
      {/* "Show more" failed: the message sits right under that button, not above the list */}
      {err && rows.length > 0 && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger" role="status">{tr(err)}</p>}
    </section>
  );
}

/** One person with their two spots below; tap an arrow to open the next level. A person found by search is opened as the top of the tree. */
function TreeView({ rootHandle, found, onClear }: { rootHandle: string; found: TeamNode | null; onClear: () => void }) {
  const { lang } = useT(); const en = lang === "en";
  if (found) {
    return (
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-xs text-muted">
            {en ? "Showing" : "दिखा रहे हैं"}: <b className="text-ink">{found.handle}</b>
            {found.joined ? ` · ${en ? "joined" : "जुड़े"} ${dayOf(found.joined)}` : ""}
          </p>
          <button type="button" onClick={onClear} className="shrink-0 text-xs font-semibold text-brand-ink underline">{en ? "Show my whole tree" : "मेरा पूरा tree दिखाएँ"}</button>
        </div>
        <div className={CARD}><TreeNode key={found.handle} handle={found.handle} status={found.status} side={null} startOpen /></div>
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <p className="text-xs text-muted">{en ? "Tap the arrow to see who is below a person." : "किसी के नीचे कौन है, देखने के लिए arrow दबाएँ।"}</p>
      <div className={CARD}><TreeNode handle={rootHandle} status={null} side={null} root startOpen /></div>
    </section>
  );
}

function TreeNode({ handle, status, side, root, startOpen }: { handle: string; status: Status | null; side: Side | null; root?: boolean; startOpen?: boolean }) {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  const [open, setOpen] = useState(!!startOpen);
  const [res, setRes] = useState<NodeRes | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || res) return;
    let live = true;
    (async () => {
      setBusy(true);
      const r = await bizAct<NodeRes>("team", { op: "node", handle });
      if (live) { setRes(r.ok ? r.data : { error: r.error }); setBusy(false); }
    })();
    return () => { live = false; };
  }, [open, res, handle]);

  const kids = res?.children ?? [];
  const sides: Side[] = ["L", "R"];
  const st = status ?? res?.node?.status ?? null;
  return (
    <div>
      <div className="flex items-center gap-2 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? (en ? "Close" : "बंद करें") : (en ? "Open" : "खोलें")} className="grid h-6 w-6 place-items-center rounded-lg border border-border">
          <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{root ? (en ? "You" : "आप") : handle}</span>
        {side && <span className="text-[11px] text-muted">{side === "L" ? "L" : "R"}</span>}
        {st && <StatusPill status={st} />}
      </div>
      {open && (
        <div className="ml-3 border-l border-border pl-3">
          {busy && <LoaderCircle className="my-2 h-4 w-4 animate-spin text-muted" />}
          {res?.error && <p className="py-1 text-xs text-danger">{tr(res.error)}</p>}
          {res && !res.error && sides.map((s) => {
            const k = kids.find((x) => x.side === s);
            return k
              ? (k.hasKids ? <TreeNode key={s} handle={k.handle} status={k.status} side={s} /> : (
                <div key={s} className="flex items-center gap-2 py-1.5 pl-8">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{k.handle}</span>
                  <span className="text-[11px] text-muted">{s}</span>
                  <StatusPill status={k.status} />
                </div>))
              : <p key={s} className="py-1.5 pl-8 text-xs text-faint">{s === "L" ? (en ? "Left side: empty spot" : "Left side: खाली जगह") : (en ? "Right side: empty spot" : "Right side: खाली जगह")}</p>;
          })}
        </div>
      )}
    </div>
  );
}
