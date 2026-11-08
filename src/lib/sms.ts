// lib/sms.ts
// ─────────────────────────────────────────────────────────────────────────
// ⚠️  DIRECT FRONTEND CALL — API key is exposed in the browser bundle.
//     Fine for testing / internal use. Do NOT ship to public users as-is.
//     To upgrade later: replace the fetch() inside postToTextbee() with
//       supabase.functions.invoke('send-sms', { body: { to, message } })
//     — everything else in this file stays identical.
// ─────────────────────────────────────────────────────────────────────────

// ─── API key resolution ───
// Prefer the env var. Fall back to the hardcoded key so the app works
// during testing. The fallback key is temporary — revoke it once you've
// set VITE_TEXTBEE_API_KEY in .env.local and restarted the dev server.
const ENV_API_KEY = import.meta.env.VITE_TEXTBEE_API_KEY as string | undefined
const FALLBACK_API_KEY = 'txb_jPSZ0G0RpWelmxrqlrvMnkLuCxQZA0rf'
const TEXTBEE_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms'

// ─── Public types ───
export type SmsOutcome = 'approved' | 'rejected' | 'resubmit'
export type DocSmsOutcome = 'approved' | 'rejected' | 'resubmit'

// ─── Verification (account-level) ───
interface SendVerificationSmsParams {
  outcome: SmsOutcome
  toPhone: string
  toName?: string | null
  message?: string | null
}

const OUTCOME_TEMPLATES: Record<SmsOutcome, (firstName: string) => string> = {
  approved: (name) =>
    `Hi ${name}, your PDAOLink account has been approved! You can now sign in and access your dashboard.`,
  rejected: (name) =>
    `Hi ${name}, we couldn't verify your identity on PDAOLink. Please check your email for details and resubmit.`,
  resubmit: (name) =>
    `Hi ${name}, PDAOLink needs updated documents to finish verifying your account. Check your email for instructions.`,
}

// ─── Document (per-file) ───
interface SendDocumentSmsParams {
  outcome: DocSmsOutcome
  toPhone: string
  toName?: string | null
  /** Human label, e.g. "1x1 Picture (2 pcs)" — pass prettyDocType(...) */
  documentType: string
  /** Admin remarks / reason — only appended for rejected / resubmit */
  message?: string | null
}

const DOC_OUTCOME_TEMPLATES: Record<
  DocSmsOutcome,
  (firstName: string, docType: string) => string
> = {
  approved: (name, docType) =>
    `Hi ${name}, your document "${docType}" has been APPROVED by PDAO.`,
  rejected: (name, docType) =>
    `Hi ${name}, your document "${docType}" was REJECTED by PDAO. Please re-upload a corrected copy.`,
  resubmit: (name, docType) =>
    `Hi ${name}, please RE-UPLOAD your document "${docType}" for review by PDAO.`,
}

// ─── Internals ───
function resolveApiKey(): string | null {
  const key = ENV_API_KEY || FALLBACK_API_KEY
  if (!key) {
    console.error(
      '[sms] No Textbee API key found. Set VITE_TEXTBEE_API_KEY in .env.local.'
    )
    return null
  }
  if (!ENV_API_KEY) {
    console.warn(
      '[sms] Using hardcoded fallback API key — move to VITE_TEXTBEE_API_KEY in .env.local.'
    )
  }
  return key
}

function normalizePhone(raw: string): { e164: string | null; error?: string } {
  let to = raw.trim().replace(/[\s\-()]/g, '')
  if (to.startsWith('0') && !to.startsWith('+')) to = '+63' + to.slice(1)
  if (!to.startsWith('+')) to = '+63' + to.replace(/^63/, '')
  if (!/^\+\d{10,15}$/.test(to)) {
    return {
      e164: null,
      error: `Invalid phone number format: "${raw}" → "${to}". Must be E.164 like +639171234567.`,
    }
  }
  return { e164: to }
}

const truncate = (s: string, max = 300) =>
  s.length > max ? s.slice(0, max - 3) + '…' : s

const firstNameOf = (name?: string | null) =>
  (name ?? '').trim().split(' ')[0] || 'there'

async function postToTextbee(
  to: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = resolveApiKey()
  if (!apiKey) return { ok: false, error: 'Missing Textbee API key.' }

  try {
    console.log('[sms] sending to', to, '→', body.slice(0, 60) + '…')
    const resp = await fetch(TEXTBEE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipients: [to], message: body }),
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      const errMsg =
        (data as any)?.message ?? `TextBee returned ${resp.status}`
      console.error('[sms] TextBee error:', resp.status, data)
      return { ok: false, error: errMsg }
    }

    console.log('[sms] queued:', data)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sms] exception:', msg, err)
    return { ok: false, error: msg }
  }
}

// ─── Public senders ───
export async function sendVerificationSms({
  outcome,
  toPhone,
  toName,
  message,
}: SendVerificationSmsParams): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizePhone(toPhone)
  if (!phone.e164) {
    console.error('[sms]', phone.error)
    return { ok: false, error: phone.error }
  }

  let body = OUTCOME_TEMPLATES[outcome](firstNameOf(toName))

  if ((outcome === 'rejected' || outcome === 'resubmit') && message?.trim()) {
    const reason = message.trim().slice(0, 120)
    body += ` Reason: ${reason}${message.length > 120 ? '…' : ''}`
  }

  return postToTextbee(phone.e164, truncate(body))
}

export async function sendDocumentSms({
  outcome,
  toPhone,
  toName,
  documentType,
  message,
}: SendDocumentSmsParams): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizePhone(toPhone)
  if (!phone.e164) {
    console.error('[sms]', phone.error)
    return { ok: false, error: phone.error }
  }

  let body = DOC_OUTCOME_TEMPLATES[outcome](
    firstNameOf(toName),
    documentType
  )

  if ((outcome === 'rejected' || outcome === 'resubmit') && message?.trim()) {
    const reason = message.trim().slice(0, 120)
    body += ` Reason: ${reason}${message.length > 120 ? '…' : ''}`
  }

  return postToTextbee(phone.e164, truncate(body))
}