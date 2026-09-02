import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { CLIENT_NAV } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { GENDER_OPTIONS, CIVIL_STATUS_OPTIONS, fmtDate } from '../../lib/types'
import Alert from '../../components/Alert'
import BiometricEnrollModal from '../../components/BiometricEnrollModal'

export default function ProfilePage() {
  const { profile, refreshProfile, biometric, sensorAvailable, disableBiometric, enrollBiometric } = useAuth()
  const [fullname, setFullname] = useState(profile?.fullname ?? '')
  const [contactNumber, setContactNumber] = useState(profile?.contact_number ?? '')
  const [address, setAddress] = useState(profile?.address ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [gender, setGender] = useState(profile?.gender ?? '')
  const [civilStatus, setCivilStatus] = useState(profile?.civil_status ?? '')
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [bioError, setBioError] = useState<string | null>(null)
  const [bioSuccess, setBioSuccess] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const handleDisableBiometric = async () => {
    if (!confirm('Remove your fingerprint unlock? You will need your password to sign in.')) return
    setBioError(null)
    setBioSuccess(null)
    const { error } = await disableBiometric()
    if (error) setBioError(error)
    else setBioSuccess('Fingerprint unlock removed.')
  }

  const handleUpdateBiometric = async () => {
    if (!confirm('Update your fingerprint? You will need to scan your fingerprint again.')) return
    setBioError(null)
    setBioSuccess(null)
    setUpdating(true)
    // Remove the old credential first
    const { error: removeError } = await disableBiometric()
    if (removeError) {
      setBioError(removeError)
      setUpdating(false)
      return
    }
    // Then immediately enroll a new one
    setShowEnroll(true)
    setUpdating(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        fullname,
        contact_number: contactNumber || null,
        address: address || null,
        birth_date: birthDate || null,
        gender: gender || null,
        civil_status: civilStatus || null,
      })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Profile updated successfully.')
      refreshProfile()
    }
  }

  return (
    <AppLayout navItems={CLIENT_NAV}>
      <div className="fade-in-up">
        <h3 className="mb-1">My Profile</h3>
        <p className="text-muted mb-4">Keep your contact details up to date.</p>

        {success && <Alert variant="success" message={success} />}
        {error && <Alert variant="danger" message={error} />}

        <div className="card border-0 shadow-sm mb-3" style={{ maxWidth: 720 }}>
          <div className="card-header"><i className="bi bi-fingerprint text-primary-pdao me-1" /> Fingerprint Unlock</div>
          <div className="card-body">
            {bioError && <Alert variant="danger" message={bioError} />}
            {bioSuccess && <Alert variant="success" message={bioSuccess} />}
            {biometric ? (
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="stat-icon bg-primary bg-opacity-10 text-primary-pdao" style={{ width: 48, height: 48, fontSize: '1.3rem' }}>
                    <i className="bi bi-fingerprint" />
                  </div>
                  <div>
                    <div className="fw-bold">{biometric.device_type}</div>
                    <div className="text-muted small">Enabled on {fmtDate(biometric.created_at)}{biometric.nickname ? ` · ${biometric.nickname}` : ''}</div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-soft" onClick={handleUpdateBiometric} disabled={updating}>
                    {updating ? <><span className="spinner-border spinner-border-sm me-1" /> Updating…</> : <><i className="bi bi-arrow-repeat me-1" /> Update</>}
                  </button>
                  <button className="btn btn-outline-danger" onClick={handleDisableBiometric}><i className="bi bi-x-circle me-1" /> Remove</button>
                </div>
              </div>
            ) : sensorAvailable ? (
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <div className="fw-bold">Not enabled</div>
                  <div className="text-muted small">Enable fingerprint unlock for faster, more secure access.</div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowEnroll(true)}><i className="bi bi-fingerprint me-1" /> Enable</button>
              </div>
            ) : (
              <div className="text-muted small"><i className="bi bi-info-circle me-1" />Your device does not have a fingerprint sensor. Fingerprint unlock is not available.</div>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm" style={{ maxWidth: 720 }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full name</label>
                  <input className="form-control" value={fullname} onChange={(e) => setFullname(e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email (read-only)</label>
                  <input className="form-control bg-light" value={profile?.email ?? ''} disabled />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Contact number</label>
                  <input type="tel" className="form-control" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Birth date</label>
                  <input type="date" className="form-control" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select…</option>
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Civil status</label>
                  <select className="form-select" value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)}>
                    <option value="">Select…</option>
                    {CIVIL_STATUS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-md-12">
                  <label className="form-label">Address</label>
                  <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Saving…</> : <><i className="bi bi-save me-1" /> Save changes</>}
                </button>
                <Link to="/change-password" className="btn btn-soft"><i className="bi bi-key me-1" /> Change password</Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      <BiometricEnrollModal
        show={showEnroll}
        onClose={() => setShowEnroll(false)}
        onSuccess={() => setBioSuccess('Fingerprint unlock enabled. You can now sign in with your fingerprint.')}
        title="Enable Fingerprint Unlock"
        subtitle="Secure your account with your device's fingerprint sensor."
      />
    </AppLayout>
  )
}
