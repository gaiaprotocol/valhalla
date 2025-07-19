import { el } from '@webtaku/el';
import { TokenManager } from '../../auth/token';
import { View } from '../view';

const roomId = 'test';

function createHomeView(): View {
  const page = el('ion-page');

  const chatList = el('ion-list');
  const input = el('ion-input', { placeholder: 'Type a message…' });
  const sendBtn = el('ion-button', { expand: 'block' }, 'Send');

  const content = el(
    'ion-content.ion-padding',
    el('h2', `Room: ${roomId}`),
    chatList,
    el('div',
      input,
      sendBtn
    )
  );

  page.append(content);

  function addMessage(message: { type: string; account: string; text?: string; timestamp: number }) {
    const time = new Date(message.timestamp).toLocaleTimeString();
    const text = `[${time}] ${message.account}: ${message.text || ''}`;

    chatList.append(
      el('ion-item',
        el('ion-label', text)
      )
    );

    chatList.scrollTop = chatList.scrollHeight;
  }

  let abortController: AbortController | null = null;
  let currentPromise: Promise<void> | null = null;
  let reconnectDelay = 3000;
  let stopped = false;

  async function connectSSE() {
    if (stopped) return;

    if (abortController) {
      abortController.abort();
      if (currentPromise) {
        try {
          await currentPromise;
        } catch {
          // 무시
        }
      }
    }

    abortController = new AbortController();

    currentPromise = (async () => {
      let reader: ReadableStreamDefaultReader | null = null;
      let buffer = '';

      try {
        console.log('Connecting to SSE…');

        const resp = await fetch(`/api/chat/${roomId}/stream`, {
          headers: {
            'Authorization': `Bearer ${TokenManager.getToken()}`
          },
          signal: abortController.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`SSE failed ${resp?.status}`);
        }

        reconnectDelay = 3000;

        reader = resp.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const json = line.slice(6);
              const msg = JSON.parse(json);
              addMessage(msg);
            }
          }
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          console.log('SSE aborted by client');
          return;
        }
        console.error('SSE error:', err);
      } finally {
        if (reader) {
          try {
            await reader.cancel();
          } catch { }
        }
        scheduleReconnect();
      }
    })();
  }

  function scheduleReconnect() {
    if (stopped) return;

    console.log(`Reconnecting in ${reconnectDelay / 1000}s…`);
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, 60000);
      connectSSE().catch(console.error);
    }, reconnectDelay);
  }

  connectSSE().catch(console.error);

  sendBtn.onclick = async () => {
    const text = (input.value as string)?.trim();
    if (!text) return;

    input.value = '';

    const token = TokenManager.getToken();

    const resp = await fetch(`/api/chat/${roomId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    if (!resp.ok) {
      console.error('Failed to send message', resp.status);
    }
  };

  return {
    el: page,
    remove: () => {
      stopped = true;
      if (abortController) {
        abortController.abort();
      }
      page.remove();
    }
  };
}

export { createHomeView };
