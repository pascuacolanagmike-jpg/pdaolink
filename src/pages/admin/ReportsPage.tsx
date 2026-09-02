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
  const [addressGroups, setAddressGroups] = useState<AddressGroup[]>([])
  const [addrSearch, setAddrSearch] = useState('')

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
      setAddressGroups(groupByAddress(rows))
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

  const filteredAddressGroups = addrSearch.trim()
    ? addressGroups
        .map((g) => ({
          ...g,
          applicants: g.applicants.filter((p) =>
            p.name.toLowerCase().includes(addrSearch.toLowerCase()) ||
            g.address.toLowerCase().includes(addrSearch.toLowerCase())
          ),
        }))
        .filter((g) => g.applicants.length > 0)
    : addressGroups

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

        {/* Address-based report */}
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span><i className="bi bi-geo-alt text-primary-pdao me-1" /> Applicants by Address</span>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => exportAddressPDF(filteredAddressGroups, 'pdaolink-address-report.pdf')} disabled={filteredAddressGroups.length === 0}>
                <i className="bi bi-file-pdf me-1" />PDF
              </button>
              <button className="btn btn-sm btn-soft" onClick={() => exportAddressExcel(filteredAddressGroups, 'pdaolink-address-report.xlsx')} disabled={filteredAddressGroups.length === 0}>
                <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search address or applicant name…"
                value={addrSearch}
                onChange={(e) => setAddrSearch(e.target.value)}
              />
            </div>
            {filteredAddressGroups.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Address</th>
                      <th className="text-center" style={{ width: '10%' }}>Applicants</th>
                      <th>Names</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAddressGroups.map((g, i) => (
                      <tr key={i}>
                        <td><i className="bi bi-geo-alt-fill text-primary-pdao me-1" />{g.address}</td>
                        <td className="text-center"><span className="badge bg-primary bg-opacity-10 text-primary-pdao fs-6">{g.count}</span></td>
                        <td>
                          {g.applicants.map((p, j) => (
                            <div key={j} className="d-flex align-items-center gap-2 mb-1">
                              <span className="fw-semibold">{p.name}</span>
                              <span className={`badge status-badge ${statusColor(p.status)}`}>{p.status}</span>
                              {p.disability !== '—' && <span className="text-muted small">{p.disability}</span>}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-geo-alt d-block mb-2" style={{ fontSize: '2rem' }} />
                <p className="mb-0">No applicants found matching your search.</p>
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
