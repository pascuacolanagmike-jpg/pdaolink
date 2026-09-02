import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import Alert from '../../components/Alert'
import { SecurityPopup } from '../../components/SecurityPopup'

export default function LoginPage() {
  const { signIn, sensorAvailable, fingerprintLogin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showE2EE, setShowE2EE] = useState(false)
  const [savedEmail, setSavedEmail] = useState<string | null>(null)
  const [bioLoading, setBioLoading] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pdaolink-biometric-cred')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.email) setSavedEmail(parsed.email)
      }
    } catch {
      // ignore
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      if (remember) localStorage.setItem('pdaolink-biometric-email', email)
      setShowE2EE(true)
    }
  }

  const handleFingerprintLogin = async () => {
    setError(null)
    setBioLoading(true)
    const { error } = await fingerprintLogin()
    setBioLoading(false)
    if (error) {
      setError(error)
    } else {
      setShowE2EE(true)
    }
  }

  return (
    <div className="container">
      <div className="row justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 180px)' }}>
        <div className="col-md-7 col-lg-5">
          <div className="card shadow fade-in-up">
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                <div
                  className="d-inline-grid mx-auto mb-3"
                  style={{
                    width: 56, height: 56,
                    background: 'linear-gradient(135deg,var(--pdao-primary),var(--pdao-primary-dark))',
                    borderRadius: 14, color: '#fff', fontSize: '1.5rem', fontWeight: 800, placeItems: 'center',
                  }}
                >P</div>
                <h3 className="mb-1">Welcome back</h3>
                <p className="text-muted mb-0">Sign in to your PDAOLink account</p>
              </div>

              {error && <Alert variant="danger" message={error} />}

              {sensorAvailable && savedEmail && (
                <div className="biometric-login-card" onClick={() => !bioLoading && handleFingerprintLogin()} role="button" tabIndex={0}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !bioLoading) handleFingerprintLogin() }}
                >
                  <div className="biometric-login-icon">
                    {bioLoading ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-fingerprint" />}
                  </div>
                  <div className="flex-grow-1">
                    <div className="fw-bold">Sign in with fingerprint</div>
                    <div className="text-muted small">{savedEmail}</div>
                  </div>
                  {!bioLoading && <i className="bi bi-chevron-right text-muted" />}
                </div>
              )}

              {(sensorAvailable && savedEmail) && (
                <div className="d-flex align-items-center my-3">
                  <hr className="flex-grow-1" />
                  <span className="text-muted small px-2">or use password</span>
                  <hr className="flex-grow-1" />
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Email address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-envelope" /></span>
                    <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-lock" /></span>
                    <input type={showPwd ? 'text' : 'password'} className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPwd((s) => !s)}>
                      <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <label className="form-check-label" htmlFor="remember">Remember me</label>
                  </div>
                  <Link to="/forgot-password" className="small">Forgot password?</Link>
                </div>
                <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-1" /> Signing in…</> : <><i className="bi bi-box-arrow-in-right me-1" /> Sign in</>}
                </button>
              </form>

              <hr className="my-4" />
              <div className="text-center">
                <span className="text-muted">Don't have an account? </span>
                <Link to="/register">Create one</Link>
              </div>
              <div className="alert alert-info mt-3 mb-0 py-2 small">
                <i className="bi bi-info-circle me-1" /> Demo admin:{' '}
                <strong>admin@pdaolink.gov.ph</strong> / <strong>Admin@12345</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SecurityPopup
        show={showE2EE}
        onClose={() => {
          setShowE2EE(false)
          navigate('/dashboard')
        }}
        variant="e2ee"
      />

      <style>{`
        .biometric-login-card {
          display: flex; align-items: center; gap: 0.8rem;
          padding: 1rem 1.2rem; border-radius: 0.6rem; cursor: pointer;
          border: 2px solid #b8d4f0; background: linear-gradient(135deg, #f0f7ff, #fff);
          transition: all 0.2s ease; user-select: none;
        }
        .biometric-login-card:hover {
          border-color: var(--pdao-primary, #0056b3);
          box-shadow: 0 4px 16px rgba(0, 86, 179, 0.15);
          transform: translateY(-1px);
        }
        .biometric-login-card:active { transform: translateY(0); }
        .biometric-login-icon {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(0, 86, 179, 0.1); display: grid; place-items: center;
          font-size: 1.5rem; color: #0056b3; flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
