import { SectionHead } from "@/components/site/kit";
import { CONCURRENCY, MODEL_BENCHMARKS } from "@/lib/presentation";

function SpeedBar({ value, accent = false }: { value: number; accent?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${accent ? "bg-accent" : "bg-white/65"}`}
        style={{ width: `${(value / 40) * 100}%` }}
      />
    </div>
  );
}

function QualityBar({ value, accent = false }: { value: number; accent?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
      <div
        className={`h-full rounded-full ${accent ? "bg-accent" : "bg-ink/45"}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function BenchmarkSection() {
  return (
    <section id="benchmark" className="scroll-mt-16 bg-night px-5 py-20 text-paper md:px-8 md:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHead
          index="02"
          kicker="Measured on a physical DGX Spark"
          title={
            <>
              The useful optimization was not “use the biggest model.”
              <br />
              <span className="text-accent">It was “move fewer active weights.”</span>
            </>
          }
          dark
        >
          <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-white/55">
            NVIDIA GB10 · 121.7 GB unified memory · vLLM Gemma 4 CUDA 13 image · pinned
            checkpoints · four synthetic IR cases and 87 weighted checks.
          </p>
        </SectionHead>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1.55fr_0.75fr]">
          <div className="overflow-hidden rounded-card border border-night-line bg-night-2">
            <div className="flex items-end justify-between gap-4 border-b border-night-line px-5 py-4">
              <div>
                <p className="meta text-white/40">Single stream</p>
                <h3 className="mt-2 text-xl font-medium">Decode speed and IR quality</h3>
              </div>
              <p className="font-mono text-[10px] text-white/35">temperature 0 · median</p>
            </div>
            <div className="divide-y divide-white/8">
              {MODEL_BENCHMARKS.map((model) => {
                const shipped = model.tone === "accent";
                const fp8 = model.tone === "warning";
                return (
                  <article
                    key={`${model.name}-${model.precision}`}
                    className={`grid gap-5 px-5 py-5 sm:grid-cols-[1.05fr_0.8fr_0.75fr] ${
                      shipped ? "bg-accent/8" : ""
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{model.name}</p>
                        {shipped && (
                          <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                            shipped
                          </span>
                        )}
                        {fp8 && (
                          <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/45">
                            trade-off
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-white/35">
                        {model.platform} · {model.precision}
                      </p>
                    </div>
                    <div>
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="font-mono text-[10px] text-white/35">decode</span>
                        <span className="font-mono text-sm font-bold">
                          {model.speed.toFixed(2)} <span className="text-[9px] text-white/35">tok/s</span>
                        </span>
                      </div>
                      <SpeedBar value={model.speed} accent={shipped} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="font-mono text-[10px] text-white/35">quality</span>
                        <span className={`font-mono text-sm font-bold ${shipped ? "text-accent" : ""}`}>
                          {model.quality}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${shipped ? "bg-accent" : "bg-white/65"}`}
                          style={{ width: `${model.quality}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-right font-mono text-[9px] text-white/30">
                        {model.critical} critical
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="flex flex-col justify-between rounded-card bg-accent p-7 text-white">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">
                Result to remember
              </p>
              <p className="mt-7 text-[64px] font-medium leading-none tracking-[-0.055em]">2.1×</p>
              <p className="mt-4 max-w-sm text-[20px] font-medium leading-snug">
                faster decode than the dense 31B, with a higher aggregate IR score.
              </p>
            </div>
            <div className="mt-12 border-t border-white/25 pt-5">
              <p className="font-mono text-[11px] leading-relaxed text-white/75">
                26B-A4B activates about 4B parameters per token. On a bandwidth-bound Spark,
                active parameter count matters more than the number on the model card.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <article className="rounded-card border border-night-line bg-paper p-6 text-ink">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="meta">Continuous batching</p>
                <h3 className="mt-2 text-xl font-medium">One box serves an investigation team</h3>
              </div>
              <p className="font-mono text-[11px] text-muted">aggregate tok/s</p>
            </div>
            <div className="mt-7 space-y-5">
              {CONCURRENCY.map((point) => (
                <div key={point.requests} className="grid grid-cols-[34px_1fr] gap-4">
                  <div className="font-mono text-sm font-bold">×{point.requests}</div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_52px] items-center gap-3">
                      <QualityBar value={(point.bf16 / 180) * 100} accent />
                      <span className="font-mono text-[11px] font-bold">{point.bf16}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_52px] items-center gap-3">
                      <QualityBar value={(point.fp8 / 180) * 100} />
                      <span className="font-mono text-[11px] text-muted">{point.fp8}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-5 border-t border-hairline pt-4 font-mono text-[10px] text-muted">
              <span><b className="mr-1 text-accent">●</b> bf16 · shipped</span>
              <span><b className="mr-1 text-ink/45">●</b> FP8 · measured</span>
            </div>
          </article>

          <article className="rounded-card border border-night-line bg-paper p-6 text-ink">
            <p className="meta">End-to-end agent</p>
            <h3 className="mt-2 text-xl font-medium">Four specialists run concurrently</h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Reconstruction, ATT&CK mapping, clock analysis and remediation all read the same
              immutable graph. None needs to wait for another.
            </p>
            <div className="mt-8 space-y-6">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-mono text-[11px] text-muted">sequential</span>
                  <span className="font-mono text-lg font-bold">79 s</span>
                </div>
                <QualityBar value={100} />
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-mono text-[11px] text-accent">concurrent specialists</span>
                  <span className="font-mono text-lg font-bold text-accent">39 s</span>
                </div>
                <QualityBar value={49.4} accent />
              </div>
            </div>
            <p className="mt-8 border-t border-hairline pt-4 font-mono text-[11px] leading-relaxed text-muted">
              Same four answers · 2.03× less wall time · no new hardware
            </p>
          </article>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-card border border-night-line bg-night-2 p-5">
            <p className="meta text-white/40">Production choice</p>
            <p className="mt-3 text-lg font-medium">26B-A4B · bf16</p>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              90.8% quality, 9/11 critical checks and 102.5 tok/s aggregate at concurrency 8.
            </p>
          </div>
          <div className="rounded-card border border-night-line bg-night-2 p-5">
            <p className="meta text-white/40">Rejected trade-off</p>
            <p className="mt-3 text-lg font-medium">FP8 · 38.77 tok/s</p>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Faster, but loses a critical clock-conflict check. Measured, not shipped.
            </p>
          </div>
          <div className="rounded-card border border-night-line bg-night-2 p-5">
            <p className="meta text-white/40">Why Spark</p>
            <p className="mt-3 text-lg font-medium">Local memory, not cloud speed</p>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              The 128 GB-class unified memory keeps a capable model beside sensitive evidence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
