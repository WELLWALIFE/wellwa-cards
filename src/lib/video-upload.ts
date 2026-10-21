// "Apni video" (owner, 21 Oct 2026): a video from the phone or computer — made outside Shubhora — can be posted to the
// Facebook Page / Instagram and used as an ad. Two browser-side helpers: upload the file with a progress number, and
// grab one frame as the thumbnail (Instagram and the ad creative both want a cover image).
import { authHeaders } from "@/lib/poster-client";

export const VIDEO_MAX_MB = 60;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];

/** POST /api/poster/upload kind=video with an upload-progress callback (0–100). Resolves to the public URL, or null. */
export function uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<{ url: string } | { error: string }> {
  return new Promise(async (resolve) => {
    try {
      const headers = await authHeaders();
      delete headers["content-type"];
      const fd = new FormData(); fd.append("file", file); fd.append("kind", "video");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/poster/upload");
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let j: { url?: string; error?: string } = {};
        try { j = JSON.parse(xhr.responseText); } catch { /* not json */ }
        if (xhr.status >= 200 && xhr.status < 300 && typeof j.url === "string") resolve({ url: j.url });
        else resolve({ error: j.error || (xhr.status === 413 ? "Video too large." : `Upload failed (${xhr.status}).`) });
      };
      xhr.onerror = () => resolve({ error: "Upload failed. Check your internet and try again." });
      xhr.send(fd);
    } catch { resolve({ error: "Upload failed." }); }
  });
}

/** One frame of the video (about half a second in) as a JPEG file, 1080px wide at most. Null when the browser cannot decode it. */
export function captureVideoThumb(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    const done = (f: File | null) => { URL.revokeObjectURL(url); resolve(f); };
    const timer = setTimeout(() => done(null), 15000);
    v.onerror = () => { clearTimeout(timer); done(null); };
    v.onloadedmetadata = () => { try { v.currentTime = Math.min(0.5, Math.max(0, (v.duration || 1) / 10)); } catch { /* seek later */ } };
    v.onseeked = () => {
      try {
        const scale = Math.min(1, 1080 / Math.max(1, v.videoWidth));
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
        const ctx = c.getContext("2d"); if (!ctx) { clearTimeout(timer); return done(null); }
        ctx.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => { clearTimeout(timer); done(b ? new File([b], "thumb.jpg", { type: "image/jpeg" }) : null); }, "image/jpeg", 0.88);
      } catch { clearTimeout(timer); done(null); }
    };
  });
}

/** The size / type checks, in the person's words. */
export function videoFileProblem(file: File, hi: boolean): string {
  if (!VIDEO_TYPES.includes(file.type) && !/\.(mp4|mov|m4v)$/i.test(file.name)) return hi ? "सिर्फ़ MP4 या MOV video चलेगी।" : "Only MP4 or MOV videos work here.";
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) return hi ? `Video ${VIDEO_MAX_MB} MB से छोटी होनी चाहिए। Phone की gallery में "compress" या छोटी clip चुनें।` : `The video must be under ${VIDEO_MAX_MB} MB. Compress it or pick a shorter clip.`;
  return "";
}
