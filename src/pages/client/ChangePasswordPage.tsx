import { useState, FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import Alert from '../../components/Alert'

export default function ChangePasswordPage() {
  const { profile } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors([])
    setSuccess(null)

    const errs: string[] = []
    if (next.length < 8) errs.push('New password must be at least 8 characters.')
    if (next !== confirm) errs.push('New passwords do not match.')
    if (errs.length) { setErrors(errs); return }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: next })
    setSaving(false)
    if (error) {
      setErrors([error.message])
    } else {
      setSuccess('Password changed successfully.')
      setCurrent(''); setNext(''); setConfirm('')
      if (profile) {
        await supabase.from('notifications').insert({
          user_id: profile.id, message: 'Your password was changed.', link: null,
        })
      }
    }
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Change Password</h3>
        <p className="text-muted mb-4">Use a strong, unique password.</p>

        {success && <Alert variant="success" message={success} />}
        {errors.map((e, i) => <Alert key={i} variant="danger" message={e} />)}

        <div className="card border-0 shadow-sm" style={{ maxWidth: 520 }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Current password</label>
                <input type="password" className="form-control" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label">New password</label>
                <input type="password" className="form-control" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Confirm new password</label>
                <input type="password" className="form-control" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Updating…</> : <><i className="bi bi-key me-1" /> Update password</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
