// A stock photograph that matches a product's NAME, stored in the owner's own media folder (so every screen accepts it).
import { stockEngineMod } from "@/lib/poster-server";
import { storeImage } from "@/lib/media/ai-image";

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);

/** The public URL of a clean, recent photo of "<name>", or null when none fits well (callers fall back to the trade's photos). */
export async function stockPhotoForProduct(userId: string, name: string, trade: string): Promise<string | null> {
  try {
    const st = await stockEngineMod();
    const r = await within(st.findProductPhoto({ name, trade }), 45_000);
    if (!r) return null;
    return await storeImage(userId, "product-stock", r.jpeg);
  } catch { return null; }
}
