import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  statusColor,
  statusLabel,
  fmtDate,
  appFullName,
  ALL_STATUSES,
  DISABILITY_TYPES,
  type Application,
} from '../../lib/types'

// ─────────────────────────────────────────────────────────
// Helper: pull the display list of disability types from an
// application row. Handles both the new array field and the
// legacy single-string field.
// ─────────────────────────────────────────────────────────
function getDisabilityList(a: Application): string[] {
  const raw = (a as any).disability_types
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((x) => typeof x === 'string' && x.trim())
  }
  const legacy = (a as any).disability_type
  if (typeof legacy === 'string' && legacy.trim()) return [legacy]
  return []
}

type InactiveKind = 'Deceased' | 'Transferred'

interface ConfirmState {
  app: Application
  kind: InactiveKind
}

interface ToastState {
  type: 'success' | 'danger' | 'warning'
  text: string
}

export default function ApplicantsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile } = useAuth()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const q = searchParams.get('q') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const disabilityFilter = searchParams.get('disability') ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('applications')
      .select('*')
      .eq('is_deleted', false) // active records only

    if (statusFilter && ALL_STATUSES.includes(statusFilter as any)) {
      query = query.eq('status', statusFilter)
    }
    query = query.order('submission_date', { ascending: false })

    const { data, error } = await query
    if (error) {
      console.error('Error loading applications:', error)
      setToast({ type: 'danger', text: `Could not load applicants: ${error.message}` })
      setLoading(false)
      return
    }

    let rows = (data ?? []) as Application[]

    if (disabilityFilter) {
      rows = rows.filter((a) => getDisabilityList(a).includes(disabilityFilter))
    }

    if (q) {
      const lower = q.toLowerCase()
      rows = rows.filter((a) => {
        const disabilities = getDisabilityList(a).join(' ').toLowerCase()
        return (
          a.id.toLowerCase().includes(lower) ||
          (a.first_name ?? '').toLowerCase().includes(lower) ||
          (a.last_name ?? '').toLowerCase().includes(lower) ||
          (a.email ?? '').toLowerCase().includes(lower) ||
          disabilities.includes(lower)
        )
      })
    }

    setApplications(rows)
    setLoading(false)
  }, [q, statusFilter, disabilityFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const ms = toast.type === 'success' ? 4000 : 12000
    const t = window.setTimeout(() => setToast(null), ms)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [openMenuId])

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const handleMarkInactive = (application: Application, kind: InactiveKind) => {
    setOpenMenuId(null)
    setRemarks('')
    setConfirm({ app: application, kind })
  }

  const closeConfirm = () => {
    if (busy) return
    setConfirm(null)
    setRemarks('')
  }

  const runInactiveAction = async () => {
    if (!confirm) return
    const { app, kind } = confirm

    setBusy(true)
    setSavingId(app.id)

    const { data: updated, error } = await supabase
      .from('applications')
      .update({
        status: kind,
        is_deleted: true,
        last_updated: new Date().toISOString(),
      })
      .eq('id', app.id)
      .select('id')

    if (error || !updated || updated.length === 0) {
      setBusy(false)
      setSavingId(null)
      setToast({
        type: 'danger',
        text: error?.message ?? 'Update was blocked by the database.',
      })
      return
    }

    await supabase.from('status_logs').insert({
      application_id: app.id,
      old_status: app.status,
      new_status: kind,
      remarks: remarks.trim(),
      changed_by: profile?.fullname ?? 'Admin',
    })

    setBusy(false)
    setSavingId(null)
    setConfirm(null)
    setRemarks('')
    setToast({
      type: 'success',
      text: `Marked ${appFullName(app) || app.id.slice(0, 8)} as ${statusLabel(kind)}.`,
    })

    await load()
  }

  const confirmCopy = (() => {
    if (!confirm) return null
    const { app, kind } = confirm
    const name = appFullName(app) || app.id.slice(0, 8)
    const label = statusLabel(kind)

    if (kind === 'Deceased') {
      return {
        title: `Mark applicant as ${label}`,
        icon: 'bi-heartbreak text-dark',
        body: (
          <>
            <p className="mb-2">
              You are about to mark <strong>{name}</strong> as <strong>{label}</strong>.
            </p>
            <p className="text-muted small mb-0">
              The record will be moved to the Inactive list and will no longer appear here.
              No email or notification will be sent.
            </p>
          </>
        ),
        confirmLabel: `Mark as ${label}`,
        confirmClass: 'btn-dark',
      }
    }

    return {
      title: `Mark applicant as ${label}`,
      icon: 'bi-box-arrow-right text-secondary',
      body: (
        <>
          <p className="mb-2">
            You are about to mark <strong>{name}</strong> as <strong>{label}</strong>.
          </p>
          <p className="text-muted small mb-0">
            The record will be moved to the Inactive list and will no longer appear here.
            No email or notification will be sent.
          </p>
        </>
      ),
      confirmLabel: `Mark as ${label}`,
      confirmClass: 'btn-secondary',
    }
  })()

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Applicants</h3>
        <p className="text-muted mb-4">Search, filter, and review PWD applications.</p>

        {toast && (
          <div
            className={`alert ${
              toast.type === 'success'
                ? 'alert-success'
                : toast.type === 'warning'
                  ? 'alert-warning'
                  : 'alert-danger'
            } d-flex align-items-start gap-2`}
            role="status"
          >
            <i className={`bi ${
              toast.type === 'success'
                ? 'bi-check-circle'
                : toast.type === 'warning'
                  ? 'bi-info-circle'
                  : 'bi-exclamation-triangle'
            } mt-1`} />
            <div className="flex-grow-1" style={{ whiteSpace: 'pre-wrap' }}>{toast.text}</div>
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setToast(null)} />
          </div>
        )}

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Search</label>
                <input
                  className="form-control"
                  value={q}
                  onChange={(e) => updateParam('q', e.target.value)}
                  placeholder="ID, name, email, disability type…"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => updateParam('status', e.target.value)}
                >
                  <option value="">All</option>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Disability type</label>
                <select
                  className="form-select"
                  value={disabilityFilter}
                  onChange={(e) => updateParam('disability', e.target.value)}
                >
                  <option value="">All</option>
                  {DISABILITY_TYPES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 d-flex gap-2">
                <button className="btn btn-primary w-100" onClick={load}>
                  <i className="bi bi-funnel me-1" /> Filter
                </button>
                <Link to="/admin/applicants" className="btn btn-soft" title="Reset">
                  <i className="bi bi-arrow-counterclockwise" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-header">
            <i className="bi bi-list-ul text-primary-pdao me-1" />{' '}
            {loading ? 'Loading…' : `${applications.length} application(s)`}
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Disability</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <div className="spinner-border text-primary" />
                    </td>
                  </tr>
                ) : applications.length > 0 ? (
                  applications.map((a) => {
                    const disabilities = getDisabilityList(a)
                    return (
                      <tr key={a.id}>
                        <td>#{a.id.slice(0, 8)}</td>
                        <td className="fw-semibold">{appFullName(a) || '—'}</td>
                        <td className="text-muted">{a.email ?? '—'}</td>
                        <td style={{ maxWidth: 320 }}>
                          {disabilities.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            disabilities.join(', ')
                          )}
                        </td>
                        <td>
                          <span className={`badge status-badge ${statusColor(a.status)}`}>
                            {statusLabel(a.status)}
                          </span>
                        </td>
                        <td className="text-muted small">{fmtDate(a.submission_date)}</td>
                        <td className="text-end">
                          <div className="d-inline-flex gap-2 align-items-center">
                            <Link to={`/admin/applicant/${a.id}`} className="btn btn-sm btn-soft">
                              <i className="bi bi-eye me-1" /> Review
                            </Link>

                            <div className="position-relative">
                              <button
                                className="btn btn-sm btn-soft"
                                title="Mark applicant as inactive"
                                aria-label="More actions"
                                aria-haspopup="true"
                                aria-expanded={openMenuId === a.id}
                                disabled={savingId === a.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(openMenuId === a.id ? null : a.id)
                                }}
                              >
                                {savingId === a.id ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : (
                                  <i className="bi bi-three-dots-vertical" />
                                )}
                              </button>

                              {openMenuId === a.id && (
                                <div
                                  className="dropdown-menu show shadow-sm"
                                  style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000, marginTop: 4 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button className="dropdown-item" onClick={() => handleMarkInactive(a, 'Deceased')}>
                                    <i className="bi bi-heartbreak me-2 text-dark" />
                                    Mark as Deceased
                                  </button>
                                  <button className="dropdown-item" onClick={() => handleMarkInactive(a, 'Transferred')}>
                                    <i className="bi bi-box-arrow-right me-2 text-secondary" />
                                    Mark as {statusLabel('Transferred')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-5">
                      <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2rem' }} />
                      No applications match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirm && confirmCopy && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" onClick={closeConfirm}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <h5 className="mb-0" id="confirmTitle">
                <i className={`bi ${confirmCopy.icon} me-1`} />
                {confirmCopy.title}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeConfirm} disabled={busy} />
            </div>

            <div className="confirm-body">
              {confirmCopy.body}
              <div className="mt-3">
                <label className="form-label small text-muted" htmlFor="inactiveRemarks">
                  Remarks <span className="text-muted">(optional — saved to status history)</span>
                </label>
                <textarea
                  id="inactiveRemarks"
                  className="form-control"
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={busy}
                  placeholder={
                    confirm.kind === 'Transferred'
                      ? 'e.g. Transferred to Cebu City PDAO on 2025-06-01'
                      : 'e.g. Confirmed by Barangay Captain, death certificate on file'
                  }
                />
              </div>
            </div>

            <div className="confirm-footer">
              <button type="button" className="btn btn-soft" onClick={closeConfirm} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmCopy.confirmClass}`}
                onClick={() => void runInactiveAction()}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                    Working…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2 me-1" />
                    {confirmCopy.confirmLabel}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .confirm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 1080;
          animation: confirmFade 0.15s ease-out;
        }
        .confirm-card {
          background: #fff;
          border-radius: 0.75rem;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
          animation: confirmPop 0.15s ease-out;
        }
        .confirm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e9ecef;
        }
        .confirm-body { padding: 1.25rem; }
        .confirm-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 0.85rem 1.25rem;
          border-top: 1px solid #e9ecef;
          background: #f8fafc;
          border-radius: 0 0 0.75rem 0.75rem;
        }
        @keyframes confirmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirmPop {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </AppLayout>
  )
}