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

  .eid-field {
    position: absolute;
    z-index: 2;
    font-family: Arial, sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transform: translateY(-50%);
    line-height: 1;
    text-shadow:
      0 0 4px #fff,
      0 0 4px #fff,
      0 0 7px rgba(255,255,255,0.9);
  }

  .eid-photo-wrap {
    position: absolute;
    z-index: 2;
    overflow: hidden;
    background: #e8e8e8;
    border: 2px solid #555;
    border-radius: 2px;
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
    gap: 4px;
    color: #aaa;
    font-size: 10px;
    font-family: Arial, sans-serif;
  }

  @media (max-width: 520px) {
    .eid-scene { max-width: 100%; }
    .eid-field { font-size: 9px; }
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
  const fullName = appFullName(application) || '—'
  const address  = [
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
  const gender    = application.gender

  return (
    <div className="eid-page-wrapper">
      <style>{styles}</style>

      <div className="eid-scene">
        <div
          className={`eid-card-3d${flipped ? ' flipped' : ''}`}
          onClick={onFlip}
          style={{ cursor: onFlip ? 'pointer' : 'default' }}
        >

          {/* ═══════════════ FRONT ═══════════════
              Positions measured from pwd-front.jpeg:
              Name value         → top: 41%   left: 14%
              Disability value   → top: 62%   left: 14%
              Photo box          → top: 26%   left: 70%   w: 25%  h: 54%
              ID Number          → top: 83%   left: 70%
          */}
          <div className="eid-face">
            <img
              src="https://cdn.postimage.me/2026/09/06/pwd-front.jpeg"
              alt=""
              className="eid-bg"
            />

            {/* Name — sits ON the Name underline */}
            <div className="eid-field" style={{ top: '41%', left: '14%', width: '52%' }}>
              {fullName}
            </div>

            {/* Type of Disability — sits ON the Type of Disability underline */}
            <div className="eid-field" style={{ top: '62%', left: '14%', width: '52%' }}>
              {disability}
            </div>

            {/* Photo box */}
            <div
              className="eid-photo-wrap"
              style={{ top: '26%', left: '70%', width: '25%', height: '54%' }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Applicant" />
              ) : (
                <div className="eid-photo-empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  <span>Photo</span>
                </div>
              )}
            </div>

            {/* ID Number — bottom right corner */}
            <div
              className="eid-field"
              style={{ top: '83%', left: '70%', width: '28%', fontSize: '9px' }}
            >
              {pwdNumber}
            </div>
          </div>

          {/* ═══════════════ BACK ═══════════════
              Positions measured from pwd-back.png (1008 × 639 px):
              Address value   → top: 12.1%  left: 16.6%
              Birth value     → top: 17.4%  left: 21.3%
              Issued value    → top: 23.0%  left: 20.0%
              Sex value       → top:  9.7%  left: 76.9%
              Blood value     → top: 15.2%  left: 76.9%
              Emerg Name      → top: 47.4%  left: 16.6%
              Emerg Contact   → top: 53.1%  left: 16.6%
          */}
          <div className="eid-face eid-back-face">
            <img
              src="https://cdn.postimage.me/2026/09/06/pwd-back.jpeg"
              alt=""
              className="eid-bg"
            />

            {/* Address */}
            <div className="eid-field" style={{ top: '12.1%', left: '16.6%', width: '52%' }}>
              {address || '—'}
            </div>

            {/* Date of Birth */}
            <div className="eid-field" style={{ top: '17.4%', left: '21.3%', width: '40%' }}>
              {birthDate}
            </div>

            {/* Date Issued */}
            <div className="eid-field" style={{ top: '23.0%', left: '20.0%', width: '40%' }}>
              {fmtDate(application.last_updated)}
            </div>

            {/* Sex */}
            <div className="eid-field" style={{ top: '9.7%', left: '76.9%', width: '20%' }}>
              {gender ?? '—'}
            </div>

            {/* Blood Type */}
            <div className="eid-field" style={{ top: '15.2%', left: '76.9%', width: '20%' }}>
              {application.blood_type ?? '—'}
            </div>

            {/* Emergency Name */}
            <div className="eid-field" style={{ top: '47.4%', left: '16.6%', width: '50%' }}>
              {application.emergency_name || '—'}
            </div>

            {/* Emergency Contact */}
            <div className="eid-field" style={{ top: '53.1%', left: '16.6%', width: '50%' }}>
              {application.emergency_contact_number || '—'}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
