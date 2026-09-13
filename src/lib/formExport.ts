import jsPDF from 'jspdf'
import { type Application, appFullName, fmtDate } from './types'

// ─── Assistance section key → label map ───────────────────────
const ASSISTANCE_LABELS: Record<string, string> = {
  // sources
  govt: "Gov't",
  ngo: 'NGO',
  // assistive devices
  assistive_devices: 'Assistive Devices',
  wheelchair: 'Wheelchair',
  crutches: 'Crutches',
  quad_cane: 'Quad Cane',
  single_cane: 'Single Cane',
  walker: 'Walker',
  stroller: 'Stroller',
  hearing_aid: 'Hearing Aid',
  prosthesis: 'Prosthesis (Artificial Leg)',
  external_leg_brace: 'External Leg Brace',
  // financial assistance
  financial_assistance: 'Financial Assistance',
  hospitalization: 'Hospitalization',
  dialysis_chemo: 'Dialysis/Chemotherapy',
  reset_medical: 'Reset/Medical',
  therapy: 'Therapy',
  therapy_speech: 'Speech',
  therapy_occupational: 'Occupational',
  therapy_physical: 'Physical',
  // other
  neuro_dev_assessment: 'Neuro-Developmental Assessment',
  educational: 'Educational',
  tuition_subsidy: 'Tuition Subsidy',
  allowance: 'Allowance',
  materials_supplies: 'Materials/Supplies',
  urgent_basic_needs: 'Urgent Basic Needs',
  burial: 'Burial',
  // job search
  job_search: 'Financial Assistance for Job Searching',
  livelihood: 'Livelihood',
  training: 'Training (Social/Vocational)',
  rehabilitation: 'Rehabilitation',
  rehab_community: 'Community-based',
  rehab_institution: 'Institution-based',
  rehab_none: 'None',
  job_placement: 'Job Placement',
  assistance_others: 'Others',
}

function assistanceToString(keys: string[] | null | undefined): string {
  if (!keys || keys.length === 0) return ''
  return keys.map((k) => ASSISTANCE_LABELS[k] ?? k).join(', ')
}

