import { useEffect, useState, FormEvent, useRef } from 'react'
import { Modal, Button } from 'react-bootstrap'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fmtDateTime, type Announcement } from '../../lib/types'
import { checkProfanity } from '../../lib/profanity'
import Alert from '../../components/Alert'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface AnnouncementComment {
  id: string
  announcement_id: string
  user_id: string
  parent_id: string | null
  content: string
  created_at: string
  updated_at?: string
  edited_at?: string | null
  is_hidden?: boolean
  /** When set, only this user (and admins) can see the comment. */
  visible_to_user_id?: string | null
  user?: {
    full_name?: string
    avatar_url?: string
  } | null
  /** Resolved target user for private replies (populated client-side) */
  visibleToUser?: {
    full_name?: string
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

  // Comments UI
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  const [revealedComments, setRevealedComments] = useState<Set<string>>(new Set())

  // Reply state
  const [replyTo, setReplyTo] = useState<{
    commentId: string
    announcementId: string
    topLevelId: string
    targetUserId: string
    targetName: string
  } | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyHadProfanity, setReplyHadProfanity] = useState(false)
  /** Default TRUE — admin replies are private by default. */
  const [replyIsPrivate, setReplyIsPrivate] = useState(true)

  // Edit comment
  const [editingComment, setEditingComment] = useState<AnnouncementComment | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editCommentBusy, setEditCommentBusy] = useState(false)
  const [editHadProfanity, setEditHadProfanity] = useState(false)

  // ─────────────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────────────
  const load = () => {
    supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[announcements] load:', error.message)
        setItems((data ?? []) as Announcement[])
        setLoading(false)
      })
  }

  const loadComments = async () => {
    const { data: commentsData, error: commentsError } = await supabase
      .from('announcement_comments')
      .select('*')
      .order('created_at', { ascending: true })

    if (commentsError) {
      console.error('[comments] load:', commentsError.message)
      setError(`Failed to load comments: ${commentsError.message}`)
      return
    }

    // Collect ALL user ids we need to resolve: comment authors + private targets
    const userIds = Array.from(
      new Set(
        (commentsData ?? []).flatMap((c: any) =>
          [c.user_id, c.visible_to_user_id].filter(Boolean)
        )
      )
    )

    let profilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)

      if (profilesError) {
        console.warn('[comments] profiles:', profilesError.message)
      } else if (profilesData) {
        profilesMap = Object.fromEntries(profilesData.map((p: any) => [p.id, p]))
      }
    }

    const enriched = (commentsData ?? []).map((c: any) => ({
      ...c,
      user: profilesMap[c.user_id] || null,
      visibleToUser: c.visible_to_user_id
        ? profilesMap[c.visible_to_user_id] || null
        : null,
    }))

    setComments(enriched as AnnouncementComment[])
  }

  useEffect(() => {
    load()
    loadComments()

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

  // ─────────────────────────────────────────────────────────
  // Announcement CRUD
  // ─────────────────────────────────────────────────────────
  const handleImageChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void
  ) => {
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
    const { error: upErr } = await supabase.storage
      .from('announcements')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) {
      setError(upErr.message)
      return null
    }
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
      if (imageFile && !imagePath) {
        setSaving(false)
        return
      }
    }
    const { error } = await supabase.from('announcements').insert({
      title,
      content,
      is_pinned: isPinned,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      author_id: profile?.id,
      image_path: imagePath,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }

    const { data: clients } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'client')
    if (clients && clients.length > 0) {
      await supabase.from('notifications').insert(
        clients.map((c: any) => ({
          user_id: c.id,
          message: `New announcement: ${title}`,
          link: '/announcements',
        }))
      )
    }

    setTitle('')
    setContent('')
    setIsPinned(false)
    setExpiresAt('')
    setImageFile(null)
    setImagePreview(null)
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
    const { error } = await supabase
      .from('announcements')
      .update({
        title: editItem.title,
        content: editItem.content,
        is_pinned: editItem.is_pinned,
        expires_at: editItem.expires_at
          ? new Date(editItem.expires_at).toISOString()
          : null,
        updated_at: new Date().toISOString(),
        image_path: imagePath,
      })
      .eq('id', editItem.id)
    if (error) {
      setError(error.message)
      return
    }
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
    setError(null)

    if (a.image_path) {
      const { error: imgErr } = await supabase.storage
        .from('announcements')
        .remove([a.image_path])
      if (imgErr) console.warn('[announcements] image remove:', imgErr.message)
    }

    const { error: delErr } = await supabase
      .from('announcements')
      .delete()
      .eq('id', a.id)

    if (delErr) {
      console.error('[announcements] delete:', delErr)
      setError(`Delete failed: ${delErr.message}`)
      return
    }

    setSuccess('Announcement deleted.')
    load()
    loadComments()
  }

  // ─────────────────────────────────────────────────────────
  // Comments: delete / hide / edit / reply
  // ─────────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment? Replies will also be removed.')) return
    setError(null)

    const { error: delErr } = await supabase
      .from('announcement_comments')
      .delete()
      .eq('id', commentId)

    if (delErr) {
      console.error('[comments] delete:', delErr)
      setError(`Delete failed: ${delErr.message}`)
      return
    }

    setSuccess('Comment deleted.')
    await loadComments()
  }

  const handleHideComment = async (commentId: string, hide: boolean) => {
    setError(null)
    const { error } = await supabase
      .from('announcement_comments')
      .update({ is_hidden: hide })
      .eq('id', commentId)

    if (error) {
      console.error('[comments] hide:', error)
      setError(`Hide failed: ${error.message}`)
    } else {
      setSuccess(hide ? 'Comment hidden from users.' : 'Comment visible to users.')
      await loadComments()
    }
  }

  const handleOpenEditComment = (comment: AnnouncementComment) => {
    setEditingComment(comment)
    setEditingText(comment.content)
    setEditHadProfanity(false)
  }

  // ── LIVE MASK: edit modal ─────────────────────────────
  const handleEditTextChange = (raw: string) => {
    const { filtered, clean } = checkProfanity(raw)
    setEditingText(filtered)
    if (!clean) setEditHadProfanity(true)
  }

  const handleSaveEditComment = async () => {
    if (!editingComment) return
    const clean = editingText.trim()
    if (!clean) {
      setError('Comment cannot be empty.')
      return
    }
    const { filtered } = checkProfanity(clean)
    setEditCommentBusy(true)
    setError(null)

    const { error } = await supabase
      .from('announcement_comments')
      .update({
        content: filtered,
        edited_at: new Date().toISOString(),
      })
      .eq('id', editingComment.id)

    setEditCommentBusy(false)

    if (error) {
      console.error('[comments] edit:', error)
      setError(`Edit failed: ${error.message}`)
      return
    }

    setSuccess('Comment updated.')
    setEditingComment(null)
    setEditingText('')
    setEditHadProfanity(false)
    await loadComments()
  }

  const handleOpenReply = (comment: AnnouncementComment) => {
    const topLevelId = comment.parent_id ?? comment.id
    setReplyTo({
      commentId: comment.id,
      announcementId: comment.announcement_id,
      topLevelId,
      targetUserId: comment.user_id,
      targetName: comment.user?.full_name || 'this user',
    })
    setReplyText('')
    setReplyHadProfanity(false)
    setReplyIsPrivate(true)     // ← default to private reply
    setError(null)
  }

  // ── LIVE MASK: reply box ─────────────────────────────
  const handleReplyTextChange = (raw: string) => {
    const { filtered, clean } = checkProfanity(raw)
    setReplyText(filtered)
    if (!clean) setReplyHadProfanity(true)
  }

  const handleSendReply = async () => {
    if (!profile) {
      setError('You must be logged in to reply.')
      return
    }
    if (!replyTo) {
      setError('No comment selected for reply.')
      return
    }
    const raw = replyText.trim()
    if (!raw) {
      setError('Reply is empty.')
      return
    }

    setReplyBusy(true)
    setError(null)

    const { filtered } = checkProfanity(raw)

    const basePayload: any = {
      announcement_id: replyTo.announcementId,
      user_id: profile.id,
      content: filtered,
      // 🔒 When private, only the target user will be able to SELECT this row (RLS).
      visible_to_user_id: replyIsPrivate ? replyTo.targetUserId : null,
    }

    // Try with parent_id first (threaded reply)
    let payload: any = { ...basePayload }
    if (replyTo.topLevelId) payload.parent_id = replyTo.topLevelId

    console.log('[reply] inserting:', payload)

    let { data, error: insErr } = await supabase
      .from('announcement_comments')
      .insert(payload)
      .select()
      .single()

    // Fallback if parent_id column is missing (SQL not applied)
    if (insErr && /parent_id/i.test(insErr.message || '')) {
      console.warn('[reply] parent_id column missing — retrying without it')
      const retry = await supabase
        .from('announcement_comments')
        .insert(basePayload)
        .select()
        .single()
      data = retry.data
      insErr = retry.error
    }

    if (insErr) {
      console.error('[reply] insert error:', insErr)
      setError(`Reply failed: ${insErr.message}`)
      setReplyBusy(false)
      return
    }

    console.log('[reply] inserted:', data)

    // Notify the target user (they're the only one who'll see a private reply)
    try {
      if (replyTo.targetUserId !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: replyTo.targetUserId,
          message: replyIsPrivate
            ? 'An admin sent you a private reply.'
            : 'An admin replied to your comment.',
          link: '/announcements',
        })
      }
    } catch (e) {
      console.warn('[reply] notification failed:', e)
    }

    setSuccess(replyIsPrivate ? 'Private reply sent.' : 'Reply posted.')
    setReplyText('')
    setReplyHadProfanity(false)
    setReplyIsPrivate(true)
    setReplyTo(null)
    setReplyBusy(false)
    await loadComments()
  }

  const toggleComments = (announcementId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (next.has(announcementId)) next.delete(announcementId)
      else next.add(announcementId)
      return next
    })
  }

  const toggleReveal = (commentId: string) => {
    setRevealedComments((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  const getImageUrl = (path: string | null): string | null => {
    if (!path) return null
    return supabase.storage.from('announcements').getPublicUrl(path).data.publicUrl
  }

  // ─────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────
  const renderComment = (comment: AnnouncementComment, isReply: boolean) => {
    const profanity = checkProfanity(comment.content)
    const replies = comments.filter((c) => c.parent_id === comment.id)
    const isReplying = replyTo?.commentId === comment.id
    const isRevealed = revealedComments.has(comment.id)
    const isPrivate = Boolean(comment.visible_to_user_id)

    return (
      <div
        key={comment.id}
        className={`comment-block ${isReply ? 'comment-reply' : ''} ${
          comment.is_hidden ? 'comment-hidden' : ''
        } ${isPrivate ? 'comment-private' : ''}`}
      >
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div className="small text-muted">
            <strong>{comment.user?.full_name || 'Unknown'}</strong>
            <span className="mx-1">·</span>
            {fmtDateTime(comment.created_at)}
            {comment.edited_at && (
              <span className="badge bg-info bg-opacity-10 text-info-emphasis ms-2">
                Edited
              </span>
            )}
            {comment.is_hidden && (
              <span className="badge bg-warning text-dark ms-2">
                <i className="bi bi-eye-slash me-1" /> Hidden
              </span>
            )}
            {isPrivate && (
              <span
                className="badge bg-dark bg-opacity-75 ms-2"
                title={`Only visible to ${comment.visibleToUser?.full_name || 'the addressed user'}`}
              >
                <i className="bi bi-lock-fill me-1" />
                Private → {comment.visibleToUser?.full_name || 'user'}
              </span>
            )}
            {!profanity.clean && (
              <span
                className="badge bg-danger bg-opacity-10 text-danger ms-2"
                title={`Flagged: ${profanity.matched.join(', ')}`}
              >
                <i className="bi bi-exclamation-triangle-fill me-1" /> Flagged
              </span>
            )}
          </div>

          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handleOpenReply(comment)}
              title="Reply"
            >
              <i className="bi bi-reply" />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => handleOpenEditComment(comment)}
              title="Edit"
            >
              <i className="bi bi-pencil" />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => handleHideComment(comment.id, !comment.is_hidden)}
              title={comment.is_hidden ? 'Show to users' : 'Hide from users'}
            >
              <i className={`bi ${comment.is_hidden ? 'bi-eye' : 'bi-eye-slash'}`} />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => handleDeleteComment(comment.id)}
              title="Delete"
            >
              <i className="bi bi-trash" />
            </button>
          </div>
        </div>

        <p
          className={`mb-1 small ${
            !profanity.clean && !isRevealed ? 'comment-blurred' : ''
          }`}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {comment.content}
        </p>

        {!profanity.clean && !isRevealed && (
          <button
            type="button"
            className="btn btn-sm btn-link p-0 small"
            onClick={() => toggleReveal(comment.id)}
          >
            <i className="bi bi-eye me-1" /> Reveal filtered content
          </button>
        )}

        {isReplying && (
          <div className="mt-2 ps-2 border-start">
            <textarea
              className="form-control form-control-sm mb-2"
              rows={2}
              placeholder={`Replying to ${comment.user?.full_name || 'user'}…`}
              value={replyText}
              onChange={(e) => handleReplyTextChange(e.target.value)}
            />
            {replyHadProfanity && (
              <div className="small text-warning-emphasis mb-2">
                <i className="bi bi-shield-fill-check me-1" />
                Offensive words were automatically masked with asterisks.
              </div>
            )}

            {/* ── Private / public toggle ────────────────── */}
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                id={`private-reply-${comment.id}`}
                checked={replyIsPrivate}
                onChange={(e) => setReplyIsPrivate(e.target.checked)}
              />
              <label
                className="form-check-label small"
                htmlFor={`private-reply-${comment.id}`}
              >
                {replyIsPrivate ? (
                  <>
                    <i className="bi bi-lock-fill text-dark me-1" />
                    <strong>Private</strong> — only{' '}
                    <strong>{comment.user?.full_name || 'this user'}</strong> will see
                    this reply.
                  </>
                ) : (
                  <>
                    <i className="bi bi-globe2 text-secondary me-1" />
                    Public — everyone viewing this announcement can see it.
                  </>
                )}
              </label>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={replyBusy || !replyText.trim()}
                onClick={handleSendReply}
              >
                {replyBusy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" /> Sending…
                  </>
                ) : replyIsPrivate ? (
                  <>
                    <i className="bi bi-send-lock me-1" /> Send private reply
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-1" /> Send reply
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-soft"
                onClick={() => {
                  setReplyTo(null)
                  setReplyText('')
                  setReplyHadProfanity(false)
                  setReplyIsPrivate(true)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div className="mt-2 ps-2 border-start">
            {replies.map((r) => renderComment(r, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">Announcements</h3>
        <p className="text-muted mb-4">
          Create, edit, pin, and delete notices for applicants. Reply to comments,
          hide them, and flagged offensive language is detected automatically.
          Replies can be <strong>private</strong> so only the addressed user sees them.
        </p>

        {error && <Alert variant="danger" message={error} />}
        {success && <Alert variant="success" message={success} />}

        <div className="row g-3">
          <div className="col-lg-5">
            <div
              className="card border-0 shadow-sm position-sticky"
              style={{ top: 80 }}
            >
              <div className="card-header">
                <i className="bi bi-megaphone-fill text-primary-pdao me-1" /> New
                announcement
              </div>
              <div className="card-body">
                <form onSubmit={handleCreate}>
                  <div className="mb-3">
                    <label className="form-label">Title</label>
                    <input
                      className="form-control"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Content</label>
                    <textarea
                      className="form-control"
                      rows={5}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Photo (optional)</label>
                    <input
                      ref={fileRef}
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageChange(
                          e.target.files?.[0] ?? null,
                          setImageFile,
                          setImagePreview
                        )
                      }
                    />
                    {imagePreview && (
                      <div className="mt-2 position-relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="rounded-3 w-100"
                          style={{ maxHeight: 200, objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                          onClick={() => {
                            setImageFile(null)
                            setImagePreview(null)
                            if (fileRef.current) fileRef.current.value = ''
                          }}
                        >
                          <i className="bi bi-x" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Expiration date (optional)</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>
                  <div className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="pinNew"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="pinNew">
                      Pin to top
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />{' '}
                        Publishing…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send me-1" /> Publish
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="text-muted text-uppercase small fw-bold mb-0">
                Existing announcements
              </h6>
              <div className="form-check form-switch small">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="showHiddenToggle"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                />
                <label
                  className="form-check-label small text-muted"
                  htmlFor="showHiddenToggle"
                >
                  Show hidden comments
                </label>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" />
              </div>
            ) : items.length > 0 ? (
              <div className="row g-3">
                {items.map((a) => {
                  const imgUrl = getImageUrl(a.image_path)
                  let announcementComments = comments.filter(
                    (c) => c.announcement_id === a.id
                  )
                  if (!showHidden)
                    announcementComments = announcementComments.filter(
                      (c) => !c.is_hidden
                    )

                  const topLevel = announcementComments.filter((c) => !c.parent_id)
                  const isExpanded = expandedComments.has(a.id)

                  return (
                    <div className="col-12" key={a.id}>
                      <div className="card border-0 shadow-sm">
                        {imgUrl && (
                          <img
                            src={imgUrl}
                            alt={a.title}
                            className="card-img-top rounded-top"
                            style={{ maxHeight: 280, objectFit: 'cover' }}
                          />
                        )}
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <h6 className="mb-0">
                              {a.title}{' '}
                              {a.is_pinned && (
                                <span className="pin-badge">
                                  <i className="bi bi-pin-angle-fill" /> Pinned
                                </span>
                              )}
                            </h6>
                            <button
                              type="button"
                              className="btn btn-sm btn-soft"
                              onClick={() => {
                                setEditItem({
                                  ...a,
                                  expires_at: a.expires_at
                                    ? a.expires_at.slice(0, 16)
                                    : '',
                                })
                                setEditImagePreview(getImageUrl(a.image_path))
                                setShowEdit(true)
                              }}
                            >
                              <i className="bi bi-pencil" />
                            </button>
                          </div>
                          <p
                            className="text-muted small mb-2"
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {a.content}
                          </p>
                          <div className="text-muted small">
                            <i className="bi bi-calendar3 me-1" />
                            {fmtDateTime(a.created_at)}
                            {a.expires_at && (
                              <span className="ms-2">
                                <i className="bi bi-clock me-1" />
                                Expires {fmtDateTime(a.expires_at)}
                              </span>
                            )}
                          </div>

                          <div className="mt-3">
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0"
                              onClick={() => toggleComments(a.id)}
                            >
                              <i className="bi bi-chat-left-text me-1" />
                              Comments ({announcementComments.length})
                              <i
                                className={`bi ms-1 ${
                                  isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'
                                }`}
                              />
                            </button>

                            {isExpanded && (
                              <div className="mt-2">
                                {topLevel.length === 0 ? (
                                  <p className="text-muted small mb-0">
                                    No comments yet.
                                  </p>
                                ) : (
                                  topLevel.map((c) => renderComment(c, false))
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger mt-2"
                            onClick={() => handleDelete(a)}
                          >
                            <i className="bi bi-trash me-1" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body empty-state">
                  <i className="bi bi-megaphone d-block mb-2" />
                  <p className="mb-0">
                    No announcements yet. Create one on the left.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit announcement modal */}
      <Modal show={showEdit} onHide={() => setShowEdit(false)}>
        <form onSubmit={handleEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit announcement</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editItem && (
              <>
                <div className="mb-3">
                  <label className="form-label">Title</label>
                  <input
                    className="form-control"
                    value={editItem.title}
                    onChange={(e) =>
                      setEditItem({ ...editItem, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Content</label>
                  <textarea
                    className="form-control"
                    rows={5}
                    value={editItem.content}
                    onChange={(e) =>
                      setEditItem({ ...editItem, content: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Photo</label>
                  {editImagePreview && (
                    <div className="mb-2 position-relative">
                      <img
                        src={editImagePreview}
                        alt="Current"
                        className="rounded-3 w-100"
                        style={{ maxHeight: 160, objectFit: 'cover' }}
                      />
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
                <div className="mb-3">
                  <label className="form-label">Expires at</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={editItem.expires_at ?? ''}
                    onChange={(e) =>
                      setEditItem({ ...editItem, expires_at: e.target.value })
                    }
                  />
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="editPin"
                    checked={editItem.is_pinned}
                    onChange={(e) =>
                      setEditItem({ ...editItem, is_pinned: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="editPin">
                    Pin to top
                  </label>
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="soft" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              <i className="bi bi-save me-1" /> Save
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Edit comment modal */}
      <Modal
        show={!!editingComment}
        onHide={() => {
          setEditingComment(null)
          setEditHadProfanity(false)
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Edit comment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <textarea
            className="form-control"
            rows={4}
            value={editingText}
            onChange={(e) => handleEditTextChange(e.target.value)}
          />
          {editHadProfanity && (
            <div className="small text-warning-emphasis mt-2">
              <i className="bi bi-shield-fill-check me-1" />
              Offensive words are being masked with asterisks automatically.
            </div>
          )}
          <div className="small text-muted mt-2">
            <i className="bi bi-info-circle me-1" />
            Profanity (English / Tagalog) is replaced with asterisks live as you type.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="soft"
            onClick={() => {
              setEditingComment(null)
              setEditHadProfanity(false)
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveEditComment}
            disabled={editCommentBusy}
          >
            {editCommentBusy ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> Saving…
              </>
            ) : (
              <>
                <i className="bi bi-save me-1" /> Save
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .comment-block {
          padding: 0.6rem 0.75rem;
          border-radius: 0.5rem;
          background: #f8fafc;
          margin-bottom: 0.5rem;
        }
        .comment-reply {
          background: #eef4ff;
          border-left: 3px solid #0056b3;
        }
        .comment-hidden {
          opacity: 0.55;
          background: #fef3c7;
        }
        .comment-private {
          background: #f3f0ff;
          border-left: 3px solid #6f42c1;
        }
        .comment-blurred {
          filter: blur(4px);
          user-select: none;
          transition: filter 0.15s ease;
        }
      `}</style>
    </AppLayout>
  )
}