import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CustomerMap from '../components/CustomerMap'

type Shipment = {
  id: string
  slug: string
  reference: string
  container_no: string | null
  carrier: string | null
  vessel: string | null
  origin_port: string | null
  destination_port: string | null
  current_eta: string | null
  status: string
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  current_lat: number | null
  current_lng: number | null
  current_location: string | null
  route_polyline: [number, number][] | null
}

export default function PublicOrderTrack() {
  const { token } = useParams()
  const [order, setOrder] = useState<{ reference: string; package_code: string } | null>(null)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [stops, setStops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error: requestError } = await supabase.functions.invoke('public-order-tracking', {
        body: { token: token ?? '' },
      })
      if (cancelled) return
      if (requestError || !data?.order) {
        setError('This tracking link is invalid, expired or no longer active.')
      } else {
        setOrder(data.order)
        setShipments(data.shipments ?? [])
        setStops(data.stops ?? [])
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  if (loading) return <Center>Loading your shipment overview…</Center>
  if (error || !order) return <Center><p>{error || 'Tracking details unavailable.'}</p><Link to="/" style={{ color: 'var(--teal)' }}>Back to home</Link></Center>

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Container Tracker · Shipment overview</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: '5px 0' }}>Your shipments</h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>Reference: {order.reference}</p>
      </header>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Consolidated route map</h2>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{shipments.length} container{shipments.length === 1 ? '' : 's'}</span>
        </div>
        {shipments.length ? <CustomerMap shipments={shipments} stops={stops} /> : (
          <div style={{ padding: 30, border: '1px solid var(--line)', borderRadius: 12, textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>Tracking is being prepared</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Your order is confirmed. Shipment details will appear here as soon as the carrier returns the tracking data.</p>
          </div>
        )}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 18 }}>
          {shipments.map(s => (
            <article key={s.id} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{s.container_no || s.reference}</strong>
                <span style={{ color: s.status === 'delayed' ? 'var(--red)' : 'var(--teal)', fontSize: 11, textTransform: 'uppercase' }}>{s.status.replace('_', ' ')}</span>
              </div>
              <p style={{ fontSize: 13 }}>{s.origin_port || 'Origin pending'} → {s.destination_port || 'Destination pending'}</p>
              <p style={{ color: 'var(--muted)', fontSize: 12 }}>ETA: {s.current_eta || 'Not available'} · {s.carrier || 'Carrier pending'}</p>
              <Link to={`/t/${s.slug}`} style={{ color: 'var(--teal)', fontSize: 13 }}>Detailed tracking →</Link>
            </article>
          ))}
        </section>
      </main>
      <footer style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Private shipment overview · powered by Container Tracker</footer>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, color: 'var(--muted)' }}>{children}</div>
}
