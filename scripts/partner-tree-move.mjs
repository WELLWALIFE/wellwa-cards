// One-time tree change in the partner panel (owner's call, 4 Oct 2026):
//   1. every ID whose sponsor is the company's top ID (Shubhora) gets Next_Level as sponsor (Next_Level itself stays);
//   2. the whole team on the top ID's RIGHT is taken out of the tree and placed again, one by one in joining order,
//      by the panel's own joining rule under their (new) sponsor — IDs sponsored by Next_Level go to Next_Level's right.
// Nothing moves if any of those right-side IDs has volume (BV) or binary totals: no one's income or legs can change.
//
// Run on the VPS, from the partner app folder (it reads DATABASE_URL from .env.local there):
//   cd /opt/shubhora-partner/app && node /opt/neuraledge/app/scripts/partner-tree-move.mjs            (report only)
//   cd /opt/shubhora-partner/app && node /opt/neuraledge/app/scripts/partner-tree-move.mjs --apply    (backup, then change)
//   … --keep Demo_Shubhora,Demo      leave these IDs (username or SH code) exactly where they are
//   … --to Next_Level                the new sponsor (default Next_Level)
//   … --undo /var/backups/shubhora-partner/tree-move-<time>.json [--apply]    put everything back from that backup
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const APPLY = flag("--apply");
const TO = opt("--to") || "Next_Level";
const KEEP = (opt("--keep") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const UNDO = opt("--undo");
const BACKUP_DIR = process.env.TREE_BACKUP_DIR || "/var/backups/shubhora-partner";
const PLACEMENT_LOCK = 7_140_001;   // the panel's own placement lock: sign-ups wait while this runs
const REASON = "Owner's call 4 Oct 2026: Shubhora's direct IDs moved to Next_Level; the right team placed again by the joining rule";

function envUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const line = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "") : "";
  } catch { return ""; }
}
const url = envUrl();
if (!url) { console.error("DATABASE_URL not found — run this from /opt/shubhora-partner/app"); process.exit(1); }
// `postgres` comes from the partner app's own node_modules (the folder this is run from).
const postgres = createRequire(path.join(process.cwd(), "package.json"))("postgres");
const sql = postgres(url, { max: 1, onnotice: () => {} });
const n = (v) => (v === null || v === undefined ? null : Number(v));

async function loadMembers(db) {
  const rows = await db`select id, code, username, name, status, sponsor_id, parent_id, leg, depth from members order by id`;
  return rows.map((r) => ({ ...r, id: n(r.id), sponsor_id: n(r.sponsor_id), parent_id: n(r.parent_id), depth: n(r.depth) }));
}
const label = (m) => (m ? `${m.code}${m.username ? ` (${m.username})` : ""}` : "—");
const side = (l) => (l === "L" ? "left" : l === "R" ? "right" : "—");

/** The panel's joining rule, on an in-memory tree (src/server/engine/members.ts: autoLeg, weakerLeg, extremeSlot). */
function makeTree(members) {
  const byId = new Map(members.map((m) => [m.id, { ...m }]));
  const slot = new Map();   // "parent:leg" → child id
  for (const m of byId.values()) if (m.parent_id !== null) slot.set(`${m.parent_id}:${m.leg}`, m.id);
  const kids = (id) => ["L", "R"].map((l) => slot.get(`${id}:${l}`)).filter((x) => x !== undefined);
  function under(id) { const out = []; const st = [...kids(id)]; while (st.length) { const x = st.pop(); out.push(x); st.push(...kids(x)); } return out; }
  function sideOf(top, id) { let cur = byId.get(id); while (cur && cur.parent_id !== top) cur = byId.get(cur.parent_id); return cur?.leg; }
  function weakerLeg(sp) {
    let l = 0, r = 0; for (const x of under(sp)) (sideOf(sp, x) === "L" ? l++ : r++);
    return r < l ? "R" : "L";
  }
  function autoLeg(sp) {
    let l = 0, r = 0;
    for (const x of under(sp)) if (byId.get(x).sponsor_id === sp) (sideOf(sp, x) === "L" ? l++ : r++);
    if (l === 0) return "L"; if (r === 0) return "R"; return weakerLeg(sp);
  }
  function extremeSlot(from, leg) { let cur = from; for (;;) { const nx = slot.get(`${cur}:${leg}`); if (nx === undefined) return cur; cur = nx; } }
  function detach(id) { const m = byId.get(id); slot.delete(`${m.parent_id}:${m.leg}`); m.parent_id = null; m.leg = null; m.depth = null; }
  function place(id, parent, leg) {
    const m = byId.get(id); m.parent_id = parent; m.leg = leg; m.depth = byId.get(parent).depth + 1; slot.set(`${parent}:${leg}`, id);
  }
  return { byId, kids, under, autoLeg, extremeSlot, detach, place };
}

