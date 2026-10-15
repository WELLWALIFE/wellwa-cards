"use client";
// Business › Downloads — the company's plans, posters and training files. Links are signed by the partner service (valid for an hour).
import { Download, FileText } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, safeHref, useBiz } from "@/components/business/kit";

type Item = { title: string; description: string; category: string; mime: string; image: boolean; sizeBytes: number; url: string | null; downloadUrl: string | null };

const size = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function DownloadsPage() {
  const { lang } = useT(); const en = lang === "en";
  const { data, error, loading, reload } = useBiz<{ disabled?: boolean; items: Item[] }>("downloads");
  const cats = [...new Set((data?.items ?? []).map((i) => i.category))];
  return (
    <BizShell title="Downloads">
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled ? <p className={`${CARD} text-sm text-muted`}>{en ? "This is switched off right now." : "यह अभी बंद है।"}</p> : (
          <>
            <p className="text-sm text-muted">{en ? "Plan, posters and training from the company." : "कंपनी के plan, poster और training की files।"}</p>
            {!data?.items.length && <p className={`${CARD} text-center text-sm text-muted`}>{en ? "Nothing here yet. The company will add files soon." : "अभी कुछ नहीं है। कंपनी जल्दी files जोड़ेगी।"}</p>}
            {cats.map((c) => (
              <section key={c} className="space-y-2">
                <h2 className="text-sm font-bold">{c}</h2>
                {data!.items.filter((i) => i.category === c).map((i, k) => (
                  <div key={`${c}-${k}`} className={`${CARD} flex items-center gap-3`}>
                    {i.image && i.url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={i.url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover bg-surface2" />
                      : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-surface2 text-muted"><FileText className="h-6 w-6" /></span>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{i.title}</p>
                      {i.description && <p className="text-xs text-muted line-clamp-2">{i.description}</p>}
                      <p className="text-[11px] text-muted">{size(i.sizeBytes)}</p>
                    </div>
                    {safeHref(i.downloadUrl) ? (
                      <a href={safeHref(i.downloadUrl)!} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl grad-brand px-3 py-2 text-xs font-semibold text-white">
                        <Download className="h-4 w-4" />{en ? "Download" : "Download"}
                      </a>
                    ) : <span className="shrink-0 text-[11px] text-muted">{en ? "Link not ready" : "Link अभी तैयार नहीं"}</span>}
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </BizState>
    </BizShell>
  );
}
