import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { cn } from "cn"

// A data table (TanStack Table, as shadcn's data-table): its columns come from the rows' fields, headed by their
// names in words (firstName → "First name").

type Cell = string | number | boolean
type Row = Record<string, Cell>

function headerOf(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function DataTable({
  data,
  sortable = true,
  filter = false,
  selectable = false,
  striped = false,
  pageSize = 5,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  data: Row[]
  sortable?: boolean
  filter?: boolean
  selectable?: boolean
  striped?: boolean
  pageSize?: number
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [query, setQuery] = React.useState("")
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const keys = [...new Set(data.flatMap((row) => Object.keys(row)))]
    return keys.map((key) => ({
      accessorKey: key,
      header: headerOf(key),
      cell: (info) => {
        const value = info.getValue<Cell>()
        return typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "")
      },
    }))
  }, [data])
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: query, rowSelection: selected },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    onRowSelectionChange: setSelected,
    enableSorting: sortable,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: Math.max(1, pageSize) } },
  })
  React.useEffect(() => table.setPageSize(Math.max(1, pageSize)), [table, pageSize])
  const rows = table.getRowModel().rows
  const pages = table.getPageCount()

  return (
    <div data-slot="data-table" className={cn("flex w-full flex-col gap-3 text-sm", className)} {...props}>
      {filter && (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter…"
          className="h-9 w-full max-w-60 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      )}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full caption-bottom">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b">
                {selectable && (
                  <th className="w-10 px-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={table.getIsAllPageRowsSelected()}
                      onChange={(event) => table.toggleAllPageRowsSelected(event.target.checked)}
                    />
                  </th>
                )}
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th key={header.id} className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3.5" /> : sorted === "desc" ? <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="h-20 text-center text-muted-foreground">
                  No results.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn("border-b last:border-0 hover:bg-muted/50 data-[state=selected]:bg-muted", striped && index % 2 === 1 && "bg-muted/30")}
                >
                  {selectable && (
                    <td className="px-3">
                      <input type="checkbox" aria-label="Select row" checked={row.getIsSelected()} onChange={(event) => row.toggleSelected(event.target.checked)} />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="h-11 px-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-muted-foreground">
          <span className="mr-auto">
            Page {table.getState().pagination.pageIndex + 1} of {pages}
          </span>
          <button type="button" className="h-8 rounded-md border px-3 hover:bg-muted disabled:opacity-50" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            Previous
          </button>
          <button type="button" className="h-8 rounded-md border px-3 hover:bg-muted disabled:opacity-50" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export { DataTable }
