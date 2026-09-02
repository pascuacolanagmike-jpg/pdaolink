import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { statusColor, fmtDateTime, fmtDate, prettyDocType, type Application, type StatusLog, type DocumentRow } from '../../lib/types'
import { exportApplicationFormPDF } from '../../lib/formExport'

export default function StatusPage() {
  const { profile } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [logs, setLogs] = useState<StatusLog[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('applications')
      .select('*')
      .eq('user_id', profile.id)
      .order('submission_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        const app = data as Application | null
        setApplication(app)
        if (app) {
          const [l, d] = await Promise.all([
            supabase.from('status_logs').select('*').eq('application_id', app.id).order('created_at', { ascending: false }),
            supabase.from('documents').select('*').eq('application_id', app.id).order('uploaded_at', { ascending: false }),
          ])
          setLogs((l.data ?? []) as StatusLog[])
          setDocuments((d.data ?? []) as DocumentRow[])
        }
        setLoading(false)
      })
  }, [profile])

  // Realtime: subscribe to application status changes and new status logs
  useEffect(() => {
    if (!application) return

    const appChannel = supabase
      .channel(`status-app-${application.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'applications', filter: `id=eq.${application.id}` },
        (payload: any) => {
          const updated = payload.new as Application
          setApplication(updated)
          setPulse(true)
          setTimeout(() => setPulse(false), 2000)
        }
      )
      .subscribe()

    const logChannel = supabase
      .channel(`status-logs-${application.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'status_logs', filter: `application_id=eq.${application.id}` },
        (payload: any) => {
          setLogs((prev) => [payload.new as StatusLog, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(appChannel)
      supabase.removeChannel(logChannel)
    }
  }, [application?.id])

  const handleDownload = async (doc: DocumentRow) => {
    const { data } = await supabase.storage.from('documents').download(doc.storage_path)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <AppLayout navItems={CLIENT_NAV}><div className="text-center py-5"><div className="spinner-border text-primary" /></div></AppLayout>
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Application Status</h3>
        <p className="text-muted mb-4">Track the progress of your PWD application.</p>

        {application ? (
          <>
            <div className="card mb-3 border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div>
                    <div className="text-muted small">Application ID</div>
                    <h4 className="mb-1">#{application.id.slice(0, 8)}</h4>
                    <span className={`badge status-badge ${statusColor(application.status)} ${pulse ? 'status-pulse' : ''}`}>{application.status}</span>
                  </div>
                  <div className="text-end">
                    <div className="text-muted small">Submitted</div>
                    <div className="fw-bold">{fmtDateTime(application.submission_date)}</div>
                    <div className="text-muted small mt-1">Last updated</div>
                    <div>{fmtDateTime(application.last_updated)}</div>
                    <button className="btn btn-sm btn-soft mt-2" onClick={() => exportApplicationFormPDF(application)}>
                      <i className="bi bi-file-pdf me-1" /> Export Form to PDF
                    </button>
                  </div>
                </div>
                {application.remarks && (
                  <div className="alert alert-info mt-3 mb-0"><i className="bi bi-chat-left-text me-1" />{application.remarks}</div>
                )}
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-7">
                <div className="card h-100 border-0 shadow-sm">
                  <div className="card-header"><i className="bi bi-clock-history text-primary-pdao me-1" /> Status timeline</div>
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
                            {log.changed_by && <div className="text-muted small">by {log.changed_by}</div>}
                          </li>
                        ))}
                      </ul>
                    ) : <div className="text-muted small">No status changes recorded.</div>}
                  </div>
                </div>
              </div>
              <div className="col-md-5">
                <div className="card h-100 border-0 shadow-sm">
                  <div className="card-header"><i className="bi bi-folder text-primary-pdao me-1" /> Documents</div>
                  <div className="card-body">
                    {documents.length > 0 ? (
                      <ul className="list-unstyled mb-0">
                        {documents.map((d) => (
                          <li className="mb-2 d-flex justify-content-between align-items-center" key={d.id}>
                            <span><i className="bi bi-file-earmark-text me-1" />{prettyDocType(d.document_type)}</span>
                            <button className="btn btn-sm btn-soft" onClick={() => handleDownload(d)}><i className="bi bi-download" /></button>
                          </li>
                        ))}
                      </ul>
                    ) : <div className="text-muted small">No documents uploaded.</div>}
                    <Link to="/upload" className="btn btn-soft w-100 mt-3"><i className="bi bi-cloud-upload me-1" /> Upload more documents</Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="card-body empty-state">
              <i className="bi bi-file-earmark-text d-block mb-2" />
              <p className="mb-3">You haven't submitted an application yet.</p>
              <Link to="/application" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-1" /> Start your application</Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
