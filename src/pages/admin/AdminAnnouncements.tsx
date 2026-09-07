import { useEffect, useState, FormEvent, useRef } from 'react'
import { Modal, Button } from 'react-bootstrap'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fmtDateTime, type Announcement } from '../../lib/types'
import Alert from '../../components/Alert'

// Define the comment type (can be moved to lib/types)
interface AnnouncementComment {
  id: string
  announcement_id: string
  user_id: string
  content: string
  created_at: string
  updated_at?: string
  user?: {
    full_name?: string
    avatar_url?: string
  } | null
}

export default function AdminAnnouncements() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [comments, setComments] = useState<AnnouncementComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [editItem, setEditItem] = useState<Announcement | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  // Track which announcement's comments are expanded
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  const load = () => {
    supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as Announcement[])
        setLoading(false)
      })
  }

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('announcement_comments')
      .select(`
        *,
        user:profiles ( full_name, avatar_url )
      `)
      .order('created_at', { ascending: true })

    if (!error) {
      setComments((data ?? []) as AnnouncementComment[])
    }
  }

  useEffect(() => {
    load()
    loadComments()

    // Optional: real-time subscription to refresh comments automatically
    const channel = supabase
      .channel('announcement-comments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcement_comments' },
        () => loadComments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleImageChange = (file: File | null, setFile: (f: File | null) => void, setPreview: (s: string | null) => void) => {
    if (file) {
      setFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setFile(null)
      setPreview(null)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!profile) return null
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${profile.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('announcements').upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) { setError(upErr.message); return null }
    return path
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.')
      return
    }
    setSaving(true)
    let imagePath: string | null = null
    if (imageFile) {
      imagePath = await uploadImage(imageFile)
      if (imageFile && !imagePath) { setSaving(false); return }
    }
    const { error } = await supabase.from('announcements').insert({
      title, content, is_pinned: isPinned,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      author_id: profile?.id,
      image_path: imagePath,
    })
    setSaving(false)
    if (error) { setError(error.message); return }

    const { data: clients } = await supabase.from('profiles').select('id').eq('role', 'client')
    if (clients && clients.length > 0) {
      await supabase.from('notifications').insert(
        clients.map((c: any) => ({ user_id: c.id, message: `New announcement: ${title}`, link: '/announcements' }))
      )
    }

    setTitle(''); setContent(''); setIsPinned(false); setExpiresAt('')
    setImageFile(null); setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
    setSuccess('Announcement published.')
    load()
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    let imagePath = editItem.image_path
    if (editImageFile) {
      if (editItem.image_path) {
        await supabase.storage.from('announcements').remove([editItem.image_path])
      }
      imagePath = await uploadImage(editImageFile)
      if (!imagePath) return
    }
    const { error } = await supabase.from('announcements').update({
      title: editItem.title, content: editItem.content, is_pinned: editItem.is_pinned,
      expires_at: editItem.expires_at ? new Date(editItem.expires_at).toISOString() : null,
      updated_at: new Date().toISOString(),
      image_path: imagePath,
    }).eq('id', editItem.id)
    if (error) { setError(error.message); return }
    setShowEdit(false)
    setEditItem(null)
    setEditImageFile(null)
    setEditImagePreview(null)
    if (editFileRef.current) editFileRef.current.value = ''
    setSuccess('Announcement updated.')
    load()
  }

  const handleDelete = async (a: Announcement) => {
    if (!confirm('Delete this announcement?')) return
    if (a.image_path) {
      await supabase.storage.from('announcements').remove([a.image_path])
    }
    await supabase.from('announcements').delete().eq('id', a.id)
    setSuccess('Announcement deleted.')
    load()
    loadComments() // refresh comments too
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return
    const { error } = await supabase
      .from('announcement_comments')
      .delete()
      .eq('id', commentId)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Comment deleted.')
      loadComments() // refresh
    }
  }

  const toggleComments = (announcementId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(announcementId)) {
        newSet.delete(announcementId)
      } else {
        newSet.add(announcementId)
      }
      return newSet
    })
  }

  const getImageUrl = (path: string | null): string | null => {
    if (!path) return null
    return supabase.storage.from('announcements').getPublicUrl(path).data.publicUrl
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Announcements</h3>
        <p className="text-muted mb-4">Create, edit, pin, and delete notices for applicants. Supports text and photo.</p>

        {error && <Alert variant="danger" message={error} />}
        {success && <Alert variant="success" message={success} />}

        <div className="row g-3">
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm position-sticky" style={{ top: 80 }}>
              <div className="card-header"><i className="bi bi-megaphone-fill text-primary-pdao me-1" /> New announcement</div>
              <div className="card-body">
                <form onSubmit={handleCreate}>
                  <div className="mb-3">
                    <label className="form-label">Title</label>
                    <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Content</label>
                    <textarea className="form-control" rows={5} value={content} onChange={(e) => setContent(e.target.value)} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Photo (optional)</label>
                    <input
                      ref={fileRef}
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={(e) => handleImageChange(e.target.files?.[0] ?? null, setImageFile, setImagePreview)}
                    />
                    {imagePreview && (
                      <div className="mt-2 position-relative">
                        <img src={imagePreview} alt="Preview" className="rounded-3 w-100" style={{ maxHeight: 200, objectFit: 'cover' }} />
                        <button type="button" className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = '' }}>
                          <i className="bi bi-x" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Expiration date (optional)</label>
                    <input type="datetime-local" className="form-control" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                  <div className="form-check mb-3">
                    <input className="form-check-input" type="checkbox" id="pinNew" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
                    <label className="form-check-label" htmlFor="pinNew">Pin to top</label>
                  </div>
                  <button type="submit" className="btn btn-primary w-100" disabled={saving}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Publishing…</> : <><i className="bi bi-send me-1" /> Publish</>}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <h6 className="text-muted text-uppercase small fw-bold mb-2">Existing announcements</h6>
            {loading ? (
              <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
            ) : items.length > 0 ? (
              <div className="row g-3">
                {items.map((a) => {
                  const imgUrl = getImageUrl(a.image_path)
                  const announcementComments = comments.filter(c => c.announcement_id === a.id)
                  const isExpanded = expandedComments.has(a.id)
                  return (
                    <div className="col-12" key={a.id}>
                      <div className="card border-0 shadow-sm">
                        {imgUrl && (
                          <img src={imgUrl} alt={a.title} className="card-img-top rounded-top" style={{ maxHeight: 280, objectFit: 'cover' }} />
                        )}
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <h6 className="mb-0">{a.title} {a.is_pinned && <span className="pin-badge"><i className="bi bi-pin-angle-fill" /> Pinned</span>}</h6>
                            <button className="btn btn-sm btn-soft" onClick={() => {
                              setEditItem({ ...a, expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '' })
                              setEditImagePreview(getImageUrl(a.image_path))
                              setShowEdit(true)
                            }}><i className="bi bi-pencil" /></button>
                          </div>
                          <p className="text-muted small mb-2" style={{ whiteSpace: 'pre-wrap' }}>{a.content}</p>
                          <div className="text-muted small"><i className="bi bi-calendar3 me-1" />{fmtDateTime(a.created_at)}{a.expires_at && <span className="ms-2"><i className="bi bi-clock me-1" />Expires {fmtDateTime(a.expires_at)}</span>}</div>

                          {/* Comments section */}
                          <div className="mt-3">
                            <button
                              className="btn btn-sm btn-link p-0"
                              onClick={() => toggleComments(a.id)}
                            >
                              <i className="bi bi-chat-left-text me-1" />
                              Comments ({announcementComments.length})
                              <i className={`bi ms-1 ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                            </button>

                            {isExpanded && (
                              <div className="mt-2">
                                {announcementComments.length === 0 ? (
                                  <p className="text-muted small mb-0">No comments yet.</p>
                                ) : (
                                  announcementComments.map(comment => (
                                    <div key={comment.id} className="border-start ps-3 mb-2">
                                      <div className="d-flex justify-content-between align-items-start">
                                        <div className="small text-muted">
                                          <strong>{comment.user?.full_name || 'Unknown'}</strong> · {fmtDateTime(comment.created_at)}
                                        </div>
                                        <button
                                          className="btn btn-sm btn-outline-danger ms-2"
                                          onClick={() => handleDeleteComment(comment.id)}
                                        >
                                          <i className="bi bi-trash" />
                                        </button>
                                      </div>
                                      <p className="mb-0 small">{comment.content}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          <button className="btn btn-sm btn-outline-danger mt-2" onClick={() => handleDelete(a)}><i className="bi bi-trash me-1" /> Delete</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="card border-0 shadow-sm"><div className="card-body empty-state"><i className="bi bi-megaphone d-block mb-2" /><p className="mb-0">No announcements yet. Create one on the left.</p></div></div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal (unchanged) */}
      <Modal show={showEdit} onHide={() => setShowEdit(false)}>
        <form onSubmit={handleEdit}>
          <Modal.Header closeButton><Modal.Title>Edit announcement</Modal.Title></Modal.Header>
          <Modal.Body>
            {editItem && (
              <>
                <div className="mb-3"><label className="form-label">Title</label><input className="form-control" value={editItem.title} onChange={(e) => setEditItem({ ...editItem, title: e.target.value })} required /></div>
                <div className="mb-3"><label className="form-label">Content</label><textarea className="form-control" rows={5} value={editItem.content} onChange={(e) => setEditItem({ ...editItem, content: e.target.value })} required /></div>
                <div className="mb-3">
                  <label className="form-label">Photo</label>
                  {editImagePreview && (
                    <div className="mb-2 position-relative">
                      <img src={editImagePreview} alt="Current" className="rounded-3 w-100" style={{ maxHeight: 160, objectFit: 'cover' }} />
                    </div>
                  )}
                  <input
                    ref={editFileRef}
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      handleImageChange(f, setEditImageFile, setEditImagePreview)
                    }}
                  />
                </div>
                <div className="mb-3"><label className="form-label">Expires at</label><input type="datetime-local" className="form-control" value={editItem.expires_at ?? ''} onChange={(e) => setEditItem({ ...editItem, expires_at: e.target.value })} /></div>
                <div className="form-check"><input className="form-check-input" type="checkbox" id="editPin" checked={editItem.is_pinned} onChange={(e) => setEditItem({ ...editItem, is_pinned: e.target.checked })} /><label className="form-check-label" htmlFor="editPin">Pin to top</label></div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="soft" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button variant="primary" type="submit"><i className="bi bi-save me-1" /> Save</Button>
          </Modal.Footer>
        </form>
      </Modal>
    </AppLayout>
  )
}
