import { useEffect, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { fmtDateTime, type Announcement } from '../../lib/types'
import { useAuth } from '../../lib/auth'

// Local type for comments (you can move it to lib/types if preferred)
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

export default function ClientAnnouncements() {
  const { profile } = useAuth() // get current user profile
  const [items, setItems] = useState<Announcement[]>([])
  const [comments, setComments] = useState<AnnouncementComment[]>([])
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({})

  const loadAnnouncements = () => {
    supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Announcement[]))
  }

  const loadComments = async () => {
    // 1. Fetch all comments without join
    const { data: commentsData, error: commentsError } = await supabase
      .from('announcement_comments')
      .select('*')
      .order('created_at', { ascending: true })

    if (commentsError) {
      console.error('Failed to load comments:', commentsError.message)
      return
    }

    // 2. Get unique user IDs from comments
    const userIds = [...new Set((commentsData ?? []).map((c: any) => c.user_id))]

    // 3. Fetch profiles for those users
    let profilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)

      if (!profilesError && profilesData) {
        profilesMap = Object.fromEntries(profilesData.map((p: any) => [p.id, p]))
      }
    }

    // 4. Merge user data into comments
    const enrichedComments = (commentsData ?? []).map((comment: any) => ({
      ...comment,
      user: profilesMap[comment.user_id] || null,
    }))

    setComments(enrichedComments as AnnouncementComment[])
  }

  useEffect(() => {
    loadAnnouncements()
    loadComments()

    // Real-time for announcements
    const announcementsChannel = supabase
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

    // Real-time for comments
    const commentsChannel = supabase
      .channel('client-announcement-comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_comments' }, () => {
        loadComments()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(announcementsChannel)
      supabase.removeChannel(commentsChannel)
    }
  }, [])

  const getImageUrl = (path: string | null): string | null => {
    if (!path) return null
    return supabase.storage.from('announcements').getPublicUrl(path).data.publicUrl
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

  const handleCommentSubmit = async (announcementId: string) => {
    const content = commentInputs[announcementId]?.trim()
    if (!content) return
    if (!profile?.id) {
      alert('You must be logged in to comment.')
      return
    }

    setPostingComment(prev => ({ ...prev, [announcementId]: true }))
    const { error } = await supabase
      .from('announcement_comments')
      .insert({
        announcement_id: announcementId,
        user_id: profile.id,
        content,
      })

    setPostingComment(prev => ({ ...prev, [announcementId]: false }))

    if (error) {
      alert('Failed to post comment: ' + error.message)
    } else {
      setCommentInputs(prev => ({ ...prev, [announcementId]: '' }))
      loadComments() // refresh immediately
    }
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
              const announcementComments = comments.filter(c => c.announcement_id === a.id)
              const isExpanded = expandedComments.has(a.id)
              const isPosting = postingComment[a.id] || false

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

                      {/* Comments Section */}
                      <div className="mt-3 border-top pt-3">
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
                            {announcementComments.length > 0 ? (
                              <div className="mb-3">
                                {announcementComments.map(comment => (
                                  <div key={comment.id} className="border-start ps-3 mb-2">
                                    <div className="small text-muted">
                                      <strong>{comment.user?.full_name || 'Unknown'}</strong> · {fmtDateTime(comment.created_at)}
                                    </div>
                                    <p className="mb-0 small">{comment.content}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted small mb-3">No comments yet.</p>
                            )}

                            {/* Add comment form */}
                            {profile ? (
                              <div className="d-flex gap-2">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="Write a comment..."
                                  value={commentInputs[a.id] || ''}
                                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [a.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      handleCommentSubmit(a.id)
                                    }
                                  }}
                                />
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => handleCommentSubmit(a.id)}
                                  disabled={isPosting}
                                >
                                  {isPosting ? 'Posting...' : 'Post'}
                                </button>
                              </div>
                            ) : (
                              <p className="text-muted small mb-0">Please log in to comment.</p>
                            )}
                          </div>
                        )}
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
