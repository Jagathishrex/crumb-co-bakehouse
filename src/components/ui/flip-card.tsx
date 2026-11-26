import * as React from "react"

// A whiteboard flip card, after Miro's: two sides (its first child is the front, its second the back) on a card that
// turns over. `side` is the side shown while editing (Kalai's flip button and ⇧F set it); a click turns it over in Play
// mode or in the app, with a 3D turn. The side not shown is hidden from the pointer, so only the shown one is edited.

interface FlipCardProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "front" | "back"
  color?: string
}

export function FlipCard({ side = "front", color = "#a6ccf5", className, style, children, onClick, ...props }: FlipCardProps) {
  const [back, setBack] = React.useState(side === "back")
  // A new prop starts it again while rendering, so no frame shows the old value (an effect would paint one).
  const [seen, setSeen] = React.useState(side)
  if (seen !== side) {
    setSeen(side)
    setBack(side === "back")
  }
  const [front, rear] = React.Children.toArray(children)
  const face = (content: React.ReactNode, isBack: boolean) => {
    const shown = isBack === back
    return (
      <div
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[16px] p-6 [backface-visibility:hidden]"
        style={{
          background: isBack ? "#ffffff" : color,
          border: `2px solid ${color}`,
          transform: isBack ? "rotateY(180deg)" : undefined,
          visibility: shown ? "visible" : "hidden",
          transition: `visibility 0s ${shown ? "0s" : "0.25s"}`,
        }}
      >
        {content}
      </div>
    )
  }
  return (
    <div
      {...props}
      data-flip-side={back ? "back" : "front"}
      className={["relative h-[220px] w-[300px] [perspective:1200px]", className].filter(Boolean).join(" ")}
      style={style}
      onClick={(event) => {
        setBack((current) => !current)
        onClick?.(event)
      }}
    >
      <div className="relative size-full shadow-[0_2px_6px_rgba(0,0,0,0.08),0_14px_28px_-12px_rgba(0,0,0,0.2)] transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: back ? "rotateY(180deg)" : undefined, borderRadius: 16 }}>
        {face(front, false)}
        {face(rear, true)}
      </div>
    </div>
  )
}
