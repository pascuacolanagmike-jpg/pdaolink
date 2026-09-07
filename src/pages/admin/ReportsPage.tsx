import { useEffect, useState, useRef } from 'react'
import { Bar, Pie } from 'react-chartjs-2'
import 'chart.js/auto'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { ALL_STATUSES, DISABILITY_TYPES, statusColor, type Application } from '../../lib/types'
import { exportExcel, exportPDF, filterByScope, groupByAddress, exportAddressExcel, exportAddressPDF, type AddressGroup } from '../../lib/reportExport'

interface Stats {
  total: number
  byStatus: Record<string, number>
  daily: number
  monthly: number
  clients: number
  disabilityBreakdown: Record<string, number>
}

export default function ReportsPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, byStatus: {}, daily: 0, monthly: 0, clients: 0, disabilityBreakdown: {} })
  const [loading, setLoading] = useState(true)
  const statusRef = useRef<any>(null)
  const disabilityRef = useRef<any>(null)

  // New filter states
  const [addrFilter, setAddrFilter] = useState('')
  const [disabilityFilter, setDisabilityFilter] = useState('')
  const [nameSearch, setNameSearch] = useState('')

  useEffect(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    ;(async () => {
      const [all, clients, daily, monthly] = await Promise.all([
        supabase.from('applications').select('*'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).gte('submission_date', todayStart),
        supabase.from('applications').select('id', { count: 'exact', head: true }).gte('submission_date', monthStart),
      ])
      const rows = (all.data ?? []) as Application[]
      const byStatus: Record<string, number> = {}
      ALL_STATUSES.forEach((s) => { byStatus[s] = 0 })
      const disabilityBreakdown: Record<string, number> = {}
      DISABILITY_TYPES.forEach((d) => { disabilityBreakdown[d] = 0 })
      rows.forEach((a) => {
        byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
        if (a.disability_type) disabilityBreakdown[a.disability_type] = (disabilityBreakdown[a.disability_type] ?? 0) + 1
      })
      setApps(rows)
      setStats({ total: rows.length, byStatus, daily: daily.count ?? 0, monthly: monthly.count ?? 0, clients: clients.count ?? 0, disabilityBreakdown })
      setLoading(false)
    })()
  }, [])

  const doExport = (scope: string, format: 'pdf' | 'excel') => {
    const filtered = filterByScope(apps, scope)
    const filename = `pdaolink-${scope}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filtered, stats, filename)
    else exportExcel(filtered, filename)
  }

  const statusBars = {
    labels: ALL_STATUSES,
    datasets: [{ label: 'Applications', data: ALL_STATUSES.map((s) => stats.byStatus[s] ?? 0), backgroundColor: '#0056b3', borderRadius: 6 }],
  }

  const validDisabilities = Object.entries(stats.disabilityBreakdown).filter(([, v]) => v > 0)
  const disabilityPie = {
    labels: validDisabilities.map(([k]) => k),
    datasets: [{ data: validDisabilities.map(([, v]) => v), backgroundColor: ['#0056b3', '#0d6efd', '#0a9396', '#198754', '#f59e0b', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#adb5bd'] }],
  }

  // Compute filtered applicants based on all three filters
  const filteredApplicants = apps.filter((app) => {
    const matchAddress = addrFilter.trim() === '' || app.address.toLowerCase().includes(addrFilter.toLowerCase())
    const matchDisability = disabilityFilter === '' || app.disability_type === disabilityFilter
    const matchName = nameSearch.trim() === '' || app.name.toLowerCase().includes(nameSearch.toLowerCase())
    return matchAddress && matchDisability && matchName
  })

  const exportFiltered = (format: 'pdf' | 'excel') => {
    const filename = `pdaolink-filtered-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filteredApplicants, stats, filename)
    else exportExcel(filteredApplicants, filename)
  }

  if (loading) {
    return <AppLayout navItems={ADMIN_NAV}><div className="text-center py-5"><div className="spinner-border text-primary" /></div></AppLayout>
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Reports</h3>
        <p className="text-muted mb-4">Generate and export application reports.</p>

        <div className="row g-3 mb-4">
          <StatBox label="Total" value={stats.total} color="primary" />
          <StatBox label="Daily" value={stats.daily} color="info" />
          <StatBox label="Monthly" value={stats.monthly} color="primary" />
          <StatBox label="Approved" value={stats.byStatus['Approved'] ?? 0} color="success" />
          <StatBox label="Rejected" value={stats.byStatus['Rejected'] ?? 0} color="danger" />
          <StatBox label="Clients" value={stats.clients} color="warning" />
        </div>

        <div className="row g-3 mb-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header"><i className="bi bi-bar-chart text-primary-pdao me-1" /> Applications by status</div>
              <div className="card-body"><div className="chart-wrap"><Bar ref={statusRef} data={statusBars} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header"><i className="bi bi-pie-chart text-primary-pdao me-1" /> By disability type</div>
              <div className="card-body"><div className="chart-wrap"><Pie ref={disabilityRef} data={disabilityPie} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } }} /></div></div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-header"><i className="bi bi-download text-primary-pdao me-1" /> Export reports</div>
          <div className="card-body">
            <div className="row g-3">
              {[
                { scope: 'all', title: 'All applications', desc: 'Full list of submitted applications.' },
                { scope: 'daily', title: 'Daily applications', desc: 'Applications submitted today.' },
                { scope: 'monthly', title: 'Monthly applications', desc: 'Applications submitted this month.' },
                { scope: 'approved', title: 'Approved applications', desc: 'All approved PWD applications.' },
                { scope: 'rejected', title: 'Rejected applications', desc: 'All rejected applications.' },
              ].map((r) => (
                <div className="col-md-6 col-xl-4" key={r.scope}>
                  <div className="card h-100 border">
                    <div className="card-body">
                      <h6>{r.title}</h6>
                      <p className="text-muted small mb-3">{r.desc}</p>
                      <button className="btn btn-sm btn-primary me-1" onClick={() => doExport(r.scope, 'pdf')}><i className="bi bi-file-pdf me-1" />PDF</button>
                      <button className="btn btn-sm btn-soft" onClick={() => doExport(r.scope, 'excel')}><i className="bi bi-file-earmark-spreadsheet me-1" />Excel</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search Applicants Section */}
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span><i className="bi bi-search text-primary-pdao me-1" /> Search Applicants</span>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => exportFiltered('pdf')} disabled={filteredApplicants.length === 0}>
                <i className="bi bi-file-pdf me-1" />PDF
              </button>
              <button className="btn btn-sm btn-soft" onClick={() => exportFiltered('excel')} disabled={filteredApplicants.length === 0}>
                <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label small text-muted">Barangay / Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Union Cauayan City"
                  value={addrFilter}
                  onChange={(e) => setAddrFilter(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small text-muted">Disability Type</label>
                <select
                  className="form-select"
                  value={disabilityFilter}
                  onChange={(e) => setDisabilityFilter(e.target.value)}
                >
                  <option value="">All Disabilities</option>
                  {DISABILITY_TYPES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small text-muted">Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search name…"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredApplicants.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Address</th>
                      <th>Disability</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplicants.map((app, idx) => (
                      <tr key={idx}>
                        <td className="fw-semibold">{app.name}</td>
                        <td>{app.address}</td>
                        <td>{app.disability_type || '—'}</td>
                        <td><span className={`badge status-badge ${statusColor(app.status)}`}>{app.status}</span></td>
                        <td>{new Date(app.submission_date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-search d-block mb-2" style={{ fontSize: '2rem' }} />
                <p className="mb-0">No applicants match your search criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="col-6 col-xl-2">
      <div className="card stat-card h-100">
        <div className="card-body">
          <div className="stat-label">{label}</div>
          <div className={`stat-value text-${color}`}>{value}</div>
        </div>
      </div>
    </div>
  )
}
