import { type Application, type DocumentRow, appFullName, fmtDate } from '../lib/types'

interface EidCardProps {
  application: Application
  photoUrl: string | null
  flipped: boolean
  onFlip?: () => void
}

export default function EidCard({ application, photoUrl, flipped, onFlip }: EidCardProps) {
  const fullName = appFullName(application) || '—'
  const address = [application.address, application.barangay, application.municipality, application.province].filter(Boolean).join(', ')
  const disability = application.disability_type ?? (application.disability_types ?? []).join(', ') ?? '—'
  const pwdNumber = application.pwd_number || `PDAO-${application.id.slice(0, 8).toUpperCase()}`
  const birthDate = fmtDate(application.birth_date)
  const gender = application.gender

  return (
    <div className="eid-scene">
      <div className={`eid-card-3d ${flipped ? 'flipped' : ''}`} onClick={onFlip} style={onFlip ? {} : { cursor: 'default' }}>
        {/* Front */}
        <div className="eid-face eid-front">
          <div className="eid-header-bar">
            <div className="d-flex justify-content-between align-items-center">
              <div className="eid-gov-label">Republic of the Philippines</div>
              <div className="eid-id-badge">PWD ID</div>
            </div>
            <div className="eid-office-label">PDAO — Persons with Disability Affairs Office</div>
          </div>
          <div className="eid-body">
            <div className="eid-photo-box">
              {photoUrl
                ? <img src={photoUrl} alt="Applicant" className="eid-photo" />
                : <div className="eid-photo-placeholder"><i className="bi bi-person" /></div>}
            </div>
            <div className="eid-info">
              <div className="eid-name">{fullName}</div>
              <div className="eid-detail-row"><span className="eid-label">PWD No.</span><span className="eid-value">{pwdNumber}</span></div>
              <div className="eid-detail-row"><span className="eid-label">Disability</span><span className="eid-value eid-value-sm">{disability}</span></div>
              <div className="eid-detail-row"><span className="eid-label">Date of Birth</span><span className="eid-value">{birthDate}</span></div>
              <div className="eid-detail-row"><span className="eid-label">Gender</span><span className="eid-value">{gender ?? '—'}</span></div>
            </div>
          </div>
          <div className="eid-footer-bar">
            <span>Valid until renewed</span>
            <span>Issued: {fmtDate(application.last_updated)}</span>
          </div>
        </div>

        {/* Back */}
        <div className="eid-face eid-back">
          <div className="eid-header-bar eid-header-bar-back">
            <div className="eid-gov-label">PWD ID — Back</div>
          </div>
          <div className="eid-back-body">
            <div className="eid-back-section">
              <div className="eid-back-label">Address</div>
              <div className="eid-back-value">{address || '—'}</div>
            </div>
            <div className="eid-back-section">
              <div className="eid-back-label">Contact Number</div>
              <div className="eid-back-value">{application.contact_number || application.mobile_no || '—'}</div>
            </div>
            <div className="eid-back-section">
              <div className="eid-back-label">Emergency Contact</div>
              <div className="eid-back-value">
                {application.emergency_name || '—'}
                {application.emergency_contact_number ? ` · ${application.emergency_contact_number}` : ''}
              </div>
            </div>
            <div className="eid-back-section">
              <div className="eid-back-label">Blood Type</div>
              <div className="eid-back-value">{application.blood_type ?? '—'}</div>
            </div>
            <div className="eid-back-section">
              <div className="eid-back-label">Physician</div>
              <div className="eid-back-value">{application.physician_name || '—'}</div>
            </div>
            <div className="eid-qr-area">
              <div className="eid-qr-placeholder">
                <i className="bi bi-qr-code" />
              </div>
              <div className="eid-qr-text">
                <div>Scan to verify</div>
                <div className="eid-qr-id">{pwdNumber}</div>
              </div>
            </div>
          </div>
          <div className="eid-footer-bar eid-footer-bar-back">
            <span>This ID is non-transferable</span>
            <span>PDAOLink Digital ID</span>
          </div>
        </div>
      </div>
    </div>
  )
}
