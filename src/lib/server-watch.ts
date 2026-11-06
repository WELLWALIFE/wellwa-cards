import "server-only";
// Server watch (owner, 6 Nov 2026 — the server was hacked: a Perl bot hid as "sshd", "syslogd", "httpd", "cron" and ate the whole CPU
// for days, and nobody knew). Looks for the same signs: programs wearing a system program's name while being a script interpreter,
// programs running from /tmp, /dev/shm or /var/tmp (or a deleted file), and a load far above the CPU count. Reads /proc only.
import { promises as fs } from "node:fs";
import os from "node:os";

export type Suspect = { pid: number; name: string; exe: string; why: string };
export type WatchResult = { load: number[]; cpus: number; overloaded: boolean; suspects: Suspect[] };

const DAEMONS = /^(\/usr\/sbin\/|\/sbin\/|\/usr\/local\/apache\/bin\/)?(sshd|syslogd|klogd|rsyslogd|httpd|cron|crond|kworker|kthreadd|systemd|dbus-daemon)\b/;
const INTERPRETERS = /\/(perl|python[0-9.]*|php|sh|bash|dash)$/;
const TEMP = /^\/(tmp|dev\/shm|var\/tmp)\//;

export async function watchServer(): Promise<WatchResult> {
  const load = os.loadavg().map((x) => Math.round(x * 100) / 100), cpus = os.cpus().length || 1;
  const suspects: Suspect[] = [];
  let pids: string[] = [];
  try { pids = (await fs.readdir("/proc")).filter((p) => /^\d+$/.test(p)); } catch { /* not Linux */ }
  for (const p of pids) {
    try {
      const exe = await fs.readlink(`/proc/${p}/exe`).catch(() => "");
      if (!exe) continue;
      const name = (await fs.readFile(`/proc/${p}/cmdline`, "utf8").catch(() => "")).replace(/\0+/g, " ").trim().slice(0, 120);
      const why = INTERPRETERS.test(exe) && DAEMONS.test(name) ? `a ${exe.split("/").pop()} script named like a system program`
        : TEMP.test(exe) ? "runs from a temporary folder"
        : / \(deleted\)$/.test(exe) && !/^\/(usr|opt|lib|lib64|bin|sbin)\//.test(exe) ? "its program file was deleted after it started"
        : "";
      if (why) suspects.push({ pid: Number(p), name, exe, why });
    } catch { /* the process ended meanwhile */ }
  }
  // 15-minute load above three times the CPUs: busy for long, not a short build.
  return { load, cpus, overloaded: load[2] > cpus * 3, suspects: suspects.slice(0, 30) };
}
