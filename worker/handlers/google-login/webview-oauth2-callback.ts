import { z } from 'zod'
import { decodeJwtPayload, exchangeCodeForTokens } from './google'
import { makeSessionCookie } from './utils'

export async function handleWebviewOAuth2Callback(request: Request, env: Env) {
  const url = new URL(request.url)
  const schema = z.object({ code: z.string().min(1), state: z.string().min(1) })
  const params = {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
  }
  const parsed = schema.safeParse(params)
  if (!parsed.success)
    return Response.json({ error: parsed.error.message }, { status: 400 })

  // === KV에서 state 조회 ===
  const raw = await env.STATE_KV.get(`oauth:${parsed.data.state}`)
  if (!raw) return Response.json({ error: 'invalid_state' }, { status: 400 })

  const tmp = JSON.parse(raw)
  // 1회성 사용: 재사용 방지
  await env.STATE_KV.delete(`oauth:${parsed.data.state}`)

  // === 토큰 교환 ===
  const token = await exchangeCodeForTokens({
    code: parsed.data.code,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    codeVerifier: tmp.code_verifier,
  }).catch((e: any) => ({ error: e?.message || 'exchange_failed' }))

  if ((token as any).error) {
    return Response.json({ error: (token as any).error }, { status: 400 })
  }

  const id = decodeJwtPayload((token as any).id_token) || {}
  const user = {
    sub: id.sub,
    email: id.email,
    email_verified: id.email_verified,
    name: id.name,
    picture: id.picture,
  }

  const sessionCookie = await makeSessionCookie(env, user, request, {
    sameSite: 'Lax',
  })

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': sessionCookie,
      Location: 'valhalla://oauth2redirect',
    },
  })
}
