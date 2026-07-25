// Origin Kit — spotlighttext (originkit.dev)
// Fetched via the Origin Kit MCP registry as nextjs/tailwind/ts.
// Adapted for PANDAR: Framer static-renderer shims removed, props typed,
// defaults retuned for the clinical white identity.

"use client"

import * as React from "react"
import { useEffect, useRef } from "react"
const useIsStaticRenderer = () => false
import {
    animate,
    motion,
    useMotionTemplate,
    useMotionValue,
    useReducedMotion,
} from "framer-motion"

/**
 * FlashlightText — a recreation of Cred's "Flashlight Effect". A block of text
 * is DIMMED by default; a soft circular spotlight follows the cursor on hover
 * and reveals the BRIGHT version of the text within it, like sweeping a torch
 * across text in the dark.
 *
 * Two-layer trick: a BRIGHT base layer underneath, a DIM overlay on top that
 * carries a cursor-following radial mask — the spotlight reveals the bright
 * base inside the circle, dim text outside.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 720
 * @framerIntrinsicHeight 240
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type FontValue =
    | string
    | {
          fontFamily?: string
          fontWeight?: number | string
          fontSize?: number | string
          fontStyle?: string
          letterSpacing?: string | number
          lineHeight?: string | number
          textAlign?: "left" | "center" | "right"
      }

type Props = {
    text: string
    font?: FontValue
    brightColor: string
    dimColor: string
    maskSize: number
    intensity: number
    transition: any
    style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// The Font control already returns CSS-ready props (family, size, weight,
// line-height, letter-spacing, align). Spread the whole value into the layer.
function resolveFont(font: FontValue | undefined): React.CSSProperties {
    if (!font) return {}
    if (typeof font === "string") return { fontFamily: font }
    return font as React.CSSProperties
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function FlashlightText(props: Props) {
    props = { ...COMPONENT_DEFAULTS, ...props }
    const {
        text,
        font,
        brightColor,
        dimColor,
        maskSize,
        intensity,
        transition,
        style,
    } = props

    const isStatic = useIsStaticRenderer()
    const prefersReducedMotion = useReducedMotion()

    // Live spotlight only with real interactivity + motion allowed.
    const interactive = !isStatic && !prefersReducedMotion

    const containerRef = useRef<HTMLDivElement | null>(null)
    const contentRef = useRef<HTMLDivElement | null>(null)

    // --- mask motion values --------------------------------------------------
    // maskSize default 0 → no spotlight, fully dim text until hovered.
    const maskX = useMotionValue(0)
    const maskY = useMotionValue(0)
    const maskSizeMV = useMotionValue(0)

    // Intensity 10–100 = the solid core %. 100 → fully solid disc; 10 → a small
    // solid centre with a long fade out to the edge.
    const core = Math.max(10, Math.min(100, intensity))
    const maskImage = useMotionTemplate`radial-gradient(circle ${maskSizeMV}px at ${maskX}px ${maskY}px, black, black ${core}%, transparent 100%)`

    // --- pointer + hover listeners -------------------------------------------
    useEffect(() => {
        if (!interactive) return
        const el = containerRef.current
        if (!el) return

        const onMove = (e: PointerEvent) => {
            const rect = (contentRef.current ?? el).getBoundingClientRect()
            maskX.set(e.clientX - rect.left)
            maskY.set(e.clientY - rect.top)
        }
        // The Transition modal drives both open and close timing + easing.
        const onEnter = () => {
            animate(maskSizeMV, maskSize, transition)
        }
        const onLeave = () => {
            animate(maskSizeMV, 0, transition)
        }

        el.addEventListener("pointermove", onMove)
        el.addEventListener("pointerenter", onEnter)
        el.addEventListener("pointerleave", onLeave)

        return () => {
            el.removeEventListener("pointermove", onMove)
            el.removeEventListener("pointerenter", onEnter)
            el.removeEventListener("pointerleave", onLeave)
        }
    }, [interactive, maskSize, transition, maskX, maskY, maskSizeMV])

    // --- static / reduced-motion: show spotlight centered + open ------------
    useEffect(() => {
        if (interactive) return
        const el = contentRef.current
        const w = el?.clientWidth ?? 720
        const h = el?.clientHeight ?? 240
        maskX.set(w / 2)
        maskY.set(h / 2)
        maskSizeMV.set(maskSize)
    }, [interactive, maskSize, maskX, maskY, maskSizeMV])

    // --- shared typography (identical on BOTH layers) ------------------------
    const fontStyles = resolveFont(font)

    const textTypography: React.CSSProperties = {
        margin: 0,
        boxSizing: "border-box",
        width: "100%",
        fontFamily:
            (fontStyles.fontFamily as string) ||
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        ...fontStyles,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        userSelect: "none",
    }

    const rootStyle: React.CSSProperties = {
        ...style,
        position: "relative",
        boxSizing: "border-box",
        // Fill the frame so the whole area is hoverable, not just the text box.
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        cursor: interactive ? "none" : undefined,
    }

    return (
        <div ref={containerRef} style={rootStyle}>
            {/* Content box: sized to the text, centred in the frame. Both layers
                live here so the absolute overlay stays aligned with the base. */}
            <div
                ref={contentRef}
                style={{ position: "relative", width: "100%" }}
            >
                {/* BASE layer (bottom): DIM text, always visible. */}
                <div
                    aria-label={text}
                    style={{
                        ...textTypography,
                        position: "relative",
                        color: dimColor,
                    }}
                >
                    {text}
                </div>

                {/* OVERLAY layer (top): BRIGHT text, pixel-for-pixel over the
                    base. The radial mask reveals it ONLY inside the cursor
                    spotlight (opaque core → bright shows; transparent outside →
                    dim base shows). maskSize 0 at rest hides it → fully dim. */}
                <motion.div
                    aria-hidden
                    style={{
                        ...textTypography,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        color: brightColor,
                        pointerEvents: "none",
                        WebkitMaskImage: maskImage,
                        maskImage: maskImage,
                        WebkitMaskSize: "100%",
                        maskSize: "100%",
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                    }}
                >
                    {text}
                </motion.div>
            </div>
        </div>
    )
}

// -----------------------------------------------------------------------------
// Defaults + property controls
// -----------------------------------------------------------------------------

const COMPONENT_DEFAULTS = {
    text: "Not everything is meant to be seen at once. Hover to reveal.",
    font: {
        fontFamily: "Inter",
        fontSize: "40px",
        variant: "Semibold",
        lineHeight: "1.3em",
        letterSpacing: "0em",
        textAlign: "center",
    } as any,
    brightColor: "#FFFFFF",
    dimColor: "#000000",
    maskSize: 150,
    intensity: 10,
    transition: { type: "tween", duration: 0.3, ease: "easeInOut" },
}

