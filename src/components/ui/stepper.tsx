import * as React from "react"
import { CheckIcon } from "lucide-react"
import { cn } from "cn"

// A stepper: the steps of a longer task (checkout, sign-up, set-up) with the ones done ticked, the current one
// marked and the rest to come. `current` counts from 0.

type Step = { title: string; description?: string }

function Stepper({
  steps,
  current = 0,
  orientation = "horizontal",
  className,
  ...props
}: React.ComponentProps<"ol"> & {
  steps: Step[]
  current?: number
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <ol
      data-slot="stepper"
      data-orientation={orientation}
      className={cn("flex w-full gap-3", orientation === "vertical" ? "flex-col" : "items-start", className)}
      {...props}
    >
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "next"
        return (
          <li
            key={`${index}-${step.title}`}
            data-slot="stepper-step"
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className={cn("flex min-w-0 gap-3", orientation === "horizontal" && "flex-1 items-start")}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary text-primary ring-4 ring-primary/15",
                state === "next" && "border-border text-muted-foreground"
              )}
            >
              {state === "done" ? <CheckIcon className="size-4" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
              <span className={cn("truncate text-sm font-medium", state === "next" && "text-muted-foreground")}>{step.title}</span>
              {step.description && <span className="text-xs text-muted-foreground">{step.description}</span>}
            </span>
            {orientation === "horizontal" && index < steps.length - 1 && (
              <span aria-hidden="true" className={cn("mt-4 h-px min-w-6 flex-1", index < current ? "bg-primary" : "bg-border")} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export { Stepper }
