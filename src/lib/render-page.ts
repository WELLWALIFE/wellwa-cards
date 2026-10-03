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

/** The browser is kept open for a short while after a page, so an import that reads ten pages of one
 *  site launches it once, not ten times. Launching was most of the cost: wellwalife.com took 74 seconds
 *  with a fresh browser per page. It is closed after IDLE_MS of nothing, so it never sits on memory. */
const IDLE_MS = 20_000;
let shared: Browser | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
async function browserFor(args: string[]): Promise<Browser> {
  if (idle) { clearTimeout(idle); idle = undefined; }
  if (shared && shared.connected) return shared;
  const puppeteer = (await import("puppeteer-core")).default;
  shared = await puppeteer.launch({ executablePath: CHROME, headless: true, args, timeout: NAV_MS });
  shared.once("disconnected", () => { shared = null; });
  return shared;
}
function releaseBrowser() {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => { const b = shared; shared = null; b?.close().catch(() => undefined); }, IDLE_MS);
}
const LIGHT_ARGS = [
  "--no-sandbox", "--disable-setuid-sandbox",
  // /dev/shm is small on this box; without this Chromium crashes on heavier pages.
  "--disable-dev-shm-usage",
  "--disable-gpu", "--no-zygote", "--mute-audio",
  "--window-size=1280,2000",
];

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
    let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
    try {
      const browser = await browserFor(LIGHT_ARGS);
      page = await browser.newPage();
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
      await page?.close().catch(() => undefined);
      releaseBrowser();
    }
  });
}

/** What a page actually looks like, measured in the browser rather than guessed from its HTML.
 *
 *  Regex over HTML can only find what is written inline, which on a modern site is almost nothing — the
 *  look lives in stylesheets. In the browser the computed style is simply there to be read, so these are
 *  the real colours, the real fonts and the real spacing, as a visitor sees them. */
export type PageLayout = {
  /** Page background and its main text colour, as rendered (#rrggbb). */
  bg: string;
  ink: string;
  /** The colour the page uses for its buttons and links — its real accent, not a guess. */
  accent?: string;
  /** Font families actually in use for headings and for body text. */
  headFont?: string;
  bodyFont?: string;
  /** Headings against body text: how loud the page is. 1 = no contrast, 3 = very loud. */
  headScale: number;
  /** Median corner rounding of its buttons and cards, in pixels. */
  radius: number;
  /** Median space a section leaves above and below itself, in pixels: how airy it is. */
  spacing: number;
  /** Repeated things (products, services) are laid out in this many columns; 1 means a stacked list. */
  columns: number;
  /** A picture fills the top of the page. */
  heroImage: boolean;
  /** The blocks down the page, in order, named by what they hold. */
  sections: string[];
};

/** Reads the look of a page in the browser. Null when there is no browser or the page will not load. */
export async function readLayout(url: string): Promise<PageLayout | null> {
  if (!process.env.CHROME_PATH && process.env.NODE_ENV !== "production") return null;
  return oneAtATime(async () => {
    let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
    try {
      const browser = await browserFor(LIGHT_ARGS);
      page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (compatible; ShubhoraBot/1.0; +https://shubhora.com)");
      await page.setViewport({ width: 1280, height: 2000 });
      // Stylesheets and images are needed here — the whole point is what the page looks like — but video
      // and audio never are.
      await page.setRequestInterception(true);
      page.on("request", (r) => (r.resourceType() === "media" ? r.abort().catch(() => undefined) : r.continue().catch(() => undefined)));
      await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_MS });
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      return (await page.evaluate(measureLook)) as PageLayout;
    } catch {
      return null;
    } finally {
      await page?.close().catch(() => undefined);
      releaseBrowser();
    }
  });
}

/** A picture of the website as a visitor would see it, taken in the browser on the server, so the designer AI can
 *  look at what it made (owner's call, 3 Oct 2026: "designer ko aankhein do"). The card is handed to the preview
 *  page through localStorage — nothing is published, nothing leaves the box. JPEG, 1280 wide, the first ~1700px.
 *  Null when there is no browser or the page would not draw. */
