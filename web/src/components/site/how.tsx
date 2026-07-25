"use client";

import { Chip, Reveal, SectionHead } from "./kit";
import { CANNOT, FALLBACK, STEPS, TOOLS } from "@/lib/content";

export function How() {
  return (
    <section
      id="how"
      className="mx-auto w-full max-w-6xl px-6 py-20 md:px-10 md:py-28"
    >
      <SectionHead
        index="03"
        kicker="How it works"
        title={
          <>
            Deterministic first. Gemma second.{" "}
            <span className="text-muted-2">Never the other way round.</span>
          </>
        }
      />

      <div className="mt-14 grid gap-px overflow-hidden rounded-card border border-hairline bg-hairline md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.index} delay={i * 0.07} className="bg-paper-2">
            <div className="flex h-full flex-col p-7 md:p-8">
              <p className="font-mono text-[13px] font-bold">
                {s.label}
                <span className="text-accent">_{s.index}</span>
              </p>
              <h3 className="mt-6 text-[21px] font-medium leading-[1.2] tracking-[-0.02em]">
                {s.title}
              </h3>
              <p className="mt-3.5 flex-1 text-[14.5px] leading-relaxed text-muted">
                {s.body}
              </p>
              <code className="mt-7 font-mono text-[10.5px] text-muted-2">
                {s.file}
              </code>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
        {/* The full allowlist — eight functions, nothing else exists. */}
        <Reveal>
          <div className="h-full rounded-card border border-hairline bg-white p-7 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="meta text-ink">The entire allowlist</p>
              <p className="meta">8 typed · read-only</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {TOOLS.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
            <p className="mt-7 text-[14.5px] leading-relaxed text-muted">
              Anything else — a shell, a write, a delete, a remediation call, a
              tool name it invented — is refused before it runs. The evidence
              bundle is untrusted input, and PANDAR treats it that way from the
              first byte to the final report.
            </p>
          </div>
        </Reveal>

        {/* What the model cannot do. */}
        <Reveal delay={0.06}>
          <div className="h-full rounded-card border border-hairline bg-paper-2 p-7 md:p-8">
            <p className="meta text-accent">The model cannot</p>
            <ul className="mt-6 space-y-0">
              {CANNOT.map((c) => (
                <li
                  key={c}
                  className="flex items-center gap-3 border-b border-hairline py-3 text-[14.5px] last:border-b-0"
                >
                  <span aria-hidden className="font-mono text-[13px] text-accent">
                    ✕
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* The fallback ladder. */}
      <Reveal delay={0.04}>
        <div className="mt-8 flex flex-col gap-6 rounded-card border border-hairline bg-white p-7 md:flex-row md:items-start md:gap-10 md:p-8">
          <p className="meta shrink-0 text-accent md:w-40 md:pt-1">
            When it breaks
          </p>
          <p className="max-w-3xl text-[15.5px] leading-relaxed text-muted">
            {FALLBACK}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
