import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Shipment, ShipmentStop } from '../lib/types'

type StopDraft = Omit<ShipmentStop, 'id' | 'shipment_id'>

const emptyStop: StopDraft = {
  seq: 1,
  location: '',
  lat: 0,
  lng: 0,
  is_transshipment: false,
  move: '',
  move_date: '',
  vessel: '',
  completed: false,
}

const emptyShipment: Partial<Shipment> = {
  reference: '',
  customer_name: '',
  carrier: '',
  container_no: '',
  container_type: '',
  booking_no: '',
  vessel: '',
  origin_port: '',
  destination_port: '',
  origin_lat: undefined,
  origin_lng: undefined,
  destination_lat: undefined,
  destination_lng: undefined,
  departure_date: '',
  first_eta: '',
  current_eta: '',
  status: 'in_transit',
  co2_tons: undefined,
  current_lat: undefined,
  current_lng: undefined,
  current_location: '',
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (checking) return null
  return session ? <Dashboard /> : <Login />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'update-password'>('signin')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    // Supabase redirects here with a recovery token in the URL hash after
    // the person clicks the "reset password" email link.
    if (window.location.hash.includes('type=recovery')) {
      setMode('update-password')
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function sendResetLink() {
    if (!email) {
      setError('Enter your email first, then tap "Forgot password".')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '#/admin',
    })
    if (error) setError(error.message)
    else setNotice('Check your email for a password reset link.')
    setLoading(false)
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    else setNotice('Password set. You are signed in.')
    setLoading(false)
  }

  if (mode === 'update-password') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form
          onSubmit={updatePassword}
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 28,
            width: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '0 0 4px' }}>Set a password</h1>
          <Input label="New password" value={newPassword} onChange={setNewPassword} type="password" />
          {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
          {notice && <p style={{ color: 'var(--teal)', fontSize: 13, margin: 0 }}>{notice}</p>}
          <button type="submit" disabled={loading} style={btnPrimary}>
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form
        onSubmit={submit}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 28,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '0 0 4px' }}>Admin sign in</h1>
        <Input label="Email" value={email} onChange={setEmail} type="email" />
        <Input label="Password" value={password} onChange={setPassword} type="password" />
        {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
        {notice && <p style={{ color: 'var(--teal)', fontSize: 13, margin: 0 }}>{notice}</p>}
        <button type="submit" disabled={loading} style={btnPrimary}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" onClick={sendResetLink} disabled={loading} style={{ ...btnGhost, fontSize: 13 }}>
          Forgot password
        </button>
      </form>
    </div>
  )
}

function Dashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [editing, setEditing] = useState<Shipment | null>(null)
  const [creating, setCreating] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  async function refresh() {
    const { data } = await supabase.from('shipments').select('*').order('created_at', { ascending: false })
    setShipments((data ?? []) as Shipment[])
  }

  useEffect(() => {
    refresh()
  }, [])

  const link = (slug: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/t/${slug}`

  function copyLink(slug: string) {
    navigator.clipboard.writeText(link(slug))
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 1500)
  }

  if (creating || editing) {
    return (
      <ShipmentForm
        shipment={editing}
        onDone={() => {
          setCreating(false)
          setEditing(null)
          refresh()
        }}
        onCancel={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Shipments</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCreating(true)} style={btnPrimary}>
            + New shipment
          </button>
          <button onClick={() => supabase.auth.signOut()} style={btnGhost}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shipments.length === 0 && <p style={{ color: 'var(--muted)' }}>No shipments yet.</p>}
        {shipments.map((s) => (
          <div
            key={s.id}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{s.reference}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                {s.origin_port} → {s.destination_port} · <span className="mono">{s.container_no}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => copyLink(s.slug)} style={btnGhost}>
                {copiedSlug === s.slug ? 'Copied!' : 'Copy link'}
              </button>
              <button onClick={() => setEditing(s)} style={btnGhost}>
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShipmentForm({
  shipment,
  onDone,
  onCancel,
}: {
  shipment: Shipment | null
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Partial<Shipment>>(shipment ?? emptyShipment)
  const [stops, setStops] = useState<StopDraft[]>([{ ...emptyStop }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (shipment) {
      supabase
        .from('shipment_stops')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('seq', { ascending: true })
        .then(({ data }) => {
          if (data && data.length) setStops(data as StopDraft[])
        })
    }
  }, [shipment])

  function set<K extends keyof Shipment>(key: K, value: Shipment[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setStop(i: number, patch: Partial<StopDraft>) {
    setStops((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      let shipmentId = shipment?.id
      const payload = { ...form }
      delete (payload as any).id
      delete (payload as any).created_at
      delete (payload as any).updated_at
      delete (payload as any).slug

      if (shipment) {
        const { error: upErr } = await supabase.from('shipments').update(payload).eq('id', shipment.id)
        if (upErr) throw upErr
        await supabase.from('shipment_stops').delete().eq('shipment_id', shipment.id)
      } else {
        const { data, error: insErr } = await supabase.from('shipments').insert(payload).select().single()
        if (insErr) throw insErr
        shipmentId = data.id
      }

      const stopsPayload = stops
        .filter((s) => s.location)
        .map((s, i) => ({ ...s, seq: i + 1, shipment_id: shipmentId }))
      if (stopsPayload.length) {
        const { error: stopsErr } = await supabase.from('shipment_stops').insert(stopsPayload)
        if (stopsErr) throw stopsErr
      }
      onDone()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>
        {shipment ? 'Edit shipment' : 'New shipment'}
      </h1>

      <Section title="Shipment">
        <Row>
          <Input label="Reference" value={form.reference ?? ''} onChange={(v) => set('reference', v)} />
          <Input label="Customer" value={form.customer_name ?? ''} onChange={(v) => set('customer_name', v)} />
        </Row>
        <Row>
          <Input label="Carrier" value={form.carrier ?? ''} onChange={(v) => set('carrier', v)} />
          <Input label="Vessel" value={form.vessel ?? ''} onChange={(v) => set('vessel', v)} />
        </Row>
        <Row>
          <Input label="Container no" value={form.container_no ?? ''} onChange={(v) => set('container_no', v)} />
          <Input label="Container type" value={form.container_type ?? ''} onChange={(v) => set('container_type', v)} />
          <Input label="Booking no" value={form.booking_no ?? ''} onChange={(v) => set('booking_no', v)} />
        </Row>
      </Section>

      <Section title="Route">
        <Row>
          <Input label="Origin port" value={form.origin_port ?? ''} onChange={(v) => set('origin_port', v)} />
          <Input
            label="Origin lat"
            value={String(form.origin_lat ?? '')}
            onChange={(v) => set('origin_lat', parseFloat(v))}
          />
          <Input
            label="Origin lng"
            value={String(form.origin_lng ?? '')}
            onChange={(v) => set('origin_lng', parseFloat(v))}
          />
        </Row>
        <Row>
          <Input label="Destination port" value={form.destination_port ?? ''} onChange={(v) => set('destination_port', v)} />
          <Input
            label="Destination lat"
            value={String(form.destination_lat ?? '')}
            onChange={(v) => set('destination_lat', parseFloat(v))}
          />
          <Input
            label="Destination lng"
            value={String(form.destination_lng ?? '')}
            onChange={(v) => set('destination_lng', parseFloat(v))}
          />
        </Row>
        <Row>
          <Input label="Departure date" type="date" value={form.departure_date ?? ''} onChange={(v) => set('departure_date', v)} />
          <Input label="First ETA" type="date" value={form.first_eta ?? ''} onChange={(v) => set('first_eta', v)} />
          <Input label="Current ETA" type="date" value={form.current_eta ?? ''} onChange={(v) => set('current_eta', v)} />
        </Row>
        <Row>
          <Select label="Status" value={form.status ?? 'in_transit'} onChange={(v) => set('status', v as Shipment['status'])} options={['in_transit', 'delayed', 'delivered']} />
          <Input label="CO₂ (tons)" value={String(form.co2_tons ?? '')} onChange={(v) => set('co2_tons', parseFloat(v))} />
        </Row>
      </Section>

      <Section title="Live position">
        <Row>
          <Input label="Current location" value={form.current_location ?? ''} onChange={(v) => set('current_location', v)} />
          <Input label="Current lat" value={String(form.current_lat ?? '')} onChange={(v) => set('current_lat', parseFloat(v))} />
          <Input label="Current lng" value={String(form.current_lng ?? '')} onChange={(v) => set('current_lng', parseFloat(v))} />
        </Row>
      </Section>

      <Section title="Movements (in order)">
        {stops.map((s, i) => (
          <div
            key={i}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 }}
          >
            <Row>
              <Input label="Location" value={s.location} onChange={(v) => setStop(i, { location: v })} />
              <Input label="Lat" value={String(s.lat)} onChange={(v) => setStop(i, { lat: parseFloat(v) || 0 })} />
              <Input label="Lng" value={String(s.lng)} onChange={(v) => setStop(i, { lng: parseFloat(v) || 0 })} />
            </Row>
            <Row>
              <Input label="Move" value={s.move ?? ''} onChange={(v) => setStop(i, { move: v })} />
              <Input label="Date" type="date" value={s.move_date ?? ''} onChange={(v) => setStop(i, { move_date: v })} />
              <Input label="Vessel" value={s.vessel ?? ''} onChange={(v) => setStop(i, { vessel: v })} />
            </Row>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={s.is_transshipment}
                  onChange={(e) => setStop(i, { is_transshipment: e.target.checked })}
                />
                Transshipment
              </label>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={s.completed}
                  onChange={(e) => setStop(i, { completed: e.target.checked })}
                />
                Completed
              </label>
              <button
                type="button"
                onClick={() => setStops((arr) => arr.filter((_, idx) => idx !== i))}
                style={{ ...btnGhost, marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setStops((s) => [...s, { ...emptyStop }])} style={btnGhost}>
          + Add movement
        </button>
      </Section>

      {error && <p style={{ color: 'var(--red)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} style={btnGhost}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>{children}</div>
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '8px 10px',
          color: 'var(--text)',
          fontSize: 14,
        }}
      />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <label style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '8px 10px',
          color: 'var(--text)',
          fontSize: 14,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--teal)',
  color: '#04140f',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '10px 16px',
  cursor: 'pointer',
}
