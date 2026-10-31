import { Fragment, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type ShipmentPin = {
  id: string
  reference: string
  container_no: string | null
  origin_port: string | null
  destination_port: string | null
  origin_lat?: number | null
  origin_lng?: number | null
  destination_lat?: number | null
  destination_lng?: number | null
  current_lat?: number | null
  current_lng?: number | null
  current_location?: string | null
  route_polyline?: [number, number][] | null
}

type Stop = { id: string; shipment_id: string; location: string; lat: number; lng: number; seq: number }

function pin(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 5px #0008"></Fragment>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function FitAll({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 1) map.setView(positions[0], 5)
    else if (positions.length > 1) map.fitBounds(L.latLngBounds(positions), { padding: [36, 36], maxZoom: 6 })
  }, [map, positions])
  return null
}

export default function CustomerMap({ shipments, stops }: { shipments: ShipmentPin[]; stops: Stop[] }) {
  const palette = ['#00c2a8', '#e8a33d', '#6b8afd', '#c17ce8', '#e56b6f', '#4d9bbd']
  const stopGroups = useMemo(() => {
    const map = new Map<string, Stop[]>()
    for (const stop of stops) map.set(stop.shipment_id, [...(map.get(stop.shipment_id) ?? []), stop])
    for (const group of map.values()) group.sort((a, b) => a.seq - b.seq)
    return map
  }, [stops])

  const positions: [number, number][] = []
  for (const shipment of shipments) {
    for (const pair of [
      [shipment.current_lat, shipment.current_lng],
      [shipment.origin_lat, shipment.origin_lng],
      [shipment.destination_lat, shipment.destination_lng],
    ]) {
      if (pair[0] != null && pair[1] != null) positions.push([pair[0], pair[1]])
    }
    for (const point of shipment.route_polyline ?? []) positions.push(point)
    for (const stop of stopGroups.get(shipment.id) ?? []) positions.push([stop.lat, stop.lng])
  }
  if (!positions.length) return null

  return (
    <div style={{ height: 340, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
      <MapContainer center={positions[0]} zoom={3} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitAll positions={positions} />
        {shipments.map((shipment, index) => {
          const color = palette[index % palette.length]
          const stopsForShipment = stopGroups.get(shipment.id) ?? []
          const path = shipment.route_polyline?.length
            ? shipment.route_polyline
            : stopsForShipment.map(s => [s.lat, s.lng] as [number, number])
          const current = shipment.current_lat != null && shipment.current_lng != null
            ? [shipment.current_lat, shipment.current_lng] as [number, number]
            : null
          return (
            <Fragment key={shipment.id}>
              {path.length > 1 && <Polyline positions={path} pathOptions={{ color, weight: 3, opacity: 0.8 }} />}
              {stopsForShipment.map(stop => (
                <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={pin(color)}>
                  <Tooltip>{shipment.reference} · {stop.location}</Tooltip>
                </Marker>
              ))}
              {current && (
                <Marker position={current} icon={pin('#ffb627')}>
                  <Tooltip>{shipment.container_no || shipment.reference} · {shipment.current_location || 'Last known position'}</Tooltip>
                </Marker>
              )}
              {shipment.origin_lat != null && shipment.origin_lng != null && (
                <Marker position={[shipment.origin_lat, shipment.origin_lng]} icon={pin('#00c2a8')}>
                  <Tooltip>{shipment.reference} · Origin: {shipment.origin_port || 'Origin'}</Tooltip>
                </Marker>
              )}
              {shipment.destination_lat != null && shipment.destination_lng != null && (
                <Marker position={[shipment.destination_lat, shipment.destination_lng]} icon={pin('#e8a33d')}>
                  <Tooltip>{shipment.reference} · Destination: {shipment.destination_port || 'Destination'}</Tooltip>
                </Marker>
              )}
            </Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}
