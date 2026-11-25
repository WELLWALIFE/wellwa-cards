import "server-only";
// The weekly Google + website check of a CONNECTED business (owner, 26 Nov 2026 — the list after studying Localo / Grexa / GoHighLevel:
// "website hamari wahi rahegi, aap growth plan ke saath sab maintain karo"). It is the free Google check run on the owner's own profile
// (what Google shows from outside: profile, reviews, nearby rivals, website speed and SEO), plus what only the connection knows
// (reviews left unanswered, days since the last Google post) and whether the website opens at all. Kept in google_accounts.insights:
//   health       the latest result, shown in Social → Google and used by the Monday report
//   health_hist  the last 12 scores, for the "up / down since last week" line
// Nothing is changed on the profile or the website: it only reads and lists what to fix.
import { getProfile, googleRow, googleToken, listLocalPosts, listReviews, patchRow, placeIdFor, replyCount } from "@/lib/google-server";
import { buildReport, cachedReport, saveReport, type Report } from "@/lib/google-check";

export type HealthIssue = { title: string; hi: string; why: string };
export type Health = {
  at: string; score: number; place: string; mapsUrl: string;
  rank: { rank: number | null; total: number; trade: string } | null;
  profile: { label: string; ok: boolean }[];
  website: { url: string; opens: boolean | null; speed: number | null; seo: number | null; https: boolean | null } | null;
  replies: { of: number; answered: number } | null;
  lastPostDays: number | null;
  issues: HealthIssue[];
};

const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/** Does the website answer at all (a page that does not open loses every visitor Google sends). null = could not tell. */
async function opens(url: string): Promise<boolean | null> {
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ShubhoraCheck/1.0)" } });
    return r.status < 400;
  } catch { return false; }
}

/** The last result kept for this owner (no Google call). */
export async function keptHealth(userId: string): Promise<{ health: Health | null; hist: { d: string; s: number }[] }> {
  const g = await googleRow(userId);
  const i = (g?.insights ?? {}) as { health?: Health; health_hist?: { d: string; s: number }[] };
  return { health: i.health ?? null, hist: Array.isArray(i.health_hist) ? i.health_hist : [] };
}

