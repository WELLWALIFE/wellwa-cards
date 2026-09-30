import fs from "node:fs";
import path from "node:path";
export const MUSIC_DIR = path.join(process.cwd(), "bridge", "music");
// The short poster-video beds share a folder with the longer ad/reel tracks, so "Calm" sat next to
// "Calm Ambient" and "Festive" next to "Festive Diwali" in the picker. Named by what they are for.
const LABELS: Record<string, string> = {
  soft: "Soft & warm (short, status)", festive: "Festive bells (short, status)", calm: "Calm morning (short, status)", upbeat: "Upbeat (short, status)",
  "calm-ambient": "Calm ambient", "upbeat-corporate": "Upbeat corporate", "festive-diwali": "Festive Diwali", "energetic-promo": "Energetic promo",
  "inspiring-motivational": "Inspiring", "indian-sitar": "Indian sitar",
};
export function musicList() {
  try {
    return fs.readdirSync(MUSIC_DIR).filter((f) => f.endsWith(".mp3")).map((f) => {
      const key = f.replace(/\.mp3$/, "");
      return { key, name: LABELS[key] ?? key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), url: `/api/media/music/${key}` };
    }).sort((a, b) => Number(/\(short/.test(a.name)) - Number(/\(short/.test(b.name)) || a.name.localeCompare(b.name));
  } catch { return []; }
}
