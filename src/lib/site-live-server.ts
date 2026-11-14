import "server-only";
// "Your website is live" — one message (push + WhatsApp, the link), sent by the hourly job when the 24 hours are over
// (/api/cron/site-live) and by Super Admin → Websites → Live now (/api/admin/v2/websites).
import { notify } from "@/lib/notify";
import { cardHomeShown } from "@/lib/site-url";

export async function tellSiteLive(c: { id: string; owner_id: string; username: string; data: { customDomain?: string } }, premium: boolean): Promise<boolean> {
  const link = `https://${cardHomeShown(c.username, c.data?.customDomain)}`;
  const res = await notify(c.owner_id, "website_ready", {
    title: premium ? "Your Premium website is live" : "Your website is live",
    body: premium ? "आपकी Premium website अब live है — खोलकर देखें और ग्राहकों को भेजें।" : "आपकी website अब live है — खोलकर देखें और ग्राहकों को भेजें।",
    path: "/poster/site/choose", ref: `live:${c.id}:${premium ? "adv" : "site"}`,
    whatsappText: `*${premium ? "आपकी Premium website live है" : "आपकी website live है"}* 🎉\n\n${link}\n\nखोलकर देखें, और यही link ग्राहकों को WhatsApp करें। बदलना हो तो app में Card & Website → Edit।`,
  }).catch(() => ({} as Record<string, { ok?: boolean }>));
  return Object.values(res as Record<string, { ok?: boolean }>).some((x) => x?.ok);
}
