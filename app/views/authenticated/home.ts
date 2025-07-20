import { el } from '@webtaku/el';
import { TokenManager } from '../../auth/token';
import { View } from '../view';

const roomId = 'test';

function createHomeView(): View {
  // -------- 레이아웃 --------
  const page = el('div', { className: 'page flex flex-col h-screen p-4 gap-4' });

  // 채팅 목록 (스크롤 영역)
  const chatList = el('div', {
    className: 'chat-list flex-1 overflow-auto rounded bg-slate-50 p-2 space-y-2 text-sm',
  });

  // 입력 영역
  const input = el('sl-input', {
    placeholder: 'Type a message…',
    pill: true,
    className: 'flex-1',
  });

  const sendBtn = el('sl-button', { variant: 'primary', pill: true }, 'Send');

  const inputRow = el(
    'div',
    { className: 'flex gap-2' },
    input,
    sendBtn,
  );

  const header = el('h2', { className: 'text-xl font-semibold' }, `Room: ${roomId}`);

  page.append(header, chatList, inputRow);

  // -------- 메시지 유틸 --------
  function addMessage(message: { type: string; account: string; text?: string; timestamp: number }) {
    const time = new Date(message.timestamp).toLocaleTimeString();
    const label = el(
      'div',
      { className: 'whitespace-pre-wrap' },
      `[${time}] ${message.account}: ${message.text || ''}`,
    );
    chatList.append(label);
    chatList.scrollTop = chatList.scrollHeight;
  }

  // -------- SSE 연결 --------
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
        } catch { /* 무시 */ }
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
            'Authorization': `Bearer ${TokenManager.getToken()}`,
          },
          signal: abortController.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`SSE failed ${resp.status}`);
        }

        reconnectDelay = 3000;
        reader = resp.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const line of chunks) {
            if (line.startsWith('data: ')) {
              const msg = JSON.parse(line.slice(6));
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
          try { await reader.cancel(); } catch { /* 무시 */ }
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

  // -------- 전송 핸들러 --------
  sendBtn.addEventListener('click', async () => {
    const text = (input.value as string)?.trim();
    if (!text) return;
    input.value = '';

    const resp = await fetch(`/api/chat/${roomId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TokenManager.getToken()}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      console.error('Failed to send message', resp.status);
    }
  });

  // -------- View 인터페이스 --------
  return {
    el: page,
    remove() {
      stopped = true;
      abortController?.abort();
      page.remove();
    },
  };
}

export { createHomeView };
