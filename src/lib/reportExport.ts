import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Application } from './types'
import { appFullName, ALL_STATUSES } from './types'

interface ReportStats {
  total: number
  byStatus: Record<string, number>
  daily: number
  monthly: number
  clients: number
}

export function exportExcel(apps: Application[], filename: string) {
  const rows = apps.map((a) => ({
    'Application ID': a.id.slice(0, 8),
    Applicant: appFullName(a) || '—',
    Email: a.email ?? '—',
    'Disability Type': a.disability_type ?? '—',
    Status: a.status,
    'Submission Date': a.submission_date ? new Date(a.submission_date).toLocaleDateString() : '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Applications')
  XLSX.writeFile(wb, filename)
}

export function exportPDF(apps: Application[], stats: ReportStats | null, filename: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(18)
  doc.text('PDAOLink — Applications Report', 40, 40)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 58)

  let y = 90
  if (stats) {
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Count']],
      body: [
        ['Total Applicants', String(stats.total)],
        ['Pending', String(stats.byStatus['Pending'] ?? 0)],
        ['Under Review', String(stats.byStatus['Under Review'] ?? 0)],
        ['Approved', String(stats.byStatus['Approved'] ?? 0)],
        ['Rejected', String(stats.byStatus['Rejected'] ?? 0)],
        ['Clients', String(stats.clients)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 86, 179], textColor: 255 },
      columnStyles: { 0: { cellWidth: 180 } },
      margin: { left: 40, right: 40 },
    })
    // @ts-expect-error lastAutoTable is added by the plugin
    y = (doc.lastAutoTable?.finalY ?? y) + 24
  }

  autoTable(doc, {
    startY: y,
    head: [['ID', 'Applicant', 'Email', 'Disability Type', 'Status', 'Submitted']],
    body: apps.map((a) => [
      a.id.slice(0, 8),
      appFullName(a) || '—',
      a.email ?? '—',
      a.disability_type ?? '—',
      a.status,
      a.submission_date ? new Date(a.submission_date).toLocaleDateString() : '',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [0, 86, 179], textColor: 255 },
    styles: { fontSize: 8 },
    margin: { left: 40, right: 40 },
  })

  doc.save(filename)
}

export function filterByScope(apps: Application[], scope: string): Application[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  if (scope === 'daily') return apps.filter((a) => a.submission_date && new Date(a.submission_date).getTime() >= todayStart)
  if (scope === 'monthly') return apps.filter((a) => a.submission_date && new Date(a.submission_date).getTime() >= monthStart)
  if (scope === 'approved') return apps.filter((a) => a.status === 'Approved')
  if (scope === 'rejected') return apps.filter((a) => a.status === 'Rejected')
  return apps
}

export interface AddressGroup {
  address: string
  count: number
  applicants: { name: string; status: string; disability: string }[]
}

export function groupByAddress(apps: Application[]): AddressGroup[] {
  const map = new Map<string, AddressGroup>()
  for (const a of apps) {
    const rawAddr = [a.address, a.barangay, a.municipality, a.province].filter(Boolean).join(', ')
    const key = rawAddr || 'No address provided'
    const existing = map.get(key)
    if (existing) {
      existing.count++
      existing.applicants.push({
        name: appFullName(a) || '—',
        status: a.status,
        disability: a.disability_type ?? (a.disability_types ?? []).join(', ') ?? '—',
      })
    } else {
      map.set(key, {
        address: key,
        count: 1,
        applicants: [{
          name: appFullName(a) || '—',
          status: a.status,
          disability: a.disability_type ?? (a.disability_types ?? []).join(', ') ?? '—',
        }],
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

export function exportAddressExcel(groups: AddressGroup[], filename: string) {
  const rows: Record<string, string | number>[] = []
  for (const g of groups) {
    g.applicants.forEach((p, i) => {
      rows.push({
        'Address': g.address,
        'Applicants at Address': i === 0 ? g.count : '',
        'Applicant Name': p.name,
        'Disability Type': p.disability,
        'Status': p.status,
      })
    })
  }
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 25 }, { wch: 28 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'By Address')
  XLSX.writeFile(wb, filename)
}

export function exportAddressPDF(groups: AddressGroup[], filename: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(18)
  doc.text('PDAOLink — Applicants by Address', 40, 40)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 58)

  const body: (string | number)[][] = []
  for (const g of groups) {
    g.applicants.forEach((p, i) => {
      body.push([
        i === 0 ? g.address : '',
        i === 0 ? String(g.count) : '',
        p.name,
        p.disability,
        p.status,
      ])
    })
  }

  autoTable(doc, {
    startY: 80,
    head: [['Address', 'Count', 'Applicant Name', 'Disability Type', 'Status']],
    body,
    theme: 'striped',
    headStyles: { fillColor: [0, 86, 179], textColor: 255 },
    styles: { fontSize: 8 },
    margin: { left: 40, right: 40 },
  })

  doc.save(filename)
}

export { ALL_STATUSES }
