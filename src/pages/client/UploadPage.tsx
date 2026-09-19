import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  MAX_UPLOAD_MB, ALLOWED_EXTENSIONS, prettyDocType,
  type Application, type DocumentRow, fmtDateTime,
  docStatusBadge, DOC_STATUS_LABEL, type DocumentStatus,
} from '../../lib/types'
import Alert from '../../components/Alert'

// ─────────────────────────────────────────────────────────
// PWD ID requirements (based on PDAO checklist)
// ─────────────────────────────────────────────────────────
interface DocRequirement {
  key: string
  label: string
  description: string
  required: boolean
  forRepresentative?: boolean
  /** When true, only image files (png/jpg/jpeg) are allowed — no PDF */
  imageOnly?: boolean
}

// Extensions allowed for image-only uploads
const IMAGE_ONLY_EXTENSIONS = ['png', 'jpg', 'jpeg']

const REQUIRED_DOCS: DocRequirement[] = [
  {
    key: 'picture_1x1',
    label: '1x1 Picture (2 pcs)',
    description: 'With name and signature or thumb mark at the back. Only PNG or JPEG images allowed.',
    required: true,
    imageOnly: true,
  },
  {
    key: 'barangay_residence_cert',
    label: 'Barangay Residence Certification',
    description: 'Proof of residency in the barangay',
    required: true,
  },
  {
    key: 'medical_certificate',
    label: 'Medical Certificate (Non-Apparent)',
    description: 'For non-apparent disabilities',
    required: true,
  },
  {
    key: 'disability_certification',
    label: 'Disability Certification (Apparent)',
    description: 'For apparent disabilities',
    required: true,
  },
  {
    key: 'valid_id',
    label: 'Valid Government ID',
    description: 'Photo copy of any valid government-issued ID',
    required: true,
  },
  {
    key: 'birth_certificate',
    label: 'Birth Certificate',
    description: 'PSA or local civil registrar copy',
    required: true,
  },
  {
    key: 'proof_relationship',
    label: 'Proof of Relationship',
    description: 'PSA Birth Cert / Marriage Contract / Barangay Cert — required if applying as representative',
    required: false,
    forRepresentative: true,
  },
]

// Build accept string dynamically based on whether the doc is image-only
const acceptFor = (req: DocRequirement) =>
  req.imageOnly ? '.png,.jpg,.jpeg' : '.pdf,.jpg,.jpeg,.png'

// ─────────────────────────────────────────────────────────
// Safe UUID generator
// ─────────────────────────────────────────────────────────
function genUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID() } catch { /* fall through */ }
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  const rand = () => Math.random().toString(16).slice(2, 10)
  return `${Date.now().toString(16)}-${rand()}-${rand()}`
}

