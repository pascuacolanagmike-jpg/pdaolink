/* ═══════════════════════════════════════════
   E-ID 3D Flip Card
   ═══════════════════════════════════════════ */

/* ── Scene wrapper ── */
.eid-scene {
  perspective: 1400px;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}

/* ── 3D card container ── */
.eid-card-3d {
  position: relative;
  width: 100%;
  aspect-ratio: 1.586 / 1;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.eid-card-3d.flipped {
  transform: rotateY(180deg);
}

/* ── Shared face styles ── */
.eid-face {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 12px 40px rgba(0, 86, 179, 0.20),
    0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ── Front face ── */
.eid-front {
  background: linear-gradient(135deg, #0056b3 0%, #003d80 100%);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

/* ── Back face ── */
.eid-back {
  background: linear-gradient(135deg, #003d80 0%, #002a5c 100%);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.15);
  transform: rotateY(180deg);
}


/* ═══════════════════════════════════════════
   FRONT — Header
   ═══════════════════════════════════════════ */

.eid-header-bar {
  background: rgba(255, 255, 255, 0.10);
  padding: 0.4rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.eid-gov-label {
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: rgba(255, 255, 255, 0.80);
  text-transform: uppercase;
}

.eid-office-label {
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin-top: 1px;
}

.eid-id-badge {
  background: #fff;
  color: #0056b3;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
}


/* ═══════════════════════════════════════════
   FRONT — Body
   ═══════════════════════════════════════════ */

.eid-body {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem 0.85rem;
  flex: 1;
  min-height: 0;
}

/* Photo box */
.eid-photo-box {
  flex-shrink: 0;
  width: 72px;
  height: 88px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.10);
  border: 2px solid rgba(255, 255, 255, 0.25);
  display: grid;
  place-items: center;
}

.eid-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.eid-photo-placeholder {
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.50);
}

/* Info column */
.eid-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.eid-name {
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.eid-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.62rem;
}

.eid-label {
  color: rgba(255, 255, 255, 0.60);
  font-weight: 600;
  white-space: nowrap;
}

.eid-value {
  color: #fff;
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.eid-value-sm {
  font-size: 0.55rem;
}


/* ═══════════════════════════════════════════
   FRONT — Footer
   ═══════════════════════════════════════════ */

.eid-footer-bar {
  background: rgba(0, 0, 0, 0.20);
  padding: 0.3rem 0.85rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.70);
  font-weight: 600;
}


/* ═══════════════════════════════════════════
   BACK — Header
   ═══════════════════════════════════════════ */

.eid-header-bar-back {
  text-align: center;
}


/* ═══════════════════════════════════════════
   BACK — Body
   ═══════════════════════════════════════════ */

.eid-back-body {
  flex: 1;
  padding: 0.6rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 0;
}

.eid-back-section {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.eid-back-label {
  font-size: 0.58rem;
  color: rgba(255, 255, 255, 0.60);
  font-weight: 600;
  white-space: nowrap;
}

.eid-back-value {
  font-size: 0.62rem;
  color: #fff;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}


/* ═══════════════════════════════════════════
   BACK — QR / ID area
   ═══════════════════════════════════════════ */

.eid-qr-area {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.eid-qr-placeholder {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 6px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.eid-qr-placeholder i {
  font-size: 1.8rem;
  color: #003d80;
}

.eid-qr-text {
  font-size: 0.58rem;
  color: rgba(255, 255, 255, 0.80);
}

.eid-qr-id {
  font-weight: 800;
  color: #fff;
  font-size: 0.65rem;
  margin-top: 1px;
}


/* ═══════════════════════════════════════════
   BACK — Footer
   ═══════════════════════════════════════════ */

.eid-footer-bar-back {
  justify-content: space-between;
}


/* ═══════════════════════════════════════════
   Page wrapper
   ═══════════════════════════════════════════ */

.eid-page-wrapper {
  padding-bottom: 1rem;
}


/* ═══════════════════════════════════════════
   Print styles
   ═══════════════════════════════════════════ */

@media print {
  /* Hide all non-card UI */
  .no-print,
  .navbar-pdao,
  .sidebar,
  .footer-pdao {
    display: none !important;
  }

  .eid-scene {
    max-width: 3.5in;
    perspective: none;
  }

  .eid-card-3d {
    cursor: default;
    transform: none !important;
    transition: none !important;
    box-shadow: none !important;
    border: 1px solid #ccc;
    border-radius: 12px;
    aspect-ratio: 1.586 / 1;
  }

  /* Show both faces stacked vertically when printing */
  .eid-face {
    position: relative;
    transform: none !important;
    backface-visibility: visible;
    -webkit-backface-visibility: visible;
    page-break-inside: avoid;
    box-shadow: none;
  }

  .eid-back {
    transform: none;
    margin-top: 0.3in;
  }

  .eid-card-3d.flipped {
    transform: none;
  }

  body {
    background: #fff !important;
  }
}
