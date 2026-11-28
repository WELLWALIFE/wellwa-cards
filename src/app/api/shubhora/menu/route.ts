// Shubhora's partner menu as Super Admin set it (platform_settings.shubhora_menu) — for a partner's AI Training screen, which
// shows each item with the text their customers get and lets them change it for their own number. Public text only (the
// same words every partner's customers read), so no login is needed.
//   GET → { menu: { items?, links? } }   ({} = the built-in menu, bridge/shubhora-menu.mjs)
import { getShubhoraMenu } from "@/lib/platform";

export async function GET() {
  return Response.json({ menu: await getShubhoraMenu() }, { headers: { "cache-control": "no-store" } });
}
