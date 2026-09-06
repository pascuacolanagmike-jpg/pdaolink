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
          background: #fff;
        }
        .eid-back {
          transform: rotateY(180deg);
        }
        
        /* Background Images - 'fill' ensures the percentages line up exactly with the image */
        .eid-bg-img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: fill; /* Tweak to 'cover' if you want it cropped instead */
          z-index: 0;
        }

        .front-field, .back-field {
          position: absolute;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #111;
          white-space: nowrap; 
          overflow: hidden;
          text-overflow: ellipsis;
          transform: translateY(-50%); /* Centers text perfectly on the black lines */
          line-height: 1;
          text-shadow: 0 0 3px #fff, 0 0 3px #fff; /* White halo so text reads over buildings */
          z-index: 1;
        }

        .photo-overlay {
          position: absolute;
          border: 2px solid #000;
          background-color: #fff;
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
          .eid-card-3d { width: 350px; height: 220px; }
          .front-field, .back-field { font-size: 11px; }
        }
      `}</style>

      <div className="eid-scene">
        <div className={`eid-card-3d ${flipped ? 'flipped' : ''}`} onClick={onFlip} style={onFlip ? {} : { cursor: 'default' }}>
          
          {/* FRONT */}
          <div className="eid-face eid-front">
            <img src="/images/pwd-front.png" alt="Front Background" className="eid-bg-img" />
            
            {/* Name (Right of the label) */}
            <div className="front-field" style={{ top: '42%', left: '30%', width: '40%' }}>{fullName}</div>
            
            {/* Type of Disability */}
            <div className="front-field" style={{ top: '59%', left: '30%', width: '40%' }}>{disability}</div>

            {/* Signature Line */}
            <div className="front-field" style={{ top: '76%', left: '30%', width: '30%' }}></div>

            {/* Photo Box */}
            <div className="photo-overlay" style={{ top: '27%', left: '69%', width: '25%', height: '57%' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Applicant" className="photo-img" />
              ) : (
                <div className="photo-placeholder"></div>
              )}
            </div>

            {/* ID No */}
            <div className="front-field" style={{ top: '82.5%', left: '75%', width: '20%' }}>{pwdNumber}</div>
          </div>

          {/* BACK - Adjusted to match your perfect screenshot */}
          <div className="eid-face eid-back">
            <img src="https://cdn.postimage.me/2026/09/06/pwd-back.jpeg" alt="Back Background" className="eid-bg-img" />
            
            {/* Top Left Column (Starts at left: 30% to sit next to "Address:") */}
            <div className="back-field" style={{ top: '28%', left: '30%', width: '40%' }}>{address}</div>
            <div className="back-field" style={{ top: '35%', left: '30%', width: '30%' }}>{birthDate}</div>
            <div className="back-field" style={{ top: '42%', left: '30%', width: '30%' }}>{fmtDate(application.last_updated)}</div>

            {/* Top Right Column (Starts at left: 74% to sit next to "Sex:") */}
            <div className="back-field" style={{ top: '28%', left: '74%', width: '20%' }}>{gender ?? '—'}</div>
            <div className="back-field" style={{ top: '35%', left: '74%', width: '20%' }}>{application.blood_type ?? '—'}</div>

            {/* Emergency Contact Info (Sits below the red text, next to "Name:" and "Contact No.") */}
            <div className="back-field" style={{ top: '65%', left: '30%', width: '40%' }}>{application.emergency_name || '—'}</div>
            <div className="back-field" style={{ top: '72%', left: '30%', width: '40%' }}>{application.emergency_contact_number || '—'}</div>
          </div>

        </div>
      </div>
    </>
  )
}
