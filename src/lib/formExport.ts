import jsPDF from 'jspdf'
import { type Application, fmtDate } from './types'

// ─── Assistance key → label ──────────────────────────────
const ASSIST_LABELS: Record<string, string> = {
  govt: "Gov't", ngo: 'NGO',
  assistive_devices: 'Assistive Devices',
  wheelchair: 'Wheelchair', crutches: 'Crutches', quad_cane: 'Quad Cane',
  single_cane: 'Single Cane', walker: 'Walker', stroller: 'Stroller',
  hearing_aid: 'Hearing Aid', prosthesis: 'Prosthesis',
  external_leg_brace: 'External Leg Brace',
  financial_assistance: 'Financial Assistance',
  hospitalization: 'Hospitalization', dialysis_chemo: 'Dialysis/Chemo',
  reset_medical: 'Reset/Medical', therapy: 'Therapy',
  therapy_speech: 'Speech', therapy_occupational: 'Occupational', therapy_physical: 'Physical',
  neuro_dev_assessment: 'Neuro-Developmental Assessment',
  educational: 'Educational', tuition_subsidy: 'Tuition Subsidy',
  allowance: 'Allowance', materials_supplies: 'Materials/Supplies',
  urgent_basic_needs: 'Urgent Basic Needs', burial: 'Burial',
  job_search: 'Financial Assistance for Job Searching',
  livelihood: 'Livelihood', training: 'Training', rehabilitation: 'Rehabilitation',
  rehab_community: 'Community-based', rehab_institution: 'Institution-based',
  rehab_none: 'None', job_placement: 'Job Placement', assistance_others: 'Others',
}

