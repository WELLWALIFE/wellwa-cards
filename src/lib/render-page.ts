import "server-only";
// Reading a page that only exists after JavaScript has run.
//
// Most small-business sites today are React, Vue or Wix apps: the server sends a near-empty shell and the
// browser draws everything. wellwalife.com is one — every address returns the same 5 KB of HTML with no
// products, no prices and not a single <img>. Fetching the HTML, which is all the importer did, finds
// nothing on sites like that, and so would Google without its own renderer.
//
// So when a page looks empty we open it in a real browser on the server and take the HTML it ends up with.
//
// The box this runs on has about 3.6 GB of memory and is already running the app, the WhatsApp workers and
// the media tools, so this is kept deliberately cheap:
//   • one page at a time, never two (RENDERS below);
//   • pictures, video and fonts are not downloaded — the DOM is what we are after, and the image ADDRESSES
//     survive in it, so the importer still finds every photo;
//   • a hard time limit, and the browser is closed whether it worked or not;
//   • it is only reached when plain fetching came back empty, so an ordinary site costs nothing.

import type { Browser } from "puppeteer-core";

/** Where Chromium lives on the server (server/install-chromium.sh puts it there). */
const CHROME = process.env.CHROME_PATH || "/usr/bin/chromium-browser";
const NAV_MS = 20_000;
const SETTLE_MS = 1_200;

/** One at a time. A second caller waits for the first rather than starting a second browser. */
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

/** Does this HTML look like a shell waiting for JavaScript?
 *  An app shell is small, has almost no text and no pictures, yet loads scripts. A real page — even a plain
 *  one — has text and images in the HTML itself. */
export function looksEmpty(html: string): boolean {
  if (!html) return true;
  const body = html.slice(html.search(/<body\b/i) + 1);
  const text = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const images = (body.match(/<img\b/gi) || []).length;
  const scripts = (html.match(/<script[^>]+src=/gi) || []).length;
  return scripts > 0 && images === 0 && text.length < 600;
}

/** The page as a browser ends up with it, or null when there is no browser or it would not load. */
export async function renderedHtml(url: string): Promise<string | null> {
  if (!process.env.CHROME_PATH && process.env.NODE_ENV !== "production") return null;
  return oneAtATime(async () => {
    let browser: Browser | null = null;
    try {
      const puppeteer = (await import("puppeteer-core")).default;
      browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: true,
        args: [
          "--no-sandbox", "--disable-setuid-sandbox",
          // /dev/shm is small on this box; without this Chromium crashes on heavier pages.
          "--disable-dev-shm-usage",
          "--disable-gpu", "--no-zygote", "--mute-audio",
          "--blink-settings=imagesEnabled=false",
          "--window-size=1280,2000",
        ],
        timeout: NAV_MS,
      });
      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (compatible; ShubhoraBot/1.0; +https://shubhora.com)");
      await page.setViewport({ width: 1280, height: 2000 });
      // Everything that costs memory and tells us nothing. The <img src> stays in the DOM either way.
      await page.setRequestInterception(true);
      page.on("request", (r) => {
        const t = r.resourceType();
        if (t === "image" || t === "media" || t === "font") r.abort().catch(() => undefined);
        else r.continue().catch(() => undefined);
      });
      await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_MS });
      // A beat for the last bit of rendering after the network goes quiet.
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      return await page.content();
    } catch {
      return null;
    } finally {
      await browser?.close().catch(() => undefined);
    }
  });
}

/** Plain HTML when the page has it, the rendered page when it does not. */
export async function htmlOf(url: string, raw: string | null): Promise<string | null> {
  if (raw && !looksEmpty(raw)) return raw;
  const made = await renderedHtml(url);
  return made ?? raw;
}