export async function screenshotCard(card: unknown, siteUrl: string): Promise<Buffer | null> {
  if (!process.env.CHROME_PATH && process.env.NODE_ENV !== "production") return null;
  const json = JSON.stringify(card);
  if (!json || json.length > 3_000_000) return null;
  return oneAtATime(async () => {
    let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
    try {
      const browser = await browserFor(LIGHT_ARGS);
      page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 ShubhoraReview/1.0");
      await page.setViewport({ width: 1280, height: 1700, deviceScaleFactor: 1 });
      // The preview page reads the card from localStorage before it draws anything; the key is its own, so a
      // review never collides with an owner's build in a real browser.
      await page.evaluateOnNewDocument((key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage off: the page says "Nothing to preview" and the review is skipped */ } }, REVIEW_KEY, json);
      await page.setRequestInterception(true);
      page.on("request", (r) => (r.resourceType() === "media" ? r.abort().catch(() => undefined) : r.continue().catch(() => undefined)));
      await page.goto(`${siteUrl}/preview/site?k=${REVIEW_KEY}`, { waitUntil: "networkidle2", timeout: NAV_MS });
      // Pictures decode and the reveal animations settle.
      await new Promise((r) => setTimeout(r, SETTLE_MS + 800));
      const drawn = await page.evaluate(() => !!document.querySelector("h1") && !/Nothing to preview/.test(document.body.innerText));
      if (!drawn) return null;
      const shot = await page.screenshot({ type: "jpeg", quality: 72, clip: { x: 0, y: 0, width: 1280, height: 1700 } });
      return Buffer.from(shot);
    } catch {
      return null;
    } finally {
      await page?.close().catch(() => undefined);
      releaseBrowser();
    }
  });
}
/** The preview page's storage key for a review render (letters, digits and dashes only — see preview/site/view.tsx). */
const REVIEW_KEY = "vcard-review";

/** Rendered pages, kept a short while. The set-up's website peek renders the home page while the person is
 *  still on the form; the build that follows a minute later reads the same page again (readOwnSite, importSite)
 *  and would launch a second render of it. Short-lived and small: a site changes, and a render is ~1 MB. */
const RENDERED = new Map<string, { html: string; at: number }>();
const RENDER_TTL_MS = 15 * 60_000;
const RENDER_MAX = 50;

/** Plain HTML when the page has it, the rendered page when it does not. */
export async function htmlOf(url: string, raw: string | null): Promise<string | null> {
  if (raw && !looksEmpty(raw)) return raw;
  const hit = RENDERED.get(url);
  if (hit && Date.now() - hit.at < RENDER_TTL_MS) return hit.html;
  const made = await renderedHtml(url);
  if (made && !looksEmpty(made)) {
    if (RENDERED.size >= RENDER_MAX) RENDERED.delete(RENDERED.keys().next().value as string);
    RENDERED.set(url, { html: made, at: Date.now() });
  }
  return made ?? raw;
}

/** Runs inside the page, so nothing out here is in scope for it. Written as a real function rather than a
 *  string: a string had to escape its own regexes and they came out broken, which measured apple.com's
 *  white background as cyan. */
