"use client";
// The "?" help for a Jewellery field, by its English label (lib/jewellery-tips.ts). Nothing is drawn for a label with no note.
import { FieldTip } from "@/components/field-tip";
import { useT } from "@/lib/poster-i18n";
import { JW_TIPS } from "@/lib/jewellery-tips";

export function JwTip({ k }: { k: string }) {
  const { lang } = useT();
  const t = JW_TIPS[k];
  return t ? <FieldTip en={t[0]} hi={t[1]} lang={lang} /> : null;
}
