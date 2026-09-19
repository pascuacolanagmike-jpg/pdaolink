import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Bar, Pie } from 'react-chartjs-2'
import 'chart.js/auto'
import AppLayout from '../../components/AppLayout'
import { ADMIN_NAV } from '../../lib/nav'
import { supabase } from '../../lib/supabase'
import {
  ALL_STATUSES, DISABILITY_TYPES, GENDER_OPTIONS,
  CIVIL_STATUS_OPTIONS, EDUCATIONAL_ATTAINMENT, EMPLOYMENT_STATUS,
  statusColor, appFullName, fmtDate,
  type Application,
} from '../../lib/types'
import {
  exportExcel, exportPDF, filterByScope, groupByAddress,
  exportAddressExcel, exportAddressPDF, type AddressGroup,
} from '../../lib/reportExport'

const CAUSE_TYPE_OPTIONS = ['Congenital / Inborn', 'Acquired']

/* ─────────────────────────────────────────────────────────────
   CAUAYAN CITY — 65 Barangays
   ───────────────────────────────────────────────────────────── */
const CAUAYAN_BARANGAYS = [
  'Alicaocao',
  'Alinam',
  'Amobocan',
  'Andarayan',
  'Bacolod (Baculod)',
  'Baringin Norte',
  'Baringin Sur',
  'Buena Suerte',
  'Bugallon',
  'Buyon',
  'Cabaruan',
  'Cabugao',
  'Carabatan Chica',
  'Carabatan Grande',
  'Carabatan Punta',
  'Carabatan Bacareno',
  'Casalatan',
  'San Pablo (Casap Hacienda)',
  'Cassap Fuera',
  'Catalina',
  'Culalabat',
  'Dabburab',
  'De Vera',
  'Dianao',
  'Disimuray (Dissimuray)',
  'District I (Pob.)',
  'District II (Pob.)',
  'District III (Pob.)',
  'Duminit',
  'Faustino (Sipay)',
  'Gagabutan',
  'Gappal',
  'Guayabal',
  'Labinab',
  'Linglingay',
  'Mabantad',
  'Maligaya',
  'Manaoag',
  'Marabulig I',
  'Marabulig II',
  'Minante I',
  'Minante II',
  'Nagcampegan',
  'Naganacan',
  'Nagrumbuan',
  'Nungnungan I',
  'Nungnungan II',
  'Pinoma',
  'Rizal',
  'Rogus',
  'San Antonio',
  'San Fermin',
  'San Francisco',
  'San Isidro',
  'San Luis',
  'Santa Luciana (Daburab 2)',
  'Santa Maria',
  'Sillawit',
  'Sinippil',
  'Tagaran',
  'Turayong',
  'Union',
  'Villa Concepcion',
  'Villa Luna',
  'Villaflor',
] as const

/* ─────────────────────────────────────────────────────────────
   Normalize a barangay string for loose matching:
   trims, lowercases, collapses whitespace, strips periods and
   any parenthetical suffix like "(Pob.)".
   ───────────────────────────────────────────────────────────── */
function normalizeBarangay(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\(pob\.?\)/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim()
}

/* ─────────────────────────────────────────────────────────────
   SECONDS THE ADMIN MUST WAIT BEFORE THE DELETE ACTUALLY FIRES
   ───────────────────────────────────────────────────────────── */
const DELETE_COUNTDOWN_SECONDS = 5

/* ─────────────────────────────────────────────────────────────
   PERSISTENT "cleared at" MARKER
   ───────────────────────────────────────────────────────────── */
const CLEARED_AT_KEY = 'pdaolink_reports_cleared_at'

