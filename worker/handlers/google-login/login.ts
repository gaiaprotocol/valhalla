import { googleAuthURL, makePkce } from './google'

export async function handleGoogleLogin(_request: Request, env: Env) {
  const { state, codeVerifier, challenge } = await makePkce()

  // === 쿠키 대신 KV에 저장 ===
  // state를 키로, code_verifier를 값으로 (TTL 10분)
  await env.STATE_KV.put(
    `oauth:${state}`,
    JSON.stringify({ code_verifier: codeVerifier }),
    { expirationTtl: 600 }
  )

  const redirectTo = googleAuthURL({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    scope: 'openid email profile',
    codeChallenge: challenge,
    state,
  })

  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  })
}
