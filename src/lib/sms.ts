// lib/sms.ts
// ─────────────────────────────────────────────────────────────────────────
// ⚠️  DIRECT FRONTEND CALL — API key is exposed in the browser bundle.
//     Fine for testing / internal use. Do NOT ship to public users as-is.
//     To upgrade later: replace the fetch() below with
//     supabase.functions.invoke('send-sms', { body: { to, message } })
//     — everything else in this file stays identical.
// ─────────────────────────────────────────────────────────────────────────

export type SmsOutcome = 'approved' | 'rejected' | 'resubmit'

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

const TEXTBEE_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms'

export async function sendVerificationSms({
  outcome,
  toPhone,
  toName,
  message,
}: SendVerificationSmsParams): Promise<{ ok: boolean; error?: string }> {
  try {
    // ─── 1. Validate key presence early with a clear error ───
    const apiKey = import.meta.env.VITE_TEXTBEE_API_KEY as string | undefined
    if (!apiKey) {
      const msg =
        'VITE_TEXTBEE_API_KEY is not set. Add it to .env.local and restart the dev server.'
      console.error('[sms]', msg)
      return { ok: false, error: msg }
    }

    // ─── 2. Build the message ───
    const firstName = (toName ?? '').trim().split(' ')[0] || 'there'
    let body = OUTCOME_TEMPLATES[outcome](firstName)

    if ((outcome === 'rejected' || outcome === 'resubmit') && message) {
      const trimmed = message.trim().slice(0, 120)
      body += ` Reason: ${trimmed}${message.length > 120 ? '…' : ''}`
    }
    if (body.length > 300) body = body.slice(0, 297) + '…'

    // ─── 3. Normalize phone to E.164 (defensive — DB should already be E.164) ───
    let to = toPhone.trim().replace(/[\s\-()]/g, '')
    if (to.startsWith('0') && !to.startsWith('+')) to = '+63' + to.slice(1)
    if (!to.startsWith('+')) to = '+63' + to.replace(/^63/, '')

    if (!/^\+\d{10,15}$/.test(to)) {
      const msg = `Invalid phone number format: "${toPhone}" → "${to}". Must be E.164 like +639171234567.`
      console.error('[sms]', msg)
      return { ok: false, error: msg }
    }

    // ─── 4. Call TextBee ───
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
      const errMsg = data?.message ?? `TextBee returned ${resp.status}`
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