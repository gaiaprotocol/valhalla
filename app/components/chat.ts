import { el } from '@webtaku/el';
import { ChatMessage, ChatService } from '../services/chat';
import { Component } from './component';

interface Options {
  roomId: string;
  myAccount: string; // 현재 로그인한 사용자명
}

/** 외부 페이지에서 호출해 DOM 노드를 얻고, unmount 시 remove() 호출 */
export function createChatComponent(opts: Options): Component {
  const { roomId, myAccount } = opts;

  /* -------------------- 레이아웃 -------------------- */
  const root = el('div.chat-component', { className: 'flex flex-col h-full gap-4' });

  const header = el('h2', { className: 'text-xl font-semibold' }, `Room: ${roomId}`);

  const list = el('div', {
    className: 'flex-1 overflow-auto bg-slate-50 rounded p-2 space-y-2 text-sm',
  });

  const input = el('sl-input', {
    placeholder: 'Type a message…',
    pill: true,
    className: 'flex-1',
  });

  const sendBtn = el('sl-button', { variant: 'primary', pill: true }, 'Send');

  const composer = el('div', { className: 'flex gap-2' }, input, sendBtn);

  root.append(header, list, composer);

  /* ------------------ ChatService ------------------ */
  const service = new ChatService(roomId);
  service.connect();

  /* ------------------- 렌더 함수 ------------------- */
  function buildNode(msg: ChatMessage, pending = false): HTMLElement {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    return el(
      'div',
      {
        className: 'whitespace-pre-wrap',
        dataset: {
          id: String(msg.id),
        },
        style: {
          opacity: pending ? '0.5' : '1',
        },
      },
      `[${time}] ${msg.account}: ${msg.text}`,
    );
  }

  /** 낙관적 메시지: placeholder 반환 */
  function renderOptimistic(text: string): HTMLElement {
    const pendingMsg: ChatMessage = {
      id: -1,
      type: 'chat',
      account: myAccount,
      text,
      timestamp: Date.now(),
    };
    const node = buildNode(pendingMsg, true);
    node.dataset.temp = '1';
    list.append(node);
    list.scrollTop = list.scrollHeight;
    return node;
  }

  /** 서버 응답으로 placeholder 교체 */
  function overwritePlaceholder(node: HTMLElement, real: ChatMessage) {
    node.textContent = `[${new Date(real.timestamp).toLocaleTimeString()}] ${real.account}: ${real.text}`;
    node.style.opacity = '1';
    node.dataset.id = String(real.id);
    delete node.dataset.temp;
  }

  /** 실패 표시 */
  function markFailed(node: HTMLElement) {
    node.style.opacity = '0.5';
    node.style.color = 'red';
  }

  /* -------------------- 이벤트 -------------------- */
  service.addEventListener('message', (e) => {
    const msg = (e as CustomEvent<ChatMessage>).detail;

    // 이미 받은(내가 방금 보낸) placeholder가 있다면 무시
    const existing = list.querySelector<HTMLElement>(`[data-id="${msg.id}"]`);
    if (existing) return;

    list.append(buildNode(msg));
    list.scrollTop = list.scrollHeight;
  });

  service.addEventListener('error', (e) => {
    console.error('ChatService error:', (e as CustomEvent).detail);
  });

  /* ---------------- 전송 핸들러 ---------------- */
  sendBtn.addEventListener('click', async () => {
    const text = (input.value as string)?.trim();
    if (!text) return;
    input.value = '';

    const placeholder = renderOptimistic(text);

    try {
      const saved = await service.send(text);
      overwritePlaceholder(placeholder, saved);
    } catch {
      markFailed(placeholder);
    }
  });

  /* ---------------- View 리턴 ---------------- */
  return {
    el: root,
    remove() {
      service.disconnect();
      root.remove();
    },
  };
}
