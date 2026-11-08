import { useEffect, useState, useRef } from 'react'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  type Application, type DocumentRow, appFullName, fmtDate,
} from '../../lib/types'
import EidCard from '../../components/EidCard'
import Alert from '../../components/Alert'

// ─────────────────────────────────────────────────────────
// Safe UUID — works on LAN IPs / plain HTTP
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
// PWD ID auto-numbering
//
// Format:  PWD-{YYYY}-{BRGY_CODE}-{NNNN}
//
//   YYYY       = current year (assigned on first approved view)
//   BRGY_CODE  = first 3 letters of the applicant's barangay
//                (letters only, uppercased) — falls back to "XXX"
//   NNNN       = 4-digit sequence per year+barangay
//
// Examples:
//   PWD-2025-SAN-0001  (San Isidro, 1st PWD of the year)
//   PWD-2025-SAN-0002  (San Isidro, 2nd PWD of the year)
//   PWD-2025-BAR-0001  (Barangay Uno, 1st PWD of the year)
//
// The algorithm is deterministic given existing numbers, so two
// admins loading the page simultaneously will generate the same
// candidates — whichever write lands first wins, no duplicates.
// For a fully race-proof solution, move this into a Postgres
// trigger / sequence in the future.
// ─────────────────────────────────────────────────────────
function brgyCode(barangay: string | null | undefined): string {
  if (!barangay) return 'XXX'
  const letters = barangay.replace(/[^A-Za-z]/g, '').toUpperCase()
  return (letters.slice(0, 3) || 'XXX').padEnd(3, 'X')
}

function generatePwdNumber(app: Application, used: Set<string>): string {
  const year = new Date().getFullYear()
  const prefix = `PWD-${year}-${brgyCode(app.barangay)}-`
  let seq = 1
  for (const num of used) {
    if (num.startsWith(prefix)) {
      const n = parseInt(num.slice(prefix.length), 10)
      if (!isNaN(n) && n >= seq) seq = n + 1
    }
  }
  let candidate = `${prefix}${String(seq).padStart(4, '0')}`
  while (used.has(candidate)) {
    seq++
    candidate = `${prefix}${String(seq).padStart(4, '0')}`
  }
  return candidate
}

async function autoAssignPwdNumbers(
  list: Application[]
): Promise<Map<string, string>> {
  // Snapshot every existing number first so we never collide.
  const used = new Set<string>()
  for (const app of list) {
    if (app.pwd_number) used.add(app.pwd_number)
  }

  const updates = new Map<string, string>()
  for (const app of list) {
    if (app.pwd_number) continue
    const num = generatePwdNumber(app, used)
    used.add(num)
    updates.set(app.id, num)
  }

  if (updates.size === 0) return updates

  const now = new Date().toISOString()
  await Promise.all(
    Array.from(updates.entries()).map(([id, pwd_number]) =>
      supabase
        .from('applications')
        .update({ pwd_number, last_updated: now })
        .eq('id', id)
    )
  )
  return updates
}

interface ApprovedApplicant {
  application: Application
  photoUrl: string | null
}

function pickApprovedPhoto(docs: DocumentRow[]): DocumentRow | null {
  const approved = docs.filter((d) => d.status === 'approved')
  return (
    approved.find((d) => d.document_type === 'passport_photo') ??
    approved.find((d) => d.document_type === 'picture_1x1') ??
    null
  )
}

