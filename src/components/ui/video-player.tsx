import * as React from "react"
import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaPlaybackRateButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react"
import { cn } from "cn"

// A video player (Media Chrome): a <video> with play, seek, time, volume, speed and full screen, in the theme's
// colours. The sample in public/video plays offline.

function VideoPlayer({
  src = "/video/sample.mp4",
  poster = "/video/poster.jpg",
  autoplay = false,
  loop = false,
  muted = false,
  controls = "full",
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  src?: string
  poster?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: "full" | "simple" | "none"
}) {
  const theme = {
    "--media-primary-color": "var(--primary-foreground)",
    "--media-secondary-color": "color-mix(in oklab, var(--primary) 70%, transparent)",
    "--media-accent-color": "var(--primary)",
    "--media-range-track-background": "rgb(255 255 255 / 0.3)",
    ...style,
  } as React.CSSProperties

  return (
    <div data-slot="video-player" className={cn("aspect-video w-full overflow-hidden rounded-xl bg-black", className)} style={theme} {...props}>
      <MediaController className="size-full">
        <video slot="media" src={src} poster={poster || undefined} autoPlay={autoplay} loop={loop} muted={muted || autoplay} playsInline preload="metadata" className="size-full object-cover" />
        {controls !== "none" && (
          <MediaControlBar>
            <MediaPlayButton />
            {controls === "full" && <MediaSeekBackwardButton seekOffset={10} />}
            {controls === "full" && <MediaSeekForwardButton seekOffset={10} />}
            <MediaTimeRange />
            <MediaTimeDisplay showDuration />
            <MediaMuteButton />
            {controls === "full" && <MediaVolumeRange />}
            {controls === "full" && <MediaPlaybackRateButton />}
            <MediaFullscreenButton />
          </MediaControlBar>
        )}
      </MediaController>
    </div>
  )
}

export { VideoPlayer }
