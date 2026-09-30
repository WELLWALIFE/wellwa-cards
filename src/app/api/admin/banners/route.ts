// Super Admin: daily occasion banners for WhatsApp follow-ups.
//   GET  → next 21 days: occasion (if any) + whether a banner exists
//   POST { date, force? } → generate (or regenerate) that day's banner now
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { adminAllowed } from "@/lib/admin-guard";

const run = promisify(execFile);
const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "bridge", "banner-daily.mjs");
const OUT = path.join(ROOT, "public", "wellwa", "followups", "daily");

type Occ = { y?: number; m: number; d: number; slug: string; title: string; hi: string; greet: string; theme: string; verify?: boolean };

function istDate(offsetDays = 0): string {
  const t = new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86400000);
  return t.toISOString().slice(0, 10);
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(p, "utf8")) as T; } catch { return fallback; }
}

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cal = await readJson<{ fixed: Occ[]; moving: Occ[] }>(path.join(ROOT, "bridge", "occasions.json"), { fixed: [], moving: [] });
  const idx = await readJson<Record<string, { slug: string | null; url?: string; generatedAt?: string; verify?: boolean }>>(path.join(OUT, "index.json"), {});
  const days = [];
  for (let i = -1; i < 21; i++) {
    const date = istDate(i);
    const [y, m, d] = date.split("-").map(Number);
    const occ = cal.moving.find((o) => o.y === y && o.m === m && o.d === d) ?? cal.fixed.find((o) => o.m === m && o.d === d) ?? null;
    let exists = false;
    try { await fs.access(path.join(OUT, `${date}.jpg`)); exists = true; } catch { /* none */ }
    days.push({ date, occasion: occ ? { slug: occ.slug, title: occ.title, hi: occ.hi, greet: occ.greet, verify: !!occ.verify } : null, banner: exists ? `/api/daily-banner/${date}.jpg` : null, generatedAt: idx[date]?.generatedAt ?? null });
  }
  return NextResponse.json({ today: istDate(), days });
}

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const date = String(body.date ?? istDate());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Bad date." }, { status: 400 });
  const args = [SCRIPT, "--date", date];
  if (body.force) args.push("--force");
  try {
    const { stdout, stderr } = await run(process.execPath, args, { cwd: ROOT, timeout: 150_000, maxBuffer: 1 << 20 });
    return NextResponse.json({ ok: true, log: (stdout + stderr).trim().slice(-800), banner: `/api/daily-banner/${date}.jpg?t=${Date.now()}` });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json({ ok: false, error: ((err.stderr || "") + (err.stdout || "") || err.message || "failed").trim().slice(-800) }, { status: 500 });
  }
}
