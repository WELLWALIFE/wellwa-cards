// Three-way merge for a whole-card Save (the full editor publishes the whole card): only what THIS screen changed since it
// opened goes over the server's copy; anything changed meanwhile elsewhere (Website edit's design, Products, another phone)
// stays. Owner, 25 Oct 2026: "jo sahi rahega wo karo" — a text edit must never undo another change.
type Obj = Record<string, unknown>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const hasIds = (v: unknown): v is Obj[] => Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && typeof x.id === "string");

/** A list of things with ids (pages, blocks, links): mine where I changed one, theirs where I did not, theirs' new ones kept,
 *  mine's removals honoured. My order wins. */
function mergeList(server: Obj[], base: Obj[], mine: Obj[], depth: number): Obj[] {
  const sById = new Map(server.map((x) => [x.id as string, x]));
  const bById = new Map(base.map((x) => [x.id as string, x]));
  const mineIds = new Set(mine.map((x) => x.id as string));
  const out: Obj[] = [];
  for (const m of mine) {
    const id = m.id as string, b = bById.get(id), s = sById.get(id);
    if (!b) { out.push(m); continue; }               // I added it
    if (!s) { if (!same(m, b)) out.push(m); continue; } // removed elsewhere: gone, unless I changed it
    out.push(merge(s, b, m, depth + 1) as Obj);
  }
  // Added elsewhere since I opened: kept (at the end).
  for (const s of server) { const id = s.id as string; if (!bById.has(id) && !mineIds.has(id)) out.push(s); }
  return out;
}

export function merge(server: unknown, base: unknown, mine: unknown, depth = 0): unknown {
  if (same(mine, base)) return server;                  // I did not touch it: theirs
  if (same(server, base)) return mine;                  // only I changed it: mine
  if (depth < 4 && isObj(server) && isObj(base) && isObj(mine)) {
    const out: Obj = {};
    for (const k of new Set([...Object.keys(server), ...Object.keys(base), ...Object.keys(mine)])) {
      const v = merge(server[k], base[k], mine[k], depth + 1);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (depth < 4 && hasIds(server) && Array.isArray(base) && hasIds(mine)) return mergeList(server, base as Obj[], mine, depth);
  return mine;                                          // both changed the same plain value: the Save just pressed wins
}

/** The card to publish: `mine` (this screen) merged onto `server` (the card now) from `base` (the card when this screen opened). */
export function mergeCard<T>(server: T, base: T, mine: T): T { return merge(server, base, mine) as T; }
