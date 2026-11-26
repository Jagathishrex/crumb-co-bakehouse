import * as React from "react"
import EmojiPickerReact, { EmojiStyle, Theme } from "emoji-picker-react"
import { cn } from "cn"

// An emoji picker (emoji-picker-react): search, categories, skin tones and recently used, with the picked emoji
// shown above it. Native emoji, so nothing is downloaded.

function EmojiPicker({
  theme = "light",
  search = true,
  skinTones = true,
  width = 320,
  height = 380,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  theme?: "light" | "dark" | "auto"
  search?: boolean
  skinTones?: boolean
  width?: number
  height?: number
}) {
  const [picked, setPicked] = React.useState("")
  return (
    <div data-slot="emoji-picker" className={cn("inline-flex flex-col gap-2", className)} {...props}>
      {picked && <div className="text-sm text-muted-foreground">Picked: <span className="text-xl">{picked}</span></div>}
      <EmojiPickerReact
        onEmojiClick={(emoji) => setPicked(emoji.emoji)}
        theme={theme === "dark" ? Theme.DARK : theme === "auto" ? Theme.AUTO : Theme.LIGHT}
        emojiStyle={EmojiStyle.NATIVE}
        searchDisabled={!search}
        skinTonesDisabled={!skinTones}
        width={width}
        height={height}
        lazyLoadEmojis
      />
    </div>
  )
}

export { EmojiPicker }
