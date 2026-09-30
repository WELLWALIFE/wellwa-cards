import { getPublicSupabase } from "@/lib/supabase/public";

export type ShubhoraOverride = { persona: string; knowledge: string; faq: string };
export type PlatformKnowledge = { persona: string; knowledge: string; shubhora?: ShubhoraOverride; aiV2?: string };

// Global bot training set by the platform owner in Super Admin. Every card's
// bot inherits this on top of its own per-card knowledge. Best-effort: returns
// empty strings if the table/row isn't there yet.
export async function getPlatformKnowledge(): Promise<PlatformKnowledge> {
  const sb = getPublicSupabase();
  if (!sb) return { persona: "", knowledge: "" };
  try {
    const { data } = await sb
      .from("platform_settings")
      .select("bot_persona, bot_knowledge")
      .eq("id", 1)
      .maybeSingle();
    const [shubhora, aiV2] = await Promise.all([getShubhoraOverride(), getAiV2()]);
    return {
      persona: (data?.bot_persona ?? "").trim(),
      knowledge: (data?.bot_knowledge ?? "").trim(),
      shubhora,
      aiV2,
    };
  } catch {
    return { persona: "", knowledge: "" };
  }
}

/** Super Admin → Shubhora AI: the owner's edits to Shubhora's own facts. Empty fields (or the columns not added
 *  yet) mean the built-in text in bridge/shubhora-kb.mjs is used. */
export async function getShubhoraOverride(): Promise<ShubhoraOverride> {
  const sb = getPublicSupabase();
  const empty = { persona: "", knowledge: "", faq: "" };
  if (!sb) return empty;
  try {
    const { data, error } = await sb.from("platform_settings").select("shubhora_persona, shubhora_knowledge, shubhora_faq").eq("id", 1).maybeSingle();
    if (error || !data) return empty;
    return { persona: data.shubhora_persona ?? "", knowledge: data.shubhora_knowledge ?? "", faq: data.shubhora_faq ?? "" };
  } catch { return empty; }
}

/** Super Admin → Shubhora AI → "New AI" switch (platform_settings.ai_v2): "off", "shubhora", "all" or card names
 *  (a pilot). "off" while supabase/migrations/0056_ai_v2.sql has not been run. */
export async function getAiV2(): Promise<string> {
  const sb = getPublicSupabase();
  if (!sb) return "off";
  try {
    const { data, error } = await sb.from("platform_settings").select("ai_v2").eq("id", 1).maybeSingle();
    if (error || !data) return "off";
    return String((data as { ai_v2?: string | null }).ai_v2 ?? "off");
  } catch { return "off"; }
}
