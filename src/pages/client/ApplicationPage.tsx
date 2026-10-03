import { useState, useEffect, FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  APPLICATION_TYPES, DISABILITY_TYPES, DISABILITY_CAUSE_CONGENITAL, DISABILITY_CAUSE_ACQUIRED,
  GENDER_OPTIONS, CIVIL_STATUS_OPTIONS, BLOOD_TYPES, EDUCATIONAL_ATTAINMENT,
  EMPLOYMENT_STATUS, EMPLOYMENT_CATEGORIES, EMPLOYMENT_TYPES, OCCUPATION_CATEGORIES,
  ACCOMPLISHED_BY, statusColor, type Application, type ApplicationInput,
} from '../../lib/types'
import Alert from '../../components/Alert'

// ─────────────────────────────────────────────────────────
// Assistance tree (Section 22)
// ─────────────────────────────────────────────────────────
interface AssistanceNode {
  key: string
  label: string
  children?: AssistanceNode[]
}

const ASSISTANCE_TREE: AssistanceNode[] = [
  {
    key: 'assistive_devices',
    label: 'Assistive Devices',
    children: [
      { key: 'wheelchair', label: 'Wheelchair' },
      { key: 'crutches', label: 'Crutches' },
      { key: 'quad_cane', label: 'Quad Cane' },
      { key: 'single_cane', label: 'Single Cane' },
      { key: 'walker', label: 'Walker' },
      { key: 'stroller', label: 'Stroller' },
      { key: 'hearing_aid', label: 'Hearing Aid' },
      { key: 'prosthesis', label: 'Prosthesis (Artificial Leg)' },
      { key: 'external_leg_brace', label: 'External Leg Brace' },
    ],
  },
  {
    key: 'financial_assistance',
    label: 'Financial Assistance',
    children: [
      { key: 'hospitalization', label: 'Hospitalization' },
      { key: 'dialysis_chemo', label: 'Dialysis/Chemotherapy' },
      { key: 'reset_medical', label: 'Reset/Medical' },
      {
        key: 'therapy',
        label: 'Therapy',
        children: [
          { key: 'therapy_speech', label: 'Speech' },
          { key: 'therapy_occupational', label: 'Occupational' },
          { key: 'therapy_physical', label: 'Physical' },
        ],
      },
    ],
  },
  { key: 'neuro_dev_assessment', label: 'Neuro-Developmental Assessment' },
  {
    key: 'educational',
    label: 'Educational',
    children: [
      { key: 'tuition_subsidy', label: 'Tuition Subsidy' },
      { key: 'allowance', label: 'Allowance' },
      { key: 'materials_supplies', label: 'Materials/Supplies' },
    ],
  },
  { key: 'urgent_basic_needs', label: 'Urgent Basic Needs' },
  { key: 'burial', label: 'Burial' },
  {
    key: 'job_search',
    label: 'Financial Assistance for Job Searching',
    children: [
      { key: 'livelihood', label: 'Livelihood' },
      { key: 'training', label: 'Training (Social/Vocational)' },
      {
        key: 'rehabilitation',
        label: 'Rehabilitation',
        children: [
          { key: 'rehab_community', label: 'Community-based' },
          { key: 'rehab_institution', label: 'Institution-based' },
          { key: 'rehab_none', label: 'None' },
        ],
      },
      { key: 'job_placement', label: 'Job Placement' },
      { key: 'assistance_others', label: 'Others' },
    ],
  },
]

// ─────────────────────────────────────────────────────────
// Assistance source encoding
//
// Each entry in `assistance_received` / `assistance_needed` is a
// text[] element encoded as "govt:<leafKey>" or "ngo:<leafKey>".
// At most one entry per (source, top-level category) pair is stored.
// ─────────────────────────────────────────────────────────
type AssistanceSource = 'govt' | 'ngo'

const SOURCES: AssistanceSource[] = ['govt', 'ngo']
const SOURCE_LABEL: Record<AssistanceSource, string> = { govt: "Gov't", ngo: 'NGO' }
const SOURCE_PREFIX: Record<AssistanceSource, string> = { govt: 'govt:', ngo: 'ngo:' }

/** All leaf keys selected for a given source (prefix stripped). */
function getAssistanceSelection(arr: string[] | undefined, source: AssistanceSource): string[] {
  const prefix = SOURCE_PREFIX[source]
  return (arr ?? [])
    .filter((v): v is string => typeof v === 'string' && v.startsWith(prefix))
    .map((v) => v.slice(prefix.length))
}

/** Top-level ancestor of a leaf key — used as the "slot" identifier. */
function findTopLevelAncestor(
  targetKey: string,
  nodes: AssistanceNode[] = ASSISTANCE_TREE,
  currentTop: string | null = null
): string | null {
  for (const node of nodes) {
    const top = currentTop ?? node.key
    if (node.key === targetKey) return top
    if (node.children) {
      const found = findTopLevelAncestor(targetKey, node.children, top)
      if (found) return found
    }
  }
  return null
}

/**
 * Toggle a leaf for a source. Only one leaf per top-level category can be
 * selected per source; picking a different leaf in the same category replaces
 * the previous one. Clicking the already-selected leaf clears it.
 */
function setAssistanceSelection(
  arr: string[] | undefined,
  source: AssistanceSource,
  key: string
): string[] {
  const prefix = SOURCE_PREFIX[source]
  const current = arr ?? []
  const alreadySelected = current.includes(prefix + key)
  const topKey = findTopLevelAncestor(key)

  // Drop any existing entry for this source whose top-level category matches.
  const filtered = current.filter((v) => {
    if (typeof v !== 'string' || !v.startsWith(prefix)) return true
    const existingKey = v.slice(prefix.length)
    return findTopLevelAncestor(existingKey) !== topKey
  })

  if (alreadySelected) return filtered
  return [...filtered, prefix + key]
}

