import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string

const TEMPLATES = {
  approved: import.meta.env.VITE_EMAILJS_APPROVED_TEMPLATE_ID as string,
  action:   import.meta.env.VITE_EMAILJS_ACTION_TEMPLATE_ID   as string,
}

const APP_NAME = 'PDAO Link' // 👈 change to your real app name

/** Wrap the admin's message in a styled block (or empty if none). */
function buildMessageBlock(message?: string | null) {
  const text = (message ?? '').trim()
  if (!text) return ''
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
  return `
    <div style="background:#f8f9fa;border-left:4px solid #6c757d;padding:12px 16px;margin:16px 0;border-radius:4px;">
      <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
        Message from admin
      </div>
      <div style="color:#333;">${safe}</div>
    </div>
  `
}

type Outcome = 'approved' | 'rejected' | 'resubmit'

export async function sendVerificationEmail(opts: {
  outcome: Outcome
  toEmail: string
  toName?: string | null
  message?: string | null
}) {
  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.warn('[email] EmailJS not configured, skipping send')
    return { ok: false as const, error: 'not_configured' }
  }

  const baseParams = {
    to_email: opts.toEmail,
    to_name: opts.toName ?? 'there',
    app_name: APP_NAME,
    message_block: buildMessageBlock(opts.message),
  }

  try {
    if (opts.outcome === 'approved') {
      if (!TEMPLATES.approved) throw new Error('Approved template ID missing')
      await emailjs.send(SERVICE_ID, TEMPLATES.approved, baseParams, {
        publicKey: PUBLIC_KEY,
      })
    } else {
      if (!TEMPLATES.action) throw new Error('Action template ID missing')

      const isReject = opts.outcome === 'rejected'
      const actionParams = {
        ...baseParams,
        email_subject: isReject
          ? 'Your verification was not approved'
          : 'Action needed: please resubmit your documents',
        heading_icon: isReject ? '❌' : '⚠️',
        heading_text: isReject
          ? 'Verification Not Approved'
          : 'Resubmission Required',
        heading_color: isReject ? '#dc2626' : '#d97706',
        intro_text: isReject
          ? 'Unfortunately, your verification could not be approved at this time.'
          : 'We reviewed your verification and need you to resubmit your documents.',
        action_text: isReject
          ? 'You may correct the issue and resubmit your documents at any time.'
          : `Please log in to ${APP_NAME} and submit updated documents.`,
      }

      await emailjs.send(SERVICE_ID, TEMPLATES.action, actionParams, {
        publicKey: PUBLIC_KEY,
      })
    }

    return { ok: true as const }
  } catch (err) {
    console.error('[email] send failed:', err)
    return { ok: false as const, error: String(err) }
  }
}