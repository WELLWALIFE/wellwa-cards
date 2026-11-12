// A YouTube link → its video id, its still picture and the address to play it at. The gallery takes videos ONLY as YouTube
// links (owner, 12 Nov 2026: "video me kevel YouTube ka link — verna direct video heavy ho jayega"): nothing is uploaded or stored.

/** The 11-character id of a YouTube video from any of its link shapes (watch, youtu.be, shorts, embed, live), else "". */
export function youtubeId(link: string): string {
  const s = String(link ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v") ?? "";
      else { const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/); id = m ? m[1] : ""; }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch { return ""; }
}
/** The still picture YouTube keeps for a video (480×360, always there). */
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
/** The address the video is kept under on the card. */
export const youtubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/** The player's address (no cookies until it plays). */
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;

/** Picture address → YouTube id, for every gallery video on the card: the photo viewer plays these instead of showing the still. */
export function galleryVideos(card: { pages?: { blocks?: { kind?: string; images?: { url?: string; video?: string }[] }[] }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of card.pages ?? []) for (const b of p.blocks ?? []) {
    if (b.kind !== "gallery") continue;
    for (const im of b.images ?? []) { const id = im.video ? youtubeId(im.video) : ""; if (id && im.url) out[im.url] = id; }
  }
  return out;
}
