// Cloudflare Workers의 SubtleCrypto + JOSE 없이 순정 WebCrypto로 ES256 서명 예시
export async function makeAppleClientSecret({
  teamId, keyId, clientId, privateKeyPem, expSec = 3000
}: {
  teamId: string
  keyId: string
  clientId: string
  privateKeyPem: string // -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----
  expSec?: number
}) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + expSec,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  }
  const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const data = `${enc(header)}.${enc(payload)}`

  // PEM → PKCS8 → CryptoKey
  const pkcs8 = atob(privateKeyPem.replace(/-----.*KEY-----/g, '').replace(/\s+/g, ''))
  const keyData = Uint8Array.from(pkcs8, c => c.charCodeAt(0)).buffer
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  )

  const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(data))
  // DER → R|S concat(64) 변환이 필요하지만, CF WebCrypto는 DER이 아니라 RAW 시그니처를 반환함.
  // 환경에 따라 DER일 수 있으니, 필요 시 변환 로직 추가.
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${data}.${sig}`
}
