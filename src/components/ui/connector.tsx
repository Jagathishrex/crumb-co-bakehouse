import * as React from "react"

// A whiteboard line between two elements, as Miro's connectors: `from` and `to` are the elements' data-nid (or
// data-board-id). It finds both on the page, leaves from the sides that face each other and redraws whenever either
// moves or changes size, so it follows them without the code changing.

type Side = "auto" | "top" | "right" | "bottom" | "left"
type Cap = "none" | "arrow" | "open" | "dot" | "diamond"

interface ConnectorProps extends Omit<React.SVGProps<SVGSVGElement>, "from" | "to"> {
  from: string
  to: string
  shape?: "curved" | "elbowed" | "straight"
  fromSide?: Side
  toSide?: Side
  startCap?: Cap
  endCap?: Cap
  color?: string
  width?: number
  dashed?: boolean
  label?: string
}

type Point = { x: number; y: number }
type Box = { x: number; y: number; width: number; height: number }

interface Geometry {
  box: Box
  d: string
  start: Point
  end: Point
  /** Which way the line leaves its start and arrives at its end (unit vectors), for the caps. */
  startDir: Point
  endDir: Point
  middle: Point
}

const kNormals: Record<Exclude<Side, "auto">, Point> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } }

function find(id: string): Element | null {
  if (!id) return null
  const safe = id.replace(/["\\]/g, "")
  return document.querySelector(`[data-nid="${safe}"], [data-board-id="${safe}"]`)
}

function sidePoint(box: Box, side: Exclude<Side, "auto">): Point {
  if (side === "top") return { x: box.x + box.width / 2, y: box.y }
  if (side === "bottom") return { x: box.x + box.width / 2, y: box.y + box.height }
  if (side === "left") return { x: box.x, y: box.y + box.height / 2 }
  return { x: box.x + box.width, y: box.y + box.height / 2 }
}

/** The sides that face each other: across when the two are further apart sideways, else up and down. */
function facing(a: Box, b: Box): [Exclude<Side, "auto">, Exclude<Side, "auto">] {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2)
  const dy = b.y + b.height / 2 - (a.y + a.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"]
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"]
}

function unit(point: Point): Point {
  const length = Math.hypot(point.x, point.y) || 1
  return { x: point.x / length, y: point.y / length }
}

function geometry(a: Box, b: Box, shape: ConnectorProps["shape"], fromSide: Side, toSide: Side): Geometry {
  const [autoFrom, autoTo] = facing(a, b)
  const sideA = fromSide === "auto" ? autoFrom : fromSide
  const sideB = toSide === "auto" ? autoTo : toSide
  const start = sidePoint(a, sideA)
  const end = sidePoint(b, sideB)
  const na = kNormals[sideA]
  const nb = kNormals[sideB]
  let d: string
  let points: Point[]
  let startDir = na
  let endDir = { x: -nb.x, y: -nb.y }
  let middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  if (shape === "straight") {
    d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`
    points = [start, end]
    startDir = endDir = unit({ x: end.x - start.x, y: end.y - start.y })
  } else if (shape === "elbowed") {
    // Out of the start's side, across halfway, into the end's side.
    const across = na.x !== 0
    const corner1 = across ? { x: middle.x, y: start.y } : { x: start.x, y: middle.y }
    const corner2 = across ? { x: middle.x, y: end.y } : { x: end.x, y: middle.y }
    points = [start, corner1, corner2, end]
    d = `M ${start.x} ${start.y} L ${corner1.x} ${corner1.y} L ${corner2.x} ${corner2.y} L ${end.x} ${end.y}`
    endDir = unit({ x: end.x - corner2.x, y: end.y - corner2.y })
    startDir = unit({ x: corner1.x - start.x, y: corner1.y - start.y })
  } else {
    const reach = Math.max(40, Math.hypot(end.x - start.x, end.y - start.y) / 2.5)
    const c1 = { x: start.x + na.x * reach, y: start.y + na.y * reach }
    const c2 = { x: end.x + nb.x * reach, y: end.y + nb.y * reach }
    points = [start, c1, c2, end]
    d = `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`
    middle = { x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8, y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8 }
  }
  const pad = 24
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + pad * 2, height: Math.max(...ys) - Math.min(...ys) + pad * 2 }
  return { box, d, start, end, startDir, endDir, middle }
}

/** An end cap at `tip`, pointing along `dir`. */
function cap(kind: Cap, tip: Point, dir: Point, size: number, color: string): React.ReactNode {
  if (kind === "none") return null
  const back = { x: tip.x - dir.x * size, y: tip.y - dir.y * size }
  const side = { x: -dir.y * size * 0.55, y: dir.x * size * 0.55 }
  if (kind === "dot") return <circle cx={tip.x - dir.x * size * 0.35} cy={tip.y - dir.y * size * 0.35} r={size * 0.35} fill={color} />
  if (kind === "diamond") {
    const middle = { x: tip.x - dir.x * size * 0.6, y: tip.y - dir.y * size * 0.6 }
    const far = { x: tip.x - dir.x * size * 1.2, y: tip.y - dir.y * size * 1.2 }
    return <path d={`M ${tip.x} ${tip.y} L ${middle.x + side.x} ${middle.y + side.y} L ${far.x} ${far.y} L ${middle.x - side.x} ${middle.y - side.y} Z`} fill={color} />
  }
  const d = `M ${back.x + side.x} ${back.y + side.y} L ${tip.x} ${tip.y} L ${back.x - side.x} ${back.y - side.y}`
  return kind === "open" ? <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : <path d={`${d} Z`} fill={color} />
}

function sameGeometry(a: Geometry | null, b: Geometry | null): boolean {
  return !!a && !!b && a.d === b.d && a.box.x === b.box.x && a.box.y === b.box.y && a.box.width === b.box.width && a.box.height === b.box.height
}

export function Connector({ from, to, shape = "curved", fromSide = "auto", toSide = "auto", startCap = "none", endCap = "arrow", color = "#1a1a1a", width = 2, dashed = false, label, style, ...props }: ConnectorProps) {
  const ref = React.useRef<SVGSVGElement>(null)
  const [geo, setGeo] = React.useState<Geometry | null>(null)

  React.useLayoutEffect(() => {
    const svg = ref.current
    const host = svg?.parentElement
    if (!svg || !host) return
    let frame = 0
    const measure = () => {
      const a = find(from)
      const b = find(to)
      if (!a || !b) return setGeo(null)
      const base = host.getBoundingClientRect()
      const boxOf = (element: Element): Box => {
        const rect = element.getBoundingClientRect()
        return { x: rect.left - base.left + host.scrollLeft, y: rect.top - base.top + host.scrollTop, width: rect.width, height: rect.height }
      }
      const next = geometry(boxOf(a), boxOf(b), shape, fromSide, toSide)
      setGeo((previous) => (sameGeometry(previous, next) ? previous : next))
    }
    const later = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    // Anything else on the board moving or changing (an edit, a drag preview, text typed) may move an end.
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => !svg.contains(record.target))) later()
    })
    mutations.observe(host, { attributes: true, childList: true, subtree: true, characterData: true })
    const sizes = new ResizeObserver(later)
    sizes.observe(host)
    for (const end of [find(from), find(to)]) if (end) sizes.observe(end)
    window.addEventListener("resize", later)
    return () => {
      cancelAnimationFrame(frame)
      mutations.disconnect()
      sizes.disconnect()
      window.removeEventListener("resize", later)
    }
  }, [from, to, shape, fromSide, toSide])

  const box = geo?.box ?? { x: 0, y: 0, width: 0, height: 0 }
  const capSize = 8 + width * 2
  // The line stops short of a cap so its end does not poke through the arrowhead.
  return (
    <svg
      ref={ref}
      {...props}
      viewBox={`${box.x} ${box.y} ${Math.max(1, box.width)} ${Math.max(1, box.height)}`}
      style={{ ...style, position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height, overflow: "visible", pointerEvents: "none" }}
      aria-hidden="true"
    >
      {geo && (
        <>
          <path d={geo.d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: "stroke" }} />
          <path d={geo.d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dashed ? `${width * 4} ${width * 3}` : undefined} strokeLinecap="round" strokeLinejoin="round" />
          {cap(endCap, geo.end, geo.endDir, capSize, color)}
          {cap(startCap, geo.start, { x: -geo.startDir.x, y: -geo.startDir.y }, capSize, color)}
          {label && (
            <text x={geo.middle.x} y={geo.middle.y} textAnchor="middle" dominantBaseline="central" fontSize={14} fill={color} stroke="#ffffff" strokeWidth={5} paintOrder="stroke" style={{ pointerEvents: "stroke" }}>
              {label}
            </text>
          )}
        </>
      )}
    </svg>
  )
}
