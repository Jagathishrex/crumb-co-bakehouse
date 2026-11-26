import * as React from "react"
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider"
import { cn } from "cn"

// A before/after slider (react-compare-slider): two pictures on top of each other and a handle to drag between
// them, for photo edits, redesigns and product results.

function CompareSlider({
  before = "/compare/before.jpg",
  after = "/compare/after.jpg",
  beforeLabel = "Before",
  afterLabel = "After",
  position = 50,
  vertical = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  before?: string
  after?: string
  beforeLabel?: string
  afterLabel?: string
  position?: number
  vertical?: boolean
}) {
  return (
    <div data-slot="compare-slider" className={cn("relative h-72 w-[480px] overflow-hidden rounded-xl", className)} {...props}>
      <ReactCompareSlider
        key={`${position} ${vertical}`}
        defaultPosition={position}
        portrait={vertical}
        className="size-full"
        itemOne={<ReactCompareSliderImage src={before} alt={beforeLabel} />}
        itemTwo={<ReactCompareSliderImage src={after} alt={afterLabel} />}
      />
      {beforeLabel && <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{beforeLabel}</span>}
      {afterLabel && <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{afterLabel}</span>}
    </div>
  )
}

export { CompareSlider }
