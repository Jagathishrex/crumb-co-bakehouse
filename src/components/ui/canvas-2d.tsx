import * as React from "react"
import { cn } from "cn"

// A 2D canvas you only have to paint. Canvas2D keeps the picture sharp on high-density screens (devicePixelRatio),
// re-sizes with the element, runs the animation loop and cleans it up, and draws a single still frame when
// animate={false} or the viewer prefers reduced motion — so a screen writes just its draw function.

export type CanvasEnv = {
  /** The 2D context, already scaled so you draw in CSS pixels. */
  ctx: CanvasRenderingContext2D
  /** The canvas size in CSS pixels (not device pixels). */
  width: number
  height: number
  /** Seconds since the canvas mounted; 0 while the picture is held still. */
  time: number
  /** The screen's pixel ratio, if a draw needs it. */
  dpr: number
}

type Canvas2DProps = Omit<React.ComponentProps<"canvas">, "children"> & {
  /** Paint one frame. Called with the context already scaled to CSS pixels; keep it pure (read props/refs, draw, return nothing). */
  draw: (env: CanvasEnv) => void
  /** false holds a single still frame (also forced when the viewer prefers reduced motion). Default true. */
  animate?: boolean
}

function Canvas2D({ draw, animate = true, className, ...props }: Canvas2DProps) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  // Keep the latest draw in a ref so a new one repaints without restarting the loop.
  const drawRef = React.useRef(draw)
  React.useEffect(() => {
    drawRef.current = draw
  })
  const repaint = React.useRef(() => {})

  React.useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let width = 0
    let height = 0
    let dpr = 1
    let raf = 0
    const started = performance.now()
    const still = !animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Size the backing store to the device's pixels, then draw in CSS pixels. Setting width/height clears the
    // canvas, so this runs on mount and resize only, never inside a frame.
    const size = () => {
      const box = canvas.getBoundingClientRect()
      dpr = window.devicePixelRatio || 1
      width = box.width
      height = box.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const paint = (now: number) => drawRef.current({ ctx, width, height, time: still ? 0 : (now - started) / 1000, dpr })
    repaint.current = () => paint(performance.now())

    size()
    const observer = new ResizeObserver(() => {
      size()
      if (still) paint(performance.now())
    })
    observer.observe(canvas)

    if (still) {
      paint(performance.now())
    } else {
      const loop = (now: number) => {
        paint(now)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      repaint.current = () => {}
    }
  }, [animate])

  // A still canvas repaints when its drawing inputs change; an animating one already paints every frame.
  React.useEffect(() => {
    repaint.current()
  })

  return <canvas ref={ref} aria-hidden data-slot="canvas-2d" className={cn("block size-full", className)} {...props} />
}

export { Canvas2D }
