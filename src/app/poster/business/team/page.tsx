"use client";
// Business → Team. Data from the partner handler `team` (handles only, no names). Response shapes (mirror src/server/app-api/team.ts):
//  Summary  { counts, me: { handle, status }, exportUrls: { team } } | { disabled: true }
//  list     { rows: Row[], hasMore }       (op "list", tab, offset)
//  node     { node: Node, children: Kid[] } | { error }  (op "node", handle)
//  tree     { root, levels, bin, nodes, path, up, counts, carry, bottom } | { error }  (op "tree", handle, levels, bin) — the admin-style tree
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, Home, LoaderCircle, Search } from "lucide-react";
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
type BizNode = { handle: string; status: Status; subActive: boolean; parent: string | null; side: Side | null; depth: number; sponsor: string | null;
  bv: { L: number; R: number; carryL: number; carryR: number; pairs: number }; team: { greenL: number; redL: number; greenR: number; redR: number } };
type TreeRes = { root: string; levels: number; bin: "new" | "renewal"; nodes: BizNode[]; path: string[]; up: string | null;
  counts: { left: number; right: number; leftGreen: number; rightGreen: number }; carry: { L: number; R: number; renewalL?: number; renewalR?: number }; bottom: { left: string | null; right: string | null }; error?: string };

const kFmt = (bv: number) => (bv >= 100000 ? `${(bv / 100000).toFixed(1)}L` : bv >= 1000 ? `${Math.round(bv / 100) / 10}k` : String(bv));
const inFmt = (v: number) => v.toLocaleString("en-IN");

/** The tree as Staff Admin draws it (owner, 20 Oct 2026: "app me bhi admin jaisa"): circles for IDs, L | R BV and pairs under each,
 *  dashed circles for empty spots, tap an ID to make it the top. Back / Up / My position, 2–4 levels, New sale or Renewal binary.
 *  Only my own team: the path starts at me, nobody above me is ever shown. */
