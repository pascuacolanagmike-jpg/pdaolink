import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

type Slot = 'id' | 'birth_cert' | 'medical_abstract'

const SLOTS: { key: Slot; label: string; hint: string }[] = [
  { key: 'id',               label: 'Valid ID',          hint: "Driver's license, PhilSys, passport, UMID" },
  { key: 'birth_cert',       label: 'Birth certificate', hint: 'PSA-issued' },
  { key: 'medical_abstract', label: 'Medical abstract',  hint: 'Signed by your physician' },
]

export default function VerifyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [uploaded, setUploaded] = useState<Partial<Record<Slot, string>>>({})
  const [busy, setBusy] = useState<Slot | null>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(slot: Slot, file: File) {
    if (!user) return
    setBusy(slot)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${slot}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('verification-docs')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { error: dbErr } = await supabase
        .from('verification_docs')
        .upsert(
          { user_id: user.id, doc_type: slot, storage_path: path },
          { onConflict: 'user_id,doc_type' }
        )
      if (dbErr) throw dbErr

      setUploaded(u => ({ ...u, [slot]: path }))
    } catch (e: any) {
      setError(e.message ?? 'Upload failed.')
    } finally {
      setBusy(null)
    }
  }

  async function submit() {
    if (!consent) return setError('Please give consent to process your documents.')
    if (Object.keys(uploaded).length < 3) return setError('Please upload all three documents.')

    const { error } = await supabase.rpc('submit_verification')
    if (error) return setError(error.message)
    navigate('/verify/pending', { replace: true })
  }

  const allUploaded = Object.keys(uploaded).length === 3

  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <div className="text-center mb-4">
        <img
          src="https://cdn.postimage.me/2026/09/13/cropped_circle_image-1.png"
          alt="PDAOLink"
          className="mb-3"
          style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }}
        />
        <h3 className="mb-1">Verify your identity</h3>
        <p className="text-muted mb-0">
          Upload the three documents below. An administrator will review them
          before your account is activated.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {SLOTS.map(s => (
        <div className="card mb-3 shadow-sm border-0" key={s.key}>
          <div className="card-body d-flex justify-content-between align-items-center">
            <div>
              <div className="fw-semibold">{s.label}</div>
              <div className="text-muted small">{s.hint}</div>
            </div>
            <div>
              {uploaded[s.key] ? (
                <span className="text-success small">
                  <i className="bi bi-check-circle-fill me-1" /> Uploaded
                </span>
              ) : busy === s.key ? (
                <span className="spinner-border spinner-border-sm text-primary" />
              ) : (
                <label className="btn btn-outline-primary btn-sm mb-0">
                  <i className="bi bi-upload me-1" /> Choose file
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={e => e.target.files?.[0] && upload(s.key, e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="consent"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
        />
        <label className="form-check-label small" htmlFor="consent">
          I consent to PDAOLink processing these documents for identity verification
          under RA 10173. Documents are used only for verification and are deleted
          after review.
        </label>
      </div>

      <button
        className="btn btn-primary w-100 py-2"
        onClick={submit}
        disabled={!!busy || !allUploaded || !consent}
      >
        <i className="bi bi-send me-1" /> Submit for review
      </button>
    </div>
  )
}