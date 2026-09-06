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
          transition: transform 0.6s ease;
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
          box-shadow: 0 6px 20px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.12);
          background: #fff;
        }
        .eid-back {
          transform: rotateY(180deg);
        }

        /* object-fit: fill keeps pixel-perfect alignment with background image lines */
        .eid-bg-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          z-index: 0;
          display: block;
        }

        /* Shared field style — transform: translateY(-50%) centers text on each line */
        .eid-field {
          position: absolute;
          font-family: Arial, sans-serif;
          font-size: 12.5px;
          font-weight: 700;
          color: #111;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transform: translateY(-50%);
          line-height: 1;
          /* White halo keeps text readable over any background area */
          text-shadow:
            0 0 4px #fff,
            0 0 4px #fff,
            0 0 6px rgba(255,255,255,0.8);
          z-index: 2;
        }

        .eid-photo {
          position: absolute;
          border: 2px solid #333;
          background-color: #e8e8e8;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          z-index: 2;
          border-radius: 2px;
        }
        .eid-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .eid-photo-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: #aaa;
          font-size: 9px;
          font-family: Arial, sans-serif;
          text-align: center;
        }

        /* ── Responsive: scale down on small screens ── */
        @media (max-width: 560px) {
          .eid-card-3d {
            width: 340px;
            height: 214px;
          }
          .eid-field {
            font-size: 9px;
          }
        }
      `}</style>

      <div className="eid-scene">
        <div
          className={`eid-card-3d ${flipped ? 'flipped' : ''}`}
          onClick={onFlip}
          style={onFlip ? { cursor: 'pointer' } : { cursor: 'default' }}
        >
          {/* ══════════════ FRONT ══════════════ */}
          <div className="eid-face">
            <img
              src="/images/pwd-front.png"
              alt=""
              className="eid-bg-img"
            />

            {/* Name — sits on the "Name:" line */}
            <div
              className="eid-field"
              style={{ top: '42%', left: '30%', width: '37%' }}
            >
              {fullName}
            </div>

            {/* Type of Disability */}
            <div
              className="eid-field"
              style={{ top: '59%', left: '30%', width: '37%' }}
            >
              {disability}
            </div>

            {/* Photo box — right side of card */}
            <div
              className="eid-photo"
              style={{ top: '27%', left: '69.5%', width: '24.5%', height: '57%' }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Applicant photo" />
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

            {/* PWD / ID number — bottom right area */}
            <div
              className="eid-field"
              style={{ top: '82.5%', left: '73%', width: '24%', fontSize: '10px' }}
            >
              {pwdNumber}
            </div>
          </div>

          {/* ══════════════ BACK ══════════════ */}
          <div className="eid-face eid-back">
            <img
              src="https://cdn.postimage.me/2026/09/06/pwd-back.jpeg"
              alt=""
              className="eid-bg-img"
            />

            {/* ── Left column ── */}

            {/* Address */}
            <div
              className="eid-field"
              style={{ top: '28%', left: '30%', width: '41%', fontSize: '11px' }}
            >
              {address}
            </div>

            {/* Date of Birth */}
            <div
              className="eid-field"
              style={{ top: '35%', left: '30%', width: '30%' }}
            >
              {birthDate}
            </div>

            {/* Date Issued (last_updated) */}
            <div
              className="eid-field"
              style={{ top: '42%', left: '30%', width: '30%' }}
            >
              {fmtDate(application.last_updated)}
            </div>

            {/* ── Right column ── */}

            {/* Sex */}
            <div
              className="eid-field"
              style={{ top: '28%', left: '74%', width: '22%' }}
            >
              {gender ?? '—'}
            </div>

            {/* Blood Type */}
            <div
              className="eid-field"
              style={{ top: '35%', left: '74%', width: '22%' }}
            >
              {application.blood_type ?? '—'}
            </div>

            {/* ── Emergency contact ── */}

            {/* Name */}
            <div
              className="eid-field"
              style={{ top: '65%', left: '30%', width: '42%' }}
            >
              {application.emergency_name || '—'}
            </div>

            {/* Contact number */}
            <div
              className="eid-field"
              style={{ top: '72%', left: '30%', width: '42%' }}
            >
              {application.emergency_contact_number || '—'}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