/** Run the check now. `fresh` false: a public report made in the last 7 days is reused (the Places calls are not repeated). */
export async function runHealth(userId: string, fresh = true): Promise<Health | { error: string }> {
  const g = await googleRow(userId);
  if (!g?.refresh_token || g.status !== "ok") return { error: "Connect your Google Business Profile first." };
  const placeId = await placeIdFor(userId);
  if (!placeId) return { error: "Google did not give us your profile's place id yet. Tap Refresh above and try again." };

  // The category the owner set on Google (read through the connection). The public Places data often files a business under no
  // trade even when it has one ("Water Purification Company" on Wellwa showed as no category, 26 Nov 2026): the profile's own
  // category is what the nearby list is searched by, and the "no category" fix is not shown when one is set.
  const tok0 = await googleToken(g).catch(() => "");
  const prof = tok0 ? await getProfile(tok0, g.location_name).catch(() => null) : null;
  const ownCat = prof?.primaryCategory?.displayName ?? "";
  let r: Report | null = fresh ? null : await cachedReport(placeId);
  if (r && ownCat && !r.local) r = null;
  if (!r || r.sitePending) {
    r = await buildReport(placeId, ownCat, true);
    await saveReport(r, { ip: "", userId, query: "weekly health" }).catch(() => {});
  }

  // What only the connection knows.
  let rp = (g.insights as { replies?: { of: number; answered: number } } | null)?.replies ?? null;
  let lastPostDays: number | null = null;
  const tok = await googleToken(g).catch(() => "");
  if (tok) { try { rp = replyCount((await listReviews(tok, g.location_name)).reviews); } catch { /* the kept count stays */ } }
  try {
    if (!tok) throw new Error("no token");
    const posts = await listLocalPosts(tok, g.location_name);
    const newest = posts.map((p) => p.createTime).filter(Boolean).sort().pop();
    lastPostDays = newest ? days(newest) : 9999;
  } catch { /* posts not readable: left out, never guessed */ }
  const web = r.place.website;
  const open = web ? await opens(web) : null;

  const issues: HealthIssue[] = [];
  if (web && open === false) issues.push({ title: "Your website does not open", hi: "Aapki website khul nahi rahi", why: "Everyone Google sends to it leaves. Ask whoever runs it to check the hosting and the domain." });
  if (rp && rp.of > rp.answered) { const n = rp.of - rp.answered; issues.push({ title: `${n} Google review${n > 1 ? "s" : ""} not answered`, hi: `${n} Google review ka jawab nahi diya`, why: "Answered reviews build trust and Google shows active businesses higher. Answer them in Reviews, or turn on AI auto-reply." }); }
  if (lastPostDays !== null && lastPostDays > 7) issues.push({ title: lastPostDays >= 9999 ? "No Google posts yet" : `No Google post for ${lastPostDays} days`, hi: lastPostDays >= 9999 ? "Google par abhi tak koi post nahi" : `${lastPostDays} din se Google par koi post nahi`, why: "Turn on the 4 AM auto-post: today's poster goes up as a Google update by itself." });
  // With the profile read through the connection, its own category and description are the truth, not the outside guess.
  if (prof) {
    if (!prof.primaryCategory) issues.push({ title: "No main category on Google", hi: "Google par main category nahi hai", why: "Google does not know what you sell. Set it in Edit Google profile above." });
    if (!prof.additionalCategories.length) issues.push({ title: "No additional categories", hi: "Aur categories nahi daali", why: "Add the other things you sell or do (Edit Google profile above) — Google then shows you for those searches too." });
    if (!prof.description.trim()) issues.push({ title: "No business description", hi: "Business ki jaankari nahi likhi", why: "Write it in Edit Google profile above (AI can draft it): what you do, for whom, where." });
    if (!prof.periods.length) issues.push({ title: "Opening hours are not set", hi: "Khulne ka samay nahi daala", why: "People skip a shop whose hours they cannot see. Set them in Edit Google profile above." });
  }
  for (const f of r.issues ?? r.fixes) {
    if (prof && /categor|opening hours|hours are not/i.test(f.title)) continue;
    issues.push({ title: f.title, hi: f.hi ?? f.title, why: f.why });
  }

  const h: Health = {
    at: new Date().toISOString(), score: r.score, place: r.place.name, mapsUrl: r.place.mapsUrl,
    rank: r.local ? { rank: r.local.rank, total: r.local.total, trade: r.trade ?? r.place.category } : null,
    profile: (r.profile ?? []).map((x) => !prof ? x : /primary category/i.test(x.label) ? { ...x, ok: !!prof.primaryCategory } : /additional categor/i.test(x.label) ? { ...x, ok: prof.additionalCategories.length > 0 } : x),
    website: web ? { url: web, opens: open, speed: r.site.checked ? r.site.performance : null, seo: r.site.checked ? r.site.seo : null, https: r.site.checked ? r.site.https : null } : null,
    replies: rp, lastPostDays: lastPostDays !== null && lastPostDays >= 9999 ? null : lastPostDays,
    issues: issues.slice(0, 12),
  };
  const kept = await keptHealth(userId);
  const today = h.at.slice(0, 10);
  const hist = [...kept.hist.filter((x) => x.d !== today), { d: today, s: h.score }].slice(-12);
  const now = await googleRow(userId);   // read again: the reply count / review address may have been written meanwhile
  await patchRow(userId, { insights: { ...((now?.insights ?? {}) as object), ...(rp ? { replies: rp } : {}), health: h, health_hist: hist } });
  return h;
}

/** Every connected business, one after another (Monday, after the weekly report). Never throws. */
export async function runHealthAll(userIds: string[]): Promise<{ done: number; failed: number }> {
  let done = 0, failed = 0;
  for (const id of userIds) {
    try { const h = await runHealth(id, false); if ("error" in h) failed++; else done++; }
    catch (e) { failed++; console.error("[google-health]", id, e instanceof Error ? e.message : e); }
  }
  return { done, failed };
}
