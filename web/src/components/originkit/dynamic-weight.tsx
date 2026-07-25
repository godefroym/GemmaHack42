// Origin Kit — dynamic-weight (originkit.dev)
// Fetched via the Origin Kit MCP registry as nextjs/tailwind/ts.
// Adapted for PANDAR: Framer static-renderer shims removed, props typed,
// defaults retuned for the clinical white identity.

"use client"

import * as React from "react"
import { useEffect, useRef } from "react"
const useIsStaticRenderer = () => false
import { motion, useAnimationFrame } from "framer-motion"

/**
 * VariableFontCursorProximity — text whose letters individually morph
 * their `wght` (font-variation-settings) based on proximity to the cursor.
 * Each letter interpolates linearly between `fromWeight` (resting) and
 * `toWeight` (at cursor center); the Transition control eases both the
 * ramp-in and ramp-out. The component IS the container — proximity is
 * measured relative to its own bounding box, so no external ref is required.
 *
 * Uses the app-level variable Inter exposed as --font-inter. Override
 * `fontFamily` with any other variable font's family name — but you
 * must ensure that font is actually loaded in your Framer project.
 *
 * Per-frame `style.fontVariationSettings` mutation is done directly
 * on the DOM nodes (bypassing React) for performance — at 60fps with
 * many letters, anything else would thrash.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 200
 */
