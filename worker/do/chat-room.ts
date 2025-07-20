import { DurableObject } from 'cloudflare:workers';
import z from 'zod';
import { verifyToken } from '../services/jwt';
import { Attachment, ChatMessage } from '../types/chat';

interface Client {
  account: string;
  writer: WritableStreamDefaultWriter;
  controller: AbortController;
}

class ChatRoom extends DurableObject<Env> {
  #clients: Client[] = [];
  readonly #MAX_MESSAGES = 50;

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/stream')) {
      const auth = request.headers.get('authorization');
      if (!auth?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const token = auth.slice(7);
      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) {
        return new Response('Unauthorized', { status: 401 });
      }

      return this.#join(payload.sub);
    }

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
        localId: z.string().uuid(),
        attachments: z.array(
          z.object({
            kind: z.literal('image'),
            url: z.url(),
            thumb: z.url().optional()
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

  async #join(account: string): Promise<Response> {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const controller = new AbortController();

    const client: Client = { account, writer, controller };
    this.#clients.push(client);

    const encoder = new TextEncoder();

    controller.signal.addEventListener('abort', () => {
      this.#clients = this.#clients.filter(c => c !== client);
    });

    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // 클라이언트에게 응답을 먼저 반환하고 데이터를 쓰기 시작
    queueMicrotask(async () => {
      const history = await this.#loadRecentMessagesFromD1();
      for (const msg of history) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      }
    });

    return response;
  }

  #broadcast(message: ChatMessage) {
    const json = JSON.stringify(message);
    const data = `data: ${json}\n\n`;
    const encoder = new TextEncoder();

    this.#clients.forEach(async (c) => {
      try {
        await c.writer.write(encoder.encode(data));
      } catch (err) {
        console.error(`Failed to send to ${c.account}`, err);
        c.controller.abort();
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
