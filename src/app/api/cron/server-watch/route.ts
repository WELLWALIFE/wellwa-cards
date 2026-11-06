// Every 10 minutes (/etc/cron.d/shubhora-server-watch, written by deploy.sh): the server watch (lib/server-watch.ts). When it finds a
// disguised program or a long overload it alarms the owners at once — e-mail, WhatsApp, push — through /api/notify/owner (once an hour).
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/server-watch
import { NextResponse } from "next/server";
import { watchServer } from "@/lib/server-watch";

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const w = await watchServer();
  const lines: string[] = [];
  if (w.suspects.length) lines.push(`Suspicious programs (${w.suspects.length}):`, ...w.suspects.slice(0, 10).map((s) => `• pid ${s.pid} "${s.name}" → ${s.exe} — ${s.why}`));
  if (w.overloaded) lines.push(`CPU load ${w.load.join(" / ")} on ${w.cpus} cores (15-minute load above ${w.cpus * 3}).`);
  if (!lines.length) return NextResponse.json({ ok: true, ...w });
  const text = [...lines, "", "Open Admin → System health. If these are not yours, the server may be hacked again: tell your developer at once."].join("\n");
  const r = await fetch("http://127.0.0.1:3001/api/notify/owner", {
    method: "POST", headers: { "content-type": "application/json", "x-cron-key": process.env.CRON_KEY },
    body: JSON.stringify({ subject: w.suspects.length ? "Server: suspicious programs found" : "Server: CPU overloaded", text, key: w.suspects.length ? "server-watch:suspects" : "server-watch:load", path: "/admin/system" }),
  }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
  console.log("[server-watch]", JSON.stringify({ suspects: w.suspects.length, load: w.load, alarm: r }));
  return NextResponse.json({ ok: true, alarmed: true, ...w });
}
