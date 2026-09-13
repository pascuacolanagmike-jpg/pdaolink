import { useEffect, useState, useRef } from 'react'
import { Bar, Pie } from 'react-chartjs-2'
import 'chart.js/auto'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import {
  ALL_STATUSES, DISABILITY_TYPES, GENDER_OPTIONS,
  statusColor, appFullName, fmtDate,
  type Application,
} from '../../lib/types'
import {
  exportExcel, exportPDF, filterByScope, groupByAddress,
  exportAddressExcel, exportAddressPDF, type AddressGroup,
} from '../../lib/reportExport'

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
  const [stats, setStats] = useState<Stats>({
    total: 0, byStatus: {}, daily: 0, monthly: 0, clients: 0, disabilityBreakdown: {},
  })
  const [loading, setLoading] = useState(true)
  const statusRef = useRef<any>(null)
  const disabilityRef = useRef<any>(null)
  const [addressGroups, setAddressGroups] = useState<AddressGroup[]>([])
  const [addrSearch, setAddrSearch] = useState('')

  // Filter states
  const [addrFilter, setAddrFilter] = useState('')
  const [disabilityFilter, setDisabilityFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
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
      setAddressGroups(groupByAddress(rows))
      setStats({
        total: rows.length,
        byStatus,
        daily: daily.count ?? 0,
        monthly: monthly.count ?? 0,
        clients: clients.count ?? 0,
        disabilityBreakdown,
      })
      setLoading(false)
    })()
  }, [])

  // Counts for gender stats
  const maleCount = apps.filter((a) => a.gender === 'Male').length
  const femaleCount = apps.filter((a) => a.gender === 'Female').length

  // Scope export (with optional gender)
  const doExport = (scope: string, format: 'pdf' | 'excel', gender?: 'Male' | 'Female') => {
    let filtered = filterByScope(apps, scope)
    if (gender) filtered = filtered.filter((a) => a.gender === gender)
    const suffix = gender ? `-${gender.toLowerCase()}` : ''
    const filename = `pdaolink-${scope}${suffix}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filtered, stats, filename)
    else exportExcel(filtered, filename)
  }

  // Gender-only export (all applications of that gender)
  const doGenderExport = (gender: 'Male' | 'Female', format: 'pdf' | 'excel') => {
    const filtered = apps.filter((a) => a.gender === gender)
    const filename = `pdaolink-${gender.toLowerCase()}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filtered, stats, filename)
    else exportExcel(filtered, filename)
  }

  const statusBars = {
    labels: ALL_STATUSES,
    datasets: [{
      label: 'Applications',
      data: ALL_STATUSES.map((s) => stats.byStatus[s] ?? 0),
      backgroundColor: '#0056b3',
      borderRadius: 6,
    }],
  }

  const validDisabilities = Object.entries(stats.disabilityBreakdown).filter(([, v]) => v > 0)
  const disabilityPie = {
    labels: validDisabilities.map(([k]) => k),
    datasets: [{
      data: validDisabilities.map(([, v]) => v),
      backgroundColor: ['#0056b3', '#0d6efd', '#0a9396', '#198754', '#f59e0b', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#adb5bd'],
    }],
  }

  // Filter applicants
  const filteredApplicants = apps.filter((app) => {
    const fullName = appFullName(app).toLowerCase()
    const addrParts = [
      app.address, app.barangay, app.municipality, app.province,
    ].filter(Boolean).join(' ').toLowerCase()

    const matchAddress = addrFilter.trim() === '' || addrParts.includes(addrFilter.toLowerCase())
    const matchDisability = disabilityFilter === '' || app.disability_type === disabilityFilter
    const matchGender = genderFilter === '' || app.gender === genderFilter
    const matchName = nameSearch.trim() === '' || fullName.includes(nameSearch.toLowerCase())

    return matchAddress && matchDisability && matchGender && matchName
  })

  const exportFiltered = (format: 'pdf' | 'excel') => {
    const filename = `pdaolink-filtered-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filteredApplicants as any, stats, filename)
    else exportExcel(filteredApplicants as any, filename)
  }

  const clearFilters = () => {
    setAddrFilter('')
    setDisabilityFilter('')
    setGenderFilter('')
    setNameSearch('')
  }

  if (loading) {
    return (
      <AppLayout navItems={ADMIN_NAV}>
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      </AppLayout>
    )
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
              <div className="card-header">
                <i className="bi bi-bar-chart text-primary-pdao me-1" /> Applications by status
              </div>
              <div className="card-body">
                <div className="chart-wrap">
                  <Bar ref={statusRef} data={statusBars} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                  }} />
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header">
                <i className="bi bi-pie-chart text-primary-pdao me-1" /> By disability type
              </div>
              <div className="card-body">
                <div className="chart-wrap">
                  <Pie ref={disabilityRef} data={disabilityPie} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } },
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Export by gender ─── */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header">
            <i className="bi bi-gender-ambiguous text-primary-pdao me-1" /> Export by gender
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <div className="card h-100 border">
                  <div className="card-body">
                    <h6>
                      <i className="bi bi-people-fill text-primary-pdao me-1" /> Overall (All)
                    </h6>
                    <p className="text-muted small mb-3">
                      Both male and female applicants.
                      <br />
                      <strong>{stats.total}</strong> total
                    </p>
                    <button className="btn btn-sm btn-primary me-1" onClick={() => doExport('all', 'pdf')}>
                      <i className="bi bi-file-pdf me-1" />PDF
                    </button>
                    <button className="btn btn-sm btn-soft" onClick={() => doExport('all', 'excel')}>
                      <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card h-100 border">
                  <div className="card-body">
                    <h6>
                      <i className="bi bi-gender-male text-primary me-1" /> Male applicants
                    </h6>
                    <p className="text-muted small mb-3">
                      All male applicants.
                      <br />
                      <strong>{maleCount}</strong> total
                    </p>
                    <button className="btn btn-sm btn-primary me-1" onClick={() => doGenderExport('Male', 'pdf')} disabled={maleCount === 0}>
                      <i className="bi bi-file-pdf me-1" />PDF
                    </button>
                    <button className="btn btn-sm btn-soft" onClick={() => doGenderExport('Male', 'excel')} disabled={maleCount === 0}>
                      <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card h-100 border">
                  <div className="card-body">
                    <h6>
                      <i className="bi bi-gender-female text-danger me-1" /> Female applicants
                    </h6>
                    <p className="text-muted small mb-3">
                      All female applicants.
                      <br />
                      <strong>{femaleCount}</strong> total
                    </p>
                    <button className="btn btn-sm btn-primary me-1" onClick={() => doGenderExport('Female', 'pdf')} disabled={femaleCount === 0}>
                      <i className="bi bi-file-pdf me-1" />PDF
                    </button>
                    <button className="btn btn-sm btn-soft" onClick={() => doGenderExport('Female', 'excel')} disabled={femaleCount === 0}>
                      <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Export reports (status/time based) ─── */}
        <div className="card border-0 shadow-sm">
          <div className="card-header">
            <i className="bi bi-download text-primary-pdao me-1" /> Export reports
          </div>
          <div className="card-body">
            <div className="row g-3">
              {[
                { scope: 'daily', title: 'Daily applications', desc: 'Applications submitted today.' },
                { scope: 'monthly', title: 'Monthly applications', desc: 'Applications submitted this month.' },
                { scope: 'approved', title: 'Approved applications', desc: 'All approved PWD applications.' },
                { scope: 'rejected', title: 'Rejected applications', desc: 'All rejected applications.' },
              ].map((r) => (
                <div className="col-md-6 col-xl-3" key={r.scope}>
                  <div className="card h-100 border">
                    <div className="card-body">
                      <h6>{r.title}</h6>
                      <p className="text-muted small mb-3">{r.desc}</p>
                      <button className="btn btn-sm btn-primary me-1" onClick={() => doExport(r.scope, 'pdf')}>
                        <i className="bi bi-file-pdf me-1" />PDF
                      </button>
                      <button className="btn btn-sm btn-soft" onClick={() => doExport(r.scope, 'excel')}>
                        <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                      </button>
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
            <span>
              <i className="bi bi-search text-primary-pdao me-1" /> Search Applicants
              <span className="badge bg-primary bg-opacity-10 text-primary-pdao ms-2">
                {filteredApplicants.length} result{filteredApplicants.length !== 1 ? 's' : ''}
              </span>
            </span>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
                <i className="bi bi-x-circle me-1" /> Clear
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => exportFiltered('pdf')}
                disabled={filteredApplicants.length === 0}
              >
                <i className="bi bi-file-pdf me-1" />PDF
              </button>
              <button
                className="btn btn-sm btn-soft"
                onClick={() => exportFiltered('excel')}
                disabled={filteredApplicants.length === 0}
              >
                <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <label className="form-label small text-muted">Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search name…"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Barangay / Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Union Cauayan City"
                  value={addrFilter}
                  onChange={(e) => setAddrFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3">
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
              <div className="col-md-3">
                <label className="form-label small text-muted">Gender</label>
                <select
                  className="form-select"
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                >
                  <option value="">All Genders</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredApplicants.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Gender</th>
                      <th>Address</th>
                      <th>Disability</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplicants.map((app) => {
                      const addr = [app.barangay, app.municipality, app.province].filter(Boolean).join(', ')
                      return (
                        <tr key={app.id}>
                          <td className="fw-semibold">{appFullName(app)}</td>
                          <td>{app.gender || '—'}</td>
                          <td className="small text-muted">{addr || app.address || '—'}</td>
                          <td>{app.disability_type || '—'}</td>
                          <td>
                            <span className={`badge status-badge ${statusColor(app.status)}`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="small text-muted">{fmtDate(app.submission_date)}</td>
                        </tr>
                      )
                    })}
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
