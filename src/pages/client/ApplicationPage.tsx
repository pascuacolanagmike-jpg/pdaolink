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

const EMPTY: ApplicationInput = {
  application_type: 'New Applicant',
  pwd_number: '', date_applied: '',
  first_name: '', middle_name: '', last_name: '', suffix: '',
  birth_date: '', gender: '', civil_status: '', blood_type: '',
  address: '', barangay: '', municipality: '', province: '', region: '',
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
}

const ACTIVE_STATUSES = ['Pending', 'Under Review', 'Approved', 'Ready for Pickup']

export default function ApplicationPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<ApplicationInput>(() => ({
    ...EMPTY,
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
        setExisting(data as Application | null)
        setLoading(false)
      })
  }, [profile])

  const set = (field: keyof ApplicationInput, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const toggleArray = (field: 'disability_types' | 'disability_cause_congenital' | 'disability_cause_acquired', value: string) => {
    setForm((f) => {
      const arr = f[field] ?? []
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      if (field === 'disability_types') setShowOtherDisability(next.includes('Other Disability'))
      return { ...f, [field]: next }
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const required: (keyof ApplicationInput)[] = [
      'first_name', 'last_name', 'birth_date', 'gender', 'civil_status',
      'address', 'mobile_no', 'email',
    ]
    for (const field of required) {
      const val = form[field]
      if (typeof val === 'string' && !val.trim()) {
        setError(`${field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} is required.`)
        return
      }
    }
    if (!form.disability_types || form.disability_types.length === 0) {
      setError('Please select at least one type of disability.')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.from('applications').insert(form).select().single()
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    await supabase.from('status_logs').insert({
      application_id: data.id, old_status: null, new_status: 'Pending',
      remarks: 'Application submitted', changed_by: profile?.fullname ?? 'Applicant',
    })
    await supabase.from('notifications').insert({
      user_id: profile!.id,
      message: 'Your application has been submitted and is now pending review.',
      link: '/status',
    })
    setSuccess('Application submitted successfully!')
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
          <form onSubmit={handleSubmit} noValidate>
            {/* Section 1-3 */}
            <FormCard icon="bi-clipboard-check" title="Application Details">
              <div className="row g-3">
                <FormCol md={4} label="Application type" required>
                  <select className="form-select" value={form.application_type} onChange={(e) => set('application_type', e.target.value)}>
                    {APPLICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormCol>
                <FormCol md={4} label="PWD number (for renewal)">
                  <input className="form-control" value={form.pwd_number ?? ''} onChange={(e) => set('pwd_number', e.target.value)} placeholder="DR-PPMNA-BBB-NNNNNNN" />
                </FormCol>
                <FormCol md={4} label="Date applied">
                  <input type="date" className="form-control" value={form.date_applied ?? ''} onChange={(e) => set('date_applied', e.target.value)} />
                </FormCol>
              </div>
            </FormCard>

            {/* Section 4-5: Name */}
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
                <FormCol md={2} label="Suffix">
                  <input className="form-control" value={form.suffix ?? ''} onChange={(e) => set('suffix', e.target.value)} placeholder="Jr., Sr." />
                </FormCol>
              </div>
            </FormCard>

            {/* Section 6: Date of birth & sex */}
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

            {/* Section 7: Address */}
            <FormCard icon="bi-geo-alt" title="Address">
              <div className="row g-3">
                <FormCol md={12} label="House no./Street/Barangay" required>
                  <input className="form-control" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} required />
                </FormCol>
                <FormCol md={3} label="Barangay">
                  <input className="form-control" value={form.barangay ?? ''} onChange={(e) => set('barangay', e.target.value)} />
                </FormCol>
                <FormCol md={3} label="Municipality/City">
                  <input className="form-control" value={form.municipality ?? ''} onChange={(e) => set('municipality', e.target.value)} />
                </FormCol>
                <FormCol md={3} label="Province">
                  <input className="form-control" value={form.province ?? ''} onChange={(e) => set('province', e.target.value)} />
                </FormCol>
                <FormCol md={3} label="Region">
                  <input className="form-control" value={form.region ?? ''} onChange={(e) => set('region', e.target.value)} />
                </FormCol>
              </div>
            </FormCard>

            {/* Section 8: Type of Disability */}
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

            {/* Section 9: Cause of Disability */}
            <FormCard icon="bi-clipboard2-pulse" title="Cause of Disability">
              <div className="row g-3 mb-2">
                <div className="col-md-6">
                  <CheckboxRow
                    label="Congenital / Inborn"
                    checked={form.disability_cause_type === 'Congenital / Inborn'}
                    onChange={() => set('disability_cause_type', 'Congenital / Inborn')}
                    radio
                  />
                </div>
                <div className="col-md-6">
                  <CheckboxRow
                    label="Acquired"
                    checked={form.disability_cause_type === 'Acquired'}
                    onChange={() => set('disability_cause_type', 'Acquired')}
                    radio
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

            {/* Section 10: Educational Attainment */}
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

            {/* Section 11: Employment Status */}
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

            {/* Section 12: Occupation Category */}
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

            {/* Section 13: Organization Affiliated */}
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

            {/* Section 14: ID Reference Numbers */}
            <FormCard icon="bi-credit-card-2-front" title="ID Reference Numbers" subtitle="Fill in what you have">
              <div className="row g-3">
                <FormCol md={3} label="SSS No."><input className="form-control" value={form.sss_no ?? ''} onChange={(e) => set('sss_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="GSIS No."><input className="form-control" value={form.gsis_no ?? ''} onChange={(e) => set('gsis_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="Pag-IBIG No."><input className="form-control" value={form.pag_ibig_no ?? ''} onChange={(e) => set('pag_ibig_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="PSN No."><input className="form-control" value={form.psn_no ?? ''} onChange={(e) => set('psn_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="PhilHealth No."><input className="form-control" value={form.philhealth_no ?? ''} onChange={(e) => set('philhealth_no', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            {/* Section 15: Contact details */}
            <FormCard icon="bi-telephone" title="Contact Details">
              <div className="row g-3">
                <FormCol md={3} label="Landline No."><input type="tel" className="form-control" value={form.landline_no ?? ''} onChange={(e) => set('landline_no', e.target.value)} /></FormCol>
                <FormCol md={3} label="Mobile No." required><input type="tel" className="form-control" value={form.mobile_no ?? ''} onChange={(e) => set('mobile_no', e.target.value)} required /></FormCol>
                <FormCol md={6} label="Email" required><input type="email" className="form-control" value={form.email} onChange={(e) => set('email', e.target.value)} required /></FormCol>
              </div>
            </FormCard>

            {/* Section 16: Family Background */}
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

            {/* Section 17: Emergency Contact */}
            <FormCard icon="bi-telephone-plus" title="Emergency Contact Information">
              <div className="row g-3">
                <FormCol md={4} label="Name"><input className="form-control" value={form.emergency_name ?? ''} onChange={(e) => set('emergency_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="Relationship"><input className="form-control" value={form.emergency_relationship ?? ''} onChange={(e) => set('emergency_relationship', e.target.value)} /></FormCol>
                <FormCol md={4} label="Contact number"><input type="tel" className="form-control" value={form.emergency_contact_number ?? ''} onChange={(e) => set('emergency_contact_number', e.target.value)} /></FormCol>
                <FormCol md={12} label="Address"><input className="form-control" value={form.emergency_address ?? ''} onChange={(e) => set('emergency_address', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            {/* Section 18: Representative */}
            <FormCard icon="bi-person-badge" title="Representative Information" subtitle="Complete only if the applicant is a minor or unable to apply themselves">
              <div className="row g-3">
                <FormCol md={4} label="Name"><input className="form-control" value={form.representative_name ?? ''} onChange={(e) => set('representative_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="Relationship"><input className="form-control" value={form.representative_relationship ?? ''} onChange={(e) => set('representative_relationship', e.target.value)} /></FormCol>
                <FormCol md={4} label="Contact number"><input type="tel" className="form-control" value={form.representative_contact ?? ''} onChange={(e) => set('representative_contact', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            {/* Section 19: Government IDs */}
            <FormCard icon="bi-card-checklist" title="Government ID Numbers" subtitle="Provide any government-issued ID">
              <div className="row g-3">
                <FormCol md={4} label="PWD ID No. (if any)"><input className="form-control" value={form.pwd_id_number ?? ''} onChange={(e) => set('pwd_id_number', e.target.value)} /></FormCol>
                <FormCol md={4} label="PhilSys ID"><input className="form-control" value={form.philsys_id ?? ''} onChange={(e) => set('philsys_id', e.target.value)} /></FormCol>
                <FormCol md={2} label="Other ID type"><input className="form-control" value={form.other_gov_id_type ?? ''} onChange={(e) => set('other_gov_id_type', e.target.value)} /></FormCol>
                <FormCol md={2} label="Other ID number"><input className="form-control" value={form.other_gov_id_number ?? ''} onChange={(e) => set('other_gov_id_number', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            {/* Section 20: Accomplished By */}
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

            {/* Section 21: Certifying Physician */}
            <FormCard icon="bi-person-doctor" title="Certifying Physician">
              <div className="row g-3">
                <FormCol md={8} label="Physician's name"><input className="form-control" value={form.physician_name ?? ''} onChange={(e) => set('physician_name', e.target.value)} /></FormCol>
                <FormCol md={4} label="License No."><input className="form-control" value={form.physician_license_no ?? ''} onChange={(e) => set('physician_license_no', e.target.value)} /></FormCol>
              </div>
            </FormCard>

            <div className="d-flex justify-content-end gap-2 mt-2">
              <button type="button" className="btn btn-soft" onClick={() => navigate('/dashboard')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <><span className="spinner-border spinner-border-sm me-1" /> Submitting…</> : <><i className="bi bi-send me-1" /> Submit application</>}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        .form-official-header {
          background: linear-gradient(135deg, #003d80, #0056b3);
          border-radius: 0.8rem; padding: 1.5rem; margin-bottom: 1.5rem;
        }
        .form-official-header-inner { color: #fff; }
        .form-official-republic { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0; opacity: 0.85; }
        .form-official-agency { font-size: 1rem; font-weight: 700; margin-bottom: 0; }
        .form-official-region { font-size: 0.85rem; margin-bottom: 0.8rem; opacity: 0.85; }
        .form-official-title { font-weight: 800; font-size: 1.3rem; margin-bottom: 0.3rem; }
        .form-official-subtitle { font-size: 0.82rem; opacity: 0.8; margin-bottom: 0; }
        .form-subgroup-label { font-weight: 700; font-size: 0.85rem; color: #0056b3; margin-bottom: 0.2rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .checkbox-row {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 0.7rem; border-radius: 0.4rem; cursor: pointer;
          border: 1px solid #e4e9f0; transition: all 0.15s ease;
          background: #fff; font-size: 0.88rem;
        }
        .checkbox-row:hover { border-color: #b8d4f0; background: #f5f9ff; }
        .checkbox-row.checked { border-color: #0056b3; background: rgba(0, 86, 179, 0.06); }
        .checkbox-row input { width: 16px; height: 16px; cursor: pointer; margin: 0; }
      `}</style>
    </AppLayout>
  )
}

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

function CheckboxRow({ label, checked, onChange, radio }: { label: string; checked: boolean; onChange: () => void; radio?: boolean }) {
  return (
    <label className={`checkbox-row ${checked ? 'checked' : ''}`}>
      <input type={radio ? 'radio' : 'checkbox'} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  )
}
