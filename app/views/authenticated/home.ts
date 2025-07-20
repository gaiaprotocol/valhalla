import { el } from '@webtaku/el';
import { TokenManager } from '../../auth/token';
import { createChatComponent } from '../../components/chat';
import { createNoticeDetailModal, createNoticeModal } from '../../modals/notice';
import { View } from '../view';

const roomId = 'test';

const notices = [
  { title: 'New Feature Released', date: '2025-07-15', content: 'We have released a new feature for better user experience.' },
  { title: 'Scheduled Maintenance', date: '2025-07-10', content: 'Our service will be down for maintenance from 1 AM to 3 AM.' },
  { title: 'Welcome to Valhalla', date: '2025-07-01', content: 'Thank you for joining Valhalla. Let’s get started!' },
];

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
            noticeModal = createNoticeModal();
            document.body.appendChild(noticeModal);
          }
          (noticeModal as any).present?.() || (noticeModal as any).showModal?.();
        }
      },
      'All Notices'
    )
  );

  /* ---------- ChatComponent ---------- */
  const chat = createChatComponent({
    roomId,
    myAccount: getMyAccount(),
  });

  page.append(noticeBar, chat.el);

  return {
    el: page,
    remove() {
      chat.remove();
      page.remove();
    },
  };
}

export { createHomeView };
