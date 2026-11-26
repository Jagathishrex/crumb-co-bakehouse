import * as React from "react"

// How many cards a whiteboard list holds, kept up to date as cards are added, removed or dragged between lists: it
// counts the [data-board-card] children of the [data-board-list] it sits in.

export function ListCount(props: React.HTMLAttributes<HTMLSpanElement>) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [count, setCount] = React.useState(0)
  React.useLayoutEffect(() => {
    const list = ref.current?.closest("[data-board-list]")
    if (!list) return
    const update = () => setCount(list.querySelectorAll(":scope > [data-board-card]").length)
    update()
    const changes = new MutationObserver(update)
    changes.observe(list, { childList: true })
    return () => changes.disconnect()
  }, [])
  return (
    <span ref={ref} {...props}>
      {count}
    </span>
  )
}
