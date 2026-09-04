import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Nav, Navbar, NavDropdown } from 'react-bootstrap'
import { useAuth } from '../lib/auth'

interface NavItem {
  to: string
  icon: string
  label: string
}

interface AppLayoutProps {
  navItems: NavItem[]
  children: ReactNode
}

export default function AppLayout({ navItems, children }: AppLayoutProps) {
  const { profile, unreadCount, signOut, biometric, lockApp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showOffcanvas, setShowOffcanvas] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const homeLink = profile?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
  const initials = (profile?.fullname ?? 'U')[0]?.toUpperCase() ?? 'U'
  const firstName = profile?.fullname?.split(' ')[0] ?? 'User'

  const SidebarLinks = () => (
    <Nav className="flex-column">
      {navItems.map((item) => (
        <Nav.Link
          key={item.to}
          as={Link}
          to={item.to}
          active={location.pathname === item.to}
          onClick={() => setShowOffcanvas(false)}
        >
          <i className={`bi ${item.icon}`} /> {item.label}
        </Nav.Link>
      ))}
    </Nav>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar expand="lg" variant="dark" className="navbar-pdao sticky-top">
        <div className="container-fluid px-3 px-lg-4">
          <button
            className="btn btn-sm btn-light d-lg-none me-2"
            type="button"
            onClick={() => setShowOffcanvas(true)}
          >
            <i className="bi bi-list" />
          </button>
          <Navbar.Brand as={Link} to={homeLink} className="d-flex align-items-center gap-2">
            <img
              src="https://cdn.postimage.me/2026/09/04/ce3cc890-fba2-4622-b7f4-8d05cfa7a8d5.jpeg"
              alt="PDAOLink Logo"
              style={{
                width: 36,
                height: 36,
                objectFit: 'cover',
                borderRadius: 8,
              }}
            />
            <span>PDAOLink</span>
          </Navbar.Brand>

          <Navbar.Collapse className="justify-content-end">
            <Nav className="align-items-lg-center gap-1">
              {biometric && (
                <Nav.Link onClick={lockApp} title="Lock app" className="d-none d-lg-inline-flex">
                  <i className="bi bi-lock" />
                </Nav.Link>
              )}
              <Nav.Link
                as={Link}
                to={profile?.role === 'admin' ? '/admin/dashboard' : '/notifications'}
                className="notif-dot"
                title="Notifications"
              >
                <i className="bi bi-bell" />
                {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
              </Nav.Link>
              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2">
                    <span
                      className="d-inline-grid rounded-circle bg-white text-primary-pdao fw-bold"
                      style={{ width: 30, height: 30, fontSize: '0.8rem', placeItems: 'center' }}
                    >
                      {initials}
                    </span>
                    <span className="d-none d-lg-inline">{firstName}</span>
                  </span>
                }
                align="end"
              >
                <NavDropdown.ItemText className="small text-muted">
                  {profile?.email}
                </NavDropdown.ItemText>
                <NavDropdown.Divider />
                {profile?.role === 'client' && (
                  <>
                    <NavDropdown.Item as={Link} to="/profile">
                      <i className="bi bi-person me-2" /> My Profile
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/change-password">
                      <i className="bi bi-key me-2" /> Change Password
                    </NavDropdown.Item>
                  </>
                )}
                {profile?.role === 'admin' && (
                  <NavDropdown.Item as={Link} to="/admin/dashboard">
                    <i className="bi bi-speedometer2 me-2" /> Dashboard
                  </NavDropdown.Item>
                )}
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleSignOut} className="text-danger">
                  <i className="bi bi-box-arrow-right me-2" /> Logout
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </div>
      </Navbar>

      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-2 d-none d-lg-block">
            <div className="sidebar">
              <SidebarLinks />
            </div>
          </div>
          <div className="col-lg-10 p-3 p-lg-4">{children}</div>
        </div>
      </div>

      {showOffcanvas && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1040,
          }}
          onClick={() => setShowOffcanvas(false)}
        >
          <div
            className="bg-white h-100 p-3"
            style={{ width: 260, maxWidth: '80vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
              <h5 className="mb-0">Menu</h5>
              <button className="btn-close" onClick={() => setShowOffcanvas(false)} />
            </div>
            <SidebarLinks />
            <div className="mt-auto pt-3 border-top">
              {biometric && (
                <button className="btn btn-soft w-100 mb-2" onClick={() => { lockApp(); setShowOffcanvas(false) }}>
                  <i className="bi bi-lock me-1" /> Lock app
                </button>
              )}
              <button className="btn btn-outline-danger w-100" onClick={handleSignOut}>
                <i className="bi bi-box-arrow-right me-1" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer-pdao">
        <div className="container-fluid px-3 px-lg-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
          <span>
            <i className="bi bi-building-gear me-1" /> Persons with Disability Affairs Office —
            Digital Registration & Management System
          </span>
          <span>&copy; 2025 PDAOLink. All rights reserved.</span>
        </div>
      </footer>

    </div>
  )
}
