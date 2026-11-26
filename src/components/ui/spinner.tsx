import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { cn } from "cn"

// A spinner (shadcn/ui's spinner, MIT): shows that something is loading. Size it with className="size-6"; inside a
// button it takes the text's colour.

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
