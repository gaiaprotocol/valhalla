import { el } from '@webtaku/el';
import { ChatMessage, ChatService } from '../services/chat';
import { createAddressAvatar } from './address-avatar';
import './chat.less';

interface Options {
  roomId: string;
  myAccount: string;
}

function createChatComponent({ roomId, myAccount }: Options) {
  const root = el('div.chat-component');
  const list = el('div.message-list');
  const input = el('sl-input', { placeholder: 'Type a message…', pill: true });
  const sendBtn = el('sl-button', { variant: 'primary', pill: true }, 'Send');
  const composer = el('div.composer', input, sendBtn);

  root.append(list, composer);

  const service = new ChatService(roomId);
  service.connect();

  /* ---------- view builders ---------- */
  function buildNode(msg: ChatMessage, pending = false): HTMLElement {
    const wrapper = el('div.message', {
      className: `${pending ? 'pending' : ''} ${msg.account === myAccount ? 'own' : ''}`.trim(),
      dataset: { id: String(msg.id) }
    });

    const avatar = createAddressAvatar(msg.account);
    avatar.classList.add('avatar');

    const meta = el(
      'div.meta',
      el('span.name', msg.account),
      el('time.time', new Date(msg.timestamp).toLocaleTimeString())
    );

    const text = el('div.text', msg.text);
    const body = el('div.msg-body', meta, text);

    wrapper.append(avatar, body);
    return wrapper;
  }

  /* ---------- optimistic UI helpers ---------- */
  function renderOptimistic(text: string) {
    const temp: ChatMessage = {
      id: -1,
      type: 'chat',
      account: myAccount,
      text,
      timestamp: Date.now()
    };
    const node = buildNode(temp, true);
    node.dataset.temp = '1';
    list.append(node);
    list.scrollTop = list.scrollHeight;
    return node;
  }

  function overwritePlaceholder(placeholder: HTMLElement, real: ChatMessage) {
    placeholder.replaceWith(buildNode(real));
  }

  function markFailed(node: HTMLElement) {
    node.classList.remove('pending');
    node.classList.add('failed');
  }

  /* ---------- incoming messages ---------- */
  service.addEventListener('message', (e) => {
    const msg = (e as CustomEvent<ChatMessage>).detail;

    // 이미 같은 id가 있으면 종료
    if (list.querySelector(`[data-id="${msg.id}"]`)) return;

    // 내가 방금 보낸 것이면, placeholder와 교체
    if (msg.account === myAccount) {
      const placeholder = Array.from(
        list.querySelectorAll<HTMLElement>('.message.pending[data-temp="1"]')
      ).find((node) => node.querySelector('.text')?.textContent === msg.text);

      if (placeholder) {
        overwritePlaceholder(placeholder, msg);
        list.scrollTop = list.scrollHeight;
        return;
      }
    }

    // 일반적인 수신 메시지
    list.append(buildNode(msg));
    list.scrollTop = list.scrollHeight;
  });

  /* ---------- outgoing messages ---------- */
  async function sendCurrentInput() {
    const text = (input.value as string).trim();
    if (!text) return;

    input.value = '';

    const placeholder = renderOptimistic(text);

    try {
      const saved = await service.send(text);
      overwritePlaceholder(placeholder, saved);
    } catch {
      markFailed(placeholder);
    }
  }

  sendBtn.addEventListener('click', sendCurrentInput);

  /* Enter 로 전송 (Shift+Enter 줄바꿈) */
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();          // 줄바꿈 방지
      sendCurrentInput();
    }
  });

  /* ---------- teardown ---------- */
  return {
    el: root,
    remove() {
      service.disconnect();
      root.remove();
    }
  };
}

export { createChatComponent };
