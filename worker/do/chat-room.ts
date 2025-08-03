import { verifyToken } from '@gaiaprotocol/worker-common';
import { DurableObject } from 'cloudflare:workers';
import z from 'zod';
import { Attachment, ChatMessage } from '../types/chat';

interface Client {
  account: string;
  socket: WebSocket;
}

class ChatRoom extends DurableObject<Env> {
  #clients: Client[] = [];
  readonly #MAX_MESSAGES = 50;

  async fetch(request: Request) {
    const url = new URL(request.url);

    // WebSocket 연결 처리
    if (url.pathname.endsWith('/stream') && request.headers.get('upgrade') === 'websocket') {
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response('Unauthorized: missing token', { status: 401 });
      }

      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) {
        return new Response('Unauthorized: invalid token', { status: 401 });
      }

      const [clientSocket, serverSocket] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      this.#handleWebSocketConnection(serverSocket, payload.sub);

      return new Response(null, {
        status: 101,
        webSocket: clientSocket,
      });
    }

    // 메시지 전송 처리
    if (request.method === 'POST' && url.pathname.endsWith('/send')) {
      const auth = request.headers.get('authorization');
      if (!auth?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const token = auth.slice(7);
      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) {
        return new Response('Unauthorized', { status: 401 });
      }

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
      const id = await this.#saveMessageToD1(payload.sub, text.trim(), attachments);

      const message: ChatMessage = {
        id,
        localId,
        type: 'chat',
        account: payload.sub,
        text: text.trim(),
        attachments,
        timestamp: Date.now(),
      };

      this.#broadcast(message);

      return new Response(JSON.stringify(message), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  #handleWebSocketConnection(socket: WebSocket, account: string) {
    socket.accept();

    const client: Client = { account, socket };
    this.#clients.push(client);

    socket.addEventListener('close', () => {
      this.#clients = this.#clients.filter(c => c !== client);
    });

    socket.addEventListener('error', () => {
      this.#clients = this.#clients.filter(c => c !== client);
    });

    queueMicrotask(async () => {
      const history = await this.#loadRecentMessagesFromD1();
      for (const msg of history) {
        try {
          socket.send(JSON.stringify(msg));
        } catch (err) {
          console.error(`Error sending history to ${account}`, err);
        }
      }
    });
  }

  #broadcast(message: ChatMessage) {
    const json = JSON.stringify(message);
    this.#clients.forEach(({ account, socket }) => {
      try {
        socket.send(json);
      } catch (err) {
        console.error(`Failed to send to ${account}`, err);
        socket.close();
      }
    });
  }

  async #saveMessageToD1(account: string, text: string, attachments: Attachment[]) {
    const roomId = this.ctx.id.toString();
    const timestamp = Date.now();

    const result = await this.env.DB.prepare(`
      INSERT INTO messages (room_id, account, text, attachments, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).bind(roomId, account, text, JSON.stringify(attachments), timestamp).run();

    return result.meta.last_row_id;
  }

  async #loadRecentMessagesFromD1(): Promise<ChatMessage[]> {
    const roomId = this.ctx.id.toString();

    const { results } = await this.env.DB.prepare(`
      SELECT id, account, text, attachments, timestamp
      FROM messages
      WHERE room_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).bind(roomId, this.#MAX_MESSAGES).all<{
      id: number;
      account: string;
      text: string;
      attachments: string;
      timestamp: number;
    }>();

    return results.reverse().map(row => ({
      id: row.id,
      type: 'chat',
      account: row.account,
      text: row.text,
      attachments: JSON.parse(row.attachments),
      timestamp: row.timestamp,
    }));
  }
}

export { ChatRoom };
