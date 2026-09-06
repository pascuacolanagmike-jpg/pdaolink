import { Link } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { Announcement } from '../../lib/types'
import { fmtDate } from '../../lib/types'
import { AutoSecurityPopup } from '../../components/SecurityPopup'

/* ============================================================
   DEVELOPER ACCESS GATE — OTP Verification (5‑Minute Test Session)
   ============================================================ */

const DEFAULT_OTP = '44636' // Temporary access code for 5‑minute test sessions
const EXIT_COUNTDOWN_SECONDS = 10
const ACCESS_KEY = 'pdaolink_dev_granted'

type GateStep = 'acknowledge' | 'otp' | 'denied' | 'granted'

function DeveloperAccessGate({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<GateStep>(() => {
    const saved = sessionStorage.getItem(ACCESS_KEY)
    return saved === 'true' ? 'granted' : 'acknowledge'
  })
  const [acknowledged, setAcknowledged] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [countdown, setCountdown] = useState(EXIT_COUNTDOWN_SECONDS)
  const [error, setError] = useState('')

  /* ---------- countdown + forced exit for wrong OTP ---------- */
  useEffect(() => {
    if (step !== 'denied') return
    if (countdown <= 0) {
      sessionStorage.clear()
      document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                    background:#0d1117;color:#fff;font-family:system-ui,sans-serif;text-align:center;
                    padding:2rem;">
          <div>
            <h1 style="font-size:2.5rem;margin-bottom:1rem;">👋 Goodbye</h1>
            <p style="font-size:1.15rem;color:#8b949e;">
              You are not authorized to access this system.<br/>
              This window will close automatically.
            </p>
          </div>
        </div>`
      window.close()
      setTimeout(() => {
        window.location.href = 'about:blank'
      }, 1500)
      return
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [step, countdown])

  /* ---------- proceed to OTP entry after acknowledgment ---------- */
  const handleAcknowledge = useCallback(() => {
    if (acknowledged) {
      setStep('otp')
      setError('')
    }
  }, [acknowledged])

  /* ---------- validate OTP ---------- */
  const handleOtpSubmit = useCallback(() => {
    const trimmed = otpInput.trim()
    if (trimmed === DEFAULT_OTP) {
      sessionStorage.setItem(ACCESS_KEY, 'true')
      setStep('granted')
    } else {
      setStep('denied')
      setCountdown(EXIT_COUNTDOWN_SECONDS)
    }
  }, [otpInput])

  /* ---------- reset gate ---------- */
  const handleReset = useCallback(() => {
    sessionStorage.removeItem(ACCESS_KEY)
    setOtpInput('')
    setAcknowledged(false)
    setError('')
    setCountdown(EXIT_COUNTDOWN_SECONDS)
    setStep('acknowledge')
  }, [])

  /* ============================================================
     RENDER GATE OVERLAYS
     ============================================================ */
  if (step === 'granted') {
    return <>{children}</>
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {/* ============ STEP 1: ACKNOWLEDGMENT ============ */}
        {step === 'acknowledge' && (
          <div
            className="card border-0 shadow-lg"
            style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16 }}
          >
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'rgba(13,110,253,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                  }}
                >
                  <i className="bi bi-lock-fill text-primary" style={{ fontSize: '1.75rem' }} />
                </div>
                <h4 className="fw-bold mb-1">Restricted Access</h4>
                <p className="text-muted small mb-0">
                  This system is currently in a testing phase.
                </p>
              </div>

              <div className="rounded-3 p-4 mb-4" style={{ background: '#f8f9fa' }}>
                <p className="mb-3">
                  To request a <strong>5‑minute test session</strong>, please text the developer manually at the number below:
                </p>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <i className="bi bi-chat-dots-fill text-primary" style={{ fontSize: '1.5rem' }} />
                  <div>
                    <div className="fw-bold">09653720651</div>
                    <div className="text-muted small">Send a text message to this number</div>
                  </div>
                </div>
                <p className="text-muted small mb-0">
                  <i className="bi bi-info-circle me-1" />
                  After texting, you will receive a temporary access code. That code is valid for one 5‑minute session only.
                </p>
              </div>

              {/* Checkbox acknowledgment */}
              <div className="form-check form-switch mb-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="acknowledgeSwitch"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ cursor: 'pointer', width: '3em', height: '1.5em' }}
                />
                <label
                  className="form-check-label ms-2 fw-semibold"
                  htmlFor="acknowledgeSwitch"
                  style={{ cursor: 'pointer' }}
                >
                  I have texted the developer and received a temporary code
                </label>
              </div>

              <button
                className="btn btn-primary w-100 btn-lg"
                onClick={handleAcknowledge}
                disabled={!acknowledged}
              >
                <i className="bi bi-check-circle me-1" /> Proceed to Code Entry
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 2: OTP ENTRY ============ */}
        {step === 'otp' && (
          <div
            className="card border-0 shadow-lg"
            style={{ maxWidth: 460, width: '100%', borderRadius: 16 }}
          >
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'rgba(13,110,253,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                  }}
                >
                  <i className="bi bi-shield-lock text-primary" style={{ fontSize: '1.75rem' }} />
                </div>
                <h4 className="fw-bold mb-1">Temporary Access Code</h4>
                <p className="text-muted small mb-0">
                  Enter the code provided by the developer.
                </p>
              </div>

              <div className="mb-3">
                <label htmlFor="otpInput" className="form-label fw-semibold">
                  Access code
                </label>
                <input
                  id="otpInput"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="form-control form-control-lg text-center"
                  placeholder="•••••"
                  maxLength={5}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, ''))
                    setError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleOtpSubmit()}
                  autoFocus
                />
                {error && <div className="text-danger small mt-1">{error}</div>}
              </div>

              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleOtpSubmit}
                  disabled={otpInput.length !== 5}
                >
                  <i className="bi bi-check-lg me-1" /> Verify Code
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setStep('acknowledge')}
                >
                  <i className="bi bi-arrow-left me-1" /> Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ STEP 3: ACCESS DENIED ============ */}
        {step === 'denied' && (
          <div
            className="card border-0 shadow-lg text-center"
            style={{ maxWidth: 460, width: '100%', borderRadius: 16 }}
          >
            <div className="card-body p-5">
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(220,53,69,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <i className="bi bi-x-octagon-fill text-danger" style={{ fontSize: '2.25rem' }} />
              </div>
              <h3 className="fw-bold text-danger mb-2">Invalid Code</h3>
              <p className="text-muted mb-1">
                The code you entered is incorrect.
              </p>
              <p className="text-muted small mb-4">
                Please contact the developer if you believe this is a mistake.
              </p>

              <div className="display-4 fw-bold text-danger mb-3">{countdown}</div>
              <p className="text-muted mb-0">
                You will exit the app in <strong>{countdown} seconds</strong>.
              </p>
              <p className="text-muted small mt-1">
                <i className="bi bi-emoji-smile me-1" /> Goodbye.
              </p>

              <button
                className="btn btn-outline-secondary btn-sm mt-4"
                onClick={handleReset}
              >
                <i className="bi bi-arrow-left me-1" /> Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Render children behind the gate overlay */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
    </>
  )
}

/* ============================================================
   LANDING PAGE (wrapped by DeveloperAccessGate)
   ============================================================ */

export default function LandingPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    supabase
      .from('announcements')
      .select('*')
      .eq('is_pinned', true)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setAnnouncements((data ?? []) as Announcement[]))
  }, [])

  return (
    <AutoSecurityPopup variant="e2ee">
      <AutoSecurityPopup variant="zero-trust">
        <DeveloperAccessGate>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <nav className="navbar navbar-pdao">
              <div className="container-fluid px-3 px-lg-4">
                <span className="navbar-brand d-flex align-items-center gap-2">
                  <img
                    src="https://cdn.postimage.me/2026/09/04/ce3cc890-fba2-4622-b7f4-8d05cfa7a8d5.jpeg"
                    alt="PDAOLink Logo"
                    style={{
                      width: 36,
                      height: 36,
                      objectFit: 'cover',
                      borderRadius: 8,
                    }}
                  />
                  <span>PDAOLink</span>
                </span>
                <div className="d-flex gap-2">
                  <Link to="/login" className="btn btn-light">Login</Link>
                  <Link to="/register" className="btn btn-outline-light">Register</Link>
                </div>
              </div>
            </nav>

            <section className="hero">
              <div className="container">
                <div className="row align-items-center g-4">
                  <div className="col-lg-7">
                    <span className="badge bg-white text-primary-pdao mb-3 px-3 py-2">
                      <i className="bi bi-shield-check me-1" /> Official Government Portal
                    </span>
                    <h1 className="mb-3">PDAOLink — PWD Digital Registration & Management</h1>
                    <p className="lead mb-4">
                      Apply for your Persons with Disability (PWD) ID online. Submit your application,
                      upload documents, and track your status — anytime, anywhere.
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      <Link to="/register" className="btn btn-light btn-lg">
                        <i className="bi bi-person-plus me-1" /> Register now
                      </Link>
                      <Link to="/login" className="btn btn-outline-light btn-lg">
                        <i className="bi bi-box-arrow-in-right me-1" /> Sign in
                      </Link>
                    </div>
                  </div>
                  <div className="col-lg-5">
                    <div className="card border-0 shadow-lg">
                      <div className="card-body p-4">
                        <h5 className="mb-3">
                          <i className="bi bi-list-check text-primary-pdao me-2" />How it works
                        </h5>
                        <ul className="timeline">
                          <li className="timeline-item">
                            <strong>Create your account</strong>
                            <div className="text-muted small">Register with your email and a secure password.</div>
                          </li>
                          <li className="timeline-item">
                            <strong>Complete the application</strong>
                            <div className="text-muted small">Fill out the PWD registration form with your details.</div>
                          </li>
                          <li className="timeline-item">
                            <strong>Upload documents</strong>
                            <div className="text-muted small">Attach your medical, barangay, and ID documents.</div>
                          </li>
                          <li className="timeline-item">
                            <strong>Track your status</strong>
                            <div className="text-muted small">Monitor progress until your PWD ID is ready for pickup.</div>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="py-5">
              <div className="container">
                <div className="text-center mb-5">
                  <h2 className="fw-bold">A simpler way to get your PWD ID</h2>
                  <p className="text-muted">Everything you need, in one secure portal.</p>
                </div>
                <div className="row g-4">
                  {[
                    { icon: 'bi-laptop', title: 'Online registration', desc: 'Complete the entire application from home — no trips to the office required.', color: 'primary' },
                    { icon: 'bi-clock-history', title: 'Real-time tracking', desc: 'See your application status update at every step of the review process.', color: 'success' },
                    { icon: 'bi-megaphone', title: 'Stay informed', desc: 'Receive announcements and notifications from the PDAO office directly.', color: 'warning' },
                  ].map((f) => (
                    <div className="col-md-4" key={f.title}>
                      <div className="card border-0 shadow-sm">
                        <div className="card-body p-4">
                          <div className={`stat-icon bg-${f.color} bg-opacity-10 text-${f.color} mb-3`}>
                            <i className={`bi ${f.icon}`} />
                          </div>
                          <h5>{f.title}</h5>
                          <p className="text-muted mb-0">{f.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {announcements.length > 0 && (
                  <div className="row g-3 mt-2">
                    <div className="col-12">
                      <h4 className="mb-3">
                        <i className="bi bi-megaphone text-primary-pdao me-2" />Pinned announcements
                      </h4>
                      <div className="row g-3">
                        {announcements.map((a) => (
                          <div className="col-md-4" key={a.id}>
                            <div className="card border-0 shadow-sm">
                              <div className="card-body">
                                <span className="pin-badge mb-2">
                                  <i className="bi bi-pin-angle-fill" /> Pinned
                                </span>
                                <h6 className="mb-1">{a.title}</h6>
                                <p className="text-muted small mb-0">
                                  {a.content.slice(0, 120)}{a.content.length > 120 ? '…' : ''}
                                </p>
                                <div className="text-muted small mt-1">{fmtDate(a.created_at)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <footer className="footer-pdao">
              <div className="container-fluid px-3 px-lg-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
                <span>
                  <i className="bi bi-building-gear me-1" /> Persons with Disability Affairs Office —
                  Digital Registration & Management System
                </span>
                <span>&copy; 2026 PDAOLink. All rights reserved.</span>
              </div>
            </footer>
          </div>
        </DeveloperAccessGate>
      </AutoSecurityPopup>
    </AutoSecurityPopup>
  )
}
