# PANDAR — landing page

The public face of the project: `PANDAR`, the radar inside Pandora's box.
Next.js 16 + React 19 + Tailwind v4, deployed on Vercel.

Every number and string on the page is lifted from this repository and lives in
one file, [`src/lib/content.ts`](src/lib/content.ts) — sourced from `README.md`,
`eval/RESULTS.md`, `artifacts/demo/deterministic-report.json` and
`eval/results/mac-e4b.json`. **If a number is not in the repo, it does not go on
the page.** Edit `content.ts`, not the components.

## Run it

```bash
pnpm install
pnpm dev
```

Then <http://localhost:3000>. `pnpm build` runs the production build and the
TypeScript check.

## Deploy on Vercel

Import the repository and set **Root Directory** to `web`. Framework preset
Next.js, install command `pnpm install`, build command `pnpm build`. Nothing
else is required — the page is fully static, with no API routes, no environment
variables and no runtime data source.

## Before you ship

- `LINKS.kaggle` in `src/lib/content.ts` is still a placeholder. Paste the real
  Kaggle writeup URL there.
- `public/attack-graph.png` is a copy of `artifacts/demo/attack-graph.png`.
  Re-copy it after any run that changes the graph:
  `cp ../artifacts/demo/attack-graph.png public/attack-graph.png`.

## Structure

```
src/app/                   layout, page, design tokens in globals.css
src/lib/content.ts         every claim, number and caveat on the page
src/components/site/       PANDAR sections and brand objects
src/components/originkit/  animated components from originkit.dev
scripts/make-seal.mjs      regenerates public/seal.png
```

### Design system

Warm off-white paper `#FBFAF7`, blue-black ink `#14141A`, one punchy red
`#FF2B3A`, hairline `#E5E2DA`, and dark surfaces `#0B0B11` for the evidence
cards and the inverted bands. Geist for text, Space Mono for every piece of
case-file chrome. Radii are soft — 10px cards, 6px buttons.

The five-bar strip at the very bottom of the page is the project's own severity
ramp, taken from `EVENT_COLORS` in `src/gemma_ir/render.py`: `account_created`
through `exfiltration_attempt`. The same ramp drives the severity dots on every
evidence card.

### Animated components

From [originkit.dev](https://www.originkit.dev), fetched through the Origin Kit
MCP registry as `nextjs` / `tailwind` / `typescript` and retuned for this
palette. Each file keeps a provenance header.

| Component | Where | Why |
| --- | --- | --- |
| Kinetic Grid | hero background | the radar field — a dot mesh pulled toward the cursor, leaving a red sweep trail |
| Typewriter | hero | types the product's five promises |
| Swipe Stack | hero | the evidence deck: the real 8-step attack path as cards you can throw around |
| Sticker Peel | hero | the chain-of-custody seal, peelable (WebGL, client-only) |
| Shiny Pill | hero | sheen across the `READ ONLY · INTEGRITY VERIFIED` chip |
| Scramble Text | §02 | the benchmark headline decodes into place |
| Spotlight Text | §04 | the untrusted log line stays dark until you shine a light on it |
| Pixel Reveal | §05 | the real `render.py` attack graph dissolves into view |
| Dynamic Weight | close | letters thicken under the cursor |

`Swipe Stack` is the team's own JSX fork from
[`Mathis-14/hackathon-mistral-vibe`](https://github.com/Mathis-14/hackathon-mistral-vibe):
upstream renders `<img>` backgrounds, the fork renders arbitrary children, which
is what the evidence cards need.

Fetching component source is rate-limited to 10 per API key per day, resetting
at 00:00 UTC. Browsing the catalog is free.

### The seal

`public/seal.png` is generated rather than hand-drawn. Re-run it after any
palette change:

```bash
node scripts/make-seal.mjs
```

It uses `sharp` (a devDependency). Note that resvg — sharp's SVG backend — does
not implement `<textPath>`, so the ring lettering is laid out character by
character with explicit transforms.
