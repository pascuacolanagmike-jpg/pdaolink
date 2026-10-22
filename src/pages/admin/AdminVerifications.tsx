import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { sendVerificationEmail } from '../../lib/email'
import { sendVerificationSms } from '../../lib/sms'
import ReviewDrawer from './ReviewDrawer'

interface Row {
  id: string
  fullname: string | null
  email: string | null
  phone: string | null
  verification_status: string
  verification_notes: string | null
  verification_submitted_at: string | null
  verification_reviewed_at: string | null
}

type Tab = 'pending' | 'approved' | 'rejected'
type ReviewOutcome = 'approved' | 'rejected' | 'resubmit' | 'saved'

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
        'id, fullname, email, phone, verification_status, verification_notes, verification_submitted_at, verification_reviewed_at'
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

  const handleReviewDone = useCallback(
    async (outcome?: ReviewOutcome) => {
      const reviewedId = openId
      setOpenId(null)

      const result: ReviewOutcome = outcome ?? 'saved'

      if (result === 'approved') setTab('approved')
      else if (result === 'rejected') setTab('rejected')
      else if (result === 'resubmit') setTab('pending')

      if (reviewedId && (result === 'approved' || result === 'rejected' || result === 'resubmit')) {
        const { data, error } = await supabase
          .from('profiles')
          .select('email, fullname, phone, verification_notes')
          .eq('id', reviewedId)
          .maybeSingle()

        if (error) {
          console.error('[AdminVerifications] fetch fresh row error:', error)
          setLoadError('Status was saved, but we could not load applicant details to send notifications.')
        } else if (!data) {
          console.warn('[AdminVerifications] no profile found for', reviewedId)
        } else {
          const [emailResult, smsResult] = await Promise.all([
            data.email
              ? sendVerificationEmail({
                  outcome: result,
                  toEmail: data.email,
                  toName: data.fullname,
                  message: data.verification_notes,
                })
              : Promise.resolve({ ok: true, skipped: true as const }),
            data.phone
              ? sendVerificationSms({
                  outcome: result,
                  toPhone: data.phone,
                  toName: data.fullname,
                  message: data.verification_notes,
                })
              : Promise.resolve({ ok: true, skipped: true as const }),
          ])

          const emailOk = emailResult.ok
          const smsOk = smsResult.ok
          const emailSkipped = 'skipped' in emailResult
          const smsSkipped = 'skipped' in smsResult

          if (!emailOk && !smsOk) {
            setLoadError('Status was saved, but BOTH email and SMS failed. Check the console.')
          } else if (!emailOk && !emailSkipped) {
            setLoadError('Status saved and SMS sent, but email failed. Check the console.')
          } else if (!smsOk && !smsSkipped) {
            setLoadError(`Status saved and email sent, but SMS failed: ${smsResult.error ?? 'unknown error'}`)
          }

          const channels: string[] = []
          if (emailOk && !emailSkipped) channels.push('email')
          if (smsOk && !smsSkipped) channels.push('SMS')
          const sent = channels.length ? ` — notified via ${channels.join(' + ')}` : ' — no contact method on file'
          if (result === 'approved') setFlash(`Applicant approved${sent}.`)
          else if (result === 'rejected') setFlash(`Applicant rejected${sent}.`)
          else if (result === 'resubmit') setFlash(`Resubmission requested${sent}.`)
        }
      } else {
        setFlash('Review saved.')
      }

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
                    <th>Phone</th>
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
                        {r.phone ? (
                          <span title={r.phone}>
                            <i className="bi bi-phone me-1" />
                            {r.phone}
                          </span>
                        ) : (
                          <span className="text-warning" title="No phone on file — SMS will be skipped">
                            <i className="bi bi-exclamation-triangle me-1" />
                            none
                          </span>
                        )}
                      </td>
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