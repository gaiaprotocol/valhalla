// src/views/authenticated/home.ts
import { el } from '@webtaku/el';
import { TokenManager } from '../../auth/token';
import { View } from '../view';
import { createChatComponent } from '../../components/chat'; // ⭐️ 새 컴포넌트

const roomId = 'test';

function getMyAccount(): string {
  // 토큰 payload에서 sub 추출 (예시)
  const token = TokenManager.getToken();
  if (!token) return 'unknown';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload.sub || 'unknown';
  } catch {
    return 'unknown';
  }
}

function createHomeView(): View {
  /* ---------- 페이지 레이아웃 ---------- */
  const page = el('div', { className: 'page flex flex-col h-screen p-4' });

  /* ---------- ChatComponent 삽입 ---------- */
  const chat = createChatComponent({
    roomId,
    myAccount: getMyAccount(),
  });

  page.append(chat.el);

  /* ---------- View 인터페이스 ---------- */
  return {
    el: page,
    remove() {
      chat.remove();      // 컴포넌트 정리
      page.remove();
    },
  };
}

export { createHomeView };
