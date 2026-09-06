{/* ═══════════════ FRONT ═══════════════ */}
<div className="eid-face">
  <img
    src="https://cdn.postimage.me/2026/09/06/pwd-front.jpeg"
    alt=""
    className="eid-bg"
  />

  {/* Name – left: 5% */}
  <div
    style={{
      position: 'absolute',
      top: '41%',
      left: '5%',          // ✅ matches your working value
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

  {/* Disability – now also left: 5% to match the name */}
  <div
    style={{
      position: 'absolute',
      top: '62%',
      left: '5%',          // 🔁 changed from 14% to 5%
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

  {/* Photo box – adjust these values with DevTools to match exactly */}
  <div
    className="eid-photo-wrap"
    style={{
      top: '26%',
      left: '70%',
      width: '25%',
      height: '54%',
    }}
  >
    {photoUrl ? (
      <img src={photoUrl} alt="Applicant" />
    ) : (
      <div className="eid-photo-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
