import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Announcement } from '../../lib/types'
import { fmtDate } from '../../lib/types'
import { AutoSecurityPopup } from '../../components/SecurityPopup'

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
      </AutoSecurityPopup>
    </AutoSecurityPopup>
  )
}
