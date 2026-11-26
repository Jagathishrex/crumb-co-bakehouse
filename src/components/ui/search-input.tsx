import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"

// A search box: a magnifier, the query and a button that clears it. The query is in `value` / `defaultValue` and
// reported by onValueChange as it is typed; Enter calls onSearch.

function SearchInput({
  value,
  defaultValue,
  onValueChange,
  onSearch,
  placeholder = "Search…",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "type"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onSearch?: (value: string) => void
}) {
  const [own, setOwn] = React.useState(defaultValue ?? "")
  const query = value ?? own
  const change = (next: string) => {
    setOwn(next)
    onValueChange?.(next)
  }

  return (
    <div
      data-slot="search-input"
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
        className
      )}
    >
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSearch?.(query)
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {query && (
        <button type="button" aria-label="Clear" onClick={() => change("")} className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground">
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export { SearchInput }
