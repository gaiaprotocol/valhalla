import { jsonWithCors } from '@gaiaprotocol/worker-common'
import { z } from 'zod'
import { decodeJwtPayload, exchangeCodeForTokens } from './google'
import { hmacVerify, makeCookie, makeSessionCookie, parseCookies, headersWithCookies } from './utils'

export async function handleOAuthCallback(request: Request, env: Env) {
  const url = new URL(request.url)
  const schema = z.object({ code: z.string().min(1), state: z.string().min(1) })
  const params = { code: url.searchParams.get('code'), state: url.searchParams.get('state') }
  const parsed = schema.safeParse(params)
  if (!parsed.success) return jsonWithCors({ error: parsed.error.message }, 400)

  // temp cookie 검증
  const cookies = parseCookies(request.headers.get('Cookie'))
  const raw = cookies['oauth_tmp']
  if (!raw) return jsonWithCors({ error: 'invalid_state' }, 400)
  const [payload, sig] = raw.split('.')
  const ok = await hmacVerify(env, payload, sig).catch(() => false)
  if (!ok) return jsonWithCors({ error: 'invalid_signature' }, 400)
  const tmp = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  if (tmp.state !== parsed.data.state) return jsonWithCors({ error: 'state_mismatch' }, 400)

  // 토큰 교환
  const token = await exchangeCodeForTokens({
    code: parsed.data.code,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    codeVerifier: tmp.code_verifier,
  }).catch((e: any) => ({ error: e?.message || 'exchange_failed' }))
  if ((token as any).error) return jsonWithCors({ error: (token as any).error }, 400)

  const id = decodeJwtPayload((token as any).id_token) || {}
  const user = { sub: id.sub, email: id.email, email_verified: id.email_verified, name: id.name, picture: id.picture }

  // 크로스사이트 호출이라면 SameSite=None으로 조정 (필요 시 도메인도 지정)
  const sessionCookie = await makeSessionCookie(env, user, request, { sameSite: 'Lax' })
  const clearTmp = makeCookie('oauth_tmp', '', { maxAge: 0 })

  const wantsJson = url.searchParams.get('format') === 'json'
  if (wantsJson) {
    return new Response(JSON.stringify({ ok: true, user }, null, 2), {
      status: 200,
      headers: headersWithCookies({ 'content-type': 'application/json; charset=UTF-8' }, [sessionCookie, clearTmp]),
    })
  }

  return new Response(null, {
    status: 302,
    headers: headersWithCookies({ Location: '/' }, [sessionCookie, clearTmp]),
  })
}
