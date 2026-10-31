import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Shipment, ShipmentStop } from '../lib/types'
import RouteMap from '../components/RouteMap'
import Ledger from '../components/Ledger'

function fmt(d: string | null) {
  if (!d) return 'Not available'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

const statusMeta: Record<string, { label: string; icon: string }> = {
  in_transit: { label: 'Sailing', icon: '↗' },
  delayed: { label: 'Delayed', icon: '!' },
  delivered: { label: 'Delivered', icon: '✓' },
}

export default function Track() {
  const { slug } = useParams()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [stops, setStops] = useState<ShipmentStop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'movements' | 'details'>('movements')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error: trackingError } = await supabase.functions.invoke('public-tracking', { body: { slug: slug ?? '' } })
      if (trackingError || !data?.shipment) {
        if (!cancelled) { setError('No shipment found for this tracking link.'); setLoading(false) }
        return
      }
      if (!cancelled) {
        setShipment(data.shipment as Shipment)
        setStops((data.stops ?? []) as ShipmentStop[])
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [slug])

  const routeStops = useMemo(() => {
    const seen = new Set<string>()
    return stops.filter(s => {
      const key = s.location.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [stops])

  if (loading) return <Centered><div className="track-loader"/><p>Loading shipment intelligence…</p></Centered>
  if (error || !shipment) return <Centered><p>{error ?? 'Shipment not found.'}</p><Link to="/" className="track-back">Back to home</Link></Centered>

  const meta = statusMeta[shipment.status] ?? statusMeta.in_transit
  const transitDays = shipment.departure_date && shipment.current_eta ? daysBetween(shipment.departure_date, shipment.current_eta) : null
  const delayDays = shipment.first_eta && shipment.current_eta ? daysBetween(shipment.first_eta, shipment.current_eta) : 0
  const lastSynced = shipment.last_synced_at ? new Date(shipment.last_synced_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Awaiting carrier update'

  async function copyContainer() {
    if (!shipment?.container_no) return
    try {
      await navigator.clipboard.writeText(shipment.container_no)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }

  return (
    <div className="tracking-shell">
      <header className="tracking-topbar">
        <Link to="/" className="tracking-brand"><span className="tracking-brand-mark">▥</span><span>CONTAINER TRACKER</span></Link>
        <span className="tracking-topbar-note">GLOBAL SHIPMENT VISIBILITY</span>
      </header>

      <main className="tracking-main">
        <section className="tracking-hero">
          <div>
            <div className="tracking-eyebrow">SHIPMENT TRACKING <span className="tracking-live-dot"/></div>
            <div className="tracking-title-row">
              <h1>{shipment.reference}</h1>
              {shipment.container_no && <button className="tracking-copy" onClick={copyContainer} aria-label="Copy container number">{copied ? 'Copied' : 'Copy ID'}</button>}
            </div>
            <p className="tracking-subtitle">{shipment.carrier || 'Carrier tracking'}{shipment.vessel ? ` · ${shipment.vessel}` : ''}</p>
          </div>
          <span className={`tracking-status tracking-status-${shipment.status}`}><i>{meta.icon}</i>{meta.label}</span>
        </section>

        {routeStops.length > 1 && (
          <section className="tracking-progress" aria-label="Shipment route progress">
            {routeStops.map((stop, i) => {
              const completed = stop.completed
              const isLast = i === routeStops.length - 1
              return <div className={`tracking-progress-stop ${completed ? 'is-complete' : ''} ${isLast && !completed ? 'is-current' : ''}`} key={stop.id}>
                <span className="tracking-progress-node">{completed ? '✓' : isLast ? '●' : String(i + 1).padStart(2, '0')}</span>
                <span className="tracking-progress-name">{stop.location.replace(/ TERMINAL.*/i, '').replace(/ FREEPORT.*/i, '')}</span>
              </div>
            })}
          </section>
        )}

        <section className="tracking-map-section">
          <div className="tracking-section-heading">
            <div><span className="tracking-kicker">LIVE ROUTE OVERVIEW</span><h2>Journey map</h2></div>
            <span className="tracking-map-caption"><i/> Carrier milestones</span>
          </div>
          <div className="tracking-map-frame">
            <RouteMap shipment={shipment} stops={stops} />
            <div className="tracking-map-legend"><span><i className="legend-done"/> Completed</span><span><i className="legend-pending"/> Upcoming</span></div>
          </div>
          <p className="tracking-map-disclaimer">Route visualization is based on reported port milestones. It is not a live vessel GPS position.</p>
        </section>

        <section className="tracking-metrics">
          <article className="tracking-metric tracking-metric-route"><span className="metric-icon">⌁</span><span className="metric-label">ROUTE</span><strong>{shipment.origin_port || 'Origin pending'} <b>→</b> {shipment.destination_port || 'Destination pending'}</strong>{transitDays != null && <small>{transitDays} days estimated transit</small>}</article>
          <article className="tracking-metric"><span className="metric-icon">◷</span><span className="metric-label">ESTIMATED ARRIVAL</span><strong>{fmt(shipment.current_eta)}</strong>{delayDays > 0 && <small className="metric-alert">{delayDays} days later than first estimate</small>}</article>
          <article className="tracking-metric"><span className="metric-icon">▤</span><span className="metric-label">CONTAINER</span><strong className="metric-mono">{shipment.container_no || '—'}</strong><small>{shipment.container_type || 'Container tracking'}</small></article>
          <article className="tracking-metric"><span className="metric-icon">船</span><span className="metric-label">CARRIER & VESSEL</span><strong>{shipment.carrier || 'Not available'}</strong><small>{shipment.vessel || 'Vessel not reported'}</small></article>
        </section>

        <section className="tracking-activity">
          <div className="tracking-activity-head">
            <div><span className="tracking-kicker">CARRIER EVENT HISTORY</span><h2>Shipment activity</h2></div>
            <span className="tracking-event-count">{stops.length} EVENTS</span>
          </div>
          <div className="tracking-tabs" role="tablist">
            <button className={activeTab === 'movements' ? 'active' : ''} onClick={() => setActiveTab('movements')}>☷ <span>Movements</span><b>{stops.length}</b></button>
            <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>ⓘ <span>Details</span></button>
          </div>
          {activeTab === 'movements' ? <Ledger stops={stops} /> : (
            <div className="tracking-details-grid">
              <Detail label="Container number" value={shipment.container_no}/>
              <Detail label="Booking reference" value={shipment.booking_no}/>
              <Detail label="Carrier" value={shipment.carrier}/>
              <Detail label="Vessel" value={shipment.vessel}/>
              <Detail label="Departure" value={fmt(shipment.departure_date)}/>
              <Detail label="First ETA" value={fmt(shipment.first_eta)}/>
              <Detail label="Last updated" value={lastSynced}/>
              <Detail label="Estimated emissions" value={shipment.co2_tons != null ? `${shipment.co2_tons} tonnes CO₂` : null}/>
            </div>
          )}
        </section>
      </main>
      <footer className="tracking-footer"><span className="tracking-brand-mark">▥</span><span>Container Tracker</span><i/>Secure shipment visibility<span className="tracking-footer-spacer"/><span>Last sync: {lastSynced}</span></footer>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="tracking-detail"><span>{label}</span><strong>{value || 'Not available'}</strong></div>
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="tracking-centered">{children}</div>
}
