import Link from "next/link";

/* Shubhora mark — the three-colour flame from the brand logo (public/brand/shubhora-mark.png,
 * cut out of the owner's master file with a transparent background). */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/shubhora-mark.png" alt="" aria-hidden="true" className={`${className} object-contain`} />;
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <LogoMark className="h-9 w-7" />
      <span className="text-[1.15rem] font-extrabold tracking-tight text-ink">Shubhora</span>
    </Link>
  );
}
