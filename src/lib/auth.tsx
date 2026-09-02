import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { enrollFingerprint, verifyFingerprint, fingerprintSensorAvailable, loginWithFingerprint, type StoredCredential } from './webauthn'
import type { Profile, Notification, Role, BiometricCredential } from './types'

type BiometricState = 'none' | 'enabled' | 'locked'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  unreadCount: number
  recentNotifications: Notification[]
  biometric: BiometricCredential | null
  biometricState: BiometricState
  sensorAvailable: boolean
  enrollBiometric: (nickname?: string) => Promise<{ error: string | null }>
  unlockWithFingerprint: () => Promise<{ error: string | null }>
  fingerprintLogin: () => Promise<{ error: string | null }>
  disableBiometric: () => Promise<{ error: string | null }>
  lockApp: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (fullname: string, email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const BIOMETRIC_STORAGE_KEY = 'pdaolink-biometric-cred'

interface StoredBiometricRef {
  credentialId: string
  email: string
}

function loadStoredCred(): StoredBiometricRef | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredBiometricRef
  } catch {
    return null
  }
}

function saveStoredCred(credentialId: string, email: string) {
  localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify({ credentialId, email }))
}

function clearStoredCred() {
  localStorage.removeItem(BIOMETRIC_STORAGE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([])
  const [biometric, setBiometric] = useState<BiometricCredential | null>(null)
  const [biometricState, setBiometricState] = useState<BiometricState>('none')
  const [sensorAvailable, setSensorAvailable] = useState(false)

  useEffect(() => {
    fingerprintSensorAvailable().then(setSensorAvailable)
  }, [])

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) {
      console.error('Failed to load profile:', error.message)
      return null
    }
    setProfile(data as Profile | null)
    return data as Profile | null
  }, [])

  const loadNotifications = useCallback(async (uid: string) => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('is_read', false)
    setUnreadCount(count ?? 0)

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(6)
    setRecentNotifications((data ?? []) as Notification[])
  }, [])

  const loadBiometric = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('biometric_credentials')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setBiometric(data as BiometricCredential)
      setBiometricState('enabled')
      const stored = loadStoredCred()
      if (!stored || stored.credentialId !== data.credential_id) {
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user?.email) {
          saveStoredCred(data.credential_id, userData.user.email)
        }
      }
    } else {
      setBiometric(null)
      setBiometricState('none')
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

  const refreshNotifications = useCallback(async () => {
    if (user) await loadNotifications(user.id)
  }, [user, loadNotifications])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        Promise.all([
          loadProfile(data.session.user.id),
          loadNotifications(data.session.user.id),
          loadBiometric(data.session.user.id),
        ]).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        (async () => {
          await loadProfile(newSession.user.id)
          await loadNotifications(newSession.user.id)
          await loadBiometric(newSession.user.id)
        })()
      } else {
        setProfile(null)
        setUnreadCount(0)
        setRecentNotifications([])
        setBiometric(null)
        setBiometricState('none')
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile, loadNotifications, loadBiometric])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (fullname: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { fullname, role: 'client' as Role } },
    })
    if (error) return { error: error.message }
    if (data.user) {
      await supabase.from('notifications').insert({
        user_id: data.user.id,
        message: 'Welcome to PDAOLink! Complete your PWD application to get started.',
        link: '/application',
      })
    }
    return { error: null }
  }, [])

  const enrollBiometric = useCallback(async (nickname?: string) => {
    if (!user) return { error: 'Not signed in.' }
    try {
      const result = await enrollFingerprint(user.email ?? user.id, profile?.fullname ?? 'User', nickname)
      const { error } = await supabase.from('biometric_credentials').insert({
        user_id: user.id,
        credential_id: result.credentialId,
        public_key: result.publicKey,
        counter: result.counter,
        device_type: result.deviceType,
        transports: result.transports,
        nickname: result.nickname,
        algorithm: result.algorithm,
      })
      if (error) return { error: error.message }
      saveStoredCred(result.credentialId, user.email ?? '')
      await loadBiometric(user.id)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, [user, profile, loadBiometric])

  const unlockWithFingerprint = useCallback(async () => {
    if (!biometric) return { error: 'No biometric credential enrolled.' }
    try {
      const stored: StoredCredential = {
        id: biometric.id,
        credentialId: biometric.credential_id,
        publicKey: biometric.public_key,
        counter: biometric.counter,
        deviceType: biometric.device_type,
        transports: biometric.transports ?? [],
        nickname: biometric.nickname ?? undefined,
        algorithm: biometric.algorithm ?? -7,
      }
      const result = await verifyFingerprint(stored)
      await supabase
        .from('biometric_credentials')
        .update({ counter: result.counter })
        .eq('id', biometric.id)
      setBiometricState('enabled')
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, [biometric])

  const fingerprintLogin = useCallback(async () => {
    const stored = loadStoredCred()
    if (!stored) return { error: 'No saved fingerprint credential found. Please sign in with your password first.' }
    try {
      const assertion = await loginWithFingerprint(stored.credentialId)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const response = await fetch(`${supabaseUrl}/functions/v1/biometric-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(assertion),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error ?? `Verification failed (${response.status})`)
      }

      const { token } = await response.json()

      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: token,
      })

      if (verifyError) {
        throw new Error(verifyError.message)
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, [])

  const disableBiometric = useCallback(async () => {
    if (!biometric || !user) return { error: 'No biometric credential enrolled.' }
    const { error } = await supabase
      .from('biometric_credentials')
      .delete()
      .eq('id', biometric.id)
    if (error) return { error: error.message }
    clearStoredCred()
    setBiometric(null)
    setBiometricState('none')
    return { error: null }
  }, [biometric, user])

  const lockApp = useCallback(() => {
    if (biometric) setBiometricState('locked')
  }, [biometric])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setUnreadCount(0)
    setRecentNotifications([])
    setBiometric(null)
    setBiometricState('none')
  }, [])

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    unreadCount,
    recentNotifications,
    biometric,
    biometricState,
    sensorAvailable,
    enrollBiometric,
    unlockWithFingerprint,
    fingerprintLogin,
    disableBiometric,
    lockApp,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    refreshNotifications,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
