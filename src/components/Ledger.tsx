import type { ShipmentStop } from '../lib/types'

function fmt(d: string | null) {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Ledger({ stops }: { stops: ShipmentStop[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr style={{ background: 'var(--panel-2)' }}>
            {['#', 'Location', 'Move', 'Date', 'Vessel', ''].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stops.map((s, i) => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '10px 14px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {String(i + 1).padStart(2, '0')}
              </td>
              <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                {s.location}
                {s.is_transshipment && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    TS
                  </span>
                )}
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{s.move ?? '—'}</td>
              <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{fmt(s.move_date)}</td>
              <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 13 }}>{s.vessel ?? '—'}</td>
              <td style={{ padding: '10px 14px' }}>
                {s.completed ? (
                  <span style={{ color: 'var(--teal)' }}>●</span>
                ) : (
                  <span style={{ color: 'var(--line)' }}>○</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
