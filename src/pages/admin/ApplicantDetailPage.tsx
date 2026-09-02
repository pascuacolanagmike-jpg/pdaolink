import { useEffect, useState, FormEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { statusColor, fmtDate, fmtDateTime, prettyDocType, ALL_STATUSES, type Application, type StatusLog, type DocumentRow } from '../../lib/types'
import { exportApplicationFormPDF } from '../../lib/formExport'
import Alert from '../../components/Alert'

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [app, setApp] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [logs, setLogs] = useState<StatusLog[]>([])
  const [loading, setLoading] = useState(true)
  const [newStatus, setNewStatus] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: a } = await supabase.from('applications').select('*').eq('id', id).maybeSingle()
      const appData = a as Application | null
      setApp(appData)
      setNewStatus(appData?.status ?? 'Pending')
      setRemarks(appData?.remarks ?? '')
      if (appData) {
        const [d, l] = await Promise.all([
          supabase.from('documents').select('*').eq('application_id', appData.id).order('uploaded_at', { ascending: false }),
          supabase.from('status_logs').select('*').eq('application_id', appData.id).order('created_at', { ascending: false }),
        ])
        setDocuments((d.data ?? []) as DocumentRow[])
        setLogs((l.data ?? []) as StatusLog[])
      }
      setLoading(false)
    })()
  }, [id])

  const updateStatus = async (e?: FormEvent, status?: string) => {
    e?.preventDefault()
    if (!app || !profile) return
    const target = status ?? newStatus
    if (!ALL_STATUSES.includes(target as any)) return
    setSaving(true)
    setError(null)
    const old = app.status
    const { error: uErr } = await supabase
      .from('applications')
      .update({ status: target, remarks, last_updated: new Date().toISOString() })
      .eq('id', app.id)
    if (uErr) { setError(uErr.message); setSaving(false); return }

    await supabase.from('status_logs').insert({
      application_id: app.id, old_status: old, new_status: target,
      remarks, changed_by: profile.fullname,
    })

    const msgMap: Record<string, string> = {
      'Under Review': 'Your application is now under review.',
      'Needs Revision': 'Your application needs revision. Please see remarks.',
      'Approved': 'Congratulations! Your application has been approved.',
      'Rejected': 'Your application has been rejected. See remarks for details.',
      'Ready for Pickup': 'Your PWD ID is ready for pickup at the PDAO office.',
      'Pending': 'Your application status was reset to Pending.',
    }
    await supabase.from('notifications').insert({
      user_id: app.user_id,
      message: msgMap[target] ?? `Application status updated to ${target}.`,
      link: '/status',
    })

    setApp({ ...app, status: target as any, remarks })
    setSaving(false)
    // refresh logs
    const { data: newLogs } = await supabase.from('status_logs').select('*').eq('application_id', app.id).order('created_at', { ascending: false })
    setLogs((newLogs ?? []) as StatusLog[])
  }

  const viewDocument = (doc: DocumentRow) => {
    const url = supabase.storage.from('documents').getPublicUrl(doc.storage_path).data.publicUrl
    window.open(url, '_blank')
  }

  if (loading) {
    return <AppLayout navItems={ADMIN_NAV}><div className="text-center py-5"><div className="spinner-border text-primary" /></div></AppLayout>
  }
  if (!app) {
    return <AppLayout navItems={ADMIN_NAV}><Alert variant="danger" message="Application not found." /></AppLayout>
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <Link to="/admin/applicants" className="small text-muted"><i className="bi bi-arrow-left" /> Back to applicants</Link>
            <h3 className="mt-1 mb-0">Applicant #{app.id.slice(0, 8)}</h3>
            <span className={`badge status-badge ${statusColor(app.status)}`}>{app.status}</span>
          </div>
          <button className="btn btn-primary" onClick={() => exportApplicationFormPDF(app)}>
            <i className="bi bi-file-pdf me-1" /> Export Form to PDF
          </button>
        </div>

        {error && <Alert variant="danger" message={error} />}

        <div className="row g-3">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header"><i className="bi bi-person-vcard text-primary-pdao me-1" /> Personal information</div>
              <div className="card-body">
                <div className="row g-3">
                  <Field md={6} label="Full name" value={`${app.first_name ?? ''} ${app.middle_name ?? ''} ${app.last_name ?? ''} ${app.suffix ?? ''}`.trim()} />
                  <Field md={3} label="Birth date" value={fmtDate(app.birth_date)} />
                  <Field md={3} label="Gender" value={app.gender} />
                  <Field md={3} label="Civil status" value={app.civil_status} />
                  <Field md={3} label="Contact" value={app.contact_number} />
                  <Field md={6} label="Email" value={app.email} />
                  <Field md={12} label="Address" value={app.address} />
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header"><i className="bi bi-heart-pulse text-primary-pdao me-1" /> PWD information</div>
              <div className="card-body">
                <div className="row g-3">
                  <Field md={4} label="Disability type" value={app.disability_type} />
                  <Field md={4} label="Cause" value={app.disability_cause} />
                  <Field md={2} label="Blood type" value={app.blood_type} />
                  <Field md={2} label="Education" value={app.education} />
                  <Field md={4} label="Occupation" value={app.occupation} />
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header"><i className="bi bi-telephone-plus text-primary-pdao me-1" /> Emergency & representative</div>
              <div className="card-body">
                <div className="row g-3">
                  <Field md={4} label="Emergency contact" value={app.emergency_name} />
                  <Field md={3} label="Relationship" value={app.emergency_relationship} />
                  <Field md={3} label="Contact no." value={app.emergency_contact_number} />
                  <Field md={2} label="Representative" value={app.representative_name} />
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header"><i className="bi bi-folder text-primary-pdao me-1" /> Documents</div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead><tr><th>Type</th><th>Filename</th><th>Uploaded</th><th className="text-end">View</th></tr></thead>
                  <tbody>
                    {documents.length > 0 ? documents.map((d) => (
                      <tr key={d.id}>
                        <td><span className="badge bg-primary bg-opacity-10 text-primary-pdao">{prettyDocType(d.document_type)}</span></td>
                        <td><i className="bi bi-file-earmark-text me-1" />{d.filename}</td>
                        <td className="text-muted small">{fmtDateTime(d.uploaded_at)}</td>
                        <td className="text-end"><button className="btn btn-sm btn-soft" onClick={() => viewDocument(d)}><i className="bi bi-eye" /></button></td>
                      </tr>
                    )) : <tr><td colSpan={4} className="text-center text-muted py-4">No documents uploaded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header"><i className="bi bi-clock-history text-primary-pdao me-1" /> Status history</div>
              <div className="card-body">
                {logs.length > 0 ? (
                  <ul className="timeline">
                    {logs.map((log) => (
                      <li className="timeline-item" key={log.id}>
                        <div className="d-flex justify-content-between">
                          <span className={`badge status-badge ${statusColor(log.new_status)}`}>{log.new_status}</span>
                          <span className="text-muted small">{fmtDateTime(log.created_at)}</span>
                        </div>
                        {log.remarks && <div className="text-muted small mt-1">{log.remarks}</div>}
                        <div className="text-muted small">by {log.changed_by}</div>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-muted small">No history.</div>}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card border-0 shadow-sm position-sticky" style={{ top: 80 }}>
              <div className="card-header"><i className="bi bi-pencil-square text-primary-pdao me-1" /> Update status</div>
              <div className="card-body">
                <form onSubmit={(e) => updateStatus(e)}>
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Remarks</label>
                    <textarea className="form-control" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes for the applicant (optional)" />
                  </div>
                  <button type="submit" className="btn btn-primary w-100" disabled={saving}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Saving…</> : <><i className="bi bi-save me-1" /> Update status</>}
                  </button>
                </form>
                <hr />
                <div className="d-grid gap-2">
                  <button className="btn btn-success" onClick={() => updateStatus(undefined, 'Approved')} disabled={saving}><i className="bi bi-check-circle me-1" /> Approve</button>
                  <button className="btn btn-danger" onClick={() => updateStatus(undefined, 'Rejected')} disabled={saving}><i className="bi bi-x-circle me-1" /> Reject</button>
                  <button className="btn btn-warning" onClick={() => updateStatus(undefined, 'Needs Revision')} disabled={saving}><i className="bi bi-exclamation-triangle me-1" /> Request revision</button>
                  <button className="btn btn-primary" onClick={() => updateStatus(undefined, 'Ready for Pickup')} disabled={saving}><i className="bi bi-bag-check me-1" /> Mark ready for pickup</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Field({ md, label, value }: { md: number; label: string; value: string | null | undefined }) {
  return (
    <div className={`col-md-${md}`}>
      <label className="form-label">{label}</label>
      <div className="form-control bg-light">{value || '—'}</div>
    </div>
  )
}
