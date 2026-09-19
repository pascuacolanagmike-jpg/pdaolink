import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ReviewDrawer({
  userId,
  onClose,
  onDone,
}: {
  userId: string
  onClose: () => void
  onDone: () => void
}) {
  const [docs, setDocs] = useState<{ doc_type: string; url: string }[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
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

      const withUrls = await Promise.all(
        (docsRes.data ?? []).map(async (d) => {
          const { data: s } = await supabase.storage
            .from('verification-docs')
            .createSignedUrl(d.storage_path, 60)
          return { doc_type: d.doc_type, url: s?.signedUrl ?? '' }
        })
      )
      setDocs(withUrls)
      setProfile(profileRes.data)

      await supabase
        .from('verification_audit')
        .insert({ user_id: userId, action: 'viewed' })

      setLoading(false)
    })()
  }, [userId])

  async function decide(action: 'approved' | 'rejected' | 'resubmit') {
    setBusy(true)
    const { error } = await supabase.rpc('admin_decide_verification', {
      p_user_id: userId,
      p_action: action,
      p_note: note || null,
    })
    setBusy(false)
    if (error) return alert(error.message)
    onDone()
  }

  return (
    <>
      <div
        className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />
      <div
        className="position-fixed top-0 end-0 h-100 bg-white shadow"
        style={{ width: 480, maxWidth: '90vw', zIndex: 1050, overflowY: 'auto' }}
      >
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <strong>Review documents</strong>
            {profile && (
              <div className="text-muted small">
                {profile.fullname} · {profile.email}
              </div>
            )}
          </div>
          <button className="btn-close" onClick={onClose} />
        </div>

        <div className="p-3">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" />
            </div>
          ) : (
            <>
              {docs.length === 0 && (
                <div className="alert alert-warning small">
                  No documents found for this applicant.
                </div>
              )}

              {docs.map((d) => (
                <div key={d.doc_type} className="mb-3">
                  <div className="text-muted small text-uppercase fw-semibold mb-1">
                    {d.doc_type.replace(/_/g, ' ')}
                  </div>
                  {d.url.toLowerCase().endsWith('.pdf') ? (
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
                Note to applicant (optional)
              </label>
              <textarea
                className="form-control mb-3"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Birth certificate is blurry, please re-upload."
              />

              <div className="d-grid gap-2">
                <button
                  className="btn btn-success"
                  disabled={busy}
                  onClick={() => decide('approved')}
                >
                  <i className="bi bi-check-lg me-1" /> Approve
                </button>
                <button
                  className="btn btn-outline-warning"
                  disabled={busy}
                  onClick={() => decide('resubmit')}
                >
                  <i className="bi bi-arrow-repeat me-1" /> Request resubmission
                </button>
                <button
                  className="btn btn-outline-danger"
                  disabled={busy}
                  onClick={() => decide('rejected')}
                >
                  <i className="bi bi-x-lg me-1" /> Reject
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}