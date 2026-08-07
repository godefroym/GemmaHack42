import { useEffect, useState } from "react";
import { staticFile, continueRender, delayRender } from "remotion";

/**
 * Fonts are vendored under public/fonts/ rather than fetched from Google at render
 * time. A film about a product that never phones home should not phone home to render.
 */

const face = (family: string, file: string, weight: string) =>
  `@font-face{font-family:'${family}';src:url('${staticFile(`fonts/${file}`)}') format('woff2');font-weight:${weight};font-style:normal;font-display:block;}`;

/** The @font-face rules go in immediately — plain DOM, no render lifecycle involved. */
const inject = () => {
  if (typeof document === "undefined" || document.getElementById("pandar-fonts")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "pandar-fonts";
  style.textContent = [
    // Geist ships as one variable file covering 100–900.
    face("Geist", "Geist-variable.woff2", "100 900"),
    face("Space Mono", "SpaceMono-400.woff2", "400"),
    face("Space Mono", "SpaceMono-700.woff2", "700"),
  ].join("");
  document.head.appendChild(style);
};

inject();

/**
 * Holds the render until the faces are actually parsed. delayRender must be called
 * from inside a component — at module scope it fails the whole render.
 */
export const useFonts = () => {
  const [handle] = useState(() => delayRender("Loading vendored Geist and Space Mono"));

  useEffect(() => {
    inject();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      fonts.ready.then(() => continueRender(handle));
    } else {
      continueRender(handle);
    }
  }, [handle]);
};
