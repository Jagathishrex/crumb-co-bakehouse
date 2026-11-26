import * as React from "react"
import rough from "roughjs"
import type { Options } from "roughjs/bin/core"
import { cn } from "cn"
import { continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from "@/lib/video"

// Hand-drawn shapes (rough.js) as real SVG paths. A fixed seed draws the same wobble every time; in a video, boil
// redraws it a few times a second and draw makes it draw itself, both on the frame clock so exports match.

export type SketchFill = "none" | "hachure" | "solid" | "zigzag" | "cross-hatch" | "dots" | "dashed" | "zigzag-line"
export type SketchShape = "rectangle" | "ellipse" | "underline" | "circle-around" | "arrow"

type SketchLook = {
  /** Outline colour (any CSS colour); empty takes the text colour. */
  color?: string
  /** Fill colour; empty takes the theme's primary. */
  fillColor?: string
  fill?: SketchFill
  roughness?: number
  bowing?: number
  strokeWidth?: number
  /** Gap between hatch lines, px. */
  gap?: number
  angle?: number
  seed?: number
  /** Redraws a second in a video (8 is classic hand-drawn animation); 0 holds still. */
  boil?: number
  /** Seconds it takes to draw itself in a video, from `at`; 0 shows it at once. */
  draw?: number
  at?: number
}

const generator = rough.generator()

let handFont: Promise<void> | null = null

/** Loads Caveat (public/fonts, OFL) once, for text written with font-[Caveat,cursive]; a video frame waits for it. */
function useHandFont() {
  React.useLayoutEffect(() => {
    if (handFont || typeof FontFace === "undefined") return
    const handle = delayRender("Caveat font")
    handFont = new FontFace("Caveat", "url(/fonts/caveat.woff2)", { weight: "400 700" })
      .load()
      .then((face) => void document.fonts.add(face))
      .catch(() => undefined)
      .finally(() => continueRender(handle))
  }, [])
}

function useSketchSeed(seed: number, boil: number): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return boil > 0 ? seed + Math.floor((frame * boil) / fps) : seed
}

function useDrawn(draw: number, at: number): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return draw > 0 ? interpolate(frame, [at * fps, (at + draw) * fps], [0, 1]) : 1
}

function drawShape(shape: SketchShape, width: number, height: number, pad: number, options: Options) {
  const w = width + pad * 2
  const h = height + pad * 2
  const line = { ...options, fill: undefined }
  if (shape === "ellipse") return [generator.ellipse(w / 2, h / 2, w - 4, h - 4, options)]
  if (shape === "circle-around") return [generator.ellipse(w / 2, h / 2, w * 1.08, h * 1.25, line)]
  if (shape === "underline")
    return [
      generator.curve(
        [
          [pad, h - pad / 2],
          [w * 0.4, h - pad / 2 - 3],
          [w - pad, h - pad / 2 + 2],
        ],
        line,
      ),
    ]
  if (shape === "arrow") {
    const head = Math.min(18, w / 4)
    return [
      generator.curve(
        [
          [2, h - 2],
          [w * 0.35, h * 0.2],
          [w - 2, 2],
        ],
        line,
      ),
      generator.linearPath(
        [
          [w - 2 - head, 4],
          [w - 2, 2],
          [w - 6, 2 + head],
        ],
        line,
      ),
    ]
  }
  return [generator.rectangle(2, 2, w - 4, h - 4, options)]
}

type Stroke = { kind: "path" | "fillPath" | "fillSketch"; d: string; rank: number }

/** One SVG path per stroke, ranked in drawing order: the outline (both passes of a line together), then the hatching. */
function strokesOf(shape: SketchShape, width: number, height: number, pad: number, options: Options): { strokes: Stroke[]; steps: number } {
  const sets = drawShape(shape, width, height, pad, options).flatMap((drawable) => drawable.sets)
  const strokes: Stroke[] = []
  let rank = 0
  for (const kind of ["path", "fillSketch"] as const) {
    for (const set of sets.filter((entry) => entry.type === kind)) {
      const parts = generator.opsToPath(set, 2).split(/(?=M)/)
      const passes = kind === "path" && parts.length % 2 === 0 ? 2 : 1
      parts.forEach((d, index) => strokes.push({ kind, d, rank: rank + Math.floor(index / passes) }))
      rank += Math.ceil(parts.length / passes)
    }
  }
  for (const set of sets.filter((entry) => entry.type === "fillPath")) strokes.unshift({ kind: "fillPath", d: generator.opsToPath(set, 2), rank: 0 })
  return { strokes, steps: Math.max(1, rank) }
}

