import * as React from "react"
import { HexColorInput, HexColorPicker } from "react-colorful"
import { cn } from "cn"

// A colour picker (react-colorful): a saturation square and a hue strip, the hex code to type in, and swatches to
// pick from.

function ColorPicker({
  color = "#6366f1",
  swatches = "#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #ec4899",
  showInput = true,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "color"> & {
  color?: string
  /** "#ef4444, #22c55e", or a list when a colour has commas: {["rgb(239, 68, 68)", "#22c55e"]}. */
  swatches?: string | string[]
  showInput?: boolean
}) {
  const [value, setValue] = React.useState(color)
  // A new prop starts it again while rendering, so no frame shows the old value (an effect would paint one).
  const [seen, setSeen] = React.useState(color)
  if (seen !== color) {
    setSeen(color)
    setValue(color)
  }
  const presets = (Array.isArray(swatches) ? swatches : swatches.split(",")).map((swatch) => String(swatch).trim()).filter(Boolean)
  return (
    <div data-slot="color-picker" className={cn("flex w-56 flex-col gap-3 rounded-xl border bg-popover p-3 [&_.react-colorful]:w-full [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-full [&_.react-colorful__pointer]:size-4 [&_.react-colorful__saturation]:rounded-lg [&_.react-colorful__saturation]:border-b-0", className)} {...props}>
      <HexColorPicker color={value} onChange={setValue} />
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((swatch) => (
            <button key={swatch} type="button" aria-label={swatch} onClick={() => setValue(swatch)} className={cn("size-6 rounded-md border", value.toLowerCase() === swatch.toLowerCase() && "ring-2 ring-ring ring-offset-1")} style={{ background: swatch }} />
          ))}
        </div>
      )}
      {showInput && (
        <div className="flex items-center gap-2">
          <span className="size-7 shrink-0 rounded-md border" style={{ background: value }} />
          <HexColorInput color={value} onChange={setValue} prefixed className="h-7 w-full rounded-md border border-input bg-transparent px-2 font-mono text-xs uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        </div>
      )}
    </div>
  )
}

export { ColorPicker }
