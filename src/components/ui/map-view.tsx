import * as React from "react"
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { cn } from "cn"

// A map (Leaflet with OpenStreetMap or CARTO tiles): a centre and zoom, and pins with labels. Pins are drawn
// circles in the theme's primary colour, so no marker images are needed.

type Pin = { label?: string; lat: number; lng: number }

const kTiles = {
  streets: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", credit: "&copy; OpenStreetMap contributors" },
  light: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", credit: "&copy; OpenStreetMap contributors &copy; CARTO" },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", credit: "&copy; OpenStreetMap contributors &copy; CARTO" },
}

/** Follows the centre and zoom when they change (the map only reads them once). */
function View({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  React.useEffect(() => {
    map.setView([lat, lng], zoom)
  }, [map, lat, lng, zoom])
  return null
}

function MapView({
  pins = [],
  lat = 12.97,
  lng = 77.59,
  zoom = 12,
  tiles = "streets",
  scrollZoom = false,
  labels = true,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  pins?: Pin[]
  lat?: number
  lng?: number
  zoom?: number
  tiles?: "streets" | "light" | "dark"
  scrollZoom?: boolean
  labels?: boolean
}) {
  const layer = kTiles[tiles] ?? kTiles.streets
  return (
    <div data-slot="map" className={cn("isolate h-64 w-96 overflow-hidden rounded-xl border", className)} {...props}>
      <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={scrollZoom} className="size-full">
        <View lat={lat} lng={lng} zoom={zoom} />
        <TileLayer key={tiles} url={layer.url} attribution={layer.credit} />
        {pins.map((pin, index) => (
          <CircleMarker key={index} center={[pin.lat, pin.lng]} radius={8} pathOptions={{ color: "white", weight: 2, fillOpacity: 1, className: "fill-primary" }}>
            {pin.label && <Tooltip permanent={labels} direction="top" offset={[0, -8]}>{pin.label}</Tooltip>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

export { MapView }
