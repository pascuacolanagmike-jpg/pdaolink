import './EidCard.css'
import { type Application, appFullName, fmtDate } from '../lib/types'

interface EidCardProps {
  application: Application
  photoUrl: string | null
  flipped: boolean
  onFlip?: () => void
}

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
      <div className="eid-scene">
        <div
          className={`eid-card-3d ${flipped ? 'flipped' : ''}`}
          onClick={onFlip}
          style={onFlip ? { cursor: 'pointer' } : { cursor: 'default' }}
        >

          {/* ══════════ FRONT ══════════ */}
          <div className="eid-face eid-front">

            {/* Header */}
            <div className="eid-header-bar">
              <div>
                <div className="eid-gov-label">Republic of the Philippines</div>
                <div className="eid-office-label">Person with Disability Identification Card</div>
              </div>
              <div className="eid-id-badge">PWD</div>
            </div>

            {/* Body */}
            <div className="eid-body">

              {/* Photo */}
              <div className="eid-photo-box">
                {photoUrl ? (
                  <img src={photoUrl} alt="Applicant photo" className="eid-photo" />
                ) : (
                  <span className="eid-photo-placeholder">👤</span>
                )}
              </div>

              {/* Info */}
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

            {/* Footer */}
            <div className="eid-footer-bar">
              <span>{pwdNumber}</span>
              <span>PDAO — Office for Persons with Disability Affairs</span>
            </div>
          </div>

          {/* ══════════ BACK ══════════ */}
          <div className="eid-face eid-back">

            {/* Header */}
            <div className="eid-header-bar eid-header-bar-back">
              <div className="eid-gov-label">Republic of the Philippines — PWD Card</div>
            </div>

            {/* Body */}
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

              {/* Emergency contact */}
              <div className="eid-qr-area">
                <div className="eid-qr-placeholder">
                  <i className="ti ti-qrcode" />
                </div>
                <div>
                  <div className="eid-qr-text">In Case of Emergency</div>
                  <div className="eid-qr-id">{application.emergency_name || '—'}</div>
                  <div className="eid-qr-id">{application.emergency_contact_number || '—'}</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="eid-footer-bar eid-footer-bar-back">
              <span>{pwdNumber}</span>
              <span>This card is non-transferable</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
