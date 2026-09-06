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
        
        .eid-bg-img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        .front-field, .back-field {
          position: absolute;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #111;
          
          /* Prevents text from wrapping or jumping around */
          white-space: nowrap; 
          overflow: hidden;
          text-overflow: ellipsis;
          
          /* Perfectly centers the text on the line */
          transform: translateY(-50%);
          line-height: 1;
          
          /* White subtle glow to make text readable over the background */
          text-shadow: 0 0 2px #fff, 0 0 2px #fff;
          z-index: 1;
          
          /* Aligns text to start right after the printed labels */
          padding-left: 5px;
        }

        .photo-overlay {
          position: absolute;
          border: 2px solid #000; /* Sharp border */
          background-color: #f8f8f8;
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
            {/* Local front image (change if you have a direct link) */}
            <img src="/images/pwd-front.png" alt="Front Background" className="eid-bg-img" />
            
            {/* Exact positions matched to the image lines */}
            <div className="front-field" style={{ top: '42%', left: '16%', width: '48%' }}>{fullName}</div>
            
            <div className="front-field" style={{ top: '59%', left: '16%', width: '48%' }}>{disability}</div>

            {/* Signature Line (Empty for physical signature) */}
            <div className="front-field" style={{ top: '76%', left: '16%', width: '40%' }}></div>

            {/* Photo Box - Matches exact black box dimensions */}
            <div className="photo-overlay" style={{ top: '28%', left: '69%', width: '24%', height: '54%' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Applicant" className="photo-img" />
              ) : (
                <div className="photo-placeholder"></div>
              )}
            </div>

            {/* ID No (Bottom Right) */}
            <div className="front-field" style={{ top: '83%', left: '72%', width: '25%' }}>{pwdNumber}</div>
          </div>

          {/* BACK */}
          <div className="eid-face eid-back">
            {/* Direct embedded link for the back */}
            <img src="https://cdn.postimage.me/2026/09/06/pwd-back.jpeg" alt="Back Background" className="eid-bg-img" />
            
            {/* Left Column - Aligned exactly with the printed labels */}
            <div className="back-field" style={{ top: '28%', left: '11%', width: '50%' }}>{address}</div>
            <div className="back-field" style={{ top: '35%', left: '11%', width: '30%' }}>{birthDate}</div>
            <div className="back-field" style={{ top: '42%', left: '11%', width: '30%' }}>{fmtDate(application.last_updated)}</div>

            {/* Right Column - Aligned exactly with the printed labels */}
            <div className="back-field" style={{ top: '28%', left: '71%', width: '20%' }}>{gender ?? '—'}</div>
            <div className="back-field" style={{ top: '35%', left: '71%', width: '20%' }}>{application.blood_type ?? '—'}</div>

            {/* Emergency Contact Section - Placed safely below the red text */}
            <div className="back-field" style={{ top: '58%', left: '11%', width: '45%' }}>{application.emergency_name || '—'}</div>
            <div className="back-field" style={{ top: '65%', left: '11%', width: '45%' }}>{application.emergency_contact_number || '—'}</div>
          </div>

        </div>
      </div>
    </>
  )
}
