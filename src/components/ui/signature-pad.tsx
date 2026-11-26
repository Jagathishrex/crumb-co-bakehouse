import * as React from "react"
import SignaturePadLib from "signature_pad"
import { cn } from "cn"

// A signature box (signature_pad): sign with the mouse, a finger or a pen; smooth strokes, and Clear to start again.

function SignaturePad({
  penColor = "#111827",
  penWidth = 2,
  label = "Sign here",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  penColor?: string
  penWidth?: number
  label?: string
}) {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const pad = React.useRef<SignaturePadLib | null>(null)
  const [empty, setEmpty] = React.useState(true)
  React.useEffect(() => {
    const element = canvas.current
    if (!element) return
    // Sharp on high-density screens: the canvas is drawn at the screen's pixel ratio.
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    element.width = element.offsetWidth * ratio
    element.height = element.offsetHeight * ratio
    element.getContext("2d")?.scale(ratio, ratio)
    const instance = new SignaturePadLib(element, { penColor, minWidth: penWidth * 0.5, maxWidth: penWidth * 1.5 })
    instance.addEventListener("endStroke", () => setEmpty(instance.isEmpty()))
    pad.current = instance
    return () => instance.off()
  }, [penColor, penWidth])
  return (
    <div data-slot="signature-pad" className={cn("flex w-96 flex-col gap-2", className)} {...props}>
      <div className="relative h-40 overflow-hidden rounded-xl border bg-background">
        <canvas ref={canvas} className="size-full touch-none" />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{label}</span>}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed" />
      </div>
      <button
        type="button"
        onClick={() => {
          pad.current?.clear()
          setEmpty(true)
        }}
        className="self-end text-xs text-muted-foreground hover:text-foreground"
      >
        Clear
      </button>
    </div>
  )
}

export { SignaturePad }
