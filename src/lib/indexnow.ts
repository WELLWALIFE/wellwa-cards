import "server-only";
// IndexNow (indexnow.org): tells Bing, Yandex, Naver, Seznam (and through Bing, DuckDuckGo and others) that a Premium website's pages are new or changed, at
// once, instead of waiting for them to be found. Google does not take part in IndexNow and has no public "ping" any more: it reads the sitemap (and the
// owner's Search Console, if they add it); the Premium SEO checklist says so. The key is public by design: the same text sits at /<key>.txt on every host.
export const INDEXNOW_KEY = "a6e6343517dd4d709de5f5e8cd8f1a43";

/** Sends one host's URLs. Returns the HTTP status (200 / 202 = taken), or 0 when the call could not be made. */
export async function submitIndexNow(host: string, urls: string[]): Promise<number> {
  if (!urls.length) return 200;
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`, urlList: urls.slice(0, 10_000) }),
      signal: AbortSignal.timeout(20_000),
    });
    return r.status;
  } catch { return 0; }
}
