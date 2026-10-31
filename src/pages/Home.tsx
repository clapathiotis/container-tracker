import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link to="/" className="brand">
          <span className="brand-mark">CT</span>
          <span>CONTAINER<span className="brand-light">TRACKER</span></span>
        </Link>
        <div className="landing-nav-links">
          <a href="#platform">Platform</a>
          <a href="#tracking">Tracking</a>
          <Link to="/admin" className="nav-admin">Admin sign in</Link>
          <Link to="/account" className="nav-cta">Open customer portal <span aria-hidden="true">↗</span></Link>
        </div>
      </nav>

      <section className="hero" id="platform">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> GLOBAL SHIPMENT VISIBILITY</div>
          <h1>Your cargo.<br /><span>In clear view.</span></h1>
          <p className="hero-lede">
            One intelligent workspace for every container, every milestone and every delivery.
            Know where your shipments are — and what happens next.
          </p>
          <div className="hero-actions">
            <Link to="/account" className="button-primary">Go to customer portal <span aria-hidden="true">→</span></Link>
            <Link to="/admin" className="button-secondary">Admin workspace</Link>
          </div>
          <div className="hero-proof">
            <span className="proof-icon">⌖</span>
            <span>Live shipment visibility</span>
            <i />
            <span>Milestone tracking</span>
            <i />
            <span>One unified view</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Illustration of a container shipment route">
          <div className="visual-topline"><span>GLOBAL NETWORK</span><span className="visual-status"><b /> ROUTE OVERVIEW</span></div>
          <div className="route-map">
            <div className="map-grid" />
            <svg className="route-svg" viewBox="0 0 560 360" role="img" aria-label="Illustrative route from Shanghai to Limassol">
              <path className="route-glow" d="M95 245 C175 80 260 300 340 165 S445 90 485 110" />
              <path className="route-dash" d="M95 245 C175 80 260 300 340 165 S445 90 485 110" />
              <circle cx="95" cy="245" r="7" className="route-point origin" />
              <circle cx="340" cy="165" r="6" className="route-point transit" />
              <circle cx="485" cy="110" r="7" className="route-point destination" />
              <circle cx="485" cy="110" r="17" className="route-pulse" />
            </svg>
            <div className="map-label label-origin"><small>ORIGIN</small><strong>Shanghai</strong><span>China</span></div>
            <div className="map-label label-transit"><small>IN TRANSIT</small><strong>Indian Ocean</strong></div>
            <div className="map-label label-destination"><small>DESTINATION</small><strong>Limassol</strong><span>Cyprus</span></div>
            <div className="ship-marker">▰</div>
          </div>
          <div className="visual-footer">
            <div><small>SHIPMENT STATUS</small><strong><span className="live-dot" /> On the move</strong></div>
            <div><small>TRACKING EXPERIENCE</small><strong>One connected journey</strong></div>
            <div className="visual-arrow">↗</div>
          </div>
        </div>
      </section>

      <section className="feature-strip" id="tracking">
        <article><span className="feature-number">01</span><div><h3>See the whole journey</h3><p>Follow routes, ports and transshipments in one clear timeline.</p></div></article>
        <article><span className="feature-number">02</span><div><h3>Stay ahead of changes</h3><p>Keep ETAs, delays and shipment milestones close at hand.</p></div></article>
        <article><span className="feature-number">03</span><div><h3>Share with confidence</h3><p>Give customers a private tracking view without exposing your workspace.</p></div></article>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Container Tracker</span>
        <span>Clarity across every mile.</span>
      </footer>
    </main>
  )
}
