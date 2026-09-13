import { useEffect, useState, FormEvent, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  statusColor,
  docStatusBadge,         
  DOC_STATUS_LABEL,
  fmtDate,
  fmtDateTime,
  prettyDocType,
  ALL_STATUSES,
  type Application,
  type StatusLog,
  type DocumentRow,
  type DocumentStatus, 
} from '../../lib/types'
import { exportApplicationFormPDF } from '../../lib/formExport'
import Alert from '../../components/Alert'

// Official DOH PWD Form v4.0 options (adjust as needed)
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

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [app, setApp] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [logs, setLogs] = useState<StatusLog[]>([])
  const [loading, setLoading] = useState(true)
  const [newStatus, setNewStatus] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  const updateStatus = async (e?: FormEvent, status?: string) => {
    e?.preventDefault()
    if (!app || !profile) return
    const target = status ?? newStatus
    if (!ALL_STATUSES.includes(target as any)) return
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
    await supabase.from('notifications').insert({
      user_id: app.user_id,
      message: msgMap[target] ?? `Application status updated to ${target}.`,
      link: '/status',
    })

    setApp({ ...app, status: target as any, remarks })
    setSaving(false)
    const { data: newLogs } = await supabase
      .from('status_logs')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setLogs((newLogs ?? []) as StatusLog[])
  }

  const viewDocument = (doc: DocumentRow) => {
    const url = supabase.storage.from('documents').getPublicUrl(doc.storage_path).data.publicUrl
    window.open(url, '_blank')
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

  return (
    <AppLayout navItems={ADMIN_NAV}>
      <div className="fade-in-up">
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
          <div>
            <Link to="/admin/applicants" className="small text-muted">
              <i className="bi bi-arrow-left" /> Back to applicants
            </Link>
            <h3 className="mt-1 mb-0">Applicant #{app.id.slice(0, 8)}</h3>
            <span className={`badge status-badge ${statusColor(app.status)}`}>{app.status}</span>
          </div>
          <button className="btn btn-primary" onClick={() => exportApplicationFormPDF(app)}>
            <i className="bi bi-file-pdf me-1" /> Export Form to PDF
          </button>
        </div>

        {error && <Alert variant="danger" message={error} />}

        <div className="row g-3">
          <div className="col-lg-8">
            {/* Official DOH PWD Application Form v4.0 – Read-only form view */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header">
                <i className="bi bi-file-earmark-medical text-primary-pdao me-1" />
                Philippine Registry for Persons with Disabilities (PWD) Form v4.0
              </div>
              <div className="card-body p-4">
                {/* Section 1: Application Type */}
                <FormSection title="1. Application Type">
                  <div className="row g-3">
                    <FormField
                      md={4}
                      label="Application Type"
                      type="select"
                      options={['New Applicant', 'Renewal']}
                      value={(app as any).application_type}
                    />
                    <FormField md={4} label="PWD Number" value={(app as any).pwd_number} />
                    <FormField md={4} label="Date Applied" type="date" value={(app as any).date_applied} />
                  </div>
                </FormSection>

                {/* Section 2: Personal Information */}
                <FormSection title="2. Personal Information">
                  <div className="row g-3">
                    <FormField md={3} label="Last Name" value={app.last_name} />
                    <FormField md={3} label="First Name" value={app.first_name} />
                    <FormField md={3} label="Middle Name" value={app.middle_name} />
                    <FormField md={3} label="Suffix" value={app.suffix} />
                    <FormField md={3} label="Birth Date" type="date" value={app.birth_date} />
                    <FormField
                      md={3}
                      label="Gender"
                      type="select"
                      options={['Male', 'Female', 'Other']}
                      value={app.gender}
                    />
                    <FormField
                      md={3}
                      label="Civil Status"
                      type="select"
                      options={['Single', 'Married', 'Widowed', 'Separated', 'Divorced']}
                      value={app.civil_status}
                    />
                    <FormField md={3} label="Blood Type" value={app.blood_type} />
                    <FormField md={6} label="Email" type="email" value={app.email} />
                    <FormField
                      md={6}
                      label="Contact Number"
                      value={app.contact_number || (app as any).mobile_no}
                    />
                    <FormField md={12} label="Complete Address" value={app.address} />
                  </div>
                </FormSection>

                {/* Section 3: Type of Disability (Checkboxes) */}
                <FormSection title="3. Type of Disability">
                  <div className="row g-3">
                    <CheckboxGroup
                      label="Select all that apply"
                      options={DISABILITY_TYPES}
                      selected={getArray('disability_types')}
                    />
                  </div>
                </FormSection>

                {/* Section 4: Cause of Disability */}
                <FormSection title="4. Cause of Disability">
                  <div className="row g-3">
                    <FormField
                      md={4}
                      label="Cause Type"
                      type="select"
                      options={['Congenital / Inborn', 'Acquired']}
                      value={(app as any).disability_cause_type}
                    />
                    <div className="col-md-4">
                      <label className="form-label">Congenital Causes</label>
                      <CheckboxGroup
                        options={CONGENITAL_CAUSES}
                        selected={getArray('disability_cause_congenital')}
                        inline
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Acquired Causes</label>
                      <CheckboxGroup
                        options={ACQUIRED_CAUSES}
                        selected={getArray('disability_cause_acquired')}
                        inline
                      />
                    </div>
                    <FormField
                      md={4}
                      label="Other (Specify)"
                      value={(app as any).disability_cause_other_specify}
                    />
                    <FormField md={4} label="Legacy Cause" value={app.disability_cause} />
                  </div>
                </FormSection>

                {/* Section 5: Residence Address */}
                <FormSection title="5. Residence Address">
                  <div className="row g-3">
                    <FormField md={3} label="Barangay" value={(app as any).barangay} />
                    <FormField md={3} label="Municipality / City" value={(app as any).municipality} />
                    <FormField md={3} label="Province" value={(app as any).province} />
                    <FormField md={3} label="Region" value={(app as any).region} />
                  </div>
                </FormSection>

                {/* Section 6: Contact Details */}
                <FormSection title="6. Contact Details">
                  <div className="row g-3">
                    <FormField md={4} label="Landline No." value={(app as any).landline_no} />
                    <FormField
                      md={4}
                      label="Mobile No."
                      value={(app as any).mobile_no || app.contact_number}
                    />
                    <FormField md={4} label="Email" type="email" value={app.email} />
                  </div>
                </FormSection>

                {/* Section 7: Educational Attainment */}
                <FormSection title="7. Educational Attainment">
                  <div className="row g-3">
                    <FormField
                      md={12}
                      label="Highest Educational Attainment"
                      type="select"
                      options={[
                        'None',
                        'Kindergarten',
                        'Elementary',
                        'Junior High School',
                        'Senior High School',
                        'College',
                        'Vocational',
                        'Post Graduate',
                      ]}
                      value={(app as any).educational_attainment ?? app.education}
                    />
                  </div>
                </FormSection>

                {/* Section 8: Employment */}
                <FormSection title="8. Employment">
                  <div className="row g-3">
                    <FormField
                      md={4}
                      label="Employment Status"
                      type="select"
                      options={['Employed', 'Unemployed', 'Self-employed']}
                      value={(app as any).employment_status}
                    />
                    <FormField
                      md={4}
                      label="Employment Category"
                      type="select"
                      options={['Government', 'Private']}
                      value={(app as any).employment_category}
                    />
                    <FormField
                      md={4}
                      label="Employment Type"
                      type="select"
                      options={['Permanent/Regular', 'Seasonal', 'Casual', 'Emergency']}
                      value={(app as any).employment_type}
                    />
                  </div>
                </FormSection>

                {/* Section 9: Occupation */}
                <FormSection title="9. Occupation">
                  <div className="row g-3">
                    <FormField
                      md={6}
                      label="Occupation Category"
                      type="select"
                      options={[
                        'Managers',
                        'Professionals',
                        'Technicians and Associate Professionals',
                        'Clerical Support Workers',
                        'Service and Sales Workers',
                        'Skilled Agricultural, Forestry and Fishery Workers',
                        'Craft and Related Trades Workers',
                        'Plant and Machine Operators and Assemblers',
                        'Elementary Occupations',
                        'Armed Forces Occupations',
                        'Other Occupations',
                      ]}
                      value={(app as any).occupation_category}
                    />
                    <FormField md={6} label="Specific Occupation (legacy)" value={app.occupation} />
                  </div>
                </FormSection>

                {/* Section 10: Organization Affiliation */}
                <FormSection title="10. Organization Affiliation">
                  <div className="row g-3">
                    <FormField md={6} label="Organization Name" value={(app as any).organization_affiliated} />
                    <FormField
                      md={6}
                      label="Contact Person"
                      value={(app as any).organization_contact_person}
                    />
                    <FormField
                      md={6}
                      label="Office Address"
                      value={(app as any).organization_office_address}
                    />
                    <FormField md={6} label="Telephone Nos." value={(app as any).organization_tel_nos} />
                  </div>
                </FormSection>

                {/* Section 11: ID Reference Numbers */}
                <FormSection title="11. ID Reference Numbers">
                  <div className="row g-3">
                    <FormField md={4} label="SSS No." value={(app as any).sss_no} />
                    <FormField md={4} label="GSIS No." value={(app as any).gsis_no} />
                    <FormField md={4} label="Pag-IBIG No." value={(app as any).pag_ibig_no} />
                    <FormField md={4} label="PhilHealth No." value={(app as any).philhealth_no} />
                    <FormField md={4} label="PSN No." value={(app as any).psn_no} />
                    <FormField md={4} label="PWD ID Number" value={(app as any).pwd_id_number} />
                    <FormField md={4} label="PhilSys ID" value={(app as any).philsys_id} />
                    <FormField md={4} label="Other Gov ID Type" value={(app as any).other_gov_id_type} />
                    <FormField md={4} label="Other Gov ID No." value={(app as any).other_gov_id_number} />
                  </div>
                </FormSection>

                {/* Section 12: Family Background */}
                <FormSection title="12. Family Background">
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
                </FormSection>

                {/* Section 13: Emergency Contact & Representative */}
                <FormSection title="13. Emergency Contact & Representative">
                  <div className="row g-3">
                    <FormField md={4} label="Emergency Contact Name" value={app.emergency_name} />
                    <FormField md={3} label="Relationship" value={app.emergency_relationship} />
                    <FormField md={3} label="Contact No." value={app.emergency_contact_number} />
                    <FormField md={2} label="Address" value={(app as any).emergency_address} />
                    <FormField md={4} label="Representative Name" value={app.representative_name} />
                    <FormField
                      md={4}
                      label="Representative Relationship"
                      value={(app as any).representative_relationship}
                    />
                    <FormField
                      md={4}
                      label="Representative Contact"
                      value={(app as any).representative_contact}
                    />
                  </div>
                </FormSection>

                {/* Section 14: Accomplished By */}
                <FormSection title="14. Accomplished By">
                  <div className="row g-3">
                    <FormField
                      md={3}
                      label="Accomplished By"
                      type="select"
                      options={['Applicant', 'Guardian', 'Representative']}
                      value={(app as any).accomplished_by}
                    />
                    <FormField md={3} label="Last Name" value={(app as any).accomplished_last_name} />
                    <FormField md={3} label="First Name" value={(app as any).accomplished_first_name} />
                    <FormField md={3} label="Middle Name" value={(app as any).accomplished_middle_name} />
                  </div>
                </FormSection>

                {/* Section 15: Certifying Physician */}
                <FormSection title="15. Certifying Physician">
                  <div className="row g-3">
                    <FormField md={6} label="Physician's Name" value={(app as any).physician_name} />
                    <FormField md={6} label="License No." value={(app as any).physician_license_no} />
                  </div>
                </FormSection>
              </div>
            </div>

            {/* Documents */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header">
                <i className="bi bi-folder text-primary-pdao me-1" /> Documents
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Filename</th>
                      <th>Uploaded</th>
                      <th className="text-end">View</th>
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
                          <td>
                            <i className="bi bi-file-earmark-text me-1" />
                            {d.filename}
                          </td>
                          <td className="text-muted small">{fmtDateTime(d.uploaded_at)}</td>
                          <td className="text-end">
                            <button className="btn btn-sm btn-soft" onClick={() => viewDocument(d)}>
                              <i className="bi bi-eye" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-4">
                          No documents uploaded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status History */}
            <div className="card border-0 shadow-sm">
              <div className="card-header">
                <i className="bi bi-clock-history text-primary-pdao me-1" /> Status History
              </div>
              <div className="card-body">
                {logs.length > 0 ? (
                  <ul className="timeline">
                    {logs.map((log) => (
                      <li className="timeline-item" key={log.id}>
                        <div className="d-flex justify-content-between">
                          <span className={`badge status-badge ${statusColor(log.new_status)}`}>
                            {log.new_status}
                          </span>
                          <span className="text-muted small">{fmtDateTime(log.created_at)}</span>
                        </div>
                        {log.remarks && <div className="text-muted small mt-1">{log.remarks}</div>}
                        <div className="text-muted small">by {log.changed_by}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted small">No history.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar – status update */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm position-sticky" style={{ top: 80 }}>
              <div className="card-header">
                <i className="bi bi-pencil-square text-primary-pdao me-1" /> Update status
              </div>
              <div className="card-body">
                <form onSubmit={(e) => updateStatus(e)}>
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Remarks</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Notes for the applicant (optional)"
                    />
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/* ---------- Helper Components ---------- */

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h6 className="fw-bold text-primary-pdao mb-3">{title}</h6>
      {children}
      <hr className="mt-4" />
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
        <select className="form-select" disabled>
          <option value="">—</option>
          {options?.map((opt) => (
            <option key={opt} value={opt} selected={value === opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input type={type} className="form-control" value={value || ''} disabled />
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
            />
            <label className="form-check-label">{opt}</label>
          </div>
        ))}
      </div>
    </div>
  )
}
