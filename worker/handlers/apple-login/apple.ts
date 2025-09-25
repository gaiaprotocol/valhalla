import { b64urlEncode, sha256 } from '../utils'

export function appleAuthURL({
  clientId,
  redirectUri,
  scope,
  codeChallenge,
  state,
  nonce,              // raw nonce (server가 쿠키에 저장 후 검증에 사용)
  responseMode = 'query', // 'form_post'도 가능
}: {
  clientId: string
  redirectUri: string
  scope: string       // 'name email' 권장
  codeChallenge: string
  state: string
  nonce: string
  responseMode?: 'query' | 'form_post'
}) {
  const auth = new URL('https://appleid.apple.com/auth/authorize')
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('response_mode', responseMode)
  auth.searchParams.set('client_id', clientId)
  auth.searchParams.set('redirect_uri', redirectUri)
  auth.searchParams.set('scope', scope)
  auth.searchParams.set('code_challenge', codeChallenge)
  auth.searchParams.set('code_challenge_method', 'S256')
  auth.searchParams.set('state', state)
  auth.searchParams.set('nonce', nonce) // ID 토큰에 (원문 또는 해시)로 반영됨
  return auth.toString()
}

export async function exchangeCodeForTokensApple({
  code,
  clientId,
  clientSecret, // 애플은 client_secret(JWT) 필수
  redirectUri,
  codeVerifier,
}: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
  codeVerifier: string
}) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const resp = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) throw new Error(`token exchange failed: ${resp.status}`)
  return await resp.json<any>()
}

export function decodeJwtPayload(idToken?: string) {
  if (!idToken) return null
  const [, p] = idToken.split('.')
  if (!p) return null
  const json = atob(p.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(json)
}

export async function makePkce() {
  const state = b64urlEncode(crypto.getRandomValues(new Uint8Array(16)))
  const codeVerifier = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = b64urlEncode(await sha256(codeVerifier))
  // Apple용 권장: 별도 nonce 생성
  const nonce = b64urlEncode(crypto.getRandomValues(new Uint8Array(16)))
  return { state, codeVerifier, challenge, nonce }
}