export default function UploadPage() {
  const { profile } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (!profile) return
    supabase
      .from('applications')
      .select('*')
      .eq('user_id', profile.id)
      .order('submission_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setApplication(data as Application | null)
        if (data) {
          supabase
            .from('documents')
            .select('*')
            .eq('application_id', data.id)
            .order('uploaded_at', { ascending: false })
            .then(({ data: docs }) => setDocuments((docs ?? []) as DocumentRow[]))
        }
        setLoading(false)
      })
  }, [profile])

  // Validate file — aware of image-only requirements
  const validateFile = (file: File, req: DocRequirement): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (req.imageOnly) {
      if (!IMAGE_ONLY_EXTENSIONS.includes(ext)) {
        return `${file.name}: Only PNG, JPG, or JPEG images are allowed for "${req.label}".`
      }
    } else {
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `${file.name}: Invalid type. Allowed: PDF, JPG, JPEG, PNG.`
      }
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return `${file.name}: Exceeds ${MAX_UPLOAD_MB} MB.`
    }
    return null
  }

  const uploadForType = async (req: DocRequirement, file: File) => {
    if (!application || !profile) return

    const err = validateFile(file, req)
    if (err) {
      setErrors([err])
      return
    }

    setUploadingType(req.key)
    setErrors([])
    setSuccess(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${profile.id}/${genUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: false })

      if (upErr) {
        setErrors([`${file.name}: ${upErr.message}`])
        return
      }

      // Determine if this is a re-upload (previous doc rejected)
      const previous = documents.find(
        (d) => d.document_type === req.key && d.status === 'rejected'
      )
      const isReupload = Boolean(previous)

      const { data, error } = await supabase
        .from('documents')
        .insert({
          application_id: application.id,
          document_type: req.key,
          filename: file.name,
          storage_path: path,
          status: 'pending',            // reset back to pending for review
          reviewed_by: null,
          reviewed_at: null,
          review_remarks: null,
        })
        .select()
        .single()

      if (error) {
        await supabase.storage.from('documents').remove([path])
        setErrors([`${file.name}: ${error.message}`])
        return
      }

      setDocuments((d) => [data as DocumentRow, ...d])
      setSuccess(
        isReupload
          ? `${prettyDocType(req.key)} re-uploaded. PDAO will review it shortly.`
          : `${prettyDocType(req.key)} uploaded.`
      )

      // If re-uploading after a rejection, reset the application back to Pending
      // so the admin sees it in their review queue again.
      if (isReupload && application.status !== 'Pending') {
        await supabase
          .from('applications')
          .update({ status: 'Pending', last_updated: new Date().toISOString() })
          .eq('id', application.id)
        setApplication({ ...application, status: 'Pending' as any })
      }

      await supabase.from('notifications').insert({
        user_id: profile.id,
        message: isReupload
          ? `Document "${prettyDocType(req.key)}" re-uploaded for review.`
          : `Document "${prettyDocType(req.key)}" uploaded.`,
        link: '/upload',
      })
    } catch (e: any) {
      setErrors([`${file.name}: ${e?.message ?? 'Unexpected error during upload.'}`])
    } finally {
      setUploadingType(null)
    }
  }

  const handleDownload = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60 * 5, { download: doc.filename })
    if (error || !data) {
      setErrors([`Could not download ${doc.filename}: ${error?.message ?? 'unknown error'}`])
      return
    }
    window.location.href = data.signedUrl
  }

  if (loading) {
    return (
      <AppLayout navItems={CLIENT_NAV}>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </AppLayout>
    )
  }

  // ─────────────────────────────────────────────────────────
  // Latest document per type (documents sorted by uploaded_at desc)
  // ─────────────────────────────────────────────────────────
  const latestByType = new Map<string, DocumentRow>()
  for (const d of documents) {
    if (!latestByType.has(d.document_type)) latestByType.set(d.document_type, d)
  }

  // Counts for progress bar — a rejected doc does NOT satisfy the requirement
  const requiredKeys = REQUIRED_DOCS.filter((r) => r.required).map((r) => r.key)
  const uploadedKeys = new Set(
    Array.from(latestByType.entries())
      .filter(([, d]) => d.status !== 'rejected')
      .map(([k]) => k)
  )
  const uploadedRequired = requiredKeys.filter((k) => uploadedKeys.has(k)).length
  const totalRequired = requiredKeys.length
  const allRequiredDone = uploadedRequired === totalRequired
  const pct = Math.round((uploadedRequired / totalRequired) * 100)

  // Docs rejected by admin — banner count
  const rejectedDocs = documents.filter((d) => d.status === 'rejected')

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Upload Documents</h3>
        <p className="text-muted mb-4">
          Attach the required documents for your PWD application. Max {MAX_UPLOAD_MB} MB each.
          PDF, JPG, JPEG, PNG — except the 1x1 Picture which accepts <strong>PNG/JPEG only</strong>.
        </p>

        {success && <Alert variant="success" message={success} />}
        {errors.map((e, i) => <Alert key={i} variant="danger" message={e} />)}

        {rejectedDocs.length > 0 && (
          <Alert
            variant="danger"
            message={
              rejectedDocs.length === 1
                ? `1 document was rejected by PDAO. Please re-upload a corrected copy below.`
                : `${rejectedDocs.length} documents were rejected by PDAO. Please re-upload corrected copies below.`
            }
          />
        )}

        {!application ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body empty-state">
              <i className="bi bi-file-earmark-text d-block mb-2" />
              <p className="mb-3">You need to submit your application form before uploading documents.</p>
              <Link to="/application" className="btn btn-primary">
                <i className="bi bi-file-earmark-plus me-1" /> Complete application form
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Progress card */}
            <div className="card mb-3 border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold">
                    <i className="bi bi-list-check text-primary-pdao me-1" />
                    Requirements progress
                  </span>
                  <span className={`badge ${allRequiredDone ? 'bg-success' : 'bg-warning text-dark'}`}>
                    {uploadedRequired} of {totalRequired} uploaded
                  </span>
                </div>
                <div className="progress" style={{ height: 8 }}>
                  <div
                    className={`progress-bar ${allRequiredDone ? 'bg-success' : 'bg-primary'}`}
                    role="progressbar"
                    style={{ width: `${pct}%` }}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                {allRequiredDone && (
                  <div className="small text-success mt-2">
                    <i className="bi bi-check-circle-fill me-1" />
                    All required documents uploaded. PDAO will review them shortly.
                  </div>
                )}
              </div>
            </div>

            {/* Requirements checklist */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header">
                <i className="bi bi-clipboard-check text-primary-pdao me-1" /> Required Documents
              </div>
              <div className="list-group list-group-flush">
                {REQUIRED_DOCS.map((req) => {
                  const latest = latestByType.get(req.key)
                  const isRejected = latest?.status === 'rejected'
                  const uploaded = uploadedKeys.has(req.key)
                  const isUploading = uploadingType === req.key
                  return (
                    <div key={req.key} className="list-group-item py-3">
                      <div className="d-flex flex-wrap align-items-start gap-3">
                        <div
                          className={`req-icon ${
                            uploaded ? 'ok' : isRejected ? 'rejected' : req.required ? 'missing' : 'optional'
                          }`}
                        >
                          {uploaded ? (
                            <i className="bi bi-check-lg" />
                          ) : isRejected ? (
                            <i className="bi bi-x-lg" />
                          ) : (
                            <i className={`bi ${req.forRepresentative ? 'bi-people' : 'bi-file-earmark-text'}`} />
                          )}
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-semibold">{req.label}</span>
                            {req.required ? (
                              <span className="badge bg-danger bg-opacity-10 text-danger">Required</span>
                            ) : (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary">Optional</span>
                            )}
                            {req.imageOnly && (
                              <span className="badge bg-info bg-opacity-10 text-info-emphasis">
                                <i className="bi bi-image me-1" /> Images only
                              </span>
                            )}
                            {isRejected && (
                              <span className="badge bg-danger">
                                <i className="bi bi-x-circle me-1" /> Rejected
                              </span>
                            )}
                          </div>
                          <div className="small text-muted">{req.description}</div>
                          {isRejected && latest?.review_remarks && (
                            <div className="small text-danger mt-1">
                              <i className="bi bi-exclamation-circle me-1" />
                              <strong>Reason:</strong> {latest.review_remarks}
                            </div>
                          )}
                        </div>
                        <div className="ms-auto">
                          {uploaded ? (
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle me-1" /> Uploaded
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={`btn btn-sm ${isRejected ? 'btn-warning' : 'btn-primary'}`}
                                disabled={isUploading}
                                onClick={() => fileInputs.current[req.key]?.click()}
                              >
                                {isUploading ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-1" /> Uploading…
                                  </>
                                ) : isRejected ? (
                                  <>
                                    <i className="bi bi-arrow-clockwise me-1" /> Re-upload
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-upload me-1" /> Upload
                                  </>
                                )}
                              </button>
                              <input
                                ref={(el) => { fileInputs.current[req.key] = el }}
                                type="file"
                                accept={acceptFor(req)}
                                hidden
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                  const f = e.target.files?.[0]
                                  if (f) uploadForType(req, f)
                                  e.target.value = ''
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Uploaded documents table */}
            <div className="card border-0 shadow-sm">
              <div className="card-header">
                <i className="bi bi-folder text-primary-pdao me-1" /> Uploaded documents
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Filename</th>
                      <th>Uploaded</th>
                      <th>Status</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length > 0 ? (
                      documents.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <span className="badge bg-primary bg-opacity-10 text-primary-pdao">
                              {prettyDocType(d.document_type)}
                            </span>
                          </td>
                          <td>
                            <i className="bi bi-file-earmark-text me-1" />
                            {d.filename}
                          </td>
                          <td className="text-muted small">{fmtDateTime(d.uploaded_at)}</td>
                          <td>
                            <span className={`badge ${docStatusBadge(d.status)}`}>
                              {DOC_STATUS_LABEL[d.status as DocumentStatus] ?? 'Pending review'}
                            </span>
                            {d.status === 'rejected' && d.review_remarks && (
                              <div className="small text-danger mt-1">
                                <i className="bi bi-info-circle me-1" />
                                {d.review_remarks}
                              </div>
                            )}
                          </td>
                          <td className="text-end">
                            <button className="btn btn-sm btn-soft me-1" onClick={() => handleDownload(d)}>
                              <i className="bi bi-download" />
                            </button>
                            {d.status === 'rejected' && (
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => fileInputs.current[d.document_type]?.click()}
                                title="Upload a replacement"
                              >
                                <i className="bi bi-arrow-clockwise me-1" /> Re-upload
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">
                          No documents uploaded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .req-icon {
          width: 40px; height: 40px; border-radius: 50%;
          display: grid; place-items: center;
          font-size: 1.15rem; flex-shrink: 0;
        }
        .req-icon.ok { background: rgba(25,135,84,.12); color: #198754; }
        .req-icon.missing { background: rgba(220,53,69,.1); color: #dc3545; }
        .req-icon.optional { background: rgba(108,117,125,.12); color: #6c757d; }
        .req-icon.rejected { background: rgba(255,193,7,.18); color: #b8860b; }
      `}</style>
    </AppLayout>
  )
}