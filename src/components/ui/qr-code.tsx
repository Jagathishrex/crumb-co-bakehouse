import * as React from "react"
import { QRCodeSVG } from "qrcode.react"
import { cn } from "cn"

// A QR code (qrcode.react): any link or text, drawn as SVG in the theme's colours, with an optional logo in the
// middle and a caption under it.

function QrCode({
  value = "https://example.com",
  size = 160,
  level = "M",
  logo,
  caption,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string
  size?: number
  level?: "L" | "M" | "Q" | "H"
  logo?: string
  caption?: string
}) {
  const logoSize = Math.round(size * 0.22)
  return (
    <div data-slot="qr-code" className={cn("inline-flex flex-col items-center gap-2 rounded-xl border bg-white p-3 text-black", className)} {...props}>
      <QRCodeSVG
        value={value || " "}
        size={size}
        level={logo ? "H" : level}
        marginSize={0}
        imageSettings={logo ? { src: logo, height: logoSize, width: logoSize, excavate: true } : undefined}
      />
      {caption && <div className="max-w-full truncate text-xs text-neutral-600">{caption}</div>}
    </div>
  )
}

export { QrCode }
