import { z } from 'zod';
import {
  headersWithCookies,
  hmacVerify,
  makeSessionCookie
} from '../utils';
import { decodeJwtPayload, exchangeCodeForTokensApple } from './apple';
import { makeAppleClientSecret } from './client-secret';

export async function handleAppleOAuth2Callback(request: Request, env: Env) {
  const url = new URL(request.url);

  // 1) form_post 방식 우선
  let code: string | null = null;
  let state: string | null = null;

  if (request.method === 'POST') {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/x-www-form-urlencoded')) {
      const body = await request.text();
      const params = new URLSearchParams(body);
      code = params.get('code');
      state = params.get('state');
    }
  }

  // 2) fallback: query string 처리
  if (!code || !state) {
    code = url.searchParams.get('code');
    state = url.searchParams.get('state');
  }

  // 3) 유효성 검증
  const schema = z.object({ code: z.string().min(1), state: z.string().min(10) });
  const parsed = schema.safeParse({ code, state });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  // 4) state 검증 (쿠키 사용 X)
  const [payload, sig] = parsed.data.state.split('.');
  if (!payload || !sig) {
    return Response.json({ error: 'invalid_state' }, { status: 400 });
  }

  const ok = await hmacVerify(env, payload, sig).catch(() => false);
  if (!ok) {
    return Response.json({ error: 'invalid_signature' }, { status: 400 });
  }

  const tmp = JSON.parse(
    atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  );
  if (!tmp.exp || tmp.exp < Math.floor(Date.now() / 1000)) {
    return Response.json({ error: 'state_expired' }, { status: 400 });
  }

  // 5) 토큰 교환
  const clientSecret = await makeAppleClientSecret({
    teamId: env.APPLE_TEAM_ID,
    keyId: env.APPLE_KEY_ID,
    clientId: env.APPLE_CLIENT_ID,
    privateKeyPem: env.APPLE_PRIVATE_KEY,
  });

  const token = await exchangeCodeForTokensApple({
    code: parsed.data.code,
    clientId: env.APPLE_CLIENT_ID,
    clientSecret,
    redirectUri: env.APPLE_REDIRECT_URI,
    codeVerifier: tmp.code_verifier,
  }).catch((e: any) => ({ error: e?.message || 'exchange_failed' }));

  if ((token as any).error) {
    return Response.json({ error: (token as any).error }, { status: 400 });
  }

  // 6) ID 토큰 디코드
  const id = decodeJwtPayload((token as any).id_token) || {};
  const user = {
    sub: id.sub,
    email: id.email,
    email_verified: id.email_verified,
    name: id.name,
    picture: null,
  };

  // 7) 세션 쿠키 발급
  const sessionCookie = await makeSessionCookie(env, user, request, { sameSite: 'Lax' });

  const wantsJson = url.searchParams.get('format') === 'json';
  if (wantsJson) {
    return new Response(JSON.stringify({ ok: true, user }, null, 2), {
      status: 200,
      headers: headersWithCookies(
        { 'content-type': 'application/json; charset=UTF-8' },
        [sessionCookie]
      ),
    });
  }

  return new Response(null, {
    status: 302,
    headers: headersWithCookies({ Location: '/' }, [sessionCookie]),
  });
}
