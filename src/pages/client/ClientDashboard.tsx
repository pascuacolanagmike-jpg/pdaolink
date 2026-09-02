import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Application, Announcement } from '../../lib/types'
import { statusColor, fmtDate, fmtDateTime } from '../../lib/types'

export default function ClientDashboard() {
  const { profile } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [recentNotifications, setRecentNotifications] = useState(useAuth().recentNotifications)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('applications')
      .select('*')
      .eq('user_id', profile.id)
      .order('submission_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setApplication(data as Application | null))

    supabase
      .from('announcements')
      .select('*')
      .or('expires_at.is.null,expires_at.gte.now()')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setAnnouncements((data ?? []) as Announcement[]))
  }, [profile])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentNotifications((data ?? []) as any[]))
  }, [profile])

  const firstName = profile?.fullname?.split(' ')[0] ?? 'there'

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <h3 className="mb-1">Welcome, {firstName}!</h3>
            <p className="text-muted mb-0">Here's the latest on your PWD application.</p>
          </div>
          {application ? (
            <Link to="/status" className="btn btn-soft"><i className="bi bi-eye me-1" /> View status</Link>
          ) : (
            <Link to="/application" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-1" /> Start application</Link>
          )}
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-8">
            <div className="card h-100">
              <div className="card-body">
                <h6 className="text-muted text-uppercase small fw-bold mb-3">Current application status</h6>
                {application ? (
                  <>
                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                      <div>
                        <span className={`badge status-badge ${statusColor(application.status)}`}>{application.status}</span>
                        <div className="text-muted small mt-2">Submitted {fmtDateTime(application.submission_date)}</div>
                      </div>
                      <div className="text-end">
                        <div className="small text-muted">Application ID</div>
                        <div className="fw-bold">#{application.id.slice(0, 8)}</div>
                      </div>
                    </div>
                    {application.remarks && (
                      <div className="alert alert-info py-2 mb-0"><i className="bi bi-chat-left-text me-1" />{application.remarks}</div>
                    )}
                  </>
                ) : (
                  <div className="empty-state">
                    <i className="bi bi-file-earmark-text d-block mb-2" />
                    <p className="mb-3">You haven't submitted an application yet.</p>
                    <Link to="/application" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-1" /> Start your application</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card h-100">
              <div className="card-body">
                <h6 className="text-muted text-uppercase small fw-bold mb-3">Quick actions</h6>
                <div className="d-grid gap-2">
                  <Link to="/application" className="btn btn-soft text-start"><i className="bi bi-file-earmark-text me-2" />{application ? 'View application' : 'New application'}</Link>
                  <Link to="/upload" className="btn btn-soft text-start"><i className="bi bi-cloud-upload me-2" />Upload documents</Link>
                  <Link to="/announcements" className="btn btn-soft text-start"><i className="bi bi-megaphone me-2" />Announcements</Link>
                  <Link to="/profile" className="btn btn-soft text-start"><i className="bi bi-person me-2" />Edit profile</Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><i className="bi bi-megaphone text-primary-pdao me-1" />Latest announcements</span>
                <Link to="/announcements" className="small">View all</Link>
              </div>
              <div className="card-body">
                {announcements.length > 0 ? (
                  <ul className="list-unstyled mb-0">
                    {announcements.map((a) => (
                      <li className="mb-3" key={a.id}>
                        <div className="d-flex align-items-start gap-2">
                          {a.is_pinned ? <i className="bi bi-pin-angle-fill text-warning mt-1" /> : <i className="bi bi-caret-right text-muted mt-1" />}
                          <div>
                            <div className="fw-semibold">{a.title}</div>
                            <div className="text-muted small">{a.content.slice(0, 80)}{a.content.length > 80 ? '…' : ''}</div>
                            <div className="text-muted small">{fmtDate(a.created_at)}</div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-muted small">No announcements yet.</div>}
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><i className="bi bi-bell text-primary-pdao me-1" />Recent notifications</span>
                <Link to="/notifications" className="small">View all</Link>
              </div>
              <div className="card-body">
                {recentNotifications.length > 0 ? (
                  <ul className="list-unstyled mb-0">
                    {recentNotifications.map((n: any) => (
                      <li className="mb-2" key={n.id}>
                        <i className={`bi ${n.is_read ? 'bi-check2-circle text-muted' : 'bi-circle-fill text-primary-pdao'} me-2 small`} />
                        {n.message}
                        <div className="text-muted small">{fmtDateTime(n.created_at)}</div>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-muted small">No notifications.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