async function plan(db) {
  const members = await loadMembers(db);
  const byId = new Map(members.map((m) => [m.id, m]));
  const find = (h) => members.find((m) => m.username?.toLowerCase() === h.toLowerCase() || m.code.toLowerCase() === h.toLowerCase());
  const root = members.find((m) => m.parent_id === null);
  const nl = find(TO);
  if (!root) throw new Error("No top ID found.");
  if (!nl) throw new Error(`${TO} not found in the partner panel.`);
  const keep = new Set(KEEP.map((h) => { const m = find(h); if (!m) throw new Error(`--keep: ${h} not found.`); return m.id; }));

  const tree = makeTree(members);
  const rightTop = members.find((m) => m.parent_id === root.id && m.leg === "R");
  const right = rightTop ? [rightTop.id, ...tree.under(rightTop.id)] : [];
  if (right.includes(nl.id)) throw new Error(`${label(nl)} is itself in the top ID's right team — it cannot take that team under it.`);
  const moving = right.filter((id) => !keep.has(id));
  for (const id of keep) {
    const p = byId.get(id).parent_id;
    if (right.includes(id) && moving.includes(p)) throw new Error(`--keep ${label(byId.get(id))}: its upline ${label(byId.get(p))} moves; keep that one too.`);
  }

  // Safety: only IDs that never made volume move, so nobody's legs, carry or pairs change.
  const bv = moving.length ? await db`select m.code, count(*)::int as c from bv_events e join members m on m.id = e.member_id
                                      where e.member_id in ${db(moving)} and not e.void group by m.code` : [];
  const bin = moving.length ? await db`select m.code from binary_state b join members m on m.id = b.member_id
                                       where b.member_id in ${db(moving)} and (b.total_left + b.total_right + b.carry_left + b.carry_right + b.pairs_total) > 0` : [];
  const blockers = [...bv.map((r) => `${r.code} has ${r.c} volume entr${r.c === 1 ? "y" : "ies"}`), ...bin.map((r) => `${r.code} has binary totals`)];

  // 1. Sponsors.
  const sponsorMoves = members.filter((m) => m.sponsor_id === root.id && m.id !== nl.id && !keep.has(m.id))
    .map((m) => ({ id: m.id, from: m.sponsor_id, to: nl.id }));
  for (const s of sponsorMoves) tree.byId.get(s.id).sponsor_id = s.to;

  // 2. Placement: take the right team out, then place it again in joining order (a sponsor before the people it brought).
  for (const id of moving) tree.detach(id);
  const waiting = [...moving].sort((a, b) => a - b);
  const placed = new Set(); const placeMoves = [];
  while (waiting.length) {
    const i = waiting.findIndex((id) => { const sp = tree.byId.get(id).sponsor_id; return !moving.includes(sp) || placed.has(sp); });
    if (i < 0) throw new Error("Could not order the right team by sponsor (a sponsor loop?).");
    const id = waiting.splice(i, 1)[0];
    const sp = tree.byId.get(id).sponsor_id;
    if (sp === null) throw new Error(`${label(byId.get(id))} has no sponsor.`);
    const leg = sp === nl.id ? "R" : tree.autoLeg(sp);
    const parent = tree.extremeSlot(sp, leg);
    tree.place(id, parent, leg); placed.add(id);
    const old = byId.get(id), now = tree.byId.get(id);
    placeMoves.push({ id, fromParent: old.parent_id, fromLeg: old.leg, toParent: now.parent_id, toLeg: now.leg, depth: now.depth });
  }
  return { members, byId, root, nl, sponsorMoves, placeMoves, blockers, maxId: Math.max(...members.map((m) => m.id)) };
}

