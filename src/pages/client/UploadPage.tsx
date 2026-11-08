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
// Strict validation constants
// ─────────────────────────────────────────────────────────
/** Extensions allowed for image-only uploads */
const IMAGE_ONLY_EXTENSIONS = ['png', 'jpg', 'jpeg'] as const

/** MIME types we accept as "genuine images" */
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const

/** MIME types we accept for mixed docs (PDF allowed) */
const MIXED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const

/** A 1×1 photo should be printable — require at least 200×200 px (≈200 DPI @ 1"). */
const MIN_SQUARE_DIMENSION = 200

/** Reject absurdly large decoded images (decompression-bomb guard). */
const MAX_IMAGE_DIMENSION = 6000

/** Abort reading dimensions if the browser hasn't decoded the image in time. */
const IMAGE_DECODE_TIMEOUT_MS = 15_000

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
  /** When true, the image must be a perfect square (width === height), e.g. 1x1 picture */
  requireSquare?: boolean
}

const REQUIRED_DOCS: DocRequirement[] = [
  {
    key: 'picture_1x1',
    label: '1x1 Picture (2 pcs)',
    description:
      `Must be a perfect square (1:1) PNG or JPEG, at least ${MIN_SQUARE_DIMENSION}×${MIN_SQUARE_DIMENSION}px. ` +
      'With name and signature or thumb mark at the back.',
    required: true,
    imageOnly: true,
    requireSquare: true,
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

// ─────────────────────────────────────────────────────────
// Content sniffing — reject renamed .txt/.html files that
// merely *claim* to be images via their extension
// ─────────────────────────────────────────────────────────
type SniffedType = 'png' | 'jpeg' | null

async function sniffImageType(file: File): Promise<SniffedType> {
  try {
    const buf = await file.slice(0, 12).arrayBuffer()
    const b = new Uint8Array(buf)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
    ) {
      return 'png'
    }
    // JPEG SOI: FF D8 FF
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      return 'jpeg'
    }
    return null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────
// Read natural pixel dimensions of an image, with timeout
// ─────────────────────────────────────────────────────────
function getImageDimensions(
  file: File,
  timeoutMs = IMAGE_DECODE_TIMEOUT_MS,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    let settled = false

    const cleanup = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
    }

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out while reading the image (file may be corrupt).'))
    }, timeoutMs)

    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      cleanup()
      resolve({ width, height })
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('The image could not be decoded.'))
    }

    img.src = url
  })
}

