import * as React from "react"

// The branches of a whiteboard mind map, drawn from where its nodes really are. A map is nested auto layout: each
// branch is its node ([data-board-node]) followed by a "Branches" column of child branches. This draws a curve from
// every node to each of its children, in the child's branch colour (--branch), and redraws when anything in the map
// moves, so the lines follow edits, typing and drags. A branch laid out as a column (an org chart) joins bottom to top.

type Line = { d: string; color: string }

export function MindMapLines({ style, ...props }: React.SVGProps<SVGSVGElement>) {
  const ref = React.useRef<SVGSVGElement>(null)
  const [lines, setLines] = React.useState<Line[]>([])

  React.useLayoutEffect(() => {
    const svg = ref.current
    const map = svg?.parentElement
    if (!svg || !map) return
    let frame = 0
    const measure = () => {
      const base = map.getBoundingClientRect()
      const next: Line[] = []
      for (const node of map.querySelectorAll<HTMLElement>("[data-board-node]")) {
        const branch = node.parentElement
        const column = node.nextElementSibling
        if (!branch || !column?.getAttribute("data-name")?.startsWith("Branches")) continue
        const down = getComputedStyle(branch).flexDirection.startsWith("column")
        const from = node.getBoundingClientRect()
        for (const child of column.children) {
          const childNode = child.querySelector<HTMLElement>(":scope > [data-board-node]")
          if (!childNode) continue
          const to = childNode.getBoundingClientRect()
          const color = getComputedStyle(child).getPropertyValue("--branch").trim() || "#a3a3a3"
          if (down) {
            const x1 = from.left + from.width / 2 - base.left
            const y1 = from.bottom - base.top
            const x2 = to.left + to.width / 2 - base.left
            const y2 = to.top - base.top
            const bend = (y2 - y1) / 2
            next.push({ d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`, color })
          } else {
            const x1 = from.right - base.left
            const y1 = from.top + from.height / 2 - base.top
            const x2 = to.left - base.left
            const y2 = to.top + to.height / 2 - base.top
            const bend = (x2 - x1) / 2
            next.push({ d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`, color })
          }
        }
      }
      setLines((previous) => (previous.length === next.length && previous.every((line, index) => line.d === next[index].d && line.color === next[index].color) ? previous : next))
    }
    const later = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const changes = new MutationObserver((records) => {
      if (records.some((record) => !svg.contains(record.target))) later()
    })
    changes.observe(map, { attributes: true, childList: true, subtree: true, characterData: true })
    const sizes = new ResizeObserver(later)
    sizes.observe(map)
    window.addEventListener("resize", later)
    return () => {
      cancelAnimationFrame(frame)
      changes.disconnect()
      sizes.disconnect()
      window.removeEventListener("resize", later)
    }
  }, [])

  return (
    <svg ref={ref} {...props} style={{ ...style, position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }} aria-hidden="true">
      {lines.map((line, index) => (
        <path key={index} d={line.d} fill="none" stroke={line.color} strokeWidth={2} strokeLinecap="round" />
      ))}
    </svg>
  )
}
