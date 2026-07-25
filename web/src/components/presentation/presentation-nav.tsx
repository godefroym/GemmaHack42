"use client";

import Link from "next/link";
import { PRESENTATION_NAV } from "@/lib/presentation";

export function PresentationNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-5 py-3 md:px-8">
        <Link
          href="/"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:text-accent"
        >
          ← PANDAR
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {PRESENTATION_NAV.map((item, index) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="whitespace-nowrap rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:bg-white hover:text-ink"
            >
              <span className="mr-1.5 text-accent">{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
