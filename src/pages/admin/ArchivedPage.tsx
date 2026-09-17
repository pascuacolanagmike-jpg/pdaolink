import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import {
  statusColor,
  fmtDate,
  fmtDateTime,
  appFullName,
  type Application,
} from '../../lib/types'

// All the statuses an application can hold
const STATUS_COLUMNS = [
  'Under Review',
  'Needs Revision',
  'Rejected',
  'Approved',
  'Ready for Pickup',
] as const

type StatusColumn = typeof STATUS_COLUMNS[number]

function getDisabilityList(a: Application): string[] {
  const raw = (a as any).disability_types
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((x) => typeof x === 'string' && x.trim())
  }
  const legacy = (a as any).disability_type
  if (typeof legacy === 'string' && legacy.trim()) return [legacy]
  return []
}

export default function ArchivedPage() {
  const [all, setAll] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusColumn | ''>('')

  // ── Load ONLY deleted applications ──
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('is_deleted', true)                 // ← ONLY deleted
        .order('last_updated', { ascending: false, nullsFirst: false })

      if (error) {
        setError(error.message)
      } else {
        setAll((data ?? []) as Application[])
      }
      setLoading(false)
    })()
  }, [])

  // ── Apply search + status filter ──
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return all.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false

      if (q) {
        const first = (a.first_name ?? '').toLowerCase()
        const last = (a.last_name ?? '').toLowerCase()
        const full = `${first} ${last}`.trim()
        const email = (a.email ?? '').toLowerCase()
        const id = a.id.toLowerCase()
        const disabilities = getDisabilityList(a).join(' ').toLowerCase()

        const hit =
          first.includes(q) ||
          last.includes(q) ||
          full.includes(q) ||
          email.includes(q) ||
          id.includes(q) ||
          disabilities.includes(q)

        if (!hit) return false
      }

      return true
    })
  }, [all, searchQuery, statusFilter])

  // ── Counts per status ──
  const counts = useMemo(() => {
    const base: Record<StatusColumn, number> = {
      'Under Review': 0,
      'Needs Revision': 0,
      Rejected: 0,
      Approved: 0,
      'Ready for Pickup': 0,
    }
    for (const a of all) {
      if (base[a.status as StatusColumn] !== undefined) {
        base[a.status as StatusColumn]++
      }
    }
    return base
  }, [all])

  const total = all.length

  const handleSearch = () => setSearchQuery(searchInput)

  const handleClear = () => {
    setSearchInput('')
    setSearchQuery('')
    setStatusFilter('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <h3 className="mb-1">
              <i className="bi bi-archive text-primary-pdao me-1" />
              Archived / Deleted Applications
            </h3>
            <p className="text-muted mb-0">
              Permanent logbook of deleted applicants. Records stay here even after
              they are removed from the main list.
            </p>
          </div>
          <span className="badge bg-secondary fs-6">
            {loading ? '…' : `${total} deleted record${total === 1 ? '' : 's'}`}
          </span>
        </div>

        {error && (
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-1" />
            {error}
          </div>
        )}

        {/* ─── Single search bar ─── */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2">
              <div className="col">
                <input
                  className="form-control form-control-lg"
                  placeholder="Search deleted records by name, email, ID, or disability…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="col-auto">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleSearch}
                  disabled={loading}
                >
                  <i className="bi bi-search me-1" /> Search
                </button>
              </div>
              <div className="col-auto">
                <button
                  className="btn btn-soft btn-lg"
                  onClick={handleClear}
                  disabled={loading}
                >
                  <i className="bi bi-x-circle me-1" /> Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Summary table ─── */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header">
            <i className="bi bi-bar-chart text-primary-pdao me-1" /> Overview by status
          </div>
          <div className="table-responsive">
            <table className="table table-bordered align-middle mb-0 summary-table">
              <thead>
                <tr>
                  <th className="text-center" style={{ minWidth: 180 }}>
                    <i className="bi bi-people me-1" /> Name
                  </th>
                  {STATUS_COLUMNS.map((s) => (
                    <th
                      key={s}
                      className="text-center status-col"
                      onClick={() =>
                        setStatusFilter(statusFilter === s ? '' : s)
                      }
                      title={`Click to filter: ${s}`}
                    >
                      <span className={`badge status-badge ${statusColor(s)}`}>
                        {s}
                      </span>
                    </th>
                  ))}
                  <th className="text-center">
                    <i className="bi bi-list-ol me-1" /> Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-center fw-semibold text-muted">
                    Deleted records
                  </td>
                  {STATUS_COLUMNS.map((s) => (
                    <td
                      key={s}
                      className={`text-center status-col ${
                        statusFilter === s ? 'active' : ''
                      }`}
                      onClick={() =>
                        setStatusFilter(statusFilter === s ? '' : s)
                      }
                    >
                      <span className="fs-5 fw-bold">{counts[s]}</span>
                    </td>
                  ))}
                  <td className="text-center">
                    <span className="fs-5 fw-bold text-primary-pdao">
                      {total}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Active filter chips */}
        {(statusFilter || searchQuery) && (
          <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
            <span className="text-muted small">Active filters:</span>
            {statusFilter && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setStatusFilter('')}
              >
                Status: {statusFilter} <i className="bi bi-x ms-1" />
              </button>
            )}
            {searchQuery && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setSearchQuery('')
                  setSearchInput('')
                }}
              >
                Search: "{searchQuery}" <i className="bi bi-x ms-1" />
              </button>
            )}
          </div>
        )}

        {/* ─── Results table ─── */}
        <div className="card border-0 shadow-sm">
          <div className="card-header">
            <i className="bi bi-trash text-primary-pdao me-1" />{' '}
            {loading
              ? 'Loading…'
              : `${filtered.length} deleted application(s)`}
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Disability</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Last Updated</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4">
                      <div className="spinner-border text-primary" />
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((a) => {
                    const disabilities = getDisabilityList(a)
                    const updated =
                      (a as any).last_updated ?? a.submission_date
                    return (
                      <tr key={a.id} className="deleted-row">
                        <td>
                          #{a.id.slice(0, 8)}
                          <span
                            className="badge bg-secondary ms-1"
                            title="Deleted record"
                          >
                            <i className="bi bi-trash" />
                          </span>
                        </td>
                        <td className="fw-semibold text-decoration-line-through text-muted">
                          {appFullName(a) || '—'}
                        </td>
                        <td className="text-muted">{a.email ?? '—'}</td>
                        <td style={{ maxWidth: 280 }}>
                          {disabilities.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            disabilities.join(', ')
                          )}
                        </td>
                        <td className="text-muted small">
                          {(a as any).application_type ?? '—'}
                        </td>
                        <td>
                          <span
                            className={`badge status-badge ${statusColor(a.status)}`}
                          >
                            {a.status}
                          </span>
                          <span className="badge bg-danger bg-opacity-10 text-danger ms-1">
                            Deleted
                          </span>
                        </td>
                        <td className="text-muted small">
                          {fmtDate(a.submission_date)}
                        </td>
                        <td className="text-muted small">
                          {updated ? fmtDateTime(updated) : '—'}
                        </td>
                        <td className="text-end">
                          <Link
                            to={`/admin/applicant/${a.id}`}
                            className="btn btn-sm btn-soft"
                          >
                            <i className="bi bi-eye me-1" /> View
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-5">
                      <i
                        className="bi bi-archive d-block mb-2"
                        style={{ fontSize: '2rem' }}
                      />
                      {total === 0
                        ? 'No deleted applications yet. Records will appear here when applicants are deleted.'
                        : 'No deleted records match your search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .summary-table thead th {
          background: #f8fafc;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          vertical-align: middle;
        }
        .summary-table .status-col {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .summary-table .status-col:hover {
          background: rgba(0, 86, 179, 0.06);
        }
        .summary-table .status-col.active {
          background: rgba(0, 86, 179, 0.12);
        }
        .summary-table td {
          vertical-align: middle;
        }
        .deleted-row {
          background: #fafafa !important;
          opacity: 0.8;
        }
        .deleted-row:hover {
          background: #f5f5f5 !important;
        }
      `}</style>
    </AppLayout>
  )
}