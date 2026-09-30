import type { LucideIcon } from "lucide-react";

export function PhaseTeaser({
  icon: Icon,
  accent,
  title,
  subtitle,
  phase,
  features,
}: {
  icon: LucideIcon;
  accent: string;
  title: string;
  subtitle: string;
  phase: string;
  features: { title: string; body: string }[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span
          className="h-12 w-12 rounded-xl grid place-items-center text-white shrink-0"
          style={{ background: accent }}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <span
              className="mono text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 text-white"
              style={{ background: accent }}
            >
              {phase}
            </span>
          </div>
          <p className="text-muted mt-1 max-w-xl">{subtitle}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-surface p-5">
            <div className="h-1.5 w-8 rounded-full mb-3" style={{ background: accent }} />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl border p-4 text-sm"
        style={{ borderColor: accent, background: `color-mix(in srgb, ${accent} 8%, transparent)` }}
      >
        This module is designed and on the roadmap. It activates in <b>{phase}</b> of the build.
      </div>
    </div>
  );
}