export function exportApplicationFormPDF(app: Application, filename?: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2

  let y = 0

  // ─── First-page header ────────────────────────────────────
  const drawMainHeader = () => {
    doc.setFillColor(0, 61, 128)
    doc.rect(0, 0, pageWidth, 90, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Republic of the Philippines', pageWidth / 2, 18, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DEPARTMENT OF HEALTH', pageWidth / 2, 32, { align: 'center' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Local Government Unit', pageWidth / 2, 44, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('PHILIPPINE REGISTRY FOR PERSONS WITH DISABILITIES', pageWidth / 2, 62, { align: 'center' })

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Application Form — Version 4.0 (Revised August 1, 2021)', pageWidth / 2, 76, { align: 'center' })

    doc.setTextColor(0, 0, 0)
    y = 105
  }

  // ─── Continuation-page header ─────────────────────────────
  const drawContinuationHeader = () => {
    doc.setFillColor(0, 61, 128)
    doc.rect(0, 0, pageWidth, 26, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('PDAOLink — PWD Application Form (continued)', margin, 17)
    doc.setTextColor(0, 0, 0)
    y = 42
  }

  // ─── Page-break helper ────────────────────────────────────
  const ensureSpace = (needed: number = 40) => {
    if (y + needed > pageHeight - 45) {
      doc.addPage()
      drawContinuationHeader()
    }
  }

  // ─── Section title bar ────────────────────────────────────
  const sectionTitle = (title: string) => {
    ensureSpace(28)
    doc.setFillColor(230, 240, 250)
    doc.rect(margin, y, contentWidth, 18, 'F')
    doc.setTextColor(0, 61, 128)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 6, y + 12)
    doc.setTextColor(0, 0, 0)
    y += 22
  }

  // ─── Single full-width field ──────────────────────────────
  const field = (label: string, value?: string | null) => {
    ensureSpace(24)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(110)
    doc.text(label.toUpperCase(), margin, y)
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const text = value && String(value).trim() ? String(value) : '—'
    const lines = doc.splitTextToSize(text, contentWidth)
    doc.text(lines, margin, y + 10)
    y += 10 + lines.length * 11 + 3
  }

  // ─── Two columns ──────────────────────────────────────────
  const field2 = (
    l1: string, v1: string | null | undefined,
    l2: string, v2: string | null | undefined,
  ) => {
    ensureSpace(24)
    const colW = (contentWidth - 14) / 2
    const x2 = margin + colW + 14

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(110)
    doc.text(l1.toUpperCase(), margin, y)
    doc.text(l2.toUpperCase(), x2, y)
    doc.setTextColor(0, 0, 0)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const t1 = v1 && String(v1).trim() ? String(v1) : '—'
    const t2 = v2 && String(v2).trim() ? String(v2) : '—'
    const ln1 = doc.splitTextToSize(t1, colW)
    const ln2 = doc.splitTextToSize(t2, colW)
    doc.text(ln1, margin, y + 10)
    doc.text(ln2, x2, y + 10)
    y += 10 + Math.max(ln1.length, ln2.length) * 11 + 3
  }

  // ─── Three columns ────────────────────────────────────────
  const field3 = (
    l1: string, v1: string | null | undefined,
    l2: string, v2: string | null | undefined,
    l3: string, v3: string | null | undefined,
  ) => {
    ensureSpace(24)
    const colW = (contentWidth - 20) / 3
    const x1 = margin
    const x2 = margin + colW + 10
    const x3 = margin + (colW + 10) * 2

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(110)
    doc.text(l1.toUpperCase(), x1, y)
    doc.text(l2.toUpperCase(), x2, y)
    doc.text(l3.toUpperCase(), x3, y)
    doc.setTextColor(0, 0, 0)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const t1 = v1 && String(v1).trim() ? String(v1) : '—'
    const t2 = v2 && String(v2).trim() ? String(v2) : '—'
    const t3 = v3 && String(v3).trim() ? String(v3) : '—'
    const ln1 = doc.splitTextToSize(t1, colW)
    const ln2 = doc.splitTextToSize(t2, colW)
    const ln3 = doc.splitTextToSize(t3, colW)
    doc.text(ln1, x1, y + 10)
    doc.text(ln2, x2, y + 10)
    doc.text(ln3, x3, y + 10)
    y += 10 + Math.max(ln1.length, ln2.length, ln3.length) * 11 + 3
  }

  // ─── Multi-select grid with checkboxes ────────────────────
  const checkboxList = (label: string, values: string[]) => {
    ensureSpace(30)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(110)
    doc.text(label.toUpperCase(), margin, y)
    doc.setTextColor(0, 0, 0)
    y += 13

    if (!values || values.length === 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('—', margin, y)
      y += 15
      return
    }

    const colW = contentWidth / 3
    let col = 0
    for (const v of values) {
      ensureSpace(14)
      const x = margin + col * colW
      doc.setDrawColor(100)
      doc.setLineWidth(0.5)
      doc.rect(x, y - 8, 9, 9)
      doc.setLineWidth(1)
      doc.line(x + 2, y - 4, x + 4, y - 2)
      doc.line(x + 4, y - 2, x + 7, y - 6)

      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      const txt = doc.splitTextToSize(v, colW - 14)
      doc.text(txt, x + 12, y)
      col++
      if (col >= 3) { col = 0; y += 14 }
    }
    if (col !== 0) y += 14
    y += 2
  }

  // ─── Draw header ──────────────────────────────────────────
  drawMainHeader()

  // ═══════════════════ SECTIONS ═══════════════════

  // 1. Application Type
  sectionTitle('1. Application Type')
  field3(
    'Application Type', app.application_type,
    'PWD Number', app.pwd_number,
    'Date Applied', app.date_applied ? fmtDate(app.date_applied) : '',
  )

  // 2. Personal Information
  sectionTitle('2. Personal Information')
  field3('Last Name', app.last_name, 'First Name', app.first_name, 'Middle Name', app.middle_name)
  field3('Suffix', app.suffix, 'Birth Date', app.birth_date ? fmtDate(app.birth_date) : '', 'Gender', app.gender)
  field3('Civil Status', app.civil_status, 'Blood Type', app.blood_type, 'Email', app.email)
  field2('Contact Number', app.contact_number || app.mobile_no, 'Complete Address', app.address)

  // 3. Type of Disability
  sectionTitle('3. Type of Disability')
  checkboxList('Selected disabilities', app.disability_types ?? [])

  // 4. Cause of Disability
  sectionTitle('4. Cause of Disability')
  field('Cause Type', app.disability_cause_type)
  field2(
    'Congenital Causes',
    (app.disability_cause_congenital ?? []).join(', '),
    'Acquired Causes',
    (app.disability_cause_acquired ?? []).join(', '),
  )
  field2('Other (Specify)', app.disability_cause_other_specify, 'Legacy Cause', app.disability_cause)

  // 5. Residence Address
  sectionTitle('5. Residence Address')
  field2('Barangay', app.barangay, 'Municipality / City', app.municipality)
  field2('Province', app.province, 'Region', app.region)

  // 6. Contact Details
  sectionTitle('6. Contact Details')
  field3(
    'Landline No.', app.landline_no,
    'Mobile No.', app.mobile_no || app.contact_number,
    'Email', app.email,
  )

  // 7. Educational Attainment
  sectionTitle('7. Educational Attainment')
  field('Highest Educational Attainment', app.educational_attainment ?? app.education)

  // 8. Employment
  sectionTitle('8. Employment')
  field3(
    'Employment Status', app.employment_status,
    'Employment Category', app.employment_category,
    'Employment Type', app.employment_type,
  )

  // 9. Occupation
  sectionTitle('9. Occupation')
  field2('Occupation Category', app.occupation_category, 'Specific Occupation', app.occupation)

  // 10. Organization Affiliation
  sectionTitle('10. Organization Affiliation')
  field2('Organization Name', app.organization_affiliated, 'Contact Person', app.organization_contact_person)
  field2('Office Address', app.organization_office_address, 'Telephone Nos.', app.organization_tel_nos)

  // 11. ID Reference Numbers
  sectionTitle('11. ID Reference Numbers')
  field3('SSS No.', app.sss_no, 'GSIS No.', app.gsis_no, 'Pag-IBIG No.', app.pag_ibig_no)
  field3('PhilHealth No.', app.philhealth_no, 'PSN No.', app.psn_no, 'PWD ID Number', app.pwd_id_number)
  field3('PhilSys ID', app.philsys_id, 'Other Gov ID Type', app.other_gov_id_type, 'Other Gov ID No.', app.other_gov_id_number)

  // 12. Family Background
  sectionTitle('12. Family Background')
  field3("Father's Last Name", app.father_last_name, "Father's First Name", app.father_first_name, "Father's Middle Name", app.father_middle_name)
  field3("Mother's Last Name", app.mother_last_name, "Mother's First Name", app.mother_first_name, "Mother's Middle Name", app.mother_middle_name)
  field3("Guardian's Last Name", app.guardian_last_name, "Guardian's First Name", app.guardian_first_name, "Guardian's Middle Name", app.guardian_middle_name)

  // 13. Emergency Contact & Representative
  sectionTitle('13. Emergency Contact & Representative')
  field2('Emergency Contact Name', app.emergency_name, 'Relationship', app.emergency_relationship)
  field2('Contact No.', app.emergency_contact_number, 'Address', app.emergency_address)
  field2('Representative Name', app.representative_name, 'Relationship', app.representative_relationship)
  field('Representative Contact', app.representative_contact)

  // 14. Accomplished By
  sectionTitle('14. Accomplished By')
  field3(
    'Accomplished By', app.accomplished_by,
    'Last Name', app.accomplished_last_name,
    'First Name', app.accomplished_first_name,
  )
  field('Middle Name', app.accomplished_middle_name)

  // 15. Certifying Physician
  sectionTitle('15. Certifying Physician')
  field2("Physician's Name", app.physician_name, 'License No.', app.physician_license_no)

  // 16. Assistance Received / Needed
  const assistanceReceived = (app as any).assistance_received as string[] | null | undefined
  const assistanceNeeded = (app as any).assistance_needed as string[] | null | undefined
  if ((assistanceReceived && assistanceReceived.length > 0) || (assistanceNeeded && assistanceNeeded.length > 0)) {
    sectionTitle('16. Assistance Received / Needed / Rehabilitation')
    field('Received', assistanceToString(assistanceReceived))
    field('Needed', assistanceToString(assistanceNeeded))
  }

  // Application Status
  sectionTitle('Application Status')
  field2('Current Status', app.status, 'Submission Date', fmtDate(app.submission_date))
  field2('Last Updated', fmtDate(app.last_updated), 'Remarks', app.remarks)

  // ─── Signatures ───────────────────────────────────────────
  ensureSpace(90)
  y += 30
  doc.setDrawColor(100)
  doc.setLineWidth(0.7)
  doc.line(margin, y, margin + 200, y)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Applicant / Representative Signature', margin, y + 12)

  doc.line(pageWidth - margin - 200, y, pageWidth - margin, y)
  doc.text('Date', pageWidth - margin - 200, y + 12)

  // ─── Footer on every page ─────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      `Generated by PDAOLink — ${new Date().toLocaleString()}`,
      margin,
      pageHeight - 20,
    )
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 20,
      { align: 'right' },
    )
  }

  doc.save(filename || `pwd-application-${app.id.slice(0, 8)}.pdf`)
}
