import { useEffect, useState, FormEvent, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import Alert from '../../components/Alert'
import DocumentReviewModal from '../../components/DocumentReviewModal'
import { ADMIN_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  statusColor,
  docStatusBadge,
  DOC_STATUS_LABEL,
  fmtDateTime,
  prettyDocType,
  ALL_STATUSES,
  appFullName,
  type Application,
  type StatusLog,
  type DocumentRow,
  type DocumentStatus,
} from '../../lib/types'
import { exportApplicationFormPDF } from '../../lib/formExport'
import emailjs from '@emailjs/browser'

const DISABILITY_TYPES = [
  'Deaf or Hard of Hearing',
  'Intellectual Disability',
  'Learning Disability',
  'Mental Disability',
  'Physical Disability (Orthopedic)',
  'Psychosocial Disability',
  'Speech and Language Impairment',
  'Visual Disability',
  'Cancer (RA 11215)',
  'Rare Disease (RA 10747)',
  'Others',
]

const CONGENITAL_CAUSES = ['ADHD', 'Cerebral Palsy', 'Down Syndrome', 'Others']
const ACQUIRED_CAUSES = ['Chronic Illness', 'Cerebral Palsy', 'Injury', 'Others']

// ─────────────────────────────────────────────────────────
// Assistance tree — must match the client-side form exactly
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
// Assistance helpers — new format is `govt:<leafKey>` / `ngo:<leafKey>`
// ─────────────────────────────────────────────────────────
type AssistanceSource = 'govt' | 'ngo'
const SOURCES: AssistanceSource[] = ['govt', 'ngo']
const SOURCE_LABEL: Record<AssistanceSource, string> = { govt: "Gov't", ngo: 'NGO' }
const SOURCE_PREFIX: Record<AssistanceSource, string> = { govt: 'govt:', ngo: 'ngo:' }

function parseAssistance(arr: string[]): Record<AssistanceSource, string[]> {
  const out: Record<AssistanceSource, string[]> = { govt: [], ngo: [] }
  for (const v of arr) {
    if (typeof v !== 'string') continue
    if (v.startsWith(SOURCE_PREFIX.govt)) out.govt.push(v.slice(SOURCE_PREFIX.govt.length))
    else if (v.startsWith(SOURCE_PREFIX.ngo)) out.ngo.push(v.slice(SOURCE_PREFIX.ngo.length))
  }
  return out
}

function findAssistanceLabel(key: string, nodes: AssistanceNode[] = ASSISTANCE_TREE): string {
  for (const n of nodes) {
    if (n.key === key) return n.label
    if (n.children) {
      const f = findAssistanceLabel(key, n.children)
      if (f) return f
    }
  }
  return key
}

function findAssistanceCategory(
  key: string,
  nodes: AssistanceNode[] = ASSISTANCE_TREE,
  current: string | null = null
): string {
  for (const n of nodes) {
    const top = current ?? n.label
    if (n.key === key) return top
    if (n.children) {
      const f = findAssistanceCategory(key, n.children, top)
      if (f) return f
    }
  }
  return ''
}

// ─────────────────────────────────────────────────────────
// Section IDs — every collapsible block on the page
// ─────────────────────────────────────────────────────────
const FORM_SECTIONS = [
  'app-type', 'personal', 'disability', 'cause', 'address', 'contact',
  'education', 'employment', 'occupation', 'organization', 'ids',
  'family', 'emergency', 'accomplished', 'physician', 'assistance',
] as const

const PAGE_SECTIONS = ['documents', 'history', 'status-panel'] as const

const ALL_SECTION_IDS = [...FORM_SECTIONS, ...PAGE_SECTIONS]

const DEFAULT_OPEN = new Set<string>(['personal', 'disability', 'assistance', 'documents', 'status-panel'])

const dash = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v : '—'

// ─────────────────────────────────────────────────────────
// EmailJS — default message per status (used when the admin
// does not provide a custom email message).
// ─────────────────────────────────────────────────────────
const STATUS_EMAIL_MESSAGES: Record<string, string> = {
  Approved: 'Congratulations! Your PWD application has been approved.',
  Rejected:
    'We regret to inform you that your application has been rejected. Please review the remarks below.',
  'Needs Revision':
    'Your application needs some revisions before it can be processed. Please review the remarks below and resubmit.',
  'Ready for Pickup':
    'Your PWD ID is now ready for pickup at the PDAO office.',
}

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [app, setApp] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [logs, setLogs] = useState<StatusLog[]>([])
  const [loading, setLoading] = useState(true)
  const [newStatus, setNewStatus] = useState('')
  const [remarks, setRemarks] = useState('')
  // Knob 2 — admin-editable one-time email body. Not persisted.
  const [customEmailMessage, setCustomEmailMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reviewing, setReviewing] = useState<DocumentRow | null>(null)
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(DEFAULT_OPEN))

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: a } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      const appData = a as Application | null
      setApp(appData)
      setNewStatus(appData?.status ?? 'Pending')
      setRemarks(appData?.remarks ?? '')
      if (appData) {
        const [d, l] = await Promise.all([
          supabase
            .from('documents')
            .select('*')
            .eq('application_id', appData.id)
            .order('uploaded_at', { ascending: false }),
          supabase
            .from('status_logs')
            .select('*')
            .eq('application_id', appData.id)
            .order('created_at', { ascending: false }),
        ])
        setDocuments((d.data ?? []) as DocumentRow[])
        setLogs((l.data ?? []) as StatusLog[])
      }
      setLoading(false)
    })()
  }, [id])

  const toggleSection = (sid: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })

  const expandAll = () => setOpenSections(new Set(ALL_SECTION_IDS))
  const collapseAll = () => setOpenSections(new Set())

  const updateStatus = async (e?: FormEvent, status?: string) => {
    e?.preventDefault()
    if (!app || !profile) return
    const target = status ?? newStatus
    if (!ALL_STATUSES.includes(target as any)) return

    // Require remarks for negative statuses so the applicant knows WHY
    const requiresRemarks = target === 'Rejected' || target === 'Needs Revision'
    if (requiresRemarks && !remarks.trim()) {
      setError(
        `Please provide remarks explaining why this application is "${target}".`
      )
      return
    }

    setSaving(true)
    setError(null)
    const old = app.status

    const { error: uErr } = await supabase
      .from('applications')
      .update({ status: target, remarks, last_updated: new Date().toISOString() })
      .eq('id', app.id)
    if (uErr) {
      setError(uErr.message)
      setSaving(false)
      return
    }

    await supabase.from('status_logs').insert({
      application_id: app.id,
      old_status: old,
      new_status: target,
      remarks,
      changed_by: profile.fullname,
    })

    const msgMap: Record<string, string> = {
      'Under Review': 'Your application is now under review.',
      'Needs Revision': 'Your application needs revision. Please see remarks.',
      Approved: 'Congratulations! Your application has been approved.',
      Rejected: 'Your application has been rejected. See remarks for details.',
      'Ready for Pickup': 'Your PWD ID is ready for pickup at the PDAO office.',
      Pending: 'Your application status was reset to Pending.',
    }

    // In-app notification (include remarks if present)
    const baseMessage = msgMap[target] ?? `Application status updated to ${target}.`
    const notifMessage = remarks.trim()
      ? `${baseMessage} Remarks: ${remarks.trim()}`
      : baseMessage

    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: app.user_id,
      title: `Application ${target}`,
      message: notifMessage,
      link: '/status',
      type: 'status_update',
    })
    if (notifErr) {
      console.error('NOTIF INSERT FAILED:', notifErr)
    }

    // ── Send status-update email via EmailJS (separate account) ──
    // Single dynamic template — pass status-specific values as variables.
    try {
      const emailBody =
        customEmailMessage.trim() ||
        STATUS_EMAIL_MESSAGES[target] ||
        `Your application status is now ${target}.`

      // Debug — remove once confirmed working
      console.log('EMAILJS DEBUG', {
        service: import.meta.env.VITE_EMAILJS_STATUS_SERVICE_ID,
        template: import.meta.env.VITE_EMAILJS_STATUS_TEMPLATE_ID,
        key: import.meta.env.VITE_EMAILJS_STATUS_PUBLIC_KEY,
      })

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_STATUS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_STATUS_TEMPLATE_ID,
        {
          to_email: app.email,
          applicant_name: appFullName(app),
          status: target,
          message: emailBody,
          remarks: remarks || '',
        },
        import.meta.env.VITE_EMAILJS_STATUS_PUBLIC_KEY
      )
    } catch (emailErr) {
      // Don't block status update if email fails
      console.error('Failed to send status email:', emailErr)
      setError(
        'Status updated successfully, but the email notification could not be sent.'
      )
    }

    setApp({ ...app, status: target as any, remarks })
    setCustomEmailMessage('') // clear one-time message
    setSaving(false)
    const { data: newLogs } = await supabase
      .from('status_logs')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setLogs((newLogs ?? []) as StatusLog[])
  }

  const viewDocument = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60 * 5)
    if (error || !data) {
      setError(`Could not open ${doc.filename}: ${error?.message ?? 'unknown error'}`)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  const handleDocReviewed = (updated: DocumentRow) => {
    setDocuments((docs) => docs.map((d) => (d.id === updated.id ? updated : d)))
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
  if (!app) {
    return (
      <AppLayout navItems={ADMIN_NAV}>
        <Alert variant="danger" message="Application not found." />
      </AppLayout>
    )
  }

  const getArray = (field: string): string[] => {
    const val = (app as any)[field]
    return Array.isArray(val) ? val : []
  }

  const pendingCount = documents.filter((d) => d.status === 'pending').length
  const anyOpen = openSections.size > 0

  const disabilityArr = getArray('disability_types')
  const receivedArr = getArray('assistance_received')
  const neededArr = getArray('assistance_needed')
  const receivedParsed = parseAssistance(receivedArr)
  const neededParsed = parseAssistance(neededArr)
  const receivedCount = receivedParsed.govt.length + receivedParsed.ngo.length
  const neededCount = neededParsed.govt.length + neededParsed.ngo.length
  const idCount = [
    'sss_no', 'gsis_no', 'pag_ibig_no', 'philhealth_no', 'psn_no',
    'pwd_id_number', 'philsys_id', 'other_gov_id_number',
  ].filter((k) => (app as any)[k]?.toString().trim()).length

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        {/* ── Page header ── */}
        <div className="applicant-header mb-3">
          <div className="applicant-header-left">
            <Link to="/admin/applicants" className="small text-muted">
              <i className="bi bi-arrow-left" /> Back to applicants
            </Link>
            <h3 className="mt-1 mb-1">
              Applicant #{app.id.slice(0, 8)}
            </h3>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className={`badge status-badge ${statusColor(app.status)}`}>
                {app.status}
              </span>
              {pendingCount > 0 && (
                <span className="badge bg-warning text-dark">
                  <i className="bi bi-hourglass-split me-1" />
                  {pendingCount} document{pendingCount > 1 ? 's' : ''} awaiting review
                </span>
              )}
            </div>
          </div>

          <div className="applicant-header-actions">
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-soft"
                onClick={expandAll}
                disabled={openSections.size === ALL_SECTION_IDS.length}
              >
                <i className="bi bi-arrows-expand me-1" /> Expand all
              </button>
              <button
                type="button"
                className="btn btn-soft"
                onClick={collapseAll}
                disabled={!anyOpen}
              >
                <i className="bi bi-arrows-collapse me-1" /> Collapse all
              </button>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => exportApplicationFormPDF(app)}
            >
              <i className="bi bi-file-pdf me-1" /> Export PDF
            </button>
          </div>
        </div>

        {error && <Alert variant="danger" message={error} />}

        <div className="row g-3">
          <div className="col-lg-8">
            {/* ── Form card ── */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header">
                <i className="bi bi-file-earmark-medical text-primary-pdao me-1" />
                Philippine Registry for Persons with Disabilities (PWD) Form v4.0
              </div>

              <div className="card-body p-3">
                <AccordionSection
                  id="app-type" number={1} title="Application Type"
                  summary={`${dash((app as any).application_type)} · Applied ${dash((app as any).date_applied)}`}
                  isOpen={openSections.has('app-type')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={4} label="Application Type" type="select"
                      options={['New Applicant', 'Renewal']}
                      value={(app as any).application_type} />
                    <FormField md={4} label="PWD Number" value={(app as any).pwd_number} />
                    <FormField md={4} label="Date Applied" type="date" value={(app as any).date_applied} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="personal" number={2} title="Personal Information"
                  summary={`${dash(app.last_name)}, ${dash(app.first_name)} ${app.middle_name ?? ''} ${app.suffix ?? ''} · ${dash(app.gender)} · ${dash(app.birth_date)}`.trim()}
                  isOpen={openSections.has('personal')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={3} label="Last Name" value={app.last_name} />
                    <FormField md={3} label="First Name" value={app.first_name} />
                    <FormField md={3} label="Middle Name" value={app.middle_name} />
                    <FormField md={3} label="Suffix" value={app.suffix} />
                    <FormField md={3} label="Birth Date" type="date" value={app.birth_date} />
                    <FormField md={3} label="Gender" type="select"
                      options={['Male', 'Female', 'Other']} value={app.gender} />
                    <FormField md={3} label="Civil Status" type="select"
                      options={['Single', 'Married', 'Widowed', 'Separated', 'Divorced']}
                      value={app.civil_status} />
                    <FormField md={3} label="Blood Type" value={app.blood_type} />
                    <FormField md={6} label="Email" type="email" value={app.email} />
                    <FormField md={6} label="Contact Number"
                      value={app.contact_number || (app as any).mobile_no} />
                    <FormField md={12} label="Complete Address" value={app.address} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="disability" number={3} title="Type of Disability"
                  summary={
                    disabilityArr.length
                      ? `${disabilityArr.length} selected · ${disabilityArr.slice(0, 2).join(', ')}${disabilityArr.length > 2 ? '…' : ''}`
                      : 'None selected'
                  }
                  isOpen={openSections.has('disability')} onToggle={toggleSection}
                >
                  <CheckboxGroup options={DISABILITY_TYPES} selected={disabilityArr} />
                  {(app as any).disability_type && (
                    <div className="mt-2 small">
                      <strong>Other:</strong> {(app as any).disability_type}
                    </div>
                  )}
                </AccordionSection>

                <AccordionSection
                  id="cause" number={4} title="Cause of Disability"
                  summary={dash((app as any).disability_cause_type)}
                  isOpen={openSections.has('cause')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={4} label="Cause Type" type="select"
                      options={['Congenital / Inborn', 'Acquired']}
                      value={(app as any).disability_cause_type} />
                    <div className="col-md-4">
                      <label className="form-label">Congenital Causes</label>
                      <CheckboxGroup options={CONGENITAL_CAUSES}
                        selected={getArray('disability_cause_congenital')} inline />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Acquired Causes</label>
                      <CheckboxGroup options={ACQUIRED_CAUSES}
                        selected={getArray('disability_cause_acquired')} inline />
                    </div>
                    <FormField md={6} label="Other (Specify)"
                      value={(app as any).disability_cause_other_specify} />
                    <FormField md={6} label="Legacy Cause" value={app.disability_cause} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="address" number={5} title="Residence Address"
                  summary={[dash((app as any).barangay), dash((app as any).municipality), dash((app as any).province)].join(', ')}
                  isOpen={openSections.has('address')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={3} label="Barangay" value={(app as any).barangay} />
                    <FormField md={3} label="Municipality / City" value={(app as any).municipality} />
                    <FormField md={3} label="Province" value={(app as any).province} />
                    <FormField md={3} label="Region" value={(app as any).region} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="contact" number={6} title="Contact Details"
                  summary={[dash((app as any).mobile_no || app.contact_number), dash(app.email)].join(' · ')}
                  isOpen={openSections.has('contact')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={4} label="Landline No." value={(app as any).landline_no} />
                    <FormField md={4} label="Mobile No."
                      value={(app as any).mobile_no || app.contact_number} />
                    <FormField md={4} label="Email" type="email" value={app.email} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="education" number={7} title="Educational Attainment"
                  summary={dash((app as any).educational_attainment ?? app.education)}
                  isOpen={openSections.has('education')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={12} label="Highest Educational Attainment" type="select"
                      options={['None', 'Kindergarten', 'Elementary', 'Junior High School',
                        'Senior High School', 'College', 'Vocational', 'Post Graduate']}
                      value={(app as any).educational_attainment ?? app.education} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="employment" number={8} title="Employment"
                  summary={dash((app as any).employment_status)}
                  isOpen={openSections.has('employment')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={4} label="Employment Status" type="select"
                      options={['Employed', 'Unemployed', 'Self-employed']}
                      value={(app as any).employment_status} />
                    <FormField md={4} label="Employment Category" type="select"
                      options={['Government', 'Private']}
                      value={(app as any).employment_category} />
                    <FormField md={4} label="Employment Type" type="select"
                      options={['Permanent/Regular', 'Seasonal', 'Casual', 'Emergency']}
                      value={(app as any).employment_type} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="occupation" number={9} title="Occupation"
                  summary={dash((app as any).occupation_category)}
                  isOpen={openSections.has('occupation')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={6} label="Occupation Category" type="select"
                      options={['Managers', 'Professionals',
                        'Technicians and Associate Professionals',
                        'Clerical Support Workers', 'Service and Sales Workers',
                        'Skilled Agricultural, Forestry and Fishery Workers',
                        'Craft and Related Trades Workers',
                        'Plant and Machine Operators and Assemblers',
                        'Elementary Occupations', 'Armed Forces Occupations',
                        'Other Occupations']}
                      value={(app as any).occupation_category} />
                    <FormField md={6} label="Specific Occupation (legacy)" value={app.occupation} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="organization" number={10} title="Organization Affiliation"
                  summary={dash((app as any).organization_affiliated)}
                  isOpen={openSections.has('organization')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={6} label="Organization Name"
                      value={(app as any).organization_affiliated} />
                    <FormField md={6} label="Contact Person"
                      value={(app as any).organization_contact_person} />
                    <FormField md={6} label="Office Address"
                      value={(app as any).organization_office_address} />
                    <FormField md={6} label="Telephone Nos."
                      value={(app as any).organization_tel_nos} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="ids" number={11} title="ID Reference Numbers"
                  summary={idCount > 0 ? `${idCount} number${idCount > 1 ? 's' : ''} provided` : 'None provided'}
                  isOpen={openSections.has('ids')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={4} label="SSS No." value={(app as any).sss_no} />
                    <FormField md={4} label="GSIS No." value={(app as any).gsis_no} />
                    <FormField md={4} label="Pag-IBIG No." value={(app as any).pag_ibig_no} />
                    <FormField md={4} label="PhilHealth No." value={(app as any).philhealth_no} />
                    <FormField md={4} label="PSN No." value={(app as any).psn_no} />
                    <FormField md={4} label="PWD ID Number" value={(app as any).pwd_id_number} />
                    <FormField md={4} label="PhilSys ID" value={(app as any).philsys_id} />
                    <FormField md={4} label="Other Gov ID Type"
                      value={(app as any).other_gov_id_type} />
                    <FormField md={4} label="Other Gov ID No."
                      value={(app as any).other_gov_id_number} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="family" number={12} title="Family Background"
                  summary={`Father: ${dash((app as any).father_last_name)} · Mother: ${dash((app as any).mother_last_name)}`}
                  isOpen={openSections.has('family')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={4} label="Father's Last Name" value={(app as any).father_last_name} />
                    <FormField md={4} label="Father's First Name" value={(app as any).father_first_name} />
                    <FormField md={4} label="Father's Middle Name" value={(app as any).father_middle_name} />
                    <FormField md={4} label="Mother's Last Name" value={(app as any).mother_last_name} />
                    <FormField md={4} label="Mother's First Name" value={(app as any).mother_first_name} />
                    <FormField md={4} label="Mother's Middle Name" value={(app as any).mother_middle_name} />
                    <FormField md={4} label="Guardian's Last Name" value={(app as any).guardian_last_name} />
                    <FormField md={4} label="Guardian's First Name" value={(app as any).guardian_first_name} />
                    <FormField md={4} label="Guardian's Middle Name" value={(app as any).guardian_middle_name} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="emergency" number={13} title="Emergency Contact & Representative"
                  summary={[dash(app.emergency_name), dash(app.emergency_contact_number)].join(' · ')}
                  isOpen={openSections.has('emergency')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={4} label="Emergency Contact Name" value={app.emergency_name} />
                    <FormField md={4} label="Relationship" value={app.emergency_relationship} />
                    <FormField md={4} label="Contact No." value={app.emergency_contact_number} />
                    <FormField md={12} label="Address" value={(app as any).emergency_address} />
                    <div className="col-12">
                      <hr className="my-1" />
                    </div>
                    <FormField md={4} label="Representative Name" value={app.representative_name} />
                    <FormField md={4} label="Representative Relationship"
                      value={(app as any).representative_relationship} />
                    <FormField md={4} label="Representative Contact"
                      value={(app as any).representative_contact} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="accomplished" number={14} title="Accomplished By"
                  summary={dash((app as any).accomplished_by)}
                  isOpen={openSections.has('accomplished')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={3} label="Accomplished By" type="select"
                      options={['Applicant', 'Guardian', 'Representative']}
                      value={(app as any).accomplished_by} />
                    <FormField md={3} label="Last Name" value={(app as any).accomplished_last_name} />
                    <FormField md={3} label="First Name" value={(app as any).accomplished_first_name} />
                    <FormField md={3} label="Middle Name" value={(app as any).accomplished_middle_name} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="physician" number={15} title="Certifying Physician"
                  summary={dash((app as any).physician_name)}
                  isOpen={openSections.has('physician')} onToggle={toggleSection}
                >
                  <div className="row g-3">
                    <FormField md={6} label="Physician's Name" value={(app as any).physician_name} />
                    <FormField md={6} label="License No." value={(app as any).physician_license_no} />
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="assistance" number={16}
                  title="Assistance Received / Needed / Rehabilitation"
                  summary={`Received: ${receivedCount} · Needed: ${neededCount}`}
                  isOpen={openSections.has('assistance')} onToggle={toggleSection}
                >
                  <div className="row g-4">
                    <div className="col-md-6">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span className="badge bg-primary">
                          <i className="bi bi-box-arrow-in-down me-1" /> Received
                        </span>
                      </div>
                      <AssistanceChips raw={receivedArr} />
                    </div>

                    <div className="col-md-6">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span className="badge bg-danger">
                          <i className="bi bi-hand-index-thumb me-1" /> Needed
                        </span>
                      </div>
                      <AssistanceChips raw={neededArr} />
                    </div>
                  </div>
                </AccordionSection>
              </div>
            </div>

            {/* ── Documents ── */}
            <CollapsibleCard
              id="documents"
              icon="bi-folder"
              title="Documents"
              summary={
                documents.length === 0
                  ? 'None uploaded'
                  : `${documents.length} file${documents.length > 1 ? 's' : ''}${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
              }
              isOpen={openSections.has('documents')}
              onToggle={toggleSection}
              badge={
                pendingCount > 0 ? (
                  <span className="badge bg-warning text-dark">{pendingCount} pending</span>
                ) : undefined
              }
              className="mb-3"
            >
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Filename</th>
                      <th>Uploaded</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length > 0 ? (
                      documents.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <span className="badge bg-primary bg-opacity-10 text-primary-pdao">
                              {prettyDocType(d.document_type)}
                            </span>
                          </td>
                          <td className="filename-cell">
                            <i className="bi bi-file-earmark-text me-1" />
                            <span className="filename-text">{d.filename}</span>
                          </td>
                          <td className="text-muted small text-nowrap">{fmtDateTime(d.uploaded_at)}</td>
                          <td>
                            <span className={`badge ${docStatusBadge(d.status)}`}>
                              {DOC_STATUS_LABEL[d.status as DocumentStatus] ?? 'Pending review'}
                            </span>
                          </td>
                          <td className="text-end text-nowrap">
                            <button
                              className="btn btn-sm btn-soft me-1"
                              onClick={() => viewDocument(d)}
                              title="Open in new tab"
                            >
                              <i className="bi bi-box-arrow-up-right" />
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => setReviewing(d)}
                              title="Review this document"
                            >
                              <i className="bi bi-clipboard-check me-1" /> Review
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">
                          No documents uploaded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CollapsibleCard>

            {/* ── Status History ── */}
            <CollapsibleCard
              id="history"
              icon="bi-clock-history"
              title="Status History"
              summary={logs.length === 0 ? 'No changes yet' : `${logs.length} entr${logs.length > 1 ? 'ies' : 'y'}`}
              isOpen={openSections.has('history')}
              onToggle={toggleSection}
            >
              {logs.length > 0 ? (
                <ul className="timeline mb-0">
                  {logs.map((log) => (
                    <li className="timeline-item" key={log.id}>
                      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                        <span className={`badge status-badge ${statusColor(log.new_status)}`}>
                          {log.new_status}
                        </span>
                        <span className="text-muted small text-nowrap">
                          {fmtDateTime(log.created_at)}
                        </span>
                      </div>
                      {log.remarks && <div className="text-muted small mt-1">{log.remarks}</div>}
                      <div className="text-muted small">by {log.changed_by}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted small">No history.</div>
              )}
            </CollapsibleCard>
          </div>

          {/* ── Right sidebar ── */}
          <div className="col-lg-4">
            <CollapsibleCard
              id="status-panel"
              icon="bi-pencil-square"
              title="Update Status"
              summary={dash(app.status)}
              isOpen={openSections.has('status-panel')}
              onToggle={toggleSection}
              className="sidebar-sticky"
            >
              <form onSubmit={(e) => updateStatus(e)}>
                <div className="mb-3">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Required for Rejected / Needs Revision. Saved to history and shown to the applicant."
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Custom email message{' '}
                    <span className="text-muted small">(optional)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={customEmailMessage}
                    onChange={(e) => setCustomEmailMessage(e.target.value)}
                    placeholder="Leave blank to use the default message for the selected status."
                  />
                  <div className="form-text">
                    If filled, this replaces the default paragraph in the email. Remarks are still shown separately.
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" /> Saving…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save me-1" /> Update status
                    </>
                  )}
                </button>
              </form>
              <hr />
              <div className="d-grid gap-2">
                <button className="btn btn-success" onClick={() => updateStatus(undefined, 'Approved')} disabled={saving}>
                  <i className="bi bi-check-circle me-1" /> Approve
                </button>
                <button className="btn btn-danger" onClick={() => updateStatus(undefined, 'Rejected')} disabled={saving}>
                  <i className="bi bi-x-circle me-1" /> Reject
                </button>
                <button className="btn btn-warning" onClick={() => updateStatus(undefined, 'Needs Revision')} disabled={saving}>
                  <i className="bi bi-exclamation-triangle me-1" /> Request revision
                </button>
                <button className="btn btn-primary" onClick={() => updateStatus(undefined, 'Ready for Pickup')} disabled={saving}>
                  <i className="bi bi-bag-check me-1" /> Mark ready for pickup
                </button>
              </div>
            </CollapsibleCard>
          </div>
        </div>
      </div>

      {reviewing && (
        <DocumentReviewModal
          doc={reviewing}
          applicantUserId={app.user_id}
          adminName={profile?.fullname ?? 'Admin'}
          onClose={() => setReviewing(null)}
          onReviewed={handleDocReviewed}
        />
      )}

      <style>{`
        /* ── Page header ── */
        .applicant-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .applicant-header-left { min-width: 0; }
        .applicant-header-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        /* ── Accordion (form sections) ── */
        .accordion-section {
          border: 1px solid #e4e9f0;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          background: #fff;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }
        .accordion-section.open { border-color: #b8d4f0; }
        .accordion-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          width: 100%;
          padding: 0.65rem 0.85rem;
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
          min-width: 0;
        }
        .accordion-header:hover { background: #f5f9ff; }
        .accordion-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.5rem;
          height: 1.5rem;
          border-radius: 50%;
          background: #0056b3;
          color: #fff;
          font-size: 0.72rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .accordion-title {
          font-weight: 700;
          font-size: 0.9rem;
          color: #1a2a44;
          flex-shrink: 0;
        }
        .accordion-summary {
          font-size: 0.82rem;
          color: #6c7a92;
          margin-left: 0.35rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1 1 auto;
          min-width: 0;
        }
        .accordion-caret {
          color: #0056b3;
          font-size: 0.85rem;
          margin-left: auto;
          flex-shrink: 0;
        }
        .accordion-body {
          padding: 0.9rem 1rem 0.4rem;
          border-top: 1px solid #eef2f7;
          background: #fbfdff;
        }

        /* ── Collapsible card (Documents / History / Sidebar) ── */
        .collapsible-card {
          border: 1px solid #e4e9f0;
          border-radius: 0.6rem;
          background: #fff;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }
        .collapsible-card.open { border-color: #b8d4f0; }
        .collapsible-card-header {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          width: 100%;
          padding: 0.7rem 0.9rem;
          background: #fbfdff;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
          min-width: 0;
        }
        .collapsible-card-header:hover { background: #f5f9ff; }
        .collapsible-card-title {
          font-weight: 700;
          font-size: 0.92rem;
          color: #1a2a44;
          flex-shrink: 0;
        }
        .collapsible-card-summary {
          font-size: 0.82rem;
          color: #6c7a92;
          margin-left: 0.35rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1 1 auto;
          min-width: 0;
        }
        .collapsible-card-caret {
          color: #0056b3;
          font-size: 0.85rem;
          flex-shrink: 0;
        }
        .collapsible-card-body {
          border-top: 1px solid #eef2f7;
          padding: 0.9rem 1rem;
          background: #fff;
        }

        /* Sticky sidebar only on desktop where there's room */
        .sidebar-sticky { position: static; }
        @media (min-width: 992px) {
          .sidebar-sticky {
            position: sticky;
            top: 80px;
          }
        }

        /* Filename truncation to prevent table overflow */
        .filename-cell {
          max-width: 240px;
        }
        .filename-text {
          display: inline-block;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          vertical-align: bottom;
        }

        /* Assistance chips */
        .assistance-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.55rem;
          background: #f1f7ff;
          border: 1px solid #c7dcf5;
          border-radius: 999px;
          font-size: 0.78rem;
          color: #0056b3;
          margin-right: 0.3rem;
          margin-bottom: 0.3rem;
        }
        .assistance-chip .chip-cat {
          font-weight: 700;
          color: #1a2a44;
        }
        .assistance-chip .chip-sep { color: #8fb3dc; }

        /* Hide summaries on small screens */
        @media (max-width: 576px) {
          .accordion-summary,
          .collapsible-card-summary { display: none; }
        }
      `}</style>
    </AppLayout>
  )
}

/* ---------- Helper Components ---------- */

/**
 * Numbered accordion used inside the PWD form card.
 */
function AccordionSection({
  id, number, title, summary, isOpen, onToggle, children,
}: {
  id: string
  number: number
  title: string
  summary?: ReactNode
  isOpen: boolean
  onToggle: (id: string) => void
  children: ReactNode
}) {
  return (
    <div className={`accordion-section ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="accordion-header"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        aria-controls={`accordion-body-${id}`}
      >
        <span className="accordion-num">{number}</span>
        <span className="accordion-title">{title}</span>
        {!isOpen && summary != null && summary !== '' && (
          <span className="accordion-summary">{summary}</span>
        )}
        <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'} accordion-caret`} />
      </button>
      {isOpen && (
        <div className="accordion-body" id={`accordion-body-${id}`}>
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Reusable collapsible card used for Documents, Status History, and
 * the Update Status sidebar panel.
 */
function CollapsibleCard({
  id, icon, title, summary, badge, isOpen, onToggle, children, className = '',
}: {
  id: string
  icon: string
  title: string
  summary?: ReactNode
  badge?: ReactNode
  isOpen: boolean
  onToggle: (id: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`collapsible-card ${isOpen ? 'open' : ''} ${className}`}>
      <button
        type="button"
        className="collapsible-card-header"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        aria-controls={`collapsible-body-${id}`}
      >
        <i className={`bi ${icon} text-primary-pdao`} />
        <span className="collapsible-card-title">{title}</span>
        {!isOpen && summary != null && summary !== '' && (
          <span className="collapsible-card-summary">{summary}</span>
        )}
        {badge}
        <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'} collapsible-card-caret ms-auto`} />
      </button>
      {isOpen && (
        <div className="collapsible-card-body" id={`collapsible-body-${id}`}>
          {children}
        </div>
      )}
    </div>
  )
}

interface FormFieldProps {
  md: number
  label: string
  value?: string | null
  type?: 'text' | 'date' | 'email' | 'select'
  options?: string[]
}

function FormField({ md, label, value, type = 'text', options }: FormFieldProps) {
  return (
    <div className={`col-md-${md}`}>
      <label className="form-label">{label}</label>
      {type === 'select' ? (
        <select className="form-select" disabled value={value ?? ''}>
          <option value="">—</option>
          {options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input type={type} className="form-control" value={value || ''} disabled readOnly />
      )}
    </div>
  )
}

interface CheckboxGroupProps {
  label?: string
  options: string[]
  selected: string[]
  inline?: boolean
}

function CheckboxGroup({ label, options, selected, inline = false }: CheckboxGroupProps) {
  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      <div className={inline ? 'd-flex flex-wrap gap-3' : ''}>
        {options.map((opt) => (
          <div className={`form-check ${inline ? '' : 'mb-2'}`} key={opt}>
            <input
              className="form-check-input"
              type="checkbox"
              checked={selected.includes(opt)}
              disabled
              readOnly
            />
            <label className="form-check-label">{opt}</label>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Compact assistance display (chips, new format) ---------- */

function AssistanceChips({ raw }: { raw: string[] }) {
  const parsed = parseAssistance(raw)
  const total = parsed.govt.length + parsed.ngo.length

  if (total === 0) {
    return <p className="text-muted small mb-0 fst-italic">None recorded.</p>
  }

  return (
    <div>
      {SOURCES.map((source) => {
        const keys = parsed[source]
        if (keys.length === 0) return null
        return (
          <div key={source} className="mb-2">
            <span
              className={`badge me-1 ${
                source === 'govt'
                  ? 'bg-success bg-opacity-10 text-success'
                  : 'bg-info bg-opacity-10 text-info-emphasis'
              }`}
            >
              {SOURCE_LABEL[source]}
            </span>
            {keys.map((k) => (
              <span key={k} className="assistance-chip">
                <span className="chip-cat">{findAssistanceCategory(k)}</span>
                <span className="chip-sep">·</span>
                <span>{findAssistanceLabel(k)}</span>
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}