import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CustomerMap from '../components/CustomerMap'

type Order = {
  id: string
  input_type: string
  input_reference: string
  package_code: string
  status: string
  amount_minor: number
  currency: string
  created_at: string
}

type CustomerShipment = {
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

const panel: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 18,
}

const primary: React.CSSProperties = {
  background: 'var(--teal)',
  color: '#04140f',
  border: 0,
  borderRadius: 8,
  padding: '10px 16px',
  fontWeight: 600,
  cursor: 'pointer',
}

const ghost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '10px 16px',
  cursor: 'pointer',
}

export default function Account() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [shipments, setShipments] = useState<CustomerShipment[]>([])
  const [shipmentStops, setShipmentStops] = useState<any[]>([])
  const [profile, setProfile] = useState<{ full_name: string | null; company_name: string | null } | null>(null)
  const [preferences, setPreferences] = useState<{ email_enabled: boolean; eta_change_alerts: boolean; milestone_alerts: boolean; delay_alerts: boolean } | null>(null)
  const [orderLinks, setOrderLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setChecking(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setOrders([])
      setShipments([])
      setProfile(null)
      setPreferences(null)
      return
    }
    let cancelled = false
    async function load() {
      const [profileRes, ordersRes, preferencesRes] = await Promise.all([
        supabase.from('customers').select('full_name, company_name').eq('id', session!.user.id).single(),
        supabase.from('tracking_orders')
          .select('id, input_type, input_reference, package_code, status, amount_minor, currency, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('notification_preferences').select('email_enabled, eta_change_alerts, milestone_alerts, delay_alerts').eq('customer_id', session!.user.id).maybeSingle(),
      ])
      if (cancelled) return
      if (profileRes.data) setProfile(profileRes.data)
      if (preferencesRes.data) setPreferences(preferencesRes.data)
      if (ordersRes.error) {
        setError(ordersRes.error.message)
        return
      }
      const nextOrders = (ordersRes.data ?? []) as Order[]
      setOrders(nextOrders)
      if (!nextOrders.length) {
        setShipments([])
        return
      }
      const linksRes = await supabase
        .from('order_shipments')
        .select('order_id, shipments(id, slug, reference, container_no, carrier, vessel, origin_port, destination_port, current_eta, status, origin_lat, origin_lng, destination_lat, destination_lng, current_lat, current_lng, current_location, route_polyline)')
        .in('order_id', nextOrders.map(o => o.id))
      if (cancelled) return
      if (linksRes.error) {
        setError(linksRes.error.message)
        return
      }
      const unique = new Map<string, CustomerShipment>()
      for (const row of (linksRes.data ?? []) as any[]) {
        const shipment = row.shipments as CustomerShipment | null
        if (shipment) unique.set(shipment.id, shipment)
      }
      const shipmentRows = [...unique.values()]
      setShipments(shipmentRows)
      const stopsRes = shipmentRows.length
        ? await supabase.from('shipment_stops').select('id, shipment_id, location, lat, lng, seq').in('shipment_id', shipmentRows.map(s => s.id)).order('seq', { ascending: true })
        : { data: [], error: null }
      if (cancelled) return
      if (stopsRes.error) setError(stopsRes.error.message)
      setShipmentStops(stopsRes.data ?? [])
    }
    void load()
    return () => { cancelled = true }
  }, [session])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), company_name: companyName.trim() } },
      })
      if (signUpError) setError(signUpError.message)
      else if (!data.session) setMessage('Account created. Check your email to confirm your address, then sign in.')
      else setMessage('Your account is ready.')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) setError(signInError.message)
    }
    setBusy(false)
  }

  async function createOrderLink(orderId: string) {
    setBusy(true)
    setError('')
    const { data, error: linkError } = await supabase.functions.invoke('create-order-link', { body: { order_id: orderId } })
    if (linkError || !data?.token) {
      setError(data?.error || linkError?.message || 'Could not create tracking link.')
    } else {
      const url = `${window.location.origin}${import.meta.env.BASE_URL}#/o/${data.token}`
      setOrderLinks(current => ({ ...current, [orderId]: url }))
      try { await navigator.clipboard.writeText(url) } catch { /* link remains visible for manual copying */ }
      setMessage('Private consolidated tracking link created.')
    }
    setBusy(false)
  }

  async function savePreferences() {
    if (!session || !preferences) return
    setBusy(true)
    setError('')
    const { error: saveError } = await supabase.from('notification_preferences').update({
      ...preferences,
      updated_at: new Date().toISOString(),
    }).eq('customer_id', session.user.id)
    if (saveError) setError(saveError.message)
    else setMessage('Notification preferences updated.')
    setBusy(false)
  }

  async function saveProfile() {
    if (!session) return
    setBusy(true)
    setError('')
    const { error: saveError } = await supabase.from('customers').update({
      full_name: profile?.full_name ?? null,
      company_name: profile?.company_name ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', session.user.id)
    if (saveError) setError(saveError.message)
    else setMessage('Profile updated.')
    setBusy(false)
  }

  if (checking) return <Center>Loading account…</Center>

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
        <form onSubmit={submit} style={{ ...panel, width: 'min(100%, 420px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>← Container Tracker</Link>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase' }}>Customer portal</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: 0 }}>
            {mode === 'signin' ? 'Sign in to your shipments' : 'Create your account'}
          </h1>
          {mode === 'signup' && <>
            <Field label="Full name" value={fullName} onChange={setFullName} required />
            <Field label="Company (optional)" value={companyName} onChange={setCompanyName} />
          </>}
          <Field label="Email" value={email} onChange={setEmail} type="email" required />
          <Field label="Password" value={password} onChange={setPassword} type="password" required />
          {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
          {message && <p style={{ color: 'var(--teal)', fontSize: 13, margin: 0 }}>{message}</p>}
          <button type="submit" disabled={busy} style={primary}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          <button type="button" style={ghost} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>
            {mode === 'signin' ? 'Create a customer account' : 'Already have an account? Sign in'}
          </button>
        </form>
      </main>
    )
  }

  const activeShipments = shipments.filter(s => !['delivered', 'cancelled'].includes(s.status))
  const deliveredShipments = shipments.filter(s => s.status === 'delivered')
  const delayedShipments = shipments.filter(s => s.status === 'delayed')
  return (
    <div className="portal">
      <aside className="portal-sidebar">
        <Link to="/" className="portal-brand"><span className="portal-brand-icon">C</span><span>Container<span>Tracker</span></span></Link>
        <div className="portal-nav-label">WORKSPACE</div>
        <a className="portal-nav-item active" href="#dashboard"><span>▦</span> Dashboard</a>
        <a className="portal-nav-item" href="#shipments"><span>▤</span> Shipments <small>{shipments.length}</small></a>
        <a className="portal-nav-item" href="#orders"><span>▧</span> Orders</a>
        <a className="portal-nav-item" href="#notifications"><span>♧</span> Notifications</a>
        <div className="portal-nav-label portal-nav-bottom">ACCOUNT</div>
        <a className="portal-nav-item" href="#profile"><span>◉</span> Profile & settings</a>
        <div className="portal-sidebar-footer"><div className="portal-avatar">{(profile?.company_name || profile?.full_name || session.user.email || 'C').charAt(0).toUpperCase()}</div><div><strong>{profile?.company_name || profile?.full_name || 'Your account'}</strong><small>{session.user.email}</small></div></div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar"><div className="portal-breadcrumb">Workspace <span>/</span> <strong>Dashboard</strong></div><div className="portal-top-actions"><span className="portal-secure">● Secure customer portal</span><button className="portal-signout" onClick={() => supabase.auth.signOut()}>Sign out ↗</button></div></header>
        <main className="portal-content" id="dashboard">
          <section className="portal-welcome"><div><div className="portal-kicker">CUSTOMER OVERVIEW</div><h1>Welcome back, {profile?.company_name || profile?.full_name || 'there'}.</h1><p>Here’s what’s happening with your shipments today.</p></div><button className="portal-primary" onClick={() => document.getElementById('shipments')?.scrollIntoView({ behavior: 'smooth' })}>＋ Track a container</button></section>
          <section className="portal-stats">
            <article className="portal-stat"><span className="portal-stat-icon blue">▣</span><div><small>Active shipments</small><strong>{activeShipments.length}</strong><em>Currently moving</em></div></article>
            <article className="portal-stat"><span className="portal-stat-icon green">✓</span><div><small>Delivered</small><strong>{deliveredShipments.length}</strong><em>Successfully completed</em></div></article>
            <article className="portal-stat"><span className="portal-stat-icon red">◷</span><div><small>Delayed</small><strong>{delayedShipments.length}</strong><em>Need your attention</em></div></article>
            <article className="portal-stat"><span className="portal-stat-icon slate">▤</span><div><small>Total orders</small><strong>{orders.length}</strong><em>Across your account</em></div></article>
          </section>
          <section className="portal-section" id="shipments">
            <div className="portal-section-heading"><div><h2>Your shipments</h2><p>Monitor every container from origin to destination.</p></div><span className="portal-count">{shipments.length} total</span></div>
            {shipments.length > 0 ? <><div className="portal-map-card"><div className="portal-map-heading"><div><strong>Global shipment map</strong><small>All your active journeys in one view</small></div><span>● Overview</span></div><CustomerMap shipments={shipments} stops={shipmentStops} /></div>
              <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>CONTAINER</th><th>ROUTE</th><th>STATUS</th><th>EST. ARRIVAL</th><th>CARRIER</th><th></th></tr></thead><tbody>{shipments.map(s => <tr key={s.id}><td><strong className="portal-container">{s.container_no || s.reference}</strong><small>{s.reference}</small></td><td><strong>{s.origin_port || 'Origin pending'}</strong><span className="portal-route-arrow">→</span><strong>{s.destination_port || 'Destination pending'}</strong></td><td><span className={s.status === 'delayed' ? 'portal-status is-delayed' : s.status === 'delivered' ? 'portal-status is-delivered' : 'portal-status is-transit'}>{s.status.replace('_',' ')}</span></td><td>{s.current_eta ? new Date(s.current_eta + 'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td><td>{s.carrier || '—'}</td><td><Link className="portal-view-link" to={'/t/' + s.slug}>View details →</Link></td></tr>)}</tbody></table></div>
              <div className="portal-mobile-shipments">{shipments.map(s => <article className="portal-mobile-shipment" key={s.id}><div className="portal-mobile-shipment-top"><strong>{s.container_no || s.reference}</strong><span className={s.status === 'delayed' ? 'portal-status is-delayed' : s.status === 'delivered' ? 'portal-status is-delivered' : 'portal-status is-transit'}>{s.status.replace('_',' ')}</span></div><p>{s.origin_port || 'Origin pending'} <b>→</b> {s.destination_port || 'Destination pending'}</p><div className="portal-mobile-shipment-bottom"><small>ETA · {s.current_eta || 'Not available'}</small><Link to={'/t/' + s.slug}>Details →</Link></div></article>)}</div></> : <div className="portal-empty"><span>▤</span><strong>No shipments yet</strong><p>Your containers will appear here once a tracking order is active.</p></div>}
          </section>
          <section className="portal-section" id="orders"><div className="portal-section-heading"><div><h2>Recent orders</h2><p>View tracking purchases and private sharing links.</p></div></div>
            {orders.length === 0 ? <div className="portal-empty compact">No orders yet.</div> : <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>REFERENCE</th><th>PACKAGE</th><th>STATUS</th><th>AMOUNT</th><th>DATE</th><th>TRACKING LINK</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td><strong>{o.input_reference}</strong></td><td>{o.package_code}</td><td>{o.status}</td><td>{(o.amount_minor / 100).toFixed(2)} {o.currency}</td><td>{new Date(o.created_at).toLocaleDateString()}</td><td>{orderLinks[o.id] ? <a className="portal-view-link" href={orderLinks[o.id]} target="_blank" rel="noreferrer">Open link ↗</a> : ['paid','processing','active'].includes(o.status) ? <button className="portal-small-button" disabled={busy} onClick={() => createOrderLink(o.id)}>Create link</button> : '—'}</td></tr>)}</tbody></table></div>}
          </section>
          {error && <div className="portal-alert error">{error}</div>}{message && <div className="portal-alert">{message}</div>}
          <section className="portal-settings-grid">
            <article className="portal-settings-card" id="notifications"><div className="portal-section-heading"><div><h2>Notifications</h2><p>Choose the updates you want by email.</p></div></div>{preferences && <div className="portal-preferences">{([['email_enabled','Email notifications'],['eta_change_alerts','ETA changes'],['milestone_alerts','Shipment milestones'],['delay_alerts','Delay alerts']] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={preferences[key]} onChange={e => setPreferences(p => p ? {...p,[key]:e.target.checked} : p)} /><span>{label}</span></label>)}</div>}<button className="portal-secondary" disabled={busy || !preferences} onClick={savePreferences}>Save preferences</button></article>
            <article className="portal-settings-card" id="profile"><div className="portal-section-heading"><div><h2>Profile details</h2><p>Manage your account information.</p></div></div><div className="portal-profile-fields"><Field label="Full name" value={profile?.full_name ?? ''} onChange={v => setProfile(p => ({full_name:v,company_name:p?.company_name ?? null}))} /><Field label="Company" value={profile?.company_name ?? ''} onChange={v => setProfile(p => ({full_name:p?.full_name ?? null,company_name:v}))} /></div><button className="portal-secondary" disabled={busy || !profile} onClick={saveProfile}>Save profile</button></article>
          </section>
        </main>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--muted)', fontSize: 12 }}>
    {label}
    <input required={required} type={type} value={value} onChange={e => onChange(e.target.value)}
      style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 7, padding: '10px 11px', color: 'var(--text)', fontSize: 14 }} />
  </label>
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>{children}</div>
}
