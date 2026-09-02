import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fmtDateTime, type Notification } from '../../lib/types'

export default function NotificationsPage() {
  const { profile, refreshNotifications } = useAuth()
  const [items, setItems] = useState<Notification[]>([])

  const load = useCallback(() => {
    if (!profile) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Notification[]))
  }, [profile])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    load()
    refreshNotifications()
  }

  const markAllRead = async () => {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
    load()
    refreshNotifications()
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div><h3 className="mb-1">Notifications</h3><p className="text-muted mb-0">Updates about your application and announcements.</p></div>
          {items.length > 0 && <button className="btn btn-soft" onClick={markAllRead}><i className="bi bi-check2-all me-1" /> Mark all read</button>}
        </div>
        {items.length > 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="list-group list-group-flush">
              {items.map((n) => (
                <div key={n.id} className={`list-group-item d-flex justify-content-between align-items-start ${!n.is_read ? 'fw-semibold bg-primary bg-opacity-5' : ''}`}>
                  <div className="d-flex gap-3">
                    <i className={`bi ${n.is_read ? 'bi-bell text-muted' : 'bi-bell-fill text-primary-pdao'} fs-5`} />
                    <div>
                      <div className={!n.is_read ? 'fw-bold' : ''}>{n.message}</div>
                      {n.link && <Link to={n.link} className="small">Open</Link>}
                      <div className="text-muted small">{fmtDateTime(n.created_at)}</div>
                    </div>
                  </div>
                  {!n.is_read && <button className="btn btn-sm btn-soft" onClick={() => markRead(n.id)}>Mark read</button>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm"><div className="card-body empty-state"><i className="bi bi-bell-slash d-block mb-2" /><p className="mb-0">No notifications yet.</p></div></div>
        )}
      </div>
    </AppLayout>
  )
}