function TreeView({ rootHandle, found, onClear }: { rootHandle: string; found: TeamNode | null; onClear: () => void }) {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  const [root, setRoot] = useState<string>(found?.handle ?? rootHandle);
  const [levels, setLevels] = useState(3);
  const bin = "new" as const;   // one binary since 20 Oct 2026: sales and renewals in the same legs
  const [res, setRes] = useState<TreeRes | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);   // the ID whose detail card is open (tap)
  const [history, setHistory] = useState<string[]>([]);   // the tops visited before this one (Back)
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (found) setRoot(found.handle); }, [found]);

  const load = useCallback(async () => {
    setBusy(true); setErr(""); setOpen(null);
    const r = await bizAct<TreeRes>("team", { op: "tree", handle: root, levels, bin });
    setBusy(false);
    if (!r.ok) { setErr(tr(r.error)); return; }
    if (r.data.error) { setErr(en ? "This person is not in your team." : "यह व्यक्ति आपकी team में नहीं है।"); return; }
    setRes(r.data);
  }, [root, levels, bin, tr, en]);
  useEffect(() => { void load(); }, [load]);
  // A wide tree opens scrolled to its middle, so the top ID is in view on a phone.
  useEffect(() => { const el = scroller.current; if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; }, [res]);

  const go = (h: string) => { if (h.toLowerCase() === root.toLowerCase()) return; setHistory((l) => [...l, root]); setRoot(h); };
  const back = () => { const h = history[history.length - 1]; if (h) { setHistory((l) => l.slice(0, -1)); setRoot(h); } else { setRoot(rootHandle); onClear(); } };
  const home = () => { setHistory([]); setRoot(rootHandle); onClear(); };
  const atHome = res ? res.path.length <= 1 : root.toLowerCase() === rootHandle.toLowerCase();
  const btn = "inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={back} disabled={atHome && history.length === 0} className={btn}><ChevronLeft className="h-3.5 w-3.5" /> {en ? "Back" : "पीछे"}</button>
        <button type="button" onClick={() => res?.up && go(res.up)} disabled={!res?.up} className={btn}><ArrowUp className="h-3.5 w-3.5" /> {en ? "Up" : "ऊपर"}</button>
        {!atHome && <button type="button" onClick={home} className={btn}><Home className="h-3.5 w-3.5" /> {en ? "My position" : "मेरी जगह"}</button>}
        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">{en ? "Levels" : "Levels"}
          <select value={levels} onChange={(e) => setLevels(Number(e.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold">
            {[2, 3, 4].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      {res && res.path.length > 1 && (
        <nav aria-label={en ? "Path" : "रास्ता"} className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {res.path.map((h, i) => {
            const last = i === res.path.length - 1;
            return <span key={`${h}-${i}`} className="inline-flex items-center gap-1">{i > 0 && <span className="text-faint">›</span>}{last ? <b className="text-ink">{h}</b> : <button type="button" onClick={() => (i === 0 ? home() : go(h))} className="font-semibold text-brand-ink underline">{i === 0 ? (en ? "You" : "आप") : h}</button>}</span>;
          })}
        </nav>
      )}

      {res && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface2 px-3 py-2 text-[11px]">
          <span>Left <b>{res.counts.left}</b> ({res.counts.leftGreen} green) · Right <b>{res.counts.right}</b> ({res.counts.rightGreen} green)</span>
          <span>Carry L <b>{inFmt(res.carry.L)}</b> / R <b>{inFmt(res.carry.R)}</b>{(res.carry.renewalL ?? 0) + (res.carry.renewalR ?? 0) > 0 ? <span className="text-muted"> ({en ? "renewal part" : "renewal का हिस्सा"} {inFmt(res.carry.renewalL ?? 0)} / {inFmt(res.carry.renewalR ?? 0)})</span> : null}</span>
          <span>{en ? "Bottom" : "सबसे नीचे"}: {res.bottom.left ? <button type="button" onClick={() => go(res.bottom.left!)} className="font-semibold text-brand-ink underline">left {res.bottom.left}</button> : "left —"} · {res.bottom.right ? <button type="button" onClick={() => go(res.bottom.right!)} className="font-semibold text-brand-ink underline">right {res.bottom.right}</button> : "right —"}</span>
        </div>
      )}

      {err && <p className="text-sm font-semibold text-danger" role="status">{err}</p>}
      <div className={`${CARD} relative`}>
        {busy && <div className="absolute inset-0 z-10 grid place-items-center bg-surface/60"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>}
        {res ? (
          <div ref={scroller} className="overflow-x-auto pb-2">
            <div className="mx-auto flex min-w-max justify-center px-1">
              <BizTree res={res} me={rootHandle} open={open} setOpen={setOpen} onPick={go} en={en} />
            </div>
          </div>
        ) : !err ? <div className="grid place-items-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div> : null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-good" />Green ID (paid)</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger" />Red ID (not active)</span>
          <span>{en ? "L | R = lifetime BV in each leg. Tap an ID for details, tap again to open its tree." : "L | R = हर leg का lifetime BV। ID पर tap करें details के लिए, दोबारा tap करें उसका tree खोलने के लिए।"}</span>
        </div>
      </div>
    </section>
  );
}

function BizTree({ res, me, open, setOpen, onPick, en }: { res: TreeRes; me: string; open: string | null; setOpen: (h: string | null) => void; onPick: (h: string) => void; en: boolean }) {
  const byParent = new Map<string, { L?: BizNode; R?: BizNode }>();
  for (const x of res.nodes) if (x.parent) { const s = byParent.get(x.parent) ?? {}; if (x.side) s[x.side] = x; byParent.set(x.parent, s); }
  const root = res.nodes.find((x) => x.handle === res.root);
  if (!root) return null;
  const maxDepth = Math.max(...res.nodes.map((x) => x.depth));
  const tone = (x: BizNode) => (x.status !== "green" ? "bg-danger ring-danger/20" : res.bin === "renewal" && !x.subActive ? "bg-amber ring-amber/20" : "bg-good ring-good/20");
  const initials = (h: string) => h.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "ID";

  function Slot({ node, level }: { node?: BizNode; level: number }) {
    if (!node) return <div className="flex w-[88px] flex-col items-center"><div className="h-10 w-10 rounded-full border-2 border-dashed border-border opacity-60" /><p className="mt-1 text-[10px] text-faint">{en ? "Empty" : "खाली"}</p></div>;
    return <Node node={node} level={level} />;
  }
  function Node({ node, level }: { node: BizNode; level: number }) {
    const kids = byParent.get(node.handle) ?? {};
    const isMe = node.handle.toLowerCase() === me.toLowerCase();
    const isOpen = open === node.handle;
    const b = node.bv; const tm = node.team;
    return (
      <div className="flex flex-col items-center">
        <div className="relative flex w-[88px] flex-col items-center">
          <button type="button" onClick={() => (isOpen ? onPick(node.handle) : setOpen(node.handle))} className="flex flex-col items-center" aria-expanded={isOpen}
            title={en ? "Tap for details, tap again to open" : "Details के लिए tap, खोलने के लिए दोबारा tap"}>
            <span className={`grid h-10 w-10 place-items-center rounded-full text-[11px] font-bold text-white ring-4 ${tone(node)} ${isOpen ? "scale-110" : ""} transition-transform`}>{initials(node.handle)}</span>
            <span className="mt-1 max-w-[86px] truncate text-[11px] font-semibold">{isMe ? (en ? "You" : "आप") : node.handle}</span>
            <span className="mt-0.5 rounded-md bg-surface2 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight">
              <span className="text-muted">L</span> {kFmt(b.L)} <span className="text-faint">|</span> <span className="text-muted">R</span> {kFmt(b.R)}
              <span className="block text-[9px] font-medium text-faint">{b.pairs} pairs</span>
            </span>
          </button>
          {isOpen && (
            <div className={`absolute left-1/2 z-20 w-[200px] -translate-x-1/2 rounded-xl border border-border bg-surface p-2.5 text-left text-[11px] shadow-lg ${level >= maxDepth ? "bottom-full mb-1" : "top-full mt-1"}`}>
              <p className="truncate"><span className="text-muted">User Name:</span> <b>{node.handle}</b></p>
              <p className="truncate"><span className="text-muted">S. User Name:</span> <b>{node.sponsor || "—"}</b></p>
              <div className="mt-1.5 grid grid-cols-3 gap-x-2 text-[10px]">
                <span className="text-faint" /><span className="text-right text-faint">Left</span><span className="text-right text-faint">Right</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-good" />Green</span><b className="text-right">{tm.greenL}</b><b className="text-right">{tm.greenR}</b>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger" />Red</span><b className="text-right">{tm.redL}</b><b className="text-right">{tm.redR}</b>
              </div>
              <p className="mt-1.5 border-t border-border pt-1 text-[10px] text-muted">BV L {inFmt(b.L)} | R {inFmt(b.R)} · carry L {inFmt(b.carryL)} | R {inFmt(b.carryR)} · {b.pairs} pairs</p>
              {!isMe && <button type="button" onClick={() => onPick(node.handle)} className="mt-1.5 w-full rounded-lg bg-brand-soft py-1 text-[11px] font-semibold text-brand-ink">{en ? "Open this tree" : "इसका tree खोलें"}</button>}
            </div>
          )}
        </div>
        {level < maxDepth && (
          <div className="relative mt-3 flex gap-1 pt-3 before:absolute before:left-1/4 before:right-1/4 before:top-0 before:h-px before:bg-border after:absolute after:-top-3 after:left-1/2 after:h-3 after:w-px after:bg-border">
            <div className="relative before:absolute before:-top-3 before:left-1/2 before:h-3 before:w-px before:bg-border"><Slot node={kids.L} level={level + 1} /></div>
            <div className="relative before:absolute before:-top-3 before:left-1/2 before:h-3 before:w-px before:bg-border"><Slot node={kids.R} level={level + 1} /></div>
          </div>
        )}
      </div>
    );
  }
  return <Node node={root} level={0} />;
}
