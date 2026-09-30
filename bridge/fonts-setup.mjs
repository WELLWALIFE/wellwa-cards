// Makes the poster fonts in bridge/fonts (Poppins, Baloo 2, Mukta, Playfair Display, Tiro Devanagari Hindi, Lora — all
// Google Fonts, OFL) visible to the SVG renderer inside sharp (librsvg → pango → fontconfig) on any machine, without
// installing anything on the server. Import this module BEFORE anything renders text: fontconfig reads
// FONTCONFIG_FILE the first time it starts, so the variable must be set before the first SVG with text.
//
// The generated config adds our folder on top of the system fonts (system config stays included), so nothing that
// worked before changes; only the named families now resolve to the bundled files everywhere.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fonts");
const CACHE_DIR = path.join(os.tmpdir(), "shubhora-fontconfig-cache");

export function setupFonts() {
  if (process.env.SHUBHORA_FONTS_READY) return process.env.FONTCONFIG_FILE;
  try {
    if (!fs.existsSync(FONT_DIR)) return null;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const systemConf = ["/etc/fonts/fonts.conf", "/usr/local/etc/fonts/fonts.conf", "/opt/homebrew/etc/fonts/fonts.conf"].find((f) => fs.existsSync(f));
    const conf = path.join(CACHE_DIR, "fonts.conf");
    const xml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  ${systemConf ? `<include ignore_missing="yes">${systemConf}</include>` : ""}
  <dir>${FONT_DIR}</dir>
  <cachedir>${CACHE_DIR}</cachedir>
  <!-- Devanagari text set in a Latin-only face falls through to the matching Indic face of the same family. -->
  <alias><family>Poppins</family><prefer><family>Poppins</family><family>Mukta</family><family>Noto Sans Devanagari</family></prefer></alias>
  <alias><family>Playfair Display</family><prefer><family>Playfair Display</family><family>Tiro Devanagari Hindi</family></prefer></alias>
  <alias><family>Baloo 2</family><prefer><family>Baloo 2</family><family>Poppins</family></prefer></alias>
  <alias><family>Mukta</family><prefer><family>Mukta</family><family>Poppins</family></prefer></alias>
  <alias><family>Tiro Devanagari Hindi</family><prefer><family>Tiro Devanagari Hindi</family><family>Playfair Display</family></prefer></alias>
</fontconfig>
`;
    if (!fs.existsSync(conf) || fs.readFileSync(conf, "utf8") !== xml) fs.writeFileSync(conf, xml);
    process.env.FONTCONFIG_FILE = conf;
    process.env.SHUBHORA_FONTS_READY = "1";
    return conf;
  } catch (e) {
    console.log("[fonts] setup skipped:", e?.message || e);
    return null;
  }
}

setupFonts();
