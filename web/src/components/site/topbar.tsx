"use client";

import { Emblem } from "./kit";
import { LINKS, META } from "@/lib/content";

export function Topbar() {
  return (
    <header className="relative z-20 flex items-center justify-between gap-6 border-b border-hairline px-6 py-4 md:px-10">
      <a href="#top" className="flex items-center gap-2.5 text-ink">
        <Emblem size={26} />
        <span className="font-mono text-base font-bold tracking-[-0.01em]">
          PANDAR<span className="text-accent">_</span>
        </span>
      </a>

      <div className="flex items-center gap-4 md:gap-7">
        <p className="meta hidden lg:block">{META.event}</p>
        <span className="hidden h-4 w-px bg-hairline lg:block" />
        <a
          href={LINKS.repo}
          target="_blank"
          rel="noreferrer"
          className="meta transition-colors hover:text-ink"
        >
          GitHub
        </a>
        <a
          href={LINKS.kaggle}
          target="_blank"
          rel="noreferrer"
          className="meta transition-colors hover:text-ink"
        >
          Kaggle
        </a>
      </div>
    </header>
  );
}
