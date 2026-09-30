// What a card's link shows once its year has ended and it was not renewed within the 7 grace days (owner's call,
// 27 Sep 2026): the owner's name, "this card is paused", and "Card renew karein" for the owner. Nothing is deleted —
// renewing brings the full card back at once. No price here: the owner sees it inside the app after logging in.
// Neutral on white-label hosts (no Shubhora sign-up link).
import Link from "next/link";
import { initials } from "@/lib/initials";

export function CardPaused({ name, subtitle, avatarUrl, square = false, renewUrl, joinHref }: {
  name: string; subtitle?: string; avatarUrl?: string; square?: boolean; renewUrl: string; joinHref?: string | null;
}) {
  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center px-5 py-16" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 text-center shadow-card">
        {avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatarUrl} alt="" className={`mx-auto h-20 w-20 border border-border ${square ? "rounded-xl bg-white object-contain" : "rounded-full object-cover"}`} />
          : <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#12144a] text-2xl font-bold text-white">{initials(name)}</span>}
        <h1 className="mt-3 text-xl font-semibold tracking-tight">{name}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}

        <div className="mt-5 rounded-xl bg-surface2 px-4 py-3">
          <p className="text-sm font-semibold">⏸ यह डिजिटल कार्ड अभी रुका हुआ है</p>
          <p className="mt-0.5 text-xs text-muted">This digital card is paused right now.</p>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <p className="text-xs text-muted">कार्ड आपका है? · Is this your card?</p>
          <a href={renewUrl} className="mt-2 block w-full rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">Card renew karein</a>
          <p className="mt-2 text-[11px] leading-snug text-faint">Renew करते ही card फिर चालू — आपकी सारी details, photos और leads सुरक्षित हैं।</p>
        </div>

        {joinHref ? <Link href={joinHref} className="mt-5 inline-block text-xs font-semibold text-brand-ink">Apna digital card banayein →</Link> : null}
      </div>
    </main>
  );
}
