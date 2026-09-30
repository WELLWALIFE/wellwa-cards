import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-brand";
import Link from "next/link";
import { ArrowRight, Blocks, BrainCircuit, HeartHandshake, ShieldCheck } from "lucide-react";

export const metadata: Metadata = pageMeta("/about", {
  title: "About Shubhora — AI Software Company",
  description: "Shubhora builds practical AI software, automation and business platforms around real operating workflows.",
});

const principles = [
  { icon: BrainCircuit, title: "AI with a job to do", body: "We use AI where it improves a measurable workflow—not as decoration." },
  { icon: Blocks, title: "Start useful, grow modularly", body: "A focused first release creates value sooner and becomes the foundation for the larger system." },
  { icon: ShieldCheck, title: "Controls before scale", body: "Permissions, data ownership and human approvals are designed into sensitive workflows." },
  { icon: HeartHandshake, title: "Long-term operating partner", body: "Software improves through real usage, so launch is the start of the product relationship." },
];

export default function AboutPage() {
  return <div>
    <section className="max-w-4xl mx-auto px-5 pt-16 md:pt-24 pb-14">
      <span className="text-xs mono uppercase tracking-wide text-faint">About Shubhora</span>
      <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-balance">Technology should remove friction from the way a business grows.</h1>
      <div className="mt-7 space-y-5 text-lg text-muted leading-relaxed max-w-3xl">
        <p>Shubhora is an AI software and business automation company. We design custom applications for customer acquisition, team operations, service workflows and management insight.</p>
        <p>Our flagship product, the Shubhora Business Suite, began with a simple need: turn a digital profile into an active lead and follow-up system. The same thinking now shapes every build—understand the real workflow, connect the right technology and make the result easy for people to use.</p>
        <p>Some clients need one automation. Others need a full CRM, customer portal or AI-enabled operating system. We build in modules so the investment can follow actual business growth.</p>
      </div>
    </section>
    <section className="border-y border-border bg-surface"><div className="max-w-6xl mx-auto px-5 py-16 md:py-20"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{principles.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-border bg-bg p-6"><Icon className="h-6 w-6 text-brand" /><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm text-muted leading-relaxed">{body}</p></article>)}</div></div></section>
    <section className="max-w-4xl mx-auto px-5 py-16 md:py-20 text-center"><h2 className="text-3xl font-semibold tracking-tight">Have a workflow that should not be manual?</h2><p className="mt-3 text-muted">Share it with us. We will help turn it into a clear software scope.</p><Link href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">Discuss your project <ArrowRight className="h-4 w-4" /></Link></section>
  </div>;
}
