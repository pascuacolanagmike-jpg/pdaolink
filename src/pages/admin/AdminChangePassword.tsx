import { useState, useMemo, FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import Alert from '../../components/Alert'

// ─────────────────────────────────────────────────────────
// Password rules & strength
// ─────────────────────────────────────────────────────────
interface PasswordRule {
  key: string
  label: string
  test: (v: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length',  label: 'At least 8 characters',                test: (v) => v.length >= 8 },
  { key: 'upper',   label: 'Contains an uppercase letter (A–Z)',   test: (v) => /[A-Z]/.test(v) },
  { key: 'lower',   label: 'Contains a lowercase letter (a–z)',    test: (v) => /[a-z]/.test(v) },
  { key: 'number',  label: 'Contains a number (0–9)',              test: (v) => /[0-9]/.test(v) },
  { key: 'special', label: 'Contains a special character (!@#$…)', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

// Indexed by (score - 1); score ranges 1..5.
const STRENGTH_LEVELS = [
  { label: 'Very Weak', color: '#dc3545', width: 20 },
  { label: 'Weak',      color: '#fd7e14', width: 40 },
  { label: 'Fair',      color: '#ffc107', width: 60 },
  { label: 'Good',      color: '#20c997', width: 80 },
  { label: 'Strong',    color: '#198754', width: 100 },
]

export default function AdminChangePassword() {
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

  // ── Derived password state ──
  const ruleResults = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(next) })),
    [next]
  )
  const score = ruleResults.filter((r) => r.passed).length
  const strength = score > 0 ? STRENGTH_LEVELS[score - 1] : null
  const allPassed = score === PASSWORD_RULES.length
  const mismatch = confirm.length > 0 && next !== confirm
  const matches = confirm.length > 0 && next.length > 0 && next === confirm

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors([])
    setSuccess(null)

    const errs: string[] = []
    if (!current) errs.push('Please enter your current password.')
    if (!next) errs.push('Please enter a new password.')
    if (next && next.length < 8) errs.push('New password must be at least 8 characters.')
    if (next && !allPassed) errs.push('New password does not meet all requirements.')
    if (next && current && next === current) errs.push('New password must be different from the current password.')
    if (next !== confirm) errs.push('New passwords do not match.')
    if (errs.length) { setErrors(errs); return }

    setSaving(true)

    // Verify the current password first (Supabase requires re-auth for this check).
    const email = profile?.email
    if (email) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      })
      if (verifyError) {
        setSaving(false)
        setErrors(['Current password is incorrect.'])
        return
      }
    }

    const { error } = await supabase.auth.updateUser({ password: next })
    setSaving(false)
    if (error) {
      setErrors([error.message])
    } else {
      setSuccess('Password changed successfully.')
      setCurrent(''); setNext(''); setConfirm('')
      setShowCurrent(false); setShowNext(false); setShowConfirm(false)
      if (profile) {
        await supabase.from('notifications').insert({
          user_id: profile.id,
          message: 'Your admin password was changed.',
          link: null,
        })
      }
    }
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Change Password</h3>
        <p className="text-muted mb-4">Update your admin account password.</p>

        {success && <Alert variant="success" message={success} />}
        {errors.map((e, i) => <Alert key={i} variant="danger" message={e} />)}

        <div className="card border-0 shadow-sm" style={{ maxWidth: 520 }}>
          <div className="card-body">
            <form onSubmit={handleSubmit} noValidate>
              {/* Current password */}
              <div className="mb-3">
                <label className="form-label">Current password</label>
                <div className="position-relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    className="form-control pe-5"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
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
                    autoComplete="new-password"
                    minLength={8}
                    required
                    aria-describedby="password-requirements"
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

                {/* Strength meter */}
                {next.length > 0 && strength && (
                  <div className="mt-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className="text-muted">Password strength</small>
                      <small className="fw-bold" style={{ color: strength.color }}>
                        {strength.label}
                      </small>
                    </div>
                    <div className="pw-strength-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={strength.width}>
                      <div
                        className="pw-strength-bar"
                        style={{ width: `${strength.width}%`, backgroundColor: strength.color }}
                      />
                    </div>
                  </div>
                )}

                {/* Requirement checklist */}
                {next.length > 0 && (
                  <ul id="password-requirements" className="pw-rules mt-2 mb-0">
                    {ruleResults.map((r) => (
                      <li key={r.key} className={r.passed ? 'passed' : 'failed'}>
                        <i
                          className={`bi ${r.passed ? 'bi-check-circle-fill' : 'bi-x-circle'}`}
                          aria-hidden="true"
                        />
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Confirm new password */}
              <div className="mb-3">
                <label className="form-label">Confirm new password</label>
                <div className="position-relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={`form-control pe-5 ${mismatch ? 'is-invalid' : ''} ${matches ? 'is-valid' : ''}`}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
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
                {mismatch && (
                  <small className="text-danger d-inline-flex align-items-center gap-1 mt-1">
                    <i className="bi bi-x-circle" aria-hidden="true" /> Passwords do not match.
                  </small>
                )}
                {matches && (
                  <small className="text-success d-inline-flex align-items-center gap-1 mt-1">
                    <i className="bi bi-check-circle-fill" aria-hidden="true" /> Passwords match.
                  </small>
                )}
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-1" /> Updating…</>
                  : <><i className="bi bi-key me-1" /> Update password</>}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .pw-strength-track {
          height: 6px;
          width: 100%;
          background: #eef2f7;
          border-radius: 999px;
          overflow: hidden;
        }
        .pw-strength-bar {
          height: 100%;
          border-radius: 999px;
          transition: width 0.25s ease, background-color 0.25s ease;
        }
        .pw-rules {
          list-style: none;
          padding: 0;
          font-size: 0.82rem;
        }
        .pw-rules li {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.15rem 0;
          transition: color 0.15s ease;
        }
        .pw-rules li.passed { color: #198754; }
        .pw-rules li.failed { color: #8a94a6; }
        .pw-rules li.failed .bi { color: #c1c9d6; }
      `}</style>
    </AppLayout>
  )
}