function report(p) {
  const { byId, root, nl, sponsorMoves, placeMoves, blockers } = p;
  console.log(`Top ID: ${label(root)}   New sponsor: ${label(nl)}\n`);
  console.log(`SPONSOR  ${label(root)} → ${label(nl)}  (${sponsorMoves.length} IDs)`);
  for (const s of sponsorMoves) console.log(`  ${label(byId.get(s.id))}`);
  console.log(`\nTREE  the top ID's right team, placed again (${placeMoves.length} IDs, in joining order)`);
  for (const m of placeMoves)
    console.log(`  ${label(byId.get(m.id)).padEnd(34)} was under ${label(byId.get(m.fromParent))} ${side(m.fromLeg)}  →  now under ${label(byId.get(m.toParent))} ${side(m.toLeg)}`);
  if (blockers.length) { console.log("\nSTOP — these IDs already have volume, so nothing will be moved:"); for (const b of blockers) console.log(`  ${b}`); }
}

/** Take IDs out of the tree, deepest first, each parked under itself. A parked ID's own left slot is free because
 *  everything under it was parked before it; an ID that stayed under it (someone who joined later) stops the run. */
async function park(t, ids) {
  if (!ids.length) return;
  const rows = await t`select id from members where id in ${t(ids)} order by depth desc, id desc`;
  for (const r of rows) {
    const stays = await t`select code from members where parent_id = ${r.id} and leg = 'L' and id <> all(${t.array(ids.map(Number))}::bigint[])`;
    if (stays.length) throw new Error(`${stays[0].code} sits under an ID being moved — nothing changed.`);
    await t`update members set parent_id = id, leg = 'L' where id = ${r.id}`;
  }
}

/** Depth is the number of steps from the top; recomputed for everyone so IDs that joined under a moved ID stay right. */
async function fixDepth(t) {
  await t`with recursive d as (select id, 0 as lvl from members where parent_id is null
            union all select m.id, d.lvl + 1 from members m join d on m.parent_id = d.id)
          update members m set depth = d.lvl from d where m.id = d.id and m.depth <> d.lvl`;
}

async function verifyTree(t) {
  const [{ total }] = await t`select count(*)::int as total from members`;
  const [{ reach }] = await t`with recursive d as (select id from members where parent_id is null
                                union all select m.id from members m join d on m.parent_id = d.id) select count(*)::int as reach from d`;
  const loops = await t`select code from members where parent_id = id`;
  if (loops.length || reach !== total) throw new Error(`tree check failed: ${reach} of ${total} reachable, ${loops.length} detached — rolled back`);
}

