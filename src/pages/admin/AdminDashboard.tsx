import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import 'chart.js/auto'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { statusColor, fmtDate, fmtDateTime, appFullName, ALL_STATUSES, type Application, type Announcement, type StatusLog } from '../../lib/types'

Chart.register(ArcElement, Tooltip, Legend)

interface Stats {
  total: number
  byStatus: Record<string, number>
  daily: number
  monthly: number
  clients: number
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats>({ total: 0, byStatus: {}, daily: 0, monthly: 0, clients: 0 })
  const [recent, setRecent] = useState<Application[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [activity, setActivity] = useState<StatusLog[]>([])
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    ;(async () => {
      const [all, clients, daily, monthly, rec, ann, act] = await Promise.all([
        supabase.from('applications').select('status'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).gte('submission_date', todayStart),
        supabase.from('applications').select('id', { count: 'exact', head: true }).gte('submission_date', monthStart),
        supabase.from('applications').select('*').order('submission_date', { ascending: false }).limit(6),
        supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5),
        supabase.from('status_logs').select('*').order('created_at', { ascending: false }).limit(8),
      ])

      const byStatus: Record<string, number> = {}
      ALL_STATUSES.forEach((s) => { byStatus[s] = 0 })
      ;(all.data ?? []).forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1 })

      setStats({
        total: (all.data ?? []).length,
        byStatus,
        daily: daily.count ?? 0,
        monthly: monthly.count ?? 0,
        clients: clients.count ?? 0,
      })
      setRecent((rec.data ?? []) as Application[])
      setAnnouncements((ann.data ?? []) as Announcement[])
      setActivity((act.data ?? []) as StatusLog[])
      setLoading(false)
    })()
  }, [])

  const chartData = {
    labels: ALL_STATUSES,
    datasets: [{
      data: ALL_STATUSES.map((s) => stats.byStatus[s] ?? 0),
      backgroundColor: ['#6c757d', '#0dcaf0', '#f59e0b', '#198754', '#dc3545', '#0d6efd'],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  }

  if (loading) {
    return <AppLayout navItems={ADMIN_NAV}><div className="text-center py-5"><div className="spinner-border text-primary" /></div></AppLayout>
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <h3 className="mb-1">Admin Dashboard</h3>
            <p className="text-muted mb-0">Overview of applications and announcements.</p>
          </div>
          <Link to="/admin/applicants" className="btn btn-primary"><i className="bi bi-people me-1" /> Review applicants</Link>
        </div>

        <div className="row g-3 mb-4">
          <StatCard label="Total Applicants" value={stats.total} icon="bi-people" color="primary" />
          <StatCard label="Pending" value={stats.byStatus['Pending'] ?? 0} icon="bi-hourglass-split" color="secondary" />
          <StatCard label="Approved" value={stats.byStatus['Approved'] ?? 0} icon="bi-check-circle" color="success" />
          <StatCard label="Rejected" value={stats.byStatus['Rejected'] ?? 0} icon="bi-x-circle" color="danger" />
        </div>

        <div className="row g-3 mb-4">
          <div className="col-xl-8">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header"><i className="bi bi-pie-chart text-primary-pdao me-1" /> Applications by status</div>
              <div className="card-body"><div className="chart-wrap"><Doughnut ref={chartRef} data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } } }} /></div></div>
            </div>
          </div>
          <div className="col-xl-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header"><i className="bi bi-activity text-primary-pdao me-1" /> Recent activity</div>
              <div className="card-body">
                {activity.length > 0 ? (
                  <ul className="timeline">
                    {activity.map((log) => (
                      <li className="timeline-item" key={log.id}>
                        <span className={`badge status-badge ${statusColor(log.new_status)}`}>{log.new_status}</span>
                        <div className="small mt-1">App #{log.application_id.slice(0, 8)} · {log.changed_by}</div>
                        <div className="text-muted small">{fmtDateTime(log.created_at)}</div>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-muted small">No recent activity.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-xl-7">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><i className="bi bi-clock-history text-primary-pdao me-1" /> Recent applicants</span>
                <Link to="/admin/applicants" className="small">View all</Link>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead><tr><th>ID</th><th>Applicant</th><th>Disability</th><th>Status</th><th>Submitted</th></tr></thead>
                  <tbody>
                    {recent.length > 0 ? recent.map((a) => (
                      <tr key={a.id} className="applicant-row" onClick={() => window.location.hash = `#/admin/applicant/${a.id}`}>
                        <td>#{a.id.slice(0, 8)}</td>
                        <td className="fw-semibold">{appFullName(a)}</td>
                        <td>{a.disability_type ?? '—'}</td>
                        <td><span className={`badge status-badge ${statusColor(a.status)}`}>{a.status}</span></td>
                        <td className="text-muted small">{fmtDate(a.submission_date)}</td>
                      </tr>
                    )) : <tr><td colSpan={5} className="text-center text-muted py-4">No applications yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="col-xl-5">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span><i className="bi bi-megaphone text-primary-pdao me-1" /> Announcements</span>
                <Link to="/admin/announcements" className="small">Manage</Link>
              </div>
              <div className="card-body">
                {announcements.length > 0 ? (
                  <ul className="list-unstyled mb-0">
                    {announcements.map((a) => (
                      <li className="mb-3" key={a.id}>
                        <div className="fw-semibold">{a.title} {a.is_pinned && <span className="pin-badge ms-1"><i className="bi bi-pin-angle-fill" /></span>}</div>
                        <div className="text-muted small">{a.content.slice(0, 70)}{a.content.length > 70 ? '…' : ''}</div>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-muted small">No announcements.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="card stat-card h-100">
        <div className="card-body d-flex justify-content-between align-items-center">
          <div>
            <div className="stat-label">{label}</div>
            <div className={`stat-value text-${color}`}>{value}</div>
          </div>
          <div className={`stat-icon bg-${color} bg-opacity-10 text-${color}`}><i className={`bi ${icon}`} /></div>
        </div>
      </div>
    </div>
  )
}
