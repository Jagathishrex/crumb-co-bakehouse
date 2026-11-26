import * as React from "react"
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "cn"

// A list you can reorder by dragging (dnd-kit): by the whole item or by its handle, up and down or side to side;
// arrow keys move a picked item too.

type Item = { title: string; subtitle?: string }

function SortableItem({ id, item, handle }: { id: string; item: Item; handle: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const grip = handle ? {} : { ...attributes, ...listeners }
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-xs", !handle && "cursor-grab active:cursor-grabbing", isDragging && "relative z-10 shadow-lg")}
      {...grip}
    >
      {handle && (
        <button type="button" aria-label={`Move ${item.title}`} className="cursor-grab text-muted-foreground active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
      )}
      <div className="min-w-0">
        <div className="truncate font-medium">{item.title}</div>
        {item.subtitle && <div className="truncate text-muted-foreground">{item.subtitle}</div>}
      </div>
    </li>
  )
}

function SortableList({
  items,
  direction = "vertical",
  handle = true,
  className,
  ...props
}: React.ComponentProps<"ul"> & {
  items: Item[]
  direction?: "vertical" | "horizontal"
  handle?: boolean
}) {
  const keyed = React.useMemo(() => items.map((item, index) => ({ id: `${index}`, item })), [items])
  const [order, setOrder] = React.useState(keyed)
  // A new prop starts it again while rendering, so no frame shows the old value (an effect would paint one).
  const [seen, setSeen] = React.useState(keyed)
  if (seen !== keyed) {
    setSeen(keyed)
    setOrder(keyed)
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setOrder((current) => arrayMove(current, current.findIndex((entry) => entry.id === active.id), current.findIndex((entry) => entry.id === over.id)))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((entry) => entry.id)} strategy={direction === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy}>
        <ul data-slot="sortable-list" className={cn("flex gap-2", direction === "horizontal" ? "flex-row" : "flex-col", className)} {...props}>
          {order.map((entry) => (
            <SortableItem key={entry.id} id={entry.id} item={entry.item} handle={handle} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

export { SortableList }
