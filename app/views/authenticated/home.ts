import { el } from '@webtaku/el';
import { fetchNotices } from '../../api/notice';
import { TokenManager } from '../../auth/token';
import { createChatComponent } from '../../components/chat';
import { createNoticeDetailModal, createNoticeModal } from '../../modals/notice';
import { View } from '../view';

const roomId = 'test';

function getMyAccount(): string {
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
  const page = el('div', { className: 'page flex flex-col h-screen p-4 gap-2' }, {
    style: { height: '100%' }
  });

  fetchNotices().then(notices => {
    const latestNotice = notices[0];
    const noticeBar = el(
      'div',
      {
        className: 'notice-bar',
        style: { cursor: 'pointer' },
        onclick: () => {
          const detailModal = createNoticeDetailModal(latestNotice);
          document.body.appendChild(detailModal);
          (detailModal as any).present?.() || (detailModal as any).showModal?.();
        }
      },
      el(
        'span',
        { className: 'title truncate', style: { maxWidth: '80%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } },
        `📢 ${latestNotice.title}`
      ),
      el(
        'button',
        {
          className: 'text-blue-600 text-xs underline', onclick: (e: Event) => {
            e.stopPropagation();
            let noticeModal = document.querySelector('ion-modal[trigger="open-notice"]');
            if (!noticeModal) {
              noticeModal = createNoticeModal(notices);
              document.body.appendChild(noticeModal);
            }
            (noticeModal as any).present?.() || (noticeModal as any).showModal?.();
          }
        },
        'All Notices'
      )
    );
    page.prepend(noticeBar);
  });

  /* ---------- ChatComponent ---------- */
  const chat = createChatComponent({
    roomId,
    myAccount: getMyAccount(),
  });

  page.append(chat.el);

  return {
    el: page,
    remove() {
      chat.remove();
      page.remove();
    },
  };
}

export { createHomeView };
