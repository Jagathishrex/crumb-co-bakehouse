import * as React from "react"
import MarqueeModule from "react-fast-marquee"
import { cn } from "cn"

// A scrolling strip (react-fast-marquee): logos or words that slide past without end, as "Trusted by" rows and
// announcement bars do, fading out at the edges.

// An older CommonJS package: in the browser its default export can arrive one level deeper.
const Marquee = ((MarqueeModule as unknown as { default?: typeof MarqueeModule }).default ?? MarqueeModule) as typeof MarqueeModule

type Item = { label: string; image?: string }

function LogoMarquee({
  items,
  speed = 40,
  direction = "left",
  pauseOnHover = true,
  fade = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  items: Item[]
  speed?: number
  direction?: "left" | "right"
  pauseOnHover?: boolean
  fade?: boolean
}) {
  return (
    <div data-slot="marquee" className={cn("w-full overflow-hidden py-2", className)} {...props}>
      <Marquee speed={speed} direction={direction} pauseOnHover={pauseOnHover} gradient={fade} gradientColor="var(--background)" gradientWidth={64} autoFill>
        {items.map((item, index) => (
          <div key={`${item.label} ${index}`} data-slot="marquee-item" className="mx-8 flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            {item.image && <img src={item.image} alt="" className="h-7 w-auto" />}
            {item.label}
          </div>
        ))}
      </Marquee>
    </div>
  )
}

export { LogoMarquee }
