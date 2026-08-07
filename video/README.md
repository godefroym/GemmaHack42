# PANDAR — presentation film

A 2-minute motion-design piece presenting the product. Picks up **after** the existing
intro, which already establishes the hospital breach and the cloud constraint.

- [`SCRIPT.md`](SCRIPT.md) — beat sheet, voice-over, and a source citation for every
  figure on screen. Also the writing rules and the four claims that must never appear.
- [`STORYBOARD.md`](STORYBOARD.md) — frame layouts, layer order, timing curves.
- [`VO.txt`](VO.txt) — narration only, 253 words, for the recording pass.

```bash
npm install
npm run studio                    # preview and scrub
npm run render                    # out/pandar.mp4
npm run stills                    # one still per scene, into out/
npm run data                      # regenerate src/data/case.ts from the repo
npm run typecheck
```

## How it is put together

120.000 s · 30 fps · 3600 frames · 1920×1080, seven scenes in a `<Series>`
([`src/Pandar.tsx`](src/Pandar.tsx)). Scene boundaries are the contract with `VO.txt` —
move one and the narration moves with it.

| | |
| --- | --- |
| [`src/theme.ts`](src/theme.ts) | Palette and type, lifted verbatim from `web/src/app/globals.css` |
| [`src/anim.ts`](src/anim.ts) | One easing curve for the whole film, plus `fadeUp` / `countTo` / `typed` |
| [`src/Radar.tsx`](src/Radar.tsx) | The continuous 5%-opacity radar under all seven scenes |
| [`src/data/case.ts`](src/data/case.ts) | **Generated** — never edit by hand |
| [`src/scenes/`](src/scenes/) | One file per scene, each documented with its beats |

## The numbers are not typed by hand

[`scripts/build-case-data.mjs`](scripts/build-case-data.mjs) reads
`artifacts/demo/deterministic-report.json`, `artifacts/hf-real-vm/llm-investigation.json`,
the fixture's `SHA256SUMS`, and `commands/journal.txt`, and emits `src/data/case.ts`. The
attacker's log line is **located by search**, not transcribed. Evidence IDs, the policy
decision, the bundle hashes, the tool-call count and the model's own finding all come
from the product's output.

That is deliberate: the landing page states the same rule for itself — *"If a number is
not in the repo, it does not belong in this file."*

## Before changing anything

Read the writing rules and the forbidden-claims table at the top of `SCRIPT.md`. The
branch this describes (`agent/integration-hackathon`) contradicts its own landing-page
copy in four places, and it is easy to reintroduce a claim that is no longer true.

```bash
grep -rniE "eight (typed|tools)|correct-and-boring|no physical Spark|9\.5x" .
```

Fonts are vendored in `public/fonts/`. Renders do not touch the network.
