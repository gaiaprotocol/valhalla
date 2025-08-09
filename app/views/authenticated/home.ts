import { chatProfileService, createChatComponent } from '@gaiaprotocol/chat-client';
import { tokenManager } from '@gaiaprotocol/client-common';
import { el } from '@webtaku/el';
import { fetchMainGod, setMainGod } from '../../api/main-god';
import { fetchNotices } from '../../api/notice';
import { createNoticeDetailModal, createNoticeModal } from '../../modals/notice';
import { createSelectMainGodModal } from '../../modals/select-main-god';
import { View } from '../view';
import { fetchHeldNfts, HeldNft } from '../../api/nfts';

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

// 상대 경로 이미지 보정
function toImageUrl(img?: string | null) {
  if (!img) return '';
  try {
    return new URL(img).href; // 절대 경로면 그대로
  } catch {
    return `https://god-images.gaia.cc/${img}`;   // 상대 경로면 프리픽스 (환경에 맞게 조정)
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
        loadGods: async () => {
          const account = getMyAccount();
          if (!account || account === 'unknown') return [];

          // 특정 컬렉션만 보고 싶으면 opts.contract에 주소 넣으세요.
          const nfts: HeldNft[] = await fetchHeldNfts(account, {
            // contract: '0x134590ACB661Da2B318BcdE6b39eF5cF8208E372',
            // start: 0, end: 3332, limit: 50
          });

          return nfts.map(n => ({
            id: String(n.id),
            name: `${n.type ?? 'NFT'} #${n.id}`,
            image: toImageUrl(n.image),
            raw: n,
          }));
        },
        onSelected: async (godId: string) => {
          await setMainGod(godId);
          // 선택 완료 후 UI 업데이트가 필요하면 여기서 갱신
          const account = getMyAccount();
          chatProfileService.preload([account]);
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
