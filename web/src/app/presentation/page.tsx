import { PresentationNav } from "@/components/presentation/presentation-nav";
import { StackSection } from "@/components/presentation/stack-section";
import { BenchmarkSection } from "@/components/presentation/benchmark-section";
import { RansomwareReplay } from "@/components/presentation/ransomware-replay";
import { AttackGraphs } from "@/components/presentation/attack-graphs";
import { ClosingSection } from "@/components/presentation/closing-section";
import { SectionHead } from "@/components/site/kit";

export default function PresentationPage() {
  return (
    <>
      <div id="top" />
      <PresentationNav />
      <main>
        <StackSection />
        <BenchmarkSection />

        <section
          id="ransomware"
          className="scroll-mt-16 border-b border-hairline bg-paper-2 px-5 py-20 md:px-8 md:py-28"
        >
          <div className="mx-auto w-full max-w-7xl">
            <SectionHead
              index="03"
              kicker="Complete execution · ransomware"
              title={
                <>
                  Gemma does not “write a post-mortem.”
                  <br />
                  <span className="text-accent">It runs an evidence-driven investigation.</span>
                </>
              }
            >
              <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-muted">
                This is a recorded execution against the compromised hospital VM. The terminal
                shows concrete equivalents of the bounded read-only operations; the right panel
                explains why each pivot exists.
              </p>
            </SectionHead>
            <div className="mt-14">
              <RansomwareReplay />
            </div>
          </div>
        </section>

        <AttackGraphs />
        <ClosingSection />
      </main>
    </>
  );
}
