import * as React from "react"
import { DotLottieReact, setWasmUrl, type DotLottie } from "@lottiefiles/dotlottie-react"
import { cn } from "cn"
import { clock } from "@/lib/video"

// A Lottie animation (dotLottie): a .lottie or Lottie .json file, for example one from LottieFiles in public/lottie.
// The player's WebAssembly is served from the project, so it works offline.

setWasmUrl("/lottie/dotlottie-player.wasm")

/** The clock rests here when nothing drives it (the canvas): then the animation plays on its own. */
const kRestFrame = 1_000_000

function LottiePlayer({
  src = "/lottie/pulse.json",
  loop = true,
  autoplay = true,
  speed = 1,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  src?: string
  loop?: boolean
  autoplay?: boolean
  speed?: number
}) {
  const [player, setPlayer] = React.useState<DotLottie | null>(null)
  // In a video or an MP4 export the frame clock sets the time, so every exported frame is exact.
  React.useEffect(() => {
    if (!player) return
    const follow = () => {
      if (clock.frame >= kRestFrame || !player.isLoaded || !player.duration) return
      const total = player.totalFrames
      const frame = (clock.frame / clock.fps) * (total / player.duration) * Math.max(0.1, speed)
      player.pause()
      player.setFrame(loop ? frame % total : Math.min(frame, total - 1))
    }
    clock.listeners.add(follow)
    player.addEventListener("load", follow)
    follow()
    return () => {
      clock.listeners.delete(follow)
      player.removeEventListener("load", follow)
    }
  }, [player, loop, speed])
  return (
    <div data-slot="lottie" className={cn("size-40", className)} {...props}>
      <DotLottieReact key={`${src} ${loop} ${autoplay}`} src={src} loop={loop} autoplay={autoplay} speed={Math.max(0.1, speed)} dotLottieRefCallback={setPlayer} className="size-full" />
    </div>
  )
}

export { LottiePlayer }
