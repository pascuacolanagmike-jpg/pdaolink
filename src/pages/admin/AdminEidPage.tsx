import { useEffect, useState, useRef } from 'react'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import {
  type Application, type DocumentRow, appFullName, fmtDate,
  GENDER_OPTIONS, BLOOD_TYPES,
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

type EidEditFields = Pick<Application,
  | 'pwd_number' | 'first_name' | 'middle_name' | 'last_name' | 'suffix'
  | 'birth_date' | 'gender' | 'blood_type' | 'disability_type'
  | 'address' | 'barangay' | 'municipality' | 'province'
  | 'contact_number' | 'mobile_no'
  | 'emergency_name' | 'emergency_contact_number'
  | 'physician_name'
>

const eidFieldsFromApp = (app: Application): EidEditFields => ({
  pwd_number: app.pwd_number,
  first_name: app.first_name,
  middle_name: app.middle_name,
  last_name: app.last_name,
  suffix: app.suffix,
  birth_date: app.birth_date,
  gender: app.gender,
  blood_type: app.blood_type,
  // ✅ falls back to disability_types array when legacy field is empty
  disability_type:
    app.disability_type ||
    (app.disability_types ?? []).join(', ') ||
    null,
  address: app.address,
  barangay: app.barangay,
  municipality: app.municipality,
  province: app.province,
  contact_number: app.contact_number,
  mobile_no: app.mobile_no,
  emergency_name: app.emergency_name,
  emergency_contact_number: app.emergency_contact_number,
  physician_name: app.physician_name,
})

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
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState<EidEditFields | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
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
  // Initial load — exclude soft-deleted records
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('applications')
        .select('*')
        .in('status', ['Approved', 'Ready for Pickup'])
        .eq('is_deleted', false)                    // ← only active records
        .order('last_updated', { ascending: false })
      const apps = (data ?? []) as Application[]

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
  // Realtime — react to status changes AND soft-delete
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-eid-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        async (payload: any) => {
          // Hard delete (never happens now, but kept for safety)
          if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id
            if (oldId) {
              setApplicants((prev) =>
                prev.filter((a) => a.application.id !== oldId)
              )
            }
            return
          }

          const app = payload.new as Application

          // If it's been soft-deleted, remove from this list
          if ((app as any).is_deleted) {
            setApplicants((prev) =>
              prev.filter((a) => a.application.id !== app.id)
            )
            return
          }

          // If status moved out of the E-ID-eligible range, remove
          if (app.status !== 'Approved' && app.status !== 'Ready for Pickup') {
            setApplicants((prev) =>
              prev.filter((a) => a.application.id !== app.id)
            )
            return
          }

          // Otherwise, (re)load the card
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
    setEditMode(false)
    setEditFields(eidFieldsFromApp(a.application))
    setSaveError(null)
    setSaveSuccess(null)
    setPhotoError(null)
  }

  const closeModal = () => {
    setSelected(null)
    setEditMode(false)
    setPhotoError(null)
  }

  const handlePrint = () => window.print()

  const startEdit = () => {
    if (!selected) return
    setFlipped(false)
    setEditFields(eidFieldsFromApp(selected.application))
    setSaveError(null)
    setSaveSuccess(null)
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    if (selected) setEditFields(eidFieldsFromApp(selected.application))
    setSaveError(null)
  }

  const setField = (key: keyof EidEditFields, value: string) => {
    setEditFields((prev) =>
      prev ? { ...prev, [key]: value === '' ? null : value } : prev
    )
  }

  const saveEdit = async () => {
    if (!selected || !editFields) return
    setSaving(true)
    setSaveError(null)
    const { data, error } = await supabase
      .from('applications')
      .update({ ...editFields, last_updated: new Date().toISOString() })
      .eq('id', selected.application.id)
      .select()
      .maybeSingle()
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    const updatedApp =
      (data as Application) ?? { ...selected.application, ...editFields }
    setApplicants((prev) =>
      prev.map((a) =>
        a.application.id === updatedApp.id
          ? { ...a, application: updatedApp }
          : a
      )
    )
    setSelected((prev) =>
      prev ? { ...prev, application: updatedApp } : prev
    )
    setEditMode(false)
    setSaveSuccess('E-ID information updated.')
  }

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
        `Archive ${count} selected E-ID record${count === 1 ? '' : 's'}?\n\n` +
          `They will be hidden from E-ID Management but kept in the Archived page for record-keeping.`
      )
    )
      return

    setDeleting(true)
    setDeleteError(null)
    setDeleteSuccess(null)

    try {
      // SOFT DELETE — mark as deleted, do NOT remove the row
      const { error } = await supabase
        .from('applications')
        .update({
          is_deleted: true,
          last_updated: new Date().toISOString(),
        })
        .in('id', selectedIds)

      if (error) throw error

      // Remove from local state
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
      console.error('[E-ID] archive failed:', err)
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
            <h3 className="mb-1">E-ID Management</h3>
            <p className="text-muted mb-0">
              {applicants.length} approved applicant
              {applicants.length !== 1 ? 's' : ''} with generated E-ID cards
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
                  ? 'No approved applicants yet. E-ID cards are generated automatically when an application is approved.'
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
                    `PDAO-${app.id.slice(0, 8).toUpperCase()}`
                  // ✅ falls back to disability_types array when legacy field is empty
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
                          <i className="bi bi-card-text me-1" /> View E-ID
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
                    E-ID — {appFullName(selected.application)}
                  </h5>
                  <div className="d-flex gap-2">
                    {!editMode && (
                      <>
                        <button
                          className="btn btn-sm btn-soft"
                          onClick={() => photoInput.current?.click()}
                          disabled={photoUploading}
                          title="Upload or replace the E-ID photo"
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
                          className="btn btn-sm btn-outline-secondary"
                          onClick={startEdit}
                        >
                          <i className="bi bi-pencil-square me-1" /> Edit info
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={handlePrint}
                        >
                          <i className="bi bi-printer me-1" /> Print
                        </button>
                      </>
                    )}
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
                  {saveError && (
                    <div className="text-start">
                      <Alert variant="danger" message={saveError} />
                    </div>
                  )}
                  {photoError && (
                    <div className="text-start">
                      <Alert variant="danger" message={photoError} />
                    </div>
                  )}
                  {saveSuccess && !editMode && (
                    <div className="text-start">
                      <Alert variant="success" message={saveSuccess} />
                    </div>
                  )}

                  {editMode && editFields ? (
                    <div className="text-start">
                      <p className="text-muted small mb-3">
                        <i className="bi bi-info-circle me-1" />
                        Correct any wrong information captured from the
                        applicant's form. Changes update the E-ID immediately.
                      </p>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <label className="form-label small">PWD Number</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.pwd_number ?? ''}
                            onChange={(e) => setField('pwd_number', e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">First Name</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.first_name ?? ''}
                            onChange={(e) => setField('first_name', e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">Middle Name</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.middle_name ?? ''}
                            onChange={(e) => setField('middle_name', e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">Last Name</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.last_name ?? ''}
                            onChange={(e) => setField('last_name', e.target.value)}
                          />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label small">Suffix</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.suffix ?? ''}
                            onChange={(e) => setField('suffix', e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Birth Date</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={editFields.birth_date ?? ''}
                            onChange={(e) => setField('birth_date', e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Gender</label>
                          <select
                            className="form-select form-select-sm"
                            value={editFields.gender ?? ''}
                            onChange={(e) => setField('gender', e.target.value)}
                          >
                            <option value="">—</option>
                            {GENDER_OPTIONS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Blood Type</label>
                          <select
                            className="form-select form-select-sm"
                            value={editFields.blood_type ?? ''}
                            onChange={(e) => setField('blood_type', e.target.value)}
                          >
                            <option value="">—</option>
                            {BLOOD_TYPES.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label small">Disability</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.disability_type ?? ''}
                            onChange={(e) =>
                              setField('disability_type', e.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">Street Address</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.address ?? ''}
                            onChange={(e) => setField('address', e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Barangay</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.barangay ?? ''}
                            onChange={(e) => setField('barangay', e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Municipality</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.municipality ?? ''}
                            onChange={(e) => setField('municipality', e.target.value)}
                          />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label small">Province</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.province ?? ''}
                            onChange={(e) => setField('province', e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">
                            Contact / Mobile No.
                          </label>
                          <input
                            className="form-control form-control-sm"
                            value={
                              editFields.contact_number ??
                              editFields.mobile_no ??
                              ''
                            }
                            onChange={(e) => {
                              setField('contact_number', e.target.value)
                              setField('mobile_no', e.target.value)
                            }}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Physician Name</label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.physician_name ?? ''}
                            onChange={(e) =>
                              setField('physician_name', e.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">
                            Emergency Contact Name
                          </label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.emergency_name ?? ''}
                            onChange={(e) =>
                              setField('emergency_name', e.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">
                            Emergency Contact No.
                          </label>
                          <input
                            className="form-control form-control-sm"
                            value={editFields.emergency_contact_number ?? ''}
                            onChange={(e) =>
                              setField('emergency_contact_number', e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="d-flex justify-content-end gap-2 mt-3">
                        <button
                          className="btn btn-soft"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={saveEdit}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-1" />{' '}
                              Saving…
                            </>
                          ) : (
                            <>
                              <i className="bi bi-save me-1" /> Save changes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}