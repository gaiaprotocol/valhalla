import { googleAuthURL, makePkce } from "./google"

/**
 * 쿠키 대신 KV(예: env.STATE_KV)에 state/code_verifier를 저장하고,
 * Google Authorization URL로 302 리다이렉트합니다.
 */
export async function handleGoogleLoginStartInApp(_request: Request, env: Env) {
  // 1) PKCE 생성
  const { state, codeVerifier, challenge } = await makePkce()

  // 2) KV에 보관 (TTL 권장 600초)
  // 값에는 필요한 메타(예: createdAt)도 같이 넣어두면 디버깅에 유용
  const key = `oauth:${state}`
  await env.STATE_KV.put(
    key,
    JSON.stringify({ code_verifier: codeVerifier, createdAt: Date.now() }),
    { expirationTtl: 600 }
  )

  // 3) Google Auth URL 구성 (state, code_challenge 포함)
  const redirectTo = googleAuthURL({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI_INAPP,   // 예: valhalla://oauth2redirect
    scope: 'openid email profile',
    codeChallenge: challenge,                     // PKCE: S256 code_challenge
    state,                                        // KV에 저장한 state
    // accessType: 'offline',                     // 필요한 경우만 사용
    // prompt: 'consent',
  })

  // 4) 302로 구글 인증 페이지로 보냄
  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  })
}
