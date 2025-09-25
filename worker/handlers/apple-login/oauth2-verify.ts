import { z } from 'zod'
import { decodeJwtPayload } from './apple'
import { makeSessionCookie, headersWithCookies, sha256, b64urlEncode } from '../utils'

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const ALLOWED_ISSUERS = ['https://appleid.apple.com']
const CLOCK_SKEW_SEC = 300

function b64urlToUint8Array(b64url: string): Uint8Array {
  const pad = (s: string) => s + '==='.slice((s.length + 3) % 4)
  const b64 = pad(b64url.replace(/-/g, '+').replace(/_/g, '/'))
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
function textToUint8Array(s: string) { return new TextEncoder().encode(s) }

async function fetchAppleJwks(): Promise<any> {
  const req = new Request(APPLE_JWKS_URL, { /* @ts-ignore */ cf: { cacheTtl: 3600, cacheEverything: true } })
  const cache = caches.default
  const cached = await cache.match(req)
  if (cached) return cached.json()
  const res = await fetch(req)
  if (!res.ok) throw new Error(`Failed to fetch Apple JWKS: ${res.status}`)
  const data = await res.clone().json()
  await cache.put(req, res)
  return data
}

async function importJwkForVerify(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
}

export async function verifyAppleIdJwt(idToken: string, expectedAud: string, expectedNonceRaw?: string) {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('invalid_jwt_format')
  const [headerB64, payloadB64, sigB64] = parts

  const headerJson = JSON.parse(new TextDecoder().decode(b64urlToUint8Array(headerB64)))
  if (headerJson.alg !== 'RS256') throw new Error('unsupported_alg')
  const kid: string | undefined = headerJson.kid
  if (!kid) throw new Error('missing_kid')

  const jwks = await fetchAppleJwks()
  const jwk = (jwks.keys || []).find((k: any) => k.kid === kid)
  if (!jwk) throw new Error('kid_not_found')

  const key = await importJwkForVerify(jwk)
  const data = textToUint8Array(`${headerB64}.${payloadB64}`)
  const sig = b64urlToUint8Array(sigB64)
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data)
  if (!ok) throw new Error('invalid_signature')

  const payload: any = decodeJwtPayload(idToken) || {}
  const now = Math.floor(Date.now() / 1000)

  if (!ALLOWED_ISSUERS.includes(payload.iss)) throw new Error('invalid_issuer')
  if (payload.aud !== expectedAud) throw new Error('aud_mismatch')

  // Apple은 nonce가 해시(sha256)로 들어올 수 있음 → raw와 해시 둘 다 허용 검증
  if (expectedNonceRaw && payload.nonce) {
    const hashed = b64urlEncode(await sha256(expectedNonceRaw))
    if (payload.nonce !== expectedNonceRaw && payload.nonce !== hashed) throw new Error('nonce_mismatch')
  }

  if (typeof payload.exp === 'number' && now > payload.exp + CLOCK_SKEW_SEC) throw new Error('token_expired')
  if (typeof payload.iat === 'number' && payload.iat > now + CLOCK_SKEW_SEC) throw new Error('invalid_iat')

  return payload
}

export async function handleAppleOAuth2Verify(request: Request, env: Env) {
  if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })

  const schema = z.object({
    provider: z.literal('apple'),
    idToken: z.string().min(10),
    nonce: z.string().min(8).optional(),
    state: z.string().optional(),
  })

  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 })

  const { idToken, nonce } = parsed.data
  let payload: any
  try {
    payload = await verifyAppleIdJwt(idToken, env.APPLE_CLIENT_ID, nonce)
  } catch (e: any) {
    return Response.json({ error: e?.message || 'verify_failed' }, { status: 401 })
  }

  const user = {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    picture: null,
  }

  const sessionCookie = await makeSessionCookie(env, user, request, { sameSite: 'Lax' })
  return new Response(JSON.stringify({ ok: true, user }, null, 2), {
    status: 200,
    headers: headersWithCookies({ 'content-type': 'application/json; charset=UTF-8' }, [sessionCookie]),
  })
}
