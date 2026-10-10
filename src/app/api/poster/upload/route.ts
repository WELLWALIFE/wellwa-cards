// POST multipart { file, kind: photo|logo|product|wide } → resized image in the media bucket
//   photo   → 600×600 face crop (JPEG)
//   logo    → up to 600×300 (PNG, keeps transparency)
//   product → up to 1400×1400 (PNG)
//   wide    → a shop / work photo, up to 1600×1600, never cropped (JPEG)
import { NextResponse } from "next/server";
import sharp from "sharp";
import type { Sharp } from "sharp";
import { userFromRequest } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

type Kind = "photo" | "logo" | "product" | "wide" | "doc";
const KINDS: readonly Kind[] = ["photo", "logo", "product", "wide", "doc"];

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const asked = form?.get("kind");
  const kind: Kind = KINDS.includes(asked as Kind) ? (asked as Kind) : "photo";
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Image too large (max 12 MB)." }, { status: 400 });
  // doc → a PDF the bot can send as a WhatsApp document (brochure, price list), stored as it is.
  if (kind === "doc") {
    const src = Buffer.from(await file.arrayBuffer());
    if (src.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ error: "Only PDF files here." }, { status: 400 });
    const name = (form?.get("name") ? String(form.get("name")) : "document").replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").slice(0, 60).replace(/\.pdf$/i, "");
    const key = `poster/${me.id}/doc-${Date.now()}-${name || "document"}.pdf`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, { method: "POST", headers: { ...serviceHeaders(), "Content-Type": "application/pdf", "x-upsert": "true" }, body: new Uint8Array(src) });
    if (!r.ok) return NextResponse.json({ error: "Upload failed.", detail: (await r.text()).slice(0, 200) }, { status: 500 });
    return NextResponse.json({ url: `${SUPA_URL}/storage/v1/object/public/media/${key}` });
  }
  let out: Buffer;
  try {
    const src = Buffer.from(await file.arrayBuffer());
    // A phone photo made presentable (owner's call, 3 Oct 2026: "phone ki photo bhi professional lage"): levels
    // evened out, a touch more life, a little sharpness. Gentle on purpose — a face must stay a face. Logos are
    // left exactly as drawn.
    const polish = (img: Sharp) => img.normalise({ lower: 1, upper: 99 }).modulate({ brightness: 1.02, saturation: 1.06 }).sharpen({ sigma: 0.8, m1: 0.5, m2: 1.2 });
    out = kind === "product"
      ? await polish(sharp(src).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })).png().toBuffer()
      : kind === "logo"
      ? await sharp(src).rotate().resize({ width: 600, height: 300, fit: "inside", withoutEnlargement: true }).png().toBuffer()
      : kind === "wide"
      ? await polish(sharp(src).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })).jpeg({ quality: 84, mozjpeg: true }).toBuffer()
      : await polish(sharp(src).rotate().resize(600, 600, { fit: "cover", position: "attention" })).jpeg({ quality: 88 }).toBuffer();
  } catch { return NextResponse.json({ error: "That file is not an image." }, { status: 400 }); }
  const jpeg = kind === "photo" || kind === "wide";
  const key = `poster/${me.id}/${kind}-${Date.now()}.${jpeg ? "jpg" : "png"}`;
  const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, {
    method: "POST", headers: { ...serviceHeaders(), "Content-Type": jpeg ? "image/jpeg" : "image/png", "x-upsert": "true" }, body: new Uint8Array(out),
  });
  if (!r.ok) return NextResponse.json({ error: "Upload failed.", detail: (await r.text()).slice(0, 200) }, { status: 500 });
  return NextResponse.json({ url: `${SUPA_URL}/storage/v1/object/public/media/${key}` });
}