function readClearedAt(): Date | null {
  try {
    const raw = localStorage.getItem(CLEARED_AT_KEY)
    if (!raw) return null
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function writeClearedAt(d: Date) {
  try {
    localStorage.setItem(CLEARED_AT_KEY, d.toISOString())
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function isAfterClearedAt(dateStr: string | null | undefined, clearedAt: Date | null): boolean {
  if (!clearedAt) return true
  if (!dateStr) return false
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return false
  return t > clearedAt.getTime()
}

/* ─────────────────────────────────────────────────────────────
   AGE BRACKETS
   ───────────────────────────────────────────────────────────── */
const AGE_BRACKETS = [
  { label: '0-3',   min: 0,  max: 3 },
  { label: '4-6',   min: 4,  max: 6 },
  { label: '7-12',  min: 7,  max: 12 },
  { label: '13-17', min: 13, max: 17 },
  { label: '18-30', min: 18, max: 30 },
  { label: '31-59', min: 31, max: 59 },
  { label: '60-up', min: 60, max: 200 },
] as const

/* ─────────────────────────────────────────────────────────────
   AGE HELPERS
   ───────────────────────────────────────────────────────────── */
const DOB_KEYS = ['date_of_birth', 'birthdate', 'birth_date', 'dob', 'birthDate'] as const

function computeAgeFromDob(dob: string): number | null {
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const monthDiff = now.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--
  if (age < 0 || age > 130) return null
  return age
}

function getAge(app: Application): number | null {
  const a = app as any
  if (a.age !== undefined && a.age !== null && a.age !== '') {
    const n = Number(a.age)
    if (!isNaN(n) && n >= 0 && n <= 130) return Math.floor(n)
  }
  for (const key of DOB_KEYS) {
    const v = a[key]
    if (typeof v === 'string' && v.trim() !== '') {
      const n = computeAgeFromDob(v)
      if (n !== null) return n
    }
  }
  return null
}

function parseAgeInput(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

interface Stats {
  total: number
  byStatus: Record<string, number>
  daily: number
  monthly: number
  clients: number
  disabilityBreakdown: Record<string, number>
}

const EMPTY_STATS: Stats = {
  total: 0,
  byStatus: ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = 0
    return acc
  }, {}),
  daily: 0,
  monthly: 0,
  clients: 0,
  disabilityBreakdown: DISABILITY_TYPES.reduce<Record<string, number>>((acc, d) => {
    acc[d] = 0
    return acc
  }, {}),
}

export default function ReportsPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const statusRef = useRef<any>(null)
  const disabilityRef = useRef<any>(null)
  const [addressGroups, setAddressGroups] = useState<AddressGroup[]>([])
  const [addrSearch, setAddrSearch] = useState('')

  // Filter states
  const [barangayFilter, setBarangayFilter] = useState('')
  const [addrFilter, setAddrFilter] = useState('')
  const [disabilityFilter, setDisabilityFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [causeFilter, setCauseFilter] = useState('')
  const [employmentFilter, setEmploymentFilter] = useState('')
  const [civilFilter, setCivilFilter] = useState('')
  const [educationFilter, setEducationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Age range filters
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')

  // Persistent marker
  const [clearedAt, setClearedAt] = useState<Date | null>(null)

  /* ─────────────────────────────────────────────────────────────
     DATA LOADING
     ───────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    const marker = readClearedAt()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [all, clients] = await Promise.all([
      supabase.from('applications').select('*'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
    ])

    const allRows = (all.data ?? []) as Application[]

    const visibleRows = allRows.filter((r) => isAfterClearedAt(r.submission_date, marker))

    const byStatus: Record<string, number> = {}
    ALL_STATUSES.forEach((s) => { byStatus[s] = 0 })
    const disabilityBreakdown: Record<string, number> = {}
    DISABILITY_TYPES.forEach((d) => { disabilityBreakdown[d] = 0 })

    visibleRows.forEach((a) => {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
      if (Array.isArray(a.disability_types)) {
        a.disability_types.forEach((d: string) => {
          if (disabilityBreakdown[d] !== undefined) disabilityBreakdown[d]++
        })
      }
    })

    const dailyCount = visibleRows.filter((r) => {
      if (!r.submission_date) return false
      const t = new Date(r.submission_date).getTime()
      return !isNaN(t) && t >= todayStart.getTime()
    }).length

    const monthlyCount = visibleRows.filter((r) => {
      if (!r.submission_date) return false
      const t = new Date(r.submission_date).getTime()
      return !isNaN(t) && t >= monthStart.getTime()
    }).length

    setApps(visibleRows)
    setAddressGroups(groupByAddress(visibleRows))
    setStats({
      total: visibleRows.length,
      byStatus,
      daily: dailyCount,
      monthly: monthlyCount,
      clients: clients.count ?? 0,
      disabilityBreakdown,
    })
    setClearedAt(marker)
    setLoading(false)
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  /* ─────────────────────────────────────────────────────────────
     DELETE ALL RECORDS
     ───────────────────────────────────────────────────────────── */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useState('')

  const deleteFiredRef = useRef(false)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (countdown === null) return

    if (countdown > 0) {
      const t = window.setTimeout(() => {
        setCountdown((c) => (c === null ? null : c - 1))
      }, 1000)
      return () => window.clearTimeout(t)
    }

    if (deleteFiredRef.current) return
    deleteFiredRef.current = true
    void runDeleteAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  async function runDeleteAll() {
    setDeleting(true)
    setDeleteError('')

    try {
      const now = new Date()
      writeClearedAt(now)

      setApps([])
      setAddressGroups([])
      setStats(EMPTY_STATS)
      setClearedAt(now)

      setBarangayFilter('')
      setAddrFilter('')
      setDisabilityFilter('')
      setGenderFilter('')
      setNameSearch('')
      setCauseFilter('')
      setEmploymentFilter('')
      setCivilFilter('')
      setEducationFilter('')
      setStatusFilter('')
      setMinAge('')
      setMaxAge('')
    } catch (e: any) {
      setDeleteError(e?.message ?? 'Something went wrong while deleting the records.')
      setDeleting(false)
      setCountdown(null)
      deleteFiredRef.current = false
      return
    }

    setDeleting(false)
    setCountdown(null)
    setDeleteModalOpen(false)
    setConfirmText('')
    deleteFiredRef.current = false
    setToast('All records have been deleted. This is permanent.')
  }

  const openDeleteModal = () => {
    setDeleteError('')
    setConfirmText('')
    setCountdown(null)
    deleteFiredRef.current = false
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    if (deleting || countdown !== null) return
    setDeleteModalOpen(false)
    setConfirmText('')
    setDeleteError('')
  }

  const startDeleteCountdown = () => {
    setDeleteError('')
    deleteFiredRef.current = false
    setCountdown(DELETE_COUNTDOWN_SECONDS)
  }

  const cancelDeleteCountdown = () => {
    deleteFiredRef.current = false
    setCountdown(null)
    setDeleteError('')
  }

  const deleteUnlocked = confirmText.trim().toUpperCase() === 'DELETE'
  const dataCleared = clearedAt !== null

  /* ─────────────────────────────────────────────────────────────
     DERIVED COUNTS / EXPORTS
     ───────────────────────────────────────────────────────────── */
  const maleCount = apps.filter((a) => a.gender === 'Male').length
  const femaleCount = apps.filter((a) => a.gender === 'Female').length

  const doExport = (scope: string, format: 'pdf' | 'excel', gender?: 'Male' | 'Female') => {
    let filtered = filterByScope(apps, scope)
    if (gender) filtered = filtered.filter((a) => a.gender === gender)
    const suffix = gender ? `-${gender.toLowerCase()}` : ''
    const filename = `pdaolink-${scope}${suffix}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filtered, stats, filename)
    else exportExcel(filtered, filename)
  }

  const doGenderExport = (gender: 'Male' | 'Female', format: 'pdf' | 'excel') => {
    const filtered = apps.filter((a) => a.gender === gender)
    const filename = `pdaolink-${gender.toLowerCase()}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filtered, stats, filename)
    else exportExcel(filtered, filename)
  }

  const statusBars = {
    labels: ALL_STATUSES,
    datasets: [{
      label: 'Applications',
      data: ALL_STATUSES.map((s) => stats.byStatus[s] ?? 0),
      backgroundColor: '#0056b3',
      borderRadius: 6,
    }],
  }

  const validDisabilities = Object.entries(stats.disabilityBreakdown).filter(([, v]) => v > 0)
  const disabilityPie = {
    labels: validDisabilities.map(([k]) => k),
    datasets: [{
      data: validDisabilities.map(([, v]) => v),
      backgroundColor: ['#0056b3', '#0d6efd', '#0a9396', '#198754', '#f59e0b', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#adb5bd'],
    }],
  }

  const minAgeNum = parseAgeInput(minAge)
  const maxAgeNum = parseAgeInput(maxAge)
  const ageFilterActive = minAgeNum !== null || maxAgeNum !== null
  const ageRangeInvalid = minAgeNum !== null && maxAgeNum !== null && minAgeNum > maxAgeNum

  const filteredApplicants = apps.filter((app) => {
    const fullName = appFullName(app).toLowerCase()
    const addrParts = [app.address, app.barangay, app.municipality, app.province].filter(Boolean).join(' ').toLowerCase()

    // Barangay filter — exact match on normalized strings
    const matchBarangay =
      barangayFilter === '' ||
      normalizeBarangay((app as any).barangay) === normalizeBarangay(barangayFilter)

    const matchAddress = addrFilter.trim() === '' || addrParts.includes(addrFilter.toLowerCase())
    const matchDisability = disabilityFilter === '' || (app.disability_types && app.disability_types.includes(disabilityFilter))
    const matchGender = genderFilter === '' || app.gender === genderFilter
    const matchName = nameSearch.trim() === '' || fullName.includes(nameSearch.toLowerCase())
    const matchCause = causeFilter === '' || app.disability_cause_type === causeFilter
    const matchEmployment = employmentFilter === '' || app.employment_status === employmentFilter
    const matchCivil = civilFilter === '' || app.civil_status === civilFilter
    const matchEducation = educationFilter === '' || app.educational_attainment === educationFilter
    const matchStatus = statusFilter === '' || app.status === statusFilter

    let matchAge = true
    if (ageFilterActive) {
      const age = getAge(app)
      if (age === null) matchAge = false
      else matchAge = (minAgeNum === null || age >= minAgeNum) && (maxAgeNum === null || age <= maxAgeNum)
    }

    return matchBarangay && matchAddress && matchDisability && matchGender && matchName &&
           matchCause && matchEmployment && matchCivil && matchEducation && matchStatus && matchAge
  })

  /* ─────────────────────────────────────────────────────────────
     AGGREGATE: Disability x Age Bracket x Sex
     ───────────────────────────────────────────────────────────── */
  const disabilityStats = useMemo(() => {
    const result: Record<string, {
      total: number
      male: number
      female: number
      brackets: Record<string, { male: number; female: number }>
    }> = {}

    DISABILITY_TYPES.forEach((d) => {
      result[d] = { total: 0, male: 0, female: 0, brackets: {} }
      AGE_BRACKETS.forEach((b) => {
        result[d].brackets[b.label] = { male: 0, female: 0 }
      })
    })

    let grandTotal = 0
    let grandMale = 0
    let grandFemale = 0

    filteredApplicants.forEach((app) => {
      let disabilities: string[] = []
      if (Array.isArray(app.disability_types) && app.disability_types.length > 0) {
        disabilities = app.disability_types
      } else if (app.disability_type) {
        disabilities = [app.disability_type]
      } else {
        disabilities = ['Unspecified']
      }

      const gender = app.gender
      const age = getAge(app)

      grandTotal++
      if (gender === 'Male') grandMale++
      if (gender === 'Female') grandFemale++

      disabilities.forEach(d => {
        if (!result[d]) {
          result[d] = { total: 0, male: 0, female: 0, brackets: {} }
          AGE_BRACKETS.forEach((b) => {
            result[d].brackets[b.label] = { male: 0, female: 0 }
          })
        }

        result[d].total++
        if (gender === 'Male') result[d].male++
        if (gender === 'Female') result[d].female++

        if (age !== null) {
          const bracket = AGE_BRACKETS.find((b) => age >= b.min && age <= b.max)
          if (bracket) {
            if (gender === 'Male') result[d].brackets[bracket.label].male++
            if (gender === 'Female') result[d].brackets[bracket.label].female++
          }
        }
      })
    })

    const filteredResult: Record<string, any> = {}
    Object.entries(result).forEach(([key, val]) => {
      if (val.total > 0) filteredResult[key] = val
    })

    return { data: filteredResult, grandTotal, grandMale, grandFemale }
  }, [filteredApplicants])

  const exportDisabilityStats = () => {
    const headers = ['Type of Disability', 'Total No. of Individuals', 'Age Range', 'Male', 'Female']
    const rows: string[][] = []

    Object.entries(disabilityStats.data).forEach(([disability, data]: [string, any]) => {
      AGE_BRACKETS.forEach((bracket, index) => {
        rows.push([
          index === 0 ? disability : '',
          index === 0 ? String(data.total) : '',
          bracket.label,
          String(data.brackets[bracket.label].male),
          String(data.brackets[bracket.label].female),
        ])
      })
      rows.push(['TOTAL', String(data.total), '', String(data.male), String(data.female)])
    })

    rows.push(['GRAND TOTAL', String(disabilityStats.grandTotal), '', String(disabilityStats.grandMale), String(disabilityStats.grandFemale)])

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const suffix = barangayFilter ? `-${barangayFilter.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : ''
    link.setAttribute('href', url)
    link.setAttribute('download', `pdaolink-disability-statistics${suffix}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const agesInFiltered = filteredApplicants.map((a) => getAge(a)).filter((n): n is number => n !== null)
  const avgAge = agesInFiltered.length ? Math.round(agesInFiltered.reduce((s, n) => s + n, 0) / agesInFiltered.length) : null

  const filteredCounts = {
    total: filteredApplicants.length,
    male: filteredApplicants.filter((a) => a.gender === 'Male').length,
    female: filteredApplicants.filter((a) => a.gender === 'Female').length,
    employed: filteredApplicants.filter((a) => a.employment_status === 'Employed').length,
    unemployed: filteredApplicants.filter((a) => a.employment_status === 'Unemployed').length,
    selfEmployed: filteredApplicants.filter((a) => a.employment_status === 'Self-employed').length,
    approved: filteredApplicants.filter((a) => a.status === 'Approved').length,
    pending: filteredApplicants.filter((a) => a.status === 'Pending').length,
    seniors: agesInFiltered.filter((n) => n >= 60).length,
    minors: agesInFiltered.filter((n) => n < 18).length,
  }

  const exportFiltered = (format: 'pdf' | 'excel') => {
    const suffix = barangayFilter
      ? `-${barangayFilter.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
      : ''
    const filename = `pdaolink-filtered${suffix}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
    if (format === 'pdf') exportPDF(filteredApplicants as any, stats, filename)
    else exportExcel(filteredApplicants as any, filename)
  }

  const clearFilters = () => {
    setBarangayFilter('')
    setAddrFilter('')
    setDisabilityFilter('')
    setGenderFilter('')
    setNameSearch('')
    setCauseFilter('')
    setEmploymentFilter('')
    setCivilFilter('')
    setEducationFilter('')
    setStatusFilter('')
    setMinAge('')
    setMaxAge('')
  }

  const applyAgePreset = (min: number | null, max: number | null) => {
    const isSame = parseAgeInput(minAge) === min && parseAgeInput(maxAge) === max
    if (isSame) { setMinAge(''); setMaxAge(''); return }
    setMinAge(min === null ? '' : String(min))
    setMaxAge(max === null ? '' : String(max))
  }

  const activeFilterCount = [
    barangayFilter, addrFilter, disabilityFilter, genderFilter, nameSearch,
    causeFilter, employmentFilter, civilFilter, educationFilter, statusFilter,
    minAge, maxAge,
  ].filter((v) => v !== '').length

  const ageLabel = () => {
    if (!ageFilterActive) return 'Age'
    const lo = minAgeNum === null ? '0' : String(minAgeNum)
    const hi = maxAgeNum === null ? '∞' : String(maxAgeNum)
    return `Age ${lo}–${hi}`
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
        <h3 className="mb-1">Reports</h3>
        <p className="text-muted mb-4">Generate and export application reports.</p>

        {/* ─── Banner when records cleared ─── */}
        {dataCleared && (
          <div className="alert alert-secondary d-flex align-items-center gap-2 mb-4">
            <i className="bi bi-trash3-fill fs-5" />
            <div>
              <strong>Records deleted.</strong>{' '}
              <span className="small">
                Everything submitted before{' '}
                <strong>{clearedAt?.toLocaleString()}</strong> is hidden.
                This state is saved and stays even after refreshing.
              </span>
            </div>
          </div>
        )}

        <div className="row g-3 mb-4">
          <StatBox label="Total" value={stats.total} color="primary" />
          <StatBox label="Daily" value={stats.daily} color="info" />
          <StatBox label="Monthly" value={stats.monthly} color="primary" />
          <StatBox label="Approved" value={stats.byStatus['Approved'] ?? 0} color="success" />
          <StatBox label="Rejected" value={stats.byStatus['Rejected'] ?? 0} color="danger" />
          <StatBox label="Clients" value={stats.clients} color="warning" />
        </div>

        <div className="row g-3 mb-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header">
                <i className="bi bi-bar-chart text-primary-pdao me-1" /> Applications by status
              </div>
              <div className="card-body">
                <div className="chart-wrap">
                  <Bar ref={statusRef} data={statusBars} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                  }} />
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header">
                <i className="bi bi-pie-chart text-primary-pdao me-1" /> By disability type
              </div>
              <div className="card-body">
                <div className="chart-wrap">
                  <Pie ref={disabilityRef} data={disabilityPie} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } },
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Export by gender ─── */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header">
            <i className="bi bi-gender-ambiguous text-primary-pdao me-1" /> Export by gender
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <div className="card h-100 border">
                  <div className="card-body">
                    <h6><i className="bi bi-people-fill text-primary-pdao me-1" /> Overall (All)</h6>
                    <p className="text-muted small mb-3">
                      Both male and female applicants.<br />
                      <strong>{stats.total}</strong> total
                    </p>
                    <button className="btn btn-sm btn-primary me-1" onClick={() => doExport('all', 'pdf')}>
                      <i className="bi bi-file-pdf me-1" />PDF
                    </button>
                    <button className="btn btn-sm btn-soft" onClick={() => doExport('all', 'excel')}>
                      <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card h-100 border">
                  <div className="card-body">
                    <h6><i className="bi bi-gender-male text-primary me-1" /> Male applicants</h6>
                    <p className="text-muted small mb-3">
                      All male applicants.<br />
                      <strong>{maleCount}</strong> total
                    </p>
                    <button className="btn btn-sm btn-primary me-1" onClick={() => doGenderExport('Male', 'pdf')} disabled={maleCount === 0}>
                      <i className="bi bi-file-pdf me-1" />PDF
                    </button>
                    <button className="btn btn-sm btn-soft" onClick={() => doGenderExport('Male', 'excel')} disabled={maleCount === 0}>
                      <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card h-100 border">
                  <div className="card-body">
                    <h6><i className="bi bi-gender-female text-danger me-1" /> Female applicants</h6>
                    <p className="text-muted small mb-3">
                      All female applicants.<br />
                      <strong>{femaleCount}</strong> total
                    </p>
                    <button className="btn btn-sm btn-primary me-1" onClick={() => doGenderExport('Female', 'pdf')} disabled={femaleCount === 0}>
                      <i className="bi bi-file-pdf me-1" />PDF
                    </button>
                    <button className="btn btn-sm btn-soft" onClick={() => doGenderExport('Female', 'excel')} disabled={femaleCount === 0}>
                      <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Export reports ─── */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header">
            <i className="bi bi-download text-primary-pdao me-1" /> Export reports
          </div>
          <div className="card-body">
            <div className="row g-3">
              {[
                { scope: 'daily', title: 'Daily applications', desc: 'Applications submitted today.' },
                { scope: 'monthly', title: 'Monthly applications', desc: 'Applications submitted this month.' },
                { scope: 'approved', title: 'Approved applications', desc: 'All approved PWD applications.' },
                { scope: 'rejected', title: 'Rejected applications', desc: 'All rejected applications.' },
              ].map((r) => (
                <div className="col-md-6 col-xl-3" key={r.scope}>
                  <div className="card h-100 border">
                    <div className="card-body">
                      <h6>{r.title}</h6>
                      <p className="text-muted small mb-3">{r.desc}</p>
                      <button className="btn btn-sm btn-primary me-1" onClick={() => doExport(r.scope, 'pdf')}>
                        <i className="bi bi-file-pdf me-1" />PDF
                      </button>
                      <button className="btn btn-sm btn-soft" onClick={() => doExport(r.scope, 'excel')}>
                        <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── FULL DISABILITY STATISTICS TABLE ─── */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span>
              <i className="bi bi-table text-primary-pdao me-1" /> Persons with Disabilities Statistics
              {barangayFilter && (
                <span className="badge bg-primary ms-2">
                  <i className="bi bi-geo-alt me-1" /> {barangayFilter}
                </span>
              )}
            </span>
            <button className="btn btn-sm btn-soft" onClick={exportDisabilityStats}>
              <i className="bi bi-file-earmark-spreadsheet me-1" /> Export Full Table
            </button>
          </div>
          <div className="card-body">
            <div className="d-flex flex-column flex-lg-row gap-4 align-items-start">
              <div className="flex-grow-1 w-100">
                <div className="table-responsive">
                  <table className="table table-bordered table-sm stats-table mb-0">
                    <thead className="table-light text-center align-middle">
                      <tr>
                        <th rowSpan={2} style={{ width: '22%' }}>Type of Disability</th>
                        <th rowSpan={2} style={{ width: '15%' }}>
                          Total No. of Individuals<br />with this Type of Disability
                        </th>
                        <th rowSpan={2} style={{ width: '13%' }}>Age Range</th>
                        <th colSpan={2} style={{ width: '50%' }}>Sex (Disaggregated Total No.)</th>
                      </tr>
                      <tr>
                        <th style={{ width: '25%' }}>Male</th>
                        <th style={{ width: '25%' }}>Female</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(disabilityStats.data).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            {dataCleared
                              ? 'No records — all data has been deleted.'
                              : 'No disability data available for the current filter.'}
                          </td>
                        </tr>
                      ) : (
                        Object.entries(disabilityStats.data).map(([disability, data]: [string, any]) => {
                          return (
                            <React.Fragment key={disability}>
                              {AGE_BRACKETS.map((bracket, index) => {
                                const bData = data.brackets[bracket.label] || { male: 0, female: 0 }
                                return (
                                  <tr key={bracket.label}>
                                    {index === 0 && (
                                      <td
                                        rowSpan={AGE_BRACKETS.length}
                                        className="fw-bold align-middle text-uppercase bg-light"
                                        style={{ wordBreak: 'break-word', minWidth: '150px' }}
                                      >
                                        {disability}
                                      </td>
                                    )}
                                    {index === 0 && (
                                      <td rowSpan={AGE_BRACKETS.length} className="text-center align-middle fw-bold">
                                        {data.total}
                                      </td>
                                    )}
                                    <td className="text-center">{bracket.label}</td>
                                    <td className="text-center">{bData.male}</td>
                                    <td className="text-center">{bData.female}</td>
                                  </tr>
                                )
                              })}
                              <tr className="fw-bold bg-light">
                                <td className="text-center">TOTAL</td>
                                <td className="text-center">{data.total}</td>
                                <td className="text-center"></td>
                                <td className="text-center">{data.male}</td>
                                <td className="text-center">{data.female}</td>
                              </tr>
                            </React.Fragment>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="d-flex flex-column justify-content-center align-items-center border rounded p-4 bg-light" style={{ minWidth: '220px', width: '220px' }}>
                <div className="text-center fw-bold mb-3" style={{ fontSize: '0.9rem', lineHeight: '1.3' }}>
                  Total No. of Persons<br />with Disabilities<br />
                  {barangayFilter ? `in ${barangayFilter}` : 'within Jurisdiction'}:
                </div>
                <div className="fs-2 fw-bold text-primary">
                  {disabilityStats.grandTotal.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Search Applicants Section ─── */}
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span>
              <i className="bi bi-search text-primary-pdao me-1" /> Search Applicants
              <span className="badge bg-primary ms-2">{filteredApplicants.length} of {apps.length}</span>
              {activeFilterCount > 0 && (
                <span className="badge bg-info text-dark ms-2">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                </span>
              )}
              {barangayFilter && (
                <span className="badge bg-success ms-2">
                  <i className="bi bi-geo-alt-fill me-1" /> {barangayFilter}
                </span>
              )}
            </span>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters} disabled={activeFilterCount === 0}>
                <i className="bi bi-x-circle me-1" /> Clear
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => exportFiltered('pdf')}
                disabled={filteredApplicants.length === 0}
              >
                <i className="bi bi-file-pdf me-1" />PDF
              </button>
              <button
                className="btn btn-sm btn-soft"
                onClick={() => exportFiltered('excel')}
                disabled={filteredApplicants.length === 0}
              >
                <i className="bi bi-file-earmark-spreadsheet me-1" />Excel
              </button>
            </div>
          </div>
          <div className="card-body">

            {/* ─── Live summary chips ─── */}
            <div className="summary-chips mb-3">
              <span className="chip chip-primary"><strong>{filteredCounts.total}</strong> total</span>
              <span className="chip chip-blue"><i className="bi bi-gender-male me-1" /><strong>{filteredCounts.male}</strong> male</span>
              <span className="chip chip-pink"><i className="bi bi-gender-female me-1" /><strong>{filteredCounts.female}</strong> female</span>
              <span className="chip chip-success"><i className="bi bi-check-circle me-1" /><strong>{filteredCounts.approved}</strong> approved</span>
              <span className="chip chip-warning"><i className="bi bi-hourglass-split me-1" /><strong>{filteredCounts.pending}</strong> pending</span>
              <span className="chip chip-info"><i className="bi bi-briefcase me-1" /><strong>{filteredCounts.employed}</strong> employed</span>
              <span className="chip chip-secondary"><i className="bi bi-person-dash me-1" /><strong>{filteredCounts.unemployed}</strong> unemployed</span>
              {avgAge !== null && (
                <span className="chip chip-purple">
                  <i className="bi bi-graph-up me-1" />avg age <strong>{avgAge}</strong>
                </span>
              )}
              {filteredCounts.seniors > 0 && (
                <span className="chip chip-teal">
                  <i className="bi bi-person-wheelchair me-1" /><strong>{filteredCounts.seniors}</strong> senior (60+)
                </span>
              )}
            </div>

            {/* ─── Filter row 1 ─── */}
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <label className="form-label small text-muted">Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search name…"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>

              {/* ── Barangay dropdown ── */}
              <div className="col-md-3">
                <label className="form-label small text-muted">
                  <i className="bi bi-geo-alt me-1" />Barangay
                </label>
                <select
                  className="form-select"
                  value={barangayFilter}
                  onChange={(e) => setBarangayFilter(e.target.value)}
                >
                  <option value="">All Barangays</option>
                  {CAUAYAN_BARANGAYS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {barangayFilter && (
                  <div className="small text-muted mt-1">
                    <i className="bi bi-funnel me-1" />
                    {filteredApplicants.length} match{filteredApplicants.length !== 1 ? 'es' : ''}
                  </div>
                )}
              </div>

              <div className="col-md-3">
                <label className="form-label small text-muted">Disability Type</label>
                <select
                  className="form-select"
                  value={disabilityFilter}
                  onChange={(e) => setDisabilityFilter(e.target.value)}
                >
                  <option value="">All Disabilities</option>
                  {DISABILITY_TYPES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Gender</label>
                <select
                  className="form-select"
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                >
                  <option value="">All Genders</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ─── Filter row 2 ─── */}
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <label className="form-label small text-muted">Address (street / municipality)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Poblacion, Cauayan"
                  value={addrFilter}
                  onChange={(e) => setAddrFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Cause of Disability</label>
                <select
                  className="form-select"
                  value={causeFilter}
                  onChange={(e) => setCauseFilter(e.target.value)}
                >
                  <option value="">All Causes</option>
                  {CAUSE_TYPE_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Employment Status</label>
                <select
                  className="form-select"
                  value={employmentFilter}
                  onChange={(e) => setEmploymentFilter(e.target.value)}
                >
                  <option value="">All Employment</option>
                  {EMPLOYMENT_STATUS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Civil Status</label>
                <select
                  className="form-select"
                  value={civilFilter}
                  onChange={(e) => setCivilFilter(e.target.value)}
                >
                  <option value="">All Civil Statuses</option>
                  {CIVIL_STATUS_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ─── Filter row 3 ─── */}
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <label className="form-label small text-muted">Educational Attainment</label>
                <select
                  className="form-select"
                  value={educationFilter}
                  onChange={(e) => setEducationFilter(e.target.value)}
                >
                  <option value="">All Educational Levels</option>
                  {EDUCATIONAL_ATTAINMENT.map((ed) => (
                    <option key={ed} value={ed}>{ed}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Application Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label small text-muted">
                  <i className="bi bi-calendar-event me-1" />Min Age
                </label>
                <input
                  type="number"
                  className={`form-control ${ageRangeInvalid ? 'is-invalid' : ''}`}
                  placeholder="e.g. 18"
                  min={0}
                  max={130}
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  disabled={dataCleared}
                />
              </div>

              <div className="col-md-2">
                <label className="form-label small text-muted">
                  <i className="bi bi-calendar-event me-1" />Max Age
                </label>
                <input
                  type="number"
                  className={`form-control ${ageRangeInvalid ? 'is-invalid' : ''}`}
                  placeholder="e.g. 59"
                  min={0}
                  max={130}
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                  disabled={dataCleared}
                />
                {ageRangeInvalid && (
                  <div className="invalid-feedback">
                    Min age can&apos;t be greater than max age.
                  </div>
                )}
              </div>

              <div className="col-md-2">
                <label className="form-label small text-muted d-block">Quick ranges</label>
                <div className="d-flex flex-wrap gap-1">
                  <button
                    type="button"
                    className={`btn btn-sm ${parseAgeInput(minAge) === 0 && parseAgeInput(maxAge) === 17 ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => applyAgePreset(0, 17)}
                    disabled={dataCleared}
                  >
                    0–17
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${parseAgeInput(minAge) === 18 && parseAgeInput(maxAge) === 30 ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => applyAgePreset(18, 30)}
                    disabled={dataCleared}
                  >
                    18–30
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${parseAgeInput(minAge) === 31 && parseAgeInput(maxAge) === 59 ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => applyAgePreset(31, 59)}
                    disabled={dataCleared}
                  >
                    31–59
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${parseAgeInput(minAge) === 60 && parseAgeInput(maxAge) === null ? 'btn-primary' : 'btn-soft'}`}
                    onClick={() => applyAgePreset(60, null)}
                    disabled={dataCleared}
                  >
                    60+
                  </button>
                </div>
              </div>
            </div>

            {/* Age filter helper line */}
            {ageFilterActive && !dataCleared && (
              <div className="d-flex align-items-center gap-2 mb-3 small text-muted">
                <i className="bi bi-funnel-fill text-primary-pdao" />
                Age filter active: <strong>{ageLabel()}</strong>
                {agesInFiltered.length > 0 && (
                  <span>· {agesInFiltered.length} applicant{agesInFiltered.length !== 1 ? 's' : ''} with a recorded age</span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 ms-1"
                  onClick={() => { setMinAge(''); setMaxAge('') }}
                >
                  reset
                </button>
              </div>
            )}

            {filteredApplicants.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>Barangay</th>
                      <th>Address</th>
                      <th>Disability</th>
                      <th>Cause</th>
                      <th>Employment</th>
                      <th>Civil Status</th>
                      <th>Education</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplicants.map((app) => {
                      const addr = [app.municipality, app.province].filter(Boolean).join(', ')
                      const age = getAge(app)
                      const disabilityDisplay = Array.isArray(app.disability_types) && app.disability_types.length > 0
                        ? app.disability_types.join(', ')
                        : (app.disability_type || '—')
                      return (
                        <tr key={app.id}>
                          <td className="fw-semibold">{appFullName(app)}</td>
                          <td className="small">
                            {age !== null ? (
                              <>
                                {age}
                                {age >= 60 && (
                                  <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>Senior</span>
                                )}
                              </>
                            ) : '—'}
                          </td>
                          <td>{app.gender || '—'}</td>
                          <td className="small">
                            {app.barangay || '—'}
                          </td>
                          <td className="small text-muted">{addr || app.address || '—'}</td>
                          <td className="small">{disabilityDisplay}</td>
                          <td className="small">{app.disability_cause_type || '—'}</td>
                          <td className="small">{app.employment_status || '—'}</td>
                          <td className="small">{app.civil_status || '—'}</td>
                          <td className="small">{app.educational_attainment || '—'}</td>
                          <td>
                            <span className={`badge status-badge ${statusColor(app.status)}`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="small text-muted">{fmtDate(app.submission_date)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className={`bi ${dataCleared ? 'bi-trash3' : 'bi-search'} d-block mb-2`} style={{ fontSize: '2rem' }} />
                <p className="mb-0">
                  {dataCleared
                    ? 'No records — all data has been deleted.'
                    : 'No applicants match your search criteria.'}
                </p>
                {!dataCleared && ageFilterActive && (
                  <p className="small mt-1 mb-0">
                    Tip: some records may not have a recorded age or birth date.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── DELETE ZONE ─── */}
        <div className="card border-danger shadow-sm mt-4">
          <div className="card-header bg-danger-subtle text-danger-emphasis fw-semibold">
            <i className="bi bi-exclamation-triangle-fill me-1" /> Danger zone
          </div>
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <h6 className="mb-1">Delete all application records</h6>
              <p className="text-muted small mb-0">
                Removes <strong>{apps.length}</strong> record
                {apps.length !== 1 ? 's' : ''} from this page.{' '}
                <strong>This is permanent and survives refreshes.</strong> You&apos;ll
                get a <strong>{DELETE_COUNTDOWN_SECONDS}-second countdown</strong> you
                can cancel before the deletion goes through.
              </p>
            </div>
            <button
              className="btn btn-danger"
              onClick={openDeleteModal}
              disabled={apps.length === 0 || loading}
            >
              <i className="bi bi-trash3 me-1" /> Delete all records
            </button>
          </div>
        </div>
      </div>

      {/* ─── DELETE CONFIRMATION / COUNTDOWN MODAL ─── */}
      {deleteModalOpen && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1055 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">

                <div className="modal-header">
                  <h5 className="modal-title">
                    {deleting
                      ? 'Deleting records…'
                      : countdown !== null
                        ? 'Deleting soon — cancel now'
                        : 'Delete all application records?'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeDeleteModal}
                    disabled={deleting || countdown !== null}
                    aria-label="Close"
                  />
                </div>

                <div className="modal-body">

                  {!deleting && countdown === null && (
                    <>
                      <div className="alert alert-danger d-flex gap-2 mb-3">
                        <i className="bi bi-exclamation-octagon-fill flex-shrink-0" />
                        <div className="small">
                          This will delete <strong>all {apps.length}</strong>{' '}
                          record{apps.length !== 1 ? 's' : ''} from this page.
                          <br />
                          <strong>This is permanent</strong> — the state is saved
                          and stays even after you refresh or close the browser.
                          (You can later reverse this in your browser settings by
                          clearing site data.)
                        </div>
                      </div>

                      <label className="form-label small text-muted">
                        Type <code className="text-danger fw-bold">DELETE</code> to unlock
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="DELETE"
                        autoComplete="off"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                      />
                    </>
                  )}

                  {countdown !== null && !deleting && (
                    <div className="text-center py-2">
                      <div className="countdown-circle">{countdown}</div>
                      <p className="mb-1 fw-semibold">
                        Deleting in {countdown} second{countdown !== 1 ? 's' : ''}…
                      </p>
                      <p className="text-muted small mb-3">
                        Click <strong>Cancel</strong> to stop this — nothing has been deleted yet.
                      </p>
                      <div className="progress" style={{ height: 8 }}>
                        <div
                          className="progress-bar bg-danger progress-bar-striped progress-bar-animated"
                          role="progressbar"
                          style={{ width: `${(countdown / DELETE_COUNTDOWN_SECONDS) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {deleting && (
                    <div className="text-center py-4">
                      <div className="spinner-border text-danger mb-3" role="status" />
                      <p className="mb-0 fw-semibold">Deleting all records…</p>
                      <p className="text-muted small mb-0">Please don&apos;t close this window.</p>
                    </div>
                  )}

                  {deleteError && (
                    <div className="alert alert-warning mt-3 mb-0 small">
                      <i className="bi bi-x-octagon me-1" />
                      {deleteError}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  {countdown === null && !deleting && (
                    <>
                      <button className="btn btn-soft" onClick={closeDeleteModal}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={!deleteUnlocked}
                        onClick={startDeleteCountdown}
                      >
                        <i className="bi bi-trash3 me-1" />
                        Delete everything ({DELETE_COUNTDOWN_SECONDS}s)
                      </button>
                    </>
                  )}

                  {countdown !== null && !deleting && (
                    <button className="btn btn-primary w-100" onClick={cancelDeleteCountdown}>
                      <i className="bi bi-hand-index-thumb me-1" />
                      Cancel — keep my records
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />
        </>
      )}

      {/* ─── Success toast ─── */}
      {toast && (
        <div className="app-toast">
          <i className="bi bi-check-circle-fill text-success me-2" />
          {toast}
        </div>
      )}

      <style>{`
        .summary-chips {
          display: flex; flex-wrap: wrap; gap: 0.5rem;
        }
        .summary-chips .chip {
          padding: 0.35rem 0.75rem; border-radius: 999px;
          font-size: 0.82rem; font-weight: 500;
          border: 1px solid transparent; white-space: nowrap;
        }
        .chip-primary { background: rgba(0,86,179,.1); color: #0056b3; border-color: rgba(0,86,179,.2); }
        .chip-blue    { background: rgba(13,110,253,.1); color: #0d6efd; border-color: rgba(13,110,253,.2); }
        .chip-pink    { background: rgba(214,51,132,.1); color: #d63384; border-color: rgba(214,51,132,.2); }
        .chip-success { background: rgba(25,135,84,.1); color: #198754; border-color: rgba(25,135,84,.2); }
        .chip-warning { background: rgba(255,193,7,.15); color: #997404; border-color: rgba(255,193,7,.3); }
        .chip-info    { background: rgba(13,202,240,.12); color: #087990; border-color: rgba(13,202,240,.25); }
        .chip-secondary { background: rgba(108,117,125,.12); color: #495057; border-color: rgba(108,117,125,.25); }
        .chip-purple  { background: rgba(111,66,193,.1); color: #6f42c1; border-color: rgba(111,66,193,.22); }
        .chip-teal    { background: rgba(32,201,151,.12); color: #12795c; border-color: rgba(32,201,151,.28); }

        .stats-table th, .stats-table td {
          vertical-align: middle;
          font-size: 0.82rem;
          border-color: #333 !important;
        }
        .stats-table thead th {
          background-color: #f2f2f2 !important;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.75rem;
        }
        .stats-table tbody tr:last-child td {
          border-bottom: 2px solid #333 !important;
        }

        .countdown-circle {
          width: 96px; height: 96px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1rem;
          font-size: 2.5rem; font-weight: 700; color: #dc3545;
          border: 4px solid rgba(220,53,69,.25);
          background: rgba(220,53,69,.06);
          animation: countdownPulse 1s ease-in-out infinite;
        }
        @keyframes countdownPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.07); }
        }

        .app-toast {
          position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 2000;
          background: #fff; border: 1px solid rgba(25,135,84,.3);
          border-left: 4px solid #198754;
          border-radius: .5rem; padding: .75rem 1rem;
          box-shadow: 0 .5rem 1.5rem rgba(0,0,0,.15);
          font-size: .9rem; font-weight: 500;
          animation: toastIn .25s ease-out;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AppLayout>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="col-6 col-xl-2">
      <div className="card stat-card h-100">
        <div className="card-body">
          <div className="stat-label">{label}</div>
          <div className={`stat-value text-${color}`}>{value}</div>
        </div>
      </div>
    </div>
  )
}