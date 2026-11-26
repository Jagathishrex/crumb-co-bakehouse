import * as React from "react"
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"

// A kanban board (dnd-kit): columns named in `columns` ("To do, In progress, Done"), each card in the column its
// `column` names; cards are dragged within and between columns.

type Card = { title: string; column: string; tag?: string }
type Placed = Card & { id: string }

function CardView({ card, dragging, overlay }: { card: Card; dragging?: boolean; overlay?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-card p-3 text-sm shadow-xs", dragging && "opacity-40", overlay && "rotate-2 shadow-lg")}>
      <div className="font-medium">{card.title}</div>
      {card.tag && <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{card.tag}</span>}
    </div>
  )
}

function SortableCard({ card }: { card: Placed }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { column: card.column } })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
      <CardView card={card} dragging={isDragging} />
    </div>
  )
}

function Column({ name, cards, counts }: { name: string; cards: Placed[]; counts: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${name}`, data: { column: name } })
  return (
    <div data-slot="kanban-column" className={cn("flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2", isOver && "ring-2 ring-ring/30")}>
      <div className="flex items-center justify-between px-1 py-1 text-sm font-medium">
        {name}
        {counts && <span className="text-xs text-muted-foreground">{cards.length}</span>}
      </div>
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function KanbanBoard({
  cards,
  columns = "To do, In progress, Done",
  counts = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  cards: Card[]
  /** "To do, In progress, Done", or a list when a name has a comma: {["Ideas, raw", "Done"]}. */
  columns?: string | string[]
  counts?: boolean
}) {
  // A list written in JSX is a new array each render: its names are what count.
  const key = Array.isArray(columns) ? JSON.stringify(columns) : columns
  const names = React.useMemo(() => (Array.isArray(columns) ? columns : columns.split(",")).map((name) => String(name).trim()).filter(Boolean), [key])
  const placed = React.useMemo(() => cards.map((card, index) => ({ ...card, id: `card-${index}` })), [cards])
  const [board, setBoard] = React.useState<Placed[]>(placed)
  const [active, setActive] = React.useState<Placed | null>(null)
  // A new prop starts it again while rendering, so no frame shows the old value (an effect would paint one).
  const [seen, setSeen] = React.useState(placed)
  if (seen !== placed) {
    setSeen(placed)
    setBoard(placed)
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const columnOf = (id: string) => (id.startsWith("column:") ? id.slice(7) : board.find((card) => card.id === id)?.column)

  const onDragStart = ({ active: start }: DragStartEvent) => setActive(board.find((card) => card.id === start.id) ?? null)
  // Over another column: the card moves there at once, so its new place opens up while dragging.
  const onDragOver = ({ active: moving, over }: DragOverEvent) => {
    const target = over && columnOf(String(over.id))
    if (!target) return
    setBoard((current) => current.map((card) => (card.id === moving.id && card.column !== target ? { ...card, column: target } : card)))
  }
  const onDragEnd = ({ active: moving, over }: DragEndEvent) => {
    setActive(null)
    if (!over || moving.id === over.id || String(over.id).startsWith("column:")) return
    setBoard((current) => arrayMove(current, current.findIndex((card) => card.id === moving.id), current.findIndex((card) => card.id === over.id)))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div data-slot="kanban" className={cn("flex items-start gap-3 overflow-x-auto", className)} {...props}>
        {names.map((name) => (
          <Column key={name} name={name} counts={counts} cards={board.filter((card) => card.column === name)} />
        ))}
      </div>
      <DragOverlay>{active && <CardView card={active} overlay />}</DragOverlay>
    </DndContext>
  )
}

export { KanbanBoard }
