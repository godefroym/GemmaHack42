// Origin Kit — pixelreveal (originkit.dev)
// Fetched via the Origin Kit MCP registry as nextjs/tailwind/ts.
// Adapted for PANDAR: Framer static-renderer shims removed, props typed,
// defaults retuned for the clinical white identity.

"use client"

import * as React from "react"
import { useEffect, useLayoutEffect, useRef } from "react"
const useIsStaticRenderer = () => false

/**
 * PixelReveal — reveals an image by dissolving a grid of colored "pixel" squares
 * along the chosen direction, with a noisy leading edge. The reveal auto-plays
 * once when the component scrolls into view.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */
export default function PixelReveal(props: Props) {
    props = { ...COMPONENT_DEFAULTS, ...props }
    const {
        imageSrc,
        gridSize,
        transitionColor,
        edgeHeight,
        transition,
        direction,
        onRevealComplete,
        style,
    } = props

    const isStatic = useIsStaticRenderer()

    const containerRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

    // Animation state — kept in refs so the rAF loop doesn't tear when props
    // change mid-flight. progressRef holds the eased progress used for the draw
    // pass; linearProgressRef holds the unmodified 0..1 timeline position.
    const progressRef = useRef(0)
    const linearProgressRef = useRef(0)
    const startTimeRef = useRef<number | null>(null)
    const rafRef = useRef<number | null>(null)
    const runningRef = useRef(false)
    const completedRef = useRef(false)
    const triggeredOnceRef = useRef(false)

    // Grid state — rebuilt whenever cell count or sweep parameters change.
    const gridRef = useRef<{
        cols: number
        rows: number
        cellW: number
        cellH: number
        cssW: number
        cssH: number
        thresholds: Float32Array
    } | null>(null)

    // Latest prop values, mirrored to refs so the rAF loop and ResizeObserver
    // callbacks always see fresh values without resubscribing.
    const propsRef = useRef({
        gridSize,
        edgeHeight,
        direction,
        transition,
        transitionColor,
        onRevealComplete,
    })
    useEffect(() => {
        propsRef.current = {
            gridSize,
            edgeHeight,
            direction,
            transition,
            transitionColor,
            onRevealComplete,
        }
    }, [
        gridSize,
        edgeHeight,
        direction,
        transition,
        transitionColor,
        onRevealComplete,
    ])

    // ---------------------------------------------------------------------------
    // Cubic-bezier evaluator for Framer's [x1,y1,x2,y2] ease arrays.
    //
    // Standard CSS cubic-bezier: P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1).
    // Given a progress value `x` in [0,1] on the time axis, we solve for the
    // parametric t via bisection then evaluate the y (output) coordinate.
    // ---------------------------------------------------------------------------
    const cubicBezier = (
        x1: number,
        y1: number,
        x2: number,
        y2: number
    ): ((t: number) => number) => {
        const cx = 3 * x1
        const bx = 3 * (x2 - x1) - cx
        const ax = 1 - cx - bx

        const cy = 3 * y1
        const by = 3 * (y2 - y1) - cy
        const ay = 1 - cy - by

        const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
        const sampleY = (t: number) => ((ay * t + by) * t + cy) * t

        return (x: number): number => {
            if (x <= 0) return 0
            if (x >= 1) return 1
            // Bisect to find parametric t for the given x.
            let lo = 0,
                hi = 1,
                t = x
            for (let i = 0; i < 12; i++) {
                const mid = (lo + hi) / 2
                const sx = sampleX(mid)
                if (Math.abs(sx - x) < 1e-6) {
                    t = mid
                    break
                }
                if (sx < x) lo = mid
                else hi = mid
                t = mid
            }
            return sampleY(t)
        }
    }

    // Resolve the Framer transition object → a (t:number)=>number easing fn.
    //
    // Framer transition shapes we care about:
    //   { type: "tween", ease: "easeIn" | "easeOut" | "easeInOut" | "linear"
    //                         | "circIn" | "circOut" | ... }
    //   { type: "tween", ease: [x1, y1, x2, y2] }   ← cubic-bezier array
    //   { type: "spring", ... }                       ← fall back to linear
    //   undefined / anything else                     ← fall back to linear
    const resolveEasingFn = (
        trans: Props["transition"]
    ): ((t: number) => number) => {
        const linear = (t: number) => t

        if (!trans || trans.type === "spring") return linear

        const ease = (trans as { ease?: unknown }).ease

        if (
            Array.isArray(ease) &&
            ease.length === 4 &&
            ease.every((v) => typeof v === "number")
        ) {
            const [x1, y1, x2, y2] = ease as [number, number, number, number]
            return cubicBezier(x1, y1, x2, y2)
        }

        if (typeof ease === "string") {
            switch (ease) {
                case "easeIn":
                case "circIn":
                    return (t) => t * t
                case "easeOut":
                case "circOut":
                    return (t) => 1 - (1 - t) * (1 - t)
                case "easeInOut":
                case "circInOut":
                    return (t) =>
                        t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
                case "linear":
                default:
                    return linear
            }
        }

        return linear
    }

    // Resolve the duration in seconds from the Framer transition object.
    const resolveDuration = (trans: Props["transition"]): number => {
        if (!trans) return 1
        if (trans.type === "spring") return 1
        const d = (trans as { duration?: unknown }).duration
        if (typeof d === "number" && d > 0) return d
        return 1
    }

    // Build the per-cell threshold map. Each cell stores the progress value at
    // which it dissolves. "Base" position is the cell's normalized coord along
    // the sweep axis (0 = first to dissolve, 1 = last). Noise of magnitude
    // `edgeHeight` is added so the dissolving frontier is ragged rather than
    // a flat line.
    const rebuildGrid = (entry?: ResizeObserverEntry) => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        // Prefer the observer's contentRect, then layout box (clientWidth), then
        // getBoundingClientRect. On the Framer canvas getBoundingClientRect can
        // read 0 at setup, which used to size the cover to the 600×400 fallback
        // and pin it to the top-left; contentRect / clientWidth report the real
        // laid-out size so the cover spans the whole frame.
        const cr = entry?.contentRect
        const rectW =
            cr?.width ||
            container.clientWidth ||
            container.getBoundingClientRect().width
        const rectH =
            cr?.height ||
            container.clientHeight ||
            container.getBoundingClientRect().height
        const cssW = Math.max(1, Math.floor(rectW) || 600)
        const cssH = Math.max(1, Math.floor(rectH) || 400)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        canvas.width = Math.floor(cssW * dpr)
        canvas.height = Math.floor(cssH * dpr)
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${cssH}px`
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctxRef.current = ctx

        const gs = Math.max(1, propsRef.current.gridSize)
        const cols = Math.max(1, Math.ceil(cssW / gs))
        const rows = Math.max(1, Math.ceil(cssH / gs))
        // Cells span evenly so the whole CSS area is covered with no gaps even
        // when cssW/cssH aren't exact multiples of gridSize.
        const cellW = cssW / cols
        const cellH = cssH / rows

        // Edge Noise is authored as a whole-number percent (0–100); convert to
        // the 0..1 fraction the frontier math expects.
        const eh = Math.max(0, Math.min(1, propsRef.current.edgeHeight / 100))
        const dir = propsRef.current.direction
        const thresholds = new Float32Array(cols * rows)

        // Direction convention:
        //  - "up"   : sweep travels upward → bottom dissolves first (base small for high r)
        //  - "down" : sweep travels downward → top dissolves first (base small for low r)
        //  - "left" : sweep travels leftward → right dissolves first
        //  - "right": sweep travels rightward → left dissolves first
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let base: number
                if (dir === "up") {
                    base = rows === 1 ? 0 : 1 - r / (rows - 1)
                } else if (dir === "down") {
                    base = rows === 1 ? 0 : r / (rows - 1)
                } else if (dir === "left") {
                    base = cols === 1 ? 0 : 1 - c / (cols - 1)
                } else {
                    base = cols === 1 ? 0 : c / (cols - 1)
                }
                // Scale base into [0, 1 - edgeHeight] then add noise in
                // [0, edgeHeight] so thresholds stay within [0, 1] but cells
                // near the frontier randomly mix in.
                const threshold = base * (1 - eh) + Math.random() * eh
                thresholds[r * cols + c] = threshold
            }
        }

        gridRef.current = { cols, rows, cellW, cellH, cssW, cssH, thresholds }
    }

    // Redraw cover cells whose threshold is still > current eased progress.
    const draw = () => {
        const ctx = ctxRef.current
        const grid = gridRef.current
        if (!ctx || !grid) return

        const { cols, rows, cellW, cellH, cssW, cssH, thresholds } = grid
        ctx.clearRect(0, 0, cssW, cssH)
        ctx.fillStyle = propsRef.current.transitionColor

        const p = progressRef.current
        // Tiny overlap between adjacent cells eliminates sub-pixel seams when
        // cellW/cellH aren't integers.
        const padW = cellW + 1
        const padH = cellH + 1

        for (let r = 0; r < rows; r++) {
            const yBase = r * cellH
            const rowOff = r * cols
            for (let c = 0; c < cols; c++) {
                if (thresholds[rowOff + c] > p) {
                    ctx.fillRect(c * cellW, yBase, padW, padH)
                }
            }
        }
    }

    const stopRaf = () => {
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        runningRef.current = false
    }

    const loop = (now: number) => {
        if (!runningRef.current) return
        const dur = Math.max(
            0.0001,
            resolveDuration(propsRef.current.transition)
        )
        const easeFn = resolveEasingFn(propsRef.current.transition)
        if (startTimeRef.current == null) {
            startTimeRef.current = now
        }
        const elapsed = (now - startTimeRef.current) / 1000
        const linear = Math.max(0, Math.min(1, elapsed / dur))
        linearProgressRef.current = linear
        progressRef.current = easeFn(linear)
        draw()

        if (linear >= 1) {
            stopRaf()
            if (!completedRef.current) {
                completedRef.current = true
                propsRef.current.onRevealComplete?.()
            }
            return
        }
        rafRef.current = requestAnimationFrame(loop)
    }

    const startRaf = () => {
        if (runningRef.current) return
        if (isStatic) {
            // On the canvas / static export, jump straight to the reveal so the
            // image is visible instead of permanently covered.
            progressRef.current = 1
            linearProgressRef.current = 1
            draw()
            return
        }
        runningRef.current = true
        // Anchor the timeline at "now - already-elapsed" so a resume after a
        // partial run picks up where it left off rather than starting over.
        const dur = Math.max(
            0.0001,
            resolveDuration(propsRef.current.transition)
        )
        const offsetMs = linearProgressRef.current * dur * 1000
        startTimeRef.current = performance.now() - offsetMs
        rafRef.current = requestAnimationFrame(loop)
    }

    // Internal trigger: reset to zero and start the reveal from scratch. Fired
    // once by the IntersectionObserver when the component scrolls into view.
    const triggerFn = () => {
        completedRef.current = false
        stopRaf()
        progressRef.current = 0
        linearProgressRef.current = 0
        startTimeRef.current = null
        draw()
        startRaf()
    }

    // Build the grid synchronously after layout so the initial paint already
    // shows the cover, not a flash of bare image.
    useLayoutEffect(() => {
        // On the canvas / static export jump straight to fully revealed so the
        // image shows with no cover (the reveal animation only runs live).
        if (isStatic) {
            progressRef.current = 1
            linearProgressRef.current = 1
        }
        rebuildGrid()
        draw()
        const container = containerRef.current
        if (!container) return
        const ro = new ResizeObserver((entries) => {
            rebuildGrid(entries[0])
            draw()
        })
        ro.observe(container)
        return () => ro.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // When grid-shape inputs change, rebuild and redraw at current progress.
    useLayoutEffect(() => {
        rebuildGrid()
        draw()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gridSize, edgeHeight, direction])

    // When the transition color changes, just redraw — grid is unaffected.
    useEffect(() => {
        draw()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transitionColor])

    // Auto-trigger: play the reveal once when the component scrolls into view.
    useEffect(() => {
        if (isStatic) return
        const container = containerRef.current
        if (!container) return

        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        if (triggeredOnceRef.current) continue
                        triggeredOnceRef.current = true
                        triggerFn()
                    }
                }
            },
            { threshold: 0 }
        )
        io.observe(container)
        return () => io.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStatic])

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                ...style,
            }}
        >
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        userSelect: "none",
                        pointerEvents: "none",
                    }}
                />
            ) : null}
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

// ---- Types ------------------------------------------------------------------

type Direction = "up" | "down" | "left" | "right"

type Props = {
    imageSrc: string
    gridSize: number
    transitionColor: string
    edgeHeight: number
    transition: {
        type?: "tween" | "spring"
        duration?: number
        ease?: string | number[]
        [key: string]: unknown
    }
    direction: Direction
    onRevealComplete?: () => void
    style?: React.CSSProperties
}

const COMPONENT_DEFAULTS = {
    imageSrc:
        "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/aeaa0756-9647-4f6c-d900-204bd25e4a00/w=800",
    gridSize: 15,
    transitionColor: "#FFFFFF",
    edgeHeight: 10,
    transition: { type: "tween", duration: 2, ease: "easeInOut" },
    direction: "up",
}