export default function VariableFontCursorProximity(props: Props) {
    props = { ...COMPONENT_DEFAULTS, ...props }
    const {
        label,
        fromWeight,
        toWeight,
        strength,
        fontSize,
        color,
        transition,
        style,
    } = props

    // Strength 1–100 → proximity reach in px (100 = MAX_REACH).
    const reach = Math.max(
        1,
        (Math.max(1, Math.min(100, strength)) / 100) * MAX_REACH
    )

    const isStatic = useIsStaticRenderer()

    // Self-contained: the component IS the container. Distance is
    // measured relative to this wrapper, not an external ref.
    const containerRef = useRef<HTMLDivElement>(null)

    // Refs to each rendered letter span, indexed in document order
    // matching the flat `letters` array below. The rAF loop mutates
    // each element's inline `fontVariationSettings` directly.
    const letterRefs = useRef<Array<HTMLSpanElement | null>>([])

    // Per-letter current interpolation factor (0 = rest, 1 = full morph).
    // Eased toward the proximity target each frame so the hover effect
    // ramps in/out at the speed set by the Transition control instead of
    // snapping instantly.
    const letterFactorsRef = useRef<number[]>([])

    // Timestamp of the previous frame, for a robust frame delta (don't rely
    // on the rAF callback's delta arg, which can be absent).
    const lastFrameRef = useRef(0)

    // Mouse position relative to the container's top-left, updated on
    // every mousemove / touchmove. Stored in a ref so updates don't
    // trigger re-renders — only the rAF loop reads it.
    const mousePositionRef = useRef({ x: -99999, y: -99999 })

    useEffect(() => {
        if (isStatic) return

        const updatePosition = (clientX: number, clientY: number) => {
            const el = containerRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            mousePositionRef.current = {
                x: clientX - rect.left,
                y: clientY - rect.top,
            }
        }

        const handleMouseMove = (ev: MouseEvent) =>
            updatePosition(ev.clientX, ev.clientY)
        const handleTouchMove = (ev: TouchEvent) => {
            if (ev.touches.length === 0) return
            updatePosition(ev.touches[0].clientX, ev.touches[0].clientY)
        }

        window.addEventListener("mousemove", handleMouseMove)
        window.addEventListener("touchmove", handleTouchMove)
        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("touchmove", handleTouchMove)
        }
    }, [isStatic])

    // Resting / hover wght values as variation-settings strings.
    const fromSettings = `'wght' ${fromWeight}`

    // Per-frame: walk every letter, compute distance from its center to the
    // cursor → a linear proximity target, ease the stored factor toward it at
    // the transition speed (both ramp-in and ramp-out), and stamp the
    // interpolated `wght` directly onto the DOM node.
    useAnimationFrame((now: number) => {
        if (isStatic) return
        const container = containerRef.current
        if (!container) return
        const containerRect = container.getBoundingClientRect()
        const mx = mousePositionRef.current.x
        const my = mousePositionRef.current.y

        // Frame delta in seconds (clamped so a stalled tab can't jump).
        const prevT = lastFrameRef.current || now
        const dtSec = Math.min(0.1, Math.max(0, (now - prevT) / 1000))
        lastFrameRef.current = now

        // Transition duration → exponential smoothing rate. Larger duration
        // = slower, softer ramp; ~0 = effectively instant.
        const tau = Math.max(0.016, transition?.duration ?? 0.3)
        const a = 1 - Math.exp(-dtSec / tau)

        for (let i = 0; i < letterRefs.current.length; i++) {
            const letterEl = letterRefs.current[i]
            if (!letterEl) continue
            const rect = letterEl.getBoundingClientRect()
            const cx = rect.left + rect.width / 2 - containerRect.left
            const cy = rect.top + rect.height / 2 - containerRect.top
            const dx = mx - cx
            const dy = my - cy
            const dist = Math.sqrt(dx * dx + dy * dy)

            // Linear proximity target (1 at cursor, 0 at/beyond reach), then
            // ease the stored factor toward it at the transition speed.
            const target = Math.min(Math.max(1 - dist / reach, 0), 1)
            const prev = letterFactorsRef.current[i] ?? 0
            const f = prev + (target - prev) * a
            letterFactorsRef.current[i] = f

            if (f < 0.001) {
                if (letterEl.style.fontVariationSettings !== fromSettings) {
                    letterEl.style.fontVariationSettings = fromSettings
                }
                continue
            }

            // Interpolate wght both ways: from → to as the cursor nears.
            const w = Math.round(fromWeight + (toWeight - fromWeight) * f)
            letterEl.style.fontVariationSettings = `'wght' ${w}`
        }
    })

    // ---- Render ----------------------------------------------------------
    // sr-only: visually hidden but available to screen readers. The
    // visible per-letter spans are aria-hidden so this one carries
    // the semantic text.
    const srOnlyStyle: React.CSSProperties = {
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        borderWidth: 0,
    }

    // Locked to the bundled Inter Variable so the wght/slnt morph is reliable.
    // The From/To weights live in the font-variation-settings strings; weight
    // is NOT set here so it can't freeze the axis.
    const innerSpanStyle: React.CSSProperties = {
        fontFamily: VARIABLE_FONT_STACK,
        fontSize,
        color,
        textAlign: "center",
        display: "block",
        width: "100%",
        lineHeight: 1.1,
    }

    // Split into words (preserving the gaps) so words don't break
    // mid-line. Each word is an inline-block with whitespace: nowrap
    // and its letters are inline-block so each one has a measurable
    // box for distance calculations.
    const words = label ? label.split(" ") : []

    // Reset letterRefs to a fresh array each render so stale indices
    // from a previous (longer) label don't survive. The ref-callbacks
    // below will repopulate it.
    letterRefs.current = []
    let letterIndex = 0

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isStatic ? undefined : "pointer",
                ...style,
            }}
        >
            {words.length === 0 ? null : (
                <span style={innerSpanStyle}>
                    <span style={srOnlyStyle}>{label}</span>
                    {words.map((word, wi) => {
                        const wordLetters = word.split("")
                        return (
                            <React.Fragment key={wi}>
                                <span
                                    aria-hidden
                                    style={{
                                        display: "inline-block",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {wordLetters.map((letter, li) => {
                                        const idx = letterIndex++
                                        return (
                                            <motion.span
                                                key={li}
                                                ref={(
                                                    el: HTMLSpanElement | null
                                                ) => {
                                                    letterRefs.current[idx] = el
                                                }}
                                                style={{
                                                    display: "inline-block",
                                                    fontVariationSettings:
                                                        fromSettings,
                                                }}
                                            >
                                                {letter}
                                            </motion.span>
                                        )
                                    })}
                                </span>
                                {wi < words.length - 1 && (
                                    <span
                                        aria-hidden
                                        style={{
                                            display: "inline-block",
                                        }}
                                    >
                                        &nbsp;
                                    </span>
                                )}
                            </React.Fragment>
                        )
                    })}
                </span>
            )}
        </div>
    )
}

// Bundled variable font so the default animation works without the
// user having to load anything. Inter exposes both `wght` (100-900)
// and `slnt` (-10..0) axes, matching the default From/To strings.
// Unique family name avoids colliding with any user-installed "Inter".

// The proximity morph only works on a VARIABLE font. Framer's Font control
// can hand back a static instance + a fixed `fontWeight` that would lock the
// `wght` axis, so the rendered letters are always forced onto this bundled
// variable stack regardless of the picked family.
// PANDAR: the app already self-hosts variable Inter through next/font.
const VARIABLE_FONT_STACK = "var(--font-inter), system-ui, sans-serif"

// Strength 1–100 maps to this proximity reach (px) at full strength.
const MAX_REACH = 800

type Props = {
    label: string
    className?: string
    fromWeight: number
    toWeight: number
    strength: number
    fontSize: number
    color: string
    transition: any
    style?: React.CSSProperties
}

const COMPONENT_DEFAULTS = {
    label: "Variable Font Proximity",
    fontSize: 48,
    color: "#0a0a0b",
    fromWeight: 400,
    toWeight: 900,
    strength: 25,
    transition: {
        type: "tween",
        duration: 0.3,
        ease: "easeOut",
    },
}

