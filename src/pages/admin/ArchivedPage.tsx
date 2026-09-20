import { useCallback, useEffect, useMemo, useState } from 'react'
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

type StatusColumn = (typeof STATUS_COLUMNS)[number]

/**
 * Archived rows may carry an extra `archived_hidden` flag.
 * If the column does not exist yet, `archived_hidden` is simply `undefined`
 * and the record is treated as "not hidden" — the page still works.
 */
type ArchivedApplication = Application & {
  archived_hidden?: boolean | null
  last_updated?: string | null
}

type ConfirmKind = 'hide' | 'unhide' | 'delete'

interface ConfirmState {
  kind: ConfirmKind
  ids: string[]
}

interface ToastState {
  type: 'success' | 'danger'
  text: string
}

const HIDDEN_COLUMN_HINT =
  'Missing column `archived_hidden`. Run: ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS archived_hidden boolean NOT NULL DEFAULT false;'

const isHidden = (a: ArchivedApplication) => a.archived_hidden === true

/** Turns raw Postgres errors into something actionable for the admin. */
function describeError(message: string): string {
  if (
    /archived_hidden/i.test(message) &&
    /(column|schema|does not exist)/i.test(message)
  ) {
    return `${message} — ${HIDDEN_COLUMN_HINT}`
  }
  return message
}

function getDisabilityList(a: Application): string[] {
  const raw = (a as any).disability_types
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((x: unknown) => typeof x === 'string' && x.trim())
  }
  const legacy = (a as any).disability_type
  if (typeof legacy === 'string' && legacy.trim()) return [legacy]
  return []
}

