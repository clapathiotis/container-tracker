import type { ShipmentStop } from '../lib/types'

function fmt(d: string | null) {
  if (!d) return 'Date unavailable'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function eventIcon(move: string | null) {
  const value = (move ?? '').toLowerCase()
  if (value.includes('depart') || value.includes('sail') || value.includes('loaded')) return '↗'
  if (value.includes('arriv') || value.includes('gate in')) return '⚓'
  if (value.includes('discharg')) return '▤'
  if (value.includes('gate out')) return '⇥'
  return '•'
}

export default function Ledger({ stops }: { stops: ShipmentStop[] }) {
  if (!stops.length) return <div className="tracking-empty-events">Carrier movement events will appear here when reported.</div>
  return (
    <div className="tracking-timeline">
      {stops.slice().reverse().map((s, i) => (
        <article className={`tracking-event ${s.completed ? 'event-complete' : 'event-pending'}`} key={s.id}>
          <div className="tracking-event-rail"><span>{s.completed ? '✓' : eventIcon(s.move)}</span>{i !== stops.length - 1 && <i/>}</div>
          <div className="tracking-event-content">
            <div className="tracking-event-top"><strong>{s.location || 'Location not supplied'}</strong><time>{fmt(s.move_date)}</time></div>
            <p>{s.move || 'Shipment update'}</p>
            {s.vessel && <small>Vessel · {s.vessel}</small>}
            {s.is_transshipment && <em>TRANSSHIPMENT</em>}
          </div>
          <span className={`tracking-event-state ${s.completed ? 'done' : ''}`}>{s.completed ? 'CONFIRMED' : 'SCHEDULED'}</span>
        </article>
      ))}
    </div>
  )
}
