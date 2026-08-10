import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Shipment, ShipmentStop } from '../lib/types'
import RouteMap from '../components/RouteMap'
import Ledger from '../components/Ledger'

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function daysBetween(a: string, b: string) {
  const ms = new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}

const statusMeta: Record<string, { label: string; color: string }> = {
  in_transit: { label: 'Sailing', color: 'var(--teal)' },
  delayed: { label: 'Delayed', color: 'var(--red)' },
  delivered: { label: 'Delivered', color: 'var(--teal)' },
}

export default function Track() {
  const { slug } = useParams()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [stops, setStops] = useState<ShipmentStop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: sData, error: sErr } = await supabase
        .from('shipments')
        .select('*')
        .eq('slug', slug)
        .single()
      if (sErr || !sData) {
        if (!cancelled) {
          setError('No shipment found for this link.')
          setLoading(false)
        }
        return
      }
      const { data: stopsData } = await supabase
        .from('shipment_stops')
        .select('*')
        .eq('shipment_id', sData.id)
        .order('seq', { ascending: true })
      if (!cancelled) {
        setShipment(sData as Shipment)
        setStops((stopsData ?? []) as ShipmentStop[])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return <Centered>Loading shipment…</Centered>
  }
  if (error || !shipment) {
    return (
      <Centered>
        <p style={{ color: 'var(--muted)' }}>{error ?? 'Shipment not found.'}</p>
        <Link to="/" style={{ color: 'var(--teal)' }}>
          Back home
        </Link>
      </Centered>
    )
  }

  const meta = statusMeta[shipment.status] ?? statusMeta.in_transit
  const transitDays =
    shipment.departure_date && shipment.current_eta
      ? daysBetween(shipment.departure_date, shipment.current_eta)
      : null
  const delayDays =
    shipment.first_eta && shipment.current_eta ? daysBetween(shipment.first_eta, shipment.current_eta) : 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            {shipment.customer_name ?? 'Shipment tracking'}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '2px 0 0', fontWeight: 600 }}>
            {shipment.reference}
          </h1>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px solid ${meta.color}`,
            color: meta.color,
          }}
        >
          {meta.label.toUpperCase()}
        </span>
      </header>

      <div style={{ height: 'min(52vh, 520px)', width: '100%' }}>
        <RouteMap shipment={shipment} stops={stops} />
      </div>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, width: '100%' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Card label="Route">
            <span className="mono">{shipment.origin_port}</span> →{' '}
            <span className="mono">{shipment.destination_port}</span>
            {transitDays != null && (
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                {transitDays} day{transitDays === 1 ? '' : 's'} total transit
              </div>
            )}
          </Card>
          <Card label="ETA">
            <span className="mono">{fmt(shipment.current_eta)}</span>
            {delayDays > 0 && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 4 }}>
                {delayDays} day{delayDays === 1 ? '' : 's'} delay (was {fmt(shipment.first_eta)})
              </div>
            )}
          </Card>
          <Card label="Container">
            <span className="mono">{shipment.container_no ?? '—'}</span>
            {shipment.container_type && (
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{shipment.container_type}</div>
            )}
          </Card>
          <Card label="Carrier / vessel">
            {shipment.carrier ?? '—'}
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{shipment.vessel ?? '—'}</div>
          </Card>
        </div>

        {shipment.co2_tons != null && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
            Estimated CO₂: <span className="mono">{shipment.co2_tons} tons</span>
          </p>
        )}

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
          Movements
        </h2>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--panel)' }}>
          <Ledger stops={stops} />
        </div>
      </main>

      <footer style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
        Tracking link · powered by Container Tracker
      </footer>
    </div>
  )
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15 }}>{children}</div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {children}
    </div>
  )
}
