import { useEffect, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import {
  type Application, type DocumentRow, appFullName, fmtDate,
  GENDER_OPTIONS, BLOOD_TYPES,
} from '../../lib/types'
import EidCard from '../../components/EidCard'
import Alert from '../../components/Alert'

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
  disability_type: app.disability_type,
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

export default function AdminEidPage() {
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

  // Selection & deletion state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('applications')
        .select('*')
        .in('status', ['Approved', 'Ready for Pickup'])
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
        const photo = allDocs.find((d) => d.document_type === 'passport_photo') ?? allDocs[0] ?? null
        if (photo) {
          const { data: blob } = await supabase.storage.from('documents').download(photo.storage_path)
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
    if (!search.trim()) { setFiltered(applicants); return }
    const q = search.toLowerCase()
    setFiltered(applicants.filter((a) => {
      const name = appFullName(a.application).toLowerCase()
      const addr = [a.application.address, a.application.barangay, a.application.municipality, a.application.province].join(' ').toLowerCase()
      const pwd = (a.application.pwd_number || '').toLowerCase()
      return name.includes(q) || addr.includes(q) || pwd.includes(q)
    }))
  }, [search, applicants])

  // Realtime: pick up new approvals
  useEffect(() => {
    const channel = supabase
      .channel('admin-eid-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        async (payload: any) => {
          const app = payload.new as Application
          if (app.status !== 'Approved' && app.status !== 'Ready for Pickup') {
            setApplicants((prev) => prev.filter((a) => a.application.id !== app.id))
            return
          }
          let photoUrl: string | null = null
          const { data: docs } = await supabase
            .from('documents')
            .select('*')
            .eq('application_id', app.id)
            .order('uploaded_at', { ascending: false })
          const allDocs = (docs ?? []) as DocumentRow[]
          const photo = allDocs.find((d) => d.document_type === 'passport_photo') ?? allDocs[0] ?? null
          if (photo) {
            const { data: blob } = await supabase.storage.from('documents').download(photo.storage_path)
            if (blob) photoUrl = URL.createObjectURL(blob)
          }
          setApplicants((prev) => {
            const without = prev.filter((a) => a.application.id !== app.id)
            return [{ application: app, photoUrl }, ...without]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const openCard = (a: ApprovedApplicant) => {
    setSelected(a)
    setFlipped(false)
    setEditMode(false)
    setEditFields(eidFieldsFromApp(a.application))
    setSaveError(null)
    setSaveSuccess(null)
  }

  const closeModal = () => { setSelected(null); setEditMode(false) }

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
    setEditFields((prev) => (prev ? { ...prev, [key]: value === '' ? null : value } : prev))
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
    if (error) { setSaveError(error.message); return }
    const updatedApp = (data as Application) ?? { ...selected.application, ...editFields }
    setApplicants((prev) => prev.map((a) => (a.application.id === updatedApp.id ? { ...a, application: updatedApp } : a)))
    setSelected((prev) => (prev ? { ...prev, application: updatedApp } : prev))
    setEditMode(false)
    setSaveSuccess('E-ID information updated.')
  }

  // --- Selection & deletion ---
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const allIds = filtered.map(a => a.application.id)
    const allSelected = allIds.every(id => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : allIds)
  }

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} selected E‑ID record(s)? This action cannot be undone.`)) return

    setDeleting(true)
    setDeleteError(null)

    try {
      // Optionally delete linked documents first (if needed)
      // const { error: docError } = await supabase
      //   .from('documents')
      //   .delete()
      //   .in('application_id', selectedIds)

      const { error } = await supabase
        .from('applications')
        .delete()
        .in('id', selectedIds)

      if (error) throw error

      // Remove from local state
      setApplicants(prev => prev.filter(a => !selectedIds.includes(a.application.id)))
      setSelectedIds([])
      // If the deleted applicant is currently viewed in modal, close it
      if (selected && selectedIds.includes(selected.application.id)) {
        closeModal()
      }
      setDeleteError(null)
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete selected records.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout navItems={ADMIN_NAV}>
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
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
              {applicants.length} approved applicant{applicants.length !== 1 ? 's' : ''} with generated E-ID cards
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={deleteSelected}
                disabled={deleting}
              >
                {deleting ? (
                  <><span className="spinner-border spinner-border-sm me-1" /> Deleting…</>
                ) : (
                  <><i className="bi bi-trash3 me-1" /> Delete Selected ({selectedIds.length})</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Delete error alert – fixed by wrapping in a div with className */}
        {deleteError && (
          <div className="mb-3">
            <Alert variant="danger" message={deleteError} />
          </div>
        )}

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" /></span>
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
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
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
                  const addr = [app.barangay, app.municipality, app.province].filter(Boolean).join(', ')
                  const pwdNumber = app.pwd_number || `PDAO-${app.id.slice(0, 8).toUpperCase()}`
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
                      <td><span className="badge bg-primary bg-opacity-10 text-primary-pdao">{pwdNumber}</span></td>
                      <td className="small">{app.disability_type ?? (app.disability_types ?? []).join(', ') ?? '—'}</td>
                      <td className="small text-muted">{addr || '—'}</td>
                      <td className="small text-muted">{fmtDate(app.last_updated)}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-primary" onClick={() => openCard(a)}>
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

      {/* E-ID Modal (unchanged) */}
      {selected && (
        <>
          <div className="modal-backdrop fade show" onClick={closeModal} style={{ zIndex: 1050 }} />
          <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header no-print">
                  <h5 className="modal-title">
                    E-ID — {appFullName(selected.application)}
                  </h5>
                  <div className="d-flex gap-2">
                    {!editMode && (
                      <>
                        <button className="btn btn-sm btn-outline-secondary" onClick={startEdit}>
                          <i className="bi bi-pencil-square me-1" /> Edit info
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={handlePrint}>
                          <i className="bi bi-printer me-1" /> Print
                        </button>
                      </>
                    )}
                    <button type="button" className="btn-close" onClick={closeModal} />
                  </div>
                </div>
                <div className="modal-body text-center">
                  {saveError && <div className="text-start"><Alert variant="danger" message={saveError} /></div>}
                  {saveSuccess && !editMode && <div className="text-start"><Alert variant="success" message={saveSuccess} /></div>}

                  {editMode && editFields ? (
                    <div className="text-start">
                      <p className="text-muted small mb-3">
                        <i className="bi bi-info-circle me-1" />
                        Correct any wrong information captured from the applicant's form. Changes update the E-ID immediately.
                      </p>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <label className="form-label small">PWD Number</label>
                          <input className="form-control form-control-sm" value={editFields.pwd_number ?? ''} onChange={(e) => setField('pwd_number', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">First Name</label>
                          <input className="form-control form-control-sm" value={editFields.first_name ?? ''} onChange={(e) => setField('first_name', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">Middle Name</label>
                          <input className="form-control form-control-sm" value={editFields.middle_name ?? ''} onChange={(e) => setField('middle_name', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">Last Name</label>
                          <input className="form-control form-control-sm" value={editFields.last_name ?? ''} onChange={(e) => setField('last_name', e.target.value)} />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label small">Suffix</label>
                          <input className="form-control form-control-sm" value={editFields.suffix ?? ''} onChange={(e) => setField('suffix', e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Birth Date</label>
                          <input type="date" className="form-control form-control-sm" value={editFields.birth_date ?? ''} onChange={(e) => setField('birth_date', e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Gender</label>
                          <select className="form-select form-select-sm" value={editFields.gender ?? ''} onChange={(e) => setField('gender', e.target.value)}>
                            <option value="">—</option>
                            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Blood Type</label>
                          <select className="form-select form-select-sm" value={editFields.blood_type ?? ''} onChange={(e) => setField('blood_type', e.target.value)}>
                            <option value="">—</option>
                            {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label small">Disability</label>
                          <input className="form-control form-control-sm" value={editFields.disability_type ?? ''} onChange={(e) => setField('disability_type', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small">Street Address</label>
                          <input className="form-control form-control-sm" value={editFields.address ?? ''} onChange={(e) => setField('address', e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Barangay</label>
                          <input className="form-control form-control-sm" value={editFields.barangay ?? ''} onChange={(e) => setField('barangay', e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Municipality</label>
                          <input className="form-control form-control-sm" value={editFields.municipality ?? ''} onChange={(e) => setField('municipality', e.target.value)} />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label small">Province</label>
                          <input className="form-control form-control-sm" value={editFields.province ?? ''} onChange={(e) => setField('province', e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Contact / Mobile No.</label>
                          <input className="form-control form-control-sm" value={editFields.contact_number ?? editFields.mobile_no ?? ''} onChange={(e) => { setField('contact_number', e.target.value); setField('mobile_no', e.target.value) }} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Physician Name</label>
                          <input className="form-control form-control-sm" value={editFields.physician_name ?? ''} onChange={(e) => setField('physician_name', e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Emergency Contact Name</label>
                          <input className="form-control form-control-sm" value={editFields.emergency_name ?? ''} onChange={(e) => setField('emergency_name', e.target.value)} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Emergency Contact No.</label>
                          <input className="form-control form-control-sm" value={editFields.emergency_contact_number ?? ''} onChange={(e) => setField('emergency_contact_number', e.target.value)} />
                        </div>
                      </div>
                      <div className="d-flex justify-content-end gap-2 mt-3">
                        <button className="btn btn-soft" onClick={cancelEdit} disabled={saving}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                          {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Saving…</> : <><i className="bi bi-save me-1" /> Save changes</>}
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
                        <i className="bi bi-hand-index me-1" /> Tap the card to flip between front and back
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
