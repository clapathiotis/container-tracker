import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase' }}>
        Container Tracker
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, maxWidth: 480 }}>
        Live routes for every container on the water.
      </h1>
      <p style={{ color: 'var(--muted)', maxWidth: 420 }}>
        Open a tracking link from an email, or sign in to manage shipments.
      </p>
      <Link
        to="/admin"
        style={{
          marginTop: 8,
          background: 'var(--teal)',
          color: '#04140f',
          padding: '10px 20px',
          borderRadius: 8,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Admin sign in
      </Link>
    </div>
  )
}
