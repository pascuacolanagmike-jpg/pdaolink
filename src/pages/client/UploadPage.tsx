import { useState, useEffect, useRef, ChangeEvent, DragEvent } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  DOCUMENT_TYPES, MAX_UPLOAD_MB, ALLOWED_EXTENSIONS, prettyDocType,
  type Application, type DocumentRow, fmtDateTime,
} from '../../lib/types'
import Alert from '../../components/Alert'

export default function UploadPage() {
  const { profile } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPES[0])
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

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

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) return `${file.name}: Invalid type. Allowed: PDF, JPG, JPEG, PNG.`
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `${file.name}: Exceeds ${MAX_UPLOAD_MB} MB.`
    return null
  }

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return
    const valid: File[] = []
    const errs: string[] = []
    Array.from(selected).forEach((f) => {
      const err = validateFile(f)
      if (err) errs.push(err)
      else valid.push(f)
    })
    setErrors(errs)
    setFiles(valid)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleUpload = async () => {
    if (!application || !profile || files.length === 0) return
    setErrors([])
    setSuccess(null)
    setUploading(true)
    const newDocs: DocumentRow[] = []
    const errs: string[] = []

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
      if (upErr) {
        errs.push(`${file.name}: ${upErr.message}`)
        continue
      }
      const { data, error } = await supabase
        .from('documents')
        .insert({
          application_id: application.id,
          document_type: docType,
          filename: file.name,
          storage_path: path,
        })
        .select()
        .single()
      if (error) {
        errs.push(`${file.name}: ${error.message}`)
      } else {
        newDocs.push(data as DocumentRow)
      }
    }

    if (newDocs.length > 0) {
      await supabase.from('notifications').insert({
        user_id: profile.id,
        message: `${newDocs.length} document(s) uploaded to your application.`,
        link: '/upload',
      })
      setDocuments((d) => [...newDocs, ...d])
      setSuccess(`${newDocs.length} file(s) uploaded.`)
      setFiles([])
    }
    setErrors(errs)
    setUploading(false)
  }

  const handleDownload = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage.from('documents').download(doc.storage_path)
    if (error || !data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <AppLayout navItems={CLIENT_NAV}>
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Upload Documents</h3>
        <p className="text-muted mb-4">Attach the required documents for your PWD application. Max {MAX_UPLOAD_MB} MB each. PDF, JPG, JPEG, PNG.</p>

        {success && <Alert variant="success" message={success} />}
        {errors.map((e, i) => <Alert key={i} variant="danger" message={e} />)}

        {!application ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body empty-state">
              <i className="bi bi-file-earmark-text d-block mb-2" />
              <p className="mb-3">You need to submit your application form before uploading documents.</p>
              <Link to="/application" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-1" /> Complete application form</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="card mb-3 border-0 shadow-sm">
              <div className="card-body">
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label">Document type</label>
                    <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                      {DOCUMENT_TYPES.map((d) => <option key={d} value={d}>{prettyDocType(d)}</option>)}
                    </select>
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">File</label>
                    <div
                      className={`dropzone ${dragging ? 'drag' : ''}`}
                      onClick={() => fileInput.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                    >
                      <i className="bi bi-cloud-arrow-up d-block" />
                      <div className="text-muted small">
                        {files.length > 0 ? files.map((f) => f.name).join(', ') : 'Choose file or drag it here'}
                      </div>
                      <input
                        ref={fileInput}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        hidden
                        multiple
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || files.length === 0}>
                    {uploading ? <><span className="spinner-border spinner-border-sm me-1" /> Uploading…</> : <><i className="bi bi-upload me-1" /> Upload</>}
                  </button>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header"><i className="bi bi-folder text-primary-pdao me-1" /> Uploaded documents</div>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead><tr><th>Type</th><th>Filename</th><th>Uploaded</th><th className="text-end">Action</th></tr></thead>
                  <tbody>
                    {documents.length > 0 ? documents.map((d) => (
                      <tr key={d.id}>
                        <td><span className="badge bg-primary bg-opacity-10 text-primary-pdao">{prettyDocType(d.document_type)}</span></td>
                        <td><i className="bi bi-file-earmark-text me-1" />{d.filename}</td>
                        <td className="text-muted small">{fmtDateTime(d.uploaded_at)}</td>
                        <td className="text-end"><button className="btn btn-sm btn-soft" onClick={() => handleDownload(d)}><i className="bi bi-download" /></button></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="text-center text-muted py-4">No documents uploaded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
