import { type Application, appFullName, fmtDate } from '../lib/types'

interface EidCardProps {
  application: Application
  photoUrl: string | null
  flipped: boolean
  onFlip?: () => void
}

const styles = `
  .eid-page-wrapper { padding-bottom: 1rem; }

  .eid-scene {
    perspective: 1400px;
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
  }

  .eid-card-3d {
    position: relative;
    width: 100%;
    aspect-ratio: 1.586 / 1;
    transform-style: preserve-3d;
    transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }

  .eid-card-3d.flipped { transform: rotateY(180deg); }

  .eid-face {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
  }

  .eid-back-face { transform: rotateY(180deg); }

  .eid-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
    z-index: 0;
  }

  .eid-photo-wrap {
    position: absolute;
    z-index: 2;
    overflow: hidden;
    background: #f7f7f7;
    border: 2px solid #ccc;
    border-radius: 4px;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08);
  }
  .eid-photo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .eid-photo-empty {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #bbb;
    font-size: 10px;
    font-family: Arial, sans-serif;
    background: #f9f9f9;
  }
  .eid-photo-empty svg {
    opacity: 0.5;
  }

  @media (max-width: 520px) {
    .eid-scene { max-width: 100%; }
  }

  @media print {
    .no-print, .navbar-pdao, .sidebar, .footer-pdao { display: none !important; }
    .eid-scene { max-width: 3.5in; perspective: none; }
    .eid-card-3d {
      transform: none !important;
      transition: none !important;
      box-shadow: none !important;
    }
    .eid-face {
      position: relative;
      transform: none !important;
      backface-visibility: visible;
      -webkit-backface-visibility: visible;
      page-break-inside: avoid;
    }
    .eid-back-face { transform: none; margin-top: 0.3in; }
    body { background: #fff !important; }
  }
`

export default function EidCard({ application, photoUrl, flipped, onFlip }: EidCardProps) {
  // -------- All variables must be defined inside the component --------
  const fullName = appFullName(application) || '—'
  const address = [
    application.address,
    application.barangay,
    application.municipality,
    application.province,
  ].filter(Boolean).join(', ')

  const disability =
    application.disability_type ??
    (application.disability_types ?? []).join(', ') ??
    '—'

  const pwdNumber =
    application.pwd_number || `PDAO-${application.id.slice(0, 8).toUpperCase()}`

  const birthDate = fmtDate(application.birth_date)
  const gender = application.gender

  return (
    <div className="eid-page-wrapper">
      <style>{styles}</style>

      <div className="eid-scene">
        <div
          className={`eid-card-3d${flipped ? ' flipped' : ''}`}
          onClick={onFlip}
          style={{ cursor: onFlip ? 'pointer' : 'default' }}
        >

          {/* ═══════════════ FRONT ═══════════════ */}
          <div className="eid-face">
            <img
              src="https://cdn.postimage.me/2026/09/13/pwd-front.jpeg"
              alt=""
              className="eid-bg"
            />

            {/* Name */}
            <div
              style={{
                position: 'absolute',
                top: '36%',
                left: '5%',
                width: '52%',
                height: '5%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 2,
                overflow: 'hidden',
              }}
            >
              <div style={{
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
                lineHeight: 1,
              }}>
                {fullName}
              </div>
            </div>

            {/* Disability */}
            <div
              style={{
                position: 'absolute',
                top: '55%',
                left: '5%',
                width: '52%',
                height: '5%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 2,
                overflow: 'hidden',
              }}
            >
              <div style={{
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
                lineHeight: 1,
              }}>
                {disability}
              </div>
            </div>

            {/* Photo box */}
            <div
              className="eid-photo-wrap"
              style={{
                top: '26%',
                left: '68%',
                width: '27%',
                height: '54%',
              }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Applicant" />
              ) : (
                <div className="eid-photo-empty">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#bbb"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  <span>Photo</span>
                </div>
              )}
            </div>

            {/* ID Number */}
            <div
              style={{
                position: 'absolute',
                top: '83%',
                left: '70%',
                width: '28%',
                fontSize: '9px',
                textAlign: 'center',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontWeight: '700',
                color: '#111',
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
                lineHeight: 1,
                transform: 'translateY(-50%)',
              }}
            >
              {pwdNumber}
            </div>
          </div>

          {/* ═══════════════ BACK ═══════════════ */}
          <div className="eid-face eid-back-face">
            <img
              src="https://cdn.postimage.me/2026/09/13/Untitled-design-3.png"
              alt=""
              className="eid-bg"
            />

            <div
              style={{
                position: 'absolute',
                top: '12.1%',
                left: '16.6%',
                width: '52%',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: 'translateY(-50%)',
                lineHeight: 1,
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
              }}
            >
              {address || '—'}
            </div>
            <div
              style={{
                position: 'absolute',
                top: '17.4%',
                left: '21.3%',
                width: '40%',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: 'translateY(-50%)',
                lineHeight: 1,
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
              }}
            >
              {birthDate}
            </div>
            <div
              style={{
                position: 'absolute',
                top: '23.0%',
                left: '20.0%',
                width: '40%',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: 'translateY(-50%)',
                lineHeight: 1,
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
              }}
            >
              {fmtDate(application.last_updated)}
            </div>
            <div
              style={{
                position: 'absolute',
                top: '9.7%',
                left: '76.9%',
                width: '20%',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: 'translateY(-50%)',
                lineHeight: 1,
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
              }}
            >
              {gender ?? '—'}
            </div>
            <div
              style={{
                position: 'absolute',
                top: '15.2%',
                left: '76.9%',
                width: '20%',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: 'translateY(-50%)',
                lineHeight: 1,
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
              }}
            >
              {application.blood_type ?? '—'}
            </div>
            <div
              style={{
                position: 'absolute',
                top: '47.4%',
                left: '16.6%',
                width: '50%',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: 'translateY(-50%)',
                lineHeight: 1,
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
              }}
            >
              {application.emergency_name || '—'}
            </div>
            <div
              style={{
                position: 'absolute',
                top: '53.1%',
                left: '16.6%',
                width: '50%',
                zIndex: 2,
                fontFamily: 'Arial,sans-serif',
                fontSize: '13px',
                fontWeight: '700',
                color: '#111',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transform: 'translateY(-50%)',
                lineHeight: 1,
                textShadow: '0 0 4px #fff,0 0 4px #fff,0 0 7px rgba(255,255,255,0.9)',
              }}
            >
              {application.emergency_contact_number || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
