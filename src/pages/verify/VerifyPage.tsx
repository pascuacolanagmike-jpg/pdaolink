import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

type Slot = 'id' | 'birth_cert' | 'medical_abstract'

const SLOTS: { key: Slot; label: string; hint: string }[] = [
  { key: 'id',               label: 'Valid ID',          hint: "Driver's license, PhilSys, passport, UMID — PNG only" },
  { key: 'birth_cert',       label: 'Birth certificate', hint: 'PSA-issued — PNG only' },
  { key: 'medical_abstract', label: 'Medical abstract',  hint: 'Signed by your physician — PNG only' },
]

const ALLOWED_MIME = ['image/png'] as const
type AllowedMime = (typeof ALLOWED_MIME)[number]

const SLOT_MIME: Record<Slot, readonly AllowedMime[]> = {
  id:               ['image/png'],
  birth_cert:       ['image/png'],
  medical_abstract: ['image/png'],
}

const EXT_BY_MIME: Record<AllowedMime, string> = { 'image/png': 'png' }
const EXT_TO_MIME: Record<string, AllowedMime> = { png: 'image/png' }
const MIME_TO_EXT: Record<AllowedMime, string[]> = { 'image/png': ['.png'] }

function acceptFor(slot: Slot): string {
  return SLOT_MIME[slot].flatMap(m => [m, ...MIME_TO_EXT[m]]).join(',')
}

function resolveMime(file: File, slot: Slot): AllowedMime | null {
  const byType = ALLOWED_MIME.includes(file.type as AllowedMime)
    ? (file.type as AllowedMime)
    : null
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = byType ?? EXT_TO_MIME[ext] ?? null
  if (!mime) return null
  return SLOT_MIME[slot].includes(mime) ? mime : null
}

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

// ─── Types & Parser for Mindee Text ───
interface ExtractedIdData {
  lastName: string
  firstName: string
  middleName: string
  suffix: string
  sex: string
  birthDate: string
  civilStatus: string
}

const EMPTY_RESULT: ExtractedIdData = {
  lastName: '', firstName: '', middleName: '', suffix: '', sex: '', birthDate: '', civilStatus: '',
}

// ─── PARSER: Handles PhilSys & UMID layouts ───
function parseTextToFields(rawText: string): ExtractedIdData {
  const text = rawText.toUpperCase().replace(/\n/g, ' ').replace(/\s+/g, ' ')
  const STOP_LABELS = 'SURNAME|LAST NAME|APELYIDO|GIVEN NAME|GIVEN NAMES|FIRST NAME|MGA PANGALAN|MIDDLE NAME|GITNANG APELYIDO|DATE OF BIRTH|PETSA NG KAPANGANAKAN|SEX|KASARIAN|ADDRESS|TIRAHAN|NATIONALITY|CIVIL STATUS|KALAGAYANG SIBIL|STATUS|COLOR|HAIR|EYE|BLOOD|WEIGHT|HEIGHT|$'

  const extractField = (labels: string[]): string => {
    const labelRegex = labels.join('|')
    const regex = new RegExp(`(?:${labelRegex})[\\s:\\/]*([\\s\\S]*?)(?=${STOP_LABELS})`, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      return match[1].replace(/[^A-ZÑ\s]/gi, '').replace(/\s+/g, ' ').trim()
    }
    return ''
  }

  const extractDate = (): string => {
    const dobRegex = /(?:DATE OF BIRTH|PETSA NG KAPANGANAKAN|BIRTHDATE|DOB)[\s:\/]*([A-Z0-9,\s\/\-]+)/i
    const match = text.match(dobRegex)
    const dateStr = match ? match[1] : text

    const numericMatch = dateStr.match(/(19|20)\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/)
    if (numericMatch) {
      const parts = numericMatch[0].split(/[\/\-\.]/)
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
    }

    const months: Record<string, string> = {
      JANUARY: '01', FEBRUARY: '02', MARCH: '03', APRIL: '04', MAY: '05', JUNE: '06',
      JULY: '07', AUGUST: '08', SEPTEMBER: '09', OCTOBER: '10', NOVEMBER: '11', DECEMBER: '12',
      JAN: '01', FEB: '02', MAR: '03', APR: '04', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    }
    const monthRegex = /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2}),?\s+(\d{4})/i
    const m = dateStr.match(monthRegex)
    if (m) {
      return `${m[3]}-${months[m[1].toUpperCase()]}-${m[2].padStart(2, '0')}`
    }

    return ''
  }

  const extractSex = (): string => {
    const match = text.match(/(?:SEX|KASARIAN)[\s:\/]*([MF])/i)
    return match ? (match[1].toUpperCase() === 'M' ? 'Male' : 'Female') : ''
  }

  const extractStatus = (): string => {
    const match = text.match(/(?:CIVIL STATUS|KALAGAYANG SIBIL|STATUS)[\s:\/]*(SINGLE|MARRIED|WIDOWED|SEPARATED|SOLO PARENT|ANNULLED)/i)
    return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : ''
  }

  const result: ExtractedIdData = {
    lastName: extractField(['SURNAME', 'LAST NAME', 'APELYIDO']),
    firstName: extractField(['GIVEN NAME', 'GIVEN NAMES', 'FIRST NAME', 'MGA PANGALAN']),
    middleName: extractField(['MIDDLE NAME', 'GITNANG APELYIDO']),
    sex: extractSex(),
    birthDate: extractDate(),
    civilStatus: extractStatus(),
    suffix: '',
  }

  const allNames = `${result.lastName} ${result.firstName} ${result.middleName}`
  const suffixMatch = allNames.match(/\b(JR|SR|II|III|IV|V)\b/i)
  if (suffixMatch) result.suffix = suffixMatch[0].toUpperCase()

  return result
}

