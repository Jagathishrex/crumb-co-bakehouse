import * as React from "react"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"

// A carousel (Embla, as shadcn's carousel): one slide per item, with arrows, dots, loop and autoplay.

type Slide = { title?: string; description?: string; image?: string }

function CarouselBlock({
  slides,
  loop = true,
  autoplay = false,
  delay = 4,
  arrows = true,
  dots = true,
  perView = 1,
  orientation = "horizontal",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  slides: Slide[]
  loop?: boolean
  autoplay?: boolean
  delay?: number
  arrows?: boolean
  dots?: boolean
  perView?: number
  orientation?: "horizontal" | "vertical"
}) {
  const vertical = orientation === "vertical"
  const plugins = React.useMemo(() => (autoplay ? [Autoplay({ delay: Math.max(1, delay) * 1000, stopOnInteraction: false })] : []), [autoplay, delay])
  const [viewport, api] = useEmblaCarousel({ loop, axis: vertical ? "y" : "x", align: "start" }, plugins)
  const [index, setIndex] = React.useState(0)
  const [count, setCount] = React.useState(0)
  React.useEffect(() => {
    if (!api) return
    const update = () => {
      setIndex(api.selectedScrollSnap())
      setCount(api.scrollSnapList().length)
    }
    update()
    api.on("select", update).on("reInit", update)
    return () => {
      api.off("select", update).off("reInit", update)
    }
  }, [api])
  const basis = `${100 / Math.max(1, perView)}%`

  return (
    <div data-slot="carousel" role="region" aria-roledescription="carousel" className={cn("relative flex flex-col gap-3", className)} {...props}>
      <div ref={viewport} className="min-h-0 flex-1 overflow-hidden rounded-xl">
        <div className={cn("flex h-full", vertical ? "-mt-4 flex-col" : "-ml-4")}>
          {slides.map((slide, at) => (
            <div key={at} role="group" aria-roledescription="slide" className={cn("min-h-0 min-w-0 shrink-0 grow-0", vertical ? "pt-4" : "pl-4")} style={{ flexBasis: basis }}>
              <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-xl bg-muted p-6">
                {slide.image && <img src={slide.image} alt="" className="absolute inset-0 size-full object-cover" />}
                {slide.image && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />}
                <div className={cn("relative", slide.image && "text-white")}>
                  {slide.title && <div className="text-lg font-semibold">{slide.title}</div>}
                  {slide.description && <p className={cn("mt-1 text-sm", slide.image ? "text-white/80" : "text-muted-foreground")}>{slide.description}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {arrows && (
        <>
          <button type="button" aria-label="Previous slide" onClick={() => api?.scrollPrev()} className={cn("absolute flex size-8 items-center justify-center rounded-full border bg-background shadow-sm", vertical ? "left-1/2 top-2 -translate-x-1/2 rotate-90" : "left-2 top-1/2 -translate-y-1/2")}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Next slide" onClick={() => api?.scrollNext()} className={cn("absolute flex size-8 items-center justify-center rounded-full border bg-background shadow-sm", vertical ? "bottom-10 left-1/2 -translate-x-1/2 rotate-90" : "right-2 top-1/2 -translate-y-1/2")}>
            <ChevronRight className="size-4" />
          </button>
        </>
      )}
      {dots && count > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, at) => (
            <button key={at} type="button" aria-label={`Go to slide ${at + 1}`} onClick={() => api?.scrollTo(at)} className={cn("h-1.5 rounded-full transition-all", at === index ? "w-4 bg-foreground" : "w-1.5 bg-foreground/30")} />
          ))}
        </div>
      )}
    </div>
  )
}

export { CarouselBlock }
