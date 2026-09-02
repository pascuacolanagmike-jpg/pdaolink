import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Alert from '../../components/Alert'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setInfo('If an account exists for that email, a password reset link has been sent.')
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
                    background: 'linear-gradient(135deg,var(--pdao-warning),#c87f0a)',
                    borderRadius: 14, color: '#fff', fontSize: '1.5rem', placeItems: 'center',
                  }}
                ><i className="bi bi-key" /></div>
                <h3 className="mb-1">Forgot password</h3>
                <p className="text-muted mb-0">We'll send a reset link to your email.</p>
              </div>

              {info && <Alert variant="info" message={info} />}
              {error && <Alert variant="danger" message={error} />}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Email address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white"><i className="bi bi-envelope" /></span>
                    <input
                      type="email"
                      className="form-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-1" /> Sending…</>
                  ) : (
                    <><i className="bi bi-send me-1" /> Send reset link</>
                  )}
                </button>
              </form>

              <hr className="my-4" />
              <div className="text-center">
                <Link to="/login"><i className="bi bi-arrow-left" /> Back to login</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