// ─────────────────────────────────────────────────────────
// Extract lowercase extension from a filename (basename only)
// ─────────────────────────────────────────────────────────
function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  if (dot < 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────
export default function UploadPage() {
  const { profile } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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
        if (!mountedRef.current) return
        setApplication(data as Application | null)
        if (data) {
          supabase
            .from('documents')
            .select('*')
            .eq('application_id', data.id)
            .order('uploaded_at', { ascending: false })
            .then(({ data: docs }) => {
              if (!mountedRef.current) return
              setDocuments((docs ?? []) as DocumentRow[])
            })
        }
        setLoading(false)
      })
  }, [profile])

  // ─────────────────────────────────────────────────────────
  // Strict validation
  // ─────────────────────────────────────────────────────────
  const validateFile = async (file: File, req: DocRequirement): Promise<string | null> => {
    // 1. File sanity
    if (!file || file.size === 0) {
      return 'The selected file is empty or unreadable.'
    }
    const ext = fileExtension(file.name)
    if (!ext) {
      return `${file.name}: File has no extension.`
    }

    // 2. Extension allow-list
    if (req.imageOnly) {
      if (!(IMAGE_ONLY_EXTENSIONS as readonly string[]).includes(ext)) {
        return `${file.name}: Only PNG, JPG, or JPEG images are allowed for "${req.label}".`
      }
    } else {
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `${file.name}: Invalid type. Allowed: PDF, JPG, JPEG, PNG.`
      }
    }

    // 3. Size limit
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return `${file.name}: Exceeds ${MAX_UPLOAD_MB} MB.`
    }

    // 4. Declared MIME type must be in the allow-list (when the browser reports one)
    if (file.type) {
      const allowed = req.imageOnly ? IMAGE_MIME_TYPES : MIXED_MIME_TYPES
      if (!(allowed as readonly string[]).includes(file.type)) {
        return `${file.name}: File type "${file.type}" is not allowed here.`
      }
    }

    // 5. Content sniffing — extension & MIME must match real bytes
    if (req.imageOnly) {
      const sniffed = await sniffImageType(file)
      if (!sniffed) {
        return `${file.name}: The file content is not a valid PNG or JPEG image.`
      }
      if (ext === 'png' && sniffed !== 'png') {
        return `${file.name}: Extension is .png but the file content is ${sniffed.toUpperCase()}.`
      }
      if ((ext === 'jpg' || ext === 'jpeg') && sniffed !== 'jpeg') {
        return `${file.name}: Extension is .${ext} but the file content is ${sniffed.toUpperCase()}.`
      }
    }

    // 6. Strict 1:1 square requirement (e.g., 1x1 Picture)
    if (req.requireSquare) {
      let dims: { width: number; height: number }
      try {
        dims = await getImageDimensions(file)
      } catch (e: any) {
        return `${file.name}: ${e?.message ?? 'Could not read the image.'}`
      }
      const { width, height } = dims

      // Strict: exact square. No tolerance.
      if (width !== height) {
        return (
          `${file.name}: "${req.label}" must be a perfect square (1:1). ` +
          `Yours is ${width}×${height}px — please crop it to equal width and height.`
        )
      }
      if (width < MIN_SQUARE_DIMENSION) {
        return (
          `${file.name}: "${req.label}" is too small (${width}×${height}px). ` +
          `Minimum is ${MIN_SQUARE_DIMENSION}×${MIN_SQUARE_DIMENSION}px.`
        )
      }
      if (width > MAX_IMAGE_DIMENSION) {
        return (
          `${file.name}: "${req.label}" is too large (${width}×${height}px). ` +
          `Maximum is ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}px.`
        )
      }
    }

    return null
  }

  // ─────────────────────────────────────────────────────────
  // Upload
  // ─────────────────────────────────────────────────────────
  const uploadForType = async (req: DocRequirement, file: File) => {
    if (!application || !profile) return
    // Strict: never start a second upload while one is running
    if (uploadingType !== null) return

    setErrors([])
    setSuccess(null)
    setUploadingType(req.key)

    try {
      const err = await validateFile(file, req)
      if (err) {
        if (mountedRef.current) setErrors([err])
        return
      }

      const ext = fileExtension(file.name) || 'bin'
      const path = `${profile.id}/${genUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: false })

      if (upErr) {
        if (mountedRef.current) setErrors([`${file.name}: ${upErr.message}`])
        return
      }

      // Determine if this is a re-upload (previous doc rejected)
      const previous = documents.find(
        (d) => d.document_type === req.key && d.status === 'rejected',
      )
      const isReupload = Boolean(previous)

      const { data, error } = await supabase
        .from('documents')
        .insert({
          application_id: application.id,
          document_type: req.key,
          filename: file.name,
          storage_path: path,
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          review_remarks: null,
        })
        .select()
        .single()

      if (error) {
        await supabase.storage.from('documents').remove([path])
        if (mountedRef.current) setErrors([`${file.name}: ${error.message}`])
        return
      }

      if (mountedRef.current) {
        setDocuments((d) => [data as DocumentRow, ...d])
        setSuccess(
          isReupload
            ? `${prettyDocType(req.key)} re-uploaded. PDAO will review it shortly.`
            : `${prettyDocType(req.key)} uploaded.`,
        )
      }

      // If re-uploading after a rejection, reset the application back to Pending
      if (isReupload && application.status !== 'Pending') {
        await supabase
          .from('applications')
          .update({ status: 'Pending', last_updated: new Date().toISOString() })
          .eq('id', application.id)
        if (mountedRef.current) {
          setApplication({ ...application, status: 'Pending' as any })
        }
      }

      await supabase.from('notifications').insert({
        user_id: profile.id,
        message: isReupload
          ? `Document "${prettyDocType(req.key)}" re-uploaded for review.`
          : `Document "${prettyDocType(req.key)}" uploaded.`,
        link: '/upload',
      })
    } catch (e: any) {
      if (mountedRef.current) {
        setErrors([`${file.name}: ${e?.message ?? 'Unexpected error during upload.'}`])
      }
    } finally {
      if (mountedRef.current) setUploadingType(null)
    }
  }

  const handleDownload = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60 * 5, { download: doc.filename })
    if (error || !data) {
      if (mountedRef.current) {
        setErrors([`Could not download ${doc.filename}: ${error?.message ?? 'unknown error'}`])
      }
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

  // Latest document per type (documents sorted by uploaded_at desc)
  const latestByType = new Map<string, DocumentRow>()
  for (const d of documents) {
    if (!latestByType.has(d.document_type)) latestByType.set(d.document_type, d)
  }

  const requiredKeys = REQUIRED_DOCS.filter((r) => r.required).map((r) => r.key)
  const uploadedKeys = new Set(
    Array.from(latestByType.entries())
      .filter(([, d]) => d.status !== 'rejected')
      .map(([k]) => k),
  )
  const uploadedRequired = requiredKeys.filter((k) => uploadedKeys.has(k)).length
  const totalRequired = requiredKeys.length
  const allRequiredDone = uploadedRequired === totalRequired
  const pct = Math.round((uploadedRequired / totalRequired) * 100)

  const rejectedDocs = documents.filter((d) => d.status === 'rejected')
  const isAnyUploading = uploadingType !== null

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Upload Documents</h3>
        <p className="text-muted mb-4">
          Attach the required documents for your PWD application. Max {MAX_UPLOAD_MB} MB each.
          PDF, JPG, JPEG, PNG — except the 1x1 Picture which accepts <strong>PNG/JPEG only</strong> and{' '}
          <strong>must be a perfect square (1:1) image</strong> at least{' '}
          {MIN_SQUARE_DIMENSION}×{MIN_SQUARE_DIMENSION}px.
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
              <p className="mb-3">
                You need to submit your application form before uploading documents.
              </p>
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
                            uploaded
                              ? 'ok'
                              : isRejected
                              ? 'rejected'
                              : req.required
                              ? 'missing'
                              : 'optional'
                          }`}
                        >
                          {uploaded ? (
                            <i className="bi bi-check-lg" />
                          ) : isRejected ? (
                            <i className="bi bi-x-lg" />
                          ) : (
                            <i
                              className={`bi ${
                                req.forRepresentative
                                  ? 'bi-people'
                                  : 'bi-file-earmark-text'
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-semibold">{req.label}</span>
                            {req.required ? (
                              <span className="badge bg-danger bg-opacity-10 text-danger">
                                Required
                              </span>
                            ) : (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary">
                                Optional
                              </span>
                            )}
                            {req.imageOnly && (
                              <span className="badge bg-info bg-opacity-10 text-info-emphasis">
                                <i className="bi bi-image me-1" /> Images only
                              </span>
                            )}
                            {req.requireSquare && (
                              <span className="badge bg-info bg-opacity-10 text-info-emphasis">
                                <i className="bi bi-aspect-ratio me-1" /> 1:1 square only
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
                                disabled={isAnyUploading}
                                onClick={() => fileInputs.current[req.key]?.click()}
                              >
                                {isUploading ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-1" />{' '}
                                    Uploading…
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
                                ref={(el) => {
                                  fileInputs.current[req.key] = el
                                }}
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
                              {DOC_STATUS_LABEL[d.status as DocumentStatus] ??
                                'Pending review'}
                            </span>
                            {d.status === 'rejected' && d.review_remarks && (
                              <div className="small text-danger mt-1">
                                <i className="bi bi-info-circle me-1" />
                                {d.review_remarks}
                              </div>
                            )}
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-soft me-1"
                              onClick={() => handleDownload(d)}
                            >
                              <i className="bi bi-download" />
                            </button>
                            {d.status === 'rejected' && (
                              <button
                                className="btn btn-sm btn-warning"
                                disabled={isAnyUploading}
                                onClick={() =>
                                  fileInputs.current[d.document_type]?.click()
                                }
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