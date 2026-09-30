// Shared layout for the policy pages (terms, delivery, grievance, disclaimer, company information).
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-faint">Last updated {updated}</p>
      {intro && <p className="mt-6 text-sm leading-relaxed text-muted">{intro}</p>}
      {children}
    </div>
  );
}

export function Section({ h, children }: { h: string; children: React.ReactNode }) {
  return <section className="mt-8"><h2 className="text-lg font-semibold">{h}</h2><div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div></section>;
}
