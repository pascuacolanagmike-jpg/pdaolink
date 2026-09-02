import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function BiometricLockScreen() {
  const { unlockWithFingerprint, biometric, signOut } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const handleUnlock = async () => {
    setError(null)
    setVerifying(true)
    const { error } = await unlockWithFingerprint()
    setVerifying(false)
    if (error) setError(error)
  }

  return (
    <div className="biometric-lock">
      <div className="biometric-lock-card">
        <div className="biometric-lock-icon">
          <i className="bi bi-fingerprint" />
        </div>
        <h3>Biometric Verification Required</h3>
        <p className="biometric-lock-subtitle">
          Your account is protected with {biometric?.device_type ?? 'biometric'} verification.
          Please authenticate to continue.
        </p>
        {error && <div className="biometric-lock-error"><i className="bi bi-exclamation-triangle me-1" />{error}</div>}
        <button
          className="btn btn-primary biometric-lock-btn"
          onClick={handleUnlock}
          disabled={verifying}
        >
          {verifying ? (
            <><span className="spinner-border spinner-border-sm me-2" /> Waiting for sensor…</>
          ) : (
            <><i className="bi bi-fingerprint me-2" /> Verify with {biometric?.device_type ?? 'Fingerprint'}</>
          )}
        </button>
        <div className="biometric-lock-divider"><span>or</span></div>
        <button className="btn btn-soft w-100" onClick={() => signOut()}>
          <i className="bi bi-box-arrow-right me-1" /> Sign out
        </button>
        <div className="biometric-lock-secure">
          <i className="bi bi-shield-lock-fill" /> Zero Trust · E2EE Secured
        </div>
      </div>
      <style>{`
        .biometric-lock {
          position: fixed; inset: 0; z-index: 1500;
          background: linear-gradient(135deg, #003d80 0%, #002a5c 100%);
          display: grid; place-items: center; padding: 1rem;
        }
        .biometric-lock-card {
          background: #fff; border-radius: 1.2rem; padding: 2.5rem 2rem;
          max-width: 400px; width: 100%; text-align: center;
          box-shadow: 0 24px 70px rgba(0,0,0,0.35);
        }
        .biometric-lock-icon {
          width: 90px; height: 90px; margin: 0 auto 1.2rem;
          border-radius: 50%; background: rgba(0, 86, 179, 0.1);
          display: grid; place-items: center; font-size: 3rem; color: #0056b3;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 86, 179, 0.3); }
          50% { box-shadow: 0 0 0 12px rgba(0, 86, 179, 0); }
        }
        .biometric-lock-card h3 { font-weight: 800; margin-bottom: 0.5rem; }
        .biometric-lock-subtitle { color: #6c757d; font-size: 0.9rem; margin-bottom: 1.5rem; }
        .biometric-lock-error {
          background: #fdecee; color: #8a1f2b; border-radius: 0.6rem;
          padding: 0.6rem 0.8rem; font-size: 0.85rem; margin-bottom: 1rem;
        }
        .biometric-lock-btn { padding: 0.7rem 1.2rem; font-size: 1rem; }
        .biometric-lock-divider {
          display: flex; align-items: center; gap: 0.8rem; margin: 1.2rem 0;
          color: #adb5bd; font-size: 0.8rem;
        }
        .biometric-lock-divider::before, .biometric-lock-divider::after {
          content: ""; flex: 1; height: 1px; background: #e4e9f0;
        }
        .biometric-lock-secure {
          margin-top: 1.5rem; font-size: 0.75rem; color: #198754; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 0.3rem;
        }
      `}</style>
    </div>
  )
}
