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

  return (
    <div className="customer-shell" style={{ minHeight: '100vh' }}>
      <header className="customer-header" style={{ borderBottom: '1px solid var(--line)', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Link to="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 12 }}>Container Tracker</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: '4px 0 0' }}>Your shipments</h1>
        </div>
        <button style={ghost} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <main className="customer-content" style={{ maxWidth: 1100, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section style={panel}>
          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Account</div>
          <h2 style={{ fontSize: 18, margin: '6px 0' }}>{profile?.company_name || profile?.full_name || session.user.email}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>{session.user.email}</p>
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>Shipment overview</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>All shipments attached to your paid tracking orders.</p>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{shipments.length} shipment{shipments.length === 1 ? '' : 's'}</span>
          </div>
          {shipments.length > 0 && <div style={{ marginBottom: 12 }}>
            <CustomerMap shipments={shipments} stops={shipmentStops} />
          </div>}
          {shipments.length === 0 ? (
            <div style={{ ...panel, padding: 30, textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>No tracked shipments yet</h3>
              <p style={{ color: 'var(--muted)', maxWidth: 480, margin: '0 auto', fontSize: 14 }}>
                Once you place a tracking order, your containers will appear here together with their routes, ETAs and movement history.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {shipments.map(s => (
                <article key={s.id} style={panel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{s.reference}</strong>
                    <span style={{ color: s.status === 'delayed' ? 'var(--red)' : 'var(--teal)', fontSize: 11, textTransform: 'uppercase' }}>{s.status.replace('_', ' ')}</span>
                  </div>
                  <p className="mono" style={{ color: 'var(--muted)', fontSize: 13 }}>{s.container_no || 'Container details pending'}</p>
                  <p style={{ fontSize: 13 }}>{s.origin_port || 'Origin pending'} → {s.destination_port || 'Destination pending'}</p>
                  <p style={{ color: 'var(--muted)', fontSize: 12 }}>ETA: {s.current_eta || 'Not available'} · {s.carrier || 'Carrier pending'}</p>
                  <Link to={`/t/${s.slug}`} style={{ color: 'var(--teal)', fontSize: 13 }}>Open tracking details →</Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Orders</h2>
          {orders.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No orders yet.</p> : (
            <div style={{ ...panel, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Reference','Package','Status','Amount','Date','Tracking link'].map(h => <th key={h} style={{ textAlign: 'left', padding: 12, color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
                <tbody>{orders.map(o => <tr key={o.id}>
                  <td style={{ padding: 12 }}>{o.input_reference}</td>
                  <td style={{ padding: 12 }}>{o.package_code}</td>
                  <td style={{ padding: 12 }}>{o.status}</td>
                  <td style={{ padding: 12 }}>{(o.amount_minor / 100).toFixed(2)} {o.currency}</td>
                  <td style={{ padding: 12 }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: 12 }}>
                    {orderLinks[o.id] ? <a href={orderLinks[o.id]} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)' }}>Open / copy link</a>
                      : ['paid','processing','active'].includes(o.status) ? <button style={ghost} disabled={busy} onClick={() => createOrderLink(o.id)}>Create link</button> : '—'}
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
        {message && <p style={{ color: 'var(--teal)', fontSize: 13 }}>{message}</p>}
        <section style={panel}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Email notifications</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Choose which shipment updates you want to receive by email.</p>
          {preferences && <div style={{ display: 'grid', gap: 10 }}>
            {([
              ['email_enabled', 'Enable email notifications'],
              ['eta_change_alerts', 'ETA changes'],
              ['milestone_alerts', 'Shipment milestones'],
              ['delay_alerts', 'Delay alerts'],
            ] as const).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}>
                <input type="checkbox" checked={preferences[key]} onChange={e => setPreferences(p => p ? { ...p, [key]: e.target.checked } : p)} />
                {label}
              </label>
            ))}
          </div>}
          <button style={{ ...primary, marginTop: 12 }} disabled={busy || !preferences} onClick={savePreferences}>Save notification settings</button>
        </section>

        <section style={panel}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Profile details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <Field label="Full name" value={profile?.full_name ?? ''} onChange={v => setProfile(p => ({ full_name: v, company_name: p?.company_name ?? null }))} />
            <Field label="Company" value={profile?.company_name ?? ''} onChange={v => setProfile(p => ({ full_name: p?.full_name ?? null, company_name: v }))} />
          </div>
          <button style={{ ...primary, marginTop: 12 }} disabled={busy || !profile} onClick={saveProfile}>Save profile</button>
        </section>
      </main>
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
