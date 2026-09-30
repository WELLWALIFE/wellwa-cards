import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const ffmpeg = join(root, "node_modules/ffmpeg-static/ffmpeg");
const outDir = join(root, "public/wellwa/video");
const temp = await mkdtemp(join(tmpdir(), "wellwa-video-"));

const videos = [
  {
    name: "wellwa-home-demo-journey",
    steps: [
      ["home-demo-consultation.webp", "Start with your water", "Share city, source water, family size and current filtration"],
      ["aura-plus-kitchen-hero.webp", "See a guided demonstration", "Understand controls, presets, care and realistic output factors"],
      ["aura-plus-7.webp", "Compare the Aura range", "Choose by household use, source water and installation conditions"],
      ["home-demo-consultation.webp", "Confirm the written details", "Review price, warranty, installation and service before ordering"],
      ["aura-plus-kitchen-hero.webp", "Professional installation", "Complete plumbing setup, app pairing and a clear handover"],
    ],
  },
  {
    name: "wellwa-technology-explainer",
    steps: [
      ["aura-plus-kitchen-hero.webp", "Source water comes first", "Quality, minerals, hardness, flow and temperature affect performance"],
      ["aura-5.webp", "Conditioned water enters", "Required pre-filtration should be decided after a water review"],
      ["aura-plus-7.webp", "Electrolysis creates modes", "Platinum-coated titanium plates support selectable water outputs"],
      ["aura-maxx.webp", "Output is never one fixed number", "Actual pH, ORP and hydrogen vary with water and operating conditions"],
      ["aura-plus-kitchen-hero.webp", "Connected care adds context", "App status, care alerts, diagnostics and supported updates assist ownership"],
      ["home-demo-consultation.webp", "A trained handover matters", "Learn each mode, cleaning workflow and service escalation"],
    ],
  },
];

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function run(args) {
  const result = spawnSync(ffmpeg, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg exited with ${result.status}`);
}

try {
  for (const video of videos) {
    const segments = [];
    for (let i = 0; i < video.steps.length; i += 1) {
      const [imageName, title, subtitle] = video.steps[i];
      const frame = join(temp, `${video.name}-${i}.png`);
      const segment = join(temp, `${video.name}-${i}.mp4`);
      const overlay = Buffer.from(`
        <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
          <rect width="1280" height="720" fill="rgba(0,0,0,0.24)"/>
          <rect x="64" y="488" width="1152" height="166" rx="24" fill="rgba(4,18,22,0.74)"/>
          <rect x="88" y="514" width="8" height="104" rx="4" fill="#18b8a7"/>
          <text x="124" y="558" font-family="Arial, Helvetica, sans-serif" font-size="45" font-weight="700" fill="white">${escapeXml(title)}</text>
          <text x="126" y="608" font-family="Arial, Helvetica, sans-serif" font-size="25" fill="#d7e7e8">${escapeXml(subtitle)}</text>
          <text x="1160" y="110" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="white">SAMPLE VIDEO</text>
        </svg>
      `);

      await sharp(join(root, "public/wellwa/images", imageName))
        .resize(1280, 720, { fit: "cover", position: "centre" })
        .composite([{ input: overlay }])
        .png()
        .toFile(frame);

      run(["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-t", "4", "-i", frame,
        "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", segment]);
      segments.push(segment);
    }

    const inputs = segments.flatMap((segment) => ["-i", segment]);
    const chain = segments.map((_, i) => `[${i}:v]`).join("");
    run(["-hide_banner", "-loglevel", "error", "-y", ...inputs,
      "-filter_complex", `${chain}concat=n=${segments.length}:v=1:a=0[v]`,
      "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
      join(outDir, `${video.name}.mp4`)]);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
