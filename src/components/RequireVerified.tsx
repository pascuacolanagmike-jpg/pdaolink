import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function RequireVerified({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return null

  switch (profile?.verification_status) {
    case 'approved': return <>{children}</>
    case 'pending':  return <Navigate to="/verify/pending"  replace />
    case 'rejected': return <Navigate to="/verify/rejected" replace />
    case 'resubmit': return <Navigate to="/verify"          replace />
    default:         return <Navigate to="/verify"          replace />
  }
}