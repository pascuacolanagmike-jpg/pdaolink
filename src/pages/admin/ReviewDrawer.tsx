import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Outcome = 'approved' | 'rejected' | 'resubmit'

export default function ReviewDrawer({
  userId,
  onClose,
  onDone,
}: {
  userId: string
  onClose: () => void
  onDone: (outcome?: Outcome | 'saved') => void
}) {
  const [docs, setDocs] = useState<{ doc_type: string; url: string }[]>([])
  const [profile, setProfile] = useState<{
    fullname: string | null
    email: string | null
  } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<Outcome | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)

      const [docsRes, profileRes] = await Promise.all([
        supabase
          .from('verification_docs')
          .select('doc_type, storage_path')
          .eq('user_id', userId),
        supabase
          .from('profiles')
          .select('fullname, email')
          .eq('id', userId)
          .single(),
      ])

      if (docsRes.error) setError(docsRes.error.message)
      if (profileRes.error) setError(profileRes.error.message)

      const withUrls = await Promise.all(
        (docsRes.data ?? []).map(async (d) => {
          const { data: s } = await supabase.storage
            .from('verification-docs')
            .createSignedUrl(d.storage_path, 60)
          return { doc_type: d.doc_type, url: s?.signedUrl ?? '' }
        })
      )

      if (cancelled) return
      setDocs(withUrls)
      setProfile(profileRes.data ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  async function decide(action: Outcome) {
    setError(null)

    if ((action === 'rejected' || action === 'resubmit') && !note.trim()) {
      setError(
        action === 'rejected'
          ? 'Please provide a reason for rejection.'
          : 'Please tell the applicant what needs to be fixed.'
      )
      return
    }

    setBusy(action)

    const { error: rpcErr } = await supabase.rpc('admin_decide_verification', {
      p_user_id: userId,
      p_action: action,
      p_note: note.trim() || null,
    })

    setBusy(null)

    if (rpcErr) {
      console.error('[ReviewDrawer] decide error:', rpcErr)
      setError(rpcErr.message)
      return
    }

    onDone(action)
  }

  return (
    <>
      <div
        className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
        style={{ zIndex: 1040 }}
        onClick={busy ? undefined : onClose}
      />
      <div
        className="position-fixed top-0 end-0 h-100 bg-white shadow d-flex flex-column"
        style={{ width: 480, maxWidth: '90vw', zIndex: 1050 }}
      >
        {/* Header */}
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <strong>Review documents</strong>
            {profile && (
              <div className="text-muted small">
                {profile.fullname || '—'}
                {profile.email ? ` · ${profile.email}` : ''}
              </div>
            )}
          </div>
          <button
            className="btn-close"
            onClick={onClose}
            disabled={!!busy}
            aria-label="Close"
          />
        </div>

        {/* Body (scrollable) */}
        <div className="p-3 flex-grow-1" style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" />
            </div>
          ) : (
            <>
              {error && (
                <div className="alert alert-danger py-2 small d-flex align-items-start">
                  <i className="bi bi-exclamation-triangle-fill me-2" />
                  <div className="flex-grow-1">{error}</div>
                  <button
                    className="btn-close"
                    onClick={() => setError(null)}
                    aria-label="Close"
                  />
                </div>
              )}

              {docs.length === 0 && !error && (
                <div className="alert alert-warning small">
                  <i className="bi bi-exclamation-triangle me-1" />
                  No documents found for this applicant.
                </div>
              )}

              {docs.map((d) => (
                <div key={d.doc_type} className="mb-3">
                  <div className="text-muted small text-uppercase fw-semibold mb-1">
                    {d.doc_type.replace(/_/g, ' ')}
                  </div>
                  {d.url.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline-secondary btn-sm"
                    >
                      <i className="bi bi-file-earmark-pdf me-1" /> Open PDF
                    </a>
                  ) : (
                    <a href={d.url} target="_blank" rel="noreferrer">
                      <img
                        src={d.url}
                        alt={d.doc_type}
                        className="img-fluid rounded border"
                        style={{ maxHeight: 320, objectFit: 'contain' }}
                      />
                    </a>
                  )}
                </div>
              ))}

              <label className="form-label small mt-3">
                Note to applicant
                <span className="text-muted"> (optional for approval)</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Birth certificate is blurry, please re-upload."
                disabled={!!busy}
              />
              <div className="form-text small">
                Required when rejecting or requesting a resubmission. It will be
                shown to the applicant in their notifications.
              </div>
            </>
          )}
        </div>

        {/* Footer (sticky actions) */}
        {!loading && (
          <div className="p-3 border-top">
            <div className="d-grid gap-2">
              <button
                className="btn btn-success"
                disabled={!!busy}
                onClick={() => decide('approved')}
              >
                {busy === 'approved' ? (
                  <span className="spinner-border spinner-border-sm me-1" />
                ) : (
                  <i className="bi bi-check-lg me-1" />
                )}
                Approve
              </button>

              <button
                className="btn btn-outline-warning"
                disabled={!!busy}
                onClick={() => decide('resubmit')}
              >
                {busy === 'resubmit' ? (
                  <span className="spinner-border spinner-border-sm me-1" />
                ) : (
                  <i className="bi bi-arrow-repeat me-1" />
                )}
                Request resubmission
              </button>

              <button
                className="btn btn-outline-danger"
                disabled={!!busy}
                onClick={() => decide('rejected')}
              >
                {busy === 'rejected' ? (
                  <span className="spinner-border spinner-border-sm me-1" />
                ) : (
                  <i className="bi bi-x-lg me-1" />
                )}
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}