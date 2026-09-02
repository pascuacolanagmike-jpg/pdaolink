import { useEffect, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { fmtDateTime, type Announcement } from '../../lib/types'

export default function ClientAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([])

  useEffect(() => {
    const load = () => {
      supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .then(({ data }) => setItems((data ?? []) as Announcement[]))
    }
    load()

    const channel = supabase
      .channel('client-announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload: any) => {
        setItems((prev) => {
          const newItem = payload.new as Announcement
          const without = prev.filter((a) => a.id !== newItem.id)
          const pinned = without.filter((a) => a.is_pinned)
          const rest = without.filter((a) => !a.is_pinned)
          return newItem.is_pinned ? [newItem, ...pinned, ...rest] : [...pinned, newItem, ...rest]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' }, (payload: any) => {
        setItems((prev) => {
          const updated = payload.new as Announcement
          const without = prev.filter((a) => a.id !== updated.id)
          const pinned = without.filter((a) => a.is_pinned)
          const rest = without.filter((a) => !a.is_pinned)
          return updated.is_pinned ? [updated, ...pinned, ...rest] : [...pinned, updated, ...rest]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (payload: any) => {
        setItems((prev) => prev.filter((a) => a.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const getImageUrl = (path: string | null): string | null => {
    if (!path) return null
    return supabase.storage.from('announcements').getPublicUrl(path).data.publicUrl
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Announcements</h3>
        <p className="text-muted mb-4">Latest notices from the PDAO office.</p>
        {items.length > 0 ? (
          <div className="row g-3">
            {items.map((a) => {
              const imgUrl = getImageUrl(a.image_path)
              return (
                <div className="col-12" key={a.id}>
                  <div className="card border-0 shadow-sm announcement-card">
                    {imgUrl && (
                      <img src={imgUrl} alt={a.title} className="card-img-top rounded-top" style={{ maxHeight: 360, objectFit: 'cover' }} />
                    )}
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <h5 className="mb-0">{a.title}</h5>
                        {a.is_pinned && <span className="pin-badge"><i className="bi bi-pin-angle-fill" /> Pinned</span>}
                      </div>
                      <p className="text-muted mb-2" style={{ whiteSpace: 'pre-wrap' }}>{a.content}</p>
                      <div className="text-muted small">
                        <i className="bi bi-calendar3 me-1" />{fmtDateTime(a.created_at)}
                        {a.expires_at && <span className="ms-2"><i className="bi bi-clock me-1" />Expires {fmtDateTime(a.expires_at)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card border-0 shadow-sm"><div className="card-body empty-state"><i className="bi bi-megaphone d-block mb-2" /><p className="mb-0">No announcements available right now.</p></div></div>
        )}
      </div>
    </AppLayout>
  )
}