/** A hand-drawn box, ellipse, underline, ring or arrow around (or under) its children, sized to them. */
function Sketch({
  shape = "rectangle",
  color = "",
  fillColor = "",
  fill = "none",
  roughness = 1.4,
  bowing = 1,
  strokeWidth = 2,
  gap = 8,
  angle = -41,
  seed = 1,
  boil = 0,
  draw = 0,
  at = 0,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & SketchLook & { shape?: SketchShape }) {
  useHandFont()
  const box = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
  React.useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setSize((was) => (was && was.width === element.offsetWidth && was.height === element.offsetHeight ? was : { width: element.offsetWidth, height: element.offsetHeight }))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const drawSeed = useSketchSeed(seed, boil)
  const drawn = useDrawn(draw, at)
  const pad = strokeWidth * 3
  const { strokes, steps } = React.useMemo(() => {
    if (!size) return { strokes: [], steps: 1 }
    const options: Options = {
      roughness,
      bowing,
      strokeWidth,
      seed: Math.max(1, Math.round(drawSeed)),
      stroke: "currentColor",
      fill: fill === "none" ? undefined : "currentColor",
      fillStyle: fill === "none" ? undefined : fill,
      hachureGap: Math.max(2, gap),
      hachureAngle: angle,
      fillWeight: Math.max(1, strokeWidth * 0.6),
    }
    return strokesOf(shape, size.width, size.height, pad, options)
  }, [size, shape, roughness, bowing, strokeWidth, drawSeed, fill, gap, angle, pad])
  const shown = (rank: number) => Math.min(1, Math.max(0, drawn * steps - rank))
  const behind = shape === "rectangle" || shape === "ellipse"
  return (
    <div ref={box} data-slot="sketch" className={cn("relative isolate inline-block", className)} {...props}>
      {size && (
        <svg aria-hidden className={cn("pointer-events-none absolute overflow-visible", behind ? "-z-10" : "z-10")} style={{ left: -pad, top: -pad, width: size.width + pad * 2, height: size.height + pad * 2 }}>
          {strokes.map((stroke, index) => (
            <path
              key={index}
              d={stroke.d}
              pathLength={1}
              fill={stroke.kind === "fillPath" ? "currentColor" : "none"}
              stroke={stroke.kind === "fillPath" ? "none" : "currentColor"}
              strokeWidth={stroke.kind === "fillSketch" ? Math.max(1, strokeWidth * 0.6) : strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: stroke.kind === "path" ? color || undefined : fillColor || "var(--primary)",
                // Hidden until it starts: a round cap would leave a dot.
                ...(drawn < 1 ? (stroke.kind === "fillPath" ? { opacity: drawn } : { strokeDasharray: 1, strokeDashoffset: 1 - shown(stroke.rank), opacity: shown(stroke.rank) > 0 ? 1 : 0 }) : {}),
              }}
            />
          ))}
        </svg>
      )}
      {children}
    </div>
  )
}

/** Hand-drawn bars from rows ({ label, value }), hatched; in a video they draw one after another. */
function SketchBars({
  data,
  max,
  color = "",
  fillColor = "",
  fill = "hachure",
  roughness = 1.4,
  strokeWidth = 2,
  gap = 8,
  seed = 1,
  boil = 0,
  draw = 0,
  at = 0,
  stagger = 0.25,
  labelClassName,
  className,
  ...props
}: React.ComponentProps<"div"> & Omit<SketchLook, "bowing" | "angle"> & { data: { label: string; value: number }[]; max?: number; stagger?: number; labelClassName?: string }) {
  const top = max ?? Math.max(1, ...data.map((row) => Number(row.value) || 0))
  return (
    <div data-slot="sketch-bars" className={cn("flex h-64 items-end gap-6", className)} {...props}>
      {data.map((row, index) => (
        <div key={`${row.label} ${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <Sketch
            color={color}
            fillColor={fillColor}
            fill={fill}
            roughness={roughness}
            strokeWidth={strokeWidth}
            gap={gap}
            seed={seed + index * 7}
            boil={boil}
            draw={draw}
            at={at + index * stagger}
            className="w-full"
            style={{ height: `${((Number(row.value) || 0) / top) * 85}%` }}
          />
          <span className={cn("font-[Caveat,cursive] text-2xl", labelClassName)}>{row.label}</span>
        </div>
      ))}
    </div>
  )
}

export { Sketch, SketchBars }
