import { useAuth } from '../../lib/auth'

export default function PendingPage() {
  const { profile } = useAuth()

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
      <i className="bi bi-hourglass-split" style={{ fontSize: 56, color: '#0056b3' }} />
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
          onClick={() => window.location.reload()}
        >
          <i className="bi bi-arrow-clockwise me-1" /> Refresh status
        </button>
      </div>
    </div>
  )
}