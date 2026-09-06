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
    max-width: 420px;
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
    border-radius: 16px;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 40px rgba(0,86,179,0.20), 0 2px 8px rgba(0,0,0,0.08);
  }

  .eid-front {
    background: linear-gradient(135deg, #0056b3 0%, #003d80 100%);
    color: #fff;
    border: 2px solid rgba(255,255,255,0.15);
  }

  .eid-back {
    background: linear-gradient(135deg, #003d80 0%, #002a5c 100%);
    color: #fff;
    border: 2px solid rgba(255,255,255,0.15);
    transform: rotateY(180deg);
  }

  .eid-header-bar {
    background: rgba(255,255,255,0.10);
    padding: 0.4rem 0.85rem;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .eid-gov-label {
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.3px;
    color: rgba(255,255,255,0.80);
    text-transform: uppercase;
  }

  .eid-office-label {
    font-size: 0.62rem;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    margin-top: 1px;
  }

  .eid-id-badge {
    background: #fff;
    color: #0056b3;
    font-size: 0.55rem;
    font-weight: 800;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .eid-body {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.7rem 0.85rem;
    flex: 1;
    min-height: 0;
  }

  .eid-photo-box {
    flex-shrink: 0;
    width: 72px;
    height: 88px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255,255,255,0.10);
    border: 2px solid rgba(255,255,255,0.25);
    display: grid;
    place-items: center;
  }

  .eid-photo { width: 100%; height: 100%; object-fit: cover; }

  .eid-photo-placeholder { font-size: 2rem; color: rgba(255,255,255,0.50); }

  .eid-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .eid-name {
    font-size: 0.95rem;
    font-weight: 800;
    line-height: 1.15;
    margin-bottom: 0.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .eid-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.62rem;
  }

  .eid-label { color: rgba(255,255,255,0.60); font-weight: 600; white-space: nowrap; }

  .eid-value {
    color: #fff;
    font-weight: 700;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .eid-value-sm { font-size: 0.55rem; }

  .eid-footer-bar {
    background: rgba(0,0,0,0.20);
    padding: 0.3rem 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.55rem;
    color: rgba(255,255,255,0.70);
    font-weight: 600;
  }

  .eid-back-body {
    flex: 1;
    padding: 0.6rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-height: 0;
  }

  .eid-back-section {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }

  .eid-back-label {
    font-size: 0.58rem;
    color: rgba(255,255,255,0.60);
    font-weight: 600;
    white-space: nowrap;
  }

  .eid-back-value {
    font-size: 0.62rem;
    color: #fff;
    font-weight: 600;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }

  .eid-emergency-area {
    margin-top: auto;
    padding-top: 0.4rem;
    border-top: 1px solid rgba(255,255,255,0.12);
  }

  .eid-emergency-title {
    font-size: 0.55rem;
    font-weight: 700;
    color: rgba(255,255,255,0.60);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 0.25rem;
  }

  .eid-emergency-name {
    font-size: 0.68rem;
    font-weight: 800;
    color: #fff;
  }

  .eid-emergency-number {
    font-size: 0.62rem;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
    margin-top: 1px;
  }

  .eid-footer-bar-back {
    background: rgba(0,0,0,0.20);
    padding: 0.3rem 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.55rem;
    color: rgba(255,255,255,0.70);
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .eid-scene { max-width: 100%; }
    .eid-name { font-size: 0.82rem; }
    .eid-photo-box { width: 56px; height: 68px; }
  }

  @media print {
    .no-print, .navbar-pdao, .sidebar, .footer-pdao { display: none !important; }
    .eid-scene { max-width: 3.5in; perspective: none; }
    .eid-card-3d {
      cursor: default;
      transform: none !important;
      transition: none !important;
      box-shadow: none !important;
      border: 1px solid #ccc;
      border-radius: 12px;
    }
    .eid-face {
      position: relative;
      transform: none !important;
      backface-visibility: visible;
      -webkit-backface-visibility: visible;
      page-break-inside: avoid;
      box-shadow: none;
    }
    .eid-back { transform: none; margin-top: 0.3in; }
    .eid-card-3d.flipped { transform: none; }
    body { background: #fff !important; }
  }
`

export default function EidCard({ application, photoUrl, flipped, onFlip }: EidCardProps) {
  const fullName = appFullName(application) || '—'
  const address = [
    application.address,
    application.barangay,
    application.municipality,
    application.province,
  ]
    .filter(Boolean)
    .join(', ')

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

          {/* ══════════ FRONT ══════════ */}
          <div className="eid-face eid-front">

            <div className="eid-header-bar">
              <div>
                <div className="eid-gov-label">Republic of the Philippines</div>
                <div className="eid-office-label">Person with Disability Identification Card</div>
              </div>
              <div className="eid-id-badge">PWD</div>
            </div>

            <div className="eid-body">
              <div className="eid-photo-box">
                {photoUrl ? (
                  <img src={photoUrl} alt="Applicant photo" className="eid-photo" />
                ) : (
                  <span className="eid-photo-placeholder">👤</span>
                )}
              </div>

              <div className="eid-info">
                <div className="eid-name">{fullName}</div>

                <div className="eid-detail-row">
                  <span className="eid-label">Disability</span>
                  <span className="eid-value eid-value-sm">{disability}</span>
                </div>

                <div className="eid-detail-row">
                  <span className="eid-label">Date of Birth</span>
                  <span className="eid-value">{birthDate}</span>
                </div>

                <div className="eid-detail-row">
                  <span className="eid-label">Sex</span>
                  <span className="eid-value">{gender ?? '—'}</span>
                </div>

                <div className="eid-detail-row">
                  <span className="eid-label">Blood Type</span>
                  <span className="eid-value">{application.blood_type ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="eid-footer-bar">
              <span>{pwdNumber}</span>
              <span>Office for Persons with Disability Affairs</span>
            </div>
          </div>

          {/* ══════════ BACK ══════════ */}
          <div className="eid-face eid-back">

            <div className="eid-header-bar">
              <div>
                <div className="eid-gov-label">Republic of the Philippines</div>
                <div className="eid-office-label">Cardholder Information</div>
              </div>
              <div className="eid-id-badge">PWD</div>
            </div>

            <div className="eid-back-body">

              <div className="eid-back-section">
                <span className="eid-back-label">Address</span>
                <span className="eid-back-value">{address || '—'}</span>
              </div>

              <div className="eid-back-section">
                <span className="eid-back-label">Date of Birth</span>
                <span className="eid-back-value">{birthDate}</span>
              </div>

              <div className="eid-back-section">
                <span className="eid-back-label">Date Issued</span>
                <span className="eid-back-value">{fmtDate(application.last_updated)}</span>
              </div>

              <div className="eid-back-section">
                <span className="eid-back-label">Sex</span>
                <span className="eid-back-value">{gender ?? '—'}</span>
              </div>

              <div className="eid-back-section">
                <span className="eid-back-label">Blood Type</span>
                <span className="eid-back-value">{application.blood_type ?? '—'}</span>
              </div>

              <div className="eid-emergency-area">
                <div className="eid-emergency-title">In Case of Emergency</div>
                <div className="eid-emergency-name">{application.emergency_name || '—'}</div>
                <div className="eid-emergency-number">{application.emergency_contact_number || '—'}</div>
              </div>

            </div>

            <div className="eid-footer-bar-back">
              <span>{pwdNumber}</span>
              <span>This card is non-transferable</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
