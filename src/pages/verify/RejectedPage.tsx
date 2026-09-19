import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function RejectedPage() {
  const { profile } = useAuth()

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
      <i className="bi bi-x-circle" style={{ fontSize: 56, color: '#dc3545' }} />
      <h4 className="mt-3">Verification not approved</h4>

      {profile?.verification_note && (
        <div className="alert alert-warning small mt-3 text-start">
          <strong>Reason:</strong> {profile.verification_note}
        </div>
      )}

      <p className="text-muted">
        You can submit new documents if you believe this was a mistake.
      </p>
      <Link to="/verify" className="btn btn-primary mt-2">
        <i className="bi bi-arrow-repeat me-1" /> Submit again
      </Link>
    </div>
  )
}