import { el } from '@webtaku/el';
import { fetchNotices } from '../../api/notice';
import { createNoticeDetailModal, createNoticeModal } from '../../modals/notice';
import { View } from '../view';
import { tokenManager } from '@gaiaprotocol/client-common';
import { createChatComponent } from '@gaiaprotocol/chat-client';
import { fetchMainGod, setMainGod } from '../../api/main-god';
import { createSelectMainGodModal } from '../../modals/select-main-god';

const roomId = 'test';

function getMyAccount(): string {
  const token = tokenManager.getToken();
  if (!token) return 'unknown';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload.sub || 'unknown';
  } catch {
    return 'unknown';
  }
}

function createHomeView(): View & {
  scrollToBottom: () => void;
} {
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

    chat.scrollToBottom();
  });

  /* ---------- ChatComponent ---------- */
  const chat = createChatComponent({
    roomId,
    myAccount: getMyAccount(),
    useAddressAvatar: true,
  });

  page.append(chat.el);

  fetchMainGod().then(data => {
    if (data.god_id === undefined) {
      const modal = createSelectMainGodModal({
        loadGods: () => Promise.resolve([]), //TODO: 구현
        onSelected: async (godId: string) => {
          await setMainGod(godId);
          //TODO: 선택 완료 후 UI 업데이트가 필요하면 여기서 갱신
        }
      });
      document.body.appendChild(modal);
      modal.present();
    }
  });

  return {
    el: page,
    scrollToBottom: chat.scrollToBottom,
    remove() {
      chat.remove();
      page.remove();
    },
  };
}

export { createHomeView };
