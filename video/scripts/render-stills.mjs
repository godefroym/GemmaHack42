/**
 * One still per scene, taken at the frame where that scene has finished assembling.
 * Run before any animation work: it is the cheapest way to catch a typography or
 * layout problem while it is still cheap to fix.
 *
 * Run: npm run stills
 */

import { execFileSync } from "node:child_process";

const SHOTS = [
  ["1-seal", 200],
  ["2-deterministic", 900],
  ["3-keyhole", 1600],
  ["4-injection", 2400],
  ["5-notheatre", 2850],
  ["6-onenumber", 3300],
  ["7-close", 3580],
];

for (const [name, frame] of SHOTS) {
  process.stdout.write(`f${String(frame).padStart(4)}  ${name} … `);
  execFileSync(
    "npx",
    ["remotion", "still", "Pandar", `out/${name}.png`, `--frame=${frame}`],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  console.log("ok");
}

console.log(`\n${SHOTS.length} stills in out/`);
