// ... (everything above is the same, only the front face divs change)

{/* Name – top: 40.5% (tweaked) */}
<div
  style={{
    position: 'absolute',
    top: '40.5%',          // 🔁 adjusted from 41%
    left: '5%',
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

{/* Disability – top: 61.5% (tweaked) */}
<div
  style={{
    position: 'absolute',
    top: '61.5%',          // 🔁 adjusted from 62%
    left: '5%',
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
