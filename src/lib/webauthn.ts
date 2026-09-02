// WebAuthn (FIDO2) helpers for fingerprint / Face ID enrollment, verification, and login.

const RP_NAME = 'PDAOLink'

export function webauthnSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator.credentials !== 'undefined'
}

export async function fingerprintSensorAvailable(): Promise<boolean> {
  if (!webauthnSupported()) return false
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
    return true
  } catch {
    return false
  }
}

function bufToB64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  bytes.forEach((b) => { str += String.fromCharCode(b) })
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlToBuf(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const b64u = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64u)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function randomChallenge(): Uint8Array {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return arr
}

export interface EnrolledCredential {
  credentialId: string
  publicKey: string
  counter: number
  deviceType: string
  transports: string[]
  algorithm: number
}

export interface EnrollmentResult extends EnrolledCredential {
  nickname: string
}

export interface StoredCredential extends EnrolledCredential {
  id: string
  nickname?: string
}

export interface LoginAssertion {
  credentialId: string
  authenticatorData: string
  clientDataJSON: string
  signature: string
  rpId: string
}

export async function enrollFingerprint(username: string, displayName: string, nickname?: string): Promise<EnrollmentResult> {
  if (!webauthnSupported()) throw new Error('WebAuthn is not supported in this browser.')

  const challenge = randomChallenge()
  const userId = new TextEncoder().encode(username)

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: challenge.buffer as ArrayBuffer,
    rp: { name: RP_NAME },
    user: { id: userId.buffer as ArrayBuffer, name: username, displayName },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  }

  const cred = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null
  if (!cred) throw new Error('Enrollment was cancelled or failed.')

  const raw = cred.response as AuthenticatorAttestationResponse
  const { spki, algorithm } = await extractPublicKey(raw)
  const deviceType = await detectDeviceType()
  const transports = (raw as any).getTransports?.() ?? []

  return {
    credentialId: bufToB64Url(cred.rawId),
    publicKey: bufToB64Url(spki),
    counter: 0,
    deviceType,
    transports: Array.from(transports) as string[],
    nickname: nickname ?? deviceType,
    algorithm,
  }
}

async function extractPublicKey(raw: AuthenticatorAttestationResponse): Promise<{ spki: ArrayBuffer, algorithm: number }> {
  // Prefer the native getPublicKey() API (Chrome 101+, Safari 16+, Firefox 116+)
  // which returns the key in SPKI format directly — no manual COSE conversion needed.
  const getPubKey = (raw as any).getPublicKey as ((this: AuthenticatorAttestationResponse) => ArrayBuffer | null) | undefined
  if (typeof getPubKey === 'function') {
    const spki = getPubKey.call(raw)
    if (spki && spki.byteLength > 0) {
      const getAlg = (raw as any).getPublicKeyAlgorithm as ((this: AuthenticatorAttestationResponse) => number) | undefined
      const algorithm = typeof getAlg === 'function' ? getAlg.call(raw) : -7
      return { spki, algorithm }
    }
  }

  // Fallback: manually parse CBOR attestation object and convert COSE key to SPKI
  const attObj = cborDecode(raw.attestationObject) as any
  const authData = attObj?.get?.('authData') ?? attObj?.authData
  if (authData instanceof Uint8Array) {
    return parsePublicKeyFromAuthData(authData.buffer as ArrayBuffer)
  }

  throw new Error('Could not extract public key from credential')
}

// --- CBOR decoder ---

function cborDecode(buf: ArrayBuffer): any {
  const bytes = new Uint8Array(buf)
  let pos = 0
  function readByte() { return bytes[pos++] }
  function readUint(n: number) {
    let v = 0
    for (let i = 0; i < n; i++) v = v * 256 + bytes[pos++]
    return v
  }
  function readArg(ai: number) {
    if (ai < 24) return ai
    if (ai === 24) return readUint(1)
    if (ai === 25) return readUint(2)
    if (ai === 26) return readUint(4)
    return readUint(8)
  }
  function read(): any {
    const first = readByte()
    const major = first >> 5
    const ai = first & 0x1f
    switch (major) {
      case 0: return readArg(ai)
      case 1: return -1 - readArg(ai)
      case 2: { const len = readArg(ai); const s = bytes.subarray(pos, pos + len); pos += len; return new Uint8Array(s) }
      case 3: { const len = readArg(ai); const s = bytes.subarray(pos, pos + len); pos += len; return new TextDecoder().decode(s) }
      case 4: { const len = readArg(ai); const arr: any[] = []; for (let i = 0; i < len; i++) arr.push(read()); return arr }
      case 5: { const len = readArg(ai); const m = new Map<any, any>(); for (let i = 0; i < len; i++) { m.set(read(), read()) } return m }
      case 7: { if (ai === 20) return false; if (ai === 21) return true; if (ai === 22) return null; return undefined }
      default: return undefined
    }
  }
  return read()
}

