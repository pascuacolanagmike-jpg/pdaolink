export type Role = 'client' | 'admin'

export type ApplicationStatus =
  | 'Pending'
  | 'Under Review'
  | 'Needs Revision'
  | 'Approved'
  | 'Rejected'
  | 'Ready for Pickup'

export const ALL_STATUSES: ApplicationStatus[] = [
  'Pending',
  'Under Review',
  'Needs Revision',
  'Approved',
  'Rejected',
  'Ready for Pickup',
]

// --- DOH PWD Registration Form v4.0 constants ---

export const APPLICATION_TYPES = ['New Applicant', 'Renewal'] as const

export const DISABILITY_TYPES = [
  'Deaf or Hard of Hearing',
  'Intellectual Disability',
  'Learning Disability',
  'Mental Disability',
  'Multiple Disabilities',
  'Orthopedic/Physical Disability',
  'Psychosocial Disability',
  'Rare Disease',
  'Speech Disability',
  'Visual Disability',
  'Cancer',
  'Other Disability',
] as const

export const DISABILITY_CAUSE_CONGENITAL = [
  'ADHD',
  'Autism',
  'Cerebral Palsy',
  'Cleft Lip/Palate',
  'Clubfoot/Talipes',
  'Down Syndrome',
  'Hydrocephalus',
  'Intellectual Disability',
  'Learning Disability',
  'Microcephaly',
  'Others (specify)',
] as const

export const DISABILITY_CAUSE_ACQUIRED = [
  'Chronic Illness/Degenerative Disease',
  'Cerebral Palsy',
  'Injury Accidents',
  'Injury (Acts of Nature)',
  'Injury (Armed Conflict)',
  'Injury (Physical Violence)',
  'Injury (Sexual Abuse)',
  'Kidney Disease',
  'Others (specify)',
] as const

export const GENDER_OPTIONS = ['Male', 'Female'] as const

export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated'] as const

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const

export const EDUCATIONAL_ATTAINMENT = [
  'None',
  'Kindergarten',
  'Elementary',
  'Junior High School',
  'Senior High School',
  'College',
  'Vocational',
  'Post Graduate',
] as const

export const EMPLOYMENT_STATUS = ['Employed', 'Unemployed', 'Self-employed'] as const

export const EMPLOYMENT_CATEGORIES = ['Government', 'Private'] as const

export const EMPLOYMENT_TYPES = ['Permanent/Regular', 'Seasonal', 'Casual', 'Emergency'] as const

export const OCCUPATION_CATEGORIES = [
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
] as const

export const ACCOMPLISHED_BY = ['Applicant', 'Guardian', 'Representative'] as const

// Kept for backwards compatibility
export const EDUCATION_LEVELS = EDUCATIONAL_ATTAINMENT