function measureLook() {
  const px = (v: string) => parseFloat(v) || 0;
  /** Chrome hands colours back as rgb()/rgba(), and as color(srgb …) where the page used modern CSS. */
  const hex = (c: string | null): string | null => {
    if (!c) return null;
    const rgb = /^rgba?\(([^)]+)\)/.exec(c);
    if (rgb) {
      const n = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      if (n.length >= 3 && n.slice(0, 3).every((x) => Number.isFinite(x))) {
        if (n[3] === 0) return null;                       // fully transparent tells us nothing
        return "#" + n.slice(0, 3).map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
      }
    }
    const srgb = /^color\(srgb\s+([^)]+)\)/.exec(c);
    if (srgb) {
      const n = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
      if (n.length >= 3 && n.slice(0, 3).every((x) => Number.isFinite(x))) {
        if (n[3] === 0) return null;
        return "#" + n.slice(0, 3).map((x) => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, "0")).join("");
      }
    }
    return null;
  };
  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  const sat = (h: string) => {
    const n = parseInt(h.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    return mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
  };
  const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };

  const body = document.body;
  const bodyStyle = getComputedStyle(body);
  // A transparent body shows whatever is behind it, so fall through to the page itself, then to white.
  const bg = hex(bodyStyle.backgroundColor) ?? hex(getComputedStyle(document.documentElement).backgroundColor) ?? "#ffffff";
  const ink = hex(bodyStyle.color) ?? "#111111";

  // The accent is whatever colour its buttons and links really use, by how much of it there is.
  const tally = new Map<string, number>();
  // A brand colour is something you could print: not a pale grey wash, not near-black. A FILLED button is
  // the strongest evidence of it, so it counts for more than a link's text colour.
  const brandish = (c: string | null) => !!c && sat(c) >= 0.25 && lum(c) < 0.8 && lum(c) > 0.04;
  for (const el of Array.from(document.querySelectorAll("a,button,[role=button],input[type=submit]")).slice(0, 400)) {
    if (!shown(el)) continue;
    const s = getComputedStyle(el);
    const fill = hex(s.backgroundColor);
    if (brandish(fill)) tally.set(fill!, (tally.get(fill!) ?? 0) + 3);
    const text = hex(s.color);
    if (brandish(text)) tally.set(text!, (tally.get(text!) ?? 0) + 1);
  }
  const accent = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const firstShown = (sel: string) => Array.from(document.querySelectorAll(sel)).find(shown);
  const head = firstShown("h1") ?? firstShown("h2");
  // Build tools rename fonts: Next turns "Plus Jakarta Sans" into "__Plus_Jakarta_Sans_85bcfb", and others
  // add their own prefixes. Undo that, or the name never matches a real family.
  const family = (f: string) => f.split(",")[0]
    .replace(/["']/g, "")
    .replace(/^__+/, "")
    .replace(/_[0-9a-f]{4,8}$/i, "")
    .replace(/_Fallback$/i, "")
    .replace(/_/g, " ")
    .trim();
  const headFont = head ? family(getComputedStyle(head).fontFamily) : undefined;
  const bodyFont = family(bodyStyle.fontFamily);
  const headScale = head ? Math.max(1, Math.min(4, px(getComputedStyle(head).fontSize) / (px(bodyStyle.fontSize) || 16))) : 1.6;

  // Rounding: buttons and cards only. Pictures and avatars are often circles and would skew it.
  // Only things drawn as a shape: a bare nav link has no corners to round, and counting those dragged the
  // median to zero on every site measured.
  const radii: number[] = [];
  for (const el of Array.from(document.querySelectorAll("a,button,[role=button],input[type=submit],[class*=card],[class*=btn],[class*=Button],[class*=Card]")).slice(0, 400)) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) continue;
    const s = getComputedStyle(el);
    const filled = !!hex(s.backgroundColor);
    const outlined = px(s.borderTopWidth) > 0 && !!hex(s.borderTopColor);
    if (!filled && !outlined) continue;
    radii.push(Math.min(px(s.borderTopLeftRadius), 40));
  }

  // The bands down the page: big, full-width blocks, which is what a section is however it is marked up.
  const bands = Array.from(document.querySelectorAll("section,main>div,main>section,body>div>div,[class*=section]"))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > innerWidth * 0.6 && r.height > 120; })
    .slice(0, 60);
  // A band's own padding is often zero because the breathing room sits on an inner wrapper. What a visitor
  // actually sees is the gap from one band to the next, so measure that and fall back to the padding.
  const pads: number[] = [];
  const tops = bands.map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top);
  for (let i = 1; i < tops.length; i++) {
    const gap = tops[i].top - tops[i - 1].bottom;
    if (gap >= 0 && gap < 400) pads.push(gap);
  }
  if (!pads.length) for (const el of bands) { const s = getComputedStyle(el); pads.push((px(s.paddingTop) + px(s.paddingBottom)) / 2); }

  // Repeated things side by side: how many sit on one row.
  let columns = 1;
  for (const el of bands) {
    const kids = Array.from(el.children).filter(shown);
    if (kids.length < 3) continue;
    const rows = new Map<number, number>();
    for (const k of kids) { const t = Math.round(k.getBoundingClientRect().top / 24); rows.set(t, (rows.get(t) ?? 0) + 1); }
    columns = Math.max(columns, Math.min(4, Math.max(...rows.values())));
  }

  const heroImage = Array.from(document.querySelectorAll("img,video,picture,[style*=background-image]")).some((el) => {
    const r = el.getBoundingClientRect();
    return r.top < 700 && r.width > innerWidth * 0.5 && r.height > 180;
  });

  // What the page holds, in the order a visitor meets it — read from each band's own heading.
  const WORDS: [string, RegExp][] = [
    ["products", /product|shop|menu|catalog|pricing|price|plan|package|range|model/i],
    ["services", /service|what we do|offering|solution|treatment|speciali/i],
    ["about", /about|our story|who we are|why |mission|value/i],
    ["reviews", /review|testimonial|say about|client|customer|trusted/i],
    ["gallery", /gallery|portfolio|our work|project|photo/i],
    ["faq", /faq|question|doubt/i],
    ["contact", /contact|reach us|visit|enquir|appointment|book |get in touch/i],
  ];
  const sections: string[] = [];
  if (heroImage) sections.push("hero");
  for (const el of bands) {
    const h = el.querySelector("h1,h2,h3");
    const t = (h?.textContent ?? "").trim().slice(0, 80);
    if (!t) continue;
    const name = WORDS.find(([, re]) => re.test(t))?.[0];
    if (name && sections[sections.length - 1] !== name) sections.push(name);
  }

  return {
    bg, ink, accent, headFont, bodyFont,
    headScale: Math.round(headScale * 10) / 10,
    radius: Math.round(median(radii)),
    spacing: Math.round(median(pads)),
    columns,
    heroImage,
    sections: sections.slice(0, 10),
  };
}