// ─── API call to Vite's built-in Mindee endpoint ───
async function runMindeeBackend(file: File): Promise<ExtractedIdData> {
  const form = new FormData()
  form.append('document', file)

  const res = await fetch('/api/ocr', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Backend error: ${body}`)
  }

  const json = await res.json()
  return parseTextToFields(json.text)
}

export default function VerifyPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [uploaded, setUploaded] = useState<Partial<Record<Slot, string>>>({})
  const [busy, setBusy] = useState<Slot | null>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [submitting, setSubmitting] = useState(false)

  // ─── OCR Status State ───
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')

  const phoneValid = useMemo(() => {
    const cleaned = phone.replace(/[\s\-()]/g, '')
    return /^(?:\+63|0)9\d{9}$/.test(cleaned)
  }, [phone])

  const normalizePhone = (raw: string) => {
    const cleaned = raw.replace(/[\s\-()]/g, '')
    if (cleaned.startsWith('+63')) return cleaned
    if (cleaned.startsWith('0')) return '+63' + cleaned.slice(1)
    return cleaned
  }

  const handlePhoneChange = (value: string) => {
    if (/^[+]?[\d\s\-()]*$/.test(value)) setPhone(value)
  }

  async function runOcr(file: File) {
    setOcrStatus('scanning')
    
    try {
      const parsed = await runMindeeBackend(file)

      // Save to Supabase profiles
      if (user) {
        await supabase
          .from('profiles')
          .update({
            first_name: parsed.firstName || null,
            last_name: parsed.lastName || null,
            suffix: parsed.suffix || null,
            birth_date: parsed.birthDate || null,
            gender: parsed.sex || null,
            civil_status: parsed.civilStatus || null,
          })
          .eq('id', user.id)
        
        await refreshProfile?.()
      }
      
      setOcrStatus('success')
    } catch (e: any) {
      console.error("OCR Failed:", e)
      setOcrStatus('error')
    }
  }

  async function upload(slot: Slot, file: File) {
    if (!user) return
    setError(null)

    const mime = resolveMime(file, slot)
    if (!mime) {
      setError('Only PNG files are allowed.')
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setError('File must be 10 MB or smaller.')
      return
    }

    setBusy(slot)
    try {
      const ext = EXT_BY_MIME[mime]
      const path = `${user.id}/${slot}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('verification-docs')
        .upload(path, file, { upsert: true, contentType: mime })
      if (upErr) throw upErr

      const { error: dbErr } = await supabase
        .from('verification_docs')
        .upsert(
          { user_id: user.id, doc_type: slot, storage_path: path },
          { onConflict: 'user_id,doc_type' }
        )
      if (dbErr) throw dbErr

      const previous = uploaded[slot]
      if (previous && previous !== path) {
        await supabase.storage.from('verification-docs').remove([previous])
      }

      setUploaded(u => ({ ...u, [slot]: path }))

      // ─── Fire Mindee OCR on the ID slot ───
      if (slot === 'id') {
        void runOcr(file)
      }

    } catch (e: any) {
      setError(e.message ?? 'Upload failed.')
    } finally {
      setBusy(null)
    }
  }

  async function submit() {
    if (!consent) return setError('Please give consent to process your documents.')
    if (Object.keys(uploaded).length < 3) return setError('Please upload all three documents.')
    if (!phoneValid) return setError('Please enter a valid PH mobile number (e.g., 0917 123 4567).')

    setSubmitting(true)
    setError(null)

    if (user) {
      const { error: phoneErr } = await supabase
        .from('profiles')
        .update({ phone: normalizePhone(phone) })
        .eq('id', user.id)
      if (phoneErr) {
        setSubmitting(false)
        return setError('Could not save phone number: ' + phoneErr.message)
      }
    }

    const { error } = await supabase.rpc('submit_verification')
    setSubmitting(false)
    if (error) return setError(error.message)

    await refreshProfile?.()
    navigate('/verify/pending', { replace: true })
  }

  const allUploaded = Object.keys(uploaded).length === 3

  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <div className="text-center mb-4">
        <img
          src="https://cdn.postimage.me/2026/09/13/cropped_circle_image-1.png"
          alt="PDAOLink"
          className="mb-3"
          style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }}
        />
        <h3 className="mb-1">Verify your identity</h3>
        <p className="text-muted mb-0">
          Upload the three documents below. An administrator will review them
          before your account is activated. All documents must be PNG images.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {SLOTS.map(s => (
        <div className="card mb-3 shadow-sm border-0" key={s.key}>
          <div className="card-body d-flex justify-content-between align-items-center">
            <div>
              <div className="fw-semibold">{s.label}</div>
              <div className="text-muted small">{s.hint}</div>
            </div>
            <div>
              {uploaded[s.key] ? (
                <span className="text-success small">
                  <i className="bi bi-check-circle-fill me-1" /> Uploaded
                </span>
              ) : busy === s.key ? (
                <span className="spinner-border spinner-border-sm text-primary" />
              ) : (
                <label className="btn btn-outline-primary btn-sm mb-0">
                  <i className="bi bi-upload me-1" /> Choose file
                  <input
                    type="file"
                    accept={acceptFor(s.key)}
                    hidden
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) upload(s.key, f)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* ─── OCR STATUS UI ─── */}
      {ocrStatus === 'scanning' && (
        <div className="alert alert-info d-flex align-items-center gap-2 shadow-sm border-0">
          <span className="spinner-border spinner-border-sm text-info" />
          <span><strong>Please wait.</strong> We are scanning your ID and auto-filling your details...</span>
        </div>
      )}

      {ocrStatus === 'success' && (
        <div className="alert alert-success d-flex align-items-center gap-2 shadow-sm border-0">
          <i className="bi bi-check-circle-fill fs-5 text-success" />
          <span><strong>Thank you for waiting!</strong> Your details have been saved. Please upload the other supporting documents.</span>
        </div>
      )}

      {ocrStatus === 'error' && (
        <div className="alert alert-warning d-flex align-items-center gap-2 shadow-sm border-0">
          <i className="bi bi-exclamation-triangle-fill fs-5 text-warning" />
          <span>We couldn't read the ID automatically. Don't worry — you can manually type your details in the next step.</span>
        </div>
      )}

      <div className="card mb-3 shadow-sm border-0">
        <div className="card-body">
          <label className="form-label fw-semibold mb-1">
            <i className="bi bi-phone me-1" />
            Mobile number
          </label>
          <p className="text-muted small mb-2">
            We'll text you at this number when your account is approved. Use a number you can check immediately.
          </p>
          <div className="input-group">
            <span className="input-group-text bg-white"><i className="bi bi-telephone" /></span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={`form-control ${phone && !phoneValid ? 'is-invalid' : ''} ${phone && phoneValid ? 'is-valid' : ''}`}
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="0917 123 4567"
            />
          </div>
          {phone && !phoneValid && (
            <div className="text-danger small mt-1">
              <i className="bi bi-exclamation-circle me-1" />
              Enter a valid PH mobile number (e.g., 0917 123 4567 or +63 917 123 4567)
            </div>
          )}
          {phone && phoneValid && (
            <div className="text-success small mt-1">
              <i className="bi bi-check-circle me-1" />
              We'll text you at {normalizePhone(phone)}
            </div>
          )}
        </div>
      </div>

      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="consent"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
        />
        <label className="form-check-label small" htmlFor="consent">
          I consent to PDAOLink processing these documents for identity verification
          under RA 10173. Documents are used only for verification and are deleted
          after review.
        </label>
      </div>

      <button
        className="btn btn-primary w-100 py-2"
        onClick={submit}
        disabled={!!busy || !allUploaded || !consent || !phoneValid || submitting || ocrStatus === 'scanning'}
      >
        {submitting ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" /> Submitting…
          </>
        ) : (
          <>
            <i className="bi bi-send me-1" /> Submit for review
          </>
        )}
      </button>
    </div>
  )
}