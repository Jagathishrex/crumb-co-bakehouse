import * as React from "react"
import ReactBarcode from "react-barcode"
import { cn } from "cn"

// A barcode (react-barcode): the value in a format shops and parcels use (CODE128, EAN-13, UPC…), with its digits
// under it.

function Barcode({
  value = "KALAI-2026",
  format = "CODE128",
  barWidth = 2,
  height = 64,
  showValue = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string
  format?: "CODE128" | "EAN13" | "UPC" | "CODE39" | "ITF14"
  barWidth?: number
  height?: number
  showValue?: boolean
}) {
  return (
    <div data-slot="barcode" className={cn("inline-flex rounded-lg bg-white p-2 [&_svg]:block", className)} {...props}>
      <ReactBarcode key={`${format} ${value}`} value={value || "0"} format={format} width={barWidth} height={height} displayValue={showValue} margin={0} fontSize={14} background="transparent" lineColor="#000" />
    </div>
  )
}

export { Barcode }
