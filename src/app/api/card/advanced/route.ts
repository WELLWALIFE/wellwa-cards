// The ADVANCED website (the Rs 5,999 "Make advanced website" button, owner 15-16 Oct 2026): the AI reviews the live site,
// designs a layout of its own for this business and rewrites the words in a more premium voice (src/lib/site-advanced-ai.ts).
// A job like the banner's (card-jobs.ts): one per account, it carries on when the screen is closed, a second tap joins it.
// No picture is generated here, so nothing is paid per picture; the segment is gated by the server flag and the
// entitlement (src/lib/advanced-access.ts) - nobody is let in, or charged, while it is half-built.
//
// GET  (bearer) → { access, current, job… }: whether this account may use it, what the card has now
//                 ({ has, on, archetype, at, round }) and the running / last job ({ job: null } or { job, state, stage, elapsed, status?, result? }).
// POST (bearer) { cardId?, mode?: "preview" | "apply", wish?: string } → starts the redesign (202) or joins the running one.
//        seedBump (number): designs already looked at, so a new preview is a different composition from the last.
//        preview (default) saves nothing: the finished job's `result` is { spec, copy, critique, diff, source, round } for the
//        owner to look at; apply saves it at once. Each is limited to 8 starts an hour.
// POST (bearer) { accept: <job id> }       → the owner liked the preview: it is saved (no second AI run) and switched on.
// POST (bearer) { toggle: true | false }   → show the advanced website / the basic one (both stay stored).
// POST (bearer) { revert: true }           → the basic website for good: the owner's own words back, every advanced field removed.
// POST (bearer) { claim: <job id> }        → the phone has taken that finished job.
import { NextResponse, after } from "next/server";
import { claim, currentJob, jobView, startJob, touch, type CardJob } from "@/lib/card-jobs";
import { notify } from "@/lib/notify";
import { rateLimited } from "@/lib/api-security";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { myCard } from "@/lib/site-server";
import { advancedTriesLeft, isAdvancedAllowed, spendAdvancedTry } from "@/lib/advanced-access";
import { advancedState, applyAdvanced, cleanResult, designAdvanced, revertAdvanced, setAdvancedOn } from "@/lib/site-advanced-ai";
import { SITE_URL } from "@/lib/site-url";
import type { Card } from "@/lib/types";

// Review + design + words are three AI calls, two of them side by side; the job outlives the request.
export const maxDuration = 200;

type Obj = Record<string, unknown>;
const keyOf = (uid: string) => `${uid}-advanced`;

const save = (id: string, ownerId: string, data: Card) =>
  restAsService(`cards?id=eq.${id}&owner_id=eq.${ownerId}`, { method: "PATCH", body: JSON.stringify({ data }) });