export const DOCUMENT_TYPES = [
  'medical_certificate',
  'barangay_certificate',
  'birth_certificate',
  'valid_id',
  'passport_photo',
  'supporting_document',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const MAX_UPLOAD_MB = 10
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']

export interface Profile {
  id: string
  fullname: string
  email: string
  role: Role
  contact_number: string | null
  address: string | null
  birth_date: string | null
  gender: string | null
  civil_status: string | null
  created_at: string
}

export interface Application {
  id: string
  user_id: string
  status: ApplicationStatus
  submission_date: string
  last_updated: string
  remarks: string | null
  // Section 1-3
  application_type: string | null
  pwd_number: string | null
  date_applied: string | null
  // Section 4-5
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  suffix: string | null
  // Section 6
  birth_date: string | null
  gender: string | null
  civil_status: string | null
  blood_type: string | null
  // Section 7
  address: string | null
  barangay: string | null
  municipality: string | null
  province: string | null
  region: string | null
  // Section 8
  disability_types: string[] | null
  disability_type: string | null
  // Section 9
  disability_cause_type: string | null
  disability_cause_congenital: string[] | null
  disability_cause_acquired: string[] | null
  disability_cause_other_specify: string | null
  disability_cause: string | null
  // Section 10
  educational_attainment: string | null
  education: string | null
  // Section 11
  employment_status: string | null
  employment_category: string | null
  employment_type: string | null
  // Section 12
  occupation_category: string | null
  occupation: string | null
  // Section 13
  organization_affiliated: string | null
  organization_contact_person: string | null
  organization_office_address: string | null
  organization_tel_nos: string | null
  // Section 14
  sss_no: string | null
  gsis_no: string | null
  pag_ibig_no: string | null
  psn_no: string | null
  philhealth_no: string | null
  // Section 15
  landline_no: string | null
  mobile_no: string | null
  contact_number: string | null
  email: string | null
  // Section 16 - Family
  father_last_name: string | null
  father_first_name: string | null
  father_middle_name: string | null
  mother_last_name: string | null
  mother_first_name: string | null
  mother_middle_name: string | null
  guardian_last_name: string | null
  guardian_first_name: string | null
  guardian_middle_name: string | null
  // Section 17 - Emergency
  emergency_name: string | null
  emergency_relationship: string | null
  emergency_contact_number: string | null
  emergency_address: string | null
  // Section 18 - Representative
  representative_name: string | null
  representative_relationship: string | null
  representative_contact: string | null
  // Section 19 - Gov IDs (legacy)
  pwd_id_number: string | null
  philsys_id: string | null
  other_gov_id_type: string | null
  other_gov_id_number: string | null
  // Section 20 - Accomplished by
  accomplished_by: string | null
  accomplished_last_name: string | null
  accomplished_first_name: string | null
  accomplished_middle_name: string | null
  // Section 21 - Physician
  physician_name: string | null
  physician_license_no: string | null
}

export interface ApplicationInput {
  application_type: string
  pwd_number?: string
  date_applied?: string
  first_name: string
  middle_name?: string
  last_name: string
  suffix?: string
  birth_date: string
  gender: string
  civil_status: string
  blood_type?: string
  address?: string
  barangay?: string
  municipality?: string
  province?: string
  region?: string
  disability_types?: string[]
  disability_type?: string
  disability_cause_type?: string
  disability_cause_congenital?: string[]
  disability_cause_acquired?: string[]
  disability_cause_other_specify?: string
  disability_cause?: string
  educational_attainment?: string
  education?: string
  employment_status?: string
  employment_category?: string
  employment_type?: string
  occupation_category?: string
  occupation?: string
  organization_affiliated?: string
  organization_contact_person?: string
  organization_office_address?: string
  organization_tel_nos?: string
  sss_no?: string
  gsis_no?: string
  pag_ibig_no?: string
  psn_no?: string
  philhealth_no?: string
  landline_no?: string
  mobile_no?: string
  contact_number?: string
  email: string
  father_last_name?: string
  father_first_name?: string
  father_middle_name?: string
  mother_last_name?: string
  mother_first_name?: string
  mother_middle_name?: string
  guardian_last_name?: string
  guardian_first_name?: string
  guardian_middle_name?: string
  emergency_name?: string
  emergency_relationship?: string
  emergency_contact_number?: string
  emergency_address?: string
  representative_name?: string
  representative_relationship?: string
  representative_contact?: string
  pwd_id_number?: string
  philsys_id?: string
  other_gov_id_type?: string
  other_gov_id_number?: string
  accomplished_by?: string
  accomplished_last_name?: string
  accomplished_first_name?: string
  accomplished_middle_name?: string
  physician_name?: string
  physician_license_no?: string
}

export interface DocumentRow {
  id: string
  application_id: string
  document_type: string
  filename: string
  storage_path: string
  uploaded_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  is_pinned: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
  author_id: string | null
  image_path: string | null
}

export interface Notification {
  id: string
  user_id: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

export interface StatusLog {
  id: string
  application_id: string
  old_status: string | null
  new_status: string
  remarks: string | null
  changed_by: string | null
  created_at: string
}

export interface BiometricCredential {
  id: string
  user_id: string
  credential_id: string
  public_key: string
  counter: number
  device_type: string
  transports: string[]
  nickname: string | null
  created_at: string
  algorithm: number
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Pending: 'bg-secondary',
    'Under Review': 'bg-info text-dark',
    'Needs Revision': 'bg-warning text-dark',
    Approved: 'bg-success',
    Rejected: 'bg-danger',
    'Ready for Pickup': 'bg-primary',
  }
  return map[status] ?? 'bg-secondary'
}

export function prettyDocType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function appFullName(a: { first_name: string | null; last_name: string | null }): string {
  return [a.first_name, a.last_name].filter(Boolean).join(' ').trim()
}
