import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import BiometricLockScreen from './components/BiometricLockScreen'

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
import AdminAnnouncements from './pages/admin/AdminAnnouncements'
import ReportsPage from './pages/admin/ReportsPage'
import AdminEidPage from './pages/admin/AdminEidPage'
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

export default function App() {
  const { profile, loading, biometricState } = useAuth()

  if (loading) return <Loading />

  // If the user has biometric enabled and the session is locked, show the lock screen
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

      {/* Client */}
      <Route path="/dashboard" element={<RequireAuth role="client"><ClientDashboard /></RequireAuth>} />
      <Route path="/application" element={<RequireAuth role="client"><ApplicationPage /></RequireAuth>} />
      <Route path="/upload" element={<RequireAuth role="client"><UploadPage /></RequireAuth>} />
      <Route path="/status" element={<RequireAuth role="client"><StatusPage /></RequireAuth>} />
      <Route path="/e-id" element={<RequireAuth role="client"><EidPage /></RequireAuth>} />
      <Route path="/announcements" element={<RequireAuth role="client"><ClientAnnouncements /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth role="client"><NotificationsPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth role="client"><ProfilePage /></RequireAuth>} />
      <Route path="/change-password" element={<RequireAuth role="client"><ChangePasswordPage /></RequireAuth>} />

      {/* Admin */}
      <Route path="/admin/dashboard" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/applicants" element={<RequireAuth role="admin"><ApplicantsPage /></RequireAuth>} />
      <Route path="/admin/applicant/:id" element={<RequireAuth role="admin"><ApplicantDetailPage /></RequireAuth>} />
      <Route path="/admin/announcements" element={<RequireAuth role="admin"><AdminAnnouncements /></RequireAuth>} />
      <Route path="/admin/reports" element={<RequireAuth role="admin"><ReportsPage /></RequireAuth>} />
      <Route path="/admin/e-id" element={<RequireAuth role="admin"><AdminEidPage /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
