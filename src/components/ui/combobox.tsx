import * as React from "react"
import { Command } from "cmdk"
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react"
import { cn } from "cn"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// A combobox (shadcn/ui's combobox pattern, MIT): a select you can type into, for long lists (cities, countries,
// people). Pick one of `options`; the picked value is in `value` / `defaultValue` and reported by onValueChange.

type Option = { value: string; label: string }

function Combobox({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pick one…",
  searchPlaceholder = "Search…",
  emptyText = "Nothing found.",
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "value" | "defaultValue"> & {
  options: Option[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [own, setOwn] = React.useState(defaultValue ?? "")
  const current = value ?? own
  const picked = options.find((option) => option.value === current)
  const pick = (next: string) => {
    const chosen = next === current ? "" : next
    setOwn(chosen)
    onValueChange?.(chosen)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          data-slot="combobox"
          className={cn(
            "flex h-9 w-60 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
            !picked && "text-muted-foreground",
            className
          )}
          {...props}
        >
          <span className="truncate">{picked ? picked.label : placeholder}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command className="flex flex-col overflow-hidden rounded-lg">
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 shrink-0 opacity-50" />
            <Command.Input placeholder={searchPlaceholder} className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">{emptyText}</Command.Empty>
            {options.map((option) => (
              <Command.Item
                key={option.value}
                value={option.label}
                onSelect={() => pick(option.value)}
                className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <CheckIcon className={cn("size-4", option.value === current ? "opacity-100" : "opacity-0")} />
                {option.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }
