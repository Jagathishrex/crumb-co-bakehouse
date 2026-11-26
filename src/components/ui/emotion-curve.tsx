import * as React from "react"

// A journey map's emotion curve: a smooth line through the feelings ([data-emotion], one per stage) of the lane it sits
// in, drawn from where they really are, so it follows a feeling raised or lowered, a stage added or the map moved.

export function EmotionCurve({ style, ...props }: React.SVGProps<SVGSVGElement>) {
  const ref = React.useRef<SVGSVGElement>(null)
  const [d, setD] = React.useState("")

  React.useLayoutEffect(() => {
    const svg = ref.current
    const lane = svg?.parentElement
    if (!svg || !lane) return
    let frame = 0
    const measure = () => {
      const base = lane.getBoundingClientRect()
      const points = [...lane.querySelectorAll<HTMLElement>("[data-emotion]")].map((point) => {
        const rect = point.getBoundingClientRect()
        return { x: rect.left + rect.width / 2 - base.left, y: rect.top + rect.height / 2 - base.top }
      })
      if (points.length < 2) return setD("")
      // Catmull-Rom through the points, as cubic Béziers.
      let path = `M ${points[0].x} ${points[0].y}`
      for (let index = 0; index < points.length - 1; index++) {
        const p0 = points[index - 1] ?? points[index]
        const p1 = points[index]
        const p2 = points[index + 1]
        const p3 = points[index + 2] ?? p2
        path += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`
      }
      setD((previous) => (previous === path ? previous : path))
    }
    const later = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const changes = new MutationObserver((records) => {
      if (records.some((record) => !svg.contains(record.target))) later()
    })
    changes.observe(lane, { attributes: true, childList: true, subtree: true, characterData: true })
    const sizes = new ResizeObserver(later)
    sizes.observe(lane)
    return () => {
      cancelAnimationFrame(frame)
      changes.disconnect()
      sizes.disconnect()
    }
  }, [])

  return (
    <svg ref={ref} {...props} style={{ ...style, position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 1 }} aria-hidden="true">
      {d && <path d={d} fill="none" stroke="#8b5cf6" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 7" />}
      {d && <path d={d} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeLinecap="round" opacity={0.5} />}
    </svg>
  )
}
