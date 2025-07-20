import { el } from '@webtaku/el';
import { TokenManager } from '../auth/token';
import { ChatMessage, ChatService } from '../services/chat';
import { Attachment } from '../types/chat';
import { createAddressAvatar } from './address-avatar';
import './chat.less';
import { Component } from './component';
import { shortenAddress } from '../utils/address';

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

function replaceWithFallback(img: HTMLImageElement) {
  const wrapper = el('div.img-fallback');
  wrapper.style.width = '180px';
  wrapper.style.height = '120px';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.justifyContent = 'center';
  wrapper.style.alignItems = 'center';
  wrapper.style.border = '1px solid var(--sl-color-neutral-200)';
  wrapper.style.borderRadius = '8px';
  wrapper.style.boxSizing = 'border-box';

  const icon = el('sl-icon', { name: 'image' });
  icon.style.fontSize = '48px';
  icon.style.color = 'var(--sl-color-neutral-500)';

  const msg = el('div', '불러올 수 없음');
  msg.style.fontSize = '12px';
  msg.style.color = 'var(--sl-color-neutral-600)';

  wrapper.append(icon, msg);
  img.replaceWith(wrapper);
}

function createChatComponent({ roomId, myAccount }: Options): Component {
  const pendingAttachments: { file: File, blobUrl: string }[] = [];

  const root = el('div.chat-component');
  const list = el('div.message-list');
  const input = el('sl-input', { placeholder: 'Type a message…', pill: true });
  const sendBtn = el('sl-button', { variant: 'primary', pill: true }, 'Send');
  const attachBtn = el('sl-button', { variant: 'default', circle: true },
    el('sl-icon', { name: 'paperclip' })
  );
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
      el('span.name', shortenAddress(msg.account)),
      el('time.time', new Date(msg.timestamp).toLocaleTimeString())
    );

    const body = el('div.msg-body', meta);

    if (msg.text) body.append(el('div.text', msg.text));

    if (msg.attachments.length) {
      const gallery = el('div.attachments',
        ...msg.attachments.filter(a => a.kind === 'image')
          .map(a => {
            const img = el(`img.img-msg`, { alt: 'image' }) as HTMLImageElement;
            img.src = a.url;
            if (!img.complete) {
              img.classList.add('img-loading');
              img.onload = () => img.classList.remove('img-loading');
              img.onerror = () => replaceWithFallback(img);
            }
            return img;
          })
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
    list.append(buildNode(msg));

    waitForImages(list).then(() => {
      scrollToBottom();
    });
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
