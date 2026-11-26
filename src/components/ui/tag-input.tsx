import * as React from "react"
import { X } from "lucide-react"
import { cn } from "cn"

// A tag input: type a word and press Enter (or a comma) to make it a chip; Backspace in the empty box takes the last
// one away. Starts with `tags`.

type Tag = { label: string }

function TagInput({
  tags = [],
  placeholder = "Add a tag…",
  max = 10,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  tags?: Tag[]
  placeholder?: string
  max?: number
}) {
  const [chips, setChips] = React.useState(() => tags.map((tag) => tag.label))
  const [draft, setDraft] = React.useState("")
  // A new prop starts it again while rendering, so no frame shows the old value (an effect would paint one).
  const [seen, setSeen] = React.useState(tags)
  if (seen !== tags) {
    setSeen(tags)
    setChips(tags.map((tag) => tag.label))
  }
  const add = (text: string) => {
    const label = text.trim()
    if (label && !chips.includes(label) && chips.length < max) setChips([...chips, label])
    setDraft("")
  }
  return (
    <div data-slot="tag-input" className={cn("flex min-h-9 w-80 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 shadow-xs focus-within:ring-2 focus-within:ring-ring/50", className)} {...props}>
      {chips.map((chip) => (
        <span key={chip} data-slot="tag" className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {chip}
          <button type="button" aria-label={`Remove ${chip}`} onClick={() => setChips(chips.filter((other) => other !== chip))} className="opacity-60 hover:opacity-100">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={chips.length < max ? placeholder : ""}
        disabled={chips.length >= max}
        onChange={(event) => (event.target.value.endsWith(",") ? add(event.target.value.slice(0, -1)) : setDraft(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            add(draft)
          }
          if (event.key === "Backspace" && !draft) setChips(chips.slice(0, -1))
        }}
        onBlur={() => add(draft)}
        className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

export { TagInput }
