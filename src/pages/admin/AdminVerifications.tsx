import { useEffect, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import ReviewDrawer from './ReviewDrawer'

interface Row {
  id: string
  fullname: string
  email: string
  verification_status: string
  verification_submitted_at: string | null
}

export default function AdminVerifications() {
  const [rows, setRows] = useState<Row[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const ch = supabase
      .channel('verifs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id, fullname, email, verification_status, verification_submitted_at')
      .in('verification_status', ['pending', 'resubmit'])
      .order('verification_submitted_at', { ascending: true })
    setRows((data ?? []) as Row[])
    setLoading(false)
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="mb-0">Pending verifications</h4>
            <p className="text-muted small mb-0">
              Applicants waiting for document approval.
            </p>
          </div>
          <span className="badge bg-warning text-dark fs-6">{rows.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center text-muted py-5">
              <i className="bi bi-check-circle" style={{ fontSize: 40 }} />
              <div className="mt-2">No pending submissions.</div>
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
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="fw-semibold">{r.fullname}</td>
                      <td className="text-muted small">{r.email}</td>
                      <td className="text-muted small">
                        {r.verification_submitted_at
                          ? new Date(r.verification_submitted_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setOpenId(r.id)}
                        >
                          Review
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
          onDone={() => {
            setOpenId(null)
            load()
          }}
        />
      )}
    </AppLayout>
  )
}