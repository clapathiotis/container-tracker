import { MapContainer, TileLayer, Polyline, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Shipment, ShipmentStop } from '../lib/types'

function dotIcon(color: string, size = 12, pulse = false) {
  return L.divIcon({
    className: '',
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};box-shadow:0 0 0 3px rgba(10,22,40,0.35), 0 0 10px ${color};
      ${pulse ? 'position:relative;' : ''}
    ">${pulse ? `<span style="position:absolute;inset:-8px;border-radius:50%;border:2px solid ${color};animation:beacon-pulse 1.8s ease-out infinite;"></span>` : ''}</span>
    <style>
      @keyframes beacon-pulse {
        0% { transform: scale(0.4); opacity: 0.9; }
        100% { transform: scale(2.4); opacity: 0; }
      }
    </style>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

interface Props {
  shipment: Shipment
  stops: ShipmentStop[]
}

export default function RouteMap({ shipment, stops }: Props) {
  const current =
    shipment.current_lat != null && shipment.current_lng != null
      ? ([shipment.current_lat, shipment.current_lng] as [number, number])
      : null

  // Traqo gives a real route polyline (hundreds of points) instead of the
  // discrete carrier milestone events Terminal49 provides. When present,
  // draw that smooth path and split it at the point nearest the live
  // position; otherwise fall back to the old stop-to-stop straight-line
  // behavior built from shipment_stops.
  const hasPolyline = Array.isArray(shipment.route_polyline) && shipment.route_polyline.length > 1

  let routePoints: [number, number][]
  let sailedPoints: [number, number][]
  let aheadPoints: [number, number][]

  if (hasPolyline) {
    routePoints = shipment.route_polyline as [number, number][]
    let splitIdx = 0
    if (current) {
      let best = Infinity
      routePoints.forEach((p, i) => {
        const d = (p[0] - current[0]) ** 2 + (p[1] - current[1]) ** 2
        if (d < best) {
          best = d
          splitIdx = i
        }
      })
    }
    sailedPoints = routePoints.slice(0, splitIdx + 1)
    aheadPoints = routePoints.slice(splitIdx)
  } else {
    // Collapse consecutive duplicate-location stops into a single route
    // point, preserving order, for drawing the line.
    routePoints = []
    const seen: { lat: number; lng: number }[] = []
    for (const s of stops) {
      const last = seen[seen.length - 1]
      if (!last || last.lat !== s.lat || last.lng !== s.lng) {
        seen.push({ lat: s.lat, lng: s.lng })
        routePoints.push([s.lat, s.lng])
      }
    }

    // Split route into "sailed" (up to current position, approximated by
    // last completed stop) and "ahead".
    const lastCompletedIdx = (() => {
      let idx = -1
      stops.forEach((s, i) => {
        if (s.completed) idx = i
      })
      return idx
    })()
    const lastCompleted = lastCompletedIdx >= 0 ? stops[lastCompletedIdx] : null

    sailedPoints = routePoints.slice(
      0,
      lastCompleted
        ? routePoints.findIndex((p) => p[0] === lastCompleted.lat && p[1] === lastCompleted.lng) + 1
        : 1,
    )
    aheadPoints = routePoints.slice(sailedPoints.length - 1)
  }

  const center = current ?? routePoints[Math.floor(routePoints.length / 2)] ?? [20, 20]

  // Unique location markers (one per distinct port, not per move event)
  const uniqueLocations = Array.from(
    new Map(stops.map((s) => [`${s.lat},${s.lng}`, s])).values(),
  )

  return (
    <MapContainer
      center={center}
      zoom={4}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      {sailedPoints.length > 1 && (
        <Polyline positions={sailedPoints} pathOptions={{ color: '#00c2a8', weight: 3, opacity: 0.9 }} />
      )}
      {aheadPoints.length > 1 && (
        <Polyline
          positions={aheadPoints}
          pathOptions={{ color: '#4c6b8a', weight: 2, opacity: 0.75, dashArray: '2 8' }}
        />
      )}

      {uniqueLocations.map((s) => {
        const isOrigin = s.lat === shipment.origin_lat && s.lng === shipment.origin_lng
        const isDest = s.lat === shipment.destination_lat && s.lng === shipment.destination_lng
        const color = isDest ? '#ffb627' : isOrigin ? '#00c2a8' : s.completed ? '#00c2a8' : '#7891ac'
        return (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={dotIcon(color, isDest || isOrigin ? 14 : 10)}>
            <Tooltip direction="top" offset={[0, -8]}>
              {s.location}
            </Tooltip>
          </Marker>
        )
      })}

      {current && (
        <Marker position={current} icon={dotIcon('#ffb627', 14, true)}>
          <Tooltip direction="top" offset={[0, -10]} permanent>
            {shipment.current_location ?? 'Live position'}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  )
}
