import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import BiometricLockScreen from './components/BiometricLockScreen'
import RequireVerified from './components/RequireVerified'

import VerifyPage from './pages/verify/VerifyPage'
import PendingPage from './pages/verify/PendingPage'
import RejectedPage from './pages/verify/RejectedPage'

import ClientDashboard from './pages/client/ClientDashboard'
import ApplicationPage from './pages/client/ApplicationPage'
import UploadPage from './pages/client/UploadPage'
import StatusPage from './pages/client/StatusPage'
import EidPage from './pages/client/EidPage'
import ClientAnnouncements from './pages/client/ClientAnnouncements'
import NotificationsPage from './pages/client/NotificationsPage'
import ProfilePage from './pages/client/ProfilePage'
import ChangePasswordPage from './pages/client/ChangePasswordPage'

import AdminDashboard from './pages/admin/AdminDashboard'
import ApplicantsPage from './pages/admin/ApplicantsPage'
import ApplicantDetailPage from './pages/admin/ApplicantDetailPage'
import ArchivedPage from './pages/admin/ArchivedPage'
import AdminAnnouncements from './pages/admin/AdminAnnouncements'
import ReportsPage from './pages/admin/ReportsPage'
import AdminEidPage from './pages/admin/AdminEidPage'
import AdminVerifications from './pages/admin/AdminVerifications'
import AdminChangePassword from './pages/admin/AdminChangePassword'

function Loading() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading…</span>
      </div>
    </div>
  )
}

function RequireAuth({ children, role }: { children: React.ReactNode; role?: 'client' | 'admin' }) {
  const { profile, loading } = useAuth()
  if (loading) return <Loading />
  if (!profile) return <Navigate to="/login" replace />
  if (role && profile.role !== role) {
    return <Navigate to={role === 'admin' ? '/dashboard' : '/admin/dashboard'} replace />
  }
  return <>{children}</>
}

// Client routes need BOTH: logged in as client AND verification approved
function ClientRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="client">
      <RequireVerified>{children}</RequireVerified>
    </RequireAuth>
  )
}

export default function App() {
  const { profile, loading, biometricState } = useAuth()

  if (loading) return <Loading />

  if (profile && biometricState === 'locked') {
    return <BiometricLockScreen />
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={profile ? <Navigate to={profile.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace /> : <LandingPage />} />
      <Route path="/login" element={profile ? <Navigate to={profile.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace /> : <LoginPage />} />
      <Route path="/register" element={profile ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Identity verification — accessible to logged-in clients, but NOT gated by approval */}
      <Route path="/verify"          element={<RequireAuth role="client"><VerifyPage /></RequireAuth>} />
      <Route path="/verify/pending"  element={<RequireAuth role="client"><PendingPage /></RequireAuth>} />
      <Route path="/verify/rejected" element={<RequireAuth role="client"><RejectedPage /></RequireAuth>} />

      {/* Client — gated by verification */}
      <Route path="/dashboard"       element={<ClientRoute><ClientDashboard /></ClientRoute>} />
      <Route path="/application"     element={<ClientRoute><ApplicationPage /></ClientRoute>} />
      <Route path="/upload"          element={<ClientRoute><UploadPage /></ClientRoute>} />
      <Route path="/status"          element={<ClientRoute><StatusPage /></ClientRoute>} />
      <Route path="/e-id"            element={<ClientRoute><EidPage /></ClientRoute>} />
      <Route path="/announcements"   element={<ClientRoute><ClientAnnouncements /></ClientRoute>} />
      <Route path="/notifications"   element={<ClientRoute><NotificationsPage /></ClientRoute>} />
      <Route path="/profile"         element={<ClientRoute><ProfilePage /></ClientRoute>} />
      <Route path="/change-password" element={<ClientRoute><ChangePasswordPage /></ClientRoute>} />

      {/* Admin — unaffected by verification */}
      <Route path="/admin/dashboard"       element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/applicants"      element={<RequireAuth role="admin"><ApplicantsPage /></RequireAuth>} />
      <Route path="/admin/applicant/:id"   element={<RequireAuth role="admin"><ApplicantDetailPage /></RequireAuth>} />
      <Route path="/admin/archived"        element={<RequireAuth role="admin"><ArchivedPage /></RequireAuth>} />
      <Route path="/admin/announcements"   element={<RequireAuth role="admin"><AdminAnnouncements /></RequireAuth>} />
      <Route path="/admin/reports"         element={<RequireAuth role="admin"><ReportsPage /></RequireAuth>} />
      <Route path="/admin/e-id"            element={<RequireAuth role="admin"><AdminEidPage /></RequireAuth>} />
      <Route path="/admin/change-password" element={<RequireAuth role="admin"><AdminChangePassword /></RequireAuth>} />
      <Route path="/admin/verifications" element={<RequireAuth role="admin"><AdminVerifications /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}