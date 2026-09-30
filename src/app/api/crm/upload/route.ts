// POST multipart { file } (bearer) → a photo (resized JPEG) or PDF in the media bucket, for sending from the CRM.
import { NextResponse } from "next/server";
import sharp from "sharp";
import { userFromRequest } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (file.size > 16 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 16 MB)." }, { status: 400 });
  const src = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name) || src.subarray(0, 4).toString() === "%PDF";
  let out: Buffer, ext: string, type: string, kind: "image" | "pdf";
  if (isPdf) { out = src; ext = "pdf"; type = "application/pdf"; kind = "pdf"; }
  else {
    try { out = await sharp(src).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer(); }
    catch { return NextResponse.json({ error: "Only photos and PDF files can be sent." }, { status: 400 }); }
    ext = "jpg"; type = "image/jpeg"; kind = "image";
  }
  const key = `crm/${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, { method: "POST", headers: { ...serviceHeaders(), "Content-Type": type, "x-upsert": "true" }, body: new Uint8Array(out) });
  if (!r.ok) return NextResponse.json({ error: "Upload failed.", detail: (await r.text()).slice(0, 200) }, { status: 500 });
  return NextResponse.json({ url: `${SUPA_URL}/storage/v1/object/public/media/${key}`, kind, name: file.name.replace(/[^\w .()-]/g, "").slice(0, 80) || (isPdf ? "document.pdf" : "photo.jpg") });
}
