import * as React from "react"
import { cn } from "cn"

// A countdown to a date and time ("2026-12-31T23:59"): days, hours, minutes and seconds in boxes, and a message once
// it is reached. For launches, sales and events.

function partsUntil(target: number): { days: number; hours: number; minutes: number; seconds: number } | null {
  const left = Math.max(0, target - Date.now())
  if (!left) return null
  const seconds = Math.floor(left / 1000)
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 }
}

function Countdown({
  to = "2026-12-31T23:59",
  labels = true,
  showSeconds = true,
  doneText = "It's here!",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  to?: string
  labels?: boolean
  showSeconds?: boolean
  doneText?: string
}) {
  const target = React.useMemo(() => new Date(to).getTime(), [to])
  const [parts, setParts] = React.useState(() => partsUntil(target))
  React.useEffect(() => {
    setParts(partsUntil(target))
    const timer = setInterval(() => setParts(partsUntil(target)), 1000)
    return () => clearInterval(timer)
  }, [target])
  if (Number.isNaN(target)) return <div className={className}>Set a date to count down to.</div>
  if (!parts) return <div data-slot="countdown" className={cn("text-2xl font-semibold", className)} {...props}>{doneText}</div>
  const units: [string, number][] = [["Days", parts.days], ["Hours", parts.hours], ["Minutes", parts.minutes], ...(showSeconds ? [["Seconds", parts.seconds] as [string, number]] : [])]
  return (
    <div data-slot="countdown" className={cn("inline-flex gap-3", className)} {...props}>
      {units.map(([name, value]) => (
        <div key={name} data-slot="countdown-unit" className="flex min-w-16 flex-col items-center rounded-xl border bg-card px-3 py-2">
          <span className="text-3xl font-semibold tabular-nums">{String(value).padStart(2, "0")}</span>
          {labels && <span className="text-xs text-muted-foreground">{name}</span>}
        </div>
      ))}
    </div>
  )
}

export { Countdown }
