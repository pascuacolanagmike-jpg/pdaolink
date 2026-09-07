import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { type Application, type DocumentRow, fmtDate, prettyDocType } from '../../lib/types'
import EidCard from '../../components/EidCard'

export default function EidPage() {
  const { profile } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [photoDoc, setPhotoDoc] = useState<DocumentRow | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', profile.id)
        .order('submission_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      const app = data as Application | null
      setApplication(app)
      if (app) {
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('application_id', app.id)
          .order('uploaded_at', { ascending: false })
        const allDocs = (docs ?? []) as DocumentRow[]
        const photo = allDocs.find((d) => d.document_type === 'passport_photo') ?? allDocs[0] ?? null
        setPhotoDoc(photo)
        if (photo) {
          const { data: blob } = await supabase.storage.from('documents').download(photo.storage_path)
          if (blob) setPhotoUrl(URL.createObjectURL(blob))
        }
      }
      setLoading(false)
    })()
  }, [profile])

  useEffect(() => {
    if (!application) return
    const channel = supabase
      .channel(`eid-${application.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications', filter: `id=eq.${application.id}` },
        (payload: any) => setApplication(payload.new as Application))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [application?.id])

  const handlePrint = () => window.print()

  if (loading) {
    return <AppLayout navItems={CLIENT_NAV}><div className="text-center py-5"><div className="spinner-border text-primary" /></div></AppLayout>
  }

  const isApproved = application && (application.status === 'Approved' || application.status === 'Ready for Pickup')

  if (!application) {
    return (
      <AppLayout navItems={CLIENT_NAV}>
        <div className="fade-in-up">
          <h3 className="mb-1">E-ID</h3>
          <p className="text-muted mb-4">Your digital PWD ID card.</p>
          <div className="card border-0 shadow-sm">
            <div className="card-body empty-state">
              <i className="bi bi-card-text d-block mb-2" />
              <p className="mb-3">You need to submit an application before you can access your E-ID.</p>
              <Link to="/application" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-1" /> Start your application</Link>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!isApproved) {
    return (
      <AppLayout navItems={CLIENT_NAV}>
        <div className="fade-in-up">
          <h3 className="mb-1">E-ID</h3>
          <p className="text-muted mb-4">Your digital PWD ID card.</p>
          <div className="card border-0 shadow-sm">
            <div className="card-body empty-state">
              <i className="bi bi-lock d-block mb-2" />
              <p className="mb-1">Your E-ID will be available once your application is approved.</p>
              <p className="text-muted small mb-3">Current status: <span className="fw-bold">{application.status}</span></p>
              <Link to="/status" className="btn btn-soft"><i className="bi bi-list-status me-1" /> View application status</Link>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2 no-print">
          <div>
            <h3 className="mb-1">E-ID</h3>
            <p className="text-muted mb-0">Your digital PWD ID card. Click the card to flip it.</p>  
          </div>
          <button className="btn btn-primary" onClick={handlePrint}><i className="bi bi-printer me-1" /> Print E-ID</button>
        </div>

        <div className="eid-page-wrapper">
          <EidCard
            application={application}
            photoUrl={photoUrl}
            flipped={flipped}
            onFlip={() => setFlipped(!flipped)}
          />

          <p className="text-center text-muted small mt-3 no-print">
            <i className="bi bi-hand-index me-1" /> Tap the card to flip between front and back
          </p>

          {photoDoc && (
            <div className="text-center no-print mt-2">
              <p className="text-muted small">Photo source: {prettyDocType(photoDoc.document_type)}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
