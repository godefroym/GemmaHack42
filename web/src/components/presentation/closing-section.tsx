import Link from "next/link";
import { Emblem, SeverityStrip } from "@/components/site/kit";

export function ClosingSection() {
  return (
    <section id="closing" className="scroll-mt-16 bg-night text-paper">
      <div className="mx-auto flex min-h-[84vh] w-full max-w-7xl flex-col justify-between px-5 py-16 md:px-8 md:py-24">
        <div className="flex items-center justify-between border-b border-night-line pb-5">
          <div className="flex items-center gap-3">
            <Emblem size={30} />
            <span className="font-mono text-sm font-bold">
              PANDAR<span className="text-accent">_</span>
            </span>
          </div>
          <p className="meta text-white/35">Gemma 4 Hackathon · 42 Paris</p>
        </div>

        <div className="py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
            Conclusion
          </p>
          <h2 className="mt-7 max-w-5xl text-balance text-[48px] font-medium leading-[0.98] tracking-[-0.05em] sm:text-[64px] lg:text-[82px]">
            Keep the crime scene inside.
            <br />
            <span className="text-accent">Get the hospital back online.</span>
          </h2>

          <div className="mt-14 grid gap-px overflow-hidden rounded-card border border-night-line bg-night-line md:grid-cols-3">
            <div className="bg-night-2 p-6">
              <p className="font-mono text-[42px] font-medium tracking-[-0.04em]">0 B</p>
              <p className="mt-2 text-sm text-white/45">evidence sent to a cloud model</p>
            </div>
            <div className="bg-night-2 p-6">
              <p className="font-mono text-[42px] font-medium tracking-[-0.04em]">90.8%</p>
              <p className="mt-2 text-sm text-white/45">measured IR quality on the shipped Spark config</p>
            </div>
            <div className="bg-night-2 p-6">
              <p className="font-mono text-[42px] font-medium tracking-[-0.04em]">39 s</p>
              <p className="mt-2 text-sm text-white/45">for four concurrent specialist analyses</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-8 border-t border-night-line pt-8">
          <div>
            <p className="text-3xl font-medium">Thank you.</p>
            <p className="mt-2 font-mono text-[11px] text-white/35">Questions?</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-accent px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-white"
            >
              Open live dashboard
            </Link>
            <Link
              href="/"
              className="rounded-md border border-night-line px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-white/65 transition-colors hover:border-white/40 hover:text-white"
            >
              Back to homepage
            </Link>
          </div>
        </div>
      </div>
      <SeverityStrip />
    </section>
  );
}
