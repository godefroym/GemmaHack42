import { Chip, SectionHead } from "@/components/site/kit";
import { STACK_LAYERS } from "@/lib/presentation";

export function StackSection() {
  return (
    <section id="stack" className="scroll-mt-16 border-b border-hairline px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHead
          index="01"
          kicker="Technical stack"
          title={
            <>
              The parsers establish the facts.
              <br />
              <span className="text-accent">Gemma decides where to look next.</span>
            </>
          }
        >
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-muted">
            PANDAR does not ask a model to improvise a forensic report from a folder of logs.
            It first builds a verified evidence model, then exposes narrow investigation
            functions to Gemma 4.
          </p>
        </SectionHead>

        <div className="mt-14 grid gap-px overflow-hidden rounded-card border border-hairline bg-hairline lg:grid-cols-5">
          {STACK_LAYERS.map((layer, index) => (
            <article key={layer.index} className="relative min-h-[320px] bg-paper p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-accent">{layer.index}</span>
                <span className="meta">{layer.label}</span>
              </div>
              <div className="mt-9 font-mono text-[28px] text-ink/20">
                {index < STACK_LAYERS.length - 1 ? "→" : "✓"}
              </div>
              <h3 className="mt-6 text-[18px] font-medium leading-tight tracking-[-0.015em]">
                {layer.title}
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">{layer.detail}</p>
              <div className="mt-6 flex flex-wrap gap-1.5">
                {layer.examples.map((example) => (
                  <Chip key={example}>{example}</Chip>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-card border border-hairline bg-white p-5">
            <p className="meta">Network boundary</p>
            <p className="mt-3 text-sm leading-relaxed">
              The inference endpoint lives on the local appliance. Evidence never needs an
              Internet route.
            </p>
          </div>
          <div className="rounded-card border border-hairline bg-white p-5">
            <p className="meta">Tool boundary</p>
            <p className="mt-3 text-sm leading-relaxed">
              Gemma gets typed read-only functions over the evidence graph — no unrestricted
              shell on the victim.
            </p>
          </div>
          <div className="rounded-card border border-accent/30 bg-accent-wash p-5">
            <p className="meta text-accent">Write boundary</p>
            <p className="mt-3 text-sm leading-relaxed">
              Recovery actions remain proposals until an analyst preserves evidence and
              explicitly approves the change.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
