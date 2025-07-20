import { el } from '@webtaku/el';
import { TokenManager } from '../auth/token';
import { ChatMessage, ChatService } from '../services/chat';
import { Attachment } from '../types/chat';
import { createAddressAvatar } from './address-avatar';
import './chat.less';
import { Component } from './component';

interface Options {
  roomId: string;
  myAccount: string;
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    })
  );
}

function createChatComponent({ roomId, myAccount }: Options): Component {
  const pendingAttachments: { file: File, blobUrl: string }[] = [];

  const root = el('div.chat-component');
  const list = el('div.message-list');
  const input = el('sl-input', { placeholder: 'Type a message…', pill: true });
  const sendBtn = el('sl-button', { variant: 'primary', pill: true }, 'Send');
  const attachBtn = el('sl-icon-button', { name: 'paperclip' });
  const fileInput = el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });

  const composer = el('div.composer', input, fileInput, attachBtn, sendBtn);

  const thumbBar = el('div.thumb-bar');

  function pushThumb(file: File, blobUrl: string) {
    const wrapper = el('div.thumb-wrapper');

    const img = el('img.thumb', { src: blobUrl });
    const removeBtn = el('button.remove', '×');

    removeBtn.onclick = () => {
      // 배열에서 제거
      const idx = pendingAttachments.findIndex(p => p.blobUrl === blobUrl);
      if (idx >= 0) {
        URL.revokeObjectURL(pendingAttachments[idx].blobUrl);
        pendingAttachments.splice(idx, 1);
      }
      // DOM에서 제거
      wrapper.remove();
    };

    wrapper.append(img, removeBtn);
    thumbBar.append(wrapper);
  }

  attachBtn.onclick = () => fileInput.click();

  fileInput.onchange = () => {
    Array.from(fileInput.files || []).forEach(f => {
      const blobUrl = URL.createObjectURL(f);
      pendingAttachments.push({ file: f, blobUrl });
      pushThumb(f, blobUrl);
    });
    fileInput.value = '';
  };

  root.append(list, thumbBar, composer);

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

    const body = el('div.msg-body', meta);

    if (msg.text) body.append(el('div.text', msg.text));

    if (msg.attachments.length) {
      const gallery = el('div.attachments',
        ...msg.attachments.filter(a => a.kind === 'image')
          .map(a => el('img.img-msg', { src: a.url, alt: 'image' }))
      );
      body.append(gallery);
    }

    wrapper.append(avatar, body);
    return wrapper;
  }

  /* ---------- optimistic UI helpers ---------- */
  function renderOptimistic(text: string, attachments: Attachment[], localId: string) {
    const temp: ChatMessage = {
      id: -1,
      localId,
      type: 'chat',
      account: myAccount,
      text,
      attachments,
      timestamp: Date.now()
    };
    const node = buildNode(temp, true);
    node.dataset.localId = localId;
    list.append(node);

    waitForImages(node).then(() => {
      scrollToBottom();
    });

    return node;
  }

  function overwritePlaceholder(placeholder: HTMLElement, real: ChatMessage) {
    placeholder.replaceWith(buildNode(real));
  }

  function markFailed(node: HTMLElement) {
    node.classList.remove('pending');
    node.classList.add('failed');
  }

  function scrollToBottom() {
    list.scrollTop = list.scrollHeight;
  }

  /* ---------- incoming messages ---------- */
  service.addEventListener('message', (e) => {
    const msg = (e as CustomEvent<ChatMessage>).detail;

    if (msg.account === myAccount && msg.localId) {
      const ph = list.querySelector<HTMLElement>(`.message.pending[data-local-id="${msg.localId}"]`);
      if (ph) { overwritePlaceholder(ph, msg); scrollToBottom(); return; }
    }

    if (list.querySelector(`[data-id="${msg.id}"]`)) return; // safety
    list.append(buildNode(msg)); scrollToBottom();
  });

  /* ---------- outgoing messages ---------- */
  async function sendCurrentInput() {
    const text = (input.value as string).trim();
    if (!text && pendingAttachments.length === 0) return;

    input.value = '';

    /* ---------- 1) optimistic 노드 ---------- */
    const tempAttachments: Attachment[] = pendingAttachments.map(p => ({
      kind: 'image', url: p.blobUrl
    }));
    const localId = crypto.randomUUID();
    const placeholder = renderOptimistic(text, tempAttachments, localId);

    /* ---------- 2) 실제 업로드 ---------- */
    try {
      // 모든 파일 parallel 업로드
      const uploaded: Attachment[] = await Promise.all(
        pendingAttachments.map(async (p) => {
          const fd = new FormData(); fd.append('image', p.file);
          const res = await fetch('/api/upload-image', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${TokenManager.getToken()}` } });
          const { imageUrl, thumbnailUrl } = await res.json();
          return { kind: 'image', url: imageUrl, thumb: thumbnailUrl };
        })
      );

      /* ---------- 3) 메시지 전송 ---------- */
      const saved = await service.send(text, uploaded, localId);

      overwritePlaceholder(placeholder, saved);
    } catch {
      markFailed(placeholder);
    } finally {
      /* cleanup */
      pendingAttachments.forEach(p => URL.revokeObjectURL(p.blobUrl));
      pendingAttachments.length = 0;
      thumbBar.innerHTML = '';
    }
  }

  sendBtn.addEventListener('click', sendCurrentInput);

  /* Enter 로 전송 (Shift+Enter 줄바꿈) */
  input.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.isComposing || e.key === 'Process') return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();          // 줄바꿈 방지
        sendCurrentInput();
      }
    },
    { capture: true },
  );

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
