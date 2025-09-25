import { hmacSign } from '../utils';
import { appleAuthURL, makePkce } from './apple';

function b64UrlJson(obj: any) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function handleAppleLogin(_request: Request, env: Env) {
  const { state: rnd, codeVerifier, challenge, nonce } = await makePkce();

  // state에 필요한 모든 값 + 만료(exp) 포함
  const payloadObj = {
    rnd,
    code_verifier: codeVerifier,
    nonce,
    exp: Math.floor(Date.now() / 1000) + 600, // 10분 TTL
  };
  const payload = b64UrlJson(payloadObj);
  const sig = await hmacSign(env, payload);
  const signedState = `${payload}.${sig}`;

  const redirectTo = appleAuthURL({
    clientId: env.APPLE_CLIENT_ID,        // Service ID
    redirectUri: env.APPLE_REDIRECT_URI,  // 반드시 Apple Console Return URL과 동일
    scope: 'name email',
    codeChallenge: challenge,
    state: signedState,
    nonce,
    responseMode: 'form_post',            // POST 방식 콜백
  });

  return new Response(null, {
    status: 302,
    headers: new Headers({ Location: redirectTo }),
  });
}