async function apply(p) {
  const { members, byId, sponsorMoves, placeMoves, maxId } = p;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `tree-move-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), reason: REASON, sponsorMoves, placeMoves, members }, null, 1));
  console.log(`\nbackup: ${file}`);

  await sql.begin(async (t) => {
    await t`select pg_advisory_xact_lock(${PLACEMENT_LOCK})`;
    const [{ m }] = await t`select max(id)::bigint as m from members`;
    if (n(m) !== maxId) throw new Error("Someone joined while this ran — run it again.");
    const ids = [...new Set([...sponsorMoves.map((s) => s.id), ...placeMoves.map((x) => x.id)])];
    const now = ids.length ? await t`select id, sponsor_id, parent_id, leg from members where id in ${t(ids)} for update` : [];
    for (const r of now) {
      const o = byId.get(n(r.id));
      if (n(r.sponsor_id) !== o.sponsor_id || n(r.parent_id) !== o.parent_id || r.leg !== o.leg) throw new Error(`${o.code} changed while this ran — run it again.`);
    }
    for (const s of sponsorMoves) {
      await t`update members set sponsor_id = ${s.to} where id = ${s.id}`;
      await t`insert into tree_moves (member_id, kind, from_id, to_id, reason) values (${s.id}, 'sponsor', ${s.from}, ${s.to}, ${REASON})`;
      await t`insert into audit_log (member_id, action, reason, detail) values (${s.id}, 'tree.sponsor_change', ${REASON}, ${t.json({ from: s.from, to: s.to })})`;
    }
    // Out of the tree first, the lowest IDs first (each parked under itself: its own left slot is free by then),
    // then placed again one by one.
    await park(t, placeMoves.map((x) => x.id));
    for (const x of placeMoves) {
      await t`update members set parent_id = ${x.toParent}, leg = ${x.toLeg}, depth = ${x.depth} where id = ${x.id}`;
      await t`insert into tree_moves (member_id, kind, from_id, to_id, leg, reason) values (${x.id}, 'placement', ${x.fromParent}, ${x.toParent}, ${x.toLeg}, ${REASON})`;
      await t`insert into audit_log (member_id, action, reason, detail) values (${x.id}, 'tree.placement_move', ${REASON}, ${t.json({ from: x.fromParent, fromLeg: x.fromLeg, to: x.toParent, leg: x.toLeg })})`;
    }
    await fixDepth(t);
    await verifyTree(t);
  });
  console.log("done: sponsors and tree changed. To put it back:");
  console.log(`  node ${process.argv[1]} --undo ${file} --apply`);
}

async function undo(file) {
  const b = JSON.parse(fs.readFileSync(file, "utf8"));
  const old = new Map(b.members.map((m) => [m.id, m]));
  const ids = [...new Set([...b.sponsorMoves.map((s) => s.id), ...b.placeMoves.map((x) => x.id)])];
  console.log(`Undo ${file}: ${b.sponsorMoves.length} sponsors and ${b.placeMoves.length} placements go back.`);
  for (const id of ids) { const m = old.get(id); console.log(`  ${label(m)}  sponsor ${label(old.get(m.sponsor_id))}, under ${label(old.get(m.parent_id))} ${side(m.leg)}`); }
  if (!APPLY) { console.log("\nReport only. Add --apply to put it back."); return; }
  await sql.begin(async (t) => {
    await t`select pg_advisory_xact_lock(${PLACEMENT_LOCK})`;
    await park(t, b.placeMoves.map((x) => x.id));
    for (const id of ids) {
      const m = old.get(id);
      const taken = m.parent_id === null ? [] : await t`select code from members where parent_id = ${m.parent_id} and leg = ${m.leg} and id <> ${id}`;
      if (taken.length) throw new Error(`${m.code}'s old place is now taken by ${taken[0].code} — nothing changed.`);
      await t`update members set sponsor_id = ${m.sponsor_id}, parent_id = ${m.parent_id}, leg = ${m.leg}, depth = ${m.depth} where id = ${id}`;
      await t`insert into audit_log (member_id, action, reason, detail) values (${id}, 'tree.placement_move', ${"Undo of " + path.basename(file)}, ${t.json({ sponsor: m.sponsor_id, parent: m.parent_id, leg: m.leg })})`;
    }
    await fixDepth(t);
    await verifyTree(t);
  });
  console.log("done: put back as it was.");
}

try {
  if (UNDO) await undo(UNDO);
  else {
    const p = await plan(sql);
    report(p);
    if (p.blockers.length) process.exitCode = 2;
    else if (!APPLY) console.log("\nReport only — nothing changed. Add --apply to make these changes (a backup is written first).");
    else await apply(p);
  }
} catch (e) {
  console.error("\nERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
