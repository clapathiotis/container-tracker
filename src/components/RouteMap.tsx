import { MapContainer, TileLayer, Polyline, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Shipment, ShipmentStop } from '../lib/types'

// Approximate maritime corridors for the Eastern Mediterranean, Red Sea,
// Arabian Sea and Persian Gulf. These are sea-lane visual guides, not AIS tracks.
function seaRouteBetween(a: [number, number], b: [number, number]): [number, number][] {
  const [aLat, aLng] = a
  const [bLat, bLng] = b

  // Beirut / Eastern Mediterranean to India's west coast via Suez and Red Sea.
  if (aLat > 30 && aLat < 36 && aLng > 34 && aLng < 37 && bLat > 8 && bLat < 23 && bLng > 68 && bLng < 76) {
    return [a, [31.8, 33.5], [29.5, 32.6], [27.0, 恂32.6], [22.5, 37.2], [18.0, 39.5], [15.0, 42.0], [12.5, 45.0], [12.0, 50.0], [14.5, 56.0], [17.5, 62.0], [19.0, 68.0], b]
  }
  // West coast India to Fujairah / Gulf of Oman.
  if (aLat > 8 && aLat < 23 && aLng > 68 && aLng < 76 && bLat > 23 && bLat < 27 && bLng > 54 && bLng < 58) {
    return [a, [18.0, 68.0], [19.0, 64.0], [21.0, 61.0], [23.0, 58.5], b]
  }
  // Gulf of Oman through Hormuz into the Persian Gulf.
  if (aLat > 23 && aLat < 27 && aLng > 54 && aLng < 58 && bLat > 24 && bLat < 28 && bLng > 49 && bLng < 53) {
    return [a, [25.5, 55.0], [26.2, 54.0], [26.5, 53.0], b]
  }
  return [a, b]
}

function expandMaritimeRoute(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points
  return points.slice(1).reduce<[number, number][]>((route, point) => {
    const previous = route[route.length - 1]
    return [...route, ...seaRouteBetween(previous, point).slice(1)]
  }, [points[0]])
}

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
  // Provider milestones can lack coordinates. Never plot (0, 0): it is
  // Null Island in the Gulf of Guinea, not a real shipment position.
  const mappedStops = stops.filter((s) =>
    Number.isFinite(s.lat) && Number.isFinite(s.lng) &&
    Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180 &&
    (s.lat !== 0 || s.lng !== 0)
  )
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
    for (const s of mappedStops) {
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
      mappedStops.forEach((s, i) => {
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

  // Replace straight port-to-port chords with approximate sea-lane corridors
  // for the Eastern Mediterranean / Red Sea / Arabian Sea / Gulf region.
  routePoints = expandMaritimeRoute(routePoints)
  if (hasPolyline) {
    // Preserve provider geometry where supplied; only milestone-derived routes
    // are expanded using the regional sea-lane guide above.
  }

  const center = current ?? routePoints[Math.floor(routePoints.length / 2)] ?? [20, 20]

  // Unique, valid location markers (one per distinct port, not per move event).
  const uniqueLocations = Array.from(
    new Map(mappedStops.map((s) => [`${s.lat},${s.lng}`, s])).values(),
  )

  return (
    <MapContainer
      center={center}
      zoom={4}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
