import { handleGodModeCheck } from './handlers/god-mode-check';
import { handleLogin } from './handlers/login';
import { handleNonce } from './handlers/nonce';
import { handleValidateToken } from './handlers/validate-token';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/nonce' && request.method === 'POST') {
      return handleNonce(request, env);
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (url.pathname === '/api/validate-token' && request.method === 'GET') {
      return handleValidateToken(request, env);
    }

    if (url.pathname === '/api/god-mode' && request.method === 'POST') {
      return handleGodModeCheck(request);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
