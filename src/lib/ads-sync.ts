import "server-only";
// Ads v2 — the hourly sync (owner, 1 Nov 2026: the owner should not have to open Ads Manager to know what happened). For every campaign
// the app knows and that has not ended, Meta is asked once an hour; the row keeps what came back (status, review reason, spend, results,
// dates), and the owner hears ONCE about each turn: the ad went live · Meta did not approve it (with the reason) · it ends tomorrow ·
// it ended (with the numbers and "run it again"). At 8 pm IST the owner with money spent today gets one line per running ad.
// Called by /api/cron/ads-sync (scripts/ads-sync.sh, cron from deploy.sh). Nothing here ever starts or pauses an ad.
import { restAsService } from "@/lib/poster-server";
import { notify } from "@/lib/notify";
import { fbAccount, liveCampaigns, type CampaignLive, type CampaignRow } from "@/lib/ads-server";
import { adStateOf, costPer, managerUrl } from "@/lib/ads-shared";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const unit = (label: string | null | undefined, n: number) => (label === "chats" ? (n === 1 ? "WhatsApp chat" : "WhatsApp chats") : n === 1 ? "click" : "clicks");
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "");

export type SyncReport = { users: number; checked: number; told: number; ended: number; failed: number; skipped: number };

export async function syncAds(mode: "hourly" | "daily"): Promise<SyncReport> {
  const rep: SyncReport = { users: 0, checked: 0, told: 0, ended: 0, failed: 0, skipped: 0 };
  // Open campaigns: not marked ended, and made in the last 120 days (older ones were never synced and would only make noise).
  const since = new Date(Date.now() - 120 * 86400_000).toISOString();
  const rows = list(await restAsService<CampaignRow[]>(`ad_campaigns?ended_at=is.null&created_at=gte.${since}&select=*&order=user_id,created_at.desc&limit=2000`));
  const byUser = new Map<string, CampaignRow[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  for (const [userId, mine] of byUser) {
    rep.users += 1;
    let fb: Awaited<ReturnType<typeof fbAccount>> = null;
    try { fb = await fbAccount(userId); } catch { fb = null; }
    if (!fb?.user_token) { rep.skipped += mine.length; continue; }
    const byAcct = new Map<string, CampaignRow[]>();
    for (const r of mine) byAcct.set(r.ad_account, [...(byAcct.get(r.ad_account) ?? []), r]);
    const todayLines: string[] = []; let todaySpend = 0;
    for (const [acct, group] of byAcct) {
      let live: Record<string, CampaignLive> = {};
      try { live = await liveCampaigns(fb, acct, group.map((r) => r.campaign_id), mode === "daily" ? "today" : "maximum"); }
      catch { rep.failed += group.length; continue; }
      for (const row of group) {
        rep.checked += 1;
        const l = live[row.campaign_id];
        if (mode === "daily") {
          if (l && l.spend > 0) { todaySpend += l.spend; todayLines.push(`• ${row.name}: ${inr(l.spend * 100)} · ${l.results} ${unit(l.resultLabel, l.results)}`); }
          continue;
        }
        if (!l) {
          // Not in Meta's list any more (deleted / archived in Ads Manager) — after a day's grace, it is over for the app too.
          if (Date.now() - Date.parse(row.created_at) > 86400_000) { await restAsService(`ad_campaigns?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ended_at: new Date().toISOString(), effective_status: "DELETED", synced_at: new Date().toISOString() }) }); rep.ended += 1; }
          continue;
        }
        const state = adStateOf({ effective_status: l.effective_status, status: l.status, start_time: l.start, end_time: l.stop });
        const told: Record<string, string> = { ...(row.told ?? {}) };
        const now = new Date().toISOString();
        const patch: Record<string, unknown> = {
          effective_status: l.effective_status, review_feedback: l.feedback ?? null, spend_paise: Math.round(l.spend * 100), reach: l.reach, results: l.results, result_label: l.resultLabel,
          start_time: l.start ?? row.start_time ?? null, end_time: l.stop ?? row.end_time ?? null, daily_paise: l.dailyPaise ?? row.daily_paise, synced_at: now, updated_at: now,
        };
        const open = managerUrl(row.ad_account, row.campaign_id);
        const path = "/poster/ads?tab=mine";
        const say = async (key: string, title: string, body: string, wa: string) => {
          const r = await notify(userId, "ad_update", { title, body, path, ref: `ad:${key}:${row.id}`, whatsappText: wa }).catch(() => ({}));
          told[key] = now; rep.told += 1; void r;
        };
        if (state === "running" && !told.live) {
          await say("live", `Your ad is live: ${row.name}`, `Facebook ने मंज़ूर कर दी — अब लोगों को दिख रही है। रोज़ ${inr(row.daily_paise)} तक${l.stop ? `, ${day(l.stop)} तक` : ""}.`,
            `*आपकी ad चालू हो गई* ✅\n${row.name}\nFacebook ने मंज़ूर कर दी — अब लोगों को दिख रही है।\nरोज़ ${inr(row.daily_paise)} तक${l.stop ? ` · ${day(l.stop)} तक` : ""}\n\nखर्च और नतीजे: app → Ads → मेरी ads`);
        }
        if (state === "rejected" && !told.rejected) {
          const why = l.feedback ? `\nFacebook का कारण: ${l.feedback}` : "";
          await say("rejected", `Facebook did not approve: ${row.name}`, `Ad मंज़ूर नहीं हुई — शब्द या photo बदलकर “फिर से चलाएँ”। कोई पैसा नहीं लगा।`,
            `*Facebook ने ad मंज़ूर नहीं की* ⚠️\n${row.name}${why}\n\nकोई पैसा नहीं लगा। App → Ads → मेरी ads में “फिर से चलाएँ” दबाकर शब्द या photo बदलें।\n${open}`);
        }
        if (state === "running" && l.stop && !told.ending) {
          const left = Date.parse(l.stop) - Date.now();
          if (left > 0 && left < 30 * 3600_000) {
            await say("ending", `Ad ends tomorrow: ${row.name}`, `अब तक ${inr(l.spend * 100)} में ${l.results} ${unit(l.resultLabel, l.results)}. चाहें तो दिन बढ़ाएँ।`,
              `*कल आपकी ad ख़त्म हो रही है* ⏳\n${row.name}\nअब तक: ${inr(l.spend * 100)} खर्च · ${l.results} ${unit(l.resultLabel, l.results)}${costPer(l.spend, l.results) ? ` · ₹${costPer(l.spend, l.results)} प्रति` : ""}\n\nअच्छा चल रही है? App → Ads → मेरी ads → “दिन बढ़ाएँ”।`);
          }
        }
        if (state === "ended") {
          patch.ended_at = row.ended_at ?? now; rep.ended += 1;
          if (!told.ended) {
            const cp = costPer(l.spend, l.results);
            await say("ended", `Ad finished: ${row.name}`, `${inr(l.spend * 100)} खर्च · ${l.results} ${unit(l.resultLabel, l.results)}${cp ? ` · ₹${cp} प्रति` : ""}. फिर से चलाना हो तो एक tap।`,
              `*आपकी ad पूरी हो गई* 🏁\n${row.name}\nकुल: ${inr(l.spend * 100)} खर्च · ${(l.reach || 0).toLocaleString("en-IN")} लोगों तक · ${l.results} ${unit(l.resultLabel, l.results)}${cp ? ` · ₹${cp} प्रति` : ""}\n\nफिर से चलानी हो: App → Ads → मेरी ads → “फिर से चलाएँ” (वही audience, नई तारीख)।`);
          }
        }
        patch.told = told;
        const w = await restAsService(`ad_campaigns?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
        if (!w.ok) rep.failed += 1;
      }
    }
    if (mode === "daily" && todayLines.length && todaySpend > 0) {
      const d = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      await notify(userId, "ad_update", {
        title: `Today's ads: ${inr(todaySpend * 100)} spent`, body: todayLines.join(" · ").slice(0, 200), path: "/poster/ads?tab=mine", ref: `ad:day:${userId}:${d}`,
        whatsappText: `*आज की ads* 📊\n${todayLines.join("\n")}\n\nकुल आज: ${inr(todaySpend * 100)}\nपूरा हिसाब: app → Ads → मेरी ads`,
      }).catch(() => undefined);
      rep.told += 1;
    }
  }
  return rep;
}