function isAssistanceEntry(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith(SOURCE_PREFIX.govt) || value.startsWith(SOURCE_PREFIX.ngo))
  )
}

/** Keeps only well-formed agency-prefixed entries. */
function normalizeAssist(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr.filter(isAssistanceEntry)
}

/** Resolve a leaf key to its human-readable label. */
function findAssistanceLabel(key: string, nodes: AssistanceNode[] = ASSISTANCE_TREE): string {
  for (const node of nodes) {
    if (node.key === key) return node.label
    if (node.children) {
      const found = findAssistanceLabel(key, node.children)
      if (found) return found
    }
  }
  return ''
}

// ─────────────────────────────────────────────────────────
// Locked LGU scope — Cauayan City, Isabela, Region 2
// ─────────────────────────────────────────────────────────
const LOCKED_MUNICIPALITY = 'Cauayan City'
const LOCKED_PROVINCE = 'ISABELA'
const LOCKED_REGION = 'Region 2'
const LOCKED_INPUT_STYLE = { backgroundColor: '#eef2f7', cursor: 'not-allowed' } as const

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'] as const

// helper: today's date in YYYY-MM-DD
const todayISO = () => new Date().toISOString().slice(0, 10)

const EMPTY: ApplicationInput = {
  application_type: 'New Applicant',
  pwd_number: '',
  date_applied: todayISO(),
  first_name: '', middle_name: '', last_name: '', suffix: '',
  birth_date: '', gender: '', civil_status: '', blood_type: '',
  address: '', barangay: '', municipality: LOCKED_MUNICIPALITY, province: LOCKED_PROVINCE, region: LOCKED_REGION,
  disability_types: [], disability_type: '',
  disability_cause_type: '', disability_cause_congenital: [], disability_cause_acquired: [],
  disability_cause_other_specify: '', disability_cause: '',
  educational_attainment: '', education: '',
  employment_status: '', employment_category: '', employment_type: '',
  occupation_category: '', occupation: '',
  organization_affiliated: '', organization_contact_person: '', organization_office_address: '', organization_tel_nos: '',
  sss_no: '', gsis_no: '', pag_ibig_no: '', psn_no: '', philhealth_no: '',
  landline_no: '', mobile_no: '', contact_number: '', email: '',
  father_last_name: '', father_first_name: '', father_middle_name: '',
  mother_last_name: '', mother_first_name: '', mother_middle_name: '',
  guardian_last_name: '', guardian_first_name: '', guardian_middle_name: '',
  emergency_name: '', emergency_relationship: '', emergency_contact_number: '', emergency_address: '',
  representative_name: '', representative_relationship: '', representative_contact: '',
  pwd_id_number: '', philsys_id: '', other_gov_id_type: '', other_gov_id_number: '',
  accomplished_by: 'Applicant', accomplished_last_name: '', accomplished_first_name: '', accomplished_middle_name: '',
  physician_name: '', physician_license_no: '',
  assistance_received: [], assistance_needed: [],
  assistance_received_source: '', assistance_needed_source: '',
}

function toApplicationInput(app: Application): ApplicationInput {
  const result: any = { ...EMPTY }
  for (const key of Object.keys(EMPTY) as (keyof ApplicationInput)[]) {
    const value = (app as any)[key]
    if (value !== null && value !== undefined) result[key] = value
  }
  result.assistance_received = normalizeAssist(result.assistance_received)
  result.assistance_needed = normalizeAssist(result.assistance_needed)
  result.municipality = LOCKED_MUNICIPALITY
  result.province = LOCKED_PROVINCE
  result.region = LOCKED_REGION
  result.assistance_received_source = ''
  result.assistance_needed_source = ''
  return result
}

const ACTIVE_STATUSES = ['Pending', 'Under Review', 'Approved', 'Ready for Pickup']
const REVISION_STATUS = 'Needs Revision'

type ArrayField =
  | 'disability_types'
  | 'disability_cause_congenital'
  | 'disability_cause_acquired'

type AssistanceField = 'assistance_received' | 'assistance_needed'

// ─────────────────────────────────────────────────────────
// Nominatim reverse geocode: lat/lng → barangay
// ─────────────────────────────────────────────────────────
interface NominatimAddress {
  barangay?: string
  quarter?: string
  neighbourhood?: string
  hamlet?: string
  suburb?: string
  village?: string
  city_district?: string
  town?: string
  city?: string
  municipality?: string
  county?: string
}

interface ReverseGeocodeResult {
  barangay: string
  city: string
}

