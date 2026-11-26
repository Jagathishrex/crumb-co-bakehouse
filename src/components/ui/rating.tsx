import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "cn"

// A star rating: `value` of `max` stars (halves shown), picked by clicking unless it only shows a score.

function Rating({
  value = 4,
  max = 5,
  size = 20,
  readOnly = false,
  showValue = false,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value?: number
  max?: number
  size?: number
  readOnly?: boolean
  showValue?: boolean
}) {
  const [picked, setPicked] = React.useState(value)
  const [hover, setHover] = React.useState<number | null>(null)
  // A new prop starts it again while rendering, so no frame shows the old value (an effect would paint one).
  const [seen, setSeen] = React.useState(value)
  if (seen !== value) {
    setSeen(value)
    setPicked(value)
  }
  const shown = hover ?? picked
  return (
    <div data-slot="rating" role={readOnly ? "img" : "radiogroup"} aria-label={`${picked} of ${max} stars`} className={cn("inline-flex items-center gap-0.5", className)} onMouseLeave={() => setHover(null)} {...props}>
      {Array.from({ length: Math.max(1, Math.round(max)) }, (_, index) => {
        const fill = Math.max(0, Math.min(1, shown - index))
        return (
          <button
            key={index}
            type="button"
            disabled={readOnly}
            aria-label={`${index + 1} star${index ? "s" : ""}`}
            onMouseEnter={() => !readOnly && setHover(index + 1)}
            onClick={() => setPicked(index + 1)}
            className="relative disabled:cursor-default"
            style={{ width: size, height: size }}
          >
            <Star className="absolute inset-0 size-full text-muted-foreground/30" fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-amber-400" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            </span>
          </button>
        )
      })}
      {showValue && <span className="ml-1.5 text-sm font-medium tabular-nums">{picked.toFixed(1)}</span>}
    </div>
  )
}

export { Rating }
