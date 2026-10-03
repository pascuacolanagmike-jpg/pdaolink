import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { sendVerificationEmail } from '../../lib/email'
import ReviewDrawer from './ReviewDrawer'

interface Row {
  id: string
  fullname: string | null
  email: string | null
  verification_status: string
  verification_notes: string | null
  verification_submitted_at: string | null
  verification_reviewed_at: string | null
}

type Tab = 'pending' | 'approved' | 'rejected'

const TABS: { key: Tab; label: string; icon: string; statuses: string[] }[] = [
  { key: 'pending',  label: 'Pending',  icon: 'bi-hourglass-split', statuses: ['pending', 'resubmit'] },
  { key: 'approved', label: 'Approved', icon: 'bi-check-circle',    statuses: ['approved'] },
  { key: 'rejected', label: 'Rejected', icon: 'bi-x-circle',        statuses: ['rejected'] },
]

export default function AdminVerifications() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [flash, setFlash] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, fullname, email, verification_status, verification_notes, verification_submitted_at, verification_reviewed_at'
      )
      .in('verification_status', ['pending', 'resubmit', 'approved', 'rejected'])
      .order('verification_submitted_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('[AdminVerifications] load error:', error)
      setLoadError(error.message)
      setRows([])
    } else {
      setRows((data ?? []) as Row[])
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load()

    const ch = supabase
      .channel(`verifs:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => load()
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[AdminVerifications] realtime status:', status)
        }
      })

    return () => {
      supabase.removeChannel(ch)
    }
  }, [user, load])

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.verification_status === 'pending' || r.verification_status === 'resubmit').length,
      approved: rows.filter((r) => r.verification_status === 'approved').length,
      rejected: rows.filter((r) => r.verification_status === 'rejected').length,
    }),
    [rows]
  )

  const visibleRows = useMemo(() => {
    const statuses = TABS.find((t) => t.key === tab)?.statuses ?? []
    return rows.filter((r) => statuses.includes(r.verification_status))
  }, [rows, tab])

  // 🔔 Sends the email AFTER fetching the fresh row from Supabase
  const handleReviewDone = useCallback(
    async (outcome: 'approved' | 'rejected' | 'resubmit' | string) => {
      const reviewedId = openId
      setOpenId(null)

      // 1. Update UI right away
      if (outcome === 'approved') {
        setFlash('Applicant approved — notification sent.')
        setTab('approved')
      } else if (outcome === 'rejected') {
        setFlash('Applicant rejected — they will be notified with the reason.')
        setTab('rejected')
      } else if (outcome === 'resubmit') {
        setFlash('Resubmission requested — applicant notified.')
        setTab('pending')
      } else {
        setFlash('Review saved.')
      }

      // 2. Fetch the fresh row (drawer just updated it in Supabase)
      if (reviewedId && (outcome === 'approved' || outcome === 'rejected' || outcome === 'resubmit')) {
        const { data, error } = await supabase
          .from('profiles')
          .select('email, fullname, verification_notes')
          .eq('id', reviewedId)
          .maybeSingle()

        if (error) {
          console.error('[AdminVerifications] fetch fresh row error:', error)
        } else if (data?.email) {
          const res = await sendVerificationEmail({
            outcome: outcome as 'approved' | 'rejected' | 'resubmit',
            toEmail: data.email,
            toName: data.fullname,
            message: data.verification_notes,
          })
          if (!res.ok) {
            setLoadError(
              'Status was saved, but the notification email failed to send. Check the console for details.'
            )
          }
        } else {
          console.warn('[AdminVerifications] no email on profile, skipping send')
        }
      }

      // 3. Refresh the list
      load()
    },
    [openId, load]
  )

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="mb-0">User verifications</h4>
            <p className="text-muted small mb-0">
              Review applicant documents and approve or reject with a reason.
            </p>
          </div>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={load}
            disabled={refreshing}
            title="Refresh"
          >
            {refreshing ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <>
                <i className="bi bi-arrow-clockwise me-1" />
                Refresh
              </>
            )}
          </button>
        </div>

        {loadError && (
          <div className="alert alert-danger d-flex align-items-center" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2" />
            <div className="small flex-grow-1">
              <code>{loadError}</code>
            </div>
            <button
              className="btn-close"
              onClick={() => setLoadError(null)}
              aria-label="Close"
            />
          </div>
        )}

        {flash && (
          <div className="alert alert-success d-flex align-items-center py-2" role="alert">
            <i className="bi bi-check-circle-fill me-2" />
            <div className="small flex-grow-1">{flash}</div>
            <button
              className="btn-close"
              onClick={() => setFlash(null)}
              aria-label="Close"
            />
          </div>
        )}

        <ul className="nav nav-pills mb-3 gap-2">
          {TABS.map((t) => (
            <li className="nav-item" key={t.key}>
              <button
                className={`nav-link d-flex align-items-center gap-2 ${
                  tab === t.key ? 'active' : 'text-dark bg-light'
                }`}
                onClick={() => setTab(t.key)}
                type="button"
              >
                <i className={`bi ${t.icon}`} />
                {t.label}
                <span
                  className={`badge ${tab === t.key ? 'bg-white text-primary' : 'bg-secondary'}`}
                >
                  {counts[t.key]}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center text-muted py-5">
              <i
                className={`bi ${
                  tab === 'pending'
                    ? 'bi-check-circle'
                    : tab === 'approved'
                    ? 'bi-check-circle'
                    : 'bi-x-circle'
                }`}
                style={{ fontSize: 40 }}
              />
              <div className="mt-2">
                {tab === 'pending'
                  ? 'No pending submissions.'
                  : tab === 'approved'
                  ? 'No approved users yet.'
                  : 'No rejected users yet.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Submitted</th>
                    {tab !== 'pending' && <th>Reviewed</th>}
                    {tab === 'rejected' && <th>Reason</th>}
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.id}>
                      <td className="fw-semibold">{r.fullname || '—'}</td>
                      <td className="text-muted small">{r.email || '—'}</td>
                      <td className="text-muted small">
                        {r.verification_submitted_at
                          ? new Date(r.verification_submitted_at).toLocaleString()
                          : '—'}
                      </td>
                      {tab !== 'pending' && (
                        <td className="text-muted small">
                          {r.verification_reviewed_at
                            ? new Date(r.verification_reviewed_at).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {tab === 'rejected' && (
                        <td
                          className="text-muted small text-truncate"
                          style={{ maxWidth: 220 }}
                          title={r.verification_notes ?? ''}
                        >
                          {r.verification_notes || '—'}
                        </td>
                      )}
                      <td className="text-end">
                        <button
                          className={`btn btn-sm ${
                            tab === 'pending' ? 'btn-primary' : 'btn-outline-secondary'
                          }`}
                          onClick={() => setOpenId(r.id)}
                        >
                          {tab === 'pending' ? 'Review' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {openId && (
        <ReviewDrawer
          userId={openId}
          onClose={() => setOpenId(null)}
          onDone={handleReviewDone}
        />
      )}
    </AppLayout>
  )
}