export default function AdminEidPage() {
  const { profile } = useAuth()
  const [applicants, setApplicants] = useState<ApprovedApplicant[]>([])
  const [filtered, setFiltered] = useState<ApprovedApplicant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ApprovedApplicant | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // Selection & soft-delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)

  // Photo upload state
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  // ─────────────────────────────────────────────────────────
  // Initial load — auto-number any approved app missing a PWD ID
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('applications')
        .select('*')
        .in('status', ['Approved', 'Ready for Pickup'])
        .eq('is_deleted', false)
        .order('last_updated', { ascending: false })
      let apps = (data ?? []) as Application[]

      // 🆕 Auto-generate PWD numbers for anyone missing one
      const updates = await autoAssignPwdNumbers(apps)
      if (updates.size > 0) {
        apps = apps.map((a) =>
          updates.has(a.id) ? { ...a, pwd_number: updates.get(a.id)! } : a
        )
      }

      const enriched: ApprovedApplicant[] = []
      for (const app of apps) {
        let photoUrl: string | null = null
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('application_id', app.id)
          .order('uploaded_at', { ascending: false })
        const allDocs = (docs ?? []) as DocumentRow[]
        const photo = pickApprovedPhoto(allDocs)
        if (photo) {
          const { data: blob } = await supabase.storage
            .from('documents')
            .download(photo.storage_path)
          if (blob) photoUrl = URL.createObjectURL(blob)
        }
        enriched.push({ application: app, photoUrl })
      }

      setApplicants(enriched)
      setFiltered(enriched)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(applicants)
      return
    }
    const q = search.toLowerCase()
    setFiltered(
      applicants.filter((a) => {
        const name = appFullName(a.application).toLowerCase()
        const addr = [
          a.application.address,
          a.application.barangay,
          a.application.municipality,
          a.application.province,
        ]
          .join(' ')
          .toLowerCase()
        const pwd = (a.application.pwd_number || '').toLowerCase()
        return name.includes(q) || addr.includes(q) || pwd.includes(q)
      })
    )
  }, [search, applicants])

  // ─────────────────────────────────────────────────────────
  // Realtime — react to status changes, soft-delete, AND
  //            auto-number newly approved applicants
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-eid-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        async (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id
            if (oldId) {
              setApplicants((prev) =>
                prev.filter((a) => a.application.id !== oldId)
              )
            }
            return
          }

          let app = payload.new as Application

          if ((app as any).is_deleted) {
            setApplicants((prev) =>
              prev.filter((a) => a.application.id !== app.id)
            )
            return
          }

          if (app.status !== 'Approved' && app.status !== 'Ready for Pickup') {
            setApplicants((prev) =>
              prev.filter((a) => a.application.id !== app.id)
            )
            return
          }

          // 🆕 Auto-generate PWD number if this applicant doesn't have one yet
          if (!app.pwd_number) {
            const { data: allPwd } = await supabase
              .from('applications')
              .select('pwd_number')
              .not('pwd_number', 'is', null)
            const used = new Set(
              ((allPwd ?? []) as Array<{ pwd_number: string | null }>)
                .map((r) => r.pwd_number)
                .filter((n): n is string => !!n)
            )
            const newNum = generatePwdNumber(app, used)
            await supabase
              .from('applications')
              .update({ pwd_number: newNum })
              .eq('id', app.id)
            app = { ...app, pwd_number: newNum }
          }

          // (Re)load the card
          let photoUrl: string | null = null
          const { data: docs } = await supabase
            .from('documents')
            .select('*')
            .eq('application_id', app.id)
            .order('uploaded_at', { ascending: false })
          const allDocs = (docs ?? []) as DocumentRow[]
          const photo = pickApprovedPhoto(allDocs)
          if (photo) {
            const { data: blob } = await supabase.storage
              .from('documents')
              .download(photo.storage_path)
            if (blob) photoUrl = URL.createObjectURL(blob)
          }
          setApplicants((prev) => {
            const without = prev.filter((a) => a.application.id !== app.id)
            return [{ application: app, photoUrl }, ...without]
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const openCard = (a: ApprovedApplicant) => {
    setSelected(a)
    setFlipped(false)
    setSaveSuccess(null)
    setPhotoError(null)
  }

  const closeModal = () => {
    setSelected(null)
    setPhotoError(null)
  }

  const handlePrint = () => window.print()

  // --- Admin photo upload (auto-approved) ---
  const handlePhotoUpload = async (file: File) => {
    if (!selected) return
    setPhotoUploading(true)
    setPhotoError(null)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${selected.application.user_id}/eid-photo-${genUUID()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file)
    if (upErr) {
      setPhotoError(upErr.message)
      setPhotoUploading(false)
      return
    }

    const { error: insErr } = await supabase.from('documents').insert({
      application_id: selected.application.id,
      document_type: 'passport_photo',
      filename: file.name,
      storage_path: path,
      status: 'approved',
      reviewed_by: profile?.fullname ?? 'Admin',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'Uploaded by admin',
    })

    if (insErr) {
      await supabase.storage.from('documents').remove([path])
      setPhotoError(insErr.message)
      setPhotoUploading(false)
      return
    }

    const { data: blob } = await supabase.storage
      .from('documents')
      .download(path)
    if (blob) {
      const url = URL.createObjectURL(blob)
      setSelected((prev) => (prev ? { ...prev, photoUrl: url } : prev))
      setApplicants((prev) =>
        prev.map((a) =>
          a.application.id === selected.application.id
            ? { ...a, photoUrl: url }
            : a
        )
      )
    }

    setPhotoUploading(false)
    setSaveSuccess('Photo updated.')
  }

  // ─────────────────────────────────────────────────────────
  // Selection & SOFT DELETE
  // ─────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const allIds = filtered.map((a) => a.application.id)
    const allSelected = allIds.every((id) => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : allIds)
  }

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    if (
      !window.confirm(
        `Archive ${count} selected PRINT-ID record${count === 1 ? '' : 's'}?\n\n` +
          `They will be hidden from PRINT-ID Management but kept in the Archived page for record-keeping.`
      )
    )
      return

    setDeleting(true)
    setDeleteError(null)
    setDeleteSuccess(null)

    try {
      const { error } = await supabase
        .from('applications')
        .update({
          is_deleted: true,
          last_updated: new Date().toISOString(),
        })
        .in('id', selectedIds)

      if (error) throw error

      setApplicants((prev) =>
        prev.filter((a) => !selectedIds.includes(a.application.id))
      )
      if (selected && selectedIds.includes(selected.application.id)) {
        closeModal()
      }
      setSelectedIds([])
      setDeleteSuccess(
        `${count} record${count === 1 ? '' : 's'} archived successfully.`
      )
    } catch (err: any) {
      console.error('[PRINT-ID] archive failed:', err)
      setDeleteError(err.message || 'Failed to archive selected records.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout navItems={ADMIN_NAV}>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <h3 className="mb-1">PRINT-ID Management</h3>
            <p className="text-muted mb-0">
              {applicants.length} approved applicant
              {applicants.length !== 1 ? 's' : ''} with auto-generated PWD
              numbers &amp; PRINT-ID cards
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                className="btn btn-warning btn-sm"
                onClick={deleteSelected}
                disabled={deleting}
                title="Move to Archived (soft delete)"
              >
                {deleting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" />{' '}
                    Archiving…
                  </>
                ) : (
                  <>
                    <i className="bi bi-archive me-1" /> Archive Selected (
                    {selectedIds.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {deleteError && (
          <div className="mb-3">
            <Alert variant="danger" message={deleteError} />
          </div>
        )}
        {deleteSuccess && (
          <div className="mb-3">
            <Alert variant="success" message={deleteSuccess} />
          </div>
        )}

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-search" />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, address, or PWD number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body empty-state">
              <i className="bi bi-card-text d-block mb-2" />
              <p className="mb-0">
                {applicants.length === 0
                  ? 'No approved applicants yet. PWD numbers and PRINT-ID cards are generated automatically when an application is approved.'
                  : 'No applicants match your search.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={
                        filtered.length > 0 &&
                        selectedIds.length === filtered.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Applicant</th>
                  <th>PWD No.</th>
                  <th>Disability</th>
                  <th>Address</th>
                  <th>Approved On</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const app = a.application
                  const addr = [app.barangay, app.municipality, app.province]
                    .filter(Boolean)
                    .join(', ')
                  const pwdNumber =
                    app.pwd_number ||
                    `PWD-${brgyCode(app.barangay)}-PENDING`
                  const disabilityDisplay =
                    app.disability_type ||
                    (app.disability_types ?? []).join(', ') ||
                    '—'
                  return (
                    <tr key={app.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedIds.includes(app.id)}
                          onChange={() => toggleSelect(app.id)}
                        />
                      </td>
                      <td className="fw-semibold">{appFullName(app)}</td>
                      <td>
                        <span className="badge bg-primary bg-opacity-10 text-primary-pdao">
                          {pwdNumber}
                        </span>
                      </td>
                      <td className="small">{disabilityDisplay}</td>
                      <td className="small text-muted">{addr || '—'}</td>
                      <td className="small text-muted">
                        {fmtDate(app.last_updated)}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openCard(a)}
                        >
                          <i className="bi bi-card-text me-1" /> View PRINT-ID
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={closeModal}
            style={{ zIndex: 1050 }}
          />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ zIndex: 1055 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header no-print">
                  <h5 className="modal-title">
                    PRINT-ID — {appFullName(selected.application)}
                  </h5>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-soft"
                      onClick={() => photoInput.current?.click()}
                      disabled={photoUploading}
                      title="Upload or replace the PRINT-ID photo"
                    >
                      {photoUploading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />{' '}
                          Uploading…
                        </>
                      ) : (
                        <>
                          <i className="bi bi-camera me-1" /> Change Photo
                        </>
                      )}
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handlePrint}
                    >
                      <i className="bi bi-printer me-1" /> Print
                    </button>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeModal}
                    />

                    <input
                      ref={photoInput}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handlePhotoUpload(f)
                        e.target.value = ''
                      }}
                    />
                  </div>
                </div>
                <div className="modal-body text-center">
                  {photoError && (
                    <div className="text-start">
                      <Alert variant="danger" message={photoError} />
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="text-start">
                      <Alert variant="success" message={saveSuccess} />
                    </div>
                  )}

                  <div className="eid-page-wrapper">
                    <EidCard
                      application={selected.application}
                      photoUrl={selected.photoUrl}
                      flipped={flipped}
                      onFlip={() => setFlipped(!flipped)}
                    />
                    <p className="text-center text-muted small mt-3 no-print">
                      <i className="bi bi-hand-index me-1" /> Tap the card to
                      flip between front and back
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}