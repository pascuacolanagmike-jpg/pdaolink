import { useEffect, useState, type ReactNode } from 'react'

interface SecurityPopupProps {
  show: boolean
  onClose: () => void
  variant: 'e2ee' | 'zero-trust'
}

const CONTENT = {
  e2ee: {
    icon: 'bi-shield-lock-fill',
    title: 'End-to-End Encryption Secured',
    accent: '#198754',
    lines: [
      'Your data is protected with end-to-end encryption.',
      'All information you submit — personal details, documents, and credentials — is encrypted in transit and at rest.',
      'Only you and authorized PDAO personnel can access your data.',
    ],
  },
  'zero-trust': {
    icon: 'bi-shield-check',
    title: 'Zero Trust Network',
    accent: '#0056b3',
    lines: [
      'PDAOLink operates on a Zero Trust security model.',
      'Every request is verified, every session is validated, and no device is trusted by default.',
      'Biometric verification and continuous authentication keep your account protected.',
    ],
  },
}

export function SecurityPopup({ show, onClose, variant }: SecurityPopupProps) {
  const [visible, setVisible] = useState(false)
  const cfg = CONTENT[variant]

  useEffect(() => {
    if (show) {
      setVisible(true)
    } else {
      const t = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(t)
    }
  }, [show])

  if (!visible) return null

  return (
    <div
      className="security-popup-backdrop"
      style={{ opacity: show ? 1 : 0 }}
      onClick={onClose}
    >
      <div className="security-popup" style={{ transform: show ? 'scale(1)' : 'scale(0.9)' }} onClick={(e) => e.stopPropagation()}>
        <button className="security-popup-close" onClick={onClose} aria-label="Close">
          <i className="bi bi-x-lg" />
        </button>
        <div className="security-popup-icon" style={{ background: `${cfg.accent}18`, color: cfg.accent }}>
          <i className={`bi ${cfg.icon}`} />
        </div>
        <h4 className="security-popup-title">{cfg.title}</h4>
        <div className="security-popup-body">
          {cfg.lines.map((line, i) => (
            <p key={i} className="security-popup-line">
              <i className="bi bi-check-circle-fill" style={{ color: cfg.accent }} /> {line}
            </p>
          ))}
        </div>
        <div className="security-popup-shield-row">
          <span className="security-popup-badge"><i className="bi bi-lock-fill" /> TLS 1.3</span>
          <span className="security-popup-badge"><i className="bi bi-fingerprint" /> Biometric Ready</span>
          <span className="security-popup-badge"><i className="bi bi-shield-fill-check" /> FIDO2</span>
        </div>
        <button className="btn btn-primary w-100 mt-3" onClick={onClose}>
          <i className="bi bi-shield-check me-1" /> Got it
        </button>
      </div>
      <style>{`
        .security-popup-backdrop {
          position: fixed; inset: 0; z-index: 2000;
          background: rgba(0, 15, 40, 0.55);
          backdrop-filter: blur(4px);
          display: grid; place-items: center;
          transition: opacity 0.2s ease;
          padding: 1rem;
        }
        .security-popup {
          background: #fff; border-radius: 1rem; padding: 2rem 1.8rem 1.8rem;
          max-width: 420px; width: 100%; text-align: center; position: relative;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .security-popup-close {
          position: absolute; top: 0.8rem; right: 0.8rem;
          border: none; background: rgba(0,0,0,0.05); color: #6c757d;
          width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
          display: grid; place-items: center; font-size: 0.8rem;
          transition: background 0.15s;
        }
        .security-popup-close:hover { background: rgba(0,0,0,0.1); color: #1f2d3d; }
        .security-popup-icon {
          width: 72px; height: 72px; border-radius: 50%;
          margin: 0 auto 1rem; display: grid; place-items: center; font-size: 2rem;
        }
        .security-popup-title { font-weight: 800; margin-bottom: 1rem; font-size: 1.25rem; }
        .security-popup-body { text-align: left; margin-bottom: 1.2rem; }
        .security-popup-line {
          font-size: 0.9rem; color: #495057; margin-bottom: 0.6rem;
          display: flex; align-items: flex-start; gap: 0.5rem; line-height: 1.5;
        }
        .security-popup-line i { flex-shrink: 0; margin-top: 0.15rem; font-size: 0.85rem; }
        .security-popup-shield-row { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
        .security-popup-badge {
          font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.6rem;
          border-radius: 1rem; background: #f1f5fa; color: #0056b3;
          display: inline-flex; align-items: center; gap: 0.3rem;
        }
      `}</style>
    </div>
  )
}

// Convenience wrapper that auto-shows the popup once per session
export function AutoSecurityPopup({ variant, children }: { variant: 'e2ee' | 'zero-trust'; children: ReactNode }) {
  const [show, setShow] = useState(false)
  const storageKey = `pdaolink-popup-${variant}-shown`

  useEffect(() => {
    if (!sessionStorage.getItem(storageKey)) {
      const t = setTimeout(() => {
        setShow(true)
        sessionStorage.setItem(storageKey, '1')
      }, 600)
      return () => clearTimeout(t)
    }
  }, [storageKey])

  return (
    <>
      {children}
      <SecurityPopup show={show} onClose={() => setShow(false)} variant={variant} />
    </>
  )
}
