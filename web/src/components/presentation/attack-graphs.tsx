import Image from "next/image";
import { SectionHead } from "@/components/site/kit";
import { ATTACK_CASES } from "@/lib/presentation";

export function AttackGraphs() {
  return (
    <section id="graphs" className="scroll-mt-16 border-b border-hairline px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHead
          index="04"
          kicker="Three independent executions"
          title={
            <>
              Same forensic pipeline.
              <br />
              <span className="text-accent">Three different attack structures.</span>
            </>
          }
        >
          <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-muted">
            Each graph is rebuilt from a different evidence archive. Observed events keep their
            source IDs; ATT&CK labels are derived separately, so inference never becomes evidence.
          </p>
        </SectionHead>

        <div className="mt-14 space-y-10">
          {ATTACK_CASES.map((incident, index) => (
            <article
              key={incident.id}
              className="overflow-hidden rounded-card border border-hairline bg-white"
            >
              <div className="grid lg:grid-cols-[0.45fr_1fr]">
                <div className="flex flex-col justify-between border-b border-hairline p-6 lg:border-b-0 lg:border-r lg:p-8">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                      {incident.eyebrow}
                    </p>
                    <p className="mt-8 font-mono text-[72px] leading-none tracking-[-0.08em] text-ink/10">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-5 text-[28px] font-medium leading-[1.05] tracking-[-0.03em]">
                      {incident.title}
                    </h3>
                    <p className="mt-5 text-sm leading-relaxed text-muted">{incident.summary}</p>
                  </div>
                  <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
                    {incident.stats.map((stat) => (
                      <span
                        key={stat}
                        className="bg-paper px-3 py-3 font-mono text-[10px] text-muted"
                      >
                        {stat}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-paper-2 p-3 md:p-5">
                  <Image
                    src={incident.graph}
                    alt={`Sourced attack graph for ${incident.title}`}
                    width={1324}
                    height={1075}
                    unoptimized
                    className="h-auto w-full rounded-md border border-hairline bg-paper"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
