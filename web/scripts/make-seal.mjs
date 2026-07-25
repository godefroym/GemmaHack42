// Render the PANDAR evidence seal to a PNG for the StickerPeel component.
// resvg (sharp's SVG backend) does not implement <textPath>, so the ring
// lettering is laid out character by character with explicit transforms.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const S = 560;
const C = S / 2;

/** Lay text around a circle. `dir: 1` reads along the top, `-1` along the bottom. */
function ringText(text, { r, step, size, dir = 1, fill = "#FBFAF7" }) {
  const chars = [...text];
  const span = (chars.length - 1) * step;
  return chars
    .map((ch, i) => {
      const a = (i * step - span / 2) * dir; // degrees from 12 (top) / 6 (bottom)
      const rad = (a * Math.PI) / 180;
      const x = C + r * Math.sin(rad);
      const y = C - r * Math.cos(rad) * dir;
      const rot = dir === 1 ? a : 180 - a;
      const safe = ch === "&" ? "&amp;" : ch;
      return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" transform="rotate(${rot.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-size="${size}" font-weight="700" fill="${fill}">${safe}</text>`;
    })
    .join("\n    ");
}

// Radar sweep, drawn faintly across the whole ink disc.
const OX = -128;
const OY = 128;
const arc = (r, op) =>
  `<path d="M ${OX} ${OY - r} a ${r} ${r} 0 0 1 ${r} ${r}" fill="none" stroke="#FBFAF7" stroke-width="4" opacity="${op}"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <!-- die-cut paper border -->
  <circle cx="${C}" cy="${C}" r="272" fill="#FBFAF7"/>
  <!-- red seal band -->
  <circle cx="${C}" cy="${C}" r="262" fill="#FF2B3A"/>

  <!-- ring lettering -->
  ${ringText("CHAIN OF CUSTODY", { r: 226, step: 9.2, size: 29 })}
  ${ringText("SHA-256 VERIFIED", { r: 226, step: 9.2, size: 29, dir: -1 })}
  <circle cx="${C - 226}" cy="${C}" r="7" fill="#FBFAF7"/>
  <circle cx="${C + 226}" cy="${C}" r="7" fill="#FBFAF7"/>

  <!-- ink core -->
  <circle cx="${C}" cy="${C}" r="188" fill="#14141A"/>
  <circle cx="${C}" cy="${C}" r="178" fill="none" stroke="#FBFAF7" stroke-width="2" stroke-dasharray="2 9" opacity="0.45"/>

  <!-- faint radar sweep across the core -->
  <g transform="translate(${C} ${C})" clip-path="url(#core)">
    <clipPath id="core"><circle cx="0" cy="0" r="176"/></clipPath>
    ${arc(96, 0.14)}
    ${arc(168, 0.11)}
    ${arc(240, 0.08)}
    <path d="M ${OX} ${OY} L ${OX + 300} ${OY - 300}" stroke="#FBFAF7" stroke-width="4" opacity="0.16"/>
  </g>

  <!-- wordmark + blip -->
  <text x="${C}" y="${C - 34}" text-anchor="middle" font-family="monospace"
        font-size="50" font-weight="700" letter-spacing="12" fill="#FBFAF7">PANDAR</text>
  <circle cx="${C}" cy="${C + 34}" r="9" fill="#FF2B3A"/>
  <text x="${C}" y="${C + 104}" text-anchor="middle" font-family="monospace"
        font-size="30" font-weight="700" letter-spacing="9" fill="#FF2B3A">SEALED</text>
</svg>`;

const out = new URL("../public/seal.png", import.meta.url);
const buf = await sharp(Buffer.from(svg), { density: 300 }).png().toBuffer();
writeFileSync(out, buf);
console.log("wrote", out.pathname, buf.length, "bytes");
