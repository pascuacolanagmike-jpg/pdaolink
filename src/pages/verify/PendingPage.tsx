import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function PendingPage() {
  const { profile, refreshProfile } = useAuth()
  const [checking, setChecking] = useState(false)

  // Log once so you can confirm the shape in the console
  console.log('PendingPage profile:', profile)

  // 🔑 Route away based on the real field name
  if (profile?.verification_status === 'approved') {
    return <Navigate to="/dashboard" replace />
  }

  if (profile?.verification_status === 'rejected') {
    return <Navigate to="/rejected" replace />
  }

  if (profile?.verification_status === 'resubmit') {
    return <Navigate to="/verify" replace />
  }

  async function handleRefresh() {
    setChecking(true)
    try {
      await refreshProfile() // ← updates context → re-renders → redirect fires
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
      <i
        className="bi bi-hourglass-split"
        style={{ fontSize: 56, color: '#0056b3' }}
      />
      <h4 className="mt-3">Your documents are under review</h4>
      <p className="text-muted">
        An administrator will verify your submitted documents. You'll be
        notified once your account is activated.
      </p>

      {profile?.verification_note && (
        <div className="alert alert-info small mt-3 text-start">
          <strong>Note from admin:</strong> {profile.verification_note}
        </div>
      )}

      <div className="mt-4">
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={handleRefresh}
          disabled={checking}
        >
          <i className="bi bi-arrow-clockwise me-1" />
          {checking ? 'Checking…' : 'Refresh status'}
        </button>
      </div>
    </div>
  )
}
