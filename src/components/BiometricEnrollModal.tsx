import { useState } from 'react'
import { Modal, Button } from 'react-bootstrap'
import { useAuth } from '../lib/auth'
import { fingerprintSensorAvailable } from '../lib/webauthn'
import Alert from './Alert'

interface BiometricEnrollModalProps {
  show: boolean
  onClose: () => void
  onSuccess?: () => void
  title?: string
  subtitle?: string
}

export default function BiometricEnrollModal({ show, onClose, onSuccess, title, subtitle }: BiometricEnrollModalProps) {
  const { enrollBiometric, sensorAvailable } = useAuth()
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleEnroll = async () => {
    setError(null)
    setEnrolling(true)
    const { error } = await enrollBiometric(nickname.trim() || undefined)
    setEnrolling(false)
    if (error) {
      setError(error)
    } else {
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setNickname('')
        onSuccess?.()
      }, 1200)
    }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-fingerprint text-primary-pdao me-2" />
          {title ?? 'Enable Fingerprint Unlock'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {success ? (
          <div className="text-center py-3">
            <div className="biometric-success-icon">
              <i className="bi bi-check-circle-fill" />
            </div>
            <h5 className="mt-3">Fingerprint enabled!</h5>
            <p className="text-muted">You can now unlock PDAOLink with your fingerprint.</p>
          </div>
        ) : !sensorAvailable ? (
          <Alert variant="warning" message="Your device does not have a fingerprint or biometric sensor available. You can continue without it — your account is still secured with your password." />
        ) : (
          <>
            {subtitle && <p className="text-muted">{subtitle}</p>}
            {error && <Alert variant="danger" message={error} />}
            <div className="text-center my-3">
              <div className="biometric-sensor-icon">
                <i className="bi bi-fingerprint" />
              </div>
              <p className="small text-muted mb-0">
                {enrolling
                  ? 'Touch your fingerprint sensor now…'
                  : 'Tap the button below and touch your sensor when prompted.'}
              </p>
            </div>
            <div className="mb-3">
              <label className="form-label">Nickname (optional)</label>
              <input
                className="form-control"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. My Phone"
                maxLength={40}
              />
            </div>
          </>
        )}
      </Modal.Body>
      {!success && (
        <Modal.Footer>
          <Button variant="soft" onClick={onClose} disabled={enrolling}>Skip for now</Button>
          <Button variant="primary" onClick={handleEnroll} disabled={enrolling || !sensorAvailable}>
            {enrolling
              ? <><span className="spinner-border spinner-border-sm me-1" /> Waiting…</>
              : <><i className="bi bi-fingerprint me-1" /> Enroll fingerprint</>}
          </Button>
        </Modal.Footer>
      )}
      <style>{`
        .biometric-sensor-icon {
          width: 80px; height: 80px; margin: 0 auto;
          border-radius: 50%; background: rgba(0, 86, 179, 0.1);
          display: grid; place-items: center; font-size: 2.5rem; color: #0056b3;
          animation: pulse 2s ease-in-out infinite;
        }
        .biometric-success-icon {
          width: 72px; height: 72px; margin: 0 auto;
          border-radius: 50%; background: rgba(25, 135, 84, 0.12);
          display: grid; place-items: center; font-size: 2.2rem; color: #198754;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 86, 179, 0.3); }
          50% { box-shadow: 0 0 0 12px rgba(0, 86, 179, 0); }
        }
      `}</style>
    </Modal>
  )
}