// --- DER encoding helpers ---

function derSeq(content: Uint8Array): Uint8Array {
  return new Uint8Array([0x30, ...derLen(content.length), ...content])
}

function derBitString(content: Uint8Array): Uint8Array {
  const withUnused = new Uint8Array(1 + content.length)
  withUnused[0] = 0x00
  withUnused.set(content, 1)
  return new Uint8Array([0x03, ...derLen(withUnused.length), ...withUnused])
}

function derInteger(val: Uint8Array): Uint8Array {
  let v = val
  if (v[0] & 0x80) { v = new Uint8Array(1 + v.length); v.set(val, 1) }
  return new Uint8Array([0x02, ...derLen(v.length), ...v])
}

function derLen(n: number): number[] {
  if (n < 0x80) return [n]
  if (n < 0x100) return [0x81, n]
  return [0x82, (n >> 8) & 0xff, n & 0xff]
}

function encodeOid(arcs: number[]): Uint8Array {
  if (arcs.length < 2) throw new Error('Invalid OID')
  const body: number[] = [arcs[0] * 40 + arcs[1]]
  for (let i = 2; i < arcs.length; i++) {
    let v = arcs[i]
    if (v < 0x80) { body.push(v); continue }
    const stack: number[] = []
    stack.push(v & 0x7f); v = Math.floor(v / 128)
    while (v > 0) { stack.push((v & 0x7f) | 0x80); v = Math.floor(v / 128) }
    body.push(...stack.reverse())
  }
  return new Uint8Array([0x06, ...derLen(body.length), ...body])
}

// --- COSE key → SPKI conversion (fallback for older browsers) ---

function parsePublicKeyFromAuthData(authData: ArrayBuffer): { spki: ArrayBuffer, algorithm: number } {
  const view = new DataView(authData)
  const flags = view.getUint8(32)
  const hasAttested = (flags & 0x40) !== 0
  if (!hasAttested) throw new Error('AuthData missing attested credential data')

  let offset = 37 + 16 // rpIdHash(32) + flags(1) + signCount(4) + AAGUID(16)
  const credIdLen = view.getUint16(offset)
  offset += 2 + credIdLen

  const coseBytes = new Uint8Array(authData, offset)
  const coseKey = cborDecode(coseBytes.buffer.slice(coseBytes.byteOffset, coseBytes.byteOffset + coseBytes.byteLength)) as Map<number, any>
  const spki = coseToSpki(coseKey)
  const algorithm = (coseKey.get(3) as number) ?? -7
  return { spki, algorithm }
}

