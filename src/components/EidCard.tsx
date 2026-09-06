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
        
        /* Background Image Layer */
        .eid-bg-img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        /* Professional Text Fields */
        .front-field, .back-field {
          position: absolute;
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 13px; /* Professional, clean size */
          font-weight: 600;
          color: #222;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          
          /* The Magic Alignment Trick */
          transform: translateY(-50%);
          line-height: 1;
          
          /* White subtle glow to make text readable over the background */
          text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff;
          z-index: 1;
          padding-left: 5px; /* Small buffer after the labels */
        }

        /* Photo Box Overlay */
        .photo-overlay {
          position: absolute;
          border: 1px solid #333; /* Clean, sharp border */
          background-color: #f8f8f8;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          z-index: 1;
          box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
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
            font-size: 10px;
          }
        }
      `}</style>

      <div className="eid-scene">
        <div className={`eid-card-3d ${flipped ? 'flipped' : ''}`} onClick={onFlip} style={onFlip ? {} : { cursor: 'default' }}>
          
          {/* FRONT */}
          <div className="eid-face eid-front">
            {/* Local front image */}
            <img src="/images/pwd-front.png" alt="Front Background" className="eid-bg-img" />
            
            {/* Name: Centered perfectly on the line */}
            <div className="front-field" style={{ top: '42%', left: '15%', width: '45%' }}>
              {fullName}
            </div>
            
            {/* Type of Disability */}
            <div className="front-field" style={{ top: '60%', left: '15%', width: '45%' }}>
              {disability}
            </div>

            {/* Signature (Empty) */}
            <div className="front-field" style={{ top: '77%', left: '15%', width: '40%' }}>
            </div>

            {/* Photo Box (Aligned exactly with the box) */}
            <div className="photo-overlay" style={{ top: '26%', left: '70%', width: '24%', height: '55%' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Applicant" className="photo-img" />
              ) : (
                <div className="photo-placeholder"></div>
              )}
            </div>

            {/* ID No (Bottom Right) */}
            <div className="front-field" style={{ top: '84%', left: '72%', width: '25%' }}>
              {pwdNumber}
            </div>
          </div>

          {/* BACK */}
          <div className="eid-face eid-back">
            {/* Direct embedded link for the back */}
            <img src="https://cdn.postimage.me/2026/09/06/pwd-back.jpeg" alt="Back Background" className="eid-bg-img" />
            
            {/* Left Column */}
            <div className="back-field" style={{ top: '37%', left: '15%', width: '50%' }}>
              {address}
            </div>
            <div className="back-field" style={{ top: '47%', left: '15%', width: '30%' }}>
              {birthDate}
            </div>
            <div className="back-field" style={{ top: '57%', left: '15%', width: '30%' }}>
              {fmtDate(application.last_updated)}
            </div>

            {/* Right Column */}
            <div className="back-field" style={{ top: '37%', left: '72%', width: '20%' }}>
              {gender ?? '—'}
            </div>
            <div className="back-field" style={{ top: '47%', left: '72%', width: '20%' }}>
              {application.blood_type ?? '—'}
            </div>

            {/* Emergency Contact Section */}
            <div className="back-field" style={{ top: '72%', left: '15%', width: '40%' }}>
              {application.emergency_name || '—'}
            </div>
            <div className="back-field" style={{ top: '80%', left: '15%', width: '40%' }}>
              {application.emergency_contact_number || '—'}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
