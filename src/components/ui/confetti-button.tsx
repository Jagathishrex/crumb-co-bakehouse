import * as React from "react"
import confetti from "canvas-confetti"
import { cn } from "cn"

// A button that bursts confetti from where it is when clicked (canvas-confetti), for success moments.

function ConfettiButton({
  label = "Celebrate",
  particles = 120,
  spread = 70,
  colors = "#6366f1, #ec4899, #f59e0b, #22c55e",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  label?: string
  particles?: number
  spread?: number
  colors?: string
}) {
  const burst = (event: React.MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    void confetti({
      particleCount: particles,
      spread,
      origin: { x: (box.left + box.width / 2) / window.innerWidth, y: (box.top + box.height / 2) / window.innerHeight },
      colors: colors.split(",").map((color) => color.trim()).filter(Boolean),
    })
  }
  return (
    <button
      type="button"
      data-slot="confetti-button"
      className={cn("inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90", className)}
      onClick={burst}
      {...props}
    >
      {label}
    </button>
  )
}

export { ConfettiButton }
