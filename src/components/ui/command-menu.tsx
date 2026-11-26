import * as React from "react"
import { Command } from "cmdk"
import { Search } from "lucide-react"
import { cn } from "cn"

// A command menu (cmdk, as shadcn's command): a search box over grouped items with their shortcuts. With `dialog`
// it opens over the page on ⌘K instead of sitting in it.

type Item = { label: string; group?: string; shortcut?: string }

function CommandMenu({
  items,
  placeholder = "Type a command or search…",
  emptyText = "No results found.",
  dialog = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  items: Item[]
  placeholder?: string
  emptyText?: string
  dialog?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (!dialog) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [dialog])
  const groups = [...new Set(items.map((item) => item.group ?? ""))]

  const menu = (
    <Command data-slot="command" className={cn("flex w-full flex-col overflow-hidden rounded-xl border bg-popover text-sm text-popover-foreground shadow-md", !dialog && className)}>
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 opacity-50" />
        <Command.Input placeholder={placeholder} className="h-11 w-full bg-transparent outline-none placeholder:text-muted-foreground" />
      </div>
      <Command.List className="max-h-72 overflow-y-auto p-1">
        <Command.Empty className="py-6 text-center text-muted-foreground">{emptyText}</Command.Empty>
        {groups.map((group) => (
          <Command.Group key={group} heading={group || undefined} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
            {items
              .filter((item) => (item.group ?? "") === group)
              .map((item, index) => (
                <Command.Item key={`${item.label} ${index}`} value={`${item.label} ${group}`} onSelect={() => setOpen(false)} className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground">
                  {item.label}
                  {item.shortcut && <span className="ml-auto text-xs tracking-widest text-muted-foreground">{item.shortcut}</span>}
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  )

  if (!dialog) return <div {...props}>{menu}</div>
  return (
    <div className={cn("inline-flex", className)} {...props}>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 w-60 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
        <Search className="size-4" /> Search…
        <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px]">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            {menu}
          </div>
        </div>
      )}
    </div>
  )
}

export { CommandMenu }
