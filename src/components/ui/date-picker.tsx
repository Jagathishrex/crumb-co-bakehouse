import * as React from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// A date picker (shadcn/ui's date-picker pattern, MIT): a field that opens a calendar. The date is "2026-11-06"
// in `value` / `defaultValue` and reported by onValueChange; the field shows it as "6 Nov 2026".

function dayOf(text?: string): Date | undefined {
  if (!text) return undefined
  const [year, month, day] = text.split("-").map(Number)
  return year && month && day ? new Date(year, month - 1, day) : undefined
}

function textOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function DatePicker({
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pick a date",
  weekStartsOn = 1,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "value" | "defaultValue"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  weekStartsOn?: 0 | 1
}) {
  const [open, setOpen] = React.useState(false)
  const [own, setOwn] = React.useState(defaultValue ?? "")
  const day = dayOf(value ?? own)
  const theme = {
    "--rdp-accent-color": "var(--primary)",
    "--rdp-accent-background-color": "var(--accent)",
    "--rdp-today-color": "var(--primary)",
    "--rdp-day-height": "2.25rem",
    "--rdp-day-width": "2.25rem",
    "--rdp-day_button-height": "2.125rem",
    "--rdp-day_button-width": "2.125rem",
  } as React.CSSProperties

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="date-picker"
          className={cn(
            "flex h-9 w-60 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
            !day && "text-muted-foreground",
            className
          )}
          {...props}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-60" />
          <span className="truncate">{day ? day.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 text-foreground" align="start" style={theme}>
        <DayPicker
          mode="single"
          selected={day}
          defaultMonth={day}
          weekStartsOn={weekStartsOn}
          showOutsideDays
          onSelect={(next) => {
            const text = next ? textOf(next) : ""
            setOwn(text)
            onValueChange?.(text)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