export default function ArchivedPage() {
  const [all, setAll] = useState<ArchivedApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusColumn | ''>('')
  const [showHidden, setShowHidden] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [confirmText, setConfirmText] = useState('')

  // ── Load ONLY deleted applications ──
  const loadArchive = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('is_deleted', true) // ← ONLY deleted
      .order('last_updated', { ascending: false, nullsFirst: false })

    if (error) {
      setError(describeError(error.message))
      setAll([])
    } else {
      setAll((data ?? []) as ArchivedApplication[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadArchive()
  }, [loadArchive])

  // ── Auto-dismiss toast ──
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(t)
  }, [toast])

  // ── Records currently visible (respects the "show hidden" toggle) ──
  const visibleAll = useMemo(
    () => (showHidden ? all : all.filter((a) => !isHidden(a))),
    [all, showHidden],
  )

  const hiddenCount = useMemo(
    () => all.reduce((n, a) => n + (isHidden(a) ? 1 : 0), 0),
    [all],
  )

  // ── Apply search + status filter ──
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return visibleAll.filter((a) => {
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
  }, [visibleAll, searchQuery, statusFilter])

  // ── Counts per status ──
  const counts = useMemo(() => {
    const base: Record<StatusColumn, number> = {
      'Under Review': 0,
      'Needs Revision': 0,
      Rejected: 0,
      Approved: 0,
      'Ready for Pickup': 0,
    }
    for (const a of visibleAll) {
      if (base[a.status as StatusColumn] !== undefined) {
        base[a.status as StatusColumn]++
      }
    }
    return base
  }, [visibleAll])

  const total = visibleAll.length

  // ── Selection (derived, so stale ids are ignored automatically) ──
  const selectedRows = useMemo(
    () => filtered.filter((a) => selectedIds.has(a.id)),
    [filtered, selectedIds],
  )
  const selectedIdsList = useMemo(
    () => selectedRows.map((a) => a.id),
    [selectedRows],
  )
  const allVisibleSelected =
    filtered.length > 0 && selectedRows.length === filtered.length
  const someVisibleSelected =
    selectedRows.length > 0 && selectedRows.length < filtered.length

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const everySelected =
        filtered.length > 0 && filtered.every((a) => next.has(a.id))
      if (everySelected) {
        for (const a of filtered) next.delete(a.id)
      } else {
        for (const a of filtered) next.add(a.id)
      }
      return next
    })
  }, [filtered])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleSearch = () => setSearchQuery(searchInput)

  const handleClear = () => {
    setSearchInput('')
    setSearchQuery('')
    setStatusFilter('')
    clearSelection()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  // ── Open / close the confirmation dialog ──
  const openConfirm = (kind: ConfirmKind, ids: string[]) => {
    if (ids.length === 0) return
    setConfirmText('')
    setConfirm({ kind, ids })
  }

  const closeConfirm = () => {
    if (busy) return
    setConfirm(null)
    setConfirmText('')
  }

  // ── Perform the confirmed action ──
  const runConfirmedAction = async () => {
    if (!confirm) return
    const { kind, ids } = confirm

    if (ids.length === 0) {
      closeConfirm()
      return
    }

    setBusy(true)

    if (kind === 'delete') {
      const { error } = await supabase
        .from('applications')
        .delete()
        .in('id', ids)

      setBusy(false)

      if (error) {
        setToast({
          type: 'danger',
          text: `Could not delete record(s): ${describeError(error.message)}`,
        })
        return
      }

      const removed = new Set(ids)
      setAll((prev) => prev.filter((a) => !removed.has(a.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
      setConfirm(null)
      setConfirmText('')
      setToast({
        type: 'success',
        text: `Permanently deleted ${ids.length} record${
          ids.length === 1 ? '' : 's'
        }.`,
      })
      return
    }

    // hide / unhide
    const hidden = kind === 'hide'
    const { error } = await supabase
      .from('applications')
      .update({ archived_hidden: hidden })
      .in('id', ids)

    setBusy(false)

    if (error) {
      setToast({
        type: 'danger',
        text: `Could not ${hidden ? 'hide' : 'restore'} record(s): ${describeError(
          error.message,
        )}`,
      })
      return
    }

    const affected = new Set(ids)
    setAll((prev) =>
      prev.map((a) =>
        affected.has(a.id) ? { ...a, archived_hidden: hidden } : a,
      ),
    )
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    setConfirm(null)
    setConfirmText('')
    setToast({
      type: 'success',
      text: hidden
        ? `Hidden ${ids.length} record${ids.length === 1 ? '' : 's'} from the archive.`
        : `Restored ${ids.length} record${ids.length === 1 ? '' : 's'} to the archive.`,
    })
  }

  const confirmCopy = (() => {
    if (!confirm) return null
    const n = confirm.ids.length
    const noun = `${n} record${n === 1 ? '' : 's'}`

    switch (confirm.kind) {
      case 'hide':
        return {
          title: 'Hide from archive',
          body: `${noun} will be hidden from this page. The data stays safely in the database and you can bring it back any time with the “Show hidden” toggle.`,
          confirmLabel: 'Hide',
          confirmClass: 'btn-primary',
          requireTyping: false,
        }
      case 'unhide':
        return {
          title: 'Restore to archive',
          body: `${noun} will become visible in the archive list again.`,
          confirmLabel: 'Restore',
          confirmClass: 'btn-primary',
          requireTyping: false,
        }
      case 'delete':
      default:
        return {
          title: 'Delete permanently',
          body: `${noun} will be permanently removed from the database. This action CANNOT be undone and all attached information will be lost forever.`,
          confirmLabel: 'Delete permanently',
          confirmClass: 'btn-danger',
          requireTyping: true,
        }
    }
  })()

  const canConfirm =
    !!confirm &&
    !busy &&
    (!confirmCopy?.requireTyping || confirmText.trim().toUpperCase() === 'DELETE')

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
              Permanent logbook of deleted applicants. Records stay here even
              after they are removed from the main list.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge bg-secondary fs-6">
              {loading
                ? '…'
                : `${total} shown · ${hiddenCount} hidden`}
            </span>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => void loadArchive()}
              disabled={loading || busy}
              title="Reload from database"
            >
              <i className="bi bi-arrow-clockwise me-1" /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-start gap-2">
            <i className="bi bi-exclamation-triangle mt-1" />
            <div className="flex-grow-1">{error}</div>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => void loadArchive()}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}

        {toast && (
          <div
            className={`alert ${
              toast.type === 'success' ? 'alert-success' : 'alert-danger'
            } d-flex align-items-start gap-2`}
            role="status"
          >
            <i
              className={`bi ${
                toast.type === 'success'
                  ? 'bi-check-circle'
                  : 'bi-exclamation-triangle'
              } mt-1`}
            />
            <div className="flex-grow-1">{toast.text}</div>
            <button
              type="button"
              className="btn-close"
              aria-label="Dismiss"
              onClick={() => setToast(null)}
            />
          </div>
        )}

        {/* ─── Search bar ─── */}
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

            <div className="form-check form-switch mt-3 mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="showHiddenToggle"
                checked={showHidden}
                onChange={(e) => {
                  setShowHidden(e.target.checked)
                  clearSelection()
                }}
                disabled={loading}
              />
              <label
                className="form-check-label"
                htmlFor="showHiddenToggle"
              >
                Show hidden records
                {hiddenCount > 0 && (
                  <span className="badge bg-secondary ms-2">
                    {hiddenCount}
                  </span>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* ─── Summary table ─── */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header">
            <i className="bi bi-bar-chart text-primary-pdao me-1" /> Overview by
            status
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
                    {showHidden ? 'Deleted records' : 'Visible records'}
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

        {/* ─── Bulk action bar ─── */}
        {selectedRows.length > 0 && (
          <div className="card border-0 shadow-sm mb-3 border-start border-4 border-primary">
            <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2">
              <span className="fw-semibold me-auto">
                <i className="bi bi-check2-square me-1" />
                {selectedRows.length} selected
              </span>

              <button
                type="button"
                className="btn btn-sm btn-soft"
                onClick={() =>
                  openConfirm(
                    showHidden ? 'unhide' : 'hide',
                    selectedIdsList,
                  )
                }
                disabled={busy}
              >
                <i
                  className={`bi ${
                    showHidden ? 'bi-eye' : 'bi-eye-slash'
                  } me-1`}
                />
                {showHidden ? 'Restore selected' : 'Hide selected'}
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => openConfirm('delete', selectedIdsList)}
                disabled={busy}
              >
                <i className="bi bi-trash me-1" /> Delete selected
              </button>

              <button
                type="button"
                className="btn btn-sm btn-link text-muted"
                onClick={clearSelection}
                disabled={busy}
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        {/* ─── Results table ─── */}
        <div className="card border-0 shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>
              <i className="bi bi-trash text-primary-pdao me-1" />{' '}
              {loading
                ? 'Loading…'
                : `${filtered.length} deleted application(s)`}
            </span>
            {hiddenCount > 0 && !showHidden && (
              <button
                type="button"
                className="btn btn-sm btn-link p-0"
                onClick={() => setShowHidden(true)}
              >
                {hiddenCount} hidden — show
              </button>
            )}
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 40 }} className="text-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      aria-label="Select all visible records"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected
                      }}
                      onChange={toggleSelectAllVisible}
                      disabled={loading || filtered.length === 0 || busy}
                    />
                  </th>
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
                    <td colSpan={10} className="text-center py-4">
                      <div className="spinner-border text-primary" />
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((a) => {
                    const disabilities = getDisabilityList(a)
                    const updated = a.last_updated ?? a.submission_date
                    const hidden = isHidden(a)

                    return (
                      <tr
                        key={a.id}
                        className={hidden ? 'hidden-row' : 'deleted-row'}
                      >
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            aria-label={`Select ${appFullName(a) || a.id}`}
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelect(a.id)}
                            disabled={busy}
                          />
                        </td>
                        <td>
                          #{a.id.slice(0, 8)}
                          <span
                            className="badge bg-secondary ms-1"
                            title="Deleted record"
                          >
                            <i className="bi bi-trash" />
                          </span>
                          {hidden && (
                            <span
                              className="badge bg-dark ms-1"
                              title="Hidden from archive"
                            >
                              <i className="bi bi-eye-slash" />
                            </span>
                          )}
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
                            className={`badge status-badge ${statusColor(
                              a.status,
                            )}`}
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
                          <div className="btn-group btn-group-sm">
                            <Link
                              to={`/admin/applicant/${a.id}`}
                              className="btn btn-soft"
                              title="View record"
                              aria-label="View record"
                            >
                              <i className="bi bi-eye" />
                            </Link>

                            <button
                              type="button"
                              className="btn btn-soft"
                              title={
                                hidden
                                  ? 'Restore to archive'
                                  : 'Hide from archive'
                              }
                              aria-label={
                                hidden
                                  ? 'Restore to archive'
                                  : 'Hide from archive'
                              }
                              onClick={() =>
                                openConfirm(
                                  hidden ? 'unhide' : 'hide',
                                  [a.id],
                                )
                              }
                              disabled={busy}
                            >
                              <i
                                className={`bi ${
                                  hidden ? 'bi-eye' : 'bi-eye-slash'
                                }`}
                              />
                            </button>

                            <button
                              type="button"
                              className="btn btn-soft text-danger"
                              title="Delete permanently"
                              aria-label="Delete permanently"
                              onClick={() => openConfirm('delete', [a.id])}
                              disabled={busy}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-5">
                      <i
                        className="bi bi-archive d-block mb-2"
                        style={{ fontSize: '2rem' }}
                      />
                      {all.length === 0
                        ? 'No deleted applications yet. Records will appear here when applicants are deleted.'
                        : filtered.length === 0 && visibleAll.length === 0
                          ? 'All deleted records are currently hidden. Turn on “Show hidden records” to see them.'
                          : 'No deleted records match your search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Confirmation dialog ─── */}
      {confirm && confirmCopy && (
        <div
          className="confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmTitle"
          onClick={closeConfirm}
        >
          <div
            className="confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-header">
              <h5 className="mb-0" id="confirmTitle">
                <i
                  className={`bi ${
                    confirm.kind === 'delete'
                      ? 'bi-exclamation-octagon text-danger'
                      : 'bi-question-circle text-primary-pdao'
                  } me-1`}
                />
                {confirmCopy.title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeConfirm}
                disabled={busy}
              />
            </div>

            <div className="confirm-body">
              <p className="mb-3">{confirmCopy.body}</p>

              {confirmCopy.requireTyping && (
                <div className="mb-0">
                  <label
                    className="form-label small text-muted"
                    htmlFor="confirmTextInput"
                  >
                    Type <strong>DELETE</strong> to confirm
                  </label>
                  <input
                    id="confirmTextInput"
                    className="form-control"
                    autoComplete="off"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={busy}
                    placeholder="DELETE"
                  />
                </div>
              )}
            </div>

            <div className="confirm-footer">
              <button
                type="button"
                className="btn btn-soft"
                onClick={closeConfirm}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmCopy.confirmClass}`}
                onClick={() => void runConfirmedAction()}
                disabled={!canConfirm}
              >
                {busy ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    />
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
        .hidden-row {
          background: #f1f3f5 !important;
          opacity: 0.55;
        }
        .hidden-row:hover {
          background: #eceff1 !important;
        }

        /* ── Confirmation dialog ── */
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
        .confirm-body {
          padding: 1.25rem;
        }
        .confirm-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 0.85rem 1.25rem;
          border-top: 1px solid #e9ecef;
          background: #f8fafc;
          border-radius: 0 0 0.75rem 0.75rem;
        }
        @keyframes confirmFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmPop {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </AppLayout>
  )
}