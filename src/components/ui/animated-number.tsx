import * as React from "react"
import NumberFlow from "@number-flow/react"
import { cn } from "cn"

// A number that rolls to its value (NumberFlow), for dashboards: "1,234 → 1,240", as money, a percent or plain,
// with an optional label. It rolls up from `from` when it first shows.

function AnimatedNumber({
  value = 12480,
  from = 0,
  format: kind = "decimal",
  currency = "USD",
  decimals = 0,
  prefix,
  suffix,
  label,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number
  from?: number
  format?: "decimal" | "currency" | "percent"
  currency?: string
  decimals?: number
  prefix?: string
  suffix?: string
  label?: string
}) {
  // In a design tool's canvas (a frame) it shows its value at once; in the app it rolls up from `from`.
  const [shown, setShown] = React.useState(() => (typeof window !== "undefined" && window.parent !== window ? value : from))
  React.useEffect(() => {
    const timer = setTimeout(() => setShown(value), 50)
    return () => clearTimeout(timer)
  }, [value])
  return (
    <div data-slot="animated-number" className={cn("inline-flex flex-col", className)} {...props}>
      <NumberFlow
        value={kind === "percent" ? shown / 100 : shown}
        prefix={prefix}
        suffix={suffix}
        format={{ style: kind, currency: kind === "currency" ? currency : undefined, minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
        className="text-4xl font-semibold tabular-nums tracking-tight"
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  )
}

export { AnimatedNumber }
