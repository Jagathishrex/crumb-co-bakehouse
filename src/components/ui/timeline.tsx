import * as React from "react"

// A whiteboard timeline, after Miro's Timeline: a date scale (day, week, month or quarter), lanes, and bars placed by
// their dates. Bars in a lane that overlap stack into rows of their own; a red line marks today. Dates are the code
// (start / end on each bar, "2026-11-04"), so dragging a bar or its ends in Kalai changes them.

type Scale = "day" | "week" | "month" | "quarter"

/** How wide one day is at each scale, in px. */
const kDayWidth: Record<Scale, number> = { day: 44, week: 18, month: 5, quarter: 1.8 }
const kDay = 86_400_000

interface TimelineContextValue {
  start: number
  dayWidth: number
  days: number
}
const TimelineContext = React.createContext<TimelineContextValue>({ start: 0, dayWidth: 18, days: 56 })

function parse(date: string | undefined, fallback: number): number {
  const time = date ? Date.parse(`${date}T00:00:00`) : NaN
  return Number.isNaN(time) ? fallback : time
}

function label(time: number, scale: Scale): string {
  const date = new Date(time)
  if (scale === "day") return date.toLocaleDateString("en", { weekday: "short", day: "numeric" })
  if (scale === "week") return date.toLocaleDateString("en", { month: "short", day: "numeric" })
  if (scale === "month") return date.toLocaleDateString("en", { month: "short", year: "numeric" })
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
}

/** The scale's ticks: every day, every Monday, the first of every month, or of every quarter. */
function ticks(start: number, days: number, scale: Scale): number[] {
  const out: number[] = []
  for (let day = 0; day <= days; day++) {
    const date = new Date(start + day * kDay)
    const tick =
      scale === "day" ||
      (scale === "week" && date.getDay() === 1) ||
      (scale === "month" && date.getDate() === 1) ||
      (scale === "quarter" && date.getDate() === 1 && date.getMonth() % 3 === 0)
    if (tick || day === 0) out.push(day)
  }
  return out
}

interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The first day shown, "2026-11-02". */
  start: string
  /** The last day shown. */
  end: string
  scale?: Scale
  title?: string
}

export function Timeline({ start, end, scale = "week", title, className, style, children, ...props }: TimelineProps) {
  const from = parse(start, Date.now())
  const days = Math.max(1, Math.round((parse(end, from + 55 * kDay) - from) / kDay) + 1)
  const dayWidth = kDayWidth[scale] ?? kDayWidth.week
  const width = days * dayWidth
  const marks = ticks(from, days, scale)
  const today = Math.floor((Date.now() - from) / kDay)
  return (
    <TimelineContext.Provider value={{ start: from, dayWidth, days }}>
      <div {...props} data-timeline-scale={scale} className={["inline-flex flex-col rounded-[20px] border border-[#e5e5e5] bg-white p-6 text-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.06)]", className].filter(Boolean).join(" ")} style={style}>
        {title && <p className="mb-4 text-[24px] font-bold">{title}</p>}
        <div className="flex">
          <div className="w-[160px] shrink-0" />
          <div className="relative h-8 border-b border-[#e5e5e5]" style={{ width }}>
            {marks.map((day) => (
              <span key={day} className="absolute top-1 whitespace-nowrap pl-1.5 text-[12px] text-[#737373]" style={{ left: day * dayWidth }}>
                {label(from + day * kDay, scale)}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-[160px]" style={{ width }}>
            {marks.map((day) => (
              <span key={day} className="absolute inset-y-0 w-px bg-[#f0f0ee]" style={{ left: day * dayWidth }} />
            ))}
            {today >= 0 && today < days && <span className="absolute inset-y-0 z-10 w-0.5 bg-[#ef4444]" style={{ left: (today + 0.5) * dayWidth }} title="Today" />}
          </div>
          {children}
        </div>
      </div>
    </TimelineContext.Provider>
  )
}

interface LaneProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  color?: string
}

/** A lane: its name, then its bars, stacked into rows so none overlap. */
export function TimelineLane({ name, color = "#60a5fa", className, style, children, ...props }: LaneProps) {
  const { start, dayWidth, days } = React.useContext(TimelineContext)
  // Each bar gets the first row where it fits after the bars before it (by start date).
  const bars = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<BarProps>[]
  const ends: number[] = []
  const rows = bars.map((bar) => {
    const from = parse(bar.props.start, start)
    const to = Math.max(from, parse(bar.props.end, from))
    let row = ends.findIndex((last) => last < from)
    if (row === -1) row = ends.length
    ends[row] = to
    return row
  })
  const height = Math.max(1, ends.length) * 44 + 12
  return (
    <div {...props} data-timeline-lane="" className={["flex border-b border-[#f0f0ee] last:border-b-0", className].filter(Boolean).join(" ")} style={{ ...style, ["--lane" as string]: color }}>
      <div className="flex w-[160px] shrink-0 items-start gap-2 py-4 pr-3">
        <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="text-[14px] font-semibold">{name}</span>
      </div>
      <div className="relative" style={{ width: days * dayWidth, height }}>
        {bars.map((bar, index) => React.cloneElement(bar, { key: bar.key ?? index, row: rows[index] } as Partial<BarProps>))}
      </div>
    </div>
  )
}

interface BarProps extends React.HTMLAttributes<HTMLDivElement> {
  start: string
  end: string
  /** Set by its lane: which stacked row it sits in. */
  row?: number
  done?: boolean
}

/** A bar from its start day to its end day (both included). */
export function TimelineBar({ start, end, row = 0, done, className, style, children, ...props }: BarProps) {
  const timeline = React.useContext(TimelineContext)
  const from = Math.round((parse(start, timeline.start) - timeline.start) / kDay)
  const to = Math.max(from, Math.round((parse(end, timeline.start) - timeline.start) / kDay))
  return (
    <div
      {...props}
      data-timeline-bar=""
      data-day-width={timeline.dayWidth}
      className={["absolute flex h-9 items-center overflow-hidden whitespace-nowrap rounded-[8px] border-[1.5px] border-[var(--lane)] bg-[color-mix(in_srgb,var(--lane)_22%,white)] px-3 text-[13px] font-medium text-[#1a1a1a]", done ? "opacity-60 line-through" : "", className].filter(Boolean).join(" ")}
      style={{ ...style, left: from * timeline.dayWidth, top: 6 + row * 44, width: (to - from + 1) * timeline.dayWidth - 2 }}
    >
      {children}
    </div>
  )
}