async function reverseGeocodeBarangay(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Location lookup failed (${res.status})`)

  const data = await res.json()
  const a: NominatimAddress = data?.address ?? {}

  const barangay =
    a.barangay ||
    a.quarter ||
    a.neighbourhood ||
    a.hamlet ||
    a.suburb ||
    a.village ||
    a.city_district ||
    ''

  const city = a.city || a.town || a.municipality || a.county || ''

  return { barangay: barangay.trim(), city: city.trim() }
}

export default function ApplicationPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<ApplicationInput>(() => ({
    ...EMPTY,
    date_applied: todayISO(),
    email: profile?.email ?? '',
    first_name: profile?.fullname?.split(' ')[0] ?? '',
    last_name: profile?.fullname?.split(' ').slice(1).join(' ') ?? '',
  }))
  const [existing, setExisting] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showOtherDisability, setShowOtherDisability] = useState(false)

  // GPS state
  const [locating, setLocating] = useState(false)
  const [geoNote, setGeoNote] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('applications')
      .select('*')
      .eq('user_id', profile.id)
      .order('submission_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const app = data as Application | null
        setExisting(app)
        if (app && app.status === REVISION_STATUS) {
          setForm(toApplicationInput(app))
          if (app.disability_types && Array.isArray(app.disability_types)) {
            setShowOtherDisability(app.disability_types.includes('Other Disability'))
          }
        }
        setLoading(false)
      })
  }, [profile])

  const set = (field: keyof ApplicationInput, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const toggleArray = (field: ArrayField, value: string) => {
    setForm((f) => {
      const arr = (f[field] as string[] | undefined) ?? []
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      if (field === 'disability_types') setShowOtherDisability(next.includes('Other Disability'))
      return { ...f, [field]: next }
    })
  }

  /** Slot-aware single-select per source. */
  const selectAssistance = (
    field: AssistanceField,
    source: AssistanceSource,
    key: string
  ) => {
    setForm((f) => ({
      ...f,
      [field]: setAssistanceSelection(f[field] as string[] | undefined, source, key),
    }))
  }

  const clearAssistance = (field: AssistanceField, source: AssistanceSource) => {
    setForm((f) => ({
      ...f,
      [field]: setAssistanceSelection(f[field] as string[] | undefined, source, '__clear_all__'),
    }))
  }

  // ── GPS: get position → reverse geocode → fill barangay only ──
  const handleUseLocation = () => {
    setGeoNote(null)
    if (!('geolocation' in navigator)) {
      setGeoNote('Your browser does not support location services.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { barangay, city } = await reverseGeocodeBarangay(
            pos.coords.latitude,
            pos.coords.longitude
          )

          if (!barangay) {
            setGeoNote('We could not determine your barangay. Please type it in manually.')
            return
          }

          setForm((f) => ({ ...f, barangay }))

          const outsideScope = city && !city.toLowerCase().includes('cauayan')

          setGeoNote(
            outsideScope
              ? `Barangay "${barangay}" applied — but your location appears to be outside ${LOCKED_MUNICIPALITY}. Please verify.`
              : `Barangay "${barangay}" applied from your location. Please verify.`
          )
        } catch (err: any) {
          setGeoNote(err?.message ?? 'Could not look up your location. Please fill in the barangay manually.')
        } finally {
          setLocating(false)
        }
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoNote('Location permission denied. Please fill in the barangay manually.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoNote('Location unavailable. Please fill in the barangay manually.')
        } else if (err.code === err.TIMEOUT) {
          setGeoNote('Location request timed out. Please try again.')
        } else {
          setGeoNote('Could not get your location. Please fill in the barangay manually.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const isRenewal = form.application_type === 'Renewal'
  const pwdNumberDisabled = !isRenewal

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const required: (keyof ApplicationInput)[] = [
      'first_name', 'last_name', 'birth_date', 'gender', 'civil_status',
      'address', 'mobile_no', 'email',
      'physician_name', 'physician_license_no',
    ]
    for (const field of required) {
      const val = form[field]
      if (typeof val === 'string' && !val.trim()) {
        setError(`${field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} is required.`)
        return
      }
    }
    if (isRenewal && !form.pwd_number?.trim()) {
      setError('PWD number is required for renewal applications.')
      return
    }
    if (!form.disability_types || form.disability_types.length === 0) {
      setError('Please select at least one type of disability.')
      return
    }
    setSubmitting(true)
    const isRevision = existing?.status === REVISION_STATUS

    const payload: ApplicationInput = {
      ...form,
      municipality: LOCKED_MUNICIPALITY,
      province: LOCKED_PROVINCE,
      region: LOCKED_REGION,
      assistance_received_source: '',
      assistance_needed_source: '',
      assistance_received: normalizeAssist(form.assistance_received),
      assistance_needed: normalizeAssist(form.assistance_needed),
    }

    let appId: string
    if (isRevision && existing) {
      const { error } = await supabase
        .from('applications')
        .update({ ...payload, status: 'Pending', remarks: '', last_updated: new Date().toISOString() })
        .eq('id', existing.id)
      setSubmitting(false)
      if (error) { setError(error.message); return }
      appId = existing.id
    } else {
      const { data, error } = await supabase.from('applications').insert(payload).select().single()
      setSubmitting(false)
      if (error) { setError(error.message); return }
      appId = data.id
    }

    await supabase.from('status_logs').insert({
      application_id: appId,
      old_status: isRevision ? REVISION_STATUS : null,
      new_status: 'Pending',
      remarks: isRevision ? 'Resubmitted after revision' : 'Application submitted',
      changed_by: profile?.fullname ?? 'Applicant',
    })
    await supabase.from('notifications').insert({
      user_id: profile!.id,
      message: isRevision
        ? 'Your revised application has been resubmitted and is pending review.'
        : 'Your application has been submitted and is now pending review.',
      link: '/status',
    })
    setSuccess(isRevision ? 'Application resubmitted successfully!' : 'Application submitted successfully!')
    setTimeout(() => navigate('/status'), 1200)
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <div className="form-official-header">
          <div className="form-official-header-inner">
            <div className="text-center">
              <p className="form-official-republic">Republic of the Philippines</p>
              <p className="form-official-agency">DEPARTMENT OF HEALTH</p>
              <p className="form-official-region">Local Government Unit</p>
              <h4 className="form-official-title">PHILIPPINE REGISTRY FOR PERSONS WITH DISABILITIES</h4>
              <p className="form-official-subtitle">Application Form — Version 4.0 (Revised August 1, 2021)</p>
            </div>
          </div>
        </div>

        {error && <Alert variant="danger" message={error} />}
        {success && <Alert variant="success" message={success} />}

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
        ) : existing && ACTIVE_STATUSES.includes(existing.status) ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <i className="bi bi-info-circle-fill text-primary-pdao fs-4" />
                <div>
                  <h6 className="mb-1">You already have an active application (#{existing.id.slice(0, 8)})</h6>
                  <p className="text-muted mb-0">Status: <span className={`badge status-badge ${statusColor(existing.status)}`}>{existing.status}</span></p>
                </div>
                <button className="btn btn-soft ms-auto" onClick={() => navigate('/status')}>View status</button>
              </div>
            </div>
          </div>
        ) : (
          <>
          {existing?.status === REVISION_STATUS && (
            <div className="alert alert-warning d-flex gap-3 align-items-start mb-3">
              <i className="bi bi-exclamation-triangle-fill fs-5 mt-1 flex-shrink-0" />
              <div>
                <strong>Your application needs revision.</strong>
                <p className="mb-0 mt-1">
                  Please update the information below and resubmit.
                  {existing.remarks && (
                    <span className="d-block mt-1"><strong>Admin remarks:</strong> {existing.remarks}</span>
                  )}
                </p>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <FormCard icon="bi-clipboard-check" title="Application Details">
              <div className="row g-3">
                <FormCol md={4} label="Application type" required>
                  <select
                    className="form-select"
                    value={form.application_type}
                    onChange={(e) => {
                      const val = e.target.value
                      setForm((f) => ({
                        ...f,
                        application_type: val,
                        pwd_number: val === 'Renewal' ? f.pwd_number : '',
                      }))
                    }}
                  >
                    {APPLICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormCol>
                <FormCol md={4} label="PWD number (for renewal)">
                  <input
                    className="form-control"
                    value={form.pwd_number ?? ''}
                    onChange={(e) => set('pwd_number', e.target.value)}
                    placeholder={isRenewal ? 'DR-PPMNA-BBB-NNNNNNN' : '— select Renewal to enable —'}
                    disabled={pwdNumberDisabled}
                    style={pwdNumberDisabled ? LOCKED_INPUT_STYLE : undefined}
                  />
                </FormCol>
                <FormCol md={4} label="Date applied">
                  <input
                    type="date"
                    className="form-control"
                    value={form.date_applied ?? ''}
                    readOnly
                    style={LOCKED_INPUT_STYLE}
                  />
                </FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-person-vcard" title="Name of PWD">
              <div className="row g-3">
                <FormCol md={3} label="Last name" required>
                  <input className="form-control" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
                </FormCol>
                <FormCol md={3} label="First name" required>
                  <input className="form-control" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
                </FormCol>
                <FormCol md={3} label="Middle name">
                  <input className="form-control" value={form.middle_name ?? ''} onChange={(e) => set('middle_name', e.target.value)} />
                </FormCol>
                <FormCol md={3} label="Suffix">
                  <select
                    className="form-select"
                    value={form.suffix ?? ''}
                    onChange={(e) => set('suffix', e.target.value)}
                  >
                    {SUFFIX_OPTIONS.map((s) => (
                      <option key={s || 'none'} value={s}>{s || 'None'}</option>
                    ))}
                  </select>
                </FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-calendar-heart" title="Date of Birth & Sex">
              <div className="row g-3">
                <FormCol md={4} label="Date of birth" required>
                  <input type="date" className="form-control" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} required />
                </FormCol>
                <FormCol md={4} label="Sex" required>
                  <select className="form-select" value={form.gender} onChange={(e) => set('gender', e.target.value)} required>
                    <option value="">Select…</option>
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </FormCol>
                <FormCol md={4} label="Civil status" required>
                  <select className="form-select" value={form.civil_status} onChange={(e) => set('civil_status', e.target.value)} required>
                    <option value="">Select…</option>
                    {CIVIL_STATUS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormCol>
                <FormCol md={3} label="Blood type">
                  <select className="form-select" value={form.blood_type ?? ''} onChange={(e) => set('blood_type', e.target.value)}>
                    <option value="">Select…</option>
                    {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-geo-alt" title="Address">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={handleUseLocation}
                  disabled={locating}
                >
                  {locating ? (
                    <><span className="spinner-border spinner-border-sm me-1" /> Getting location…</>
                  ) : (
                    <><i className="bi bi-geo-alt-fill me-1" /> Use my current location</>
                  )}
                </button>
                <span className="text-muted small">
                  Fills in your barangay only — you can still type it manually.
                </span>
              </div>
              {geoNote && (
                <div className="small mb-2" style={{ color: '#0056b3' }}>
                  <i className="bi bi-info-circle me-1" />
                  {geoNote}
                </div>
              )}
              <div className="row g-3">
                <FormCol md={12} label="House no./Street/Purok" required>
                  <input className="form-control" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} required />
                </FormCol>
                <FormCol md={6} label="Barangay">
                  <input
                    className="form-control"
                    value={form.barangay ?? ''}
                    onChange={(e) => set('barangay', e.target.value)}
                    placeholder="Type or use your current location"
                  />
                </FormCol>
                <FormCol md={6} label="Municipality/City">
                  <input className="form-control" value={LOCKED_MUNICIPALITY} disabled readOnly style={LOCKED_INPUT_STYLE} />
                </FormCol>
                <FormCol md={6} label="Province">
                  <input className="form-control" value={LOCKED_PROVINCE} disabled readOnly style={LOCKED_INPUT_STYLE} />
                </FormCol>
                <FormCol md={6} label="Region">
                  <input className="form-control" value={LOCKED_REGION} disabled readOnly style={LOCKED_INPUT_STYLE} />
                </FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-heart-pulse" title="Type of Disability" subtitle="Check all that apply">
              <div className="row g-2">
                {DISABILITY_TYPES.map((d) => (
                  <div className="col-md-4 col-sm-6" key={d}>
                    <CheckboxRow
                      label={d}
                      checked={form.disability_types?.includes(d) ?? false}
                      onChange={() => toggleArray('disability_types', d)}
                    />
                  </div>
                ))}
              </div>
              {showOtherDisability && (
                <div className="mt-2">
                  <input className="form-control" placeholder="Specify other disability" value={form.disability_type ?? ''} onChange={(e) => set('disability_type', e.target.value)} />
                </div>
              )}
            </FormCard>

            <FormCard icon="bi-clipboard2-pulse" title="Cause of Disability">
              <div className="row g-3 mb-2">
                <div className="col-md-6">
                  <CheckboxRow
                    label="Congenital / Inborn"
                    checked={form.disability_cause_type === 'Congenital / Inborn'}
                    onChange={() => set('disability_cause_type', 'Congenital / Inborn')}
                    radio
                    name="disability-cause-type"
                  />
                </div>
                <div className="col-md-6">
                  <CheckboxRow
                    label="Acquired"
                    checked={form.disability_cause_type === 'Acquired'}
                    onChange={() => set('disability_cause_type', 'Acquired')}
                    radio
                    name="disability-cause-type"
                  />
                </div>
              </div>
              {form.disability_cause_type === 'Congenital / Inborn' && (
                <div className="row g-2">
                  {DISABILITY_CAUSE_CONGENITAL.map((c) => (
                    <div className="col-md-4 col-sm-6" key={c}>
                      <CheckboxRow
                        label={c}
                        checked={form.disability_cause_congenital?.includes(c) ?? false}
                        onChange={() => toggleArray('disability_cause_congenital', c)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {form.disability_cause_type === 'Acquired' && (
                <div className="row g-2">
                  {DISABILITY_CAUSE_ACQUIRED.map((c) => (
                    <div className="col-md-4 col-sm-6" key={c}>
                      <CheckboxRow
                        label={c}
                        checked={form.disability_cause_acquired?.includes(c) ?? false}
                        onChange={() => toggleArray('disability_cause_acquired', c)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {(form.disability_cause_congenital?.includes('Others (specify)') || form.disability_cause_acquired?.includes('Others (specify)')) && (
                <div className="mt-2">
                  <input className="form-control" placeholder="Specify other cause" value={form.disability_cause_other_specify ?? ''} onChange={(e) => set('disability_cause_other_specify', e.target.value)} />
                </div>
              )}
            </FormCard>

            <FormCard icon="bi-book" title="Educational Attainment">
              <div className="row g-3">
                <FormCol md={6} label="Highest educational attainment">
                  <select className="form-select" value={form.educational_attainment ?? ''} onChange={(e) => set('educational_attainment', e.target.value)}>
                    <option value="">Select…</option>
                    {EDUCATIONAL_ATTAINMENT.map((ed) => <option key={ed} value={ed}>{ed}</option>)}
                  </select>
                </FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-briefcase" title="Employment Status">
              <div className="row g-3">
                <FormCol md={4} label="Employment status">
                  <select className="form-select" value={form.employment_status ?? ''} onChange={(e) => set('employment_status', e.target.value)}>
                    <option value="">Select…</option>
                    {EMPLOYMENT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormCol>
                {form.employment_status && form.employment_status !== 'Unemployed' && (
                  <>
                    <FormCol md={4} label="Employment category">
                      <select className="form-select" value={form.employment_category ?? ''} onChange={(e) => set('employment_category', e.target.value)}>
                        <option value="">Select…</option>
                        {EMPLOYMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </FormCol>
                    <FormCol md={4} label="Employment type">
                      <select className="form-select" value={form.employment_type ?? ''} onChange={(e) => set('employment_type', e.target.value)}>
                        <option value="">Select…</option>
                        {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </FormCol>
                  </>
                )}
              </div>
            </FormCard>

            <FormCard icon="bi-people" title="Occupation Category">
              <div className="row g-3">
                <FormCol md={8} label="Occupation category">
                  <select className="form-select" value={form.occupation_category ?? ''} onChange={(e) => set('occupation_category', e.target.value)}>
                    <option value="">Select…</option>
                    {OCCUPATION_CATEGORIES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormCol>
                <FormCol md={4} label="Specific occupation">
                  <input className="form-control" value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} />
                </FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-building" title="Organization Affiliated With" subtitle="If applicable">
              <div className="row g-3">
                <FormCol md={6} label="Organization name">
                  <input className="form-control" value={form.organization_affiliated ?? ''} onChange={(e) => set('organization_affiliated', e.target.value)} />
                </FormCol>
                <FormCol md={6} label="Contact person">
                  <input className="form-control" value={form.organization_contact_person ?? ''} onChange={(e) => set('organization_contact_person', e.target.value)} />
                </FormCol>
                <FormCol md={8} label="Office address">
                  <input className="form-control" value={form.organization_office_address ?? ''} onChange={(e) => set('organization_office_address', e.target.value)} />
                </FormCol>
                <FormCol md={4} label="Telephone numbers">
                  <input className="form-control" value={form.organization_tel_nos ?? ''} onChange={(e) => set('organization_tel_nos', e.target.value)} />
                </FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-credit-card-2-front" title="ID Reference Numbers" subtitle="Fill in what you have">
              <div className="row g-3">
                <FormCol md={3} label="SSS No."><input className="form-control" value={form.sss_no ?? ''} onChange={(e) => set('sss_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="GSIS No."><input className="form-control" value={form.gsis_no ?? ''} onChange={(e) => set('gsis_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="Pag-IBIG No."><input className="form-control" value={form.pag_ibig_no ?? ''} onChange={(e) => set('pag_ibig_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="PSN No."><input className="form-control" value={form.psn_no ?? ''} onChange={(e) => set('psn_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="PhilHealth No."><input className="form-control" value={form.philhealth_no ?? ''} onChange={(e) => set('philhealth_no', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-telephone" title="Contact Details">
              <div className="row g-3">
                <FormCol md={3} label="Landline No."><input type="tel" className="form-control" value={form.landline_no ?? ''} onChange={(e) => set('landline_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="Mobile No." required><input type="tel" className="form-control" value={form.mobile_no ?? ''} onChange={(e) => set('mobile_no', e.target.value)} required /></FormCol>
                <FormCol md={6} label="Email" required><input type="email" className="form-control" value={form.email} onChange={(e) => set('email', e.target.value)} required /></FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-people-fill" title="Family Background">
              <div className="row g-3">
                <div className="col-12"><p className="form-subgroup-label">Father's Name</p></div>
                <FormCol md={4} label="Last name"><input className="form-control" value={form.father_last_name ?? ''} onChange={(e) => set('father_last_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="First name"><input className="form-control" value={form.father_first_name ?? ''} onChange={(e) => set('father_first_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="Middle name"><input className="form-control" value={form.father_middle_name ?? ''} onChange={(e) => set('father_middle_name', e.target.value)} /></FormCol>
                <div className="col-12 mt-2"><p className="form-subgroup-label">Mother's Maiden Name</p></div>
                <FormCol md={4} label="Last name"><input className="form-control" value={form.mother_last_name ?? ''} onChange={(e) => set('mother_last_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="First name"><input className="form-control" value={form.mother_first_name ?? ''} onChange={(e) => set('mother_first_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="Middle name"><input className="form-control" value={form.mother_middle_name ?? ''} onChange={(e) => set('mother_middle_name', e.target.value)} /></FormCol>
                <div className="col-12 mt-2"><p className="form-subgroup-label">Guardian's Name (if applicable)</p></div>
                <FormCol md={4} label="Last name"><input className="form-control" value={form.guardian_last_name ?? ''} onChange={(e) => set('guardian_last_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="First name"><input className="form-control" value={form.guardian_first_name ?? ''} onChange={(e) => set('guardian_first_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="Middle name"><input className="form-control" value={form.guardian_middle_name ?? ''} onChange={(e) => set('guardian_middle_name', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-telephone-plus" title="Emergency Contact Information">
              <div className="row g-3">
                <FormCol md={4} label="Name"><input className="form-control" value={form.emergency_name ?? ''} onChange={(e) => set('emergency_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="Relationship"><input className="form-control" value={form.emergency_relationship ?? ''} onChange={(e) => set('emergency_relationship', e.target.value)} /></FormCol>
                <FormCol md={4} label="Contact number"><input type="tel" className="form-control" value={form.emergency_contact_number ?? ''} onChange={(e) => set('emergency_contact_number', e.target.value)} /></FormCol>
                <FormCol md={12} label="Address"><input className="form-control" value={form.emergency_address ?? ''} onChange={(e) => set('emergency_address', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-card-checklist" title="Government ID Numbers" subtitle="Provide any government-issued ID">
              <div className="row g-3">
                <FormCol md={4} label="PWD ID No. (if any)"><input className="form-control" value={form.pwd_id_number ?? ''} onChange={(e) => set('pwd_id_number', e.target.value)} /></FormCol>
                <FormCol md={4} label="PhilSys ID"><input className="form-control" value={form.philsys_id ?? ''} onChange={(e) => set('philsys_id', e.target.value)} /></FormCol>
                <FormCol md={2} label="Other ID type"><input className="form-control" value={form.other_gov_id_type ?? ''} onChange={(e) => set('other_gov_id_type', e.target.value)} /></FormCol>
                <FormCol md={2} label="Other ID number"><input className="form-control" value={form.other_gov_id_number ?? ''} onChange={(e) => set('other_gov_id_number', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-pen" title="Accomplished By">
              <div className="row g-3">
                <FormCol md={4} label="Accomplished by">
                  <select className="form-select" value={form.accomplished_by ?? 'Applicant'} onChange={(e) => set('accomplished_by', e.target.value)}>
                    {ACCOMPLISHED_BY.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </FormCol>
                <FormCol md={3} label="Last name"><input className="form-control" value={form.accomplished_last_name ?? ''} onChange={(e) => set('accomplished_last_name', e.target.value)} /></FormCol>
                <FormCol md={3} label="First name"><input className="form-control" value={form.accomplished_first_name ?? ''} onChange={(e) => set('accomplished_first_name', e.target.value)} /></FormCol>
                <FormCol md={2} label="Middle name"><input className="form-control" value={form.accomplished_middle_name ?? ''} onChange={(e) => set('accomplished_middle_name', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            <FormCard icon="bi-person-doctor" title="Certifying Physician">
              <div className="row g-3">
                <FormCol md={8} label="Physician's name" required>
                  <input className="form-control" value={form.physician_name ?? ''} onChange={(e) => set('physician_name', e.target.value)} required />
                </FormCol>
                <FormCol md={4} label="License No." required>
                  <input className="form-control" value={form.physician_license_no ?? ''} onChange={(e) => set('physician_license_no', e.target.value)} required />
                </FormCol>
              </div>
            </FormCard>

            {/* ───────── Section 22: Assistance Received / Needed / Rehabilitation ───────── */}
            <FormCard
              icon="bi-clipboard2-heart"
              title="Assistance Received / Needed / Rehabilitation"
              subtitle="Select one item per category, per agency. Gov't and NGO are independent — you may pick one item in each category for each agency."
            >
              <div className="row g-4">
                <div className="col-lg-6">
                  <AssistanceColumn
                    title="Received"
                    icon="bi-box-arrow-in-down"
                    variant="received"
                    values={form.assistance_received ?? []}
                    onSelect={(source, key) => selectAssistance('assistance_received', source, key)}
                    onClear={(source) => clearAssistance('assistance_received', source)}
                  />
                </div>

                <div className="col-lg-6">
                  <AssistanceColumn
                    title="Needed"
                    icon="bi-hand-index-thumb"
                    variant="needed"
                    values={form.assistance_needed ?? []}
                    onSelect={(source, key) => selectAssistance('assistance_needed', source, key)}
                    onClear={(source) => clearAssistance('assistance_needed', source)}
                  />
                </div>
              </div>
            </FormCard>

            <div className="d-flex justify-content-end gap-2 mt-2">
              <button type="button" className="btn btn-soft" onClick={() => navigate('/dashboard')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting
                  ? <><span className="spinner-border spinner-border-sm me-1" /> Submitting…</>
                  : existing?.status === REVISION_STATUS
                    ? <><i className="bi bi-arrow-repeat me-1" /> Resubmit application</>
                    : <><i className="bi bi-send me-1" /> Submit application</>
                }
              </button>
            </div>
          </form>
          </>
        )}
      </div>

      <style>{`
        .form-official-header {
          background: linear-gradient(135deg, #003d80, #0056b3);
          border-radius: 0.8rem; padding: 1.5rem; margin-bottom: 1.5rem;
        }
        .form-official-header-inner { color: #fff; }
        .form-official-republic { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0; opacity: 0.85; color: #fff; }
        .form-official-agency { font-size: 1rem; font-weight: 700; margin-bottom: 0; color: #fff; }
        .form-official-region { font-size: 0.85rem; margin-bottom: 0.8rem; opacity: 0.85; color: #fff; }
        .form-official-title { font-weight: 800; font-size: 1.3rem; margin-bottom: 0.3rem; color: #fff !important; }
        .form-official-title:hover,
        .form-official-title:focus,
        .form-official-title:active { color: #fff !important; }
        .form-official-subtitle { font-size: 0.82rem; opacity: 0.8; margin-bottom: 0; color: #fff; }
        .form-subgroup-label { font-weight: 700; font-size: 0.85rem; color: #0056b3; margin-bottom: 0.2rem; text-transform: uppercase; letter-spacing: 0.5px; }

        .form-label { font-weight: 700; font-size: 0.85rem; color: #1a2a44; }

        .checkbox-row {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.4rem 0.65rem; border-radius: 0.4rem; cursor: pointer;
          border: 1px solid #e4e9f0; transition: all 0.15s ease;
          background: #fff; font-size: 0.85rem; margin-right: 0.4rem; margin-bottom: 0.35rem;
        }
        .checkbox-row:hover { border-color: #b8d4f0; background: #f5f9ff; }
        .checkbox-row.checked { border-color: #0056b3; background: rgba(0, 86, 179, 0.06); }
        .checkbox-row input { width: 16px; height: 16px; cursor: pointer; margin: 0; }

        .assistance-col-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0.6rem 0.9rem;
          border-radius: 0.5rem;
          margin-bottom: 0.85rem;
        }
        .assistance-col-header.received {
          background: linear-gradient(135deg, rgba(0, 86, 179, 0.12), rgba(0, 86, 179, 0.04));
          color: #0056b3;
          border-left: 4px solid #0056b3;
        }
        .assistance-col-header.needed {
          background: linear-gradient(135deg, rgba(220, 53, 69, 0.12), rgba(220, 53, 69, 0.04));
          color: #b02a37;
          border-left: 4px solid #b02a37;
        }

        .source-tabs {
          display: inline-flex;
          gap: 0.25rem;
          padding: 0.25rem;
          background: #eef2f7;
          border-radius: 0.5rem;
        }
        .source-tab {
          display: inline-flex;
          align-items: center;
          border: none;
          background: transparent;
          padding: 0.35rem 1rem;
          border-radius: 0.35rem;
          font-size: 0.85rem;
          font-weight: 700;
          color: #5a6b85;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .source-tab:hover { color: #0056b3; }
        .source-tab.active {
          background: #fff;
          color: #0056b3;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }
        .source-tab .source-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.2rem;
          height: 1.2rem;
          padding: 0 0.35rem;
          border-radius: 999px;
          background: #0056b3;
          color: #fff;
          font-size: 0.7rem;
          margin-left: 0.4rem;
        }
        .source-tab.active .source-count { background: #0056b3; }

        .assistance-selection { min-height: 1.25rem; }
        .assistance-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .assistance-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.6rem;
          background: #f1f7ff;
          border: 1px solid #c7dcf5;
          border-radius: 999px;
          font-size: 0.78rem;
          color: #0056b3;
        }
        .assistance-chip .chip-cat {
          font-weight: 700;
        }
        .assistance-chip .chip-sep { color: #8fb3dc; }
        .assistance-chip .chip-x {
          border: none;
          background: transparent;
          color: #0056b3;
          font-size: 0.85rem;
          line-height: 1;
          padding: 0;
          cursor: pointer;
        }
        .assistance-chip .chip-x:hover { color: #b02a37; }

        .assistance-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.7rem;
          border: 1px solid #e4e9f0;
          border-radius: 0.4rem;
          background: #fff;
          cursor: pointer;
          font-size: 0.87rem;
          font-weight: 700;
          transition: all 0.15s ease;
          user-select: none;
        }
        .assistance-toggle:hover {
          border-color: #b8d4f0;
          background: #f5f9ff;
        }
        .assistance-toggle.open {
          border-color: #0056b3;
          background: rgba(0, 86, 179, 0.05);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        .assistance-toggle.checked {
          border-color: #0056b3;
          background: rgba(0, 86, 179, 0.06);
        }
        .assistance-caret {
          font-size: 0.8rem;
          color: #0056b3;
          transition: transform 0.15s ease;
        }
        .assistance-toggle-label { flex: 1; }

        .assistance-dropdown {
          border: 1px solid #0056b3;
          border-top: none;
          border-bottom-left-radius: 0.4rem;
          border-bottom-right-radius: 0.4rem;
          padding: 0.6rem 0.75rem;
          background: #fbfdff;
        }
        .assistance-children { padding-left: 0.5rem; }
      `}</style>
    </AppLayout>
  )
}

// ─────────── UNTOUCHED COMPONENTS ───────────

function FormCard({ icon, title, subtitle, children }: { icon: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="card mb-3">
      <div className="card-body">
        <h5 className="form-section-title"><i className={`bi ${icon}`} /> {title}</h5>
        {subtitle && <p className="text-muted small mb-3">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

function FormCol({ md, label, required, children }: { md: number; label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className={`col-md-${md}`}>
      <label className="form-label">{label}{required && <span className="text-danger"> *</span>}</label>
      {children}
    </div>
  )
}

function CheckboxRow({
  label,
  checked,
  onChange,
  radio,
  name,
}: {
  label: string
  checked: boolean
  onChange: () => void
  radio?: boolean
  name?: string
}) {
  return (
    <label className={`checkbox-row ${checked ? 'checked' : ''}`}>
      <input type={radio ? 'radio' : 'checkbox'} name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  )
}

// ─────────── Assistance column (one per "Received" / "Needed") ───────────

function AssistanceColumn({
  title,
  icon,
  variant,
  values,
  onSelect,
  onClear,
}: {
  title: string
  icon: string
  variant: 'received' | 'needed'
  values: string[]
  onSelect: (source: AssistanceSource, key: string) => void
  onClear: (source: AssistanceSource) => void
}) {
  const [source, setSource] = useState<AssistanceSource>('govt')

  const selectedKeys = getAssistanceSelection(values, source)
  const countFor = (s: AssistanceSource) => getAssistanceSelection(values, s).length

  const removeOne = (key: string) => onSelect(source, key) // re-selecting toggles it off

  const labelFor = (key: string) => findAssistanceLabel(key)
  const slotLabelFor = (key: string) => {
    const top = findTopLevelAncestor(key)
    return top ? findAssistanceLabel(top) : ''
  }

  return (
    <div className="assistance-column">
      <div className={`assistance-col-header ${variant}`}>
        <i className={`bi ${icon}`} />
        <span>{title}</span>
      </div>

      <div className="source-tabs mb-3" role="tablist" aria-label={`${title} — assistance source`}>
        {SOURCES.map((s) => {
          const active = source === s
          const count = countFor(s)
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              className={`source-tab ${active ? 'active' : ''}`}
              onClick={() => setSource(s)}
            >
              <span>{SOURCE_LABEL[s]}</span>
              {count > 0 && <span className="source-count" aria-label={`${count} selected`}>{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="assistance-selection mb-2">
        {selectedKeys.length > 0 ? (
          <>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small">Selected for {SOURCE_LABEL[source]}:</span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0"
                onClick={() => onClear(source)}
              >
                Clear all
              </button>
            </div>
            <div className="assistance-chips">
              {selectedKeys.map((key) => (
                <span key={key} className="assistance-chip">
                  <span className="chip-cat">{slotLabelFor(key)}</span>
                  <span className="chip-sep">·</span>
                  <span>{labelFor(key)}</span>
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Remove ${labelFor(key)}`}
                    onClick={() => removeOne(key)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </>
        ) : (
          <span className="text-muted small">
            No items selected for {SOURCE_LABEL[source]}. Choose one per category below.
          </span>
        )}
      </div>

      <AssistanceTree
        nodes={ASSISTANCE_TREE}
        values={selectedKeys}
        onSelect={(key) => onSelect(source, key)}
        name={`assistance-${variant}-${source}`}
      />
    </div>
  )
}

// ─────────── Assistance tree (single-select per top-level category) ───────────

function AssistanceTree({
  nodes,
  values,
  onSelect,
  name,
  depth = 0,
  topKey,
}: {
  nodes: AssistanceNode[]
  values: string[]
  onSelect: (key: string) => void
  name: string
  depth?: number
  topKey?: string
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const toggleOpen = (key: string) =>
    setOpen((o) => ({ ...o, [key]: !o[key] }))

  const hasAnySelected = (node: AssistanceNode): boolean => {
    if (values.includes(node.key)) return true
    return !!node.children?.some(hasAnySelected)
  }

  return (
    <div className={depth > 0 ? 'assistance-children' : ''}>
      {nodes.map((node) => {
        const hasChildren = !!node.children?.length
        const isOpen = !!open[node.key]
        const isChecked = values.includes(node.key)
        const childSelected = hasChildren && hasAnySelected(node)
        // The top-level key this node belongs to (its own key if depth 0).
        const nodeTopKey = topKey ?? node.key
        // Radio group name is unique per (source, variant, top-level category).
        const groupName = `${name}__${nodeTopKey}`

        return (
          <div key={node.key} className="assistance-node mb-1">
            {hasChildren ? (
              <>
                <div
                  className={`assistance-toggle ${isOpen ? 'open' : ''} ${childSelected ? 'checked' : ''}`}
                  onClick={() => toggleOpen(node.key)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleOpen(node.key)
                    }
                  }}
                >
                  <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} assistance-caret`} />
                  <span className="assistance-toggle-label">{node.label}</span>
                  {childSelected && (
                    <i
                      className="bi bi-check-circle-fill"
                      style={{ color: '#0056b3', fontSize: '0.9rem' }}
                      title="One item selected in this category"
                      aria-hidden="true"
                    />
                  )}
                </div>

                {isOpen && (
                  <div className="assistance-dropdown">
                    <AssistanceTree
                      nodes={node.children!}
                      values={values}
                      onSelect={onSelect}
                      name={name}
                      depth={depth + 1}
                      topKey={nodeTopKey}
                    />
                  </div>
                )}
              </>
            ) : (
              <CheckboxRow
                label={node.label}
                radio
                name={groupName}
                checked={isChecked}
                onChange={() => onSelect(node.key)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}