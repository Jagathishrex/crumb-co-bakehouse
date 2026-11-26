import * as React from "react"
import { Toaster, toast } from "sonner"
import { cn } from "cn"

// A button that shows a toast (Sonner) when clicked, for example "Saved!". The page gets one toaster however many
// toast buttons it has.

let mounted = 0
const listeners = new Set<() => void>()

function useOwnsToaster(): boolean {
  const [owner, setOwner] = React.useState(false)
  React.useEffect(() => {
    const claim = () => setOwner((current) => current || mounted === 0)
    if (mounted === 0) {
      mounted += 1
      setOwner(true)
      return () => {
        mounted -= 1
        listeners.forEach((listener) => listener())
      }
    }
    listeners.add(claim)
    return () => {
      listeners.delete(claim)
    }
  }, [])
  return owner
}

function ToastButton({
  label = "Save",
  title = "Saved!",
  description,
  tone = "success",
  position = "bottom-right",
  duration = 4,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "title"> & {
  label?: string
  title?: string
  description?: string
  tone?: "default" | "success" | "info" | "warning" | "error"
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
  duration?: number
}) {
  const owner = useOwnsToaster()
  const show = () => {
    const options = { description, duration: Math.max(1, duration) * 1000 }
    if (tone === "default") toast(title, options)
    else toast[tone](title, options)
  }

  return (
    <>
      <button
        type="button"
        data-slot="toast-button"
        className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90", className)}
        onClick={show}
        {...props}
      >
        {label}
      </button>
      {owner && <Toaster position={position} richColors closeButton />}
    </>
  )
}

export { ToastButton }