// While the payment is not on sale (ADVANCED_SITE_SELL off) an unpaid account gets the "not open yet" answer, not a plan offer.
const closed = (reason: "flag" | "unpaid" | undefined) => {
  if (reason !== "flag" && process.env.ADVANCED_SITE_SELL !== "1") reason = "flag";
  return NextResponse.json(
  reason === "flag"
    ? { error: "The advanced website is not open yet.", advanced: true, reason }
    : { error: "The Premium website is part of the Premium plan: Rs 5,999 for the first month only, then Rs 2,999 a month.", advanced: true, reason: reason ?? "unpaid", plan: true },
  { status: reason === "flag" ? 403 : 402 },
  );
};

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const cardId = new URL(request.url).searchParams.get("cardId") ?? undefined;
  const [access, row, job] = await Promise.all([isAdvancedAllowed(me.id), myCard(me.id, cardId), currentJob(keyOf(me.id))]);
  const current = row ? advancedState(row.data) : null;
  if (!job) return NextResponse.json({ access, current, job: null });
  touch(keyOf(me.id));
  return NextResponse.json({ access, current, ...jobView(job) });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as Obj;
  const key = keyOf(me.id);

  if (typeof b.claim === "string") return NextResponse.json({ ok: await claim(key, b.claim) });

  const row = await myCard(me.id, typeof b.cardId === "string" ? b.cardId : undefined);
  if (!row) return NextResponse.json({ error: "Create your website first." }, { status: 400 });
  const data = row.data;

  // Going back to the basic website is always allowed, whatever the plan: the owner's own words are never held hostage.
  if (b.revert === true) {
    const next = revertAdvanced(data);
    const r = await save(row.id, me.id, next);
    if (!r.ok) return NextResponse.json({ error: "Could not put your basic website back. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true, current: advancedState(next) });
  }
  if (typeof b.toggle === "boolean") {
    if (b.toggle) {
      const access = await isAdvancedAllowed(me.id);
      if (!access.allowed) return closed(access.reason);
    }
    if (!data.site?.advanced) return NextResponse.json({ error: "There is no advanced website yet. Make it first." }, { status: 400 });
    const next = setAdvancedOn(data, b.toggle);
    if (next !== data) {
      const r = await save(row.id, me.id, next);
      if (!r.ok) return NextResponse.json({ error: "Could not switch your website. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, current: advancedState(next), username: row.username });
  }

  const access = await isAdvancedAllowed(me.id);
  if (!access.allowed) return closed(access.reason);

  if (typeof b.accept === "string") {
    const job = await currentJob(key);
    const res = job?.result as Obj | undefined;
    if (!job || job.id !== b.accept || job.state !== "done" || !res || res.mode !== "preview" || res.cardId !== row.id) {
      return NextResponse.json({ error: "That preview is no longer there. Please make it again." }, { status: 400 });
    }
    // Saved onto the card as it is NOW (the owner may have edited it while looking at the preview).
    const fresh = (await myCard(me.id, row.id))?.data ?? data;
    const clean = cleanResult(res, fresh);
    if (!clean) return NextResponse.json({ error: "That preview could not be read. Please make it again." }, { status: 400 });
    const next = applyAdvanced(fresh, clean);
    const r = await save(row.id, me.id, next);
    if (!r.ok) return NextResponse.json({ error: "Could not save your advanced website. Please try again." }, { status: 500 });
    await claim(key, job.id);
    return NextResponse.json({ ok: true, current: advancedState(next), username: row.username });
  }

  // Start (or join) the redesign.
  if (!data.site) return NextResponse.json({ error: "Create your website first." }, { status: 400 });
  const running = await currentJob(key);
  if (running?.state === "running") return NextResponse.json({ ...jobView(running), joined: true }, { status: 202 });
  // Keyed on the logged-in owner alone (see build/route.ts).
  if (rateLimited(`card-adv:${me.id}`, 8, 60 * 60_000)) return NextResponse.json({ error: "You have made the advanced design 8 times in the last hour. Please try again later." }, { status: 429 });

  // The paid tries (ADVANCED_TRIES per payment) are counted here on the server, not only on the phone. 429, not 402/403: the phone
  // treats those as "not open for you" and would hide the button instead of saying the three layouts are used.
  if ((await advancedTriesLeft(me.id)) === 0) return NextResponse.json({ error: "You have used all 3 layouts of your payment.", advanced: true, reason: "tries" }, { status: 429 });

  const mode = b.mode === "apply" ? "apply" : "preview";
  const bump = Math.max(0, Math.min(20, Math.round(Number(b.seedBump)) || 0));
  const wish = typeof b.wish === "string" ? b.wish.trim().slice(0, 300) : "";

  const { job, done, joined } = await startJob(key, { fresh: !!data.site.advanced }, async (step) => {
    const result = await designAdvanced(data, { userId: me.id, cardId: row.id, wish, bump, step });
    await spendAdvancedTry(me.id);       // a finished design is one try; a crash above costs nothing
    let saved = false;
    if (mode === "apply") {
      // Re-read the card: the words are put on what the owner has now, not on what it was when the tap came.
      const fresh = (await myCard(me.id, row.id))?.data ?? data;
      const next = applyAdvanced(fresh, result);
      const r = await save(row.id, me.id, next);
      if (!r.ok) return { status: 500, body: { error: "The advanced design was made but could not be saved. Please try again." } };
      saved = true;
    }
    return { status: 200, body: { ok: true, mode, saved, cardId: row.id, username: row.username, ...result } };
  }, async (j: CardJob) => {
    if (Date.now() - j.seenAt < 20_000) return;
    if (j.state === "done") await notify(me.id, "website_ready", { title: "Your advanced website design is ready", body: "आपकी एडवांस वेबसाइट का नया डिज़ाइन तैयार है — खोलकर देखें।", path: "/poster/site/advanced", ref: j.id, whatsappText: `*आपकी एडवांस वेबसाइट का नया डिज़ाइन तैयार है* ✨\n\n${SITE_URL}/poster/site/advanced` });
  });
  if (!joined) after(() => done.then(() => undefined));
  return NextResponse.json({ ...jobView(job), joined, mode }, { status: 202 });
}
