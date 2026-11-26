import * as React from "react"
import { DayPicker, type DateRange } from "react-day-picker"
import "react-day-picker/style.css"
import { cn } from "cn"

// A calendar / date picker (react-day-picker, as shadcn's calendar): one date or a range, picked dates as
// "2026-11-06", in the theme's colours.

function dayOf(text?: string): Date | undefined {
  if (!text) return undefined
  const [year, month, day] = text.split("-").map(Number)
  return year && month && day ? new Date(year, month - 1, day) : undefined
}

function CalendarBlock({
  mode = "single",
  selected,
  to,
  months = 1,
  weekStartsOn = 1,
  outsideDays = true,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "onSelect"> & {
  mode?: "single" | "range"
  selected?: string
  to?: string
  months?: number
  weekStartsOn?: 0 | 1
  outsideDays?: boolean
}) {
  const from = dayOf(selected)
  const end = dayOf(to)
  const [day, setDay] = React.useState<Date | undefined>(from)
  const [range, setRange] = React.useState<DateRange | undefined>(from ? { from, to: end } : undefined)
  // A new prop starts it again while rendering, so no frame shows the old value (an effect would paint one).
  const [seen, setSeen] = React.useState({ selected, to })
  if (seen.selected !== selected || seen.to !== to) {
    setSeen({ selected, to })
    setDay(from)
    setRange(from ? { from, to: end } : undefined)
  }
  const theme = {
    "--rdp-accent-color": "var(--primary)",
    "--rdp-accent-background-color": "var(--accent)",
    "--rdp-today-color": "var(--primary)",
    "--rdp-range_middle-background-color": "var(--accent)",
    "--rdp-range_middle-color": "var(--accent-foreground)",
    "--rdp-day-height": "2.25rem",
    "--rdp-day-width": "2.25rem",
    "--rdp-day_button-height": "2.125rem",
    "--rdp-day_button-width": "2.125rem",
    ...style,
  } as React.CSSProperties
  const shared = {
    numberOfMonths: Math.max(1, Math.min(3, months)),
    weekStartsOn,
    showOutsideDays: outsideDays,
    defaultMonth: from,
  }

  return (
    <div data-slot="calendar" className={cn("w-fit rounded-xl border bg-background p-3 text-sm text-foreground", className)} style={theme} {...props}>
      {mode === "range" ? <DayPicker mode="range" selected={range} onSelect={setRange} {...shared} /> : <DayPicker mode="single" selected={day} onSelect={setDay} {...shared} />}
    </div>
  )
}

export { CalendarBlock }
