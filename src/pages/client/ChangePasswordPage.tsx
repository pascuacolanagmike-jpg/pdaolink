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

  // Visibility states
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
              {/* Current password */}
              <div className="mb-3">
                <label className="form-label">Current password</label>
                <div className="position-relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    className="form-control pe-5"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary position-absolute top-50 end-0 translate-middle-y border-0 bg-transparent"
                    onClick={() => setShowCurrent(!showCurrent)}
                    aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  >
                    <i className={`bi ${showCurrent ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="mb-3">
                <label className="form-label">New password</label>
                <div className="position-relative">
                  <input
                    type={showNext ? 'text' : 'password'}
                    className="form-control pe-5"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary position-absolute top-50 end-0 translate-middle-y border-0 bg-transparent"
                    onClick={() => setShowNext(!showNext)}
                    aria-label={showNext ? 'Hide new password' : 'Show new password'}
                  >
                    <i className={`bi ${showNext ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div className="mb-3">
                <label className="form-label">Confirm new password</label>
                <div className="position-relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="form-control pe-5"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary position-absolute top-50 end-0 translate-middle-y border-0 bg-transparent"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
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
