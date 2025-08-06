import { ChatStorage, WebSocketManager } from '@gaiaprotocol/chat-worker';
import { verifyToken } from '@gaiaprotocol/worker-common';
import z from 'zod';
import { ChatMessage } from '../types/chat';

export class ChatRoom {
  readonly #websockets: WebSocketManager;
  readonly #storage: ChatStorage;

  constructor(ctx: DurableObjectState, private env: Env) {
    this.#websockets = new WebSocketManager();
    this.#storage = new ChatStorage(env, ctx);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    // WebSocket 연결 처리
    if (url.pathname.endsWith('/stream') && request.headers.get('upgrade') === 'websocket') {
      const token = url.searchParams.get('token');
      if (!token) return new Response('Unauthorized: missing token', { status: 401 });

      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) return new Response('Unauthorized: invalid token', { status: 401 });

      const [clientSocket, serverSocket] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      this.#websockets.handleConnection(serverSocket, payload.sub, () => this.#storage.loadRecentMessages());

      return new Response(null, {
        status: 101,
        webSocket: clientSocket,
      });
    }

    // 메시지 전송 처리
    if (request.method === 'POST' && url.pathname.endsWith('/send')) {
      const auth = request.headers.get('authorization');
      if (!auth?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 });

      const token = auth.slice(7);
      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) return new Response('Unauthorized', { status: 401 });

      const schema = z.object({
        text: z.string().optional().default(''),
        localId: z.uuid(),
        attachments: z.array(
          z.object({
            kind: z.literal('image'),
            url: z.url(),
            thumb: z.url().optional(),
          })
        ).default([]),
      });

      const { text, attachments, localId } = schema.parse(await request.json());
      const id = await this.#storage.saveMessage(payload.sub, text.trim(), attachments);

      const message: ChatMessage = {
        id,
        localId,
        type: 'chat',
        account: payload.sub,
        text: text.trim(),
        attachments,
        timestamp: Date.now(),
      };

      this.#websockets.broadcast(message);

      return new Response(JSON.stringify(message), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}
