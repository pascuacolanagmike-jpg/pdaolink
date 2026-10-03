import { useState, FormEvent, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import Alert from '../../components/Alert'
import BiometricEnrollModal from '../../components/BiometricEnrollModal'
import { SecurityPopup } from '../../components/SecurityPopup'

export default function RegisterPage() {
  const { signUp, sensorAvailable } = useAuth()
  const navigate = useNavigate()
  const [fullname, setFullname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [showZeroTrust, setShowZeroTrust] = useState(false)

  // New state for password visibility
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  // Password requirement checks
  const passwordChecks = useMemo(() => ({
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  }), [password])

  const allPasswordChecksPassed = Object.values(passwordChecks).every(Boolean)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!allPasswordChecksPassed) {
      setError('Please meet all password requirements.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await signUp(fullname, email, password)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      setShowZeroTrust(true)
    }
  }

  const RequirementItem = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`d-flex align-items-center gap-2 requirement-item ${met ? 'met' : ''}`}>
      <i className={`bi ${met ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'}`} />
      <span className={met ? 'text-success' : 'text-muted'}>{label}</span>
    </div>
  )

  return (
    <div className="container">
      <div className="row justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 180px)' }}>
        <div className="col-md-8 col-lg-6">
          <div className="card shadow fade-in-up">
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                {/* Logo image */}
                <img
                  src="https://cdn.postimage.me/2026/09/13/cropped_circle_image-1.png"
                  alt="PDAOLink Logo"
                  className="d-block mx-auto mb-3"
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: 'cover',
                    borderRadius: 14,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  }}
                />
                <h3 className="mb-1">Create your account</h3>
                <p className="text-muted mb-0">Register to apply for your PWD ID online</p>
              </div>

              {error && <Alert variant="danger" message={error} />}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Full name</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-person" /></span>
                    <input type="text" className="form-control" value={fullname} onChange={(e) => setFullname(e.target.value)} required autoFocus placeholder="Juan Dela Cruz" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Email address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-envelope" /></span>
                    <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Password</label>
                    <div className="position-relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control pe-5 ${password && !allPasswordChecksPassed ? 'is-invalid' : ''} ${password && allPasswordChecksPassed ? 'is-valid' : ''}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        required
                        minLength={8}
                        placeholder="Min 8 characters"
                      />
                      <button
                        type="button"
                        className="btn btn-link position-absolute top-50 end-0 translate-middle-y p-0 me-2"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Confirm password</label>
                    <div className="position-relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`form-control pe-5 ${confirm && password !== confirm ? 'is-invalid' : ''} ${confirm && password === confirm && allPasswordChecksPassed ? 'is-valid' : ''}`}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="btn btn-link position-absolute top-50 end-0 translate-middle-y p-0 me-2"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                    {confirm && password !== confirm && (
                      <div className="text-danger small mt-1">
                        <i className="bi bi-exclamation-circle me-1" />
                        Passwords do not match
                      </div>
                    )}
                    {confirm && password === confirm && allPasswordChecksPassed && (
                      <div className="text-success small mt-1">
                        <i className="bi bi-check-circle me-1" />
                        Passwords match
                      </div>
                    )}
                  </div>
                </div>

                {/* Password requirements checklist */}
                <div className={`password-requirements mt-3 mb-3 ${passwordFocused || password ? 'visible' : ''}`}>
                  <div className="requirements-header">
                    <i className="bi bi-shield-lock me-1" />
                    Password requirements
                  </div>
                  <div className="requirements-grid">
                    <RequirementItem met={passwordChecks.minLength} label="At least 8 characters" />
                    <RequirementItem met={passwordChecks.hasUppercase} label="One uppercase letter (A-Z)" />
                    <RequirementItem met={passwordChecks.hasLowercase} label="One lowercase letter (a-z)" />
                    <RequirementItem met={passwordChecks.hasNumber} label="One number (0-9)" />
                    <RequirementItem met={passwordChecks.hasSpecial} label="One special character (!@#$%...)" />
                  </div>
                </div>

                {sensorAvailable && (
                  <div className="sensor-badge mb-3">
                    <i className="bi bi-fingerprint" />
                    <span>Fingerprint sensor detected on this device — you can enable fingerprint unlock after registration.</span>
                  </div>
                )}

                <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading || (password.length > 0 && !allPasswordChecksPassed)}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-1" /> Creating…</> : <><i className="bi bi-person-plus me-1" /> Create account</>}
                </button>
              </form>

              <hr className="my-4" />
              <div className="text-center">
                <span className="text-muted">Already have an account? </span>
                <Link to="/login">Sign in</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SecurityPopup
        show={showZeroTrust}
        onClose={() => {
          setShowZeroTrust(false)
          if (sensorAvailable) {
            setShowEnroll(true)
          } else {
            navigate('/verify', { replace: true })
          }
        }}
        variant="zero-trust"
      />

      <BiometricEnrollModal
        show={showEnroll}
        onClose={() => navigate('/verify', { replace: true })}
        onSuccess={() => navigate('/verify', { replace: true })}
        title="Enable Fingerprint Unlock"
        subtitle="Secure your new account with your device's fingerprint sensor for faster and safer access."
      />

      <style>{`
        .sensor-badge {
          display: flex; align-items: center; gap: 0.6rem;
          background: rgba(0, 86, 179, 0.08); border: 1px solid rgba(0, 86, 179, 0.18);
          border-radius: 0.6rem; padding: 0.7rem 0.9rem;
          color: #0056b3; font-size: 0.85rem; font-weight: 500;
        }
        .sensor-badge i { font-size: 1.3rem; flex-shrink: 0; }
        /* Optional: make the eye icon less intrusive */
        .btn-link {
          color: #6c757d;
          text-decoration: none;
        }
        .btn-link:hover {
          color: #495057;
        }

        /* Password requirements styling */
        .password-requirements {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 0.6rem;
          padding: 0.85rem 1rem;
          opacity: 0;
          max-height: 0;
          overflow: hidden;
          transition: opacity 0.25s ease, max-height 0.3s ease, padding 0.3s ease, margin 0.3s ease;
          padding-top: 0;
          padding-bottom: 0;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        .password-requirements.visible {
          opacity: 1;
          max-height: 300px;
          padding-top: 0.85rem;
          padding-bottom: 0.85rem;
          margin-top: 1rem !important;
          margin-bottom: 1rem !important;
        }
        .requirements-header {
          font-size: 0.8rem;
          font-weight: 600;
          color: #495057;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 0.6rem;
        }
        .requirements-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem 1rem;
        }
        @media (max-width: 576px) {
          .requirements-grid {
            grid-template-columns: 1fr;
          }
        }
        .requirement-item {
          font-size: 0.82rem;
          transition: color 0.2s ease;
        }
        .requirement-item i {
          font-size: 0.95rem;
          transition: color 0.2s ease;
        }
        .requirement-item.met span {
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}