export function exportApplicationFormPDF(app: Application, filename?: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()   // 595
  const ph = doc.internal.pageSize.getHeight()  // 842
  const margin = 22
  const cw = pw - margin * 2

  const gray = () => { doc.setDrawColor(60); doc.setLineWidth(0.6) }

  // A bordered field cell with tiny bold label + value below
  const cell = (x: number, y: number, w: number, h: number, label: string, value?: string | null) => {
    gray()
    doc.rect(x, y, w, h)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(0)
    doc.text(label, x + 3, y + 7.5)
    if (value && String(value).trim()) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.8)
      const lines = doc.splitTextToSize(String(value).trim(), w - 6)
      doc.text(lines.slice(0, 3), x + 3, y + 16)
    }
  }

  // Hollow circle checkbox + label
  const checkbox = (x: number, y: number, label: string, checked: boolean, size = 7) => {
    gray()
    doc.setLineWidth(0.5)
    doc.circle(x + 3, y, 3.2, 'S')
    if (checked) {
      doc.setFillColor(0, 0, 0)
      doc.circle(x + 3, y, 1.6, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(0)
    doc.text(label, x + 9, y + 2.4)
  }

  const subLabel = (x: number, y: number, label: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(0)
    doc.text(label, x, y)
  }

  // Check if a value matches any label (loose)
  const matches = (arr: string[] | null | undefined, needle: string) => {
    if (!arr || arr.length === 0) return false
    const n = needle.toLowerCase().split('(')[0].trim()
    return arr.some((v) => {
      const lv = String(v).toLowerCase()
      return lv.includes(n) || n.includes(lv)
    })
  }

  let y = margin

  // ═══════════════ HEADER ═══════════════
  const headerH = 62
  gray()
  doc.rect(margin, y, cw, headerH)

  const photoW = 78
  gray()
  doc.rect(margin + cw - photoW, y, photoW, headerH)

  const titleAreaW = cw - photoW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Philippine Registry Form for Persons With Disability', margin + titleAreaW / 2, y + 26, { align: 'center' })
  doc.setFontSize(11)
  doc.text('Ver. 2.0', margin + titleAreaW / 2, y + 48, { align: 'center' })

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  const px = margin + cw - photoW / 2
  doc.text('Place', px, y + 18, { align: 'center' })
  doc.text("1' x 1'", px, y + 29, { align: 'center' })
  doc.text('Photo', px, y + 40, { align: 'center' })
  doc.text('here', px, y + 51, { align: 'center' })

  y += headerH

  // ═══════════════ 1. PWD # | 2. DATE ═══════════════
  const r1 = 20
  cell(margin, y, cw * 0.55, r1, '1. PWD NUMBER:', app.pwd_number)
  cell(margin + cw * 0.55, y, cw * 0.45, r1, '2. DATE:', app.date_applied ? fmtDate(app.date_applied) : '')
  y += r1

  // ═══════════════ 3. NAME ═══════════════
  const r2 = 22
  const cw3 = cw / 3
  cell(margin, y, cw3, r2, '3. LAST NAME:', app.last_name)
  cell(margin + cw3, y, cw3, r2, 'FIRST NAME:', app.first_name)
  cell(margin + cw3 * 2, y, cw3, r2, 'MIDDLE NAME:', app.middle_name)
  y += r2

  // ═══════════════ 4. TYPE OF DISABILITY ═══════════════
  const rDis = 48
  gray(); doc.rect(margin, y, cw, rDis)
  subLabel(margin + 3, y + 8, '4. TYPE OF DISABILITY:')

  const disList = [
    'Mental/Intellectual',
    'Psychosocial Disability',
    'Disability due to Chronic Illness',
    'Learning Disability',
    'Visual Disability',
    'Orthopedic (Musculoskeletal) Disability',
    'Hearing Disability',
    'Speech Impairment',
    'Multiple Disabilities',
  ]
  const disColW = cw / 3
  const selected = (app.disability_types ?? []) as string[]
  disList.forEach((label, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const matched = selected.some((s) => {
      const a = s.toLowerCase().replace(/\s/g, '')
      const b = label.toLowerCase().replace(/\s/g, '')
      return a.includes(b.split('(')[0]) || b.includes(a)
    })
    checkbox(margin + 8 + col * disColW, y + 22 + row * 12, label, matched)
  })
  y += rDis

  // ═══════════════ 5. CAUSES ═══════════════
  const rCause = 20
  gray(); doc.rect(margin, y, cw, rCause)
  subLabel(margin + 3, y + 8, '5. CAUSES OF DISABILITY:')

  const isCongenital = app.disability_cause_type === 'Congenital / Inborn'
  const isAcquired = app.disability_cause_type === 'Acquired'
  const causeAcq = (app.disability_cause_acquired ?? []) as string[]
  const hasIllness = matches(causeAcq, 'Chronic Illness') || matches(causeAcq, 'Disease')
  const hasInjury = causeAcq.some((c) => c.toLowerCase().includes('injury'))

  checkbox(margin + 130, y + 10, 'Congenital/Inborn', isCongenital)
  checkbox(margin + 260, y + 10, 'Illness', hasIllness)
  checkbox(margin + 340, y + 10, 'Injury', hasInjury)
  y += rCause

  // ═══════════════ 6. ADDRESS ═══════════════
  const rAddr = 34
  gray(); doc.rect(margin, y, cw, rAddr)
  subLabel(margin + 3, y + 8, '6. ADDRESS:')

  // Row A: House No / Barangay / Municipality / Province / Region
  const cAddr = cw / 5
  const addrRowY = y + 12
  const addrRowH = 22
  cell(margin, addrRowY, cAddr * 1.5, addrRowH, 'House No. and Street', app.address)
  cell(margin + cAddr * 1.5, addrRowY, cAddr * 0.85, addrRowH, 'Barangay', app.barangay)
  cell(margin + cAddr * 2.35, addrRowY, cAddr * 0.9, addrRowH, 'Municipality', app.municipality)
  cell(margin + cAddr * 3.25, addrRowY, cAddr * 0.9, addrRowH, 'Province', app.province)
  cell(margin + cAddr * 4.15, addrRowY, cAddr * 0.85, addrRowH, 'Region', app.region)
  y += rAddr

  // ═══════════════ 7. CONTACT DETAILS ═══════════════
  const rCon = 20
  cell(margin, y, cw / 3, rCon, '7a. TEL. NOS.:', app.landline_no)
  cell(margin + cw / 3, y, cw / 3, rCon, '7b. MOBILE NO.:', app.mobile_no || app.contact_number)
  cell(margin + cw * 2 / 3, y, cw / 3, rCon, '7c. EMAIL ADDRESS:', app.email)
  y += rCon

  // ═══════════════ 8/9/10. DOB / SEX / CIVIL ═══════════════
  const rDob = 30
  const dobW = cw * 0.35
  const sexW = cw * 0.20
  const civW = cw * 0.45
  cell(margin, y, dobW, rDob, '8. DATE OF BIRTH (mm/dd/yyyy):', app.birth_date ? fmtDate(app.birth_date) : '')

  // Sex cell with checkboxes
  gray(); doc.rect(margin + dobW, y, sexW, rDob)
  subLabel(margin + dobW + 3, y + 7.5, '9. SEX:')
  checkbox(margin + dobW + 8, y + 18, 'Male', app.gender === 'Male')
  checkbox(margin + dobW + 8 + 50, y + 18, 'Female', app.gender === 'Female')

  // Civil status cell with checkboxes
  gray(); doc.rect(margin + dobW + sexW, y, civW, rDob)
  subLabel(margin + dobW + sexW + 3, y + 7.5, '10. CIVIL STATUS:')
  const csX = margin + dobW + sexW + 8
  checkbox(csX, y + 18, 'Single', app.civil_status === 'Single')
  checkbox(csX + 55, y + 18, 'Married', app.civil_status === 'Married')
  checkbox(csX + 118, y + 18, 'Widower', app.civil_status === 'Widowed')
  checkbox(csX + 180, y + 18, 'Separated', app.civil_status === 'Separated')
  y += rDob

  // ═══════════════ 11. EDUCATIONAL ATTAINMENT ═══════════════
  const rEdu = 34
  gray(); doc.rect(margin, y, cw, rEdu)
  subLabel(margin + 3, y + 8, '11. EDUCATIONAL ATTAINMENT:')
  const eduOpts = [
    'Elementary Undergraduate', 'Elementary Graduate',
    'High School Undergraduate', 'High School Graduate',
    'College Undergraduate', 'College Graduate',
    'Post Graduate', 'Vocational', 'None',
  ]
  const edu = app.educational_attainment ?? app.education ?? ''
  eduOpts.forEach((label, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const checked = edu.toLowerCase().includes(label.toLowerCase().split(' ')[0].toLowerCase()) &&
                    edu.toLowerCase().includes(label.toLowerCase().split(' ')[1]?.toLowerCase() ?? '')
    checkbox(margin + 8 + col * (cw / 3), y + 20 + row * 11, label, checked, 6.5)
  })
  y += rEdu

  // ═══════════════ 12. EMPLOYMENT STATUS ═══════════════
  const rEmp = 18
  gray(); doc.rect(margin, y, cw, rEmp)
  subLabel(margin + 3, y + 7, '12. EMPLOYMENT STATUS:')
  checkbox(margin + 170, y + 9, 'Employed', app.employment_status === 'Employed')
  checkbox(margin + 250, y + 9, 'Unemployed', app.employment_status === 'Unemployed')
  y += rEmp

  // ═══════════════ 13. TYPE OF EMPLOYMENT ═══════════════
  const rEmpT = 18
  gray(); doc.rect(margin, y, cw, rEmpT)
  subLabel(margin + 3, y + 7, '13. TYPE OF EMPLOYMENT (Please check one if employed):')
  checkbox(margin + 300, y + 9, 'Private', app.employment_category === 'Private')
  checkbox(margin + 380, y + 9, 'Government', app.employment_category === 'Government')
  y += rEmpT

  // ═══════════════ 14. TYPE OF EMPLOYER ═══════════════
  const rEmpE = 18
  gray(); doc.rect(margin, y, cw, rEmpE)
  subLabel(margin + 3, y + 7, '14. TYPE OF EMPLOYER (Please check one if employed):')
  const empTypes = ['Permanent', 'Regular', 'Contractual', 'Casual', 'Self-Employed', 'Seasonal', 'Emergency']
  empTypes.forEach((t, i) => {
    const checked = (app.employment_type ?? '').toLowerCase().includes(t.toLowerCase())
    checkbox(margin + 280 + i * 42, y + 9, t, checked, 6)
  })
  y += rEmpE

  // ═══════════════ 15. OCCUPATION + 16. ID REFERENCE ═══════════════
  const rOcc = 122
  const occW = cw * 0.55
  const idW = cw * 0.45
  gray(); doc.rect(margin, y, occW, rOcc)
  subLabel(margin + 3, y + 8, '15. OCCUPATION: (Please check one):')

  const occList = [
    'Officials of Government and Special Interest Organizations, Corporate Executives, Managers, Managing Proprietors and Supervisors',
    'Professionals',
    'Technicians and Associate Professionals',
    'Clerks',
    'Service Workers and Shop and Market Sales Workers',
    'Farmers, Forestry Workers and Fishermen',
    'Trades and Related Workers',
    'Plant and Machine Operators and Assemblers',
    'Laborers',
    'Unskilled Workers',
    'Not Applicable',
    'Others, specify',
  ]
  const occ = app.occupation_category ?? app.occupation ?? ''
  occList.forEach((label, i) => {
    const checked = occ.toLowerCase().includes(label.toLowerCase().split(',')[0].split('(')[0].trim())
    const row = Math.floor(i / 1)
    const tx = margin + 8
    const ty = y + 22 + i * 8.5
    // Wrap long labels to two lines
    if (label.length > 60) {
      const firstLine = label.slice(0, 60)
      const secondLine = label.slice(60)
      gray(); doc.setLineWidth(0.5)
      doc.circle(tx + 3, ty, 2.8, 'S')
      if (checked) { doc.setFillColor(0,0,0); doc.circle(tx + 3, ty, 1.4, 'F') }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6)
      doc.text(firstLine, tx + 9, ty + 2)
      doc.text(secondLine, tx + 9, ty + 9)
    } else {
      checkbox(tx, ty, label, checked, 6)
    }
  })

  // Right column: 16. ID Reference
  gray(); doc.rect(margin + occW, y, idW, rOcc)
  subLabel(margin + occW + 3, y + 8, '16. ID Reference No.')

  const idRows = [
    ['SSS No.:', app.sss_no],
    ['GSIS No.:', app.gsis_no],
    ['Pag-ibig No.:', app.pag_ibig_no],
    ['PhilHealth No.:', app.philhealth_no],
  ] as const
  idRows.forEach(([lbl, val], i) => {
    const cy = y + 14 + i * 18
    gray(); doc.rect(margin + occW + 3, cy, idW - 6, 16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6)
    doc.text(lbl, margin + occW + 6, cy + 5)
    if (val) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
      doc.text(String(val), margin + occW + 6, cy + 13)
    }
  })

  // 17. Blood type inside right column, below ID refs
  const btY = y + 14 + 4 * 18 + 2
  gray(); doc.rect(margin + occW + 3, btY, idW - 6, 26)
  subLabel(margin + occW + 6, btY + 7, '17. BLOOD TYPE:')
  const btOpts = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  btOpts.forEach((bt, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    checkbox(margin + occW + 6 + col * 35, btY + 15 + row * 9, bt, app.blood_type === bt, 6)
  })

  y += rOcc

  // ═══════════════ 18. ORGANIZATION ═══════════════
  const rOrg = 52
  gray(); doc.rect(margin, y, cw, rOrg)
  subLabel(margin + 3, y + 8, '18. ORGANIZATION INFORMATION:')
  const orgRows = [
    ['Organization Affiliated:', app.organization_affiliated],
    ['Contact Person:', app.organization_contact_person],
    ['Office Address:', app.organization_office_address],
    ['Tel. Nos.:', app.organization_tel_nos],
  ] as const
  orgRows.forEach(([lbl, val], i) => {
    const cy = y + 12 + i * 10
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
    doc.text(lbl, margin + 8, cy + 6)
    if (val) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
      doc.text(String(val), margin + 120, cy + 6)
    }
  })
  y += rOrg

  // ═══════════════ 19. FAMILY BACKGROUND ═══════════════
  const rFam = 52
  gray(); doc.rect(margin, y, cw, rFam)
  subLabel(margin + 3, y + 8, '19. FAMILY BACKGROUND:')

  // Header row
  const famColW = cw / 3
  gray(); doc.rect(margin + 3, y + 12, cw - 6, 12)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
  doc.text('Last Name', margin + famColW * 0.5, y + 20, { align: 'center' })
  doc.text('First Name', margin + famColW * 1.5, y + 20, { align: 'center' })
  doc.text('Middle Name', margin + famColW * 2.5, y + 20, { align: 'center' })

  const famRows = [
    ["FATHER'S NAME:", app.father_last_name, app.father_first_name, app.father_middle_name],
    ["MOTHER'S NAME:", app.mother_last_name, app.mother_first_name, app.mother_middle_name],
    ["GUARDIAN'S NAME:", app.guardian_last_name, app.guardian_first_name, app.guardian_middle_name],
  ] as const
  famRows.forEach((r, i) => {
    const cy = y + 24 + i * 9
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6)
    doc.text(r[0], margin + 6, cy + 6)
    const vx = margin + 130
    const vw = cw - 130 - 6
    gray(); doc.setLineWidth(0.3)
    doc.line(vx + vw / 3, cy, vx + vw / 3, cy + 9)
    doc.line(vx + vw * 2 / 3, cy, vx + vw * 2 / 3, cy + 9)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text(String(r[1] ?? ''), vx + 3, cy + 6)
    doc.text(String(r[2] ?? ''), vx + vw / 3 + 3, cy + 6)
    doc.text(String(r[3] ?? ''), vx + vw * 2 / 3 + 3, cy + 6)
  })
  y += rFam

  // ═══════════════ 20. ACCOMPLISHED BY ═══════════════
  const rAcc = 18
  gray(); doc.rect(margin, y, cw, rAcc)
  subLabel(margin + 3, y + 7, '20. ACCOMPLISHED BY:')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  const accName = [app.accomplished_first_name, app.accomplished_middle_name, app.accomplished_last_name].filter(Boolean).join(' ')
  doc.text(`${app.accomplished_by ?? ''} ${accName ? '— ' + accName : ''}`.trim(), margin + 130, y + 12)
  y += rAcc

  // ═══════════════ 20a. REPORTING UNIT ═══════════════
  const rRep = 18
  cell(margin, y, cw, rRep, '20a. NAME OF REPORTING UNIT:', '')
  y += rRep

  // ═══════════════ 21. REGISTRATION # ═══════════════
  const rReg = 18
  cell(margin, y, cw, rReg, '21. REGISTRATION NUMBER:', '')
  y += rReg

  // ═══════════════ FOOTER ═══════════════
  const footY = Math.max(y + 20, ph - 80)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Department of Health', pw / 2, footY, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('San Lazaro Compound, Sta. Cruz, Manila', pw / 2, footY + 10, { align: 'center' })
  doc.text('Republic of the Philippines', pw / 2, footY + 20, { align: 'center' })

  doc.setFontSize(6.5)
  doc.setTextColor(140)
  doc.text(
    `Generated by PDAOLink — ${new Date().toLocaleString()} · App #${app.id.slice(0, 8)} · Status: ${app.status}`,
    pw / 2,
    ph - 15,
    { align: 'center' },
  )

  doc.save(filename || `pwd-application-${app.id.slice(0, 8)}.pdf`)
}
