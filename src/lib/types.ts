export type ShipmentStatus = 'in_transit' | 'delivered' | 'delayed'

export interface Shipment {
  id: string
  slug: string
  reference: string
  customer_name: string | null
  carrier: string | null
  container_no: string | null
  container_type: string | null
  booking_no: string | null
  vessel: string | null
  origin_port: string
  destination_port: string
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  departure_date: string | null
  first_eta: string | null
  current_eta: string | null
  status: ShipmentStatus
  co2_tons: number | null
  current_lat: number | null
  current_lng: number | null
  current_location: string | null
  created_at: string
  updated_at: string
}

export interface ShipmentStop {
  id: string
  shipment_id: string
  seq: number
  location: string
  lat: number
  lng: number
  is_transshipment: boolean
  move: string | null
  move_date: string | null
  vessel: string | null
  completed: boolean
}
