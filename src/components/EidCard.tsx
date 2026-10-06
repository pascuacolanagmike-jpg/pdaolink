import { type Application, appFullName, fmtDate } from '../lib/types'

interface EidCardProps {
  application: Application
  photoUrl: string | null
  flipped: boolean
  onFlip?: () => void
  sideBySide?: boolean
}

function getDisabilityText(app: Application): string {
  const raw = (app as any).disability_types
  const legacy = (app as any).disability_type
  let list: string[] = []
  if (Array.isArray(raw)) {
    list = raw.filter((x) => typeof x === 'string' && x.trim())
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed.filter((x) => typeof x === 'string' && x.trim())
      else if (typeof parsed === 'string' && parsed.trim()) list = [parsed.trim()]
    } catch {
      list = raw.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  if (list.length === 0 && typeof legacy === 'string' && legacy.trim()) list = [legacy.trim()]
  return list.length > 0 ? list.join(', ') : '—'
}

const styles = `
  /* =========================================================
     SINGLE SOURCE OF TRUTH FOR CARD GEOMETRY (CR80)
     Both the on-screen print preview AND the real printout
     read these values, so the preview is a 1:1 mirror of
     what actually comes out of the printer.
     ========================================================= */
  .eid-page-wrapper {
    --eid-card-w: 85.6mm;
    --eid-card-h: 53.98mm;
    --eid-card-gap: 10mm;
    --eid-card-radius: 8px;
    padding-bottom: 1rem;
  }

  /* =========================================
     BASE STYLES (For Screen Preview)
     ========================================= */
  .eid-scene { perspective: 1400px; width: 100%; max-width: 500px; margin: 0 auto; }
  .eid-card-3d {
    position: relative; width: 100%; aspect-ratio: 1.586 / 1;
    transform-style: preserve-3d;
    transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }
  .eid-card-3d.flipped { transform: rotateY(180deg); }

  .eid-face {
    position: absolute; inset: 0; border-radius: var(--eid-card-radius);
    backface-visibility: hidden; -webkit-backface-visibility: hidden;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
  }
  .eid-back-face { transform: rotateY(180deg); }

  .eid-bg {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: fill; display: block; z-index: 0;
  }

  /* Text Field Styling */
  .eid-text {
    position: absolute; z-index: 2; font-family: Arial, sans-serif;
    font-size: 13px; font-weight: 700; color: #111;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1; transform: translateY(-50%);
    text-shadow: 0 0 4px #fff, 0 0 4px #fff, 0 0 7px rgba(255,255,255,0.9);
  }
  .eid-text-center { text-align: center; }

  /* Front Face Field Positions */
  .field-front-name { top: 36%; left: 5%; width: 52%; }
  .field-front-disability { top: 55%; left: 5%; width: 52%; }
  .field-front-pwd { top: 83%; left: 70%; width: 28%; }

  /* Back Face Field Positions */
  .field-back-address { top: 12.1%; left: 16.6%; width: 52%; }
  .field-back-birth { top: 17.4%; left: 21.3%; width: 40%; }
  .field-back-issue { top: 23.0%; left: 20.0%; width: 40%; }
  .field-back-gender { top: 9.7%; left: 76.9%; width: 20%; }
  .field-back-blood { top: 15.2%; left: 76.9%; width: 20%; }
  .field-back-emergency-name { top: 47.4%; left: 16.6%; width: 50%; }
  .field-back-emergency-contact { top: 53.1%; left: 16.6%; width: 50%; }

  /* Photo Area */
  .eid-photo-wrap {
    position: absolute; z-index: 2; overflow: hidden;
    background: #f7f7f7; border: 2px solid #ccc; border-radius: 4px;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08);
  }
  .eid-photo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .eid-photo-empty {
    width: 100%; height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 6px;
    color: #bbb; font-size: 10px; font-family: Arial, sans-serif;
    background: #f9f9f9;
  }
  .eid-photo-empty svg { opacity: 0.5; }

  /* =========================================================
     PRINT LAYOUT  —  ONE markup, TWO contexts
       (a) on screen  -> only when sideBySide = true
       (b) on paper   -> automatically, via @media print
     ========================================================= */
  .eid-print-layout {
    display: none;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    gap: var(--eid-card-gap);
    background: #fff;
  }

  /* ---------- (a) ON-SCREEN MIRROR OF THE PRINTED SHEET ---------- */
  .eid-preview-viewport {
    width: 100%;
    overflow-x: auto;
    padding: 8px 0 20px;
    background: #f1f5f9;
    border-radius: 12px;
  }
  .eid-print-layout.eid-preview-mode {
    display: flex;
    width: max-content;
    margin: 0 auto;
    padding: 6mm 8mm;   /* makes it read like a sheet; zeroed for real printing */
  }
  .eid-preview-mode .eid-print-card {
    box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
    outline: 1px solid #e2e8f0;
  }
  .eid-preview-label {
    font-family: Arial, sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #94a3b8;
  }

  /* ---------- CARD WRAPPER / CARD (shared by both contexts) ---------- */
  .eid-print-card-wrap {
    display: flex; flex-direction: column;
    align-items: center; gap: 6px;
  }
  .eid-print-card {
    position: relative;
    box-sizing: border-box;
    width: var(--eid-card-w);
    height: var(--eid-card-h);
    border-radius: var(--eid-card-radius);
    overflow: hidden;
    background: #fff;
  }

  /* =========================================
     PRINT STYLES (For Actual Printing)
     ========================================= */
  @media print {
    @page { size: auto; margin: 0; }

    /* 1. Hide EVERYTHING on the page by default */
    body * {
      visibility: hidden;
    }

    /* 2. Hide the interactive 3D card completely */
    .eid-scene {
      display: none !important;
    }

    /* 3. Show ONLY the print layout and its children */
    .eid-print-layout, .eid-print-layout * {
      visibility: visible !important;
    }

    /* 4. CENTER the cards on the page — SIDE-BY-SIDE (row) */
    .eid-print-layout {
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      gap: var(--eid-card-gap) !important;
      align-items: center !important;
      justify-content: center !important;
      background: #fff !important;
      width: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 99999 !important;
    }

    /* 5. Force exact CR80 physical dimensions (85.6mm × 53.98mm) */
    .eid-print-card {
      width: var(--eid-card-w) !important;
      height: var(--eid-card-h) !important;
      box-shadow: none !important;
      outline: none !important;
      border: 1px solid #ddd !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* 6. Strip every preview-only wrapper so paper == preview */
    .eid-preview-viewport {
      overflow: visible !important;
      padding: 0 !important;
      width: auto !important;
      background: transparent !important;
      border-radius: 0 !important;
    }
    .eid-preview-label { display: none !important; }
    .eid-print-card-wrap { gap: 0 !important; }
  }
`

export default function EidCard({
  application,
  photoUrl,
  flipped,
  onFlip,
  sideBySide = false,
}: EidCardProps) {
  const fullName = appFullName(application) || '—'
  const address = [
    application.address, application.barangay,
    application.municipality, application.province,
  ].filter(Boolean).join(', ')
  const disability = getDisabilityText(application)
  const pwdNumber = application.pwd_number || `PDAO-${application.id.slice(0, 8).toUpperCase()}`
  const birthDate = fmtDate(application.birth_date)
  const gender = application.gender

  const frontInner = (
    <>
      <img src="https://cdn.postimage.me/2026/09/13/pwd-front.jpeg" alt="" className="eid-bg" />

      <div className="eid-text eid-text-center field-front-name">
        {fullName}
      </div>

      <div className="eid-text eid-text-center field-front-disability">
        {disability}
      </div>

      <div className="eid-photo-wrap" style={{ top: '26%', left: '68%', width: '27%', height: '54%' }}>
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

      <div className="eid-text eid-text-center field-front-pwd">
        {pwdNumber}
      </div>
    </>
  )

  const backInner = (
    <>
      <img src="https://cdn.postimage.me/2026/09/13/849d1475-9ccb-4eae-811a-06546c6317c0.jpeg" alt="" className="eid-bg" />

      <div className="eid-text field-back-address">
        {address || '—'}
      </div>

      <div className="eid-text field-back-birth">
        {birthDate}
      </div>

      <div className="eid-text field-back-issue">
        {fmtDate(application.last_updated)}
      </div>

      <div className="eid-text field-back-gender">
        {gender ?? '—'}
      </div>

      <div className="eid-text field-back-blood">
        {application.blood_type ?? '—'}
      </div>

      <div className="eid-text field-back-emergency-name">
        {application.emergency_name || '—'}
      </div>

      <div className="eid-text field-back-emergency-contact">
        {application.emergency_contact_number || '—'}
      </div>
    </>
  )

  // ------------------------------------------------------------------
  // SIDE-BY-SIDE MODE
  // Renders the *same* `.eid-print-layout` markup that the printer
  // uses, at the *same* 85.6mm x 53.98mm size — so the preview is a
  // true mirror of the printed sheet. The only extras are the
  // "Front"/"Back" labels and the sheet chrome, both of which are
  // stripped out by @media print.
  // ------------------------------------------------------------------
  if (sideBySide) {
    return (
      <div className="eid-page-wrapper">
        <style>{styles}</style>
        <div className="eid-preview-viewport">
          <div className="eid-print-layout eid-preview-mode">
            <div className="eid-print-card-wrap">
              <div className="eid-print-card">{frontInner}</div>
              <div className="eid-preview-label">Front</div>
            </div>
            <div className="eid-print-card-wrap">
              <div className="eid-print-card">{backInner}</div>
              <div className="eid-preview-label">Back</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="eid-page-wrapper">
      <style>{styles}</style>

      {/* 1. Interactive Screen View */}
      <div className="eid-scene">
        <div className={`eid-card-3d${flipped ? ' flipped' : ''}`} onClick={onFlip} style={{ cursor: onFlip ? 'pointer' : 'default' }}>
          <div className="eid-face">{frontInner}</div>
          <div className="eid-face eid-back-face">{backInner}</div>
        </div>
      </div>

      {/* 2. Hidden Print Layout (Automatically appears when printing) */}
      <div className="eid-print-layout">
        {/* Front Card (left) */}
        <div className="eid-print-card-wrap">
          <div className="eid-print-card">{frontInner}</div>
        </div>
        {/* Back Card (right) */}
        <div className="eid-print-card-wrap">
          <div className="eid-print-card">{backInner}</div>
        </div>
      </div>
    </div>
  )
}