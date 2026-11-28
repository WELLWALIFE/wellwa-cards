// Lists of short points on the website ("Why choose us", "Our commitment", the about's ticks) cleaned before they are drawn (owner,
// 28 Nov 2026: "duplicate si website", seen live on an EV dealer's site: "Trusted by many customers", "Rewari & nearby", and
// "Genuine components and original spares" next to "Genuine parts, bill given").
//   • filler that is true of every shop ("Trusted by many customers", "Best quality") goes when the list has enough real points;
//   • a point that says nearly the same as one before it (in this list or an earlier list on the page) goes;
//   • what is left keeps the owner's order.
// Pure; used by the website renderers. Nothing is changed in the saved card: the owner's own words stay as they wrote them.

/** Says nothing at all — every shop could say it, no customer can check it: never drawn. */
const HOLLOW = [
  /\btrusted by (many|lots of|all|our|thousands of) customers\b/i, /^(best|top|high|premium|good) quality$/i, /^quality (service|products?|work)$/i,
  /\bcustomer satisfaction\b/i, /\bsatisfied customers\b/i, /^trusted (company|brand|business|name)$/i, /^100% (satisfaction|genuine)$/i,
  /^we care$/i, /^your trust,? our (priority|promise)$/i,
  /भरोसेमंद$/, /^बेहतरीन क्वालिटी$/, /^अच्छी क्वालिटी$/, /ग्राहक संतुष्टि/,
];
/** Weak — true but general: drawn only when the list has little else (fewer than `min` real points). */
const WEAK = [
  /^(expert|experienced|professional|skilled) (team|staff)$/i, /^fair (prices?|rates?)$/i, /^affordable( prices?| rates?)?$/i,
  /^best (price|prices|rates?|value)$/i, /^on-?time (service|delivery)$/i, /^fast service$/i, /^quick service$/i,
  /(&|and|और|aur)\s*(nearby|आस-पास|aas-paas)\s*$/i,   // a place line ("Rewari & nearby") says where, not why
];

/** Words that mean the same thing in these lists, so "Genuine parts" and "Original spares" are seen as one point. */
const SAME_WORD: Record<string, string> = {
  component: "part", components: "part", parts: "part", spare: "part", spares: "part", accessory: "part", accessories: "part",
  original: "genuine", authentic: "genuine", authorised: "authorized", certified: "authorized",
  doorstep: "home", delivered: "delivery", deliveries: "delivery",
  advice: "guidance", consultation: "guidance", help: "guidance", support: "guidance",
};

const STOP = new Set("a an and the of for to in on with by our we your you is are all every from at as or & और का की के में से हम आप".split(" "));
const stem = (w: string) => SAME_WORD[w] ?? w.replace(/(ing|es|s|ed)$/i, "");
const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem));
const strip = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

/** Two points that say nearly the same thing: one's words are mostly inside the other's. */
export function samePoint(a: string, b: string): boolean {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / Math.min(A.size, B.size) >= 0.6 || (both >= 2 && both / Math.max(A.size, B.size) >= 0.5);
}

export const isHollowPoint = (s: string) => HOLLOW.some((re) => re.test(strip(s)));
const isWeakPoint = (s: string) => WEAK.some((re) => re.test(strip(s)));
/** Hollow or weak: a point that does not tell this business apart. */
export const isFillerPoint = (s: string) => isHollowPoint(s) || isWeakPoint(s);

/**
 * The points worth drawing, in order. `seen`: points an earlier list on the same page already showed (filled in as this one keeps
 * its own). Hollow points never stay; weak ones only while there are fewer than `min` real points.
 */
export function cleanPoints(items: string[], seen: string[] = [], min = 3): string[] {
  const list = items.map((s) => (s ?? "").trim()).filter(Boolean).filter((s) => !isHollowPoint(s));
  const real = list.filter((s) => !isWeakPoint(s));
  const keepWeak = real.length < min;
  const out: string[] = [];
  for (const s of list) {
    if (!keepWeak && isWeakPoint(s)) continue;
    const t = strip(s);
    if ([...seen, ...out].some((o) => samePoint(strip(o), t))) continue;
    out.push(s);
  }
  seen.push(...out);
  return out;
}

/** One page's memory of the lists it has drawn (keyed by the page's content object, then by the list), so a later list does not repeat
 *  an earlier one. A list asked for again (React draws a component more than once) gets its first answer back, never an emptier one. */
const pages = new WeakMap<object, Map<string, string[]>>();
export function pagePointsOnce(page: object, key: string, items: string[]): string[] {
  let lists = pages.get(page);
  if (!lists) { lists = new Map(); pages.set(page, lists); }
  const had = lists.get(key);
  if (had) return had;
  const seen = [...lists.values()].flat();
  const kept = cleanPoints(items, seen);
  lists.set(key, kept);
  return kept;
}