function coseToSpki(cose: Map<number, any>): ArrayBuffer {
  const kty = cose.get(1) as number
  const alg = cose.get(3) as number

  if (kty === 2) {
    // EC key (ES256 = alg -7, P-256)
    const crv = cose.get(-1) as number
    const x = cose.get(-2) as Uint8Array
    const y = cose.get(-3) as Uint8Array

    // AlgorithmIdentifier = SEQUENCE { OID(ecPublicKey 1.2.840.10045.2.1), OID(curve) }
    const ecOid = encodeOid([1, 2, 840, 10045, 2, 1])
    const curveOid = crv === 1
      ? encodeOid([1, 2, 840, 10045, 3, 1, 7])   // secp256r1 (P-256)
      : encodeOid([1, 3, 132, 0, 10])              // secp256k1
    const algId = derSeq(new Uint8Array([...ecOid, ...curveOid]))

    // Uncompressed point: 0x04 || x || y
    const point = new Uint8Array(1 + x.length + y.length)
    point[0] = 0x04
    point.set(x, 1)
    point.set(y, 1 + x.length)

    // SPKI = SEQUENCE { AlgorithmIdentifier, BIT STRING { point } }
    return derSeq(new Uint8Array([...algId, ...derBitString(point)])).buffer as ArrayBuffer
  }

  if (kty === 3) {
    // RSA key (RS256 = alg -257)
    const n = cose.get(-1) as Uint8Array
    const e = cose.get(-2) as Uint8Array

    // AlgorithmIdentifier = SEQUENCE { OID(rsaEncryption 1.2.840.113549.1.1.1), NULL }
    const rsaOid = encodeOid([1, 2, 840, 113549, 1, 1, 1])
    const algId = derSeq(new Uint8Array([...rsaOid, 0x05, 0x00]))

    // RSA public key = SEQUENCE { INTEGER(n), INTEGER(e) }
    const rsaPub = derSeq(new Uint8Array([...derInteger(n), ...derInteger(e)]))

    // SPKI = SEQUENCE { AlgorithmIdentifier, BIT STRING { rsaPub } }
    return derSeq(new Uint8Array([...algId, ...derBitString(rsaPub)])).buffer as ArrayBuffer
  }

  throw new Error('Unsupported COSE key type: ' + kty)
}

async function detectDeviceType(): Promise<string> {
  const ua = navigator.userAgent.toLowerCase()
  const platform = (navigator as any).userAgentData?.platform?.toLowerCase() ?? ''
  if (ua.includes('iphone') || ua.includes('ipad') || platform.includes('ios')) return 'Face ID / Touch ID'
  if (ua.includes('android')) return 'Fingerprint'
  if (ua.includes('mac')) return 'Touch ID'
  if (ua.includes('win')) return 'Windows Hello'
  if (ua.includes('linux')) return 'Fingerprint'
  return 'Biometric Sensor'
}

// --- Unlock (lock screen) ---

export interface VerificationResult {
  credentialId: string
  counter: number
  verified: boolean
}

export async function verifyFingerprint(credential: StoredCredential): Promise<VerificationResult> {
  if (!webauthnSupported()) throw new Error('WebAuthn is not supported in this browser.')

  const challenge = randomChallenge()
  const allowCredId = b64UrlToBuf(credential.credentialId)

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: challenge.buffer as ArrayBuffer,
    rpId: window.location.hostname,
    allowCredentials: [{
      type: 'public-key',
      id: allowCredId.buffer as ArrayBuffer,
      transports: credential.transports as AuthenticatorTransport[],
    }],
    userVerification: 'required',
    timeout: 60000,
  }

  const assertion = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null
  if (!assertion) throw new Error('Fingerprint verification was cancelled.')

  const response = assertion.response as AuthenticatorAssertionResponse
  const newCounter = arrayBufferToCounter(response.authenticatorData)

  return {
    credentialId: bufToB64Url(assertion.rawId),
    counter: newCounter,
    verified: true,
  }
}

// --- Login (from login page, unauthenticated) ---

export async function loginWithFingerprint(credentialId: string): Promise<LoginAssertion> {
  if (!webauthnSupported()) throw new Error('WebAuthn is not supported in this browser.')

  const challenge = randomChallenge()
  const allowCredId = b64UrlToBuf(credentialId)

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: challenge.buffer as ArrayBuffer,
    rpId: window.location.hostname,
    allowCredentials: [{
      type: 'public-key',
      id: allowCredId.buffer as ArrayBuffer,
    }],
    userVerification: 'required',
    timeout: 60000,
  }

  try {
    const assertion = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null
    if (!assertion) throw new Error('Fingerprint verification was cancelled.')

    const response = assertion.response as AuthenticatorAssertionResponse
    return {
      credentialId: bufToB64Url(assertion.rawId),
      authenticatorData: bufToB64Url(response.authenticatorData),
      clientDataJSON: bufToB64Url(response.clientDataJSON),
      signature: bufToB64Url(response.signature),
      rpId: window.location.hostname,
    }
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
      throw new Error('Fingerprint authentication was cancelled.')
    }
    throw err
  }
}

function arrayBufferToCounter(authData: ArrayBuffer): number {
  const view = new DataView(authData)
  return view.getUint32(33)
}
