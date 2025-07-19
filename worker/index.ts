import { ChatRoom } from './do/chat-room';
import { handleGodModeCheck } from './handlers/god-mode-check';
import { handleLogin } from './handlers/login';
import { handleNonce } from './handlers/nonce';
import { handleValidateToken } from './handlers/validate-token';

export { ChatRoom };

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

    const chatMatch = url.pathname.match(/^\/api\/chat\/([^/]+)\/(stream|send)$/);
    if (chatMatch) {
      const [_, roomId, action] = chatMatch;

      const id = env.CHATROOM.idFromName(roomId);
      const obj = env.CHATROOM.get(id);

      // DO에 요청 위임
      return obj.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
