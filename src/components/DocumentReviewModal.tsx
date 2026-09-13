import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { prettyDocType, fmtDateTime, type DocumentRow } from '../lib/types'
import Alert from './Alert'

interface Props {
  doc: DocumentRow
  applicantUserId: string
  adminName: string
  onClose: () => void
  onReviewed: (updated: DocumentRow) => void
}

export default function DocumentReviewModal({
  doc,
  applicantUserId,
  adminName,
  onClose,
  onReviewed,
}: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [remarks, setRemarks] = useState(doc.review_remarks ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 60 * 10)
      if (cancelled) return
      if (error) setError(error.message)
      else setUrl(data?.signedUrl ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [doc.storage_path])

  const isImage = /\.(jpe?g|png)$/i.test(doc.filename)
  const isPdf = /\.pdf$/i.test(doc.filename)

  const decide = async (status: 'approved' | 'rejected') => {
    setSaving(true)
    setError(null)

    const { data, error: uErr } = await supabase
      .from('documents')
      .update({
        status,
        review_remarks: remarks || null,
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
      .select()
      .single()

    if (uErr) {
      setError(uErr.message)
      setSaving(false)
      return
    }

    await supabase.from('notifications').insert({
      user_id: applicantUserId,
      message:
        status === 'approved'
          ? `Your document "${doc.filename}" was approved.`
          : `Your document "${doc.filename}" was rejected.${
              remarks ? ` Remarks: ${remarks}` : ''
            }`,
      link: '/upload',
    })

    onReviewed(data as DocumentRow)
    setSaving(false)
    onClose()
  }

  const alreadyReviewed = doc.status === 'approved' || doc.status === 'rejected'

  return (
    <div
      className="modal d-block"
      style={{ background: 'rgba(0,0,0,.55)', zIndex: 1050 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">{prettyDocType(doc.document_type)}</h5>
              <small className="text-muted">
                {doc.filename} · uploaded {fmtDateTime(doc.uploaded_at)}
              </small>
            </div>
            <button className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          <div
            className="modal-body bg-light"
            style={{ minHeight: 400, maxHeight: '70vh', overflow: 'auto' }}
          >
            {loading && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" />
              </div>
            )}
            {error && <Alert variant="danger" message={error} />}

            {!loading && url && isImage && (
              <img src={url} alt={doc.filename} className="img-fluid d-block mx-auto shadow-sm" />
            )}

            {!loading && url && isPdf && (
              <iframe
                src={url}
                title={doc.filename}
                style={{ width: '100%', height: '65vh', border: 0 }}
              />
            )}

            {!loading && url && !isImage && !isPdf && (
              <div className="text-center py-5">
                <a href={url} target="_blank" rel="noreferrer" className="btn btn-soft">
                  <i className="bi bi-download me-1" /> Open file
                </a>
              </div>
            )}
          </div>

          <div className="modal-footer flex-column align-items-stretch gap-2">
            {alreadyReviewed && (
              <div className="small text-muted">
                Previously {doc.status} by {doc.reviewed_by ?? 'admin'}
                {doc.reviewed_at ? ` · ${fmtDateTime(doc.reviewed_at)}` : ''}
              </div>
            )}
            <textarea
              className="form-control"
              rows={2}
              placeholder="Remarks (optional, sent to the applicant)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => decide('rejected')}
                disabled={saving || loading}
              >
                <i className="bi bi-x-circle me-1" /> Reject
              </button>
              <button
                className="btn btn-success"
                onClick={() => decide('approved')}
                disabled={saving || loading}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" /> Saving…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-1" /> Approve
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
