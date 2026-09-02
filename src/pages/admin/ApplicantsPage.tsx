import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { statusColor, fmtDate, appFullName, ALL_STATUSES, DISABILITY_TYPES, type Application } from '../../lib/types'

export default function ApplicantsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const q = searchParams.get('q') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const disabilityFilter = searchParams.get('disability') ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('applications').select('*')
    if (statusFilter && ALL_STATUSES.includes(statusFilter as any)) {
      query = query.eq('status', statusFilter)
    }
    if (disabilityFilter && (DISABILITY_TYPES as readonly string[]).includes(disabilityFilter)) {
      query = query.eq('disability_type', disabilityFilter)
    }
    query = query.order('submission_date', { ascending: false })
    let { data, error } = await query
    if (error) { setLoading(false); return }
    let rows = (data ?? []) as Application[]
    if (q) {
      const lower = q.toLowerCase()
      rows = rows.filter((a) =>
        a.id.toLowerCase().includes(lower) ||
        (a.first_name ?? '').toLowerCase().includes(lower) ||
        (a.last_name ?? '').toLowerCase().includes(lower) ||
        (a.email ?? '').toLowerCase().includes(lower) ||
        (a.disability_type ?? '').toLowerCase().includes(lower)
      )
    }
    setApplications(rows)
    setLoading(false)
  }, [q, statusFilter, disabilityFilter])

  useEffect(() => { load() }, [load])

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    setSearchParams(next)
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Applicants</h3>
        <p className="text-muted mb-4">Search, filter, and review PWD applications.</p>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Search</label>
                <input className="form-control" value={q} onChange={(e) => updateParam('q', e.target.value)} placeholder="ID, name, email, disability type…" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Status</label>
                <select className="form-select" value={statusFilter} onChange={(e) => updateParam('status', e.target.value)}>
                  <option value="">All</option>
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Disability type</label>
                <select className="form-select" value={disabilityFilter} onChange={(e) => updateParam('disability', e.target.value)}>
                  <option value="">All</option>
                  {DISABILITY_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-md-2 d-flex gap-2">
                <button className="btn btn-primary w-100" onClick={load}><i className="bi bi-funnel me-1" /> Filter</button>
                <Link to="/admin/applicants" className="btn btn-soft" title="Reset"><i className="bi bi-arrow-counterclockwise" /></Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-header"><i className="bi bi-list-ul text-primary-pdao me-1" /> {loading ? 'Loading…' : `${applications.length} application(s)`}</div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>ID</th><th>Applicant</th><th>Email</th><th>Disability</th><th>Status</th><th>Submitted</th><th className="text-end">Action</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-4"><div className="spinner-border text-primary" /></td></tr>
                ) : applications.length > 0 ? (
                  applications.map((a) => (
                    <tr key={a.id}>
                      <td>#{a.id.slice(0, 8)}</td>
                      <td className="fw-semibold">{appFullName(a) || '—'}</td>
                      <td className="text-muted">{a.email ?? '—'}</td>
                      <td>{a.disability_type ?? '—'}</td>
                      <td><span className={`badge status-badge ${statusColor(a.status)}`}>{a.status}</span></td>
                      <td className="text-muted small">{fmtDate(a.submission_date)}</td>
                      <td className="text-end"><Link to={`/admin/applicant/${a.id}`} className="btn btn-sm btn-soft"><i className="bi bi-eye me-1" /> Review</Link></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="text-center text-muted py-5"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2rem' }} />No applications match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
