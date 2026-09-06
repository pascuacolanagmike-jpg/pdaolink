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
    <>
      <style>{`
        .eid-scene {
          display: flex;
          justify-content: center;
          align-items: center;
          perspective: 1000px;
          padding: 20px;
        }
        .eid-card-3d {
          width: 500px;
          height: 315px;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.6s;
        }
        .eid-card-3d.flipped {
          transform: rotateY(180deg);
        }
        .eid-face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .eid-back {
          transform: rotateY(180deg);
        }
        
        /* Background Image Layer (Sits at the bottom) */
        .eid-bg-img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        /* Text positioning (Sits on top of the image) */
        .front-field, .back-field {
          position: absolute;
          font-family: Arial, sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: black;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
          padding: 0 5px;
          z-index: 1;
        }

        /* Photo Box Overlay */
        .photo-overlay {
          position: absolute;
          border: 1px solid black;
          background-color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          z-index: 1;
        }
        .photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        @media (max-width: 600px) {
          .eid-card-3d {
            width: 350px;
            height: 220px;
          }
          .front-field, .back-field {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="eid-scene">
        <div className={`eid-card-3d ${flipped ? 'flipped' : ''}`} onClick={onFlip} style={onFlip ? {} : { cursor: 'default' }}>
          
          {/* FRONT */}
          <div className="eid-face eid-front">
            {/* Corrected path to include /images/ */}
            <img src="/images/pwd-front.png" alt="Front Background" className="eid-bg-img" />
            
            <div className="front-field" style={{ top: '41%', left: '10%', width: '48%' }}>
              {fullName}
            </div>
            
            <div className="front-field" style={{ top: '59%', left: '10%', width: '48%' }}>
              {disability}
            </div>

            <div className="front-field" style={{ top: '77%', left: '10%', width: '40%' }}>
            </div>

            <div className="photo-overlay" style={{ top: '26%', left: '68%', width: '27%', height: '55%' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Applicant" className="photo-img" />
              ) : (
                <div className="photo-placeholder"></div>
              )}
            </div>

            <div className="front-field" style={{ top: '84%', left: '70%', width: '25%' }}>
              {pwdNumber}
            </div>
          </div>

          {/* BACK */}
          <div className="eid-face eid-back">
            {/* Corrected path to include /images/ */}
            <img src="/images/pwd-back.png" alt="Back Background" className="eid-bg-img" />
            
            <div className="back-field" style={{ top: '35%', left: '10%', width: '50%' }}>
              {address}
            </div>
            <div className="back-field" style={{ top: '45%', left: '10%', width: '30%' }}>
              {birthDate}
            </div>
            <div className="back-field" style={{ top: '55%', left: '10%', width: '30%' }}>
              {fmtDate(application.last_updated)}
            </div>

            <div className="back-field" style={{ top: '35%', left: '70%', width: '20%' }}>
              {gender ?? '—'}
            </div>
            <div className="back-field" style={{ top: '45%', left: '70%', width: '20%' }}>
              {application.blood_type ?? '—'}
            </div>

            <div className="back-field" style={{ top: '75%', left: '10%', width: '40%' }}>
              {application.emergency_name || '—'}
            </div>
            <div className="back-field" style={{ top: '82%', left: '10%', width: '40%' }}>
              {application.emergency_contact_number || '—'